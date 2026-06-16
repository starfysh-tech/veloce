import { describe, expect, it } from 'vitest';

// Generated-SQL guard (no live DB) — mirrors lib/queries/approvals.test.ts.
// Acceptance gate (Block C /vr): every Ops read MUST filter on rfqs.firm_id.
// `trades` and `handoffs` have no firm_id column of their own (db/schema.ts:225,
// 248) so the rfqs join IS the tenant gate.

describe('opsTradesQuery', () => {
  it('joins trades to rfqs and filters by rfqs.firm_id', async () => {
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { opsTradesQuery } = await import('./ops');

    const { sql, params } = opsTradesQuery(
      '00000000-0000-0000-0000-000000000000',
    ).toSQL();

    expect(sql).toMatch(/from\s+"trades"/i);
    expect(sql).toMatch(/inner join\s+"rfqs"/i);
    expect(sql).toMatch(/left join\s+"firms"/i);
    expect(sql).toMatch(/"rfqs"\."firm_id"\s*=\s*\$/);
    expect(params).toContain('00000000-0000-0000-0000-000000000000');
  });
});

describe('opsHandoffsQuery', () => {
  it('joins handoffs to rfqs and filters by rfqs.firm_id', async () => {
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { opsHandoffsQuery } = await import('./ops');

    const { sql, params } = opsHandoffsQuery(
      '00000000-0000-0000-0000-000000000000',
    ).toSQL();

    expect(sql).toMatch(/from\s+"handoffs"/i);
    expect(sql).toMatch(/inner join\s+"rfqs"/i);
    expect(sql).toMatch(/"rfqs"\."firm_id"\s*=\s*\$/);
    expect(sql).toMatch(/order by\s+"handoffs"\."sent_at"\s+desc/i);
    expect(params).toContain('00000000-0000-0000-0000-000000000000');
  });
});
