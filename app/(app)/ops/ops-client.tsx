// app/(app)/ops/ops-client.tsx — interactive surface for the Ops workspace.
// Pure client component: data flows in as props from page.tsx; mutations call
// the server actions which re-fetch via router.refresh() on success.
'use client';
import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pill, Icon, fmtMoneyFull, fmtPrice } from '@/components/ui';
import { generateHandoff, advanceHandoff, openException, closeException } from './actions';
import type { OpsTradeRow, OpsHandoffRow } from '@/lib/queries/ops';

type EligibleHandoff = {
  rfqId: string;
  rfqRef: string;
  publicRef: string;
  rfqTitle: string;
  legCount: number;
};

export default function OpsClient({
  trades,
  handoffs,
  eligibleHandoffs,
}: {
  trades: OpsTradeRow[];
  handoffs: OpsHandoffRow[];
  eligibleHandoffs: EligibleHandoff[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [previewHandoffId, setPreviewHandoffId] = useState<string | null>(null);
  const [flagFor, setFlagFor] = useState<string | null>(null);
  const [flagText, setFlagText] = useState('');

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const preview = previewHandoffId
    ? handoffs.find((h) => h.handoffId === previewHandoffId) ?? null
    : null;

  return (
    <>
      {error && (
        <div className="card" style={{ borderColor: 'var(--warn)', marginBottom: 12 }}>
          <strong>Couldn’t complete the action.</strong> {error}
        </div>
      )}

      {eligibleHandoffs.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 4 }}>Ready for capture</h3>
          <p className="sub">
            Awarded RFQs with trades not yet handed off. Generate a capture payload to
            move them into the affirmation lifecycle.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {eligibleHandoffs.map((e) => (
              <div key={e.rfqId} className="row" style={{ gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <span className="mono t-strong">{e.publicRef}</span>{' '}
                  <span className="t-muted">· {e.rfqTitle} · {e.legCount} leg{e.legCount === 1 ? '' : 's'}</span>
                </div>
                <button
                  className="btn btn-sm btn-primary"
                  disabled={pending}
                  onClick={() => run(() => generateHandoff({ rfqId: e.rfqId }))}
                >
                  Generate handoff
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3>Approved trade economics</h3>
        <p className="sub">Every awarded allocation becomes a discrete trade with its own capture record.</p>
        {trades.length === 0 ? (
          <p className="t-faint">No trades captured yet.</p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Trade</th>
                <th>RFQ</th>
                <th>Dealer</th>
                <th className="num">Allocation</th>
                <th className="num">Level</th>
                <th>Settlement</th>
                <th>UTI</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.tradeId}>
                  <td className="mono t-strong">{t.tradeRef}</td>
                  <td className="mono t-muted">{t.publicRef}</td>
                  <td>{t.dealerName}</td>
                  <td className="num">{t.pct}% · {fmtMoneyFull(t.allocNotionalMinor, t.ccy)}</td>
                  <td className="num t-strong">{fmtPrice(t.price, t.priceUnit)}</td>
                  <td className="t-muted">{t.settle ?? '—'}</td>
                  <td className="mono t-faint" style={{ fontSize: 10.5 }}>{t.uti ?? '—'}</td>
                  <td><Pill status={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>STP handoffs &amp; affirmation</h3>
        <p className="sub">
          Capture payloads sent to the affirmation channel — advance status to simulate matching.
          Per Decision 12 the payload is persisted and previewable but never transmitted.
        </p>
        {handoffs.length === 0 ? (
          <p className="t-faint">No handoffs yet.</p>
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            {handoffs.map((h) => {
              const openCount = h.exceptions.filter((e) => e.open).length;
              const canAdvance = h.status !== 'affirmed';
              const nextLabel = h.status === 'sent' ? 'Mark matched' : 'Mark affirmed';
              const nextTo = h.status === 'sent' ? 'matched' : 'affirmed';
              return (
                <div key={h.handoffId} className="card card-tight" style={{ background: 'var(--surface-2)' }}>
                  <div className="row">
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div className="row" style={{ gap: 8 }}>
                        <span className="mono t-strong">{h.handoffRef}</span>
                        <Pill status={h.status} />
                      </div>
                      <div className="t-faint" style={{ marginTop: 3 }}>
                        {h.publicRef} · {h.rfqTitle} · {h.legs.length} leg{h.legs.length === 1 ? '' : 's'} ·{' '}
                        {h.channel} · sent {h.sentAt.toISOString().slice(0, 16).replace('T', ' ')}
                      </div>
                    </div>
                    <div className="btn-row">
                      <button className="btn btn-sm" onClick={() => setPreviewHandoffId(h.handoffId)}>
                        <Icon name="doc" size={13} /> View payload
                      </button>
                      {canAdvance && (
                        <button
                          className="btn btn-sm btn-primary"
                          disabled={pending}
                          onClick={() =>
                            run(() => advanceHandoff({ handoffId: h.handoffId, to: nextTo as 'matched' | 'affirmed' }))
                          }
                        >
                          {nextLabel}
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => {
                          setFlagFor(h.handoffId);
                          setFlagText('');
                        }}
                      >
                        Flag exception
                      </button>
                    </div>
                  </div>

                  {h.exceptions.length > 0 && (
                    <div className="grid" style={{ gap: 6, marginTop: 10 }}>
                      {h.exceptions.map((e) => (
                        <div
                          key={e.id}
                          className={`flag ${e.open ? 'flag-warn' : 'flag-ok'}`}
                          style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                          <Icon name={e.open ? 'alert' : 'check'} size={14} />
                          <span style={{ flex: 1 }}>
                            {e.text}
                            {e.open ? '' : ' (resolved)'}
                          </span>
                          {e.open && (
                            <button
                              className="btn btn-sm btn-ghost"
                              disabled={pending}
                              onClick={() => run(() => closeException({ exceptionId: e.id }))}
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {openCount > 0 && h.status !== 'affirmed' && (
                    <p className="t-faint" style={{ marginTop: 8, fontSize: 11 }}>
                      Open exceptions block the rfq from flipping to affirmed when this handoff lands.
                    </p>
                  )}

                  {flagFor === h.handoffId && (
                    <div className="row" style={{ marginTop: 10, gap: 6 }}>
                      <input
                        type="text"
                        style={{ flex: 1 }}
                        placeholder="Describe the break (SSI, economics, doc mismatch…)"
                        value={flagText}
                        onChange={(ev) => setFlagText(ev.target.value)}
                      />
                      <button
                        className="btn btn-sm btn-primary"
                        disabled={!flagText.trim() || pending}
                        onClick={() => {
                          const text = flagText;
                          run(async () => {
                            await openException({ handoffId: h.handoffId, text });
                            setFlagFor(null);
                            setFlagText('');
                          });
                        }}
                      >
                        Add
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setFlagFor(null)}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flag flag-info" style={{ marginTop: 12 }}>
          <Icon name="flow" size={15} />
          <span>
            In production, payloads flow to MarkitWire / DTCC or the client’s OMS via FIX or
            API. The demo persists representative FpML-style JSON but never transmits it
            (Decision 12).
          </span>
        </div>
      </div>

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewHandoffId(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
          }}
        >
          <div
            onClick={(ev) => ev.stopPropagation()}
            className="card"
            style={{ maxWidth: 720, width: '90%', maxHeight: '85vh', overflow: 'auto' }}
          >
            <div className="row" style={{ marginBottom: 6 }}>
              <h3 style={{ flex: 1, margin: 0 }}>Capture payload — {preview.handoffRef}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setPreviewHandoffId(null)}>
                <Icon name="x" size={14} />
              </button>
            </div>
            <p className="note" style={{ marginTop: 0 }}>
              {preview.payloadLabel ?? 'FpML 5.12 (representative)'} · {preview.channel}
            </p>
            <pre className="payload" style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {JSON.stringify(preview.payload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
