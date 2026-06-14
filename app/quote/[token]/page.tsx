// app/quote/[token]/page.tsx — dealer response page.
// TOP-LEVEL route, deliberately outside the (app) group: dealers have no
// Supabase session, they authenticate by opaque capability token (Decision 10).
// Shows full instrument economics + term sheet, the dealer's own quote, and
// rank-only blind feedback. Never competitor identities, levels, or the
// invited-dealer list.
import { notFound } from 'next/navigation';
import { resolveDealerToken } from '@/lib/auth/caller';
import { getDealerView } from '@/lib/queries/dealer-view';
import { Pill, notionalLabel, fmtPrice } from '@/components/ui';
import { DealerForm } from './form';

export default async function DealerQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const caller = await resolveDealerToken(token);
  if (caller.kind !== 'dealer') notFound();

  const view = await getDealerView(caller, caller.rfqId);
  if (!view) notFound();
  const { rfq, own, dealerFirm, isOpen } = view;

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '28px 20px' }}>
      {/* dealer-facing header — distinct from the buy-side shell */}
      <div className="row" style={{ marginBottom: 18 }}>
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></svg>
          </div>
          <div>
            <div className="brand-name">VELOCE</div>
            <div className="brand-sub">Dealer Response</div>
          </div>
        </div>
        <span className="spacer" />
        {dealerFirm && <span className="note">Responding as <b>{dealerFirm.name}</b></span>}
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
            <div className="meta">{rfq.product} · {notionalLabel(rfq)} · {rfq.mode === 'split' ? 'Partial participation permitted' : 'Full size only'}</div>
          </div>
        </div>
        <hr className="hr" />
        <div className="spec">
          {[
            ['Side', rfq.side], ['Underlying', rfq.underlying], ['Reference', rfq.refLevel],
            ['Strike', rfq.strike], ['Expiry', rfq.expiry], ['Style', rfq.style],
            ['Tenor', rfq.tenor], ['Notional', notionalLabel(rfq)], ['Quote convention', rfq.quoteUnit],
          ].map(([l, v]) => (
            <div key={l as string}><div className="s-label">{l}</div><div className="s-val">{v}</div></div>
          ))}
        </div>
      </div>

      <div style={{ height: 16 }} />

      <DealerForm
        token={token}
        quoteUnit={rfq.quoteUnit}
        mode={rfq.mode}
        isOpen={isOpen}
        deadline={rfq.deadline ? new Date(rfq.deadline).getTime() : null}
        existing={own ? { price: own.price, pct: own.pct, note: own.note } : null}
      />

      <p className="note" style={{ textAlign: 'center', marginTop: 18 }}>
        This is a blind auction. You see only your own quote. Competitor identities and levels are never shown.
      </p>
    </div>
  );
}
