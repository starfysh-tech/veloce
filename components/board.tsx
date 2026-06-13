// components/board.tsx — the signature visual elements: the stacked allocation
// blend bar and a quote board row. Pure display; data is pre-masked upstream.
import React from 'react';
import { fmtPrice } from './ui';

export type Dealer = { id: string; name: string; shortCode: string | null; colorHex: string | null };
export type Fill = { dealerFirmId: string; price: string; take: number };

export function BlendBar({ fills, unit, dealers }: { fills: Fill[]; unit?: string; dealers: Record<string, Dealer> }) {
  return (
    <div className="blend">
      <div className="blend-bar">
        {fills.map((f) => {
          const d = dealers[f.dealerFirmId];
          return (
            <div key={f.dealerFirmId} className="blend-seg"
              style={{ width: `${f.take}%`, background: d?.colorHex ?? 'var(--accent)' }}
              title={`${d?.name} — ${f.take}% @ ${fmtPrice(f.price, unit)}`}>
              {f.take >= 14 ? `${d?.shortCode} ${f.take}%` : ''}
            </div>
          );
        })}
      </div>
      <div className="blend-legend">
        {fills.map((f) => {
          const d = dealers[f.dealerFirmId];
          return (
            <span key={f.dealerFirmId}>
              <i style={{ background: d?.colorHex ?? 'var(--accent)' }} />
              {d?.name} · {f.take}% @ <span className="mono">{fmtPrice(f.price, unit)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function BankDot({ color }: { color: string | null }) {
  return <span className="bank-dot" style={{ background: color ?? 'var(--faint)' }} />;
}
