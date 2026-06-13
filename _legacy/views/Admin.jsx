// views/Admin.jsx — platform configuration: firms & users, bank panels,
// product templates, auction rules, approval thresholds, system audit.
import React, { useContext, useState } from 'react';
import { AppCtx } from '../ctx.js';
import { FIRMS, USERS_TABLE, PANELS, TEMPLATES, AUCTION_RULES, THRESHOLDS } from '../data/seed.js';
import { bank, Icon } from '../components/ui.jsx';

export default function Admin() {
  const { db } = useContext(AppCtx);
  const [tab, setTab] = useState('firms');

  return (
    <>
      <div className="tabs" role="tablist">
        {[['firms', 'Firms & Users'], ['panels', 'Bank Panels'], ['templates', 'Templates'], ['rules', 'Auction Rules'], ['thresholds', 'Approval Thresholds'], ['audit', 'System Audit']].map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} role="tab" aria-selected={tab === id}>{label}</button>
        ))}
      </div>

      {tab === 'firms' && (
        <div className="grid g2">
          <div className="card">
            <h3>Onboarded firms</h3>
            <p className="sub">Buy-side institutions and dealer banks</p>
            <table className="tbl">
              <thead><tr><th>Firm</th><th>Type</th><th>LEI</th></tr></thead>
              <tbody>
                {FIRMS.map((f) => (
                  <tr key={f.id}>
                    <td className="t-strong">{f.name}<div className="t-faint">{f.city}</div></td>
                    <td><span className={`badge ${f.type === 'Dealer Bank' ? '' : 'badge-warn'}`}>{f.type}</span></td>
                    <td className="mono t-faint" style={{ fontSize: 10.5 }}>{f.lei}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h3>Users & entitlements</h3>
            <p className="sub">Role-based access — demo roster</p>
            <table className="tbl">
              <thead><tr><th>User</th><th>Firm</th><th>Role</th><th>Status</th></tr></thead>
              <tbody>
                {USERS_TABLE.map((u) => (
                  <tr key={u.name}>
                    <td className="t-strong">{u.name}</td>
                    <td className="t-muted">{u.firm}</td>
                    <td>{u.role}</td>
                    <td><span className="badge" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>{u.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'panels' && (
        <div className="card">
          <h3>Bank panels</h3>
          <p className="sub">Saved dealer groups available in the Create RFQ wizard</p>
          <div className="grid" style={{ gap: 10 }}>
            {PANELS.map((p) => (
              <div key={p.id} className="card card-tight" style={{ background: 'var(--surface-2)' }}>
                <div className="row">
                  <b>{p.name}</b>
                  {p.default && <span className="badge">DEFAULT</span>}
                  <span className="spacer" />
                  <span className="note">{p.banks.length} dealers</span>
                </div>
                <div className="row" style={{ marginTop: 8, gap: 6 }}>
                  {p.banks.map((id) => (
                    <span key={id} className="badge" style={{ background: 'var(--surface-3)', color: 'var(--text)' }}>
                      <span className="bank-dot" style={{ background: bank(id).color, display: 'inline-block', width: 7, height: 7, marginRight: 5 }} />
                      {bank(id).name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'templates' && (
        <div className="card">
          <h3>Product templates</h3>
          <p className="sub">Structured term capture per product type</p>
          <table className="tbl">
            <thead><tr><th>Template</th><th>Captured fields</th><th>Default window</th></tr></thead>
            <tbody>
              {TEMPLATES.map((t) => (
                <tr key={t.id}>
                  <td className="t-strong">{t.name}</td>
                  <td className="t-muted">{t.fields}</td>
                  <td className="mono">{t.defaultWindow}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'rules' && (
        <div className="card">
          <h3>Auction rules</h3>
          <p className="sub">Platform-level defaults — overridable per RFQ where permitted</p>
          <table className="tbl">
            <thead><tr><th>Rule</th><th>Setting</th><th></th></tr></thead>
            <tbody>
              {AUCTION_RULES.map((r) => (
                <tr key={r.id}>
                  <td>{r.label}</td>
                  <td className="t-strong">{r.value}</td>
                  <td className="t-faint" style={{ fontSize: 11 }}>{r.editable ? 'Editable' : 'Locked'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'thresholds' && (
        <div className="card">
          <h3>Approval thresholds & policy gates</h3>
          <p className="sub">Enforced in-flow — these raise the flags seen in the approval workspace</p>
          <div className="grid" style={{ gap: 8 }}>
            {THRESHOLDS.map((t) => (
              <div key={t.id} className="flag flag-info">
                <Icon name="shield" size={15} />
                <span><b>{t.label}</b> — {t.rule}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="card">
          <h3>System audit log</h3>
          <p className="sub">Platform-level events — append-only</p>
          <table className="tbl">
            <thead><tr><th>Time</th><th>Actor</th><th>Event</th><th>Detail</th></tr></thead>
            <tbody>
              {db.sysAudit.map((e, i) => (
                <tr key={i}>
                  <td className="mono t-faint" style={{ whiteSpace: 'nowrap' }}>{e.t}</td>
                  <td className="mono">{e.actor}</td>
                  <td><span className="badge">{e.event}</span></td>
                  <td className="t-muted">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
