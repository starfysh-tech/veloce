// app/(app)/rfqs/[id]/board-live.tsx — interactive quote board.
// Renders the pre-masked board, the single-vs-blended comparison, and the
// award action. Subscribes to Supabase Realtime purely as a signal: on any
// quote change it re-fetches the masked board from /board (Decision 18). The
// Realtime payload itself is never trusted as data.
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BlendBar, BankDot, type Dealer } from '@/components/board';
import { Icon, fmtPrice, fmtMoneyFull } from '@/components/ui';
import { recommendAwardAction } from './actions';

type MaskedQuote = {
  id: string; dealerFirmId: string | null; price: string | null; pct: number | null;
  note: string | null; submittedAt: string | Date; isOwn: boolean; masked: boolean;
};
type Board = { quotes: MaskedQuote[]; ownRank?: number; responderCount: number; fullVisibility: boolean };
type Comparison = {
  single: { dealerFirmId: string; price: string } | null;
  blend: { fills: { dealerFirmId: string; price: string; take: number }[]; blendedPrice: string } | null;
  savings: { bps: number; minor: number } | null;
} | null;

export function QuoteBoardLive({
  rfqId, initialBoard, initialComparison, award, dealers, quoteUnit, notionalMinor, ccy, deadline, status, canRecommend,
}: {
  rfqId: string; initialBoard: Board; initialComparison: Comparison; award: unknown;
  dealers: Record<string, Dealer>; quoteUnit: string; notionalMinor: number; ccy: string;
  deadline: number | null; status: string; canRecommend: boolean;
}) {
  const router = useRouter();
  const [board, setBoard] = useState(initialBoard);
  const [comparison, setComparison] = useState(initialComparison);
  const [mode, setMode] = useState<'single' | 'blended'>('blended');
  const [now, setNow] = useState(() => Date.now());
  const [pending, setPending] = useState(false);

  // Countdown clock (client-only render off stored deadline).
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);

  // Refetch the masked board through the server projection.
  const refetch = useCallback(async () => {
    const res = await fetch(`/rfqs/${rfqId}/board`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setBoard(data.board);
      setComparison(data.comparison);
    }
  }, [rfqId]);

  // Realtime as signal: any quote change for this RFQ triggers a refetch.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`rfq-${rfqId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'quotes', filter: `rfq_id=eq.${rfqId}` },
        () => { refetch(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [rfqId, refetch]);

  const left = deadline ? Math.max(0, deadline - now) : 0;
  const isLive = status === 'live' && left > 0;

  return (
    <>
      {/* countdown */}
      {deadline && (
        <div className="card card-tight">
          <div className="row">
            <span className="note" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {isLive ? 'Auction closes in' : 'Auction window'}
            </span>
            <span className="spacer" />
            <span className="cd-time mono" style={{ color: isLive && left < 120000 ? 'var(--red)' : 'var(--accent)' }}>
              {isLive ? `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}` : 'CLOSED'}
            </span>
          </div>
        </div>
      )}

      {/* quote board */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="qboard" style={{ border: 'none' }}>
          <div className="qboard-head">
            <h3 style={{ margin: 0 }}>Quote board</h3>
            <span className="note">{board.responderCount} responded · sorted by level · quoting {quoteUnit}</span>
            <span className="spacer" />
            {isLive && <span className="pill pill-live">Auction open</span>}
          </div>
          {board.quotes.map((q) => {
            const d = q.dealerFirmId ? dealers[q.dealerFirmId] : null;
            const isBest = comparison?.single && q.dealerFirmId === comparison.single.dealerFirmId && q.price === comparison.single.price;
            return (
              <div key={q.id} className={`quote-row ${isBest ? 'best' : ''}`}>
                <div className="bank-cell">
                  <BankDot color={d?.colorHex ?? null} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{q.masked ? 'Masked dealer' : d?.name ?? 'Dealer'}{q.isOwn ? ' (you)' : ''}</div>
                  </div>
                </div>
                <div className="t-muted" style={{ fontSize: 12 }}>{q.note}</div>
                <div>
                  <div className="q-price">{q.price ? fmtPrice(q.price, quoteUnit) : '—'}</div>
                  {isBest && <div className="q-best-tag">BEST FULL SIZE</div>}
                </div>
                <div className="pct-wrap">
                  {q.pct != null && (
                    <>
                      <div className="pct-bar"><i style={{ display: 'block', width: `${q.pct}%`, background: q.pct === 100 ? 'var(--accent)' : 'var(--amber)' }} /></div>
                      <span className="pct-label">{q.pct === 100 ? 'Full size' : `Up to ${q.pct}%`}</span>
                    </>
                  )}
                </div>
                <div className="t-faint" style={{ fontSize: 11.5 }}>
                  {q.pct === 100 ? fmtMoneyFull(notionalMinor, ccy) : q.pct ? `${fmtMoneyFull(notionalMinor * q.pct / 100, ccy)} max` : ''}
                </div>
              </div>
            );
          })}
          {!board.quotes.length && <div className="empty">No quotes visible.</div>}
        </div>
      </div>

      {/* dealer rank (blind feedback) */}
      {!board.fullVisibility && board.ownRank && (
        <div className="card card-tight">
          <div className="flag flag-info"><Icon name="shield" size={15} /> <span>Your quote ranks #{board.ownRank} of {board.responderCount} by level. Competitor identities and levels stay hidden in this blind auction.</span></div>
        </div>
      )}

      {/* comparison — buy-side only */}
      {comparison && (comparison.single || comparison.blend) && (
        <div className="card">
          <div className="row">
            <div><h3 style={{ margin: 0 }}>Award construction</h3><p className="sub" style={{ margin: 0 }}>Best single bank vs best blended allocation</p></div>
            <span className="spacer" />
            <div className="mode-toggle">
              <button className={mode === 'single' ? 'on' : ''} onClick={() => setMode('single')}>Best single</button>
              <button className={mode === 'blended' ? 'on' : ''} onClick={() => setMode('blended')}>Best blended</button>
            </div>
          </div>
          <hr className="hr" />
          {mode === 'single' && comparison.single && (
            <BlendBar fills={[{ dealerFirmId: comparison.single.dealerFirmId, take: 100, price: comparison.single.price }]} unit={quoteUnit} dealers={dealers} />
          )}
          {mode === 'blended' && comparison.blend && (
            <>
              <BlendBar fills={comparison.blend.fills} unit={quoteUnit} dealers={dealers} />
              {comparison.savings && comparison.savings.bps > 0.01 && (
                <div className="delta-box" style={{ marginTop: 12 }}>
                  <div className="note" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>Blended vs best single bank</div>
                  <div className="d-big">−{comparison.savings.bps.toFixed(1)} bps <span style={{ fontSize: 14 }}>· saves {fmtMoneyFull(comparison.savings.minor, ccy)}</span></div>
                  <div className="note" style={{ marginTop: 6, color: 'var(--text)' }}>
                    Dealers willing to take part of the size quote tighter than full-size levels. Synchronized competition stacks those partials until 100% is covered — liquidity an email process can&apos;t aggregate.
                  </div>
                </div>
              )}
            </>
          )}
          {canRecommend && comparison.single && comparison.blend && (
            <>
              <hr className="hr" />
              <div className="row">
                <span className="note">Routes the {mode} construction to the Treasury Committee with the archived ladder attached.</span>
                <span className="spacer" />
                <button className="btn btn-primary" disabled={pending}
                  onClick={async () => { setPending(true); await recommendAwardAction(rfqId, mode); router.refresh(); }}>
                  {pending ? 'Routing…' : 'Recommend this award'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
