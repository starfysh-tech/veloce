import { describe, expect, it } from 'vitest';

// Generated-SQL guard (no live DB): mirrors lib/queries/concentration.test.ts
// and lib/queries/rfqs.test.ts. The acceptance gate for the approval workspace
// (docs/blocks/block-b-approvals.md step 6) demands that every read filter on
// `firm_id` — without it a cross-tenant browse could surface another firm's
// awaiting_approval queue. The queue read also MUST scope to
// `status = 'awaiting_approval'`; the detail read MUST gate on the rfq id.
describe('approvalQueueQuery', () => {
  it('renders firm + awaiting_approval predicates and joins rfqs to awards', async () => {
    // db/index.ts throws if DATABASE_URL is unset; a dummy URL is enough because
    // .toSQL() builds the statement without ever opening a connection.
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { approvalQueueQuery } = await import('./approvals');

    const { sql, params } = approvalQueueQuery(
      '00000000-0000-0000-0000-000000000000',
    ).toSQL();

    // Tenant + status predicates (acceptance gate). Drizzle parameterizes
    // both the firm uuid and the status enum literal, so we verify the column
    // appears in the SQL and the value is bound.
    expect(sql).toContain('"firm_id"');
    expect(sql).toMatch(/"rfqs"\."status"\s*=\s*\$/);
    expect(params).toContain('awaiting_approval');
    expect(params).toContain('00000000-0000-0000-0000-000000000000');

    // Inner-join awards onto rfqs (1:1 via awards_rfq_uniq).
    expect(sql).toMatch(/inner join\s+"awards"/i);
  });
});

describe('approvalDetailQuery', () => {
  it('renders firm + rfq id predicates (tenant-isolation gate)', async () => {
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { approvalDetailQuery } = await import('./approvals');

    const { sql, params } = approvalDetailQuery(
      '00000000-0000-0000-0000-000000000000',
      '11111111-1111-1111-1111-111111111111',
    ).toSQL();

    // Tenant + row predicates.
    expect(sql).toContain('"firm_id"');
    expect(sql).toMatch(/"rfqs"\."id"\s*=\s*\$/);

    // The rfq id we passed MUST appear in the bound params; otherwise the
    // predicate could be hard-coded to a constant and still pass the regex.
    expect(params).toContain('11111111-1111-1111-1111-111111111111');
  });
});

describe('quoteLadderQuery', () => {
  it('joins quotes to firms for dealer display name', async () => {
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { quoteLadderQuery } = await import('./approvals');

    const { sql } = quoteLadderQuery(
      '11111111-1111-1111-1111-111111111111',
    ).toSQL();

    // Left-join firms onto quotes to surface the dealer name in the ladder.
    expect(sql).toMatch(/from\s+"quotes"/i);
    expect(sql).toMatch(/left join\s+"firms"/i);
    // Ordered by price ascending (lower-is-better default).
    expect(sql).toMatch(/order by\s+"quotes"\."price"\s+asc/i);
  });
});
