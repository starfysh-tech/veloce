# Veloce MVP build docs

How we built the MVP, one block per context session. **All blocks A–G are shipped and
merged to `main`.**

## Files

- **`HANDOFF.md`** — locked decisions, reference patterns, block list, validation gate.
- **`open-decisions.md`** — cross-cutting choices needing Randall's direction. Resolve the
  ones marked **(blocks A)** before starting Block A.
- **`blocks/block-*.md`** — a self-contained starter prompt per block. Each is written to
  drop into a fresh session and begin work immediately, with grounded file references.
- **[`pitch-video-remotion-plan.md`](pitch-video-remotion-plan.md)** — current institutional v3 30-second pitch-video storyboard and Remotion setup plan.
- **[`pitch-video-institutional-cut-plan.md`](pitch-video-institutional-cut-plan.md)** — current v3 institutional control/evidence story direction, guardrails, and implementation contract.
- **[`pitch-video-v2-plan.md`](pitch-video-v2-plan.md)** — prior critique-driven v2 pitch-video rationale, storyboard, copy direction, and asset set.

## Workflow

1. Resolve any open decisions tagged for the block (see `open-decisions.md`).
2. Start a new session. Paste the block's starter prompt (`blocks/block-a-create-rfq.md`, etc.).
3. Build incrementally; one logical commit per piece.
4. Before each commit: `npm test` && `npx tsc --noEmit`.
5. Claude runs the validation gate (HANDOFF.md) before declaring the block done.
6. Update this folder if a decision changes — the docs are the durable record across sessions.

## Goal

A fully functional MVP, not a commercializable product. **Simple and working beats
complicated and broken.** When a block surfaces a new decision, capture it in
`open-decisions.md` rather than guessing.

## Status — MVP complete

All seven blocks shipped and merged to `main`. A post-merge decision-consistency review
(2026-06-18) confirmed the locked decisions hold against `main` — Decision 7 (every
mutation through `recordEvent()`), Decision 20 (USD-indicative concentration), Decision 21
(visible two-person gap), and Decision 22 / D-8 (admin bank-panel editability, ratified).

| Block | State |
| --- | --- |
| A — Create-RFQ + invitations | shipped (PR #1) |
| B — Approval workspace | shipped (PR #3) |
| C — Ops / STP | shipped (PR #5) |
| D — Compliance | shipped (PR #6) |
| E — Admin | shipped (PR #7) |
| F — Attachments | shipped (PR #8) |
| G — Dashboards | shipped (PR #9) |
