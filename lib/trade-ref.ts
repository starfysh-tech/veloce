// Internal-facing trade reference. Crockford base32 (no I/L/O/U), 8 chars over
// 40 random bits — ~10^12 distinct values. The `trades_ref_uniq` unique index
// is the collision backstop.
import { prefixedCrockfordRef } from './ref-base';

export function generateTradeRef(): string {
  return prefixedCrockfordRef('T-');
}
