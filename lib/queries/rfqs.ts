// lib/queries/rfqs.ts — tenant-scoped RFQ reads. Every query takes a firmId
// and filters on it; the server component passes the caller's firmId so the
// browser never receives another tenant's rows (Decision 11).
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { rfqs } from '@/db/schema';
import { effectiveStatus } from '@/lib/auction-status';

export type RfqListRow = {
  id: string;
  ref: string;
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

export async function listRfqs(firmId: string): Promise<RfqListRow[]> {
  const rows = await db
    .select({
      id: rfqs.id,
      ref: rfqs.ref,
      title: rfqs.title,
      product: rfqs.product,
      tenor: rfqs.tenor,
      ccy: rfqs.ccy,
      notionalMinor: rfqs.notionalMinor,
      notionalLabel: rfqs.notionalLabel,
      status: rfqs.status,
      blind: rfqs.blind,
      deadline: rfqs.deadline,
      // Inner table is aliased and the outer ref is qualified (rfqs.id) so the
      // bare column never collides with quotes.id inside the subquery scope.
      quoteCount: sql<number>`(select count(*)::int from quotes q where q.rfq_id = rfqs.id)`,
      invitedCount: sql<number>`(select count(*)::int from rfq_invited_dealers d where d.rfq_id = ${rfqs.id})`,
    })
    .from(rfqs)
    .where(eq(rfqs.firmId, firmId))
    .orderBy(desc(rfqs.createdAt));
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
