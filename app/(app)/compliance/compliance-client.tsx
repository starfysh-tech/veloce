// app/(app)/compliance/compliance-client.tsx — read-only Compliance UI.
'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon, Pill, fmtDateTime, fmtMoneyFull, fmtPrice, notionalLabel } from '@/components/ui';
import type { ComplianceOverview } from '@/lib/queries/compliance';

type Tab = 'bestex' | 'exceptions' | 'concentration' | 'log';

function fmtShare(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

export default function ComplianceClient({ overview }: { overview: ComplianceOverview }) {
  const [tab, setTab] = useState<Tab>('bestex');

  return (
    <>
      <div className="row">
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Best-execution workspace</h2>
          <div className="t-faint">
            Evidence packs, exceptions, concentration, and append-only events.
          </div>
        </div>
      </div>

      <div className="tabs" role="tablist" style={{ marginTop: 12 }}>
        {([
          ['bestex', 'Best-Execution Evidence'],
          ['exceptions', 'Exceptions & Overrides'],
          ['concentration', 'Concentration'],
          ['log', 'Event Log'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? 'on' : ''}
            onClick={() => setTab(id)}
            role="tab"
            aria-selected={tab === id}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'bestex' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px' }}>
            <h3 style={{ margin: 0 }}>Best-execution evidence</h3>
            <p className="sub" style={{ margin: 0 }}>
              Latest stored quote ladder, award decision, exceptions, and event log exportable per RFQ.
            </p>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>RFQ</th>
                <th className="num">Size</th>
                <th>Responses</th>
                <th>Decision</th>
                <th>Exceptions</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {overview.bestEx.map((r) => (
                <tr key={r.rfqId}>
                  <td>
                    <Link href={`/rfqs/${r.rfqId}`} style={{ color: 'inherit' }}>
                      <span className="mono t-strong">{r.rfqRef}</span>
                      <div className="t-faint">{r.title}</div>
                    </Link>
                  </td>
                  <td className="num">{notionalLabel(r)}</td>
                  <td className="t-muted">{r.quoteCount} quote{r.quoteCount === 1 ? '' : 's'}</td>
                  <td>
                    {r.award ? (
                      <span className="mono">
                        {r.award.kind === 'blended' ? 'Blended' : 'Single'} @ {fmtPrice(r.award.blendedPrice, r.quoteUnit)}
                      </span>
                    ) : (
                      <span className="t-faint">Pending</span>
                    )}
                  </td>
                  <td>
                    {r.exceptionCount > 0 ? (
                      <span className="badge badge-warn">{r.exceptionCount}</span>
                    ) : (
                      <span className="t-faint">—</span>
                    )}
                  </td>
                  <td><Pill status={r.status} /></td>
                  <td>
                    <a className="btn btn-sm" href={`/compliance/export/${r.rfqId}`}>
                      <Icon name="doc" size={12} /> Export
                    </a>
                  </td>
                </tr>
              ))}
              {overview.bestEx.length === 0 && (
                <tr><td colSpan={7}><div className="empty">No reviewable RFQs yet.</div></td></tr>
              )}
            </tbody>
          </table>
          <div className="flag flag-info" style={{ margin: 12 }}>
            <Icon name="shield" size={15} />
            <span>Exports are read-only JSON downloads and do not append audit events.</span>
          </div>
        </div>
      )}

      {tab === 'exceptions' && (
        <div className="card">
          <h3>Exceptions &amp; overrides</h3>
          <p className="sub">Compliance exceptions only; STP handoff breaks stay in the Ops workspace.</p>
          {overview.exceptions.length === 0 ? (
            <div className="empty">No compliance exceptions.</div>
          ) : (
            <div className="grid" style={{ gap: 10 }}>
              {overview.exceptions.map((e) => (
                <div key={e.id} className="card card-tight" style={{ background: 'var(--surface-2)' }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="mono t-strong">{e.ref}</span>
                    {e.rfqId && (
                      <Link href={`/rfqs/${e.rfqId}`} className="btn btn-sm btn-ghost mono">
                        {e.rfqRef ?? e.publicRef ?? 'RFQ'} →
                      </Link>
                    )}
                    <span className="spacer" />
                    <span className={`badge ${e.open ? 'badge-warn' : ''}`}>{e.status}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12.5 }}>{e.text}</div>
                  <div className="note" style={{ marginTop: 4 }}>Opened {fmtDateTime(e.openedAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'concentration' && (
        <div className="card">
          <h3>Dealer concentration</h3>
          <p className="sub">Trailing-90-day awarded notional share — indicative, single-currency (USD) basis.</p>
          {overview.concentration.length === 0 ? (
            <div className="empty">No USD awarded trades in the trailing 90-day concentration window.</div>
          ) : (
            <div className="grid" style={{ gap: 10 }}>
              {overview.concentration.map((c) => (
                <div key={c.dealerFirmId}>
                  <div className="row" style={{ marginBottom: 4 }}>
                    <span className="t-strong">{c.dealerName}</span>
                    <span className="spacer" />
                    <span className="mono">{fmtShare(c.shareBps)}</span>
                    <span className="t-faint">· {fmtMoneyFull(c.notionalMinor, 'USD')}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, c.shareBps / 100)}%`, height: '100%', background: 'var(--accent)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flag flag-info" style={{ marginTop: 12 }}>
            <Icon name="alert" size={15} />
            <span>Non-USD awarded trades are intentionally excluded until FX conversion exists.</span>
          </div>
        </div>
      )}

      {tab === 'log' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px' }}>
            <h3 style={{ margin: 0 }}>Cross-RFQ event log</h3>
            <p className="sub" style={{ margin: 0 }}>Append-only events scoped to this tenant — {overview.events.length} rows.</p>
          </div>
          <table className="tbl">
            <thead>
              <tr><th>Time</th><th>RFQ</th><th>Actor</th><th>Event</th></tr>
            </thead>
            <tbody>
              {overview.events.map((e) => (
                <tr key={e.id}>
                  <td className="mono t-faint" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(e.createdAt)}</td>
                  <td className="mono t-muted">
                    {e.rfqId ? (
                      <Link href={`/rfqs/${e.rfqId}`} style={{ color: 'inherit' }}>{e.rfqRef ?? e.publicRef ?? e.rfqId}</Link>
                    ) : '—'}
                  </td>
                  <td className="t-strong" style={{ whiteSpace: 'nowrap' }}>{e.actorLabel}</td>
                  <td className="t-muted">{e.summary}</td>
                </tr>
              ))}
              {overview.events.length === 0 && (
                <tr><td colSpan={4}><div className="empty">No events recorded.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
