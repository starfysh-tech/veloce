// app/(app)/approvals/[id]/page.tsx — approver detail view. Server component;
// approver-only. Fetches the tenant-scoped approval detail, resolves dealer
// firm ids to names (the detail query intentionally does not), and hands the
// data to the client-side actions panel.
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { inArray, eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { firms, rfqs } from '@/db/schema';
import { resolveUser } from '@/lib/auth/caller';
import { getApprovalDetail } from '@/lib/queries/approvals';
import { requiresCommitteeNote } from '@/lib/policy';
import { Pill, fmtMoney, fmtMoneyFull, fmtPrice, Icon } from '@/components/ui';
import { ApprovalActions } from './actions-panel';

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const caller = await resolveUser();
  if (caller.kind !== 'user') return null;
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

  const detail = await getApprovalDetail(caller.firmId, id);
  if (!detail) notFound();

  // Pull the extra rfq metadata (side/strike/expiry/tenor) — not surfaced by
  // getApprovalDetail. Tenant-scoped via firmId predicate (defense-in-depth;
  // detail already verified firm ownership).
  const rfqRow = (
    await db
      .select({
        side: rfqs.side,
        strike: rfqs.strike,
        expiry: rfqs.expiry,
        tenor: rfqs.tenor,
      })
      .from(rfqs)
      .where(and(eq(rfqs.id, id), eq(rfqs.firmId, caller.firmId)))
  )[0];

  // Resolve dealer firm ids → names for allocations. Quote ladder already
  // carries dealerName via the firms left-join in quoteLadderQuery.
  const dealerIds = Array.from(
    new Set(detail.award.allocations.map((a) => a.dealerFirmId)),
  );
  const dealerRows = dealerIds.length
    ? await db
        .select({ id: firms.id, name: firms.name })
        .from(firms)
        .where(inArray(firms.id, dealerIds))
    : [];
  const dealerNameById = new Map(dealerRows.map((d) => [d.id, d.name]));

  const warnFlags = detail.award.flags
    .filter((f) => f.severity === 'warn')
    .map((f) => ({ id: f.id, text: f.text }));
  const needsCommitteeNote = requiresCommitteeNote(detail.notionalMinor);

  const fmtSavingsDollars = (minor: number | null) =>
    minor == null ? null : fmtMoneyFull(minor, detail.ccy);

  return (
    <>
      <div className="row">
        <Link href="/approvals" className="btn btn-ghost btn-sm">
          ← Queue
        </Link>
      </div>

      {/* Header */}
      <div className="card">
        <div className="row" style={{ gap: 8 }}>
          <span className="mono t-faint">{detail.rfqRef}</span>
          <Pill status="awaiting_approval" />
        </div>
        <h2 style={{ margin: '6px 0 4px' }}>{detail.title}</h2>
        <div className="meta">
          {detail.underlying} · {fmtMoney(detail.notionalMinor, detail.ccy)}
        </div>
        <hr className="hr" />
        <div className="spec">
          {(
            [
              ['Underlying', detail.underlying],
              ['Side', rfqRow?.side],
              ['Strike', rfqRow?.strike],
              ['Expiry', rfqRow?.expiry],
              ['Tenor', rfqRow?.tenor],
              ['Notional', fmtMoneyFull(detail.notionalMinor, detail.ccy)],
            ] as const
          )
            .filter(([, v]) => v)
            .map(([l, v]) => (
              <div key={l}>
                <div className="s-label">{l}</div>
                <div className="s-val">{v}</div>
              </div>
            ))}
        </div>
      </div>

      {/* $250M committee banner */}
      {needsCommitteeNote && (
        <div className="card card-tight">
          <div className="flag flag-warn">
            <Icon name="alert" size={15} />
            <span>
              Notional exceeds $250M — two-person committee approval required.
              Pilot enforces a single-approver acknowledgement note instead;
              record committee sign-off in the note below.
            </span>
          </div>
        </div>
      )}

      {/* Award summary */}
      <div className="card">
        <div className="row">
          <div>
            <h3 style={{ margin: 0 }}>Award summary</h3>
            <p className="sub" style={{ margin: 0 }}>
              {detail.award.kind === 'blended'
                ? 'Best blended construction'
                : 'Best single dealer'}
            </p>
          </div>
          <span className="spacer" />
          <div className="q-price" style={{ fontSize: 22 }}>
            {fmtPrice(detail.award.blendedPrice)}
          </div>
        </div>
        {detail.award.bestSinglePrice && (
          <>
            <hr className="hr" />
            <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div className="s-label">Best single price</div>
                <div className="s-val mono">
                  {fmtPrice(detail.award.bestSinglePrice)}
                </div>
              </div>
              {detail.award.savingsBps && (
                <div>
                  <div className="s-label">Savings vs best single</div>
                  <div className="s-val">
                    −{Number(detail.award.savingsBps).toFixed(1)} bps
                    {detail.award.savingsMinor != null && (
                      <span className="t-faint">
                        {' '}
                        · {fmtSavingsDollars(detail.award.savingsMinor)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        {detail.award.rationale && (
          <>
            <hr className="hr" />
            <div className="s-label">Rationale</div>
            <div
              className="t-muted"
              style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}
            >
              {detail.award.rationale}
            </div>
          </>
        )}
      </div>

      {/* Allocations table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px' }}>
          <h3 style={{ margin: 0 }}>Allocations</h3>
          <p className="sub" style={{ margin: 0 }}>
            Proposed dealer fills · {detail.award.allocations.length} dealer
            {detail.award.allocations.length === 1 ? '' : 's'}
          </p>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Dealer</th>
              <th className="num">Share</th>
              <th className="num">Price</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {detail.award.allocations.map((a, i) => {
              const deviates =
                detail.award.bestSinglePrice != null &&
                a.price !== detail.award.bestSinglePrice;
              return (
                <tr key={`${a.dealerFirmId}-${i}`}>
                  <td>{dealerNameById.get(a.dealerFirmId) ?? a.dealerFirmId}</td>
                  <td className="num mono">{a.pct}%</td>
                  <td className="num mono">{fmtPrice(a.price)}</td>
                  <td>
                    {deviates && (
                      <span className="badge badge-warn">best-ex deviation</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Quote ladder */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px' }}>
          <h3 style={{ margin: 0 }}>Archived quote ladder</h3>
          <p className="sub" style={{ margin: 0 }}>
            Best-execution evidence at recommend time
          </p>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Dealer</th>
              <th className="num">Price</th>
              <th className="num">Max size</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {detail.quoteLadder.map((q, i) => (
              <tr key={`${q.dealerFirmId}-${i}`}>
                <td>{q.dealerName || q.dealerFirmId}</td>
                <td className="num mono">{fmtPrice(q.price)}</td>
                <td className="num mono">{q.pct}%</td>
                <td className="t-muted" style={{ whiteSpace: 'pre-wrap' }}>
                  {q.note}
                </td>
              </tr>
            ))}
            {!detail.quoteLadder.length && (
              <tr>
                <td colSpan={4}>
                  <div className="empty">No archived quotes.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Flags */}
      {detail.award.flags.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Policy flags</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {detail.award.flags.map((f) => (
              <div
                key={f.id}
                className={`flag ${f.severity === 'warn' ? 'flag-warn' : 'flag-info'}`}
              >
                <Icon name={f.severity === 'warn' ? 'alert' : 'shield'} size={15} />
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open exceptions */}
      {detail.exceptions.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Open exceptions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {detail.exceptions.map((e) => (
              <div key={e.id} className="flag flag-warn">
                <Icon name="alert" size={15} />
                <div>
                  <div className="mono t-strong" style={{ fontSize: 12 }}>
                    {e.ref}
                  </div>
                  <div>{e.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action panel (client) */}
      <ApprovalActions
        rfqId={detail.rfqId}
        firmName={caller.label}
        warnFlags={warnFlags}
        requiresCommitteeNote={needsCommitteeNote}
        awardRefForToast={detail.rfqRef}
      />
    </>
  );
}
