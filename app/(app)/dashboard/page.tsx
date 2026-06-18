// app/(app)/dashboard/page.tsx — role-specific read-only landing panels.
import Link from 'next/link';
import { resolveUser } from '@/lib/auth/caller';
import { getDashboard, type DashboardData } from '@/lib/queries/dashboard';
import { fmtDateTime, fmtMoneyFull, fmtPrice, Icon, notionalLabel, Pill } from '@/components/ui';
import { CONCENTRATION_FLAG_THRESHOLD_BPS } from '@/lib/policy';

function Kpi({ label, value, note, tone }: { label: string; value: string | number; note: string; tone?: string }) {
  return (
    <div className="card kpi">
      <div className="k-label">{label}</div>
      <div className={`k-value ${tone ?? ''}`}>{value}</div>
      <div className="k-note">{note}</div>
    </div>
  );
}

function fmtShare(bps: number | null): string {
  return bps === null ? '—' : `${(bps / 100).toFixed(1)}%`;
}

function DashboardHeader({ label, role }: { label: string; role: string }) {
  return (
    <div className="row">
      <div>
        <h2 style={{ margin: 0, fontSize: 18 }}>Dashboard</h2>
        <div className="t-faint">{label} · {role}</div>
      </div>
    </div>
  );
}

function TraderPanel({ data }: { data: Extract<DashboardData, { role: 'trader' }> }) {
  const live = data.liveRfq;
  return (
    <>
      <div className="grid g4">
        <Kpi label="Live auctions" value={data.kpis.liveAuctions} note="Firm RFQs with open auction windows" tone={data.kpis.liveAuctions ? 'k-up' : undefined} />
        <Kpi label="Awaiting approval" value={data.kpis.awaitingApproval} note="Recommended awards pending committee action" tone={data.kpis.awaitingApproval ? 'k-warn' : undefined} />
        <Kpi label="Draft RFQs" value={data.kpis.draftRfqs} note="Firm RFQs not yet launched" />
        <Kpi label="Live response rate" value={data.kpis.responseRatePct === null ? '—' : `${data.kpis.responseRatePct}%`} note="Quotes received / dealers invited on live RFQs" />
      </div>

      {live && (
        <div className="card">
          <div className="row" style={{ gap: 12 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h3>Live auction · {live.ref}</h3>
              <p className="sub" style={{ margin: 0 }}>
                {live.title} · {notionalLabel(live)} · {live.quoteCount} / {live.invitedCount} dealers responded
              </p>
              <div className="t-faint" style={{ marginTop: 4 }}>
                Deadline {live.deadline ? fmtDateTime(live.deadline) : '—'}
              </div>
            </div>
            <Link href={`/rfqs/${live.id}`} className="btn btn-primary">Open quote board</Link>
          </div>
        </div>
      )}

      <div className="grid g2">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px' }}>
            <h3 style={{ margin: 0 }}>Recent firm RFQs</h3>
            <p className="sub" style={{ margin: 0 }}>Latest tenant-scoped requests.</p>
          </div>
          <table className="tbl">
            <thead><tr><th>RFQ</th><th>Product</th><th className="num">Size</th><th>Status</th></tr></thead>
            <tbody>
              {data.recentRfqs.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/rfqs/${r.id}`} style={{ color: 'inherit' }}><span className="mono t-strong">{r.ref}</span><div className="t-faint">{r.title}</div></Link></td>
                  <td>{r.product}<div className="t-faint">{r.tenor} · {r.ccy}</div></td>
                  <td className="num">{notionalLabel(r)}</td>
                  <td><Pill status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Tasks &amp; alerts</h3>
          <p className="sub">Firm RFQs requiring attention.</p>
          {data.tasks.length === 0 ? <div className="empty">No active RFQ tasks.</div> : (
            <div className="grid" style={{ gap: 8 }}>
              {data.tasks.map((r) => (
                <Link key={r.id} href={`/rfqs/${r.id}`} className={`flag ${r.status === 'awaiting_approval' ? 'flag-warn' : 'flag-info'}`} style={{ color: 'inherit' }}>
                  <Icon name={r.status === 'awaiting_approval' ? 'alert' : 'doc'} size={15} />
                  <span><span className="mono t-strong">{r.ref}</span> · {r.title} · <Pill status={r.status} /></span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ApproverPanel({ data }: { data: Extract<DashboardData, { role: 'approver' }> }) {
  return (
    <>
      <div className="grid g4">
        <Kpi label="Pending approvals" value={data.kpis.pendingApprovals} note="RFQs awaiting approver action" tone={data.kpis.pendingApprovals ? 'k-warn' : undefined} />
        <Kpi label="Open exceptions" value={data.kpis.openExceptions} note="Open exceptions attached to the queue" tone={data.kpis.openExceptions ? 'k-warn' : undefined} />
        <Kpi label="Policy flags" value={data.kpis.policyFlags} note="Flags stored on recommended awards" />
        <Kpi label="Top concentration" value={fmtShare(data.kpis.highestConcentrationBps)} note="Trailing-90-day USD awarded share" />
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px' }}>
          <h3 style={{ margin: 0 }}>Approval queue</h3>
          <p className="sub" style={{ margin: 0 }}>Proposed awards routed for approval.</p>
        </div>
        <table className="tbl">
          <thead><tr><th>RFQ</th><th className="num">Size</th><th>Proposal</th><th>Flags</th><th /></tr></thead>
          <tbody>
            {data.queue.map((r) => (
              <tr key={r.rfqId}>
                <td><span className="mono t-strong">{r.rfqRef}</span><div className="t-faint">{r.title}</div></td>
                <td className="num">{fmtMoneyFull(r.notionalMinor, r.ccy)}</td>
                <td className="mono">{r.award.kind === 'blended' ? 'Blended' : 'Single'} @ {fmtPrice(r.award.blendedPrice)}</td>
                <td>{r.award.flags.length || r.exceptions.length ? <span className="badge badge-warn">{r.award.flags.length + r.exceptions.length}</span> : <span className="t-faint">—</span>}</td>
                <td><Link href={`/approvals/${r.rfqId}`} className="btn btn-sm btn-primary">Open</Link></td>
              </tr>
            ))}
            {data.queue.length === 0 && <tr><td colSpan={5}><div className="empty">No RFQs awaiting approval.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function OpsPanel({ data }: { data: Extract<DashboardData, { role: 'ops' }> }) {
  return (
    <>
      <div className="grid g4">
        <Kpi label="Captured trades" value={data.kpis.capturedTrades} note="Trades ready for handoff" tone={data.kpis.capturedTrades ? 'k-warn' : undefined} />
        <Kpi label="Active handoffs" value={data.kpis.activeHandoffs} note="Handoffs not yet affirmed" tone={data.kpis.activeHandoffs ? 'k-warn' : undefined} />
        <Kpi label="Affirmed trades" value={data.kpis.affirmedTrades} note="Trades marked affirmed" />
        <Kpi label="Open breaks" value={data.kpis.openHandoffExceptions} note="Open handoff exceptions" tone={data.kpis.openHandoffExceptions ? 'k-warn' : undefined} />
      </div>
      <div className="grid g2">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px' }}><h3 style={{ margin: 0 }}>Trade queue</h3><p className="sub" style={{ margin: 0 }}>Recent awarded trade legs.</p></div>
          <table className="tbl">
            <thead><tr><th>Trade</th><th>RFQ</th><th className="num">Allocation</th><th>Status</th></tr></thead>
            <tbody>
              {data.trades.map((t) => (
                <tr key={t.tradeId}>
                  <td><span className="mono t-strong">{t.tradeRef}</span><div className="t-faint">{t.dealerName}</div></td>
                  <td className="mono t-muted">{t.publicRef}</td>
                  <td className="num">{t.pct}% · {fmtMoneyFull(t.allocNotionalMinor, t.ccy)}</td>
                  <td><Pill status={t.status} /></td>
                </tr>
              ))}
              {data.trades.length === 0 && <tr><td colSpan={4}><div className="empty">No trades captured yet.</div></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px' }}><h3 style={{ margin: 0 }}>STP handoffs</h3><p className="sub" style={{ margin: 0 }}>Recent persisted handoff records.</p></div>
          <table className="tbl">
            <thead><tr><th>Handoff</th><th>RFQ</th><th>Breaks</th><th>Status</th></tr></thead>
            <tbody>
              {data.handoffs.map((h) => (
                <tr key={h.handoffId}>
                  <td><span className="mono t-strong">{h.handoffRef}</span><div className="t-faint">{fmtDateTime(h.sentAt)}</div></td>
                  <td className="mono t-muted">{h.publicRef}</td>
                  <td>{h.exceptions.filter((e) => e.open).length || <span className="t-faint">—</span>}</td>
                  <td><Pill status={h.status} /></td>
                </tr>
              ))}
              {data.handoffs.length === 0 && <tr><td colSpan={4}><div className="empty">No handoffs yet.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <Link href="/ops" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Open STP workspace</Link>
    </>
  );
}

function CompliancePanel({ data }: { data: Extract<DashboardData, { role: 'compliance' }> }) {
  return (
    <>
      <div className="grid g4">
        <Kpi label="Reviewable RFQs" value={data.kpis.reviewableRfqs} note="RFQs in best-ex review states" />
        <Kpi label="Open exceptions" value={data.kpis.openExceptions} note="Open compliance exceptions" tone={data.kpis.openExceptions ? 'k-warn' : undefined} />
        <Kpi label="Concentration breaches" value={data.kpis.concentrationBreaches} note="Dealers above 35% trailing share" tone={data.kpis.concentrationBreaches ? 'k-warn' : undefined} />
        <Kpi label="Recent events" value={data.kpis.recentEvents} note="Tenant event-log rows returned" />
      </div>
      <div className="grid g2">
        <div className="card">
          <h3>Open &amp; recent exceptions</h3>
          <p className="sub">Compliance exceptions across reviewable RFQs.</p>
          {data.overview.exceptions.length === 0 ? <div className="empty">No compliance exceptions.</div> : (
            <div className="grid" style={{ gap: 8 }}>
              {data.overview.exceptions.slice(0, 6).map((e) => (
                <div key={e.id} className={`flag ${e.open ? 'flag-warn' : 'flag-info'}`}>
                  <Icon name={e.open ? 'alert' : 'doc'} size={15} />
                  <span><span className="mono t-strong">{e.ref}</span> · {e.text}<div className="t-faint">{e.rfqRef ?? e.publicRef ?? 'No RFQ'} · {e.status}</div></span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3>Dealer concentration</h3>
          <p className="sub">Trailing-90-day awarded share, indicative USD basis.</p>
          {data.overview.concentration.length === 0 ? <div className="empty">No USD awarded trades in the window.</div> : (
            <div className="grid" style={{ gap: 8 }}>
              {data.overview.concentration.slice(0, 5).map((c) => (
                <div key={c.dealerFirmId} className="cbar">
                  <span className="t-strong">{c.dealerName}</span>
                  <div className="c-track"><div className="c-cap" /><div className="c-fill" style={{ width: `${Math.min(100, c.shareBps / 100)}%`, background: c.shareBps > CONCENTRATION_FLAG_THRESHOLD_BPS ? 'var(--amber)' : 'var(--accent)' }} /></div>
                  <span className="mono">{fmtShare(c.shareBps)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="btn-row" style={{ marginTop: 12 }}><Link href="/compliance" className="btn btn-primary">Open compliance workspace</Link></div>
        </div>
      </div>
    </>
  );
}

function AdminPanel({ data }: { data: Extract<DashboardData, { role: 'admin' }> }) {
  return (
    <>
      <div className="grid g4">
        <Kpi label="Active users" value={data.kpis.activeUsers} note="Users in this tenant" />
        <Kpi label="Bank panels" value={data.kpis.bankPanels} note="Configured dealer groups" />
        <Kpi label="Dealer firms" value={data.kpis.dealerFirms} note="Available dealer directory entries" />
        <Kpi label="Recent events" value={data.kpis.recentEvents} note="Tenant audit rows returned" />
      </div>
      <div className="grid g2">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px' }}><h3 style={{ margin: 0 }}>Users</h3><p className="sub" style={{ margin: 0 }}>Read-only tenant roster.</p></div>
          <table className="tbl">
            <thead><tr><th>User</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              {data.overview.users.map((u) => (
                <tr key={u.id}><td>{u.fullName}<div className="t-faint">{u.email}</div></td><td>{u.role}</td><td><span className={`badge ${u.active ? '' : 'badge-warn'}`}>{u.active ? 'active' : 'inactive'}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px' }}><h3 style={{ margin: 0 }}>Recent audit events</h3><p className="sub" style={{ margin: 0 }}>Append-only tenant event log.</p></div>
          <table className="tbl">
            <thead><tr><th>Time</th><th>Actor</th><th>Event</th></tr></thead>
            <tbody>
              {data.overview.events.slice(0, 6).map((e) => (
                <tr key={e.id}><td className="mono t-faint">{fmtDateTime(e.createdAt)}</td><td>{e.actorLabel}</td><td className="t-muted">{e.summary}</td></tr>
              ))}
              {data.overview.events.length === 0 && <tr><td colSpan={3}><div className="empty">No events recorded.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <Link href="/admin" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Open administration</Link>
    </>
  );
}

function RolePanel({ data }: { data: DashboardData }) {
  switch (data.role) {
    case 'trader': return <TraderPanel data={data} />;
    case 'approver': return <ApproverPanel data={data} />;
    case 'ops': return <OpsPanel data={data} />;
    case 'compliance': return <CompliancePanel data={data} />;
    case 'admin': return <AdminPanel data={data} />;
  }
}

export default async function DashboardPage() {
  const caller = await resolveUser();
  if (caller.kind !== 'user') return null;

  const data = await getDashboard(caller.firmId, caller.role);

  return (
    <>
      <DashboardHeader label={caller.label} role={caller.role} />
      <RolePanel data={data} />
    </>
  );
}
