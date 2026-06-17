import { describe, expect, it } from 'vitest';

describe('admin queries', () => {
  it('scopes users to the caller firm', async () => {
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { adminUsersQuery } = await import('./admin');

    const { sql, params } = adminUsersQuery('00000000-0000-0000-0000-000000000000').toSQL();

    expect(sql).toMatch(/from\s+"users"/i);
    expect(sql).toMatch(/"users"\."firm_id"\s*=\s*\$/i);
    expect(params).toContain('00000000-0000-0000-0000-000000000000');
  });

  it('scopes bank panels through bank_panels.firm_id', async () => {
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { adminBankPanelsQuery } = await import('./admin');

    const { sql, params } = adminBankPanelsQuery('00000000-0000-0000-0000-000000000000').toSQL();

    expect(sql).toMatch(/from\s+"bank_panels"/i);
    expect(sql).toMatch(/left join\s+"bank_panel_members"/i);
    expect(sql).toMatch(/"bank_panels"\."firm_id"\s*=\s*\$/i);
    expect(params).toContain('00000000-0000-0000-0000-000000000000');
  });

  it('scopes the admin event log by events.firm_id', async () => {
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    const { adminEventsQuery } = await import('./admin');

    const { sql, params } = adminEventsQuery('00000000-0000-0000-0000-000000000000').toSQL();

    expect(sql).toMatch(/from\s+"events"/i);
    expect(sql).toMatch(/"events"\."firm_id"\s*=\s*\$/i);
    expect(sql).toMatch(/order by\s+"events"\."created_at"\s+desc/i);
    expect(sql).toMatch(/limit\s+\$/i);
    expect(params).toContain('00000000-0000-0000-0000-000000000000');
  });
});
