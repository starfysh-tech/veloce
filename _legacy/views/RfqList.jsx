// views/RfqList.jsx — the RFQ blotter. Filterable; visibility is role-aware
// (banks only see RFQs where they are invited).
import React, { useContext, useState } from 'react';
import { AppCtx } from '../ctx.js';
import { BANK_PERSONA, STATUS_ORDER } from '../data/seed.js';
import { Pill, Countdown } from '../components/ui.jsx';
import { notionalLabel, fmtPrice } from '../lib/format.js';

export default function RfqList() {
  const { db, role, nav, nowMs } = useContext(AppCtx);
  const [status, setStatus] = useState('All');
  const [product, setProduct] = useState('All');
  const [requester, setRequester] = useState('All');

  let rows = db.rfqs;
  if (role === 'bank') rows = rows.filter((r) => r.invited.includes(BANK_PERSONA) && r.status !== 'Draft');
  if (status !== 'All') rows = rows.filter((r) => r.status === status);
  if (product !== 'All') rows = rows.filter((r) => r.product === product);
  if (requester !== 'All') rows = rows.filter((r) => r.requesterFirm === requester);

  const products = [...new Set(db.rfqs.map((r) => r.product))];

  return (
    <>
      <div className="card card-tight">
        <div className="filters">
          <label className="fld">Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>All</option>{STATUS_ORDER.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="fld">Product
            <select value={product} onChange={(e) => setProduct(e.target.value)}>
              <option>All</option>{products.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          {role !== 'bank' && (
            <label className="fld">Requester
              <select value={requester} onChange={(e) => setRequester(e.target.value)}>
                <option value="All">All</option>
                <option value="meridian">Meridian Mutual Insurance</option>
                <option value="halcyon">Halcyon Capital Partners</option>
              </select>
            </label>
          )}
          <div className="spacer" />
          <span className="note">{rows.length} of {role === 'bank' ? db.rfqs.filter((r) => r.invited.includes(BANK_PERSONA) && r.status !== 'Draft').length : db.rfqs.length} RFQs</span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>RFQ</th><th>Product</th><th className="num">Size</th><th>Panel</th>
              <th>Deadline</th><th>Quotes</th><th>Status</th>
              {role === 'bank' && <th>Your response</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const qs = db.quotes.filter((q) => q.rfqId === r.id);
              const mine = qs.find((q) => q.bankId === BANK_PERSONA);
              const left = r.deadline ? r.deadline - nowMs : null;
              return (
                <tr key={r.id} className="rowlink" onClick={() => nav('rfq', { id: r.id })}>
                  <td>
                    <span className="mono t-strong">{r.id}</span>
                    <div className="t-faint">{r.title}</div>
                  </td>
                  <td>{r.product}<div className="t-faint">{r.tenor} · {r.ccy}</div></td>
                  <td className="num">{notionalLabel(r)}</td>
                  <td className="t-muted">{r.invited.length} dealers{r.blind ? ' · blind' : ''}</td>
                  <td>
                    {r.status === 'Live' && left > 0
                      ? <span className="mono t-strong" style={{ color: left < 2 * 60000 ? 'var(--red)' : 'var(--accent)' }}>
                          {String(Math.floor(left / 60000)).padStart(2, '0')}:{String(Math.floor((left % 60000) / 1000)).padStart(2, '0')} left
                        </span>
                      : <span className="t-faint">{r.deadline ? 'Closed' : '—'}</span>}
                  </td>
                  <td className="mono t-muted">{role === 'bank' && r.blind ? `${qs.length} in` : `${qs.length} / ${r.invited.length}`}</td>
                  <td><Pill status={r.status} /></td>
                  {role === 'bank' && (
                    <td>{mine
                      ? <span className="mono t-green">{mine.pct}% @ {fmtPrice(mine.price, r.quoteUnit)}</span>
                      : r.status === 'Live' ? <span className="t-amber t-strong" style={{ fontSize: 12 }}>Action needed</span> : <span className="t-faint">—</span>}</td>
                  )}
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={8}><div className="empty">No RFQs match the current filters.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
