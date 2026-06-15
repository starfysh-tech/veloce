// Internal-facing trade reference. Crockford base32 (no I/L/O/U), 8 chars over
// 40 random bits — ~10^12 distinct values. Mirrors lib/public-ref.ts. The
// `trades_ref_uniq` unique index is the collision backstop.
import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateTradeRef(): string {
  const bytes = randomBytes(5); // 40 bits
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let out = '';
  for (let i = 0; i < 8; i++) {
    out = ALPHABET[Number(bits & 31n)] + out;
    bits >>= 5n;
  }
  return 'T-' + out;
}
