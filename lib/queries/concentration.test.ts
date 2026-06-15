import { describe, expect, it } from 'vitest';

// Generated-SQL guard (no live DB): mirrors lib/queries/rfqs.test.ts. The
// tenant-isolation acceptance gate (docs/blocks/block-b-approvals.md step 3 +
// /vr finding #12) requires that BOTH `firm_id` and `ccy` predicates appear
// in the rendered SQL — otherwise a missing JOIN could silently leak another
// tenant's notional totals into a dealer's share denominator.
describe('dealerConcentrationQuery', () => {
  it('renders firm + USD + 90-day predicates and joins trades to rfqs', async () => {
    // db/index.ts throws if DATABASE_URL is unset; a dummy is enough because
    // .toSQL() builds the statement without ever opening a connection.
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { dealerConcentrationQuery } = await import('./concentration');

    const { sql } = dealerConcentrationQuery(
      '00000000-0000-0000-0000-000000000000',
    ).toSQL();

    // Tenant + currency predicates (acceptance gate).
    expect(sql).toContain('"firm_id"');
    expect(sql).toContain('"ccy"');

    // 90-day window predicate present.
    expect(sql).toContain("INTERVAL '90 days'");

    // Join trades → rfqs (no direct trades.firmId; scoping rides on the join).
    expect(sql).toMatch(/inner join\s+"rfqs"/i);
  });
});

describe('aggregateToShareBps', () => {
  it('returns {} when there are no trades', async () => {
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { aggregateToShareBps } = await import('./concentration');
    expect(aggregateToShareBps([])).toEqual({});
  });

  it('returns 10000 bps for a single dealer with the entire book', async () => {
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { aggregateToShareBps } = await import('./concentration');
    const out = aggregateToShareBps([
      { dealerFirmId: 'atlas', notionalMinor: 100_000_000 },
    ]);
    expect(out).toEqual({
      atlas: { shareBps: 10000, notionalMinor: 100_000_000 },
    });
  });

  it('splits 60/40 between two dealers as 6000/4000 bps', async () => {
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { aggregateToShareBps } = await import('./concentration');
    const out = aggregateToShareBps([
      { dealerFirmId: 'atlas', notionalMinor: 60_000_000 },
      { dealerFirmId: 'kestrel', notionalMinor: 40_000_000 },
    ]);
    expect(out).toEqual({
      atlas: { shareBps: 6000, notionalMinor: 60_000_000 },
      kestrel: { shareBps: 4000, notionalMinor: 40_000_000 },
    });
  });
});
