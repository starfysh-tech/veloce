// app/(app)/rfqs/new/wizard.tsx — 4-step Create RFQ flow.
// Faithful port of _legacy/views/Wizard.jsx. Typed inputs at the input layer
// (number / date) are serialized back to text strings on submit to match the
// current text columns on rfqs (strike/expiry/refLevel).
'use client';

import { useMemo, useState, useTransition } from 'react';
import { TEMPLATES, type TemplateId } from '@/lib/templates';
import { launchRfqAction, type LaunchRfqInput } from './actions';
import type { DealerOption, PanelOption } from './page';

const STEPS = ['Product & terms', 'Economics & size', 'Bank panel & auction', 'Review & launch'] as const;

const UNDERLYINGS = ['SPX Index', 'NDX Index', 'RTY Index', 'SX5E Index', 'UKX Index'];
const TENORS = ['3M', '6M', '9M', '12M', '18M'];
const QUOTE_UNITS = ['% of notional', '% net premium', 'vol strike'];
const CCYS = ['USD', 'EUR', 'GBP'];

// Format a Date as "DD MMM YYYY" (e.g. "11 Jun 2027"). Consistent with seed data.
function formatExpiry(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, '0');
  const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const yr = d.getUTCFullYear();
  return `${day} ${mon} ${yr}`;
}

// Native date input emits ISO YYYY-MM-DD. Default to one year out.
function defaultExpiryIso(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

// Money display for review step. Uses millions directly to avoid bigint paths.
function fmtMillions(millions: number, ccy: string): string {
  const sym = ccy === 'EUR' ? '€' : ccy === 'GBP' ? '£' : '$';
  if (millions >= 1000) return `${sym}${(millions / 1000).toFixed(2)}B`;
  return `${sym}${millions}M`;
}

export function Wizard({ panels, dealers }: { panels: PanelOption[]; dealers: DealerOption[] }) {
  const defaultPanel = panels[0];
  const initialInvited = defaultPanel ? [...defaultPanel.dealerIds] : [];

  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [f, setF] = useState({
    template: 'put' as TemplateId,
    underlying: 'SPX Index',
    refLevel: 6520,
    strike: '90%',
    tenor: '12M',
    expiry: defaultExpiryIso(),
    style: 'European · Cash settled',
    notional: 250, // millions
    ccy: 'USD',
    quoteUnit: '% of notional',
    panelId: defaultPanel?.id ?? '',
    invited: initialInvited,
    mode: 'split' as 'split' | 'full',
    blind: true,
  });

  const tpl = useMemo(() => TEMPLATES.find((t) => t.id === f.template)!, [f.template]);

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((x) => ({ ...x, [k]: v }));
  }

  function pickPanel(panelId: string) {
    const p = panels.find((x) => x.id === panelId);
    setF((x) => ({ ...x, panelId, invited: p ? [...p.dealerIds] : [] }));
  }

  function toggleDealer(id: string) {
    setF((x) => ({
      ...x,
      invited: x.invited.includes(id) ? x.invited.filter((d) => d !== id) : [...x.invited, id],
    }));
  }

  const stepValid = [
    true,
    f.notional > 0 && f.refLevel > 0,
    f.invited.length >= 3 && !!f.panelId,
    true,
  ][step];

  const overThreshold = f.notional * 1_000_000 > 100_000_000;

  function launch() {
    setError(null);
    // Serialize wizard state to the action payload.
    const expiryDate = new Date(f.expiry + 'T00:00:00Z');
    const payload: LaunchRfqInput = {
      template: f.template,
      title: `${f.underlying.replace(' Index', '')} — ${f.tenor} ${f.strike} ${tpl.name.replace('Index ', '')}`,
      product: tpl.product,
      side: tpl.defaultSide,
      underlying: f.underlying,
      refLevel: f.refLevel.toFixed(2),
      strike: f.strike,
      expiry: formatExpiry(expiryDate),
      style: f.style,
      tenor: f.tenor,
      notionalMillions: f.notional,
      ccy: f.ccy,
      quoteUnit: f.quoteUnit,
      windowMinutes: tpl.defaultWindowMinutes,
      mode: f.mode,
      blind: f.blind,
      panelId: f.panelId,
      invited: f.invited,
    };

    startTransition(async () => {
      try {
        await launchRfqAction(payload);
      } catch (e) {
        // Next.js redirect throws an internal control-flow error — let it bubble.
        if (e instanceof Error && e.message === 'NEXT_REDIRECT') throw e;
        setError(e instanceof Error ? e.message : 'Failed to launch RFQ');
      }
    });
  }

  return (
    <>
      <div className="card card-tight">
        <div className="wiz-steps">
          {STEPS.map((s, i) => (
            <span key={s} className={`wiz-step ${i === step ? 'on' : i < step ? 'done' : ''}`}>
              <span className="n">{i < step ? '✓' : i + 1}</span> {s}
            </span>
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="card">
          <h3>Product & terms</h3>
          <p className="sub">Start from a desk template — fields adapt to the product</p>
          <div className="grid g2" style={{ gap: 10 }}>
            <label className="fld">Template
              <select value={f.template} onChange={(e) => set('template', e.target.value as TemplateId)}>
                {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="fld">Underlying
              <select value={f.underlying} onChange={(e) => set('underlying', e.target.value)}>
                {UNDERLYINGS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </label>
            <label className="fld">Strike
              <input type="text" value={f.strike} onChange={(e) => set('strike', e.target.value)} />
            </label>
            <label className="fld">Tenor
              <select value={f.tenor} onChange={(e) => set('tenor', e.target.value)}>
                {TENORS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="fld">Expiry
              <input type="date" value={f.expiry} onChange={(e) => set('expiry', e.target.value)} />
            </label>
            <label className="fld">Style / settlement
              <input type="text" value={f.style} onChange={(e) => set('style', e.target.value)} />
            </label>
          </div>
          <div className="note" style={{ marginTop: 10 }}>
            Template fields: {tpl.defaultFields} · default window {tpl.defaultWindow}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <h3>Economics & size</h3>
          <p className="sub">Sizing and quoting convention</p>
          <div className="grid g2" style={{ gap: 10 }}>
            <label className="fld">Notional (millions)
              <input
                type="number"
                min={1}
                value={f.notional}
                onChange={(e) => set('notional', Number(e.target.value))}
              />
            </label>
            <label className="fld">Currency
              <select value={f.ccy} onChange={(e) => set('ccy', e.target.value)}>
                {CCYS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="fld">Reference level
              <input
                type="number"
                step="0.01"
                value={f.refLevel}
                onChange={(e) => set('refLevel', Number(e.target.value))}
              />
            </label>
            <label className="fld">Quote convention
              <select value={f.quoteUnit} onChange={(e) => set('quoteUnit', e.target.value)}>
                {QUOTE_UNITS.map((q) => <option key={q}>{q}</option>)}
              </select>
            </label>
          </div>
          {overThreshold && (
            <div className="flag flag-warn" style={{ marginTop: 12 }}>
              Notional exceeds $100M — Treasury approver sign-off will be required before award (policy threshold T1).
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="grid g2">
          <div className="card">
            <h3>Bank panel</h3>
            <p className="sub">Pick a saved panel, then adjust individual dealers</p>
            {panels.length === 0 ? (
              <div className="flag flag-warn">No bank panels configured for this firm.</div>
            ) : (
              <label className="fld" style={{ marginBottom: 10 }}>Saved panel
                <select value={f.panelId} onChange={(e) => pickPanel(e.target.value)}>
                  {panels.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.dealerIds.length})</option>)}
                </select>
              </label>
            )}
            <div className="grid" style={{ gap: 6 }}>
              {dealers.map((d) => (
                <label key={d.id} className="checkrow">
                  <input
                    type="checkbox"
                    checked={f.invited.includes(d.id)}
                    onChange={() => toggleDealer(d.id)}
                  />
                  <span style={{ fontWeight: 600 }}>{d.name}</span>
                </label>
              ))}
            </div>
            {f.invited.length < 3 && (
              <div className="flag flag-warn" style={{ marginTop: 10 }}>
                Policy requires at least 3 dealers per RFQ.
              </div>
            )}
          </div>
          <div className="card">
            <h3>Auction settings</h3>
            <p className="sub">How dealers compete</p>
            <div className="grid" style={{ gap: 6 }}>
              <label className="checkrow">
                <input
                  type="radio"
                  name="mode"
                  checked={f.mode === 'split'}
                  onChange={() => set('mode', 'split')}
                />
                <div>
                  <b style={{ fontSize: 12.5 }}>Split allocation permitted</b>
                  <div className="note">Dealers may quote partial percentages; awards can blend multiple dealers.</div>
                </div>
              </label>
              <label className="checkrow">
                <input
                  type="radio"
                  name="mode"
                  checked={f.mode === 'full'}
                  onChange={() => set('mode', 'full')}
                />
                <div>
                  <b style={{ fontSize: 12.5 }}>Full size only</b>
                  <div className="note">Only 100% quotes accepted; single-counterparty award.</div>
                </div>
              </label>
              <label className="checkrow">
                <input
                  type="checkbox"
                  checked={f.blind}
                  onChange={() => set('blind', !f.blind)}
                />
                <div>
                  <b style={{ fontSize: 12.5 }}>Blind auction</b>
                  <div className="note">Dealers cannot see competitor identities or levels — rank-only feedback.</div>
                </div>
              </label>
            </div>
            <div className="note" style={{ marginTop: 10 }}>
              Window: {tpl.defaultWindow} (template default) · hard deadline · unlimited revisions before close.
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h3>Review & launch</h3>
          <p className="sub">Invitations dispatch the moment you launch</p>
          <div className="spec">
            {([
              ['Template', tpl.name],
              ['Underlying', f.underlying],
              ['Strike', f.strike],
              ['Tenor / Expiry', `${f.tenor} · ${formatExpiry(new Date(f.expiry + 'T00:00:00Z'))}`],
              ['Size', fmtMillions(f.notional, f.ccy)],
              ['Quote convention', f.quoteUnit],
              ['Panel', `${f.invited.length} dealers${f.blind ? ' · blind' : ''}`],
              ['Allocation', f.mode === 'split' ? 'Split permitted' : 'Full size only'],
            ] as const).map(([l, v]) => (
              <div key={l}>
                <div className="s-label">{l}</div>
                <div className="s-val">{v}</div>
              </div>
            ))}
          </div>
          <hr className="hr" />
          <div className="row" style={{ gap: 6 }}>
            {f.invited.map((id) => {
              const d = dealers.find((x) => x.id === id);
              return (
                <span
                  key={id}
                  className="badge"
                  style={{ background: 'var(--surface-3)', color: 'var(--text)' }}
                >
                  {d?.name ?? id}
                </span>
              );
            })}
          </div>
          {overThreshold && (
            <div className="flag flag-info" style={{ marginTop: 12 }}>
              Pre-trade policy check passed. Approver sign-off will be required at award (notional &gt; $100M).
            </div>
          )}
          {error && (
            <div className="flag flag-warn" style={{ marginTop: 12 }}>{error}</div>
          )}
        </div>
      )}

      <div className="row">
        {step > 0 && <button className="btn" onClick={() => setStep(step - 1)} disabled={pending}>← Back</button>}
        <span className="spacer" />
        {step < 3 ? (
          <button
            className="btn btn-primary"
            disabled={!stepValid}
            onClick={() => setStep(step + 1)}
          >
            Continue →
          </button>
        ) : (
          <button className="btn btn-green" onClick={launch} disabled={pending || f.invited.length < 3}>
            {pending ? 'Launching…' : 'Launch RFQ'}
          </button>
        )}
      </div>
    </>
  );
}
