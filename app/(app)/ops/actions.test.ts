// Input-validation coverage for the four Ops/STP server actions. Same scope
// as app/(app)/approvals/actions.test.ts — the DB and recordEvent layer are
// NOT mocked here; these tests cover only the gates that throw BEFORE any DB
// call. End-to-end concurrency (stale state, partial trade lock loss, rfq
// drift on affirm) belongs in a live-DB validator script (mirror
// scripts/validate-block-b.ts) — out of scope for this commit.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Caller } from '@/lib/auth/caller';

const mocks = vi.hoisted(() => ({
  current: { kind: 'anonymous' } as Caller,
}));

vi.mock('@/lib/auth/caller', () => ({
  resolveUser: vi.fn(async () => mocks.current),
}));

process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';

const ANY_RFQ = '00000000-0000-0000-0000-000000000000';
const ANY_HANDOFF = '11111111-1111-1111-1111-111111111111';
const ANY_EXCEPTION = '22222222-2222-2222-2222-222222222222';
const OPS: Caller = {
  kind: 'user',
  userId: 'u-1',
  firmId: 'firm-1',
  role: 'ops',
  label: 'Test Ops',
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

describe('generateHandoff — role gate', () => {
  it('rejects anonymous callers', async () => {
    mocks.current = ANON;
    const { generateHandoff } = await import('./actions');
    await expect(generateHandoff({ rfqId: ANY_RFQ })).rejects.toThrow(/Only an ops/);
  });
  it('rejects non-ops roles (trader)', async () => {
    mocks.current = TRADER;
    const { generateHandoff } = await import('./actions');
    await expect(generateHandoff({ rfqId: ANY_RFQ })).rejects.toThrow(/Only an ops/);
  });
});

describe('advanceHandoff — role gate', () => {
  it('rejects anonymous callers', async () => {
    mocks.current = ANON;
    const { advanceHandoff } = await import('./actions');
    await expect(
      advanceHandoff({ handoffId: ANY_HANDOFF, to: 'matched' }),
    ).rejects.toThrow(/Only an ops/);
  });
  it('rejects non-ops roles', async () => {
    mocks.current = TRADER;
    const { advanceHandoff } = await import('./actions');
    await expect(
      advanceHandoff({ handoffId: ANY_HANDOFF, to: 'affirmed' }),
    ).rejects.toThrow(/Only an ops/);
  });
});

describe('openException — role gate + text validation', () => {
  it('rejects non-ops callers', async () => {
    mocks.current = TRADER;
    const { openException } = await import('./actions');
    await expect(
      openException({ handoffId: ANY_HANDOFF, text: 'SSI mismatch' }),
    ).rejects.toThrow(/Only an ops/);
  });
  it('requires non-empty text', async () => {
    mocks.current = OPS;
    const { openException } = await import('./actions');
    await expect(
      openException({ handoffId: ANY_HANDOFF, text: '' }),
    ).rejects.toThrow(/text is required/);
  });
  it('treats whitespace-only as empty', async () => {
    mocks.current = OPS;
    const { openException } = await import('./actions');
    await expect(
      openException({ handoffId: ANY_HANDOFF, text: '   \t  ' }),
    ).rejects.toThrow(/text is required/);
  });
});

describe('closeException — role gate', () => {
  it('rejects anonymous callers', async () => {
    mocks.current = ANON;
    const { closeException } = await import('./actions');
    await expect(
      closeException({ exceptionId: ANY_EXCEPTION }),
    ).rejects.toThrow(/Only an ops/);
  });
  it('rejects non-ops roles', async () => {
    mocks.current = TRADER;
    const { closeException } = await import('./actions');
    await expect(
      closeException({ exceptionId: ANY_EXCEPTION }),
    ).rejects.toThrow(/Only an ops/);
  });
});
