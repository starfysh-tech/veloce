import { describe, expect, it } from 'vitest';

describe('dealerViewRfqQuery', () => {
  it('selects publicRef but not the internal sequence ref', async () => {
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { dealerViewRfqQuery } = await import('./dealer-view');

    const { sql } = dealerViewRfqQuery(
      '11111111-1111-1111-1111-111111111111',
    ).toSQL();

    expect(sql).toContain('"public_ref"');
    expect(sql).not.toMatch(/"rfqs"\."ref"/);
  });
});
