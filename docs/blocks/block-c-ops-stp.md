# Block C — Ops / STP workspace (starter prompt)

> Paste into a fresh session. Read `docs/HANDOFF.md` (Decisions 7, 12) first. Depends on
> Block B producing `trades` (or use seeded awarded/in_stp RFQs: `db/seed-data.ts`
> `rfq:0139` awarded, `rfq:0138` in_stp).

## Goal

Port `_legacy/views/Ops.jsx` to `/ops`, ops-role only. An awarded-trade economics table;
generate and persist an FpML-style capture payload into `handoffs`; preview the payload;
advance a manual affirmation lifecycle (`sent → matched → affirmed`) on `handoffs` and the
linked `trades`; an exceptions queue (`handoff_exceptions`). **Per Decision 12 the payload
is persisted and previewable but NEVER transmitted** — no network send, no external call.

## Read first (grounding)

- POC: `_legacy/views/Ops.jsx`; the `stpPayload` builder lives in
  `_legacy/components/ui.jsx` — port it **server-side** (e.g. `lib/stp.ts`), pure function,
  no I/O.
- Mutation template: `app/(app)/rfqs/[id]/actions.ts:13`, `lib/record-event.ts`.
- Schema: `trades` (`db/schema.ts:221`), `handoffs` (243), `handoffExceptions` (257),
  `trade_status` enum (30: captured/sent/matched/affirmed), `handoff_status` enum (33:
  sent/matched/affirmed), `event_type` (43: `handoff_sent`, `handoff_advanced`,
  `exception_opened`/`exception_closed`).

## Build (one commit each)

1. `lib/stp.ts` — pure server-side FpML-style payload builder (port from `ui.jsx`),
   stored as JSON on `handoffs.payload`. No transmission.
2. `lib/queries/ops.ts` — tenant-scoped reads: awarded trades + their handoff state for
   `caller.firmId`; open `handoff_exceptions`.
3. `app/(app)/ops/page.tsx` — server component, ops-gated, fetches the trade/handoff table.
4. `app/(app)/ops/...` client — payload preview + lifecycle controls.
5. `app/(app)/ops/actions.ts`:
   - `generateHandoff(rfqId)` — build payload, insert `handoffs` (status `sent`), advance
     linked `trades` to `sent`, via one `recordEvent()` (`handoff_sent`).
   - `advanceHandoff(handoffId, to)` — `sent→matched→affirmed`, advancing both the handoff
     and its `trades`, via `recordEvent()` (`handoff_advanced`). When all affirmed, flip the
     rfq → `affirmed`.
   - `openException` / `closeException` on `handoff_exceptions`, via `recordEvent()`.

## Acceptance / validation gate

- Payload generated and stored, **never transmitted** (assert no fetch/network in `lib/stp.ts`).
- All lifecycle advances go through `recordEvent()`; handoff + trades move atomically.
- Tenant-scoped reads only.
- `npm test` && `npx tsc --noEmit` pass.
