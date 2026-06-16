// app/(app)/approvals/actions.test.ts
// ---------------------------------------------------------------------------
// Input-validation coverage for the three approver server actions. The DB and
// recordEvent layer are NOT mocked — these tests cover only the gates that
// throw BEFORE any DB call:
//
//   - approveAward / rejectAward / requestClarification reject non-approvers
//   - rejectAward requires a non-empty trimmed reason
//   - requestClarification requires a non-empty trimmed note
//
// Concurrency (StaleApprovalError on a moved RFQ), flag-ack mismatch, and the
// >$250M committee-note enforcement run inside apply(tx), so they're covered
// by scripts/validate-block-b.ts end-to-end against a live DB, not here.
// ---------------------------------------------------------------------------
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Caller } from '@/lib/auth/caller';

// Hoisted mock controller; tests mutate `current` to swap caller identity.
const mocks = vi.hoisted(() => ({
  current: { kind: 'anonymous' } as Caller,
}));

vi.mock('@/lib/auth/caller', () => ({
  resolveUser: vi.fn(async () => mocks.current),
}));

// DATABASE_URL is required by db/index.ts at import time. A dummy is fine —
// the gates we exercise throw before any query runs.
process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';

const ANY_RFQ_ID = '00000000-0000-0000-0000-000000000000';
const APPROVER: Caller = {
  kind: 'user',
  userId: 'u-1',
  firmId: 'firm-1',
  role: 'approver',
  label: 'Test Approver',
};
const TRADER: Caller = {
  kind: 'user',
  userId: 'u-2',
  firmId: 'firm-1',
  role: 'trader',
  label: 'Test Trader',
};
const ANON: Caller = { kind: 'anonymous' };

beforeEach(() => {
  mocks.current = ANON;
});

describe('approveAward — role gate', () => {
  it('rejects anonymous callers', async () => {
    mocks.current = ANON;
    const { approveAward } = await import('./actions');
    await expect(
      approveAward({ rfqId: ANY_RFQ_ID, ackedFlagIds: [] }),
    ).rejects.toThrow(/Only an approver/);
  });

  it('rejects non-approver roles (trader)', async () => {
    mocks.current = TRADER;
    const { approveAward } = await import('./actions');
    await expect(
      approveAward({ rfqId: ANY_RFQ_ID, ackedFlagIds: [] }),
    ).rejects.toThrow(/Only an approver/);
  });
});

describe('rejectAward — role gate + reason validation', () => {
  it('rejects non-approvers', async () => {
    mocks.current = TRADER;
    const { rejectAward } = await import('./actions');
    await expect(
      rejectAward({ rfqId: ANY_RFQ_ID, reason: 'whatever' }),
    ).rejects.toThrow(/Only an approver/);
  });

  it('requires a non-empty reason', async () => {
    mocks.current = APPROVER;
    const { rejectAward } = await import('./actions');
    await expect(
      rejectAward({ rfqId: ANY_RFQ_ID, reason: '' }),
    ).rejects.toThrow(/reason is required/);
  });

  it('treats whitespace-only as empty (trims before length check)', async () => {
    mocks.current = APPROVER;
    const { rejectAward } = await import('./actions');
    await expect(
      rejectAward({ rfqId: ANY_RFQ_ID, reason: '   \t\n  ' }),
    ).rejects.toThrow(/reason is required/);
  });
});

describe('requestClarification — role gate + note validation', () => {
  it('rejects non-approvers', async () => {
    mocks.current = TRADER;
    const { requestClarification } = await import('./actions');
    await expect(
      requestClarification({ rfqId: ANY_RFQ_ID, note: 'whatever' }),
    ).rejects.toThrow(/Only an approver/);
  });

  it('requires a non-empty note', async () => {
    mocks.current = APPROVER;
    const { requestClarification } = await import('./actions');
    await expect(
      requestClarification({ rfqId: ANY_RFQ_ID, note: '' }),
    ).rejects.toThrow(/note is required/);
  });

  it('treats whitespace-only as empty', async () => {
    mocks.current = APPROVER;
    const { requestClarification } = await import('./actions');
    await expect(
      requestClarification({ rfqId: ANY_RFQ_ID, note: '   ' }),
    ).rejects.toThrow(/note is required/);
  });
});
