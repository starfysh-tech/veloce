// views/Compliance.jsx — best-execution evidence, exceptions & overrides,
// concentration, and a flattened cross-RFQ event log.
import React, { useContext, useState } from 'react';
import { AppCtx } from '../ctx.js';
import { CONCENTRATION } from '../data/seed.js';
import { Pill, ConcentrationBars, Icon, bank } from '../components/ui.jsx';
import { fmtPrice, notionalLabel } from '../lib/format.js';

export default function Compliance() {
  const { db, nav, openModal } = useContext(AppCtx);
  const [tab, setTab] = useState('bestex');

  const reviewable = db.rfqs.filter((r) => ['Awarded', 'In STP', 'Affirmed', 'Awaiting Approval'].includes(r.status));

  const exportRecord = (rfq) => {
    const quotes = db.quotes.filter((q) => q.rfqId === rfq.id);
    openModal(`Best-execution record — ${rfq.id}`, (
      <pre className="payload">{JSON.stringify({
        type: 'BestExecutionReviewRecord',
        rfq: rfq.id, product: rfq.product, notional: rfq.notional, currency: rfq.ccy,
        panel: rfq.invited.map((id) => bank(id).name),
        blind: rfq.blind,
        quoteLadder: quotes.map((q) => ({ dealer: bank(q.bankId).name, maxPct: q.pct, level: q.price, ts: q.ts })),
        decision: rfq.award || rfq.proposal || null,
        exceptions: db.exceptions.filter((e) => e.rfqId === rfq.id),
        eventLog: rfq.timeline,
        attestation: 'Ladder archived at award time; record immutable.',
      }, null, 2)}</pre>
    ));
  };

  const allEvents = db.rfqs
    .flatMap((r) => r.timeline.map((e) => ({ ...e, rfqId: r.id })))
    .reverse();

  return (
    <>
      <div className="tabs" role="tablist">
        {[['bestex', 'Best-Execution Evidence'], ['exceptions', 'Exceptions & Overrides'], ['conc', 'Concentration'], ['log', 'Event Log']].map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} role="tab" aria-selected={tab === id}>{label}</button>
        ))}
      </div>

      {tab === 'bestex' && (
        <div className="card">
          <h3>Best-execution evidence</h3>
          <p className="sub">Every award carries its archived quote ladder, decision rationale and event log — exportable per RFQ</p>
          <table className="tbl">
            <thead><tr><th>RFQ</th><th className="num">Size</th><th>Responses</th><th>Decision</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {reviewable.map((r) => {
                const qs = db.quotes.filter((q) => q.rfqId === r.id);
                const d = r.award || r.proposal;
                return (
                  <tr key={r.id} className="rowlink" onClick={() => nav('rfq', { id: r.id })}>
                    <td><span className="mono t-strong">{r.id}</span><div className="t-faint">{r.title}</div></td>
                    <td className="num">{notionalLabel(r)}</td>
                    <td className="t-muted">{qs.length || '—'} {qs.length === 1 ? 'quote' : 'quotes'} archived</td>
                    <td>{d
                      ? <span className="mono">{d.kind === 'blended' ? 'Blended' : 'Single'} @ {fmtPrice(d.blendedPrice ?? d.allocations[0].price, r.quoteUnit)}</span>
                      : <span className="t-faint">Pending</span>}</td>
                    <td><Pill status={r.status} /></td>
                    <td><button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); exportRecord(r); }}>
                      <Icon name="export" size={12} style={{ verticalAlign: '-2px' }} /> Export
                    </button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flag flag-ok" style={{ marginTop: 12 }}>
            <Icon name="shield" size={15} />
            <span>Coverage: 100% of awards have a complete, immutable evidence pack — no reconstruction from email threads.</span>
          </div>
        </div>
      )}

      {tab === 'exceptions' && (
        <div className="card">
          <h3>Exceptions & overrides</h3>
          <p className="sub">Policy deviations, best-ex deviations and rule-based overrides</p>
          <div className="grid" style={{ gap: 10 }}>
            {db.exceptions.map((e) => (
              <div key={e.id} className="card card-tight" style={{ background: 'var(--surface-2)' }}>
                <div className="row">
                  <span className="mono t-strong">{e.id}</span>
                  <button className="btn btn-sm btn-ghost mono" onClick={() => nav('rfq', { id: e.rfqId })}>{e.rfqId} →</button>
                  <span className="spacer" />
                  <span className={`badge ${e.status.startsWith('Open') ? 'badge-warn' : ''}`}>{e.status}</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 12.5 }}>{e.text}</div>
                <div className="note" style={{ marginTop: 4 }}>Opened {e.opened}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'conc' && (
        <div className="card">
          <h3>Dealer concentration</h3>
          <p className="sub">Trailing-90-day awarded notional share — the 35% policy cap is enforced at award time, not discovered in quarterly review</p>
          <ConcentrationBars data={CONCENTRATION} />
          <div className="flag flag-warn" style={{ marginTop: 12 }}>
            <Icon name="alert" size={15} />
            <span>Pending award VEL-2026-0141 would lift Atlas Markets to 38%. The approval workflow requires explicit acknowledgment (EXC-77).</span>
          </div>
        </div>
      )}

      {tab === 'log' && (
        <div className="card">
          <h3>Cross-RFQ event log</h3>
          <p className="sub">Flattened, append-only view across all requests — {allEvents.length} events</p>
          <table className="tbl">
            <thead><tr><th>Time</th><th>RFQ</th><th>Actor</th><th>Event</th></tr></thead>
            <tbody>
              {allEvents.slice(0, 40).map((e, i) => (
                <tr key={i} className="rowlink" onClick={() => nav('rfq', { id: e.rfqId })}>
                  <td className="mono t-faint" style={{ whiteSpace: 'nowrap' }}>{e.t}</td>
                  <td className="mono t-muted">{e.rfqId}</td>
                  <td className="t-strong" style={{ whiteSpace: 'nowrap' }}>{e.who}</td>
                  <td className="t-muted">{e.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
