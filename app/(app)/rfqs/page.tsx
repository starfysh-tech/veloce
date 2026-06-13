// app/(app)/rfqs/page.tsx — the RFQ blotter. Server component: fetches
// tenant-scoped data and renders it. The caller's firmId is the only tenant
// boundary; no client-side filtering of other firms' data is possible because
// it never reaches the client.
import Link from 'next/link';
import { resolveUser } from '@/lib/auth/caller';
import { listRfqs } from '@/lib/queries/rfqs';
import { Pill, fmtMoney, notionalLabel } from '@/components/ui';
import { Countdown } from './countdown';

export default async function RfqsPage() {
  const caller = await resolveUser();
  if (caller.kind !== 'user') return null; // layout already redirects
  const rows = await listRfqs(caller.firmId);

  return (
    <>
      <div className="row">
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>RFQ Blotter</h2>
          <div className="t-faint">OTC equity derivatives · {rows.length} requests</div>
        </div>
        {(caller.role === 'trader' || caller.role === 'admin') && (
          <>
            <span className="spacer" />
            <Link href="/rfqs/new" className="btn btn-primary">Create RFQ</Link>
          </>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>RFQ</th><th>Product</th><th className="num">Size</th>
              <th>Panel</th><th>Deadline</th><th>Quotes</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="rowlink">
                <td>
                  <Link href={`/rfqs/${r.id}`} style={{ color: 'inherit' }}>
                    <span className="mono t-strong">{r.ref}</span>
                    <div className="t-faint">{r.title}</div>
                  </Link>
                </td>
                <td>{r.product}<div className="t-faint">{r.tenor} · {r.ccy}</div></td>
                <td className="num">{notionalLabel(r)}</td>
                <td className="t-muted">{r.invitedCount} dealers{r.blind ? ' · blind' : ''}</td>
                <td>{r.status === 'live' && r.deadline
                  ? <Countdown deadline={new Date(r.deadline).getTime()} />
                  : <span className="t-faint">{r.deadline ? 'Closed' : '—'}</span>}</td>
                <td className="mono t-muted">{r.quoteCount} / {r.invitedCount}</td>
                <td><Pill status={r.status} /></td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={7}><div className="empty">No RFQs yet. Create one to launch an auction.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
