// views/Ops.jsx — middle-office workspace: trade economics, capture payload
// previews, affirmation tracking, exceptions queue.
import React, { useContext, useState } from 'react';
import { AppCtx } from '../ctx.js';
import { Pill, Icon, bank, stpPayload } from '../components/ui.jsx';
import { fmtPrice, fmtMoneyFull } from '../lib/format.js';

export default function Ops() {
  const { db, openModal, actions, nav } = useContext(AppCtx);
  const [flagFor, setFlagFor] = useState(null);
  const [flagText, setFlagText] = useState('');

  const showPayload = (h) => {
    const rfq = db.rfqs.find((r) => r.id === h.rfqId);
    const trades = db.trades.filter((t) => h.tradeIds.includes(t.id));
    const allocations = trades.length
      ? trades.map((t) => ({ bankId: t.bankId, pct: t.pct, price: t.price }))
      : (rfq.award?.allocations || []);
    openModal(`Capture payload — ${h.id}`, (
      <div>
        <p className="note" style={{ marginTop: 0 }}>{h.payload} · {h.channel}</p>
        <pre className="payload">{stpPayload(rfq, allocations, trades)}</pre>
      </div>
    ));
  };

  return (
    <>
      <div className="card">
        <h3>Approved trade economics</h3>
        <p className="sub">Every awarded allocation becomes a discrete trade with its own capture record</p>
        <table className="tbl">
          <thead>
            <tr><th>Trade</th><th>RFQ</th><th>Dealer</th><th className="num">Allocation</th><th className="num">Level</th><th>Settlement</th><th>UTI</th><th>Status</th></tr>
          </thead>
          <tbody>
            {db.trades.map((t) => {
              const rfq = db.rfqs.find((r) => r.id === t.rfqId);
              return (
                <tr key={t.id} className="rowlink" onClick={() => nav('rfq', { id: t.rfqId })}>
                  <td className="mono t-strong">{t.id}</td>
                  <td className="mono t-muted">{t.rfqId}</td>
                  <td><span className="bank-dot" style={{ background: bank(t.bankId).color, display: 'inline-block', marginRight: 8 }} />{bank(t.bankId).name}</td>
                  <td className="num">{t.pct}% · {fmtMoneyFull(t.allocNotional, t.ccy)}</td>
                  <td className="num t-strong">{fmtPrice(t.price, rfq?.quoteUnit)}</td>
                  <td className="t-muted">{t.settle}</td>
                  <td className="mono t-faint" style={{ fontSize: 10.5 }}>{t.uti}</td>
                  <td><Pill status={t.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>STP handoffs & affirmation</h3>
        <p className="sub">Capture payloads sent to the affirmation channel — advance status to simulate matching</p>
        <div className="grid" style={{ gap: 10 }}>
          {db.handoffs.map((h) => {
            const rfq = db.rfqs.find((r) => r.id === h.rfqId);
            return (
              <div key={h.id} className="card card-tight" style={{ background: 'var(--surface-2)' }}>
                <div className="row">
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="mono t-strong">{h.id}</span>
                      <Pill status={h.status === 'Matched' ? 'In STP' : h.status} />
                    </div>
                    <div className="t-faint" style={{ marginTop: 3 }}>
                      {rfq?.id} · {rfq?.title} · {h.tradeIds.length} leg{h.tradeIds.length > 1 ? 's' : ''} · {h.channel} · sent {h.sent}
                    </div>
                  </div>
                  <div className="btn-row">
                    <button className="btn btn-sm" onClick={() => showPayload(h)}>
                      <Icon name="doc" size={13} style={{ verticalAlign: '-2px' }} /> View payload
                    </button>
                    {h.status !== 'Affirmed' && (
                      <button className="btn btn-sm btn-primary" onClick={() => actions.advanceHandoff(h.id)}>
                        {h.status.startsWith('Sent') ? 'Mark matched' : 'Mark affirmed'}
                      </button>
                    )}
                    <button className="btn btn-sm btn-ghost" onClick={() => { setFlagFor(h.id); setFlagText(''); }}>Flag exception</button>
                  </div>
                </div>
                {h.exceptions.length > 0 && (
                  <div className="grid" style={{ gap: 6, marginTop: 10 }}>
                    {h.exceptions.map((e) => (
                      <div key={e.id} className={`flag ${e.open ? 'flag-warn' : 'flag-ok'}`} style={{ padding: '7px 10px' }}>
                        <Icon name={e.open ? 'alert' : 'check'} size={14} />
                        <span><b className="mono" style={{ fontSize: 10.5 }}>{e.id}</b> · {e.text}{e.open ? '' : ' (resolved)'}</span>
                      </div>
                    ))}
                  </div>
                )}
                {flagFor === h.id && (
                  <div className="row" style={{ marginTop: 10 }}>
                    <input type="text" style={{ flex: 1 }} placeholder="Describe the break (SSI, economics, doc mismatch…)"
                      value={flagText} onChange={(e) => setFlagText(e.target.value)} />
                    <button className="btn btn-sm btn-primary" disabled={!flagText}
                      onClick={() => { actions.flagException(h.id, flagText); setFlagFor(null); }}>Add</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setFlagFor(null)}>Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flag flag-info" style={{ marginTop: 12 }}>
          <Icon name="flow" size={15} />
          <span>In production, payloads flow to MarkitWire / DTCC or the client’s OMS via FIX or API. The demo renders representative FpML-style JSON.</span>
        </div>
      </div>
    </>
  );
}
