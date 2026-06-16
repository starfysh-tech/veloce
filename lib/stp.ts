// lib/stp.ts
// ---------------------------------------------------------------------------
// FpML 5.12-style TradeCaptureReport builder. Pure function, no I/O. The
// returned object is persisted to handoffs.payload (jsonb) and rendered as
// pretty-printed JSON in the preview. Per Decision 12 this payload is NEVER
// transmitted — no network code lives here, enforced by stp.test.ts asserting
// the import allowlist.
//
// Ported from the POC builder at _legacy/components/ui.jsx:212. Differences:
//   - Returns the object (caller stringifies for <pre>); Drizzle handles jsonb.
//   - `generated` is passed in (deterministic for tests; no `new Date()` here).
//   - LEI/UTI fall back to firm shortCode; THROWS if both lei and shortCode
//     are null — the payload is the audit artifact and must not capture
//     `LEI-UNKNOWN`-grade bad data.
// ---------------------------------------------------------------------------

export type StpRfqInput = {
  publicRef: string;
  product: string;
  underlying: string;
  expiry: string;
  strike: string;
  notionalMinor: number;
  ccy: string;
  quoteUnit: string;
};

export type StpTradeInput = {
  /** Trade ref shown as legId. */
  ref: string;
  dealerFirmId: string;
  /** Allocation percent 1..100 (informational; allocatedNotionalMinor is authoritative). */
  pct: number;
  allocNotionalMinor: number;
  /** Price as decimal string from numeric(12,4). */
  price: string;
  uti: string | null;
};

export type StpFirmInput = {
  id: string;
  name: string;
  lei: string | null;
  shortCode: string | null;
};

export type StpPayload = {
  messageType: 'TradeCaptureReport';
  format: string;
  platform: string;
  generated: string;
  rfq: {
    publicRef: string;
    product: string;
    underlying: string;
    expiry: string;
    strike: string;
    notionalMinor: number;
    currency: string;
  };
  counterpartyLegs: Array<{
    legId: string;
    dealer: string;
    dealerLei: string;
    allocationPct: number;
    allocatedNotionalMinor: number;
    price: string;
    priceUnit: string;
    uti: string;
  }>;
  affirmation: { channel: string; method: string; sla: string };
  audit: { bestExecutionRecord: boolean; quoteLadderArchived: boolean; approvals: string };
};

export type StpPayloadLabel = string;

const PAYLOAD_FORMAT = 'FpML 5.12 (representative)';
const PLATFORM = 'Veloce RFQ Workflow';
const CHANNEL = 'MarkitWire (simulated)';

function resolveLei(firm: StpFirmInput): string {
  if (firm.lei) return firm.lei;
  if (firm.shortCode) return `5493${firm.shortCode}0000000000XX`;
  throw new Error(
    `Firm ${firm.id} missing both LEI and shortCode — cannot build STP payload.`,
  );
}

function resolveUti(rfqPublicRef: string, firm: StpFirmInput, trade: StpTradeInput, idx: number): string {
  if (trade.uti) return trade.uti;
  const code = firm.shortCode ?? firm.id.slice(0, 4).toUpperCase();
  return `UTI-${rfqPublicRef}-${code}-${String(idx + 1).padStart(2, '0')}`;
}

export function buildStpPayload(input: {
  rfq: StpRfqInput;
  trades: StpTradeInput[];
  firms: Record<string, StpFirmInput>;
  generatedAt: Date;
}): StpPayload {
  const { rfq, trades, firms, generatedAt } = input;
  if (!trades.length) {
    throw new Error('buildStpPayload requires at least one trade.');
  }
  return {
    messageType: 'TradeCaptureReport',
    format: PAYLOAD_FORMAT,
    platform: PLATFORM,
    generated: generatedAt.toISOString(),
    rfq: {
      publicRef: rfq.publicRef,
      product: rfq.product,
      underlying: rfq.underlying,
      expiry: rfq.expiry,
      strike: rfq.strike,
      notionalMinor: rfq.notionalMinor,
      currency: rfq.ccy,
    },
    counterpartyLegs: trades.map((t, i) => {
      const firm = firms[t.dealerFirmId];
      if (!firm) {
        throw new Error(`Missing firm ${t.dealerFirmId} for trade ${t.ref}.`);
      }
      return {
        legId: `${rfq.publicRef}-L${i + 1}`,
        dealer: firm.name,
        dealerLei: resolveLei(firm),
        allocationPct: t.pct,
        allocatedNotionalMinor: t.allocNotionalMinor,
        price: t.price,
        priceUnit: rfq.quoteUnit,
        uti: resolveUti(rfq.publicRef, firm, t, i),
      };
    }),
    affirmation: { channel: CHANNEL, method: 'electronic', sla: 'T+0 affirmation target' },
    audit: { bestExecutionRecord: true, quoteLadderArchived: true, approvals: 'attached' },
  };
}

export function payloadLabel(trades: StpTradeInput[]): StpPayloadLabel {
  return trades.length > 1
    ? `${PAYLOAD_FORMAT} · ${trades.length} legs`
    : PAYLOAD_FORMAT;
}

export { CHANNEL as STP_CHANNEL };
