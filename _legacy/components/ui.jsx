// components/ui.jsx — shared presentational components.
import React, { useContext } from 'react';
import { AppCtx } from '../ctx.js';
import { BANKS } from '../data/seed.js';
import { STATUS_CLASS, fmtCountdown, fmtPrice } from '../lib/format.js';

export const bank = (id) => BANKS.find((b) => b.id === id);

const P = {
  clock: 'M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6',
  check: 'M20 6 9 17l-5-5',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  x: 'M18 6 6 18M6 6l12 12',
  export: 'M12 15V3m0 0L7 8m5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2m0 18v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M1 12h2m18 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z',
  bolt: 'M13 2 3 14h7l-1 8 10-12h-7l1-8z',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  plus: 'M12 5v14M5 12h14',
  shield: 'M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8-3a8 8 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a8 8 0 0 0-2-1.2L15 3h-4l-.4 2.6a8 8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A8 8 0 0 0 6 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 2 1.2L11 21h4l.4-2.6a8 8 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  flow: 'M5 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 0v8m0 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm14-5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 0v5a4 4 0 0 1-4 4H9',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
};

export function Icon({ name, size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      <path d={P[name] || P.doc} />
    </svg>
  );
}

export const Pill = ({ status }) => <span className={`pill ${STATUS_CLASS[status] || 'pill-draft'}`}>{status}</span>;

export function Kpi({ label, value, note, tone }) {
  return (
    <div className="card kpi">
      <span className="k-label">{label}</span>
      <span className={`k-value ${tone || ''}`}>{value}</span>
      {note && <span className="k-note">{note}</span>}
    </div>
  );
}

export function Countdown({ deadline, total = 30 * 60 * 1000 }) {
  const { nowMs } = useContext(AppCtx);
  const left = Math.max(0, (deadline || 0) - nowMs);
  const frac = Math.min(1, Math.max(0, left / total));
  const r = 16, c = 2 * Math.PI * r;
  const hot = left > 0 && left < 2 * 60 * 1000;
  return (
    <div className={`countdown ${hot ? 'hot' : ''}`}>
      <svg className="cd-ring" width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="4" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={hot ? 'var(--red)' : 'var(--accent)'}
          strokeWidth="4" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <div>
        <div className="cd-time">{left > 0 ? fmtCountdown(left) : 'CLOSED'}</div>
        <div className="cd-label">{left > 0 ? 'until auction close' : 'auction window'}</div>
      </div>
    </div>
  );
}

export function Timeline({ items }) {
  return (
    <ul className="tline">
      {[...items].reverse().map((e, i) => (
        <li key={i}>
          <div className="tl-t">{e.t}</div>
          <span className="tl-w">{e.who}</span> <span className="tl-x">— {e.what}</span>
        </li>
      ))}
    </ul>
  );
}

export function Attachments({ rfq }) {
  const { openModal } = useContext(AppCtx);
  if (!rfq.attachments.length) return <div className="empty">No attachments</div>;
  return (
    <div className="grid" style={{ gap: 8 }}>
      {rfq.attachments.map((a) => (
        <button key={a.name} className="attach" style={{ font: 'inherit', color: 'inherit', background: 'none', textAlign: 'left' }}
          onClick={() => openModal(a.name, <TermSheetPreview rfq={rfq} file={a} />)}>
          <Icon name="doc" />
          <div>
            <div className="a-name">{a.name}</div>
            <div className="a-meta">{a.kind} · {a.size}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

export function TermSheetPreview({ rfq, file }) {
  return (
    <div>
      <p className="note" style={{ marginTop: 0 }}>Mock document preview — {file.kind}</p>
      <pre className="payload">{`${'VELOCE'}  ·  INDICATIVE TERM SHEET (DEMO)
──────────────────────────────────────────────
Reference            ${rfq.id}
Product              ${rfq.product}
Underlying           ${rfq.underlying}
Reference level      ${rfq.refLevel}
Strike               ${rfq.strike}
Expiry               ${rfq.expiry}
Style / Settlement   ${rfq.style}
Notional             ${rfq.notionalLabel || rfq.ccy + ' ' + rfq.notional.toLocaleString()}
Quote convention     ${rfq.quoteUnit}
Counterparty panel   ${rfq.invited.length} dealers (blind)
Documentation        ISDA 2002 MA + CSA (as amended)
Calculation agent    Dealer, subject to dispute rights
──────────────────────────────────────────────
This document is generated demo content for the
Veloce proof-of-concept and is not an offer or
solicitation of any transaction.`}</pre>
    </div>
  );
}

// The signature element: stacked allocation bar with blended outcome.
export function BlendBar({ fills, unit }) {
  return (
    <div className="blend">
      <div className="blend-bar">
        {fills.map((f) => {
          const b = bank(f.bankId);
          return (
            <div key={f.bankId} className="blend-seg" style={{ width: `${f.take}%`, background: b.color }}
              title={`${b.name} — ${f.take}% @ ${fmtPrice(f.price, unit)}`}>
              {f.take >= 14 ? `${b.short} ${f.take}%` : ''}
            </div>
          );
        })}
      </div>
      <div className="blend-legend">
        {fills.map((f) => {
          const b = bank(f.bankId);
          return (
            <span key={f.bankId}>
              <i style={{ background: b.color }} />
              {b.name} · {f.take}% @ <span className="mono">{fmtPrice(f.price, unit)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function ConcentrationBars({ data, cap = 35, highlight }) {
  return (
    <div>
      {data.map((d) => {
        const b = bank(d.bankId);
        const over = d.share > cap;
        return (
          <div className="cbar" key={d.bankId}>
            <span style={{ fontSize: 12.5, fontWeight: highlight === d.bankId ? 700 : 500 }}>{b.name}</span>
            <div className="c-track">
              <i className="c-fill" style={{ width: `${Math.min(100, d.share / 0.6)}%`, background: over ? 'var(--red)' : b.color, display: 'block' }} />
              <i className="c-cap" style={{ left: `${cap / 0.6}%` }} />
            </div>
            <span className={`mono ${over ? 't-red t-strong' : 't-muted'}`} style={{ fontSize: 12 }}>{d.share}%</span>
          </div>
        );
      })}
      <div className="note" style={{ marginTop: 6 }}>Trailing-90-day awarded notional share · red marker = {cap}% policy cap</div>
    </div>
  );
}

export function Modal() {
  const { modal, closeModal } = useContext(AppCtx);
  if (!modal) return null;
  return (
    <div className="overlay" onClick={closeModal} role="dialog" aria-modal="true" aria-label={modal.title}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{modal.title}</h3>
          <button className="btn btn-ghost btn-sm modal-x" onClick={closeModal} aria-label="Close"><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">{modal.body}</div>
      </div>
    </div>
  );
}

export function Toasts() {
  const { toasts } = useContext(AppCtx);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone || ''}`}>
          <b>{t.title}</b>
          {t.body}
        </div>
      ))}
    </div>
  );
}

// FpML-style mock payload for STP previews / exports.
export function stpPayload(rfq, allocations, trades) {
  return JSON.stringify(
    {
      messageType: 'TradeCaptureReport',
      format: 'FpML 5.12 (representative)',
      platform: 'Veloce RFQ Workflow',
      generated: new Date().toISOString(),
      rfq: { id: rfq.id, product: rfq.product, underlying: rfq.underlying, expiry: rfq.expiry, strike: rfq.strike, notional: rfq.notional, currency: rfq.ccy },
      counterpartyLegs: allocations.map((a, i) => ({
        legId: `${rfq.id}-L${i + 1}`,
        dealer: bank(a.bankId).name,
        dealerLei: '5493' + bank(a.bankId).short + '0000000000XX',
        allocationPct: a.pct,
        allocatedNotional: Math.round(rfq.notional * (a.pct / 100)),
        price: a.price,
        priceUnit: rfq.quoteUnit,
        uti: (trades && trades[i] && trades[i].uti) || `UTI-${rfq.id}-${bank(a.bankId).short}-0${i + 1}`,
      })),
      affirmation: { channel: 'MarkitWire (simulated)', method: 'electronic', sla: 'T+0 affirmation target' },
      audit: { bestExecutionRecord: true, quoteLadderArchived: true, approvals: 'attached' },
    },
    null,
    2
  );
}
