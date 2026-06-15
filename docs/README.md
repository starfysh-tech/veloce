# Veloce MVP build docs

How we work through the remaining MVP, one block per context session.

## Files

- **`HANDOFF.md`** — locked decisions, reference patterns, block list, validation gate.
- **`open-decisions.md`** — cross-cutting choices needing Randall's direction. Resolve the
  ones marked **(blocks A)** before starting Block A.
- **`blocks/block-*.md`** — a self-contained starter prompt per block. Each is written to
  drop into a fresh session and begin work immediately, with grounded file references.

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

## Status

| Block | State |
| --- | --- |
| A — Create-RFQ + invitations | not started |
| B — Approval workspace | not started |
| C — Ops / STP | not started |
| D — Compliance | not started |
| E — Admin | not started |
| F — Attachments | not started |
| G — Dashboards | not started |
