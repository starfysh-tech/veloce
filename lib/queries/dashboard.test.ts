import { describe, expect, it } from 'vitest';
import { concentrationBreachCount, highestConcentrationBps, responseRatePct } from './dashboard-shape';

describe('dashboard shaping helpers', () => {
  it('computes live response rate from live RFQs only', () => {
    expect(responseRatePct([
      { status: 'live', quoteCount: 2, invitedCount: 4 },
      { status: 'live', quoteCount: 1, invitedCount: 2 },
      { status: 'awaiting_approval', quoteCount: 10, invitedCount: 10 },
    ])).toBe(50);
  });

  it('returns null response rate when no live dealers were invited', () => {
    expect(responseRatePct([
      { status: 'draft', quoteCount: 0, invitedCount: 0 },
      { status: 'live', quoteCount: 0, invitedCount: 0 },
    ])).toBeNull();
  });

  it('finds highest concentration share', () => {
    expect(highestConcentrationBps({
      a: { shareBps: 2400 },
      b: { shareBps: 4100 },
      c: { shareBps: 3500 },
    })).toBe(4100);
  });

  it('counts concentration breaches above the policy cap', () => {
    expect(concentrationBreachCount([
      { shareBps: 3500 },
      { shareBps: 3501 },
      { shareBps: 9000 },
    ])).toBe(2);
  });
});
