// lib/policy.ts
// ---------------------------------------------------------------------------
// Block B threshold policy (Decision 21). Pure functions, no DB. Consumed by
// recommendAwardAction (flag generation) and approveAward (gate enforcement).
// All money is integer minor units (cents); prices are integer "ticks"
// (price * 10_000) per lib/award-math.ts.
// ---------------------------------------------------------------------------
import { createHash } from 'crypto';
import { fromTicks } from './award-math';

// --- Types -----------------------------------------------------------------

export type AwardFlag = {
  /** sha1(severity + '|' + text) truncated to 8 hex chars. Stable across renders
   *  so the server can verify the approver acked the exact flag set. */
  id: string;
  severity: 'info' | 'warn';
  text: string;
};

/** Closed string union — do NOT migrate exceptions.status to pgEnum mid-block
 *  (per docs/blocks/block-b-approvals.md decision log). */
export type ExceptionStatus = 'open' | 'acknowledged' | 'closed';

export type ConcentrationSnapshot = Record<
  string,
  { shareBps: number; notionalMinor: number }
>;

export type FlagAckSet = readonly string[];

// --- Flag construction -----------------------------------------------------

export function makeAwardFlag(severity: AwardFlag['severity'], text: string): AwardFlag {
  const id = createHash('sha1').update(`${severity}|${text}`).digest('hex').slice(0, 8);
  return { id, severity, text };
}

// --- Threshold rules (Decision 21) -----------------------------------------

/** Rule (a): >$100M requires the approver step. 100M USD = 10_000_000_000 cents. */
export function requiresApprover(notionalMinor: number): boolean {
  return notionalMinor > 10_000_000_000;
}

/** Rule (b) gate: >$250M trips the committee-note requirement.
 *  $250M = 25_000_000_000 cents. Pilot enforces single-approver-plus-note;
 *  see HANDOFF.md:91. Block D may add true two-approver gating. */
export function requiresCommitteeNote(notionalMinor: number): boolean {
  return notionalMinor > 25_000_000_000;
}

/** Rule (b) validation: committee note must be ≥20 chars after trim. */
export function validateCommitteeNote(
  note: string | null | undefined,
): { ok: boolean; reason?: string } {
  if (typeof note !== 'string') {
    return { ok: false, reason: 'note required' };
  }
  if (note.trim().length < 20) {
    return { ok: false, reason: 'note must be at least 20 characters' };
  }
  return { ok: true };
}

/** Rule (c): dealer projected concentration >35% (3500 bps) → warn flag. */
export function concentrationFlag(projectedShareBps: number): AwardFlag | null {
  if (projectedShareBps <= 3500) return null;
  // bps → percent, one decimal place. 3501 → 35.0% (rounding at the boundary
  // is fine; the rule already fired on the bps comparison).
  const pct = (projectedShareBps / 100).toFixed(1);
  return makeAwardFlag(
    'warn',
    `Dealer concentration projected at ${pct}% (>35% threshold)`,
  );
}

/** Rule (d): allocation price deviates from best single quote → warn flag.
 *  Display prices to 4 decimal places via fromTicks (matches numeric(12,4)). */
export function bestExDeviationFlag(
  allocPriceTicks: number,
  bestSingleTicks: number,
): AwardFlag | null {
  if (allocPriceTicks === bestSingleTicks) return null;
  const alloc = fromTicks(allocPriceTicks).toFixed(4);
  const best = fromTicks(bestSingleTicks).toFixed(4);
  return makeAwardFlag(
    'warn',
    `Awarded price ${alloc} deviates from best quote ${best}`,
  );
}

// --- Concentration projection ----------------------------------------------

/**
 * Pure projection of a dealer-concentration snapshot. Adds proposedNotionalMinor
 * to the named dealer's numerator AND to the denominator (all dealers), then
 * recomputes every dealer's shareBps off the new total. Returns a NEW snapshot;
 * does not mutate the input.
 *
 * Edge case: empty `current` → proposed dealer gets 10000 bps (100%).
 */
export function projectConcentration(
  current: ConcentrationSnapshot,
  proposed: { dealerFirmId: string; proposedNotionalMinor: number },
): ConcentrationSnapshot {
  const next: Record<string, { notionalMinor: number; shareBps: number }> = {};

  // Copy existing dealers (notional only; shareBps recomputed below).
  for (const [firmId, row] of Object.entries(current)) {
    next[firmId] = { notionalMinor: row.notionalMinor, shareBps: 0 };
  }
  // Layer the proposed allocation on top.
  const existing = next[proposed.dealerFirmId]?.notionalMinor ?? 0;
  next[proposed.dealerFirmId] = {
    notionalMinor: existing + proposed.proposedNotionalMinor,
    shareBps: 0,
  };

  // New denominator = sum of all dealer notionals (post-projection).
  const total = Object.values(next).reduce((sum, r) => sum + r.notionalMinor, 0);

  if (total <= 0) {
    // Defensive: no exposure anywhere. Return zero-share snapshot.
    const zero: ConcentrationSnapshot = {};
    for (const [firmId, row] of Object.entries(next)) {
      zero[firmId] = { notionalMinor: row.notionalMinor, shareBps: 0 };
    }
    return zero;
  }

  const out: ConcentrationSnapshot = {};
  for (const [firmId, row] of Object.entries(next)) {
    // Integer math: scale before divide. shareBps rounded to nearest int.
    const shareBps = Math.round((row.notionalMinor * 10_000) / total);
    out[firmId] = { notionalMinor: row.notionalMinor, shareBps };
  }
  return out;
}

// --- Flag ack validation ---------------------------------------------------

/** Every `warn`-severity flag must be acked by id. `info` flags are display-only. */
export function validateFlagAcks(
  flags: readonly AwardFlag[],
  ackedIds: FlagAckSet,
): { ok: boolean; missing: string[] } {
  const acked = new Set(ackedIds);
  const missing = flags
    .filter((f) => f.severity === 'warn' && !acked.has(f.id))
    .map((f) => f.id);
  return { ok: missing.length === 0, missing };
}
