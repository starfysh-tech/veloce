// views/RfqDetail.jsx — the centerpiece. Quote board, single-vs-blended
// comparison, approval panel, audit log, attachments, and the dealer-side
// response experience (blind: competitors masked, rank-only feedback).
import React, { useContext, useState } from 'react';
import { AppCtx } from '../ctx.js';
import { BANK_PERSONA } from '../data/seed.js';
import { Pill, Countdown, Timeline, Attachments, BlendBar, Icon, bank, stpPayload } from '../components/ui.jsx';
import { bestSingle, bestBlended, savings, fmtPrice, fmtMoneyFull, notionalLabel } from '../lib/format.js';

export default function RfqDetail() {
  const { db, view, role, nav } = useContext(AppCtx);
  const rfq = db.rfqs.find((r) => r.id === view.params.id);
  const [tab, setTab] = useState(role === 'bank' ? 'respond' : 'board');
  if (!rfq) return <div className="empty">RFQ not found.</div>;

  const quotes = db.quotes.filter((q) => q.rfqId === rfq.id);
  const isBank = role === 'bank';
  const tabs = isBank
    ? [['overview', 'Overview'], ['respond', 'Your Response']]
    : [['overview', 'Overview'], ['board', 'Quote Board'], ['compare', 'Comparison & Award'], ['approval', 'Approval'], ['audit', 'Audit Log']];

  return (
    <>
      <div className="card">
        <div className="detail-head">
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="mono t-faint">{rfq.id}</span>
              <Pill status={rfq.status} />
              {rfq.blind && <span className="badge">BLIND</span>}
            </div>
            <h2>{rfq.title}</h2>
            <div className="meta">{rfq.product} · {notionalLabel(rfq)} · {rfq.invited.length} dealers · {rfq.mode} · Requested by {rfq.requester}</div>
          </div>
          {rfq.status === 'Live' && rfq.deadline && <Countdown deadline={rfq.deadline} />}
          {role !== 'bank' && <button className="btn btn-ghost btn-sm" onClick={() => nav('rfqs')}>← Blotter</button>}
        </div>
        <hr className="hr" />
        <div className="spec">
          {[['Underlying', rfq.underlying], ['Reference', rfq.refLevel], ['Strike', rfq.strike], ['Expiry', rfq.expiry],
            ['Style', rfq.style], ['Side', rfq.side], ['Quote convention', rfq.quoteUnit], ['Created', rfq.createdAt]].map(([l, v]) => (
            <div key={l}><div className="s-label">{l}</div><div className="s-val">{v}</div></div>
          ))}
        </div>
      </div>

      <div className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} role="tab" aria-selected={tab === id}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && <Overview rfq={rfq} quotes={quotes} />}
      {tab === 'board' && <QuoteBoard rfq={rfq} quotes={quotes} />}
      {tab === 'compare' && <Comparison rfq={rfq} quotes={quotes} />}
      {tab === 'approval' && <ApprovalPanel rfq={rfq} />}
      {tab === 'audit' && <AuditTab rfq={rfq} quotes={quotes} />}
      {tab === 'respond' && <BankRespond rfq={rfq} quotes={quotes} />}
    </>
  );
}

/* ------------------------------------------------------------- overview */
function Overview({ rfq, quotes }) {
  const { role } = useContext(AppCtx);
  const isBank = role === 'bank';
  return (
    <div className="grid g2">
      <div className="card">
        <h3>Counterparty panel</h3>
        <p className="sub">{rfq.blind ? 'Blind auction — dealers cannot see competitor identities or levels' : 'Disclosed auction'}</p>
        <div className="grid" style={{ gap: 8 }}>
          {rfq.invited.map((id) => {
            const b = bank(id);
            const q = quotes.find((x) => x.bankId === id);
            const masked = isBank && id !== BANK_PERSONA;
            return (
              <div key={id} className="row" style={{ padding: '7px 4px', borderBottom: '1px solid var(--border-soft)' }}>
                <span className="bank-dot" style={{ background: masked ? 'var(--faint)' : b.color }} />
                <span style={{ fontWeight: 600 }}>{masked ? `Dealer (masked)` : b.name}</span>
                <span className="spacer" />
                {q
                  ? <span className="t-green" style={{ fontSize: 12, fontWeight: 600 }}>Responded{masked ? '' : ` · ${q.ts}`}</span>
                  : <span className="t-faint" style={{ fontSize: 12 }}>{rfq.status === 'Live' ? 'Awaiting response' : 'No response'}</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid" style={{ alignContent: 'start' }}>
        <div className="card">
          <h3>Attachments</h3>
          <p className="sub">Term sheets and supporting documents</p>
          <Attachments rfq={rfq} />
        </div>
        <div className="card">
          <h3>Activity</h3>
          <p className="sub">Most recent events</p>
          <Timeline items={rfq.timeline.slice(-4)} />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- quote board */
export function QuoteBoard({ rfq, quotes }) {
  const single = bestSingle(quotes);
  const sorted = [...quotes].sort((a, b) => a.price - b.price);
  const pendingBanks = rfq.invited.filter((id) => !quotes.find((q) => q.bankId === id));

  if (rfq.status === 'Draft') {
    return <div className="card"><div className="empty">This RFQ has not been launched. Dealers receive invitations and the quote board opens when the auction window starts.</div></div>;
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="qboard" style={{ border: 'none' }}>
        <div className="qboard-head">
          <h3 style={{ margin: 0 }}>Quote board</h3>
          <span className="note">{quotes.length} of {rfq.invited.length} dealers responded · sorted by level · quoting {rfq.quoteUnit}</span>
          <span className="spacer" />
          {rfq.status === 'Live' && <span className="pill pill-live">Auction open</span>}
        </div>
        {sorted.map((q) => {
          const b = bank(q.bankId);
          const isBest = single && q.id === single.id;
          return (
            <div key={q.id} className={`quote-row ${isBest ? 'best' : ''} ${q.arrived ? 'arrived' : ''}`}>
              <div className="bank-cell">
                <span className="bank-dot" style={{ background: b.color }} />
                <div>
                  <div style={{ fontWeight: 600 }}>{b.name}</div>
                  <div className="t-faint">{q.ts}{q.revisedFrom ? ` · revised from ${q.revisedFrom}%` : ''}</div>
                </div>
              </div>
              <div className="t-muted" style={{ fontSize: 12 }}>{q.note}</div>
              <div>
                <div className="q-price">{fmtPrice(q.price, rfq.quoteUnit)}</div>
                {isBest && <div className="q-best-tag">BEST FULL SIZE</div>}
              </div>
              <div className="pct-wrap">
                <div className="pct-bar"><i style={{ width: `${q.pct}%`, background: q.pct === 100 ? 'var(--accent)' : 'var(--amber)' }} /></div>
                <span className="pct-label">{q.pct === 100 ? 'Full size' : `Up to ${q.pct}%`}</span>
              </div>
              <div className="t-faint" style={{ fontSize: 11.5 }}>
                {q.pct === 100 ? fmtMoneyFull(rfq.notional, rfq.ccy) : `${fmtMoneyFull(rfq.notional * q.pct / 100, rfq.ccy)} max`}
              </div>
            </div>
          );
        })}
        {pendingBanks.map((id) => (
          <div key={id} className="quote-row pending">
            <div className="bank-cell">
              <span className="bank-dot" style={{ background: bank(id).color }} />
              <div><div style={{ fontWeight: 600 }}>{bank(id).name}</div><div className="t-faint">Invited {rfq.createdAt}</div></div>
            </div>
            <div className="t-faint" style={{ fontSize: 12 }}>{rfq.status === 'Live' ? 'Awaiting response…' : 'Did not respond'}</div>
            <div className="t-faint mono">—</div>
            <div className="t-faint">—</div>
            <div />
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------- comparison / award builder */
function Comparison({ rfq, quotes }) {
  const { role, actions } = useContext(AppCtx);
  const [mode, setMode] = useState('blended');
  const single = bestSingle(quotes);
  const blend = bestBlended(quotes);
  const sav = savings(rfq, single, blend);
  const better = rfq.lowerIsBetter !== false; // all seeded products: lower price is better

  if (!quotes.length) return <div className="card"><div className="empty">No quotes yet — the comparison view activates once responses arrive.</div></div>;

  const blendedCost = blend ? (blend.blended / 100) * rfq.notional : null;
  const singleCost = single ? (single.price / 100) * rfq.notional : null;
  const isVol = rfq.quoteUnit === 'vol strike';
  const canRecommend = role === 'trader' && ['Live', 'Under Review'].includes(rfq.status);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="row">
          <div>
            <h3>Award construction</h3>
            <p className="sub" style={{ margin: 0 }}>Compare the best single-bank award against the best blended allocation</p>
          </div>
          <span className="spacer" />
          <div className="mode-toggle" role="tablist" aria-label="Award mode">
            <button className={mode === 'single' ? 'on' : ''} onClick={() => setMode('single')}>Best single bank</button>
            <button className={mode === 'blended' ? 'on' : ''} onClick={() => setMode('blended')}>Best blended</button>
          </div>
        </div>
        <hr className="hr" />

        {mode === 'single' && single && (
          <div className="grid" style={{ gap: 12 }}>
            <BlendBar fills={[{ bankId: single.bankId, take: 100, price: single.price }]} unit={rfq.quoteUnit} />
            <div className="spec">
              <div><div className="s-label">Level</div><div className="s-val mono">{fmtPrice(single.price, rfq.quoteUnit)}</div></div>
              {!isVol && <div><div className="s-label">Premium cost</div><div className="s-val mono">{fmtMoneyFull(singleCost, rfq.ccy)}</div></div>}
              <div><div className="s-label">Counterparties</div><div className="s-val">1 · {bank(single.bankId).name}</div></div>
              <div><div className="s-label">Coverage</div><div className="s-val">100% of size</div></div>
            </div>
            <div className="flag flag-info">Single-counterparty execution — simplest post-trade, but leaves the partial-percentage liquidity inside this level on the table.</div>
          </div>
        )}

        {mode === 'blended' && (blend ? (
          <div className="grid" style={{ gap: 12 }}>
            <BlendBar fills={blend.fills} unit={rfq.quoteUnit} />
            <div className="spec">
              <div><div className="s-label">Blended level</div><div className="s-val mono t-green">{fmtPrice(blend.blended, rfq.quoteUnit)}</div></div>
              {!isVol && <div><div className="s-label">Premium cost</div><div className="s-val mono">{fmtMoneyFull(blendedCost, rfq.ccy)}</div></div>}
              <div><div className="s-label">Counterparties</div><div className="s-val">{blend.fills.length}</div></div>
              <div><div className="s-label">Coverage</div><div className="s-val">100% of size</div></div>
            </div>
            {sav && sav.bps > 0.01 && (
              <div className="delta-box">
                <div className="row">
                  <div>
                    <div className="note" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>Blended vs best single bank</div>
                    <div className="d-big">{better ? '−' : ''}{sav.bps.toFixed(1)} bps{!isVol && <span style={{ fontSize: 14 }}> · saves {fmtMoneyFull(sav.usd, rfq.ccy)}</span>}</div>
                  </div>
                </div>
                <div className="note" style={{ marginTop: 6, color: 'var(--text)' }}>
                  Why it wins: dealers willing to take only part of the size quote tighter than full-size balance-sheet levels. Synchronized competition lets you stack those partial quotes until 100% is covered — capturing liquidity an email process can’t aggregate.
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flag flag-warn">Partial quotes received so far cannot cover 100% of size — blended award unavailable until more responses arrive.</div>
        ))}
      </div>

      <div className="card">
        <h3>Quote ladder</h3>
        <p className="sub">All responses, cheapest first</p>
        <table className="tbl">
          <thead><tr><th>Dealer</th><th className="num">Level</th><th className="num">Max size</th><th className="num">{isVol ? '—' : 'Cost at max'}</th><th>In blended award</th></tr></thead>
          <tbody>
            {[...quotes].sort((a, b) => a.price - b.price).map((q) => {
              const fill = blend?.fills.find((f) => f.id === q.id);
              return (
                <tr key={q.id}>
                  <td><span className="bank-dot" style={{ background: bank(q.bankId).color, display: 'inline-block', marginRight: 8 }} />{bank(q.bankId).name}</td>
                  <td className="num t-strong">{fmtPrice(q.price, rfq.quoteUnit)}</td>
                  <td className="num">{q.pct}%</td>
                  <td className="num t-muted">{isVol ? '—' : fmtMoneyFull(rfq.notional * (q.pct / 100) * (q.price / 100), rfq.ccy)}</td>
                  <td>{fill ? <span className="badge">{fill.take}% allocated</span> : <span className="t-faint">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {canRecommend && single && blend && (
          <>
            <hr className="hr" />
            <div className="row">
              <span className="note">Recommending routes the {mode === 'blended' ? 'blended' : 'single-bank'} construction to the Treasury Committee with the archived ladder attached.</span>
              <span className="spacer" />
              <button className="btn btn-primary" onClick={() => actions.recommendAward(rfq.id, mode === 'blended'
                ? { kind: 'blended', allocations: blend.fills.map((f) => ({ bankId: f.bankId, pct: f.take, price: f.price })), blendedPrice: +blend.blended.toFixed(3), bestSinglePrice: single.price, bestSingleBank: single.bankId, savingsUsd: Math.round(sav.usd), savingsBps: +sav.bps.toFixed(1), rationale: 'Stacked partial-percentage quotes beat the best full-size level while covering 100% of size.', flags: [] }
                : { kind: 'single', allocations: [{ bankId: single.bankId, pct: 100, price: single.price }], blendedPrice: single.price, bestSinglePrice: single.price, bestSingleBank: single.bankId, savingsUsd: 0, savingsBps: 0, rationale: 'Best full-size level selected for single-counterparty execution.', flags: [] }
              )}>Recommend this award</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- approval */
function ApprovalPanel({ rfq }) {
  const { role, actions } = useContext(AppCtx);
  const p = rfq.proposal;
  const a = rfq.award;

  if (!p && !a) return <div className="card"><div className="empty">No award has been proposed yet. The trading desk recommends an award from the Comparison tab.</div></div>;

  if (a) {
    return (
      <div className="card">
        <h3>Award — approved</h3>
        <p className="sub">{a.note}</p>
        <BlendBar fills={a.allocations.map((x) => ({ bankId: x.bankId, take: x.pct, price: x.price }))} unit={rfq.quoteUnit} />
        <div className="flag flag-ok" style={{ marginTop: 12 }}>Approved and captured. Post-trade handoff visible in the Operations workspace.</div>
      </div>
    );
  }

  return (
    <div className="grid g2">
      <div className="card">
        <h3>Proposed award</h3>
        <p className="sub">{p.kind === 'blended' ? 'Blended allocation across multiple dealers' : 'Single-bank award'}</p>
        <BlendBar fills={p.allocations.map((x) => ({ bankId: x.bankId, take: x.pct, price: x.price }))} unit={rfq.quoteUnit} />
        <hr className="hr" />
        <div className="spec">
          <div><div className="s-label">Proposed level</div><div className="s-val mono t-green">{fmtPrice(p.blendedPrice, rfq.quoteUnit)}</div></div>
          <div><div className="s-label">Best single bank</div><div className="s-val mono">{fmtPrice(p.bestSinglePrice, rfq.quoteUnit)} ({bank(p.bestSingleBank).short})</div></div>
          <div><div className="s-label">Improvement</div><div className="s-val t-green">{p.savingsBps} bps · {fmtMoneyFull(p.savingsUsd, rfq.ccy)}</div></div>
        </div>
        <hr className="hr" />
        <div className="s-label" style={{ marginBottom: 4 }}>Execution rationale</div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>{p.rationale}</p>
      </div>
      <div className="card">
        <h3>Policy & exception flags</h3>
        <p className="sub">Checked automatically at recommendation time</p>
        <div className="grid" style={{ gap: 8 }}>
          {p.flags?.length
            ? p.flags.map((f, i) => <div key={i} className={`flag flag-${f.sev}`}><Icon name="alert" size={15} /> <span>{f.text}</span></div>)
            : <div className="flag flag-ok"><Icon name="check" size={15} /> <span>No policy exceptions — within concentration cap and approval thresholds.</span></div>}
          <div className="flag flag-info"><Icon name="shield" size={15} /> <span>Full quote ladder and event log archived for best-execution evidence.</span></div>
        </div>
        {role === 'approver' ? (
          <>
            <hr className="hr" />
            <div className="btn-row">
              <button className="btn btn-green" onClick={() => actions.approve(rfq.id)}>Approve award</button>
              <button className="btn" onClick={() => actions.sendBack(rfq.id)}>Request clarification</button>
              <button className="btn btn-red" onClick={() => actions.reject(rfq.id)}>Reject</button>
            </div>
          </>
        ) : (
          <div className="note" style={{ marginTop: 12 }}>Awaiting Treasury Committee action — switch to the Approver role to act on this proposal.</div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- audit tab */
function AuditTab({ rfq, quotes }) {
  const { openModal } = useContext(AppCtx);
  const exportSummary = () => {
    const payload = {
      type: 'ExecutionSummary', rfq: rfq.id, product: rfq.product, status: rfq.status,
      panel: rfq.invited.map((id) => bank(id).name), responses: quotes.length,
      quoteLadder: quotes.map((q) => ({ dealer: bank(q.bankId).name, pct: q.pct, level: q.price, ts: q.ts })),
      award: rfq.award || rfq.proposal || null,
      events: rfq.timeline,
    };
    openModal(`Execution summary — ${rfq.id}`, <pre className="payload">{JSON.stringify(payload, null, 2)}</pre>);
  };
  return (
    <div className="card">
      <div className="row">
        <div>
          <h3>Audit log</h3>
          <p className="sub" style={{ margin: 0 }}>Immutable event history — invitations, quotes, revisions, overrides, approvals</p>
        </div>
        <span className="spacer" />
        <button className="btn btn-sm" onClick={exportSummary}><Icon name="export" size={13} style={{ verticalAlign: '-2px' }} /> Export execution summary</button>
      </div>
      <hr className="hr" />
      <Timeline items={rfq.timeline} />
    </div>
  );
}

/* --------------------------------------------------------- bank response */
function BankRespond({ rfq, quotes }) {
  const { actions, nowMs, db } = useContext(AppCtx);
  const mine = quotes.find((q) => q.bankId === BANK_PERSONA);
  const [price, setPrice] = useState(mine ? String(mine.price) : '');
  const [pct, setPct] = useState(mine ? mine.pct : 100);
  const [note, setNote] = useState(mine ? mine.note : '');
  const open = rfq.status === 'Live' && rfq.deadline && rfq.deadline > nowMs;

  // Blind feedback: rank only, never competitor identities or levels.
  const myRank = mine ? [...quotes].sort((a, b) => a.price - b.price).findIndex((q) => q.bankId === BANK_PERSONA) + 1 : null;

  const awardAlloc = rfq.award?.allocations.find((x) => x.bankId === BANK_PERSONA);
  const awarded = ['Awarded', 'In STP', 'Affirmed'].includes(rfq.status);

  return (
    <div className="grid g2">
      <div className="card">
        <h3>{mine ? 'Your quote' : 'Submit a quote'}</h3>
        <p className="sub">{rfq.blind ? 'Blind auction — you will not see competitor identities or levels' : 'Disclosed auction'}</p>
        {open ? (
          <div className="grid" style={{ gap: 12 }}>
            <div className="grid g2" style={{ gap: 10 }}>
              <label className="fld">Level ({rfq.quoteUnit})
                <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 2.79" />
              </label>
              <label className="fld">Participation
                <select value={pct} onChange={(e) => setPct(+e.target.value)}>
                  {[100, 75, 60, 50, 40, 25].map((p) => <option key={p} value={p}>{p === 100 ? 'Full size (100%)' : `Partial — up to ${p}%`}</option>)}
                </select>
              </label>
            </div>
            <label className="fld">Conditions / notes
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Firm for 30 minutes…" />
            </label>
            <div className="btn-row">
              <button className="btn btn-primary" disabled={!price} onClick={() => actions.submitQuote(rfq.id, { pct, price: +(+price).toFixed(2), note })}>
                {mine ? 'Revise quote' : 'Submit quote'}
              </button>
              <span className="note">Revisions are allowed until the window closes; full history is retained.</span>
            </div>
          </div>
        ) : (
          <div className="flag flag-info">The auction window is closed. {mine ? 'Your final quote is on the buy-side board.' : 'No quote was submitted.'}</div>
        )}
      </div>

      <div className="grid" style={{ alignContent: 'start' }}>
        <div className="card">
          <h3>Auction status</h3>
          <p className="sub">What you can see in a blind auction</p>
          <div className="spec">
            <div><div className="s-label">Dealers invited</div><div className="s-val">{rfq.invited.length}</div></div>
            <div><div className="s-label">Responses in</div><div className="s-val">{quotes.length}</div></div>
            <div><div className="s-label">Your status</div><div className="s-val">{mine ? `Quoted ${mine.pct}% @ ${fmtPrice(mine.price, rfq.quoteUnit)}` : 'Not quoted'}</div></div>
            {mine && rfq.blind && <div><div className="s-label">Your rank</div><div className="s-val">#{myRank} of {quotes.length} by level</div></div>}
          </div>
          {mine?.revisedFrom && <div className="note" style={{ marginTop: 10 }}>Revision history: previously {mine.revisedFrom}% — retained in the audit log.</div>}
        </div>
        {awarded && (
          <div className="card">
            <h3>Award result</h3>
            {awardAlloc ? (
              <div className="flag flag-ok">
                <Icon name="check" size={15} />
                <span>Allocated <b>{awardAlloc.pct}%</b> ({fmtMoneyFull(rfq.notional * awardAlloc.pct / 100, rfq.ccy)}) at {fmtPrice(awardAlloc.price, rfq.quoteUnit)}. Confirmation will arrive via the STP channel.</span>
              </div>
            ) : (
              <div className="flag flag-info">This RFQ was awarded elsewhere. Competitor identities and levels remain masked under blind-auction rules.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
