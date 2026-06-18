# Incident handoff — "Recommend this award" returns 500 on the deployed demo

> For a dev to validate, fix, and confirm. Found 2026-06-18 while capturing
> partner-demo screenshots against `https://mvp-veloce.vercel.app`. Blocks the
> approval-workflow screenshots **and** the demo's approval flow: a trader cannot
> recommend an award, so nothing ever reaches the approver queue.

## Symptom (reproducible, console-confirmed)

- Logged in as trader `dana@meridian.example` / `veloce-ft`, open the under-review
  RFQ `VEL-2026-0142` ("S&P 500 — 12M 90% Put Hedge", $250M), and click
  **"Recommend this award"** (blended construction selected).
- Button shows "Routing…" then the action fails; on reload the RFQ is still
  **Under Review** and the award was not created.
- Browser console on click:
  - `Failed to load resource: the server responded with a status of 500`
  - `Uncaught (in promise)`
- The server action 500s; no award row is committed (the `recordEvent` tx rolls back).

## Scope (narrowed — it is NOT a global write outage)

On the **same** prod deployment, the ops write path works: as `tomas@meridian.example`
I clicked **"Generate handoff"** on `/ops` and it succeeded (handoff `H-SGTAYZZF`
created, trades advanced to `Sent`, payload preview renders). So `recordEvent`, the
DB, and Storage are healthy in prod. **The failure is specific to the recommend
path.**

## Most likely root cause (documented known gap)

`VEL-2026-0142` was very likely **recommended once and then rejected** back to
`under_review`, which leaves the prior `awards` row in place. Re-recommending then
violates the one-award-per-RFQ unique index `awards_rfq_uniq` → the insert aborts →
500. This is a **already-logged gap**:

- See `docs/open-decisions.md` (Block B accepted gaps) and `docs/ROADMAP.md` O-3
  ("the re-recommend-after-reject `awards` unique-constraint block").
- Code path: `recommendAwardAction` (`app/(app)/rfqs/[id]/actions.ts:22`) inserts an
  `awards` row inside `recordEvent`; the unique index is in `db/schema.ts`
  (`awards_rfq_uniq`). A second recommend for an RFQ that already has an award row
  hits the constraint.

If correct, recommend is **not universally broken** — only for RFQs that already
carry an award (previously recommended/rejected). A fresh RFQ would recommend fine.

## Diagnose first (confirm in ~5 min)

1. **Read the Vercel runtime logs** for the failing server action (the `/rfqs/[id]`
   function) at a reproduction. If the stack shows a Postgres unique-violation
   (`23505`) on `awards_rfq_uniq`, the hypothesis is confirmed.
2. **Check prod data:** does `VEL-2026-0142` already have a row in `awards`? If yes,
   that's the collision.
3. **Is it data-specific or universal?** Try recommending on a *different* RFQ that
   has never been recommended (launch a fresh one, let the window close, recommend).
   If that succeeds, the bug is the re-recommend collision, not recommend in general.

Secondary candidates if the log shows something else: the rule-(d) auto-open
`exceptions` insert (`nextExceptionRef`), or the concentration projection
(`getDealerConcentration`) on the $250M/blended/split path — but the unique-violation
is the documented and most probable cause.

## Fix

- **Remediation (the logged one):** make re-recommend idempotent — on an existing
  award for the RFQ, replace/update it (delete-then-insert or upsert) within the same
  `recordEvent` tx instead of blind-inserting; or clear the prior award when an RFQ is
  rejected back to `under_review`. Add a test: recommend → reject → recommend again
  succeeds.
- **Unblock the demo now (data):** if you don't want to ship the code fix first,
  clear the orphan `awards` row for `VEL-2026-0142` so a fresh recommend works for the
  partner demo.

## Validation gate

- Recommend on `VEL-2026-0142` succeeds → RFQ flips to `awaiting_approval` and appears
  in `marcus@meridian.example`'s `/approvals` queue with the >$250M committee-note
  requirement shown.
- Recommend → reject → recommend again succeeds (no 500).
- `npm test`, `npx tsc --noEmit`, `npm run lint` green.

## When it's green

Ping back — the approval-detail screenshot (`approver-03-detail`, the $250M committee
note + threshold flags) is the only remaining shot for the partner-site user guide,
and it needs a recommended award sitting in the approval queue. Everything else is
captured. WIP on branch `docs/partner-site-guide`.
