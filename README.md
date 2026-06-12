# Veloce — RFQ & Auction Workflow (POC)

Functional proof-of-concept for an OTC equity derivatives RFQ/auction platform.
Insurance companies and funds run timed, blind, multi-dealer auctions with
partial-percentage quoting, blended awards, approval workflow, and simulated
STP/affirmation handoff.

All data is mocked and lives in browser memory. No backend, no auth, no
external services.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
npm run preview    # serve the production build locally
```

Requires Node 18+.

## Deploy to Vercel

Three options — all zero-config because `vercel.json` declares the Vite
framework, build command, and `dist/` output.

**A. Git repo (recommended)**
1. Push this folder to a GitHub/GitLab/Bitbucket repo.
2. In Vercel: Add New → Project → import the repo.
3. Accept the detected Vite defaults → Deploy. Every push redeploys.

**B. Vercel CLI**
```bash
npm i -g vercel
vercel           # preview deploy
vercel --prod    # production
```

**C. Dashboard drag-and-drop**
Run `npm run build`, then drag the project folder (or the `dist/` folder as a
static deploy) into vercel.com/new.

## Demo guide

- **Role switcher** (top right) moves between Trader, Approver, Bank
  Sales-Trader (Kestrel), Ops, Compliance, and Admin. No login.
- **Demo mode dock** (bottom center) jumps the hero RFQ `VEL-2026-0142`
  through its lifecycle: Before launch → Live auction → Awaiting approval →
  Awarded → In affirmation.
- In **Live auction**, a fifth dealer quote arrives ~14 seconds in and the
  countdown runs in real time.
- The **Comparison & Award** tab on the hero RFQ is the money shot: toggle
  best-single vs best-blended and watch two partial quotes beat the best
  full-size level by 13+ bps (~$335K on $250M).
- **Why this wins** (bottom left) opens the three-bullet investor overlay.

## File map

```
index.html               Fonts, favicon, theme attribute, mount point
vercel.json              Vercel framework/build config
src/main.jsx             React entry
src/App.jsx              App shell: state, actions, role nav, demo scenarios,
                         live-auction simulation, theme, toasts, modals
src/ctx.js               Shared React context
src/css/styles.css       Entire design system (dark + light tokens)
src/lib/format.js        Formatting + award math (best single / best blended)
src/data/seed.js         ALL mock data: firms, users, banks, 8 RFQs, quotes,
                         trades, STP handoffs, exceptions, admin config
src/components/ui.jsx    Shared components: icons, pills, countdown ring,
                         blend bar, timelines, modal, toasts, FpML payload
src/views/Dashboard.jsx  Role-specific dashboards (all 6 roles)
src/views/RfqList.jsx    RFQ blotter with filters; bank view is masked
src/views/RfqDetail.jsx  Quote board, comparison/award builder, approval
                         panel, audit log, dealer response form
src/views/Wizard.jsx     4-step Create RFQ flow
src/views/Approvals.jsx  Treasury Committee workspace
src/views/Ops.jsx        Trade economics, STP payloads, affirmation, breaks
src/views/Compliance.jsx Best-ex evidence, exceptions, concentration, log
src/views/Admin.jsx      Firms/users, panels, templates, rules, thresholds
```

## Extending toward the real product

State is centralized in `App.jsx` with a plain actions object — swapping the
in-memory `db` for API calls is the only structural change needed. Seed data
in `src/data/seed.js` doubles as a draft of the domain model (RFQ, Quote,
Trade, Handoff, Exception).
