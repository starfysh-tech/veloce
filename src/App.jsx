// ===========================================================================
// App.jsx — application shell.
// Holds all state (role, theme, view, mutable DB clone), exposes actions via
// context, runs the live-auction simulation (countdown tick + late quote
// arrival), and renders the rail / topbar / active view.
// ===========================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppCtx } from './ctx.js';
import { makeInitialDb, ROLES, SIMULATED_QUOTE, BANK_PERSONA } from './data/seed.js';
import { bestSingle, bestBlended, savings, fmtMoneyFull } from './lib/format.js';
import { Icon, Modal, Toasts } from './components/ui.jsx';
import Dashboard from './views/Dashboard.jsx';
import RfqList from './views/RfqList.jsx';
import RfqDetail from './views/RfqDetail.jsx';
import Wizard from './views/Wizard.jsx';
import Approvals from './views/Approvals.jsx';
import Ops from './views/Ops.jsx';
import Compliance from './views/Compliance.jsx';
import Admin from './views/Admin.jsx';

const HERO = 'VEL-2026-0142';
const MIN = 60 * 1000;

const NAV = {
  trader: [
    { v: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { v: 'rfqs', label: 'RFQs', icon: 'list' },
    { v: 'wizard', label: 'Create RFQ', icon: 'plus' },
  ],
  approver: [
    { v: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { v: 'approvals', label: 'Approvals', icon: 'check' },
    { v: 'rfqs', label: 'RFQs', icon: 'list' },
  ],
  bank: [
    { v: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { v: 'rfqs', label: 'Invited RFQs', icon: 'list' },
  ],
  ops: [
    { v: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { v: 'ops', label: 'Trades & STP', icon: 'flow' },
  ],
  compliance: [
    { v: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { v: 'compliance', label: 'Best Execution', icon: 'shield' },
    { v: 'rfqs', label: 'All RFQs', icon: 'list' },
  ],
  admin: [
    { v: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { v: 'admin', label: 'Administration', icon: 'gear' },
  ],
};

const TITLES = {
  dashboard: 'Dashboard', rfqs: 'RFQ Blotter', wizard: 'Create RFQ', approvals: 'Approval Workspace',
  ops: 'Operations · STP Workspace', compliance: 'Compliance & Risk', admin: 'Platform Administration', rfq: 'RFQ Detail',
};

const SCENARIOS = [
  { id: 'before', label: 'Before launch' },
  { id: 'live', label: 'Live auction' },
  { id: 'approval', label: 'Awaiting approval' },
  { id: 'awarded', label: 'Awarded' },
  { id: 'stp', label: 'In affirmation' },
];

export default function App() {
  const [db, setDb] = useState(makeInitialDb);
  const [role, setRole] = useState('trader');
  const [theme, setTheme] = useState('dark');
  const [view, setView] = useState({ name: 'dashboard', params: {} });
  const [nowMs, setNowMs] = useState(Date.now());
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [scenario, setScenarioState] = useState('live');
  const arrivedRef = useRef(false);
  const toastId = useRef(0);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  // 1-second tick drives every countdown on screen.
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const toast = (title, body, tone) => {
    const id = ++toastId.current;
    setToasts((ts) => [...ts, { id, title, body, tone }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 5200);
  };

  const mutate = (fn) => setDb((prev) => { const next = structuredClone(prev); fn(next); return next; });
  const hero = (d) => d.rfqs.find((r) => r.id === HERO);
  const stamp = () => {
    const d = new Date();
    return `12 Jun 2026 · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // Simulated late quote: ~14s after the hero RFQ is live, Helvetia responds.
  useEffect(() => {
    const h = db.rfqs.find((r) => r.id === HERO);
    if (!h || h.status !== 'Live' || arrivedRef.current) return;
    const t = setTimeout(() => {
      if (arrivedRef.current) return;
      arrivedRef.current = true;
      mutate((d) => {
        d.quotes.push({ ...SIMULATED_QUOTE, ts: stamp() });
        hero(d).timeline.push({ t: stamp(), who: 'Helvetia Global Bank', what: 'Quote received — 100% @ 2.92%' });
      });
      toast('New quote received', 'Dealer 5 responded on VEL-2026-0142 — quote board updated.', '');
    }, 14000);
    return () => clearTimeout(t);
  }, [db.rfqs.find((r) => r.id === HERO)?.status]); // eslint-disable-line

  // ----- demo-mode scenario jumps (mutates the hero RFQ only) -------------
  const heroProposal = (d) => {
    const qs = d.quotes.filter((q) => q.rfqId === HERO);
    const single = bestSingle(qs);
    const blend = bestBlended(qs);
    const sav = savings(hero(d), single, blend);
    return {
      kind: 'blended',
      allocations: blend.fills.map((f) => ({ bankId: f.bankId, pct: f.take, price: f.price })),
      blendedPrice: +blend.blended.toFixed(3),
      bestSinglePrice: single.price,
      bestSingleBank: single.bankId,
      savingsUsd: Math.round(sav.usd),
      savingsBps: +sav.bps.toFixed(1),
      rationale:
        'Two partial-percentage quotes inside the best full-size level cover 100% of size. Blended award beats the best single-bank quote while splitting counterparty exposure across two dealers.',
      flags: [],
    };
  };

  const setScenario = (id) => {
    setScenarioState(id);
    mutate((d) => {
      const h = hero(d);
      delete h.proposal; delete h.award; delete h.tempHandoff;
      if (id === 'before') {
        h.status = 'Draft'; h.deadline = null;
        d.quotes = d.quotes.filter((q) => q.rfqId !== HERO || !q.arrived);
        arrivedRef.current = false;
      }
      if (id === 'live') {
        h.status = 'Live'; h.deadline = Date.now() + 18 * MIN;
        d.quotes = d.quotes.filter((q) => q.rfqId !== HERO || !q.arrived);
        arrivedRef.current = false;
        h.timeline.push({ t: stamp(), who: 'System', what: 'Demo mode — auction window reset (18:00 remaining)' });
      }
      if (id === 'approval' || id === 'awarded' || id === 'stp') {
        h.deadline = Date.now() - 4 * MIN;
        const p = heroProposal(d);
        if (id === 'approval') {
          h.status = 'Awaiting Approval'; h.proposal = p;
          h.timeline.push({ t: stamp(), who: 'Dana Whitfield', what: 'Recommended blended award — routed to Treasury Committee' });
        } else {
          h.status = id === 'awarded' ? 'Awarded' : 'In STP';
          h.award = { kind: p.kind, allocations: p.allocations, blendedPrice: p.blendedPrice, note: `Blended ${p.blendedPrice}% vs ${p.bestSinglePrice}% best single — saved ${fmtMoneyFull(p.savingsUsd)} (${p.savingsBps} bps).` };
          h.timeline.push({ t: stamp(), who: 'Marcus Oyelaran', what: 'Blended award approved' });
          if (id === 'stp') {
            h.tempHandoff = true;
            d.handoffs.unshift({
              id: 'STP-2244', rfqId: HERO, tradeIds: p.allocations.map((a, i) => `TRD-311${i}`),
              channel: 'MarkitWire (simulated)', payload: `FpML 5.12 · OptionTrade ×${p.allocations.length}`,
              status: 'Sent — Awaiting Match', sent: stamp(), exceptions: [],
            });
            h.timeline.push({ t: stamp(), who: 'System', what: 'Capture payloads generated and sent (STP-2244)' });
          }
        }
      }
    });
    setView((v) => (v.name === 'rfq' ? v : { name: 'rfq', params: { id: HERO } }));
    toast('Demo mode', `Jumped to “${SCENARIOS.find((s) => s.id === id).label}”.`, '');
  };

  // ----- workflow actions ---------------------------------------------------
  const actions = {
    recommendAward(rfqId, plan) {
      mutate((d) => {
        const r = d.rfqs.find((x) => x.id === rfqId);
        r.status = 'Awaiting Approval'; r.proposal = plan;
        r.timeline.push({ t: stamp(), who: 'Dana Whitfield', what: `Recommended ${plan.kind} award — routed to Treasury Committee` });
      });
      if (rfqId === HERO) setScenarioState('approval');
      toast('Award recommended', 'Routed to Treasury Committee for approval.', 't-amber');
    },
    approve(rfqId) {
      mutate((d) => {
        const r = d.rfqs.find((x) => x.id === rfqId);
        const p = r.proposal;
        r.status = 'Awarded';
        r.award = { kind: p.kind, allocations: p.allocations, blendedPrice: p.blendedPrice, note: 'Approved by Treasury Committee.' };
        delete r.proposal;
        r.timeline.push({ t: stamp(), who: 'Marcus Oyelaran', what: 'Award approved' });
        p.allocations.forEach((a, i) => d.trades.unshift({
          id: `TRD-31${20 + i}`, rfqId, bankId: a.bankId, pct: a.pct,
          allocNotional: Math.round(r.notional * (a.pct / 100)), ccy: r.ccy, price: a.price,
          priceUnit: r.quoteUnit, status: 'Captured', tradeDate: '12 Jun 2026', settle: 'T+2 (16 Jun 2026)',
          uti: `UTI-${rfqId}-${a.bankId.toUpperCase().slice(0, 3)}-0${i + 1}`,
        }));
        const exc = d.exceptions.find((e) => e.rfqId === rfqId && e.status.startsWith('Open'));
        if (exc) exc.status = 'Closed — acknowledged by approver';
      });
      if (rfqId === HERO) setScenarioState('awarded');
      toast('Award approved', 'Trades captured and queued for STP handoff.', 't-green');
    },
    reject(rfqId) {
      mutate((d) => {
        const r = d.rfqs.find((x) => x.id === rfqId);
        r.status = 'Under Review'; delete r.proposal;
        r.timeline.push({ t: stamp(), who: 'Marcus Oyelaran', what: 'Award rejected — returned to trading desk' });
      });
      toast('Award rejected', 'RFQ returned to the trading desk.', 't-amber');
    },
    sendBack(rfqId, note) {
      mutate((d) => {
        const r = d.rfqs.find((x) => x.id === rfqId);
        r.status = 'Under Review';
        r.timeline.push({ t: stamp(), who: 'Marcus Oyelaran', what: `Clarification requested — “${note || 'please confirm sizing rationale'}”` });
      });
      toast('Clarification requested', 'Sent back to the trading desk with a note.', 't-amber');
    },
    submitQuote(rfqId, { pct, price, note }) {
      mutate((d) => {
        const existing = d.quotes.find((q) => q.rfqId === rfqId && q.bankId === BANK_PERSONA);
        if (existing) {
          existing.revisedFrom = existing.price;
          existing.price = price; existing.pct = pct; existing.note = note; existing.ts = stamp();
          d.rfqs.find((x) => x.id === rfqId).timeline.push({ t: stamp(), who: 'Kestrel Securities', what: `Quote revised — ${pct}% @ ${price}%` });
        } else {
          d.quotes.push({ id: `Q-${Math.floor(9000 + Math.random() * 900)}`, rfqId, bankId: BANK_PERSONA, pct, price, note, ts: stamp(), mine: true });
          d.rfqs.find((x) => x.id === rfqId).timeline.push({ t: stamp(), who: 'Kestrel Securities', what: `Quote received — ${pct}% @ ${price}%` });
        }
      });
      toast('Quote submitted', 'Your response is live on the buy-side quote board.', 't-green');
    },
    advanceHandoff(id) {
      mutate((d) => {
        const h = d.handoffs.find((x) => x.id === id);
        h.status = h.status === 'Affirmed' ? 'Affirmed' : h.status.startsWith('Sent') ? 'Matched' : 'Affirmed';
        const r = d.rfqs.find((x) => x.id === h.rfqId);
        if (h.status === 'Affirmed') {
          r.status = 'Affirmed';
          d.trades.forEach((t) => { if (h.tradeIds.includes(t.id)) t.status = 'Affirmed'; });
        }
        r.timeline.push({ t: stamp(), who: 'Middle Office', what: `STP record ${id} advanced to ${h.status}` });
      });
      toast('STP updated', `Handoff ${id} advanced.`, 't-green');
    },
    flagException(id, text) {
      mutate((d) => {
        const h = d.handoffs.find((x) => x.id === id);
        h.exceptions.push({ id: `STPX-${Math.floor(40 + Math.random() * 50)}`, sev: 'warn', text, open: true });
      });
      toast('Exception flagged', 'Added to the operations exception queue.', 't-amber');
    },
    launchRfq(data) {
      mutate((d) => {
        d.rfqs.unshift({
          ...data,
          id: `VEL-2026-0${144 + d.rfqs.filter((r) => r.id.startsWith('VEL-2026-01')).length - 7}`,
          status: 'Live', requesterFirm: 'meridian', requester: 'Dana Whitfield', blind: true,
          deadline: Date.now() + 30 * MIN, createdAt: stamp(), attachments: data.attachments || [],
          timeline: [
            { t: stamp(), who: 'Dana Whitfield', what: 'RFQ created via wizard' },
            { t: stamp(), who: 'System', what: `Invitations dispatched to ${data.invited.length} dealers · 30-minute window` },
          ],
        });
      });
      toast('RFQ launched', 'Invitations dispatched — the auction window is open.', 't-green');
      setView({ name: 'rfqs', params: {} });
    },
  };

  const persona = ROLES.find((r) => r.id === role);
  const nav = (name, params = {}) => setView({ name, params });
  const openModal = (title, body) => setModal({ title, body });
  const closeModal = () => setModal(null);

  const ctx = useMemo(
    () => ({ db, role, persona, view, nav, nowMs, theme, openModal, closeModal, modal, toasts, toast, actions, scenario }),
    [db, role, view, nowMs, theme, modal, toasts, scenario]
  );

  const Body = {
    dashboard: Dashboard, rfqs: RfqList, rfq: RfqDetail, wizard: Wizard,
    approvals: Approvals, ops: Ops, compliance: Compliance, admin: Admin,
  }[view.name] || Dashboard;

  return (
    <AppCtx.Provider value={ctx}>
      <div className="shell">
        <aside className="rail">
          <div className="brand">
            <div className="brand-mark"><Icon name="bolt" size={18} /></div>
            <div>
              <div className="brand-name">VELOCE</div>
              <div className="brand-sub">Financial Technologies</div>
            </div>
          </div>
          <div className="rail-label">Workspace</div>
          {NAV[role].map((n) => (
            <button key={n.v} className={`nav-item ${view.name === n.v || (view.name === 'rfq' && n.v === 'rfqs') ? 'active' : ''}`} onClick={() => nav(n.v)}>
              <Icon name={n.icon} size={15} /> {n.label}
              {n.v === 'approvals' && db.rfqs.filter((r) => r.status === 'Awaiting Approval').length > 0 && (
                <span className="badge badge-warn">{db.rfqs.filter((r) => r.status === 'Awaiting Approval').length}</span>
              )}
            </button>
          ))}
          <div className="rail-foot">
            <div className="persona">
              <div className="avatar">{persona.user.split(' ').map((w) => w[0]).join('').slice(0, 2)}</div>
              <div>
                <b>{persona.user}</b>
                <span>{persona.firm}</span>
              </div>
            </div>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <h1>
              {TITLES[view.name]} <span className="crumb">· OTC Equity Derivatives</span>
            </h1>
            <div className="top-actions">
              <label className="fld" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Role</span>
                <select value={role} onChange={(e) => { setRole(e.target.value); nav('dashboard'); }} aria-label="Switch demo role">
                  {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </label>
              <button className="btn btn-ghost btn-sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
              </button>
            </div>
          </header>
          <main className="content">
            <div className="content-inner"><Body /></div>
            <div style={{ height: 76 }} />
          </main>
        </div>
      </div>

      <div className="demo-dock" role="toolbar" aria-label="Demo mode">
        <span className="dd-label">Demo mode</span>
        {SCENARIOS.map((s) => (
          <button key={s.id} className={scenario === s.id ? 'on' : ''} onClick={() => setScenario(s.id)}>{s.label}</button>
        ))}
      </div>

      <button className="btn btn-primary why-btn" onClick={() => openModal('Why Veloce wins', <WhyWins />)}>
        Why this wins
      </button>

      <Modal />
      <Toasts />
    </AppCtx.Provider>
  );
}

function WhyWins() {
  const items = [
    ['Better pricing through synchronized competition', 'Every invited dealer quotes into one timed window, including partial-percentage participation. Blended awards routinely beat the best single-bank quote — the live demo RFQ shows a 13+ bps improvement on $250M.'],
    ['Lower operational friction, faster STP', 'Email threads become one structured workflow: award allocations generate capture payloads automatically and flow straight into affirmation, with an exceptions queue instead of manual chasing.'],
    ['Stronger governance and audit trail', 'Invitations, quotes, revisions, overrides, approvals and best-execution rationale are captured as an immutable event log — concentration caps and approval thresholds are enforced in-flow, not reconstructed afterwards.'],
  ];
  return (
    <div className="grid" style={{ gap: 12 }}>
      {items.map(([h, b], i) => (
        <div key={i} className="card card-tight" style={{ background: 'var(--surface-2)' }}>
          <h3>{h}</h3>
          <p className="sub" style={{ margin: 0 }}>{b}</p>
        </div>
      ))}
    </div>
  );
}
