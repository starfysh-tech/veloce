// views/Dashboard.jsx — role-specific home screens with KPIs, tasks, alerts.
import React, { useContext } from 'react';
import { AppCtx } from '../ctx.js';
import { CONCENTRATION, BANK_PERSONA } from '../data/seed.js';
import { Kpi, Pill, Countdown, ConcentrationBars, bank } from '../components/ui.jsx';
import { notionalLabel, fmtPrice } from '../lib/format.js';

function RfqMiniTable({ rfqs, extra }) {
  const { nav } = useContext(AppCtx);
  return (
    <table className="tbl">
      <thead><tr><th>RFQ</th><th>Product</th><th className="num">Size</th><th>Status</th>{extra && <th>{extra.head}</th>}</tr></thead>
      <tbody>
        {rfqs.map((r) => (
          <tr key={r.id} className="rowlink" onClick={() => nav('rfq', { id: r.id })}>
            <td><span className="mono t-strong">{r.id}</span><div className="t-faint">{r.title}</div></td>
            <td>{r.product}</td>
            <td className="num">{notionalLabel(r)}</td>
            <td><Pill status={r.status} /></td>
            {extra && <td>{extra.cell(r)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Dashboard() {
  const { db, role, persona, nav } = useContext(AppCtx);
  const live = db.rfqs.filter((r) => r.status === 'Live');
  const pending = db.rfqs.filter((r) => r.status === 'Awaiting Approval');
  const heroRfq = db.rfqs.find((r) => r.hero);

  const Greeting = (
    <div className="row">
      <div>
        <h2 style={{ margin: 0, fontSize: 18 }}>Good afternoon, {persona.user.split(' ')[0]}</h2>
        <div className="t-faint">{persona.desk} · {persona.firm} · Friday, 12 June 2026</div>
      </div>
    </div>
  );

  if (role === 'trader') {
    return (
      <>
        {Greeting}
        <div className="grid g4">
          <Kpi label="Live auctions" value={live.length} note={live.length ? `${heroRfq?.id} window open` : 'No open windows'} tone={live.length ? 'k-up' : ''} />
          <Kpi label="Awaiting approval" value={pending.length} note="Treasury Committee queue" tone={pending.length ? 'k-warn' : ''} />
          <Kpi label="Avg. blended savings (90d)" value="9.6 bps" note="vs best single-bank quote" tone="k-up" />
          <Kpi label="Dealer panel" value="5" note="Core US Vol + HGB" />
        </div>

        {heroRfq && heroRfq.status === 'Live' && (
          <div className="card">
            <div className="row">
              <div style={{ flex: 1, minWidth: 220 }}>
                <h3>Live auction — {heroRfq.id}</h3>
                <p className="sub" style={{ margin: 0 }}>{heroRfq.title} · {notionalLabel(heroRfq)} · {db.quotes.filter((q) => q.rfqId === heroRfq.id).length} of {heroRfq.invited.length} dealers responded</p>
              </div>
              <Countdown deadline={heroRfq.deadline} />
              <button className="btn btn-primary" onClick={() => nav('rfq', { id: heroRfq.id })}>Open quote board</button>
            </div>
          </div>
        )}

        <div className="grid g2">
          <div className="card">
            <h3>Recent RFQs</h3>
            <p className="sub">Your desk’s last five requests</p>
            <RfqMiniTable rfqs={db.rfqs.filter((r) => r.requesterFirm === 'meridian').slice(0, 5)} />
          </div>
          <div className="card">
            <h3>Tasks & alerts</h3>
            <p className="sub">Items needing your attention</p>
            <div className="grid" style={{ gap: 8 }}>
              {heroRfq?.status === 'Live' && <div className="flag flag-info">Auction window open on {heroRfq.id} — review the board before the timer expires.</div>}
              {pending.map((r) => <div key={r.id} className="flag flag-warn">{r.id} is with the Treasury Committee — concentration flag attached.</div>)}
              <div className="flag flag-ok">VEL-2026-0136 fully affirmed — blended award saved $294,000 vs best single quote.</div>
              {db.rfqs.filter((r) => r.status === 'Draft').map((r) => <div key={r.id} className="flag flag-info">Draft {r.id} ({r.title}) awaiting sizing — open the wizard to launch.</div>)}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (role === 'approver') {
    return (
      <>
        {Greeting}
        <div className="grid g4">
          <Kpi label="Pending approvals" value={pending.length} tone={pending.length ? 'k-warn' : ''} note="Awaiting committee action" />
          <Kpi label="Approved MTD" value="4" note="$710M aggregate notional" />
          <Kpi label="Avg. turnaround" value="26m" note="recommendation → decision" tone="k-up" />
          <Kpi label="Policy flags open" value={db.exceptions.filter((e) => e.status.startsWith('Open')).length} tone="k-warn" note="Concentration / best-ex" />
        </div>
        <div className="card">
          <h3>Approval queue</h3>
          <p className="sub">Proposed awards routed to the Treasury Committee</p>
          {pending.length ? (
            <RfqMiniTable rfqs={pending} extra={{
              head: 'Proposed',
              cell: (r) => r.proposal ? <span className="mono">{r.proposal.kind === 'blended' ? `Blended ${r.proposal.blendedPrice}%` : 'Single bank'}</span> : '—',
            }} />
          ) : <div className="empty">Queue is clear.</div>}
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => nav('approvals')}>Open approval workspace</button>
          </div>
        </div>
        <div className="card">
          <h3>Dealer concentration</h3>
          <p className="sub">Trailing-90-day awarded share vs 35% policy cap</p>
          <ConcentrationBars data={CONCENTRATION} />
        </div>
      </>
    );
  }

  if (role === 'bank') {
    const invited = db.rfqs.filter((r) => r.invited.includes(BANK_PERSONA) && !['Draft'].includes(r.status));
    const myQuotes = db.quotes.filter((q) => q.bankId === BANK_PERSONA);
    return (
      <>
        {Greeting}
        <div className="grid g4">
          <Kpi label="Open invitations" value={invited.filter((r) => r.status === 'Live').length} note="Auction windows open now" tone="k-up" />
          <Kpi label="Quotes in flight" value={myQuotes.filter((q) => db.rfqs.find((r) => r.id === q.rfqId)?.status === 'Live').length} note="Revisable until deadline" />
          <Kpi label="Hit ratio (90d)" value="31%" note="Awarded / quoted" />
          <Kpi label="Awarded MTD" value="$270M" note="Across 3 client firms" tone="k-up" />
        </div>
        <div className="card">
          <h3>Invitations</h3>
          <p className="sub">RFQs where Kestrel Securities is on the panel — blind auctions hide competitor identities and levels</p>
          <RfqMiniTable rfqs={invited.slice(0, 6)} extra={{
            head: 'Your response',
            cell: (r) => {
              const q = myQuotes.find((x) => x.rfqId === r.id);
              return q ? <span className="mono t-green">{q.pct}% @ {fmtPrice(q.price, r.quoteUnit)}</span> : <span className="t-faint">Not quoted</span>;
            },
          }} />
        </div>
      </>
    );
  }

  if (role === 'ops') {
    const open = db.handoffs.filter((h) => h.status !== 'Affirmed');
    return (
      <>
        {Greeting}
        <div className="grid g4">
          <Kpi label="Captures in flight" value={open.length} note="Awaiting match / affirmation" tone={open.length ? 'k-warn' : 'k-up'} />
          <Kpi label="Affirmed this week" value={db.trades.filter((t) => t.status === 'Affirmed').length} note="All legs matched" tone="k-up" />
          <Kpi label="Open exceptions" value={db.handoffs.reduce((n, h) => n + h.exceptions.filter((e) => e.open).length, 0)} note="SSI / economics breaks" />
          <Kpi label="T+0 affirmation rate" value="92%" note="Target ≥ 90%" tone="k-up" />
        </div>
        <div className="card">
          <h3>STP queue</h3>
          <p className="sub">Post-trade handoffs by status</p>
          <table className="tbl">
            <thead><tr><th>Record</th><th>RFQ</th><th>Channel</th><th>Status</th><th>Sent</th></tr></thead>
            <tbody>
              {db.handoffs.map((h) => (
                <tr key={h.id} className="rowlink" onClick={() => nav('ops')}>
                  <td className="mono t-strong">{h.id}</td>
                  <td className="mono">{h.rfqId}</td>
                  <td className="t-muted">{h.channel}</td>
                  <td><Pill status={h.status === 'Matched' ? 'In STP' : h.status} /></td>
                  <td className="t-faint">{h.sent}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => nav('ops')}>Open STP workspace</button>
          </div>
        </div>
      </>
    );
  }

  if (role === 'compliance') {
    return (
      <>
        {Greeting}
        <div className="grid g4">
          <Kpi label="Best-ex coverage" value="100%" note="Every award has an archived ladder" tone="k-up" />
          <Kpi label="Exceptions (30d)" value={db.exceptions.length} note={`${db.exceptions.filter((e) => e.status.startsWith('Open')).length} open`} tone="k-warn" />
          <Kpi label="Overrides logged" value="1" note="Rule-based auto-extension" />
          <Kpi label="Concentration breaches" value="1" note="Pending approver acknowledgment" tone="k-warn" />
        </div>
        <div className="grid g2">
          <div className="card">
            <h3>Open & recent exceptions</h3>
            <p className="sub">Policy deviations and overrides across all RFQs</p>
            <div className="grid" style={{ gap: 8 }}>
              {db.exceptions.map((e) => (
                <div key={e.id} className={`flag ${e.sev === 'warn' ? 'flag-warn' : 'flag-info'}`}>
                  <div>
                    <b className="mono" style={{ fontSize: 11 }}>{e.id} · {e.rfqId}</b>
                    <div style={{ color: 'var(--text)', marginTop: 2 }}>{e.text}</div>
                    <div className="note" style={{ marginTop: 3 }}>{e.status} · opened {e.opened}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3>Dealer concentration</h3>
            <p className="sub">Trailing-90-day awarded share vs policy cap</p>
            <ConcentrationBars data={CONCENTRATION} />
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => nav('compliance')}>Open best-execution review</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // admin
  return (
    <>
      {Greeting}
      <div className="grid g4">
        <Kpi label="Firms onboarded" value="7" note="2 buy-side · 5 dealers" />
        <Kpi label="Active users" value="24" note="Across all firms" />
        <Kpi label="RFQs (30d)" value={db.rfqs.length} note="All lifecycle states" />
        <Kpi label="Platform uptime" value="99.98%" note="Trailing 90 days" tone="k-up" />
      </div>
      <div className="card">
        <h3>Recent system audit events</h3>
        <p className="sub">Immutable platform-level event log</p>
        <table className="tbl">
          <thead><tr><th>Time</th><th>Actor</th><th>Event</th><th>Detail</th></tr></thead>
          <tbody>
            {db.sysAudit.slice(0, 6).map((e, i) => (
              <tr key={i}>
                <td className="mono t-faint">{e.t}</td>
                <td className="mono">{e.actor}</td>
                <td><span className="badge">{e.event}</span></td>
                <td className="t-muted">{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
