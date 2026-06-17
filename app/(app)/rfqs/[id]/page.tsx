// app/(app)/rfqs/[id]/page.tsx — RFQ detail. Server component: resolves the
// caller, fetches the masked board through the server projection, and hands the
// already-masked data to the interactive board client (Decision 11, 18).
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { resolveUser } from '@/lib/auth/caller';
import { getBoard } from '@/lib/queries/board';
import { canUploadRfqAttachment, listAttachmentsWithUrls } from '@/lib/storage';
import { Pill, notionalLabel } from '@/components/ui';
import { AttachmentsPanel } from './attachments-panel';
import { QuoteBoardLive } from './board-live';

export default async function RfqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await resolveUser();
  if (caller.kind !== 'user') return null;

  const data = await getBoard(caller, id);
  if (!data) notFound();
  const { rfq, board, comparison, award, dealers, invitedCount } = data;
  const attachments = await listAttachmentsWithUrls(caller, rfq.id);

  return (
    <>
      <div className="row">
        <Link href="/rfqs" className="btn btn-ghost btn-sm">← Blotter</Link>
      </div>

      <div className="card">
        <div className="detail-head">
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="mono t-faint">{rfq.ref}</span>
              <Pill status={rfq.status} />
              {rfq.blind && <span className="badge">BLIND</span>}
            </div>
            <h2>{rfq.title}</h2>
            <div className="meta">
              {rfq.product} · {notionalLabel(rfq)} · {invitedCount} dealers ·{' '}
              {rfq.mode === 'split' ? 'Split allocation permitted' : 'Full size only'}
            </div>
          </div>
        </div>
        <hr className="hr" />
        <div className="spec">
          {[
            ['Underlying', rfq.underlying], ['Reference', rfq.refLevel],
            ['Strike', rfq.strike], ['Expiry', rfq.expiry], ['Style', rfq.style],
            ['Side', rfq.side], ['Quote convention', rfq.quoteUnit],
          ].map(([l, v]) => (
            <div key={l as string}><div className="s-label">{l}</div><div className="s-val">{v}</div></div>
          ))}
        </div>
      </div>

      <AttachmentsPanel
        rfqId={rfq.id}
        attachments={attachments}
        canUpload={canUploadRfqAttachment(caller, rfq)}
      />

      <QuoteBoardLive
        rfqId={rfq.id}
        initialBoard={board}
        initialComparison={comparison}
        award={award}
        dealers={dealers}
        quoteUnit={rfq.quoteUnit}
        notionalMinor={rfq.notionalMinor}
        ccy={rfq.ccy}
        deadline={rfq.deadline ? new Date(rfq.deadline).getTime() : null}
        status={rfq.status}
        canRecommend={caller.role === 'trader' && ['live', 'under_review'].includes(rfq.status)}
      />
    </>
  );
}
