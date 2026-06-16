import { describe, expect, it } from 'vitest';

describe('compliance queries', () => {
  it('scopes the best-ex overview to the caller firm', async () => {
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { complianceBestExQuery } = await import('./compliance');

    const { sql, params } = complianceBestExQuery(
      '00000000-0000-0000-0000-000000000000',
    ).toSQL();

    expect(sql).toMatch(/from\s+"rfqs"/i);
    expect(sql).toMatch(/left join\s+"awards"/i);
    expect(sql).toContain('"firm_id"');
    expect(params).toContain('00000000-0000-0000-0000-000000000000');
  });

  it('scopes the event log by events.firm_id', async () => {
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { complianceEventLogQuery } = await import('./compliance');

    const { sql, params } = complianceEventLogQuery(
      '00000000-0000-0000-0000-000000000000',
    ).toSQL();

    expect(sql).toMatch(/from\s+"events"/i);
    expect(sql).toMatch(/left join\s+"rfqs".*"rfqs"\."firm_id"\s*=\s*\$/i);
    expect(sql).toMatch(/"events"\."firm_id"\s*=\s*\$/i);
    expect(sql).toMatch(/order by\s+"events"\."created_at"\s+desc/i);
    expect(sql).toMatch(/limit\s+\$/i);
    expect(params).toContain('00000000-0000-0000-0000-000000000000');
  });

  it('reads compliance exceptions, not handoff exceptions', async () => {
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { complianceExceptionsQuery } = await import('./compliance');

    const { sql, params } = complianceExceptionsQuery(
      '00000000-0000-0000-0000-000000000000',
    ).toSQL();

    expect(sql).toMatch(/from\s+"exceptions"/i);
    expect(sql).not.toContain('handoff_exceptions');
    expect(sql).toMatch(/left join\s+"rfqs".*"rfqs"\."firm_id"\s*=\s*\$/i);
    expect(sql).toMatch(/"exceptions"\."firm_id"\s*=\s*\$/i);
    expect(params).toContain('00000000-0000-0000-0000-000000000000');
  });

  it('tenant-scopes export quote ladder through rfqs', async () => {
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { complianceQuoteLadderQuery } = await import('./compliance');

    const { sql, params } = complianceQuoteLadderQuery(
      '00000000-0000-0000-0000-000000000000',
      '11111111-1111-1111-1111-111111111111',
    ).toSQL();

    expect(sql).toMatch(/from\s+"quotes"/i);
    expect(sql).toMatch(/inner join\s+"rfqs"/i);
    expect(sql).toMatch(/"rfqs"\."firm_id"\s*=\s*\$/i);
    expect(params).toContain('00000000-0000-0000-0000-000000000000');
    expect(params).toContain('11111111-1111-1111-1111-111111111111');
  });

  it('tenant-scopes export award through rfqs', async () => {
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { complianceAwardQuery } = await import('./compliance');

    const { sql, params } = complianceAwardQuery(
      '00000000-0000-0000-0000-000000000000',
      '11111111-1111-1111-1111-111111111111',
    ).toSQL();

    expect(sql).toMatch(/from\s+"awards"/i);
    expect(sql).toMatch(/inner join\s+"rfqs"/i);
    expect(sql).toMatch(/"rfqs"\."firm_id"\s*=\s*\$/i);
    expect(params).toContain('00000000-0000-0000-0000-000000000000');
    expect(params).toContain('11111111-1111-1111-1111-111111111111');
  });

  it('tenant-scopes export event labels through rfqs', async () => {
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { complianceRfqEventsQuery } = await import('./compliance');

    const { sql, params } = complianceRfqEventsQuery(
      '00000000-0000-0000-0000-000000000000',
      '11111111-1111-1111-1111-111111111111',
    ).toSQL();

    expect(sql).toMatch(/from\s+"events"/i);
    expect(sql).toMatch(/inner join\s+"rfqs".*"rfqs"\."firm_id"\s*=\s*\$/i);
    expect(sql).toMatch(/"events"\."firm_id"\s*=\s*\$/i);
    expect(params).toContain('00000000-0000-0000-0000-000000000000');
    expect(params).toContain('11111111-1111-1111-1111-111111111111');
  });
});
