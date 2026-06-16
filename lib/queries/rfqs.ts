// lib/queries/rfqs.ts — tenant-scoped RFQ reads. Every query takes a firmId
// and filters on it; the server component passes the caller's firmId so the
// browser never receives another tenant's rows (Decision 11).
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { rfqs } from '@/db/schema';
import { effectiveStatus } from '@/lib/auction-status';

/**
 * Resolve an RFQ's `firmId`, asserting it belongs to `callerFirmId`. Throws if
 * the RFQ doesn't exist or belongs to another firm. Used by approver actions
 * to derive the EventInput.firmId before opening recordEvent — the conditional
 * UPDATE inside the tx is the real source of truth for tenant ownership, but
 * the EventInput needs firmId up front.
 */
export async function getRfqFirmIdOrThrow(
  rfqId: string,
  callerFirmId: string,
): Promise<string> {
  const rows = await db
    .select({ firmId: rfqs.firmId })
    .from(rfqs)
    .where(eq(rfqs.id, rfqId))
    .limit(1);
  if (!rows.length) throw new Error('RFQ not found.');
  if (rows[0].firmId !== callerFirmId) throw new Error('Not your firm');
  return rows[0].firmId;
}

export type RfqListRow = {
  id: string;
  ref: string;
  publicRef: string;
  title: string;
  product: string;
  tenor: string | null;
  ccy: string;
  notionalMinor: number;
  notionalLabel: string | null;
  status: string;
  blind: boolean;
  deadline: Date | null;
  quoteCount: number;
  invitedCount: number;
};

// Exported (not just inlined) so the generated SQL can be asserted in a unit
// test without a live database — see rfqs.test.ts. Both count subqueries alias
// the inner table and qualify the outer ref (rfqs.id); a bare column there
// resolves against the inner table and silently yields 0 for every row.
export function rfqListQuery(firmId: string) {
  return db
    .select({
      id: rfqs.id,
      ref: rfqs.ref,
      publicRef: rfqs.publicRef,
      title: rfqs.title,
      product: rfqs.product,
      tenor: rfqs.tenor,
      ccy: rfqs.ccy,
      notionalMinor: rfqs.notionalMinor,
      notionalLabel: rfqs.notionalLabel,
      status: rfqs.status,
      blind: rfqs.blind,
      deadline: rfqs.deadline,
      quoteCount: sql<number>`(select count(*)::int from quotes q where q.rfq_id = rfqs.id)`,
      invitedCount: sql<number>`(select count(*)::int from rfq_invited_dealers d where d.rfq_id = rfqs.id)`,
    })
    .from(rfqs)
    .where(eq(rfqs.firmId, firmId))
    .orderBy(desc(rfqs.createdAt));
}

export async function listRfqs(firmId: string): Promise<RfqListRow[]> {
  const rows = await rfqListQuery(firmId);
  // Lazy sweep: display a live-but-expired RFQ as under_review (Decision 19).
  // The actual row flip happens on the detail read; the blotter only displays.
  return rows.map((r) => ({ ...r, status: effectiveStatus(r) }));
}

/** Single RFQ, tenant-checked. Returns null if not found or wrong tenant. */
export async function getRfq(firmId: string, rfqId: string) {
  return db.query.rfqs.findFirst({
    where: and(eq(rfqs.id, rfqId), eq(rfqs.firmId, firmId)),
  });
}
