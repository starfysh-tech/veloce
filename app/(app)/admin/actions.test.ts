import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Caller } from '@/lib/auth/caller';

const mocks = vi.hoisted(() => ({
  current: { kind: 'anonymous' } as Caller,
}));

vi.mock('@/lib/auth/caller', () => ({
  resolveUser: vi.fn(async () => mocks.current),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';

const PANEL_ID = '00000000-0000-0000-0000-000000000000';
const DEALERS = [
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
];
const ADMIN: Caller = {
  kind: 'user',
  userId: 'u-admin',
  firmId: 'firm-1',
  role: 'admin',
  label: 'Test Admin',
};
const TRADER: Caller = {
  kind: 'user',
  userId: 'u-trader',
  firmId: 'firm-1',
  role: 'trader',
  label: 'Test Trader',
};
const ANON: Caller = { kind: 'anonymous' };

beforeEach(() => {
  mocks.current = ANON;
});

describe('admin bank-panel actions — role gates', () => {
  it('rejects anonymous callers', async () => {
    mocks.current = ANON;
    const { renameBankPanelAction } = await import('./actions');
    await expect(renameBankPanelAction({ panelId: PANEL_ID, name: 'Core' })).rejects.toThrow(/Only an admin/);
  });

  it('rejects non-admin callers', async () => {
    mocks.current = TRADER;
    const { setDefaultBankPanelAction } = await import('./actions');
    await expect(setDefaultBankPanelAction({ panelId: PANEL_ID })).rejects.toThrow(/Only an admin/);
  });
});

describe('admin bank-panel actions — input gates', () => {
  it('requires a non-empty panel name before DB writes', async () => {
    mocks.current = ADMIN;
    const { createBankPanelAction } = await import('./actions');
    await expect(createBankPanelAction({ name: '   ', dealerFirmIds: DEALERS })).rejects.toThrow(/Panel name is required/);
  });

  it('requires at least three dealers for panel membership', async () => {
    mocks.current = ADMIN;
    const { updateBankPanelMembersAction } = await import('./actions');
    await expect(updateBankPanelMembersAction({ panelId: PANEL_ID, dealerFirmIds: DEALERS.slice(0, 2) })).rejects.toThrow(/At least three dealers/);
  });

  it('rejects duplicate dealer IDs before DB writes', async () => {
    mocks.current = ADMIN;
    const { createBankPanelAction } = await import('./actions');
    await expect(createBankPanelAction({ name: 'Dupes', dealerFirmIds: [DEALERS[0], DEALERS[0], DEALERS[1]] })).rejects.toThrow(/duplicates/);
  });
});
