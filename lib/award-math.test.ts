// lib/award-math.test.ts
// Pins the pricing engine to the exact figures verified during the POC build.
// If any of these drift, the headline investor claim is wrong — these are the
// canary tests (Decision 8, Decision 13).
import { describe, it, expect } from 'vitest';
import {
  bestSingle, bestBlended, savings, buildBlendedProposal, fromTicks,
} from './award-math';

// Hero RFQ VEL-2026-0142: SPX 12M 90% put, $250M notional.
// atlas 100%@2.84, kestrel 100%@2.79, marlowe 40%@2.62, vantora 60%@2.68.
const HERO = [
  { id: 'q-atl', dealerFirmId: 'atlas', price: '2.8400', pct: 100 },
  { id: 'q-kst', dealerFirmId: 'kestrel', price: '2.7900', pct: 100 },
  { id: 'q-mrl', dealerFirmId: 'marlowe', price: '2.6200', pct: 40 },
  { id: 'q-vnt', dealerFirmId: 'vantora', price: '2.6800', pct: 60 },
];
const HERO_NOTIONAL = 250_000_000 * 100; // $250M in cents

describe('bestSingle', () => {
  it('picks the cheapest full-size quote', () => {
    const s = bestSingle(HERO);
    expect(s?.dealerFirmId).toBe('kestrel');
    expect(s?.price).toBe('2.7900');
  });

  it('ignores partial quotes even if cheaper', () => {
    const s = bestSingle(HERO);
    // marlowe @2.62 is cheaper but only 40% — must not win single.
    expect(s?.dealerFirmId).not.toBe('marlowe');
  });

  it('returns null when no full-size quote exists', () => {
    const partialOnly = HERO.filter((q) => q.pct < 100);
    expect(bestSingle(partialOnly)).toBeNull();
  });
});

describe('bestBlended', () => {
  it('stacks cheapest partials to cover 100%', () => {
    const b = bestBlended(HERO);
    expect(b).not.toBeNull();
    // marlowe 40% @2.62 + vantora 60% @2.68 covers 100%.
    const ids = b!.fills.map((f) => f.dealerFirmId);
    expect(ids).toEqual(['marlowe', 'vantora']);
    expect(b!.fills.map((f) => f.take)).toEqual([40, 60]);
  });

  it('computes the exact blended level 2.656%', () => {
    const b = bestBlended(HERO)!;
    // (40*2.62 + 60*2.68)/100 = 2.656
    expect(fromTicks(b.blendedTicks)).toBeCloseTo(2.656, 4);
  });

  it('returns null when partials cannot cover full size', () => {
    const short = [
      { id: 'a', dealerFirmId: 'x', price: '2.60', pct: 40 },
      { id: 'b', dealerFirmId: 'y', price: '2.62', pct: 30 },
    ];
    expect(bestBlended(short)).toBeNull();
  });
});

describe('savings', () => {
  it('computes 13.4 bps and $335,000 on the hero RFQ', () => {
    const single = bestSingle(HERO);
    const blend = bestBlended(HERO);
    const s = savings(HERO_NOTIONAL, single, blend)!;
    // 2.79 - 2.656 = 0.134 percentage points = 13.4 bps.
    expect(s.bps).toBeCloseTo(13.4, 1);
    // 0.134% of $250M = $335,000 → 33,500,000 cents.
    expect(s.minor).toBe(33_500_000);
  });
});

describe('VEL-2026-0141 approval RFQ', () => {
  // atlas 50%@0.45, kestrel 100%@0.52, marlowe 100%@0.58. $120M.
  const Q = [
    { id: 'a', dealerFirmId: 'atlas', price: '0.4500', pct: 50 },
    { id: 'k', dealerFirmId: 'kestrel', price: '0.5200', pct: 100 },
    { id: 'm', dealerFirmId: 'marlowe', price: '0.5800', pct: 100 },
  ];
  it('blends atlas 50 + kestrel 50 to 0.485 vs single 0.52', () => {
    const b = bestBlended(Q)!;
    expect(b.fills.map((f) => `${f.dealerFirmId}:${f.take}`)).toEqual(['atlas:50', 'kestrel:50']);
    expect(fromTicks(b.blendedTicks)).toBeCloseTo(0.485, 4);
    expect(bestSingle(Q)?.price).toBe('0.5200');
  });
});

describe('buildBlendedProposal', () => {
  it('produces a DB-ready proposal with string prices', () => {
    const p = buildBlendedProposal(HERO_NOTIONAL, HERO)!;
    expect(p.kind).toBe('blended');
    expect(p.blendedPrice).toBe('2.6560');
    expect(p.bestSinglePrice).toBe('2.7900');
    expect(p.savingsBps).toBeCloseTo(13.4, 1);
    expect(p.allocations).toHaveLength(2);
  });
});
