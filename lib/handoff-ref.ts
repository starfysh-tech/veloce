// Internal-facing handoff reference. 40 random bits over Crockford base32 —
// ~10^12 distinct values, no collision backstop at pilot scale (per
// docs/blocks/block-c-ops-stp.md /vr revision). Add a unique index later if
// real volume warrants.
import { prefixedCrockfordRef } from './ref-base';

export function generateHandoffRef(): string {
  return prefixedCrockfordRef('H-');
}
