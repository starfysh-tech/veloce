// lib/queries/concentration.ts — trailing-90-day dealer notional concentration
// per firm (Block B threshold rule (c); reused by Block D). Joins `trades` to
// `rfqs` because `trades` has no direct `firmId`; tenant scoping rides on
// `rfqs.firmId`. Counts ALL `tradeStatus` values — committed exposure is not
// settlement state (Decision per docs/blocks/block-b-approvals.md).
import { and, eq, gte, sql, sum } from 'drizzle-orm';
import { db } from '@/db';
import { trades, rfqs } from '@/db/schema';

export type DealerConcentration = Record<
  string,
  {
    shareBps: number; // basis points 0–10000
    notionalMinor: number; // USD cents
  }
>;

// Exported so the generated SQL can be asserted in a unit test without a DB —
// see concentration.test.ts (mirrors lib/queries/rfqs.test.ts pattern).
export function dealerConcentrationQuery(firmId: string, asOf?: Date) {
  // `gte(..., sql<window>)` — Postgres computes `now() - INTERVAL '90 days'`
  // (or the bound `asOf - INTERVAL '90 days'`) once per row predicate. Pushing
  // the math into SQL keeps the predicate index-friendly on `trades.created_at`.
  const windowStart = asOf
    ? sql`${asOf.toISOString()}::timestamptz - INTERVAL '90 days'`
    : sql`now() - INTERVAL '90 days'`;
  const windowEnd = asOf ? sql`${asOf.toISOString()}::timestamptz` : sql`now()`;

  return db
    .select({
      dealerFirmId: trades.dealerFirmId,
      notionalMinor: sum(trades.allocNotionalMinor).mapWith(Number),
    })
    .from(trades)
    .innerJoin(rfqs, eq(trades.rfqId, rfqs.id))
    .where(
      and(
        eq(rfqs.firmId, firmId),
        // TODO(multi-ccy): widen once an FX table exists; for MVP, scope to USD
        // so summed `allocNotionalMinor` (minor units) is comparable across rows.
        eq(rfqs.ccy, 'USD'),
        gte(trades.createdAt, windowStart),
        sql`${trades.createdAt} <= ${windowEnd}`,
      ),
    )
    .groupBy(trades.dealerFirmId);
}

export async function getDealerConcentration(
  firmId: string,
  asOf?: Date,
): Promise<DealerConcentration> {
  const rows = await dealerConcentrationQuery(firmId, asOf);
  return aggregateToShareBps(rows);
}

// Pure projection: notional → shareBps. Extracted so the math is unit-testable
// without hitting the DB. `shareBps` is computed in JS (not SQL) for clarity
// and so rounding behavior is a single, auditable line.
export function aggregateToShareBps(
  rows: Array<{ dealerFirmId: string; notionalMinor: number | null }>,
): DealerConcentration {
  const totalMinor = rows.reduce((acc, r) => acc + (r.notionalMinor ?? 0), 0);
  if (totalMinor === 0) return {};
  const out: DealerConcentration = {};
  for (const r of rows) {
    const n = r.notionalMinor ?? 0;
    out[r.dealerFirmId] = {
      notionalMinor: n,
      shareBps: Math.round((n / totalMinor) * 10000),
    };
  }
  return out;
}
