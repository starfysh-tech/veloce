// ---------------------------------------------------------------------------
// seed.js — ALL demo data for the Veloce POC lives in this file.
// Firms, users, banks, RFQs, quotes, trades, STP handoffs, compliance
// exceptions and admin configuration. No backend; this object is cloned into
// React state at startup so the demo can be mutated and reset freely.
// ---------------------------------------------------------------------------

const MIN = 60 * 1000;
export const now = () => Date.now();

export const BANKS = [
  { id: 'atlas',    name: 'Atlas Markets',           short: 'ATL', color: '#5B8DEF' },
  { id: 'kestrel',  name: 'Kestrel Securities',      short: 'KST', color: '#2EB67D' },
  { id: 'marlowe',  name: 'Marlowe & Co.',           short: 'MRL', color: '#E2A33B' },
  { id: 'vantora',  name: 'Vantora Capital Markets', short: 'VNT', color: '#9A7BFF' },
  { id: 'helvetia', name: 'Helvetia Global Bank',    short: 'HGB', color: '#E25C6A' },
];

export const FIRMS = [
  { id: 'meridian', name: 'Meridian Mutual Insurance', type: 'Insurance Company', city: 'Hartford, CT', lei: '5493001MERIDIAN77US' },
  { id: 'halcyon',  name: 'Halcyon Capital Partners',  type: 'Fund',              city: 'New York, NY',  lei: '5493004HALCYON21US' },
  ...BANKS.map(b => ({ id: b.id, name: b.name, type: 'Dealer Bank', city: 'Global', lei: '5493' + b.short + '0000000000XX' })),
];

export const ROLES = [
  { id: 'trader',     label: 'Insurance / Fund Trader',    user: 'Dana Whitfield',   firm: 'Meridian Mutual Insurance', desk: 'Derivatives Desk' },
  { id: 'approver',   label: 'Treasury / Investment Approver', user: 'Marcus Oyelaran', firm: 'Meridian Mutual Insurance', desk: 'Treasury Committee' },
  { id: 'bank',       label: 'Bank Sales-Trader',          user: 'Priya Raghavan',   firm: 'Kestrel Securities',        desk: 'EQD Sales & Trading' },
  { id: 'ops',        label: 'Operations / Middle Office', user: 'Tomás Ferreira',   firm: 'Meridian Mutual Insurance', desk: 'Middle Office' },
  { id: 'compliance', label: 'Compliance / Risk Reviewer', user: 'Ingrid Sørensen',  firm: 'Meridian Mutual Insurance', desk: 'Risk & Compliance' },
  { id: 'admin',      label: 'Platform Admin',             user: 'Alex Kim',         firm: 'Veloce Financial Technologies', desk: 'Platform Operations' },
];

export const BANK_PERSONA = 'kestrel'; // the bank the Sales-Trader role represents

const D = (m, d, h, mi) => `${d} Jun 2026 · ${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;

// --------------------------------------------------------------------------
// RFQs — 8 records covering the full lifecycle.
// quoteUnit: how dealer responses are expressed for this product.
// --------------------------------------------------------------------------
export const RFQS = [
  {
    id: 'VEL-2026-0142',
    title: 'S&P 500 — 12M 90% Put Hedge',
    product: 'Equity Put Option',
    template: 'Index Put Hedge',
    requesterFirm: 'meridian',
    requester: 'Dana Whitfield',
    status: 'Live',
    hero: true,
    side: 'Buy protection',
    underlying: 'SPX Index',
    refLevel: '6,520.00',
    strike: '90% (5,868.00)',
    expiry: '11 Jun 2027',
    style: 'European · Cash settled',
    notional: 250_000_000,
    ccy: 'USD',
    tenor: '12M',
    quoteUnit: '% of notional',
    mode: 'Split allocation permitted',
    blind: true,
    invited: ['atlas', 'kestrel', 'marlowe', 'vantora', 'helvetia'],
    deadline: now() + 18 * MIN, // dynamic — drives the live countdown
    createdAt: D(6, 12, 13, 41),
    attachments: [
      { name: 'TermSheet_SPX_90Put_12M_v3.pdf', size: '214 KB', kind: 'Term sheet' },
      { name: 'HedgeCommittee_Memo_Q2.docx', size: '88 KB', kind: 'Internal memo' },
    ],
    timeline: [
      { t: D(6, 12, 13, 41), who: 'Dana Whitfield', what: 'RFQ created from template “Index Put Hedge”' },
      { t: D(6, 12, 13, 44), who: 'Dana Whitfield', what: 'Bank panel selected — 5 dealers (Core US Vol Panel + HGB)' },
      { t: D(6, 12, 13, 45), who: 'System', what: 'Pre-trade policy check passed · notional > $100M ⇒ approver sign-off required at award' },
      { t: D(6, 12, 13, 46), who: 'Dana Whitfield', what: 'RFQ launched · blind auction · 30-minute window' },
      { t: D(6, 12, 13, 46), who: 'System', what: 'Invitations dispatched to 5 dealers' },
    ],
  },
  {
    id: 'VEL-2026-0141',
    title: 'Russell 2000 — 6M Collar 95 / 107',
    product: 'Equity Collar',
    template: 'Zero-Cost Collar',
    requesterFirm: 'meridian',
    requester: 'Dana Whitfield',
    status: 'Awaiting Approval',
    side: 'Buy put / sell call',
    underlying: 'RTY Index',
    refLevel: '2,310.00',
    strike: 'P 95% / C 107%',
    expiry: '11 Dec 2026',
    style: 'European · Cash settled',
    notional: 120_000_000,
    ccy: 'USD',
    tenor: '6M',
    quoteUnit: '% net premium',
    mode: 'Split allocation permitted',
    blind: true,
    invited: ['atlas', 'kestrel', 'marlowe'],
    deadline: now() - 95 * MIN,
    createdAt: D(6, 12, 10, 5),
    attachments: [{ name: 'TermSheet_RTY_Collar_6M.pdf', size: '187 KB', kind: 'Term sheet' }],
    proposal: {
      kind: 'blended',
      allocations: [
        { bankId: 'atlas', pct: 50, price: 0.45 },
        { bankId: 'kestrel', pct: 50, price: 0.52 },
      ],
      blendedPrice: 0.485,
      bestSinglePrice: 0.52,
      bestSingleBank: 'kestrel',
      savingsUsd: 42_000,
      savingsBps: 3.5,
      rationale:
        'Atlas quoted the tightest net premium but capped participation at 50% of size. Splitting the residual 50% to Kestrel at its full-size level yields a blended 0.485% vs 0.52% best single-bank award — saving 3.5 bps ($42,000) with two investment-grade counterparties.',
      flags: [
        { sev: 'warn', text: 'Concentration: Atlas trailing-90-day awarded share would reach 38% (policy cap 35%). Approver acknowledgment required.' },
      ],
    },
    timeline: [
      { t: D(6, 12, 10, 5), who: 'Dana Whitfield', what: 'RFQ created and launched · 45-minute window' },
      { t: D(6, 12, 10, 31), who: 'Atlas Markets', what: 'Quote received — 50% @ 0.45%' },
      { t: D(6, 12, 10, 38), who: 'Kestrel Securities', what: 'Quote received — 100% @ 0.52%' },
      { t: D(6, 12, 10, 47), who: 'Marlowe & Co.', what: 'Quote received — 100% @ 0.58%' },
      { t: D(6, 12, 10, 50), who: 'System', what: 'Auction window closed · 3 of 3 dealers responded' },
      { t: D(6, 12, 11, 12), who: 'Dana Whitfield', what: 'Recommended blended award (ATL 50% / KST 50%) · routed to Treasury Committee' },
      { t: D(6, 12, 11, 12), who: 'System', what: 'Policy flag raised: dealer concentration > 35% cap (Atlas)' },
    ],
  },
  {
    id: 'VEL-2026-0139',
    title: 'EURO STOXX 50 — 9M Variance Swap',
    product: 'Variance Swap',
    template: 'Index Variance Swap',
    requesterFirm: 'halcyon',
    requester: 'J. Castellanos',
    status: 'Awarded',
    side: 'Buy variance',
    underlying: 'SX5E Index',
    refLevel: '5,140.00',
    strike: 'Quoted (vol strike)',
    expiry: '11 Mar 2027',
    style: 'Variance · Cash settled',
    notional: 450_000,
    notionalLabel: '€450,000 vega',
    ccy: 'EUR',
    tenor: '9M',
    quoteUnit: 'vol strike',
    lowerIsBetter: true,
    mode: 'Full size only',
    blind: true,
    invited: ['marlowe', 'atlas', 'helvetia'],
    deadline: now() - 26 * 60 * MIN,
    createdAt: D(6, 11, 9, 12),
    attachments: [{ name: 'TermSheet_SX5E_VarSwap.pdf', size: '163 KB', kind: 'Term sheet' }],
    award: {
      kind: 'single',
      allocations: [{ bankId: 'marlowe', pct: 100, price: 21.4 }],
      note: 'Awarded at 21.40 vol vs cover 21.65 (Atlas). Capture queued to STP.',
    },
    timeline: [
      { t: D(6, 11, 9, 12), who: 'J. Castellanos', what: 'RFQ launched · 3 dealers · 30-minute window' },
      { t: D(6, 11, 9, 26), who: 'Marlowe & Co.', what: 'Quote received — 100% @ 21.40 vol' },
      { t: D(6, 11, 9, 31), who: 'Atlas Markets', what: 'Quote received — 100% @ 21.65 vol' },
      { t: D(6, 11, 9, 39), who: 'Helvetia Global Bank', what: 'Quote received — 100% @ 21.90 vol' },
      { t: D(6, 11, 9, 42), who: 'System', what: 'Auction window closed' },
      { t: D(6, 11, 10, 4), who: 'R. Ames (Approver)', what: 'Award approved — Marlowe & Co. 100% @ 21.40' },
      { t: D(6, 11, 10, 5), who: 'System', what: 'Trade capture queued for STP handoff' },
    ],
  },
  {
    id: 'VEL-2026-0138',
    title: 'NASDAQ-100 — 12M Put Spread 95 / 80',
    product: 'Equity Put Spread',
    template: 'Index Put Spread',
    requesterFirm: 'meridian',
    requester: 'Dana Whitfield',
    status: 'In STP',
    side: 'Buy protection',
    underlying: 'NDX Index',
    refLevel: '23,180.00',
    strike: 'P 95% / P 80%',
    expiry: '11 Jun 2027',
    style: 'European · Cash settled',
    notional: 150_000_000,
    ccy: 'USD',
    tenor: '12M',
    quoteUnit: '% of notional',
    mode: 'Full size only',
    blind: true,
    invited: ['kestrel', 'atlas', 'vantora', 'helvetia'],
    deadline: now() - 50 * 60 * MIN,
    createdAt: D(6, 10, 11, 2),
    attachments: [{ name: 'TermSheet_NDX_PutSpread.pdf', size: '171 KB', kind: 'Term sheet' }],
    award: {
      kind: 'single',
      allocations: [{ bankId: 'kestrel', pct: 100, price: 1.92 }],
      note: 'Best of 4 responses (cover 1.97). Capture sent via simulated MarkitWire.',
    },
    timeline: [
      { t: D(6, 10, 11, 2), who: 'Dana Whitfield', what: 'RFQ launched · 4 dealers' },
      { t: D(6, 10, 11, 41), who: 'System', what: 'Auction closed · 4 responses' },
      { t: D(6, 10, 12, 18), who: 'Marcus Oyelaran', what: 'Award approved — Kestrel 100% @ 1.92%' },
      { t: D(6, 10, 12, 20), who: 'System', what: 'FpML capture payload generated and sent (STP-2241)' },
      { t: D(6, 10, 13, 2), who: 'Middle Office', what: 'SSI mismatch exception raised, then resolved' },
    ],
  },
  {
    id: 'VEL-2026-0136',
    title: 'Custom Basket — Equity Hedge Overlay Put',
    product: 'Equity-Linked Overlay',
    template: 'Overlay Basket Put',
    requesterFirm: 'meridian',
    requester: 'Dana Whitfield',
    status: 'Affirmed',
    side: 'Buy protection',
    underlying: 'MERI-EQ-BSKT-04 (32 names)',
    refLevel: '100.00 (basket)',
    strike: '92.5%',
    expiry: '10 Jun 2027',
    style: 'European · Cash settled',
    notional: 300_000_000,
    ccy: 'USD',
    tenor: '12M',
    quoteUnit: '% of notional',
    mode: 'Split allocation permitted',
    blind: true,
    invited: ['atlas', 'vantora', 'kestrel', 'marlowe'],
    deadline: now() - 3 * 24 * 60 * MIN,
    createdAt: D(6, 9, 9, 30),
    attachments: [
      { name: 'BasketComposition_MERI-EQ-BSKT-04.xlsx', size: '64 KB', kind: 'Basket file' },
      { name: 'TermSheet_Overlay_Put.pdf', size: '198 KB', kind: 'Term sheet' },
    ],
    award: {
      kind: 'blended',
      allocations: [
        { bankId: 'atlas', pct: 60, price: 1.32 },
        { bankId: 'vantora', pct: 40, price: 1.4 },
      ],
      blendedPrice: 1.352,
      note: 'Blended 1.352% vs 1.45% best full-size quote — saved 9.8 bps ($294,000). Both legs affirmed.',
    },
    timeline: [
      { t: D(6, 9, 9, 30), who: 'Dana Whitfield', what: 'RFQ launched with basket composition file' },
      { t: D(6, 9, 10, 15), who: 'System', what: 'Auction closed · 4 responses · 2 partial' },
      { t: D(6, 9, 11, 2), who: 'Marcus Oyelaran', what: 'Blended award approved (ATL 60 / VNT 40)' },
      { t: D(6, 9, 11, 6), who: 'System', what: 'Two capture payloads sent (STP-2238)' },
      { t: D(6, 9, 15, 41), who: 'System', what: 'Both legs matched and affirmed' },
    ],
  },
  {
    id: 'VEL-2026-0143',
    title: 'S&P 500 — 3M Collar 97 / 105',
    product: 'Equity Collar',
    template: 'Zero-Cost Collar',
    requesterFirm: 'meridian',
    requester: 'Dana Whitfield',
    status: 'Draft',
    side: 'Buy put / sell call',
    underlying: 'SPX Index',
    refLevel: '6,520.00',
    strike: 'P 97% / C 105%',
    expiry: '11 Sep 2026',
    style: 'European · Cash settled',
    notional: 200_000_000,
    ccy: 'USD',
    tenor: '3M',
    quoteUnit: '% net premium',
    mode: 'Split allocation permitted',
    blind: true,
    invited: ['atlas', 'kestrel', 'marlowe', 'vantora'],
    deadline: null,
    createdAt: D(6, 12, 9, 14),
    attachments: [],
    timeline: [{ t: D(6, 12, 9, 14), who: 'Dana Whitfield', what: 'Draft created — pending hedge committee sizing' }],
  },
  {
    id: 'VEL-2026-0140',
    title: 'FTSE 100 — 6M 92.5% Put Hedge',
    product: 'Equity Put Option',
    template: 'Index Put Hedge',
    requesterFirm: 'halcyon',
    requester: 'J. Castellanos',
    status: 'Under Review',
    side: 'Buy protection',
    underlying: 'UKX Index',
    refLevel: '8,920.00',
    strike: '92.5% (8,251.00)',
    expiry: '11 Dec 2026',
    style: 'European · Cash settled',
    notional: 90_000_000,
    ccy: 'GBP',
    tenor: '6M',
    quoteUnit: '% of notional',
    mode: 'Full size only',
    blind: true,
    invited: ['helvetia', 'marlowe', 'vantora'],
    deadline: now() - 3 * 60 * MIN,
    createdAt: D(6, 12, 8, 20),
    attachments: [{ name: 'TermSheet_UKX_Put_6M.pdf', size: '154 KB', kind: 'Term sheet' }],
    timeline: [
      { t: D(6, 12, 8, 20), who: 'J. Castellanos', what: 'RFQ launched · 3 dealers · 30-minute window' },
      { t: D(6, 12, 8, 44), who: 'Helvetia Global Bank', what: 'Quote received — 100% @ 2.15%' },
      { t: D(6, 12, 8, 49), who: 'System', what: 'Late-quote rule triggered · window auto-extended 5 minutes (override logged)' },
      { t: D(6, 12, 8, 52), who: 'Marlowe & Co.', what: 'Quote received — 100% @ 2.22%' },
      { t: D(6, 12, 8, 55), who: 'System', what: 'Auction closed · 2 of 3 dealers responded' },
      { t: D(6, 12, 9, 10), who: 'J. Castellanos', what: 'Reviewing — awaiting desk head sign-off on size' },
    ],
  },
  {
    id: 'VEL-2026-0135',
    title: 'EURO STOXX 50 — 12M 90% Put Hedge',
    product: 'Equity Put Option',
    template: 'Index Put Hedge',
    requesterFirm: 'halcyon',
    requester: 'J. Castellanos',
    status: 'Awarded',
    side: 'Buy protection',
    underlying: 'SX5E Index',
    refLevel: '5,140.00',
    strike: '90% (4,626.00)',
    expiry: '10 Jun 2027',
    style: 'European · Cash settled',
    notional: 140_000_000,
    ccy: 'EUR',
    tenor: '12M',
    quoteUnit: '% of notional',
    mode: 'Split allocation permitted',
    blind: true,
    invited: ['helvetia', 'vantora', 'atlas', 'marlowe'],
    deadline: now() - 4 * 24 * 60 * MIN,
    createdAt: D(6, 8, 10, 0),
    attachments: [{ name: 'TermSheet_SX5E_Put_12M.pdf', size: '160 KB', kind: 'Term sheet' }],
    award: {
      kind: 'single',
      allocations: [{ bankId: 'helvetia', pct: 100, price: 3.05 }],
      note: 'Awarded above lowest quoted price: Vantora quoted 3.01% but capped at 50% of size. Single-counterparty execution selected; rationale logged for best-execution review (EXC-74).',
    },
    timeline: [
      { t: D(6, 8, 10, 0), who: 'J. Castellanos', what: 'RFQ launched · 4 dealers' },
      { t: D(6, 8, 10, 40), who: 'System', what: 'Auction closed · 3 responses · 1 partial' },
      { t: D(6, 8, 11, 25), who: 'R. Ames (Approver)', what: 'Award approved with best-ex deviation note — Helvetia 100% @ 3.05%' },
      { t: D(6, 8, 11, 26), who: 'System', what: 'Exception EXC-74 opened for compliance review' },
    ],
  },
];

// --------------------------------------------------------------------------
// Quotes — 12 seeded dealer responses. The hero RFQ receives a 5th simulated
// quote (Helvetia) ~14 seconds into a live demo session.
// --------------------------------------------------------------------------
export const QUOTES = [
  // VEL-2026-0142 (hero — live auction)
  { id: 'Q-9011', rfqId: 'VEL-2026-0142', bankId: 'atlas',   pct: 100, price: 2.84, note: 'Axe to buy vol — can upsize to $300M on request.', ts: D(6, 12, 14, 2) },
  { id: 'Q-9012', rfqId: 'VEL-2026-0142', bankId: 'kestrel', pct: 100, price: 2.79, note: 'Firm for 30 minutes. Delta hedge at close available.', ts: D(6, 12, 14, 5), mine: true },
  { id: 'Q-9013', rfqId: 'VEL-2026-0142', bankId: 'marlowe', pct: 40,  price: 2.62, note: 'Balance-sheet capped at $100M — sharp on partial.', ts: D(6, 12, 14, 8) },
  { id: 'Q-9014', rfqId: 'VEL-2026-0142', bankId: 'vantora', pct: 60,  price: 2.68, note: 'Partial only; most competitive on first $150M.', ts: D(6, 12, 14, 11) },
  // VEL-2026-0141 (awaiting approval)
  { id: 'Q-9005', rfqId: 'VEL-2026-0141', bankId: 'atlas',   pct: 50,  price: 0.45, note: 'Tight on half size; full size would widen to 0.55%.', ts: D(6, 12, 10, 31) },
  { id: 'Q-9006', rfqId: 'VEL-2026-0141', bankId: 'kestrel', pct: 100, price: 0.52, note: 'Full size, firm.', ts: D(6, 12, 10, 38), mine: true },
  { id: 'Q-9007', rfqId: 'VEL-2026-0141', bankId: 'marlowe', pct: 100, price: 0.58, note: 'Full size available.', ts: D(6, 12, 10, 47) },
  // VEL-2026-0139 (variance swap, awarded)
  { id: 'Q-8991', rfqId: 'VEL-2026-0139', bankId: 'marlowe',  pct: 100, price: 21.4,  note: 'Standard SX5E var terms, 2.5x cap.', ts: D(6, 11, 9, 26) },
  { id: 'Q-8992', rfqId: 'VEL-2026-0139', bankId: 'atlas',    pct: 100, price: 21.65, note: '2.5x cap, T+2.', ts: D(6, 11, 9, 31) },
  { id: 'Q-8993', rfqId: 'VEL-2026-0139', bankId: 'helvetia', pct: 100, price: 21.9,  note: 'Subject to credit check refresh.', ts: D(6, 11, 9, 39) },
  // VEL-2026-0140 (under review)
  { id: 'Q-8998', rfqId: 'VEL-2026-0140', bankId: 'helvetia', pct: 100, price: 2.15, note: 'Firm to 09:00 London tomorrow.', ts: D(6, 12, 8, 44) },
  { id: 'Q-8999', rfqId: 'VEL-2026-0140', bankId: 'marlowe',  pct: 100, price: 2.22, note: 'Full size.', ts: D(6, 12, 8, 52) },
];

// The simulated late quote that "arrives" during a live demo session.
export const SIMULATED_QUOTE = {
  id: 'Q-9015', rfqId: 'VEL-2026-0142', bankId: 'helvetia', pct: 100, price: 2.92,
  note: 'Full size; can improve on confirmed interest.', ts: 'Just now', arrived: true,
};

// --------------------------------------------------------------------------
// Approved trades (4) and post-trade STP handoff records (3)
// --------------------------------------------------------------------------
export const TRADES = [
  { id: 'TRD-3104', rfqId: 'VEL-2026-0138', bankId: 'kestrel', pct: 100, allocNotional: 150_000_000, ccy: 'USD', price: 1.92, priceUnit: '% of notional', status: 'Pending Affirmation', tradeDate: '10 Jun 2026', settle: 'T+2 (12 Jun 2026)', uti: 'UTI-VEL-2026-0138-KST-01' },
  { id: 'TRD-3099', rfqId: 'VEL-2026-0136', bankId: 'atlas',   pct: 60,  allocNotional: 180_000_000, ccy: 'USD', price: 1.32, priceUnit: '% of notional', status: 'Affirmed', tradeDate: '09 Jun 2026', settle: 'T+2 (11 Jun 2026)', uti: 'UTI-VEL-2026-0136-ATL-01' },
  { id: 'TRD-3100', rfqId: 'VEL-2026-0136', bankId: 'vantora', pct: 40,  allocNotional: 120_000_000, ccy: 'USD', price: 1.4,  priceUnit: '% of notional', status: 'Affirmed', tradeDate: '09 Jun 2026', settle: 'T+2 (11 Jun 2026)', uti: 'UTI-VEL-2026-0136-VNT-01' },
  { id: 'TRD-3093', rfqId: 'VEL-2026-0135', bankId: 'helvetia', pct: 100, allocNotional: 140_000_000, ccy: 'EUR', price: 3.05, priceUnit: '% of notional', status: 'Affirmed', tradeDate: '08 Jun 2026', settle: 'T+2 (10 Jun 2026)', uti: 'UTI-VEL-2026-0135-HGB-01' },
];

export const HANDOFFS = [
  {
    id: 'STP-2241', rfqId: 'VEL-2026-0138', tradeIds: ['TRD-3104'],
    channel: 'MarkitWire (simulated)', payload: 'FpML 5.12 · OptionTrade',
    status: 'Sent — Awaiting Match', sent: D(6, 10, 12, 20),
    exceptions: [{ id: 'STPX-31', sev: 'warn', text: 'Counterparty SSI mismatch (USD wire vs book SSI). Resolved 13:42 by Middle Office.', open: false }],
  },
  {
    id: 'STP-2238', rfqId: 'VEL-2026-0136', tradeIds: ['TRD-3099', 'TRD-3100'],
    channel: 'MarkitWire (simulated)', payload: 'FpML 5.12 · OptionTrade ×2',
    status: 'Affirmed', sent: D(6, 9, 11, 6),
    exceptions: [],
  },
  {
    id: 'STP-2236', rfqId: 'VEL-2026-0135', tradeIds: ['TRD-3093'],
    channel: 'MarkitWire (simulated)', payload: 'FpML 5.12 · OptionTrade',
    status: 'Affirmed', sent: D(6, 8, 11, 30),
    exceptions: [],
  },
];

// --------------------------------------------------------------------------
// Compliance exceptions / overrides
// --------------------------------------------------------------------------
export const EXCEPTIONS = [
  { id: 'EXC-77', rfqId: 'VEL-2026-0141', sev: 'warn', opened: D(6, 12, 11, 12), status: 'Open — pending approver acknowledgment', text: 'Dealer concentration: proposed award lifts Atlas trailing-90-day share to 38% vs 35% policy cap.' },
  { id: 'EXC-74', rfqId: 'VEL-2026-0135', sev: 'warn', opened: D(6, 8, 11, 26), status: 'Closed — rationale accepted', text: 'Award above lowest quoted price (3.05% vs 3.01% partial). Justification: single-counterparty execution preferred at this size; partial coverage insufficient.' },
  { id: 'EXC-71', rfqId: 'VEL-2026-0140', sev: 'info', opened: D(6, 12, 8, 49), status: 'Closed — rule-based', text: 'Auction window auto-extended 5 minutes under late-quote rule. Override logged automatically.' },
];

// Trailing-90-day awarded notional share by dealer (drives concentration view)
export const CONCENTRATION = [
  { bankId: 'atlas',    share: 33 },
  { bankId: 'kestrel',  share: 24 },
  { bankId: 'helvetia', share: 18 },
  { bankId: 'vantora',  share: 14 },
  { bankId: 'marlowe',  share: 11 },
];

// --------------------------------------------------------------------------
// Admin configuration
// --------------------------------------------------------------------------
export const PANELS = [
  { id: 'core-us', name: 'Core US Vol Panel', banks: ['atlas', 'kestrel', 'marlowe', 'vantora'], default: true },
  { id: 'global',  name: 'Global Macro Panel', banks: ['atlas', 'kestrel', 'marlowe', 'vantora', 'helvetia'], default: false },
  { id: 'eu-rates', name: 'European Equity Panel', banks: ['helvetia', 'marlowe', 'vantora'], default: false },
];

export const TEMPLATES = [
  { id: 'put',     name: 'Index Put Hedge',     fields: 'Underlying · Strike % · Tenor · Style · Settlement', defaultWindow: '30 min' },
  { id: 'collar',  name: 'Zero-Cost Collar',    fields: 'Underlying · Put % / Call % · Tenor · Net premium target', defaultWindow: '45 min' },
  { id: 'var',     name: 'Index Variance Swap', fields: 'Underlying · Vega notional · Cap · Tenor', defaultWindow: '30 min' },
  { id: 'overlay', name: 'Overlay Basket Put',  fields: 'Basket file · Strike % · Tenor · Rebalancing terms', defaultWindow: '60 min' },
];

export const AUCTION_RULES = [
  { id: 'window',  label: 'Default auction window', value: '30 minutes', editable: true },
  { id: 'blind',   label: 'Blind auction (dealers cannot see competitor identities or levels)', value: 'On by default', editable: true },
  { id: 'minbanks', label: 'Minimum dealers per RFQ', value: '3', editable: true },
  { id: 'partial', label: 'Partial-percentage participation', value: 'Permitted (configurable per RFQ)', editable: true },
  { id: 'extend',  label: 'Late-quote auto-extension', value: '+5 min if a quote lands in the final 2 min', editable: true },
  { id: 'revise',  label: 'Quote revisions before deadline', value: 'Unlimited · full revision history retained', editable: false },
];

export const THRESHOLDS = [
  { id: 't1', label: 'Notional > $100M', rule: 'Treasury approver sign-off required before award' },
  { id: 't2', label: 'Notional > $250M', rule: 'Investment committee (2-person) approval required' },
  { id: 't3', label: 'Dealer trailing-90-day share > 35%', rule: 'Concentration flag — approver acknowledgment + compliance review' },
  { id: 't4', label: 'Award ≠ best quoted price', rule: 'Best-execution deviation note mandatory · exception auto-opened' },
];

export const USERS_TABLE = [
  { name: 'Dana Whitfield',  firm: 'Meridian Mutual Insurance', role: 'Trader', status: 'Active' },
  { name: 'Marcus Oyelaran', firm: 'Meridian Mutual Insurance', role: 'Approver', status: 'Active' },
  { name: 'Tomás Ferreira',  firm: 'Meridian Mutual Insurance', role: 'Operations', status: 'Active' },
  { name: 'Ingrid Sørensen', firm: 'Meridian Mutual Insurance', role: 'Compliance', status: 'Active' },
  { name: 'J. Castellanos',  firm: 'Halcyon Capital Partners',  role: 'Trader', status: 'Active' },
  { name: 'R. Ames',         firm: 'Halcyon Capital Partners',  role: 'Approver', status: 'Active' },
  { name: 'Priya Raghavan',  firm: 'Kestrel Securities',        role: 'Bank Sales-Trader', status: 'Active' },
  { name: 'M. Duval',        firm: 'Atlas Markets',             role: 'Bank Sales-Trader', status: 'Active' },
  { name: 'S. Okafor',       firm: 'Vantora Capital Markets',   role: 'Bank Sales-Trader', status: 'Active' },
  { name: 'Alex Kim',        firm: 'Veloce Financial Technologies', role: 'Platform Admin', status: 'Active' },
];

export const SYS_AUDIT = [
  { t: D(6, 12, 13, 46), actor: 'dana.whitfield@meridian', event: 'RFQ_LAUNCH', detail: 'VEL-2026-0142 · blind · 5 dealers · 30-min window' },
  { t: D(6, 12, 11, 12), actor: 'system',                  event: 'POLICY_FLAG', detail: 'VEL-2026-0141 · concentration cap exceeded (Atlas 38% > 35%)' },
  { t: D(6, 12, 10, 5),  actor: 'dana.whitfield@meridian', event: 'RFQ_LAUNCH', detail: 'VEL-2026-0141 · blind · 3 dealers · 45-min window' },
  { t: D(6, 12, 8, 49),  actor: 'system',                  event: 'RULE_OVERRIDE', detail: 'VEL-2026-0140 · auction auto-extended +5 min (late-quote rule)' },
  { t: D(6, 11, 10, 5),  actor: 'system',                  event: 'STP_DISPATCH', detail: 'VEL-2026-0139 · capture queued' },
  { t: D(6, 10, 12, 20), actor: 'system',                  event: 'STP_DISPATCH', detail: 'STP-2241 · FpML payload sent to MarkitWire (simulated)' },
  { t: D(6, 9, 15, 41),  actor: 'system',                  event: 'AFFIRMATION', detail: 'STP-2238 · both legs affirmed' },
  { t: D(6, 8, 11, 26),  actor: 'system',                  event: 'EXCEPTION_OPEN', detail: 'EXC-74 · best-ex deviation on VEL-2026-0135' },
];

export const STATUS_ORDER = ['Draft', 'Live', 'Under Review', 'Awaiting Approval', 'Awarded', 'In STP', 'Affirmed'];

export function makeInitialDb() {
  // Deep-clone so demo-mode mutations never corrupt the seed.
  return JSON.parse(JSON.stringify({
    rfqs: RFQS, quotes: QUOTES, trades: TRADES, handoffs: HANDOFFS,
    exceptions: EXCEPTIONS, sysAudit: SYS_AUDIT,
  }));
}
