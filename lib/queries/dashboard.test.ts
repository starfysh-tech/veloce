import { describe, expect, it } from 'vitest';

describe('dashboard shaping helpers', () => {
  async function loadHelpers() {
    process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
    return import('./dashboard');
  }

  it('computes live response rate from live RFQs only', async () => {
    const { responseRatePct } = await loadHelpers();

    expect(responseRatePct([
      { status: 'live', quoteCount: 2, invitedCount: 4 },
      { status: 'live', quoteCount: 1, invitedCount: 2 },
      { status: 'awaiting_approval', quoteCount: 10, invitedCount: 10 },
    ])).toBe(50);
  });

  it('returns null response rate when no live dealers were invited', async () => {
    const { responseRatePct } = await loadHelpers();

    expect(responseRatePct([
      { status: 'draft', quoteCount: 0, invitedCount: 0 },
      { status: 'live', quoteCount: 0, invitedCount: 0 },
    ])).toBeNull();
  });

  it('finds highest concentration share', async () => {
    const { highestConcentrationBps } = await loadHelpers();

    expect(highestConcentrationBps({
      a: { shareBps: 2400 },
      b: { shareBps: 4100 },
      c: { shareBps: 3500 },
    })).toBe(4100);
  });

  it('counts concentration breaches above the policy cap', async () => {
    const { concentrationBreachCount } = await loadHelpers();

    expect(concentrationBreachCount([
      { shareBps: 3500 },
      { shareBps: 3501 },
      { shareBps: 9000 },
    ])).toBe(2);
  });
});
