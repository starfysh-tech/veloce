// components/ui.tsx — shared presentational primitives, ported from the POC
// to TSX. Pure display; no data access.
import React from 'react';

const PATHS: Record<string, string> = {
  clock: 'M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6',
  check: 'M20 6 9 17l-5-5',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  x: 'M18 6 6 18M6 6l12 12',
  bolt: 'M13 2 3 14h7l-1 8 10-12h-7l1-8z',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  plus: 'M12 5v14M5 12h14',
  shield: 'M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8-3a8 8 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a8 8 0 0 0-2-1.2L15 3h-4l-.4 2.6a8 8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A8 8 0 0 0 6 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 2 1.2L11 21h4l.4-2.6a8 8 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  flow: 'M5 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 0v8m0 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm14-5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 0v5a4 4 0 0 1-4 4H9',
};

export function Icon({ name, size = 16, style }: { name: string; size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      <path d={PATHS[name] || PATHS.doc} />
    </svg>
  );
}

// Status → display label + pill class. Covers all three lifecycle enums
// (rfq_status, trade_status, handoff_status). The enums share three keys —
// `sent`, `matched`, `affirmed` — which all want the same display, so a
// single map is sufficient. `captured` is trade-only; the rest are rfq-only.
const STATUS_DISPLAY: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'pill-draft' },
  live: { label: 'Live', cls: 'pill-live' },
  under_review: { label: 'Under Review', cls: 'pill-review' },
  awaiting_approval: { label: 'Awaiting Approval', cls: 'pill-approval' },
  awarded: { label: 'Awarded', cls: 'pill-awarded' },
  in_stp: { label: 'In STP', cls: 'pill-stp' },
  affirmed: { label: 'Affirmed', cls: 'pill-affirmed' },
  cancelled: { label: 'Cancelled', cls: 'pill-exception' },
  captured: { label: 'Captured', cls: 'pill-draft' },
  sent: { label: 'Sent', cls: 'pill-stp' },
  matched: { label: 'Matched', cls: 'pill-review' },
};

export function Pill({ status }: { status: string }) {
  const s = STATUS_DISPLAY[status] ?? { label: status, cls: 'pill-draft' };
  return <span className={`pill ${s.cls}`}>{s.label}</span>;
}

export function statusLabel(status: string): string {
  return STATUS_DISPLAY[status]?.label ?? status;
}

// Money: minor units (integer) → display string.
export function fmtMoney(minor: number, ccy = 'USD'): string {
  const sym = ccy === 'EUR' ? '€' : ccy === 'GBP' ? '£' : '$';
  const n = minor / 100;
  if (Math.abs(n) >= 1e9) return `${sym}${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${sym}${(n / 1e6).toFixed(0)}M`;
  if (Math.abs(n) >= 1e3) return `${sym}${(n / 1e3).toFixed(0)}K`;
  return `${sym}${n.toLocaleString()}`;
}

export function fmtMoneyFull(minor: number, ccy = 'USD'): string {
  const sym = ccy === 'EUR' ? '€' : ccy === 'GBP' ? '£' : '$';
  return `${sym}${Math.round(minor / 100).toLocaleString('en-US')}`;
}

export function fmtPrice(price: string | number, unit?: string): string {
  const p = typeof price === 'string' ? parseFloat(price) : price;
  return unit === 'vol strike' ? `${p.toFixed(2)} vol` : `${p.toFixed(2)}%`;
}

export function notionalLabel(rfq: { notionalLabel?: string | null; notionalMinor: number; ccy: string }): string {
  return rfq.notionalLabel || fmtMoney(rfq.notionalMinor, rfq.ccy);
}
