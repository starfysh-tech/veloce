// views/Wizard.jsx — 4-step Create RFQ flow:
// 1 Product & terms (from template) → 2 Economics & size →
// 3 Bank panel & auction settings → 4 Review & launch.
import React, { useContext, useState } from 'react';
import { AppCtx } from '../ctx.js';
import { PANELS, TEMPLATES, BANKS } from '../data/seed.js';
import { bank, Icon } from '../components/ui.jsx';
import { fmtMoney } from '../lib/format.js';

const STEPS = ['Product & terms', 'Economics & size', 'Bank panel & auction', 'Review & launch'];

export default function Wizard() {
  const { actions } = useContext(AppCtx);
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    template: 'put',
    underlying: 'SPX Index',
    refLevel: '6,520.00',
    strike: '90%',
    tenor: '12M',
    expiry: '11 Jun 2027',
    side: 'Buy protection',
    style: 'European · Cash settled',
    notional: 250,
    ccy: 'USD',
    quoteUnit: '% of notional',
    panel: 'core-us',
    invited: [...PANELS.find((p) => p.id === 'core-us').banks],
    mode: 'split',
    blind: true,
  });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const tpl = TEMPLATES.find((t) => t.id === f.template);

  const toggleBank = (id) =>
    set('invited', f.invited.includes(id) ? f.invited.filter((b) => b !== id) : [...f.invited, id]);

  const pickPanel = (id) => {
    set('panel', id);
    setF((x) => ({ ...x, panel: id, invited: [...PANELS.find((p) => p.id === id).banks] }));
  };

  const launch = () =>
    actions.launchRfq({
      title: `${f.underlying.replace(' Index', '')} — ${f.tenor} ${f.strike} ${tpl.name.replace('Index ', '')}`,
      product: tpl.name.includes('Collar') ? 'Equity Collar' : tpl.name.includes('Variance') ? 'Variance Swap' : 'Equity Put Option',
      template: tpl.name,
      side: f.side, underlying: f.underlying, refLevel: f.refLevel, strike: f.strike,
      expiry: f.expiry, style: f.style, notional: f.notional * 1_000_000, ccy: f.ccy,
      tenor: f.tenor, quoteUnit: f.quoteUnit,
      mode: f.mode === 'split' ? 'Split allocation permitted' : 'Full size only',
      invited: f.invited,
    });

  const valid = [true, f.notional > 0, f.invited.length >= 3, true][step];

  return (
    <>
      <div className="card card-tight">
        <div className="wiz-steps">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`wiz-step ${i === step ? 'on' : i < step ? 'done' : ''}`}>
                <span className="n">{i < step ? '✓' : i + 1}</span> {s}
              </div>
              {i < STEPS.length - 1 && <span className="wiz-sep" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="card">
          <h3>Product & terms</h3>
          <p className="sub">Start from a desk template — fields adapt to the product</p>
          <div className="grid g2" style={{ gap: 10 }}>
            <label className="fld">Template
              <select value={f.template} onChange={(e) => set('template', e.target.value)}>
                {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="fld">Underlying
              <select value={f.underlying} onChange={(e) => set('underlying', e.target.value)}>
                {['SPX Index', 'NDX Index', 'RTY Index', 'SX5E Index', 'UKX Index'].map((u) => <option key={u}>{u}</option>)}
              </select>
            </label>
            <label className="fld">Strike
              <input type="text" value={f.strike} onChange={(e) => set('strike', e.target.value)} />
            </label>
            <label className="fld">Tenor
              <select value={f.tenor} onChange={(e) => set('tenor', e.target.value)}>
                {['3M', '6M', '9M', '12M', '18M'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="fld">Expiry
              <input type="text" value={f.expiry} onChange={(e) => set('expiry', e.target.value)} />
            </label>
            <label className="fld">Style / settlement
              <input type="text" value={f.style} onChange={(e) => set('style', e.target.value)} />
            </label>
          </div>
          <div className="note" style={{ marginTop: 10 }}>Template fields: {tpl.fields} · default window {tpl.defaultWindow}</div>
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <h3>Economics & size</h3>
          <p className="sub">Sizing and quoting convention</p>
          <div className="grid g2" style={{ gap: 10 }}>
            <label className="fld">Notional (millions)
              <input type="number" value={f.notional} onChange={(e) => set('notional', +e.target.value)} />
            </label>
            <label className="fld">Currency
              <select value={f.ccy} onChange={(e) => set('ccy', e.target.value)}>
                {['USD', 'EUR', 'GBP'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="fld">Reference level
              <input type="text" value={f.refLevel} onChange={(e) => set('refLevel', e.target.value)} />
            </label>
            <label className="fld">Quote convention
              <select value={f.quoteUnit} onChange={(e) => set('quoteUnit', e.target.value)}>
                {['% of notional', '% net premium', 'vol strike'].map((q) => <option key={q}>{q}</option>)}
              </select>
            </label>
          </div>
          {f.notional * 1e6 > 100e6 && (
            <div className="flag flag-warn" style={{ marginTop: 12 }}>
              <Icon name="alert" size={15} />
              <span>Notional exceeds $100M — Treasury approver sign-off will be required before award (policy threshold T1).</span>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="grid g2">
          <div className="card">
            <h3>Bank panel</h3>
            <p className="sub">Pick a saved panel, then adjust individual dealers</p>
            <label className="fld" style={{ marginBottom: 10 }}>Saved panel
              <select value={f.panel} onChange={(e) => pickPanel(e.target.value)}>
                {PANELS.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.banks.length})</option>)}
              </select>
            </label>
            <div className="grid" style={{ gap: 6 }}>
              {BANKS.map((b) => (
                <label key={b.id} className="checkrow">
                  <input type="checkbox" checked={f.invited.includes(b.id)} onChange={() => toggleBank(b.id)} />
                  <span className="bank-dot" style={{ background: b.color }} />
                  <span style={{ fontWeight: 600 }}>{b.name}</span>
                </label>
              ))}
            </div>
            {f.invited.length < 3 && <div className="flag flag-warn" style={{ marginTop: 10 }}>Policy requires at least 3 dealers per RFQ.</div>}
          </div>
          <div className="card">
            <h3>Auction settings</h3>
            <p className="sub">How dealers compete</p>
            <div className="grid" style={{ gap: 6 }}>
              <label className="checkrow">
                <input type="radio" name="mode" checked={f.mode === 'split'} onChange={() => set('mode', 'split')} />
                <div><b style={{ fontSize: 12.5 }}>Split allocation permitted</b><div className="note">Dealers may quote partial percentages; awards can blend multiple dealers.</div></div>
              </label>
              <label className="checkrow">
                <input type="radio" name="mode" checked={f.mode === 'full'} onChange={() => set('mode', 'full')} />
                <div><b style={{ fontSize: 12.5 }}>Full size only</b><div className="note">Only 100% quotes accepted; single-counterparty award.</div></div>
              </label>
              <label className="checkrow">
                <input type="checkbox" checked={f.blind} onChange={() => set('blind', !f.blind)} />
                <div><b style={{ fontSize: 12.5 }}>Blind auction</b><div className="note">Dealers cannot see competitor identities or levels — rank-only feedback.</div></div>
              </label>
            </div>
            <div className="note" style={{ marginTop: 10 }}>Window: 30 minutes (default) · late-quote auto-extension active · unlimited revisions before close.</div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h3>Review & launch</h3>
          <p className="sub">Invitations dispatch the moment you launch</p>
          <div className="spec">
            {[
              ['Template', tpl.name], ['Underlying', f.underlying], ['Strike', f.strike],
              ['Tenor / Expiry', `${f.tenor} · ${f.expiry}`], ['Size', fmtMoney(f.notional * 1e6, f.ccy)],
              ['Quote convention', f.quoteUnit],
              ['Panel', `${f.invited.length} dealers${f.blind ? ' · blind' : ''}`],
              ['Allocation', f.mode === 'split' ? 'Split permitted' : 'Full size only'],
            ].map(([l, v]) => <div key={l}><div className="s-label">{l}</div><div className="s-val">{v}</div></div>)}
          </div>
          <hr className="hr" />
          <div className="row" style={{ gap: 6 }}>
            {f.invited.map((id) => (
              <span key={id} className="badge" style={{ background: 'var(--surface-3)', color: 'var(--text)' }}>
                {bank(id).name}
              </span>
            ))}
          </div>
          {f.notional * 1e6 > 100e6 && (
            <div className="flag flag-info" style={{ marginTop: 12 }}>
              <Icon name="shield" size={15} />
              <span>Pre-trade policy check passed. Approver sign-off will be required at award (notional &gt; $100M).</span>
            </div>
          )}
        </div>
      )}

      <div className="row">
        {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>← Back</button>}
        <span className="spacer" />
        {step < 3
          ? <button className="btn btn-primary" disabled={!valid} onClick={() => setStep(step + 1)}>Continue →</button>
          : <button className="btn btn-green" onClick={launch}><Icon name="bolt" size={14} style={{ verticalAlign: '-2px' }} /> Launch RFQ</button>}
      </div>
    </>
  );
}
