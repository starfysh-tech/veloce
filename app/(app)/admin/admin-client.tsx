// app/(app)/admin/admin-client.tsx — functional admin UI for bank panels,
// with read-only surfaces for code-backed policy/template settings.
'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui';
import type { AdminOverview, AdminPanelRow } from '@/lib/queries/admin';
import {
  createBankPanelAction,
  deleteBankPanelAction,
  renameBankPanelAction,
  setDefaultBankPanelAction,
  updateBankPanelMembersAction,
} from './actions';

type Tab = 'firms' | 'panels' | 'templates' | 'rules' | 'thresholds' | 'audit';

function fmtDate(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 16).replace('T', ' ');
}

function firmTypeLabel(type: string): string {
  if (type === 'insurer') return 'Insurer';
  if (type === 'fund') return 'Fund';
  return 'Dealer Bank';
}

function PanelEditor({ panel, overview, run, pending }: {
  panel: AdminPanelRow;
  overview: AdminOverview;
  run: (fn: () => Promise<unknown>) => void;
  pending: boolean;
}) {
  const [name, setName] = useState(panel.name);
  const [dealerIds, setDealerIds] = useState<string[]>(panel.dealerIds);
  const dealerById = new Map(overview.dealers.map((d) => [d.id, d]));

  function toggleDealer(id: string) {
    setDealerIds((current) => (
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    ));
  }

  return (
    <div className="card card-tight" style={{ background: 'var(--surface-2)' }}>
      <div className="row" style={{ gap: 8 }}>
        <input
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          aria-label={`Panel name for ${panel.name}`}
          style={{ flex: 1, minWidth: 180 }}
        />
        {panel.isDefault && <span className="badge">DEFAULT</span>}
        <button
          className="btn btn-sm"
          disabled={pending || name.trim() === panel.name || !name.trim()}
          onClick={() => run(() => renameBankPanelAction({ panelId: panel.id, name }))}
        >
          Save name
        </button>
        {!panel.isDefault && (
          <button
            className="btn btn-sm btn-ghost"
            disabled={pending}
            onClick={() => run(() => setDefaultBankPanelAction({ panelId: panel.id }))}
          >
            Make default
          </button>
        )}
        {!panel.isDefault && (
          <button
            className="btn btn-sm btn-ghost"
            disabled={pending}
            onClick={() => {
              if (window.confirm(`Delete ${panel.name}?`)) {
                run(() => deleteBankPanelAction({ panelId: panel.id }));
              }
            }}
          >
            Delete
          </button>
        )}
      </div>
      <div className="note" style={{ marginTop: 6 }}>
        {dealerIds.length} selected. Create RFQ requires at least 3 dealers.
      </div>
      <div className="grid" style={{ gap: 6, marginTop: 10 }}>
        {overview.dealers.map((dealer) => (
          <label key={dealer.id} className="checkrow" style={{ padding: 8 }}>
            <input
              type="checkbox"
              checked={dealerIds.includes(dealer.id)}
              onChange={() => toggleDealer(dealer.id)}
            />
            <div>
              <b style={{ fontSize: 12.5 }}>{dealer.name}</b>
              <div className="note">{dealer.shortCode ?? 'No short code'} · {dealer.lei ?? 'No LEI'}</div>
            </div>
          </label>
        ))}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <div className="t-faint" style={{ flex: 1 }}>
          Current: {panel.dealerIds.map((id) => dealerById.get(id)?.name ?? id).join(', ')}
        </div>
        <button
          className="btn btn-sm btn-primary"
          disabled={pending || dealerIds.length < 3}
          onClick={() => run(() => updateBankPanelMembersAction({ panelId: panel.id, dealerFirmIds: dealerIds }))}
        >
          Save dealers
        </button>
      </div>
    </div>
  );
}

export default function AdminClient({ overview }: { overview: AdminOverview }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('firms');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDealerIds, setNewDealerIds] = useState<string[]>([]);
  const [newDefault, setNewDefault] = useState(false);

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

  function toggleNewDealer(id: string) {
    setNewDealerIds((current) => (
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    ));
  }

  return (
    <>
      <div className="row">
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Administration</h2>
          <div className="t-faint">Configuration, entitlements, policy reference, and tenant audit.</div>
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--warn)', marginTop: 12 }}>
          <strong>Couldn’t complete the admin action.</strong> {error}
        </div>
      )}

      <div className="tabs" role="tablist" style={{ marginTop: 12 }}>
        {([
          ['firms', 'Firms & Users'],
          ['panels', 'Bank Panels'],
          ['templates', 'Templates'],
          ['rules', 'Auction Rules'],
          ['thresholds', 'Approval Thresholds'],
          ['audit', 'System Audit'],
        ] as const).map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} role="tab" aria-selected={tab === id}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'firms' && (
        <div className="grid g2">
          <div className="card">
            <h3>Firm</h3>
            <p className="sub">Tenant firm and reachable dealer directory.</p>
            {overview.firm ? (
              <table className="tbl">
                <thead><tr><th>Firm</th><th>Type</th><th>LEI</th></tr></thead>
                <tbody>
                  <tr>
                    <td className="t-strong">{overview.firm.name}<div className="t-faint">{overview.firm.city ?? '—'}</div></td>
                    <td><span className="badge badge-warn">{firmTypeLabel(overview.firm.type)}</span></td>
                    <td className="mono t-faint" style={{ fontSize: 10.5 }}>{overview.firm.lei ?? '—'}</td>
                  </tr>
                  {overview.dealers.map((f) => (
                    <tr key={f.id}>
                      <td className="t-strong">{f.name}<div className="t-faint">{f.shortCode ?? '—'}</div></td>
                      <td><span className="badge">Dealer Bank</span></td>
                      <td className="mono t-faint" style={{ fontSize: 10.5 }}>{f.lei ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="empty">No firm row found.</div>}
          </div>
          <div className="card">
            <h3>Users &amp; entitlements</h3>
            <p className="sub">Read-only roster. EDITABLE-TODO: allow admin role/status edits through recordEvent().</p>
            <table className="tbl">
              <thead><tr><th>User</th><th>Role</th><th>Desk</th><th>Status</th></tr></thead>
              <tbody>
                {overview.users.map((u) => (
                  <tr key={u.id}>
                    <td className="t-strong">{u.fullName}<div className="t-faint">{u.email}</div></td>
                    <td>{u.role}</td>
                    <td className="t-muted">{u.desk ?? '—'}</td>
                    <td><span className={`badge ${u.active ? '' : 'badge-warn'}`}>{u.active ? 'active' : 'inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'panels' && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="card">
            <h3>Bank panels</h3>
            <p className="sub">Saved dealer groups used by the Create RFQ wizard. Edits are audited as bank_panel_updated events.</p>
            <div className="grid" style={{ gap: 10 }}>
              {overview.panels.map((panel) => (
                <PanelEditor key={panel.id} panel={panel} overview={overview} run={run} pending={pending} />
              ))}
              {overview.panels.length === 0 && <div className="empty">No panels configured.</div>}
            </div>
          </div>
          <div className="card">
            <h3>Create panel</h3>
            <p className="sub">Panels must include at least three dealer firms to be RFQ-ready.</p>
            <input
              value={newName}
              onChange={(ev) => setNewName(ev.target.value)}
              placeholder="Panel name"
              style={{ width: '100%', marginBottom: 10 }}
            />
            <div className="grid" style={{ gap: 6 }}>
              {overview.dealers.map((dealer) => (
                <label key={dealer.id} className="checkrow" style={{ padding: 8 }}>
                  <input type="checkbox" checked={newDealerIds.includes(dealer.id)} onChange={() => toggleNewDealer(dealer.id)} />
                  <div>
                    <b style={{ fontSize: 12.5 }}>{dealer.name}</b>
                    <div className="note">{dealer.shortCode ?? 'No short code'} · {dealer.lei ?? 'No LEI'}</div>
                  </div>
                </label>
              ))}
            </div>
            <label className="checkrow" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={newDefault} onChange={() => setNewDefault((v) => !v)} />
              <div>
                <b style={{ fontSize: 12.5 }}>Make default</b>
                <div className="note">Default panel appears first in Create RFQ.</div>
              </div>
            </label>
            <button
              className="btn btn-primary"
              style={{ marginTop: 10 }}
              disabled={pending || !newName.trim() || newDealerIds.length < 3}
              onClick={() => run(async () => {
                await createBankPanelAction({ name: newName, dealerFirmIds: newDealerIds, isDefault: newDefault });
                setNewName('');
                setNewDealerIds([]);
                setNewDefault(false);
              })}
            >
              <Icon name="plus" size={14} /> Create panel
            </button>
          </div>
        </div>
      )}

      {tab === 'templates' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* EDITABLE-TODO: product templates need a persisted template table and RFQ wizard/action validation wired to it before admin edits can affect behavior. */}
          <div style={{ padding: '12px 14px' }}>
            <h3 style={{ margin: 0 }}>Product templates</h3>
            <p className="sub" style={{ margin: 0 }}>Read-only code-backed templates available in Create RFQ.</p>
          </div>
          <table className="tbl">
            <thead><tr><th>Template</th><th>Captured fields</th><th>Default window</th></tr></thead>
            <tbody>
              {overview.templates.map((t) => (
                <tr key={t.id}>
                  <td className="t-strong">{t.name}<div className="t-faint">{t.product}</div></td>
                  <td className="t-muted">{t.defaultFields}</td>
                  <td className="mono">{t.defaultWindow}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'rules' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* EDITABLE-TODO: auction defaults need persisted config plus Create RFQ defaults wired to that config before admin edits can affect launched RFQs. */}
          <div style={{ padding: '12px 14px' }}>
            <h3 style={{ margin: 0 }}>Auction rules</h3>
            <p className="sub" style={{ margin: 0 }}>Read-only rules enforced by current RFQ and quote paths.</p>
          </div>
          <table className="tbl">
            <thead><tr><th>Rule</th><th>Setting</th><th>Note</th></tr></thead>
            <tbody>
              {overview.auctionRules.map((r) => (
                <tr key={r.id}>
                  <td>{r.label}</td>
                  <td className="t-strong">{r.value}</td>
                  <td className="t-faint">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'thresholds' && (
        <div className="card">
          {/* EDITABLE-TODO: approval thresholds need persisted policy config and every policy caller rewired before admin edits can be behaviorally real. */}
          <h3>Approval thresholds &amp; policy gates</h3>
          <p className="sub">Read-only policy references enforced in recommend/approve flows.</p>
          <div className="grid" style={{ gap: 8 }}>
            {overview.thresholds.map((t) => (
              <div key={t.id} className="flag flag-info">
                <Icon name="shield" size={15} />
                <span><b>{t.label}</b> — {t.value}. {t.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px' }}>
            <h3 style={{ margin: 0 }}>System audit log</h3>
            <p className="sub" style={{ margin: 0 }}>Append-only tenant events — {overview.events.length} rows.</p>
          </div>
          <table className="tbl">
            <thead><tr><th>Time</th><th>Actor</th><th>Event</th><th>Detail</th></tr></thead>
            <tbody>
              {overview.events.map((e) => (
                <tr key={e.id}>
                  <td className="mono t-faint" style={{ whiteSpace: 'nowrap' }}>{fmtDate(e.createdAt)}</td>
                  <td className="t-strong">{e.actorLabel}</td>
                  <td><span className="badge">{e.type}</span></td>
                  <td className="t-muted">{e.summary}</td>
                </tr>
              ))}
              {overview.events.length === 0 && <tr><td colSpan={4}><div className="empty">No events recorded.</div></td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
