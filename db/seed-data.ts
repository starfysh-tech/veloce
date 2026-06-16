// db/seed-data.ts
// ---------------------------------------------------------------------------
// Demo tenant data, ported from the POC seed.js into the relational schema.
// Deterministic UUIDs (namespaced) so re-running the seed is idempotent and
// foreign keys line up without lookups. Money is in MINOR units (cents).
// Prices are decimal strings matching numeric(12,4).
// ---------------------------------------------------------------------------
import { createHash } from 'node:crypto';

// Deterministic UUID v5-style from a stable key, so seeds are reproducible.
export function seedId(key: string): string {
  const h = createHash('sha1').update(`veloce-seed:${key}`).digest('hex');
  return [
    h.slice(0, 8), h.slice(8, 12),
    '5' + h.slice(13, 16),               // version 5 nibble
    ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32),
  ].join('-');
}

export const DEMO_PASSWORD = 'veloce-ft';

// ----------------------------------------------------------------- firms
export const FIRMS = [
  { id: seedId('firm:meridian'), name: 'Meridian Mutual Insurance', type: 'insurer' as const, city: 'Hartford, CT', lei: '5493001MERIDIAN77US', shortCode: null, colorHex: null },
  { id: seedId('firm:halcyon'), name: 'Halcyon Capital Partners', type: 'fund' as const, city: 'New York, NY', lei: '5493004HALCYON21US', shortCode: null, colorHex: null },
  { id: seedId('firm:atlas'), name: 'Atlas Markets', type: 'dealer' as const, city: 'Global', lei: '5493ATL0000000000XX', shortCode: 'ATL', colorHex: '#5B8DEF' },
  { id: seedId('firm:kestrel'), name: 'Kestrel Securities', type: 'dealer' as const, city: 'Global', lei: '5493KST0000000000XX', shortCode: 'KST', colorHex: '#2EB67D' },
  { id: seedId('firm:marlowe'), name: 'Marlowe & Co.', type: 'dealer' as const, city: 'Global', lei: '5493MRL0000000000XX', shortCode: 'MRL', colorHex: '#E2A33B' },
  { id: seedId('firm:vantora'), name: 'Vantora Capital Markets', type: 'dealer' as const, city: 'Global', lei: '5493VNT0000000000XX', shortCode: 'VNT', colorHex: '#9A7BFF' },
  { id: seedId('firm:helvetia'), name: 'Helvetia Global Bank', type: 'dealer' as const, city: 'Global', lei: '5493HGB0000000000XX', shortCode: 'HGB', colorHex: '#E25C6A' },
];

export const DEALER = {
  atlas: seedId('firm:atlas'),
  kestrel: seedId('firm:kestrel'),
  marlowe: seedId('firm:marlowe'),
  vantora: seedId('firm:vantora'),
  helvetia: seedId('firm:helvetia'),
};
const MERIDIAN = seedId('firm:meridian');
const HALCYON = seedId('firm:halcyon');

// ----------------------------------------------------------------- users
// Buy-side only. email is the Auth login; password is DEMO_PASSWORD for all.
export const USERS = [
  { id: seedId('user:dana'), firmId: MERIDIAN, email: 'dana@meridian.example', fullName: 'Dana Whitfield', role: 'trader' as const, desk: 'Derivatives Desk' },
  { id: seedId('user:marcus'), firmId: MERIDIAN, email: 'marcus@meridian.example', fullName: 'Marcus Oyelaran', role: 'approver' as const, desk: 'Treasury Committee' },
  { id: seedId('user:tomas'), firmId: MERIDIAN, email: 'tomas@meridian.example', fullName: 'Tomás Ferreira', role: 'ops' as const, desk: 'Middle Office' },
  { id: seedId('user:ingrid'), firmId: MERIDIAN, email: 'ingrid@meridian.example', fullName: 'Ingrid Sørensen', role: 'compliance' as const, desk: 'Risk & Compliance' },
  { id: seedId('user:alex'), firmId: MERIDIAN, email: 'alex@meridian.example', fullName: 'Alex Kim', role: 'admin' as const, desk: 'Platform Operations' },
  // HALCYON ops user — rfq:0139 (awarded, HALCYON-owned) needs an ops caller
  // in its tenant for the /ops Generate-handoff affordance to be reachable.
  // Without this user the awarded HALCYON trade is dead UI for every other
  // seed user (all MERIDIAN).
  { id: seedId('user:priya'), firmId: HALCYON, email: 'priya@halcyon.example', fullName: 'Priya Krishnan', role: 'ops' as const, desk: 'Middle Office' },
];

// --------------------------------------------------------------- panels
export const PANELS = [
  { id: seedId('panel:core-us'), firmId: MERIDIAN, name: 'Core US Vol Panel', isDefault: true, members: [DEALER.atlas, DEALER.kestrel, DEALER.marlowe, DEALER.vantora] },
  { id: seedId('panel:global'), firmId: MERIDIAN, name: 'Global Macro Panel', isDefault: false, members: [DEALER.atlas, DEALER.kestrel, DEALER.marlowe, DEALER.vantora, DEALER.helvetia] },
  { id: seedId('panel:eu'), firmId: MERIDIAN, name: 'European Equity Panel', isDefault: false, members: [DEALER.helvetia, DEALER.marlowe, DEALER.vantora] },
];

// ----------------------------------------------------------------- rfqs
// deadlineOffsetMin: minutes relative to seed time. Negative = already closed.
// null = no deadline (draft). The hero RFQ is left Live with a forward window.
type SeedRfq = {
  key: string; ref: string; firmId: string; requesterId: string | null;
  title: string; product: string; template: string; side: string;
  underlying: string; refLevel: string; strike: string; expiry: string;
  style: string; tenor: string; notionalMinor: number; ccy: string;
  notionalLabel: string | null; quoteUnit: string; mode: 'split' | 'full';
  blind: boolean; status: string; deadlineOffsetMin: number | null; windowMinutes: number;
  invited: string[];
};

export const RFQS: SeedRfq[] = [
  {
    key: 'rfq:0142', ref: 'VEL-2026-0142', firmId: MERIDIAN, requesterId: seedId('user:dana'),
    title: 'S&P 500 — 12M 90% Put Hedge', product: 'Equity Put Option', template: 'Index Put Hedge',
    side: 'Buy protection', underlying: 'SPX Index', refLevel: '6,520.00', strike: '90% (5,868.00)',
    expiry: '11 Jun 2027', style: 'European · Cash settled', tenor: '12M',
    notionalMinor: 250_000_000 * 100, ccy: 'USD', notionalLabel: null, quoteUnit: '% of notional',
    mode: 'split', blind: true, status: 'live', deadlineOffsetMin: 18, windowMinutes: 30,
    invited: [DEALER.atlas, DEALER.kestrel, DEALER.marlowe, DEALER.vantora, DEALER.helvetia],
  },
  {
    key: 'rfq:0141', ref: 'VEL-2026-0141', firmId: MERIDIAN, requesterId: seedId('user:dana'),
    title: 'Russell 2000 — 6M Collar 95 / 107', product: 'Equity Collar', template: 'Zero-Cost Collar',
    side: 'Buy put / sell call', underlying: 'RTY Index', refLevel: '2,310.00', strike: 'P 95% / C 107%',
    expiry: '11 Dec 2026', style: 'European · Cash settled', tenor: '6M',
    notionalMinor: 120_000_000 * 100, ccy: 'USD', notionalLabel: null, quoteUnit: '% net premium',
    mode: 'split', blind: true, status: 'awaiting_approval', deadlineOffsetMin: -95, windowMinutes: 45,
    invited: [DEALER.atlas, DEALER.kestrel, DEALER.marlowe],
  },
  {
    key: 'rfq:0139', ref: 'VEL-2026-0139', firmId: HALCYON, requesterId: null,
    title: 'EURO STOXX 50 — 9M Variance Swap', product: 'Variance Swap', template: 'Index Variance Swap',
    side: 'Buy variance', underlying: 'SX5E Index', refLevel: '5,140.00', strike: 'Quoted (vol strike)',
    expiry: '11 Mar 2027', style: 'Variance · Cash settled', tenor: '9M',
    notionalMinor: 450_000 * 100, ccy: 'EUR', notionalLabel: '€450,000 vega', quoteUnit: 'vol strike',
    mode: 'full', blind: true, status: 'awarded', deadlineOffsetMin: -26 * 60, windowMinutes: 30,
    invited: [DEALER.marlowe, DEALER.atlas, DEALER.helvetia],
  },
  {
    key: 'rfq:0138', ref: 'VEL-2026-0138', firmId: MERIDIAN, requesterId: seedId('user:dana'),
    title: 'NASDAQ-100 — 12M Put Spread 95 / 80', product: 'Equity Put Spread', template: 'Index Put Spread',
    side: 'Buy protection', underlying: 'NDX Index', refLevel: '23,180.00', strike: 'P 95% / P 80%',
    expiry: '11 Jun 2027', style: 'European · Cash settled', tenor: '12M',
    notionalMinor: 150_000_000 * 100, ccy: 'USD', notionalLabel: null, quoteUnit: '% of notional',
    mode: 'full', blind: true, status: 'in_stp', deadlineOffsetMin: -50 * 60, windowMinutes: 30,
    invited: [DEALER.kestrel, DEALER.atlas, DEALER.vantora, DEALER.helvetia],
  },
  {
    key: 'rfq:0136', ref: 'VEL-2026-0136', firmId: MERIDIAN, requesterId: seedId('user:dana'),
    title: 'Custom Basket — Equity Hedge Overlay Put', product: 'Equity-Linked Overlay', template: 'Overlay Basket Put',
    side: 'Buy protection', underlying: 'MERI-EQ-BSKT-04 (32 names)', refLevel: '100.00 (basket)', strike: '92.5%',
    expiry: '10 Jun 2027', style: 'European · Cash settled', tenor: '12M',
    notionalMinor: 300_000_000 * 100, ccy: 'USD', notionalLabel: null, quoteUnit: '% of notional',
    mode: 'split', blind: true, status: 'affirmed', deadlineOffsetMin: -3 * 24 * 60, windowMinutes: 60,
    invited: [DEALER.atlas, DEALER.vantora, DEALER.kestrel, DEALER.marlowe],
  },
  {
    key: 'rfq:0143', ref: 'VEL-2026-0143', firmId: MERIDIAN, requesterId: seedId('user:dana'),
    title: 'S&P 500 — 3M Collar 97 / 105', product: 'Equity Collar', template: 'Zero-Cost Collar',
    side: 'Buy put / sell call', underlying: 'SPX Index', refLevel: '6,520.00', strike: 'P 97% / C 105%',
    expiry: '11 Sep 2026', style: 'European · Cash settled', tenor: '3M',
    notionalMinor: 200_000_000 * 100, ccy: 'USD', notionalLabel: null, quoteUnit: '% net premium',
    mode: 'split', blind: true, status: 'draft', deadlineOffsetMin: null, windowMinutes: 30,
    invited: [DEALER.atlas, DEALER.kestrel, DEALER.marlowe, DEALER.vantora],
  },
  {
    key: 'rfq:0140', ref: 'VEL-2026-0140', firmId: HALCYON, requesterId: null,
    title: 'FTSE 100 — 6M 92.5% Put Hedge', product: 'Equity Put Option', template: 'Index Put Hedge',
    side: 'Buy protection', underlying: 'UKX Index', refLevel: '8,920.00', strike: '92.5% (8,251.00)',
    expiry: '11 Dec 2026', style: 'European · Cash settled', tenor: '6M',
    notionalMinor: 90_000_000 * 100, ccy: 'GBP', notionalLabel: null, quoteUnit: '% of notional',
    mode: 'full', blind: true, status: 'under_review', deadlineOffsetMin: -3 * 60, windowMinutes: 30,
    invited: [DEALER.helvetia, DEALER.marlowe, DEALER.vantora],
  },
  {
    key: 'rfq:0135', ref: 'VEL-2026-0135', firmId: HALCYON, requesterId: null,
    title: 'EURO STOXX 50 — 12M 90% Put Hedge', product: 'Equity Put Option', template: 'Index Put Hedge',
    side: 'Buy protection', underlying: 'SX5E Index', refLevel: '5,140.00', strike: '90% (4,626.00)',
    expiry: '10 Jun 2027', style: 'European · Cash settled', tenor: '12M',
    notionalMinor: 140_000_000 * 100, ccy: 'EUR', notionalLabel: null, quoteUnit: '% of notional',
    mode: 'split', blind: true, status: 'awarded', deadlineOffsetMin: -4 * 24 * 60, windowMinutes: 30,
    invited: [DEALER.helvetia, DEALER.vantora, DEALER.atlas, DEALER.marlowe],
  },
];

// ---------------------------------------------------------------- quotes
// price as decimal string; pct as max size. mine flag dropped (dealer identity
// is now the firm). rfqKey ties back to RFQS[].key.
export const QUOTES = [
  { rfqKey: 'rfq:0142', dealer: DEALER.atlas, price: '2.8400', pct: 100, note: 'Axe to buy vol — can upsize to $300M on request.' },
  { rfqKey: 'rfq:0142', dealer: DEALER.kestrel, price: '2.7900', pct: 100, note: 'Firm for 30 minutes. Delta hedge at close available.' },
  { rfqKey: 'rfq:0142', dealer: DEALER.marlowe, price: '2.6200', pct: 40, note: 'Balance-sheet capped at $100M — sharp on partial.' },
  { rfqKey: 'rfq:0142', dealer: DEALER.vantora, price: '2.6800', pct: 60, note: 'Partial only; most competitive on first $150M.' },
  { rfqKey: 'rfq:0141', dealer: DEALER.atlas, price: '0.4500', pct: 50, note: 'Tight on half size; full size would widen to 0.55%.' },
  { rfqKey: 'rfq:0141', dealer: DEALER.kestrel, price: '0.5200', pct: 100, note: 'Full size, firm.' },
  { rfqKey: 'rfq:0141', dealer: DEALER.marlowe, price: '0.5800', pct: 100, note: 'Full size available.' },
  { rfqKey: 'rfq:0139', dealer: DEALER.marlowe, price: '21.4000', pct: 100, note: 'Standard SX5E var terms, 2.5x cap.' },
  { rfqKey: 'rfq:0139', dealer: DEALER.atlas, price: '21.6500', pct: 100, note: '2.5x cap, T+2.' },
  { rfqKey: 'rfq:0139', dealer: DEALER.helvetia, price: '21.9000', pct: 100, note: 'Subject to credit check refresh.' },
  { rfqKey: 'rfq:0140', dealer: DEALER.helvetia, price: '2.1500', pct: 100, note: 'Firm to 09:00 London tomorrow.' },
  { rfqKey: 'rfq:0140', dealer: DEALER.marlowe, price: '2.2200', pct: 100, note: 'Full size.' },
];

// Dealer emails for invitation tokens (magic-link recipients).
export const DEALER_EMAILS: Record<string, string> = {
  [DEALER.atlas]: 'sales@atlas.example',
  [DEALER.kestrel]: 'priya@kestrel.example',
  [DEALER.marlowe]: 'desk@marlowe.example',
  [DEALER.vantora]: 'sales@vantora.example',
  [DEALER.helvetia]: 'desk@helvetia.example',
};
