// lib/format.js — formatting helpers and award math used across views.

export const fmtMoney = (n, ccy = 'USD') => {
  const sym = ccy === 'EUR' ? '€' : ccy === 'GBP' ? '£' : '$';
  if (Math.abs(n) >= 1e9) return `${sym}${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${sym}${(n / 1e6).toFixed(0)}M`;
  if (Math.abs(n) >= 1e3) return `${sym}${(n / 1e3).toFixed(0)}K`;
  return `${sym}${n.toLocaleString()}`;
};

export const fmtMoneyFull = (n, ccy = 'USD') => {
  const sym = ccy === 'EUR' ? '€' : ccy === 'GBP' ? '£' : '$';
  return `${sym}${Math.round(n).toLocaleString('en-US')}`;
};

export const fmtPrice = (p, unit) => (unit === 'vol strike' ? `${p.toFixed(2)} vol` : `${p.toFixed(2)}%`);

export const notionalLabel = (rfq) => rfq.notionalLabel || fmtMoney(rfq.notional, rfq.ccy);

export const fmtCountdown = (ms) => {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// Best single-bank award: lowest price among full-size (100%) quotes.
export function bestSingle(quotes) {
  const fulls = quotes.filter((q) => q.pct === 100);
  if (!fulls.length) return null;
  return fulls.reduce((a, b) => (b.price < a.price ? b : a));
}

// Best blended award: greedily fill 100% of size from the cheapest quotes,
// each capped at the percentage that dealer is willing to take.
export function bestBlended(quotes) {
  const sorted = [...quotes].sort((a, b) => a.price - b.price);
  let remaining = 100;
  const fills = [];
  for (const q of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, q.pct);
    fills.push({ ...q, take });
    remaining -= take;
  }
  if (remaining > 0) return null; // cannot cover full size
  const blended = fills.reduce((s, f) => s + (f.take / 100) * f.price, 0);
  return { fills, blended };
}

export function savings(rfq, single, blendedObj) {
  if (!single || !blendedObj) return null;
  const bps = (single.price - blendedObj.blended) * 100;
  const usd = ((single.price - blendedObj.blended) / 100) * rfq.notional;
  return { bps, usd };
}

export const STATUS_CLASS = {
  Draft: 'pill-draft',
  Live: 'pill-live',
  'Under Review': 'pill-review',
  'Awaiting Approval': 'pill-approval',
  Awarded: 'pill-awarded',
  'In STP': 'pill-stp',
  Affirmed: 'pill-affirmed',
  Rejected: 'pill-exception',
  'Pending Affirmation': 'pill-approval',
  'Sent — Awaiting Match': 'pill-stp',
  Captured: 'pill-stp',
};
