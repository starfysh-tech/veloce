// lib/stp.test.ts
// Locks the FpML payload shape, the LEI/UTI fallback rules, and — critically —
// that lib/stp.ts imports nothing that could transmit the payload (Decision 12).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildStpPayload, payloadLabel, type StpFirmInput, type StpRfqInput, type StpTradeInput } from './stp';

const RFQ: StpRfqInput = {
  publicRef: 'PUB-ABCD1234',
  product: 'Equity Put Spread',
  underlying: 'NDX Index',
  expiry: '11 Jun 2027',
  strike: 'P 95% / P 80%',
  notionalMinor: 150_000_000 * 100,
  ccy: 'USD',
  quoteUnit: '% of notional',
};

const FIRMS: Record<string, StpFirmInput> = {
  'firm-kst': { id: 'firm-kst', name: 'Kestrel Securities', lei: '5493KST0000000000XX', shortCode: 'KST' },
  'firm-atl': { id: 'firm-atl', name: 'Atlas Markets', lei: null, shortCode: 'ATL' },
  'firm-bad': { id: 'firm-bad', name: 'No-Identifier Bank', lei: null, shortCode: null },
};

const TRADES: StpTradeInput[] = [
  { ref: 'T-AAAA1111', dealerFirmId: 'firm-kst', pct: 60, allocNotionalMinor: 9_000_000_000, price: '1.9200', uti: null },
  { ref: 'T-BBBB2222', dealerFirmId: 'firm-atl', pct: 40, allocNotionalMinor: 6_000_000_000, price: '1.9500', uti: 'UTI-PRESET-01' },
];

const FIXED_TIME = new Date('2026-06-16T12:00:00.000Z');

describe('buildStpPayload', () => {
  it('builds a TradeCaptureReport-shaped payload', () => {
    const payload = buildStpPayload({ rfq: RFQ, trades: TRADES, firms: FIRMS, generatedAt: FIXED_TIME });
    expect(payload.messageType).toBe('TradeCaptureReport');
    expect(payload.format).toMatch(/FpML/);
    expect(payload.generated).toBe('2026-06-16T12:00:00.000Z');
    expect(payload.rfq.publicRef).toBe('PUB-ABCD1234');
    expect(payload.rfq.notionalMinor).toBe(15_000_000_000);
    expect(payload.counterpartyLegs).toHaveLength(2);
  });

  it('uses firm.lei when present', () => {
    const payload = buildStpPayload({ rfq: RFQ, trades: [TRADES[0]], firms: FIRMS, generatedAt: FIXED_TIME });
    expect(payload.counterpartyLegs[0].dealerLei).toBe('5493KST0000000000XX');
  });

  it('falls back to shortCode-synthesized LEI when firm.lei is null', () => {
    const payload = buildStpPayload({ rfq: RFQ, trades: [TRADES[1]], firms: FIRMS, generatedAt: FIXED_TIME });
    expect(payload.counterpartyLegs[0].dealerLei).toBe('5493ATL0000000000XX');
  });

  it('throws when a firm has neither LEI nor shortCode (audit-grade bad data)', () => {
    const trade: StpTradeInput = { ...TRADES[0], dealerFirmId: 'firm-bad' };
    expect(() => buildStpPayload({ rfq: RFQ, trades: [trade], firms: FIRMS, generatedAt: FIXED_TIME }))
      .toThrow(/missing both LEI and shortCode/);
  });

  it('uses trade.uti when present, synthesizes otherwise', () => {
    const payload = buildStpPayload({ rfq: RFQ, trades: TRADES, firms: FIRMS, generatedAt: FIXED_TIME });
    expect(payload.counterpartyLegs[0].uti).toBe('UTI-PUB-ABCD1234-KST-01');
    expect(payload.counterpartyLegs[1].uti).toBe('UTI-PRESET-01');
  });

  it('throws on empty trades', () => {
    expect(() => buildStpPayload({ rfq: RFQ, trades: [], firms: FIRMS, generatedAt: FIXED_TIME }))
      .toThrow(/at least one trade/);
  });

  it('throws when a trade references an unknown firm', () => {
    const trade: StpTradeInput = { ...TRADES[0], dealerFirmId: 'firm-missing' };
    expect(() => buildStpPayload({ rfq: RFQ, trades: [trade], firms: FIRMS, generatedAt: FIXED_TIME }))
      .toThrow(/Missing firm/);
  });
});

describe('payloadLabel', () => {
  it('singular for one leg', () => {
    expect(payloadLabel(1)).toBe('FpML 5.12 (representative)');
  });
  it('count for multi-leg', () => {
    expect(payloadLabel(2)).toBe('FpML 5.12 (representative) · 2 legs');
  });
});

// Decision 12 enforcement: lib/stp.ts must not import anything that could
// transmit the payload. Allowlist-based — adding a new import deliberately
// requires updating this list and explaining why in review.
describe('lib/stp.ts imports', () => {
  const source = readFileSync(resolve(__dirname, 'stp.ts'), 'utf8');
  const importLines = source.match(/^import .* from .*$/gm) ?? [];

  it('has no imports (no network, no I/O, no db, no email)', () => {
    expect(importLines).toEqual([]);
  });

  it('mentions no transmission primitives anywhere in source', () => {
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/XMLHttpRequest/);
    expect(source).not.toMatch(/require\s*\(\s*['"]node:https?['"]\s*\)/);
    expect(source).not.toMatch(/from\s+['"]node:https?['"]/);
    expect(source).not.toMatch(/from\s+['"](?:axios|got|undici|node-fetch)['"]/);
    expect(source).not.toMatch(/Resend/);
  });
});
