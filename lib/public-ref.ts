// Public-facing RFQ reference. Crockford base32 (no I/L/O/U) for human
// quotability, 8 chars over 40 random bits — ~10^12 distinct values. The
// `rfqs.publicRef` unique constraint is the collision backstop.
import { prefixedCrockfordRef } from './ref-base';

export function generatePublicRef(): string {
  return prefixedCrockfordRef('RFQ-');
}
