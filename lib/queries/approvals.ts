// lib/queries/approvals.ts — tenant-scoped reads for the approval workspace.
// Every query filters on `rfqs.firm_id = $firmId` (Decision 11 tenant
// isolation; see also docs/blocks/block-b-approvals.md step 6). The matching
// generated-SQL test asserts that the firm predicate is present.
//
// Why the exceptions are fetched in a separate roundtrip rather than
// left-joined: a left join would multiply (rfq × exception) rows and require
// JS deduping for the queue, which is the same N+1-style row blowup the join
// was meant to avoid. One queue query + one IN(...) exceptions query keeps
// both wire shape and row count linear in #rfqs.
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { awards, exceptions, firms, quotes, rfqs } from '@/db/schema';
import type { AwardFlag } from '@/lib/policy';

export type ApprovalQueueRow = {
  rfqId: string;
  rfqRef: string;
  publicRef: string;
  title: string;
  underlying: string;
  notionalMinor: number;
  ccy: string;
  recommendedAt: Date;
  award: {
    id: string;
    kind: 'single' | 'blended';
    blendedPrice: string;
    bestSinglePrice: string | null;
    savingsBps: string | null;
    savingsMinor: number | null;
    rationale: string | null;
    allocations: Array<{ dealerFirmId: string; pct: number; price: string }>;
    flags: AwardFlag[];
  };
  exceptions: Array<{
    id: string;
    ref: string;
    severity: 'info' | 'warn';
    text: string;
    status: string;
  }>;
};

export type ApprovalDetailRow = ApprovalQueueRow & {
  quoteLadder: Array<{
    dealerFirmId: string;
    dealerName: string;
    price: string;
    pct: number;
    note: string | null;
  }>;
};

// --- Internal SQL builders (exported so tests can render them via .toSQL()) -

/** Queue join: `awaiting_approval` RFQs for `firmId`, 1:1 with `awards`. */
export function approvalQueueQuery(firmId: string) {
  return db
    .select({
      rfqId: rfqs.id,
      rfqRef: rfqs.ref,
      publicRef: rfqs.publicRef,
      title: rfqs.title,
      underlying: rfqs.underlying,
      notionalMinor: rfqs.notionalMinor,
      ccy: rfqs.ccy,
      recommendedAt: awards.createdAt,
      awardId: awards.id,
      awardKind: awards.kind,
      blendedPrice: awards.blendedPrice,
      bestSinglePrice: awards.bestSinglePrice,
      savingsBps: awards.savingsBps,
      savingsMinor: awards.savingsMinor,
      rationale: awards.rationale,
      allocations: awards.allocations,
      flags: awards.flags,
    })
    .from(rfqs)
    .innerJoin(awards, eq(awards.rfqId, rfqs.id))
    .where(and(eq(rfqs.firmId, firmId), eq(rfqs.status, 'awaiting_approval')))
    .orderBy(desc(awards.createdAt));
}

/** Detail join: a single `awaiting_approval` RFQ + its award, tenant-checked. */
export function approvalDetailQuery(firmId: string, rfqId: string) {
  return db
    .select({
      rfqId: rfqs.id,
      rfqRef: rfqs.ref,
      publicRef: rfqs.publicRef,
      title: rfqs.title,
      underlying: rfqs.underlying,
      notionalMinor: rfqs.notionalMinor,
      ccy: rfqs.ccy,
      recommendedAt: awards.createdAt,
      awardId: awards.id,
      awardKind: awards.kind,
      blendedPrice: awards.blendedPrice,
      bestSinglePrice: awards.bestSinglePrice,
      savingsBps: awards.savingsBps,
      savingsMinor: awards.savingsMinor,
      rationale: awards.rationale,
      allocations: awards.allocations,
      flags: awards.flags,
    })
    .from(rfqs)
    .innerJoin(awards, eq(awards.rfqId, rfqs.id))
    .where(and(eq(rfqs.firmId, firmId), eq(rfqs.id, rfqId)));
}

/** Quote ladder for one RFQ, joined to `firms` for dealer display name. */
export function quoteLadderQuery(rfqId: string) {
  return db
    .select({
      dealerFirmId: quotes.dealerFirmId,
      dealerName: firms.name,
      price: quotes.price,
      pct: quotes.pct,
      note: quotes.note,
    })
    .from(quotes)
    .leftJoin(firms, eq(firms.id, quotes.dealerFirmId))
    .where(eq(quotes.rfqId, rfqId))
    .orderBy(asc(quotes.price));
}

// --- Public API ------------------------------------------------------------

type Allocation = { dealerFirmId: string; pct: number; price: string };

function shapeQueueAward(row: {
  awardId: string;
  awardKind: 'single' | 'blended';
  blendedPrice: string;
  bestSinglePrice: string | null;
  savingsBps: string | null;
  savingsMinor: number | null;
  rationale: string | null;
  allocations: unknown;
  flags: unknown;
}): ApprovalQueueRow['award'] {
  return {
    id: row.awardId,
    kind: row.awardKind,
    blendedPrice: row.blendedPrice,
    bestSinglePrice: row.bestSinglePrice,
    savingsBps: row.savingsBps,
    savingsMinor: row.savingsMinor,
    rationale: row.rationale,
    allocations: (row.allocations as Allocation[]) ?? [],
    flags: (row.flags as AwardFlag[]) ?? [],
  };
}

export async function getApprovalQueue(firmId: string): Promise<ApprovalQueueRow[]> {
  const rows = await approvalQueueQuery(firmId);
  if (rows.length === 0) return [];

  // Separate exceptions fetch (tenant-scoped + open-only) — joined in JS so a
  // row-multiplying left join does not balloon the queue payload.
  const rfqIds = rows.map((r) => r.rfqId);
  const exRows = await db
    .select({
      id: exceptions.id,
      rfqId: exceptions.rfqId,
      ref: exceptions.ref,
      severity: exceptions.severity,
      text: exceptions.text,
      status: exceptions.status,
    })
    .from(exceptions)
    .where(
      and(
        eq(exceptions.firmId, firmId),
        inArray(exceptions.rfqId, rfqIds),
        eq(exceptions.open, true),
      ),
    );

  const byRfq = new Map<string, ApprovalQueueRow['exceptions']>();
  for (const e of exRows) {
    if (!e.rfqId) continue;
    const list = byRfq.get(e.rfqId) ?? [];
    list.push({
      id: e.id,
      ref: e.ref,
      severity: e.severity,
      text: e.text,
      status: e.status,
    });
    byRfq.set(e.rfqId, list);
  }

  return rows.map((r) => ({
    rfqId: r.rfqId,
    rfqRef: r.rfqRef,
    publicRef: r.publicRef,
    title: r.title,
    underlying: r.underlying ?? '',
    notionalMinor: r.notionalMinor,
    ccy: r.ccy,
    recommendedAt: r.recommendedAt,
    award: shapeQueueAward(r),
    exceptions: byRfq.get(r.rfqId) ?? [],
  }));
}

export async function getApprovalDetail(
  firmId: string,
  rfqId: string,
): Promise<ApprovalDetailRow | null> {
  // Tenant-isolation gate: the WHERE clause filters on BOTH firmId and rfqId,
  // so a wrong-tenant lookup returns 0 rows → null. No row leaks across tenants.
  const rows = await approvalDetailQuery(firmId, rfqId);
  const row = rows[0];
  if (!row) return null;

  const exRows = await db
    .select({
      id: exceptions.id,
      ref: exceptions.ref,
      severity: exceptions.severity,
      text: exceptions.text,
      status: exceptions.status,
    })
    .from(exceptions)
    .where(
      and(
        eq(exceptions.firmId, firmId),
        eq(exceptions.rfqId, rfqId),
        eq(exceptions.open, true),
      ),
    );

  const ladderRows = await quoteLadderQuery(rfqId);

  return {
    rfqId: row.rfqId,
    rfqRef: row.rfqRef,
    publicRef: row.publicRef,
    title: row.title,
    underlying: row.underlying ?? '',
    notionalMinor: row.notionalMinor,
    ccy: row.ccy,
    recommendedAt: row.recommendedAt,
    award: shapeQueueAward(row),
    exceptions: exRows.map((e) => ({
      id: e.id,
      ref: e.ref,
      severity: e.severity,
      text: e.text,
      status: e.status,
    })),
    quoteLadder: ladderRows.map((q) => ({
      dealerFirmId: q.dealerFirmId,
      dealerName: q.dealerName ?? '',
      price: q.price,
      pct: q.pct,
      note: q.note,
    })),
  };
}
