// app/(app)/approvals/page.tsx — approver queue. Server component; tenant-
// scoped via resolveUser().firmId. Layout already redirects anonymous, but
// we still gate by role here (a non-approver user is authenticated but should
// see a "not authorized" notice rather than a blank page).
import Link from 'next/link';
import { resolveUser } from '@/lib/auth/caller';
import { getApprovalQueue } from '@/lib/queries/approvals';
import { Pill, fmtMoney, Icon } from '@/components/ui';

function relativeTime(d: Date): string {
  const diffMs = d.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 60_000) return rtf.format(Math.round(diffMs / 1000), 'second');
  if (abs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(diffMs / 3_600_000), 'hour');
  return rtf.format(Math.round(diffMs / 86_400_000), 'day');
}

export default async function ApprovalsPage() {
  const caller = await resolveUser();
  if (caller.kind !== 'user') return null; // layout redirects anonymous
  if (caller.role !== 'approver') {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Not authorized</h2>
        <p className="t-faint">
          The approval workspace is restricted to users with the approver role.
        </p>
      </div>
    );
  }

  const rows = await getApprovalQueue(caller.firmId);

  return (
    <>
      <div className="row">
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Approval queue</h2>
          <div className="t-faint">
            {rows.length} RFQ{rows.length === 1 ? '' : 's'} awaiting your approval
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <div className="empty">No RFQs awaiting your approval.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((r) => {
            const warnCount = r.award.flags.filter((f) => f.severity === 'warn').length;
            const infoCount = r.award.flags.filter((f) => f.severity === 'info').length;
            return (
              <div key={r.rfqId} className="card">
                <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="mono t-strong">{r.rfqRef}</span>
                      <Pill status="awaiting_approval" />
                    </div>
                    <h3 style={{ margin: '6px 0 2px' }}>{r.title}</h3>
                    <div className="t-faint">
                      {r.underlying} · {fmtMoney(r.notionalMinor, r.ccy)} · recommended{' '}
                      {relativeTime(r.recommendedAt)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {warnCount > 0 && (
                      <span className="badge badge-warn">
                        <Icon name="alert" size={12} /> {warnCount} warn
                      </span>
                    )}
                    {infoCount > 0 && (
                      <span className="badge">{infoCount} info</span>
                    )}
                    {r.exceptions.length > 0 && (
                      <span className="badge badge-warn">
                        {r.exceptions.length} open exception{r.exceptions.length === 1 ? '' : 's'}
                      </span>
                    )}
                    <Link href={`/approvals/${r.rfqId}`} className="btn btn-primary btn-sm">
                      Open
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
