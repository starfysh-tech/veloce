import { describe, expect, it } from 'vitest';

// No test database is available in CI, so this guards the bug at the generated-
// SQL layer instead of executing the query. The original blotter bug rendered
// the correlated count subqueries with unqualified columns (`"rfq_id" = "id"`);
// inside `from quotes q` Postgres resolved both names against the inner table,
// comparing each quote to its own id and returning 0 for every RFQ. The fix
// aliases the inner table and qualifies the outer ref (`q.rfq_id = rfqs.id`).
describe('rfqListQuery correlated counts', () => {
  it('correlates both count subqueries to the outer rfqs row', async () => {
    // db/index.ts throws if DATABASE_URL is unset; a dummy URL is enough because
    // .toSQL() builds the statement without ever opening a connection.
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { rfqListQuery } = await import('./rfqs');

    const { sql } = rfqListQuery('00000000-0000-0000-0000-000000000000').toSQL();

    expect(sql).toContain('from quotes q where q.rfq_id = rfqs.id');
    expect(sql).toContain('from rfq_invited_dealers d where d.rfq_id = rfqs.id');
    // Regression guard: the buggy form ended each subquery with a bare `= "id")`
    // that resolved against the inner table.
    expect(sql).not.toMatch(/=\s*"id"\)/);
  });
});
