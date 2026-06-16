// Shared Crockford base32 generator for short, human-quotable references.
// 40 random bits → 8 chars over the Crockford alphabet (no I/L/O/U) —
// ~10^12 distinct values per call. Use a unique index on the destination
// column as the collision backstop.
import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Generate `prefix + 8 chars of Crockford base32`. Examples:
 *   prefixedCrockfordRef('RFQ-') → "RFQ-V71BMSC8"
 *   prefixedCrockfordRef('T-')   → "T-ZPATQ92T"
 */
export function prefixedCrockfordRef(prefix: string): string {
  const bytes = randomBytes(5); // 40 bits
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let out = '';
  for (let i = 0; i < 8; i++) {
    out = ALPHABET[Number(bits & 31n)] + out;
    bits >>= 5n;
  }
  return prefix + out;
}
