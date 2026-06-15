# Block A — Create-RFQ flow + dealer invitations (starter prompt)

> Paste this into a fresh session to begin Block A. Highest priority — it closes the
> loop (an RFQ can be born in-app, not just seeded). Read `docs/HANDOFF.md` first for
> the binding decisions, and `docs/open-decisions.md` for D-1…D-5 which gate this block.

## Goal

Port the POC's 4-step Create-RFQ wizard to a Next.js flow at `/rfqs/new`, trader-role
only. On launch — in **one transaction** — insert the RFQ, snapshot invited dealers,
mint one hashed capability token per dealer, set status `live` with
`deadline = now + windowMinutes`, all through `recordEvent()`. After commit, send each
dealer an invitation email. Then redirect to the new RFQ's detail page.

## Read first (grounding)

- POC source to port: `_legacy/views/Wizard.jsx` (4 steps; field shapes, validation,
  the `launch()` payload).
- Mutation template to copy: `app/(app)/rfqs/[id]/actions.ts:13` (`recommendAwardAction`)
  — the canonical `recordEvent()` write.
- `recordEvent()` contract: `lib/record-event.ts` (one event per call; `apply(tx)`
  receives the tx; emails fire AFTER commit, see `lib/auction-status.ts:61`).
- Token mint + hashing: `db/seed.ts:106-116` (mints tokens for the live RFQ) and
  `lib/auth/caller.ts:31` (`hashToken`).
- Email wrapper: `lib/email.ts:28` (`sendInvitation` — already takes `{ to, rfqRef,
  rfqTitle, token, deadline }`).
- Schema: `db/schema.ts` — `rfqs` (101), `rfqInvitedDealers` (147), `invitations` (158),
  `events` (285), `event_type` enum (43).
- Panels are real DB rows: `bankPanels` + `bankPanelMembers` (`db/schema.ts:84-99`),
  seeded for Meridian in `db/seed-data.ts:55`.
- Caller resolution + role gate: `lib/auth/caller.ts:39` (`resolveUser`), pattern at
  `actions.ts:14-17`.
- Route already exists in nav: `app/(app)/layout.tsx:11` (`/rfqs/new`, trader nav).
- Money convention: notional in **cents**. Wizard input is millions → store
  `millions * 100_000_000`. See `db/seed-data.ts:80` and `components/ui.tsx:51`.

## Locked decisions for this block (see open-decisions.md)

- **D-1 ✅ extend `recordEvent()` to accept N events** in one tx. Launch records
  `rfq_launched` + one `invitation_sent` per dealer, atomic with the state change. Keep the
  change to `lib/record-event.ts` minimal and backward-compatible (accept one event OR an
  array; existing single-event callers unchanged; all 17 existing tests still pass).
- **D-2 ✅ launch-only** — status → `live`, no draft persistence; wizard holds state client-side.
- **D-3 ✅ sequence internal ref + random external `publicRef` (D3b).**
  - Internal `rfqs.ref = VEL-{year}-{maxSeqForFirmThisYear+1, zero-padded}`, computed in
    the tx, **buy-side surfaces only**.
  - **New schema column `rfqs.publicRef`** (random non-sequential code, e.g. `RFQ-` +
    8-char Crockford base32, unique index, generated in the tx with retry-on-conflict).
    This is the **only** external identifier shown to dealers — the invitation email
    (`lib/email.ts:36`) and `/quote/[token]` use `publicRef`, never `ref`.
  - Adds a migration to this block (one column + unique index → `npm run db:generate` →
    `db:migrate`). Machine linkage stays via the token → `rfqId`; `publicRef` exists for
    human out-of-band cross-reference without leaking sequence/volume.
- **D-4 ✅ typed constant** `lib/templates.ts`; panels read live from DB.
- **D-5 ✅ no late-quote auto-extension** — hard deadline only; drop the POC copy implying it.

## Build (suggested order, one commit each)

1. **`lib/templates.ts`** — port `TEMPLATES` from `_legacy/data/seed.js` to a typed
   constant (template id → product, default fields, default window). No schema change.
2. **`lib/queries/panels.ts`** — tenant-scoped read: panels for `caller.firmId` + their
   dealer-firm members (join `bankPanelMembers` → `firms`). Mirror `lib/queries/rfqs.ts`.
3. **`app/(app)/rfqs/new/page.tsx`** — server component: resolve caller, gate to trader,
   fetch panels + dealer firms, render the wizard client with that data. (pages fetch.)
4. **`app/(app)/rfqs/new/wizard.tsx`** — `'use client'` 4-step wizard ported from
   `Wizard.jsx`: (1) product & terms from template, (2) economics & size, (3) panel +
   auction settings, (4) review & launch. Client-side validation (≥3 dealers, notional
   > 0). Show the >$100M approver-required notice (informational; enforcement is Block B).
   Calls the launch server action. (client components interact.)
5. **`app/(app)/rfqs/new/actions.ts`** — `launchRfqAction(input)`:
   - `resolveUser()`; reject if not `kind === 'user' && role === 'trader'`.
   - Validate server-side: notional > 0, ≥3 invited dealers all belonging to the
     caller's firm's panels (don't trust the client list).
   - Generate `ref` (D-3) and `deadline = now + windowMinutes`.
   - Single `recordEvent()` call using the **extended N-event signature (D-1)**: events =
     `[rfq_launched, ...one invitation_sent per dealer]`; `apply(tx)` inserts the rfq
     (status `live`, `launchedAt` now), `rfqInvitedDealers`, and one `invitations` row per
     dealer (mint raw token via `randomBytes(24).base64url`, store `hashToken(raw)`, keep
     raw in memory for the email).
   - After commit: loop `sendInvitation()` per dealer (raw token). **Per D3a, do not pass
     the sequence `ref` to dealers** — update `sendInvitation` to show the deal title only
     (or pass a redacted/empty ref). Email failure must not roll back the launch (the
     wrapper already swallows send errors).
   - `redirect('/rfqs/' + rfqId)`.

## Acceptance / validation gate

- All writes go through the single `recordEvent()` call; no direct state-table writes.
- Invited dealers validated against the caller's firm panels server-side (no cross-tenant
  dealer injection).
- Token raw value never persisted (only `hashToken`); raw used only to build the email link.
- Notional stored in cents; window/deadline integer-correct.
- `pages fetch, client components interact` respected.
- New live RFQ appears on the blotter, opens in detail, and a seeded/test dealer can load
  `/quote/{rawToken}` and quote (manually verify the loop end-to-end).
- `npm test` && `npx tsc --noEmit` pass.

## Out of scope for Block A

- Attachments (Block F) — wire the UI affordance only if trivial, else defer entirely.
- Threshold *enforcement* (Block B) — Block A only *displays* the >$100M notice.
- Trade transcription fallback (Decision 23, deferred).
