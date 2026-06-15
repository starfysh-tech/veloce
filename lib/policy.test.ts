// lib/policy.test.ts
// Pins the four Decision-21 threshold rules + concentration projection +
// flag-ack validation. Anchored on rfq:0141 ($120M) where the seed exists;
// synthetic values for >$250M and the 35% concentration rule (no seed RFQ is
// that large or concentrated).
import { describe, it, expect } from 'vitest';
import {
  makeAwardFlag,
  requiresApprover,
  requiresCommitteeNote,
  validateCommitteeNote,
  concentrationFlag,
  bestExDeviationFlag,
  projectConcentration,
  validateFlagAcks,
  type AwardFlag,
} from './policy';
import { toTicks } from './award-math';

describe('requiresApprover (>$100M rule)', () => {
  it('rfq:0141 $120M trips the gate', () => {
    // $120M in cents = 12_000_000_000.
    expect(requiresApprover(12_000_000_000)).toBe(true);
  });
  it('boundary: $99,999,999.99 → false', () => {
    expect(requiresApprover(9_999_999_999)).toBe(false);
  });
  it('exactly $100M → false (rule is strictly greater than)', () => {
    expect(requiresApprover(10_000_000_000)).toBe(false);
  });
  it('one cent over $100M → true', () => {
    expect(requiresApprover(10_000_000_001)).toBe(true);
  });
});

describe('requiresCommitteeNote (>$250M rule)', () => {
  // Pilot enforces single-approver-plus-note. HANDOFF.md:91. Block D may add
  // two-approver. This test documents the gap.
  it('exactly $250M → false (strictly greater than)', () => {
    expect(requiresCommitteeNote(25_000_000_000)).toBe(false);
  });
  it('$250,000,000.01 → true', () => {
    expect(requiresCommitteeNote(25_000_000_001)).toBe(true);
  });
  it('rfq:0141 $120M does NOT trip committee note', () => {
    expect(requiresCommitteeNote(12_000_000_000)).toBe(false);
  });
});

describe('validateCommitteeNote', () => {
  it('rejects empty / whitespace / short / null / undefined', () => {
    expect(validateCommitteeNote('').ok).toBe(false);
    expect(validateCommitteeNote('   ').ok).toBe(false);
    expect(validateCommitteeNote('short').ok).toBe(false);
    expect(validateCommitteeNote(null).ok).toBe(false);
    expect(validateCommitteeNote(undefined).ok).toBe(false);
  });
  it('accepts ≥20 chars after trim', () => {
    // "this note is exactly twenty" = 27 chars; trimmed length ≥ 20.
    expect(validateCommitteeNote('this note is exactly twenty').ok).toBe(true);
  });
  it('rejects 19 chars (boundary)', () => {
    expect(validateCommitteeNote('a'.repeat(19)).ok).toBe(false);
  });
  it('accepts exactly 20 chars', () => {
    expect(validateCommitteeNote('a'.repeat(20)).ok).toBe(true);
  });
  it('trims surrounding whitespace before counting', () => {
    expect(validateCommitteeNote(`   ${'x'.repeat(20)}   `).ok).toBe(true);
  });
});

describe('concentrationFlag (35% rule)', () => {
  it('3500 bps (exactly 35%) → null', () => {
    expect(concentrationFlag(3500)).toBeNull();
  });
  it('3501 bps → warn AwardFlag', () => {
    const f = concentrationFlag(3501);
    expect(f).not.toBeNull();
    expect(f!.severity).toBe('warn');
    expect(f!.text).toContain('35.0%');
    expect(f!.text).toContain('>35% threshold');
  });
  it('text includes the projected percentage to one decimal', () => {
    const f = concentrationFlag(3678)!; // 36.78% → "36.8%"
    expect(f.text).toContain('36.8%');
  });
});

describe('bestExDeviationFlag', () => {
  it('equal ticks → null', () => {
    expect(bestExDeviationFlag(5200, 5200)).toBeNull();
  });
  it('different ticks → warn flag with both prices to 4 decimals', () => {
    // 0.4850 blended vs 0.5200 single (rfq:0141 figures).
    const f = bestExDeviationFlag(toTicks('0.4850'), toTicks('0.5200'));
    expect(f).not.toBeNull();
    expect(f!.severity).toBe('warn');
    expect(f!.text).toContain('0.4850');
    expect(f!.text).toContain('0.5200');
  });
});

describe('AwardFlag id stability', () => {
  it('same severity+text → same id', () => {
    const a = makeAwardFlag('warn', 'hello world');
    const b = makeAwardFlag('warn', 'hello world');
    expect(a.id).toBe(b.id);
  });
  it('different text → different id', () => {
    const a = makeAwardFlag('warn', 'hello world');
    const b = makeAwardFlag('warn', 'hello world!');
    expect(a.id).not.toBe(b.id);
  });
  it('different severity → different id', () => {
    const a = makeAwardFlag('warn', 'hello world');
    const b = makeAwardFlag('info', 'hello world');
    expect(a.id).not.toBe(b.id);
  });
  it('id is exactly 8 lowercase hex chars', () => {
    const a = makeAwardFlag('warn', 'anything');
    expect(a.id).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('projectConcentration', () => {
  it('empty current + 100M proposed → new dealer at 10000 bps', () => {
    const out = projectConcentration({}, {
      dealerFirmId: 'atlas',
      proposedNotionalMinor: 10_000_000_000,
    });
    expect(out.atlas.shareBps).toBe(10_000);
    expect(out.atlas.notionalMinor).toBe(10_000_000_000);
  });

  it('existing dealer 60M of 100M + 40M more for same dealer → ~7143 bps', () => {
    // Current: atlas 60M (6000 bps), kestrel 40M (4000 bps). Total 100M.
    // Propose +40M for atlas → atlas 100M / total 140M ≈ 7142.857 → 7143 bps.
    const current = {
      atlas: { notionalMinor: 6_000_000_000, shareBps: 6000 },
      kestrel: { notionalMinor: 4_000_000_000, shareBps: 4000 },
    };
    const out = projectConcentration(current, {
      dealerFirmId: 'atlas',
      proposedNotionalMinor: 4_000_000_000,
    });
    expect(out.atlas.shareBps).toBe(7143);
    // Kestrel re-baselined: 40M / 140M ≈ 2857 bps.
    expect(out.kestrel.shareBps).toBe(2857);
    // Shares sum to 10000 (within rounding tolerance).
    expect(out.atlas.shareBps + out.kestrel.shareBps).toBeGreaterThanOrEqual(9999);
    expect(out.atlas.shareBps + out.kestrel.shareBps).toBeLessThanOrEqual(10001);
  });

  it('does not mutate the input snapshot', () => {
    const current = {
      atlas: { notionalMinor: 6_000_000_000, shareBps: 6000 },
    };
    const before = JSON.stringify(current);
    projectConcentration(current, {
      dealerFirmId: 'atlas',
      proposedNotionalMinor: 1_000_000_000,
    });
    expect(JSON.stringify(current)).toBe(before);
  });

  it('30% dealer + proposal pushing to ~36% → concentrationFlag fires', () => {
    // Start: atlas 30M (3000 bps), others 70M (7000 bps). Total 100M.
    // Propose +10M for atlas → atlas 40M / total 110M ≈ 3636 bps (>3500).
    const current = {
      atlas: { notionalMinor: 3_000_000_000, shareBps: 3000 },
      others: { notionalMinor: 7_000_000_000, shareBps: 7000 },
    };
    const out = projectConcentration(current, {
      dealerFirmId: 'atlas',
      proposedNotionalMinor: 1_000_000_000,
    });
    expect(out.atlas.shareBps).toBe(3636);
    const flag = concentrationFlag(out.atlas.shareBps);
    expect(flag).not.toBeNull();
    expect(flag!.severity).toBe('warn');
  });
});

describe('validateFlagAcks', () => {
  const warnA = makeAwardFlag('warn', 'deviation A');
  const warnB = makeAwardFlag('warn', 'deviation B');
  const infoC = makeAwardFlag('info', 'context note');

  it('all warn flags acked → ok', () => {
    const res = validateFlagAcks([warnA, warnB], [warnA.id, warnB.id]);
    expect(res.ok).toBe(true);
    expect(res.missing).toEqual([]);
  });

  it('missing one warn flag → not ok, lists the missing id', () => {
    const res = validateFlagAcks([warnA, warnB], [warnA.id]);
    expect(res.ok).toBe(false);
    expect(res.missing).toEqual([warnB.id]);
  });

  it('info-severity flag unacked → still ok', () => {
    const res = validateFlagAcks([warnA, infoC], [warnA.id]);
    expect(res.ok).toBe(true);
  });

  it('extra acks for non-existent flags are ignored', () => {
    const res = validateFlagAcks([warnA], [warnA.id, 'deadbeef']);
    expect(res.ok).toBe(true);
  });

  it('empty flag list → trivially ok', () => {
    const res: ReturnType<typeof validateFlagAcks> = validateFlagAcks(
      [] as readonly AwardFlag[],
      [],
    );
    expect(res.ok).toBe(true);
  });
});
