// views/Approvals.jsx — Treasury Committee workspace. Summary memo per
// pending award, quote ladder evidence, concentration context, actions.
import React, { useContext, useState } from 'react';
import { AppCtx } from '../ctx.js';
import { CONCENTRATION } from '../data/seed.js';
import { Pill, BlendBar, ConcentrationBars, Icon, bank } from '../components/ui.jsx';
import { fmtPrice, fmtMoneyFull, notionalLabel } from '../lib/format.js';

export default function Approvals() {
  const { db, role, actions, nav } = useContext(AppCtx);
  const queue = db.rfqs.filter((r) => r.status === 'Awaiting Approval');
  const [sel, setSel] = useState(queue[0]?.id || null);
  const rfq = queue.find((r) => r.id === sel) || queue[0];

  if (!queue.length) {
    return (
      <div className="card">
        <div className="empty">
          The approval queue is clear.
          <div style={{ marginTop: 8 }}>
            <span className="note">Tip: use Demo mode → “Awaiting approval” to route the live RFQ here, or recommend an award from any RFQ’s Comparison tab as the Trader.</span>
          </div>
        </div>
      </div>
    );
  }

  const p = rfq.proposal;
  const quotes = db.quotes.filter((q) => q.rfqId === rfq.id);
  const highlight = p?.flags?.length ? p.allocations[0].bankId : null;

  return (
    <>
      {queue.length > 1 && (
        <div className="card card-tight">
          <div className="row">
            {queue.map((r) => (
              <button key={r.id} className={`btn btn-sm ${r.id === rfq.id ? 'btn-primary' : ''}`} onClick={() => setSel(r.id)}>
                {r.id}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="detail-head">
          <div style={{ flex: 1 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="mono t-faint">{rfq.id}</span>
              <Pill status={rfq.status} />
            </div>
            <h2>{rfq.title}</h2>
            <div className="meta">{notionalLabel(rfq)} · {rfq.product} · Recommended by {rfq.requester} · {rfq.invited.length}-dealer blind auction</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => nav('rfq', { id: rfq.id })}>Open full RFQ →</button>
        </div>
      </div>

      <div className="grid g2">
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card">
            <h3>Decision memo</h3>
            <p className="sub">Proposed {p.kind} award</p>
            <BlendBar fills={p.allocations.map((x) => ({ bankId: x.bankId, take: x.pct, price: x.price }))} unit={rfq.quoteUnit} />
            <hr className="hr" />
            <div className="spec">
              <div><div className="s-label">Proposed level</div><div className="s-val mono t-green">{fmtPrice(p.blendedPrice, rfq.quoteUnit)}</div></div>
              <div><div className="s-label">Best single bank</div><div className="s-val mono">{fmtPrice(p.bestSinglePrice, rfq.quoteUnit)} ({bank(p.bestSingleBank).short})</div></div>
              <div><div className="s-label">Improvement</div><div className="s-val t-green">{p.savingsBps} bps · {fmtMoneyFull(p.savingsUsd, rfq.ccy)}</div></div>
            </div>
            <hr className="hr" />
            <div className="s-label" style={{ marginBottom: 4 }}>Trader rationale</div>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>{p.rationale}</p>
          </div>

          <div className="card">
            <h3>Quote ladder (evidence)</h3>
            <p className="sub">Archived automatically for best-execution review</p>
            <table className="tbl">
              <thead><tr><th>Dealer</th><th className="num">Level</th><th className="num">Max size</th><th>Allocated</th></tr></thead>
              <tbody>
                {[...quotes].sort((a, b) => a.price - b.price).map((q) => {
                  const al = p.allocations.find((x) => x.bankId === q.bankId);
                  return (
                    <tr key={q.id}>
                      <td><span className="bank-dot" style={{ background: bank(q.bankId).color, display: 'inline-block', marginRight: 8 }} />{bank(q.bankId).name}</td>
                      <td className="num t-strong">{fmtPrice(q.price, rfq.quoteUnit)}</td>
                      <td className="num">{q.pct}%</td>
                      <td>{al ? <span className="badge">{al.pct}%</span> : <span className="t-faint">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="card">
            <h3>Policy flags</h3>
            <p className="sub">Raised automatically at recommendation</p>
            <div className="grid" style={{ gap: 8 }}>
              {p.flags?.length
                ? p.flags.map((f, i) => <div key={i} className="flag flag-warn"><Icon name="alert" size={15} /> <span>{f.text}</span></div>)
                : <div className="flag flag-ok"><Icon name="check" size={15} /> <span>No policy exceptions on this award.</span></div>}
            </div>
          </div>

          <div className="card">
            <h3>Dealer concentration context</h3>
            <p className="sub">Trailing-90-day awarded share vs 35% cap</p>
            <ConcentrationBars data={CONCENTRATION} highlight={highlight} />
          </div>

          <div className="card">
            <h3>Decision</h3>
            {role === 'approver' ? (
              <div className="btn-row">
                <button className="btn btn-green" onClick={() => { actions.approve(rfq.id); }}>
                  {p.flags?.length ? 'Acknowledge flag & approve' : 'Approve award'}
                </button>
                <button className="btn" onClick={() => actions.sendBack(rfq.id)}>Request clarification</button>
                <button className="btn btn-red" onClick={() => actions.reject(rfq.id)}>Reject</button>
              </div>
            ) : (
              <div className="note">Switch to the Approver role to act. Decisions are written to the immutable audit log with the acting user and timestamp.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
