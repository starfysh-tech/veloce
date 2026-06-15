// Public-facing RFQ reference. Crockford base32 (no I/L/O/U) for human
// quotability, 8 chars over 40 random bits — ~10^12 distinct values. The
// `rfqs.publicRef` unique constraint is the collision backstop.
import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generatePublicRef(): string {
  const bytes = randomBytes(5); // 40 bits
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let out = '';
  for (let i = 0; i < 8; i++) {
    out = ALPHABET[Number(bits & 31n)] + out;
    bits >>= 5n;
  }
  return 'RFQ-' + out;
}
