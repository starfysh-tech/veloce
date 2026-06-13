// lib/award-math.ts
// ---------------------------------------------------------------------------
// The pricing engine. Ported from the POC's format.js but server-side and
// integer-safe (Decision 8). This computes the headline claim — blended beats
// single — so it is unit-tested against exact figures in award-math.test.ts.
//
// Prices arrive as strings from numeric(12,4) columns; we work in integer
// "price ticks" (price * 10_000) to avoid float drift, then convert back only
// at the boundary.
// ---------------------------------------------------------------------------

export type QuoteLike = {
  id: string;
  dealerFirmId: string;
  /** price as a decimal string from the DB, e.g. "2.7900" */
  price: string;
  /** max size this dealer will take, 1..100 */
  pct: number;
};

export type Fill = { id: string; dealerFirmId: string; price: string; take: number };
export type BlendResult = { fills: Fill[]; blendedTicks: number };
export type Savings = { bps: number; minor: number };

const SCALE = 10_000; // numeric(12,4) → integer ticks

export const toTicks = (price: string): number => Math.round(parseFloat(price) * SCALE);
export const fromTicks = (ticks: number): number => ticks / SCALE;

/**
 * Best single-bank award: lowest-priced quote that covers full size (pct=100).
 * Returns null if no dealer will take 100%.
 */
export function bestSingle(quotes: QuoteLike[]): QuoteLike | null {
  const fullSize = quotes.filter((q) => q.pct === 100);
  if (fullSize.length === 0) return null;
  return fullSize.reduce((best, q) => (toTicks(q.price) < toTicks(best.price) ? q : best));
}

/**
 * Best blended award: fill 100% of size greedily from cheapest quotes, each
 * capped at the dealer's max pct. Returns null if partial quotes can't cover
 * 100%. blendedTicks is the size-weighted average price in integer ticks.
 */
export function bestBlended(quotes: QuoteLike[]): BlendResult | null {
  const sorted = [...quotes].sort((a, b) => toTicks(a.price) - toTicks(b.price));
  let remaining = 100;
  const fills: Fill[] = [];

  for (const q of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, q.pct);
    if (take <= 0) continue;
    fills.push({ id: q.id, dealerFirmId: q.dealerFirmId, price: q.price, take });
    remaining -= take;
  }

  if (remaining > 0) return null; // cannot cover full size

  // Size-weighted average in ticks: Σ(take * priceTicks) / 100.
  // take and 100 are integers; priceTicks is integer; division is the only
  // rounding point and it lands on a tick boundary for whole-percent fills.
  const weighted = fills.reduce((sum, f) => sum + f.take * toTicks(f.price), 0);
  const blendedTicks = Math.round(weighted / 100);
  return { fills, blendedTicks };
}

/**
 * Savings of a blended award vs the best single-bank quote.
 *  - bps: difference in basis points (price is already a percentage, so a
 *    price delta of 0.10 == 10bps; ticks delta / SCALE * 100).
 *  - minor: cash saving in minor currency units over the notional.
 */
export function savings(
  notionalMinor: number,
  single: QuoteLike | null,
  blend: BlendResult | null,
): Savings | null {
  if (!single || !blend) return null;
  const deltaTicks = toTicks(single.price) - blend.blendedTicks;
  const bps = (deltaTicks / SCALE) * 100;
  // price is % of notional; saving = (deltaTicks/SCALE/100) * notional.
  const minor = Math.round((deltaTicks / SCALE / 100) * notionalMinor);
  return { bps: round2(bps), minor };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Build the canonical blended proposal object stored on `awards`. */
export function buildBlendedProposal(
  notionalMinor: number,
  quotes: QuoteLike[],
) {
  const single = bestSingle(quotes);
  const blend = bestBlended(quotes);
  if (!blend) return null;
  const sav = savings(notionalMinor, single, blend);
  return {
    kind: 'blended' as const,
    blendedPrice: fromTicks(blend.blendedTicks).toFixed(4),
    bestSinglePrice: single ? single.price : null,
    bestSingleDealerId: single ? single.dealerFirmId : null,
    savingsBps: sav ? sav.bps : null,
    savingsMinor: sav ? sav.minor : null,
    allocations: blend.fills.map((f) => ({
      dealerFirmId: f.dealerFirmId, pct: f.take, price: f.price,
    })),
  };
}
