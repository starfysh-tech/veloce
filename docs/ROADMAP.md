# Veloce — MVP → Commercial Roadmap

> Status: **for review.** Drafted 2026-06-18 against `main` at the close of the
> A–G arc (117 tests green, decision-consistency review passed). This is a
> planning document, not a locked-decision set. Each track below needs the same
> design-tree treatment the MVP got before its items become binding work.
>
> Companion docs: `HANDOFF.md` (locked MVP decisions), `open-decisions.md`
> (per-block resolutions D-1…D-9 and accepted gaps).

## How to read this

The MVP was a **parallel-run pilot, functional not certified** (Decision 1).
Almost every deferral that made the pilot shippable becomes blocking for
commercial use. So this roadmap is mostly "pay down the deferrals, in dependency
order" — and the deferrals are already logged with file:line evidence in
`open-decisions.md` and the `Decision N` set in `HANDOFF.md`.

The work splits into **four roughly independent tracks**. They are ordered by
**what unblocks revenue**, not by what is fun or fast to build. For an OTC
derivatives venue serving insurers, the gating constraint is almost never the
code — it is the trust and compliance posture that lets a regulated buy-side
firm and a dealer bank legally route real flow through the platform.

Confidence is called out per track. Tracks 2–4 are standard hard-mode SaaS
commercialization with derivatives-specific flavor; they can be planned with
reasonable confidence. **Track 1 (regulatory) can only be framed here, not
answered — it needs securities counsel, and a confident-sounding guess would be
a liability.**

---

## Track 1 — Regulatory & legal (the real gate; longest lead time)

First because it has the longest calendar lead time and because everything
downstream is wasted effort if the classification comes back differently than
assumed. **Most of this is not engineering.** Engage counsel before building
venue features, not after.

### R-1. Regulatory classification of the auction **(gates everything in Track 3)**
The hardest open question, and the one that can reshape the product. A timed
multi-dealer auction that **determines execution price** may implicate
SEF/MTF-style venue regulation, broker/ATS rules, or none of the above —
depending on jurisdiction, product, and exactly how price formation works. The
pilot sidesteps this by keeping execution on existing rails (Decision 1, Decision
12: `lib/stp.ts` generates and persists capture payloads but **never transmits**,
enforced by an allowlist test). Commercial use, where Veloce *is* the execution
venue, may not.
- **Needs: securities counsel ruling before Track 3 venue work begins.** Claude
  cannot and should not rule on this.
- **Why it gates Track 3:** if Veloce is classified as a regulated venue, the
  STP-transmission work (T3-1) and the governance model (T3-2) acquire hard
  regulatory requirements, not just product requirements.

### R-2. Entity, licensing, jurisdiction
Which registrations, in which markets, for which products. Insurer clients add
an insurance-regulatory overlay on top of securities law. **Needs counsel.**

### R-3. Dealer & client legal onboarding
Real ISDA/CSA relationships, platform participation agreements, terms of use,
data-handling agreements. This is the bank-onboarding work the pilot explicitly
deferred (Decision 1). Slow; gates real dealer participation at any scale beyond
hand-managed pilot counterparties.

### R-4. Best-execution & recordkeeping as legal obligations
The MVP's append-only `events` table (Decision 7) was built for the *governance
story* — an immutable, atomically-written audit log. Commercially it may need to
satisfy actual recordkeeping regulation: retention periods, immutability
guarantees a regulator will accept, regulator-accessible export. **The
architecture is a strong foundation; "good architecture" and "meets the
retention rule" are different bars.** Needs counsel to set the bar, then likely a
modest engineering follow-on (retention policy, WORM-style storage or equivalent
attestation, export format).

---

## Track 2 — Security & trust posture (gates enterprise procurement)

No insurer's vendor-risk review approves a platform without most of this. Runs
**in parallel with Track 1** — both are calendar-bound in ways code is not, so
both start now.

### S-1. SOC 2 Type II **(start the clock immediately)**
Deferred in Decision 1. Type II requires an observation window (typically several
months) on top of remediation, so the calendar — not the work — is the
constraint. Frequently the single hard gate in enterprise procurement. **Start
before it is convenient.**

### S-2. Third-party penetration test & security audit
Priority targets are the novel trust boundaries: the **masking projection**
(`lib/auth/mask.ts`) and the **dealer capability-token model**
(`lib/auth/caller.ts:resolveDealerToken`). These are the parts no auditor has
seen before and where a subtle flaw is highest-impact.

### S-3. Secrets management & rotation
Rotate anything that touched a shared environment or a chat during the build
(the GitHub PAT and any dev DB string already qualify). Move to a managed secrets
store; enforce least-privilege on the Supabase service-role key, which currently
backs all privileged server writes (Decision 5).

### S-4. Auth hardening
MFA; SSO/SAML for enterprise buy-side (deferred as premature for the pilot —
becomes table stakes for an insurer); session policy. Audit the dealer-token
lifecycle under adversarial assumptions (token leakage, replay, post-deadline
access — note the known `resolveDealerToken` read-state gap logged in
`open-decisions.md` Block A gaps, where a valid token still loads the read-only
page after deadline though writes are blocked separately).

### S-5. Data residency, encryption, demonstrable tenant isolation
At rest, in transit, and per-tenant. The `firmId` scoping (Decision 3) is
correct-by-convention today; a vendor review may demand **demonstrable**
isolation (RLS enforced as the second layer it was designed to be, plus
evidence), not just disciplined query scoping.

### S-6. Attachment upload hardening
The deferred virus/type scanning (Decision 24 — MVP does MIME/size only, see D-9)
becomes real the moment you stop controlling every uploading party. Pair with
S-2.

---

## Track 3 — Product depth (the deferred gaps + what real usage demands)

Sequence **by what the first paying design partner actually blocks on** — likely
T3-1 (real STP) and T3-2 (governance) first. Resist building the tractable,
visible product work ahead of Tracks 1–2; that is the trap.

### T3-1. Real STP connectivity **(largest single build; gated by R-1)**
Replace the persisted-but-internal payload (Decision 12, `lib/stp.ts`) with real
MarkitWire/DTCC/OMS integration via FIX or API. Each integration carries its own
certification. The capture-payload generation already exists and is tested; this
adds the transmission layer the pilot deliberately omitted. **Do not start before
R-1 — classification determines whether this carries regulatory requirements.**

### T3-2. Configurable governance / two-person approval **(documented Decision 21 gap)**
The first thing to revisit on conversion. The `>$250M` two-person committee rule
currently **displays the requirement but enforces single-approver-plus-note**
(Decision 21; `app/(app)/approvals/actions.ts` `committeeNote`, ≥20-char
server-enforced). The `approvals` join table we specced and chose not to build is
the known remediation. Generalize to **configurable approval chains per firm**,
since different institutions have different thresholds and committee structures.
Scoped, not a surprise — it is logged as an honest gap.

### T3-3. FX-normalized concentration & exposure **(documented Decision 20 gap)**
Concentration currently **sums all notionals as USD** and labels itself
"indicative, single-currency (USD) basis" (Decision 20;
`lib/queries/concentration.ts` `TODO(multi-ccy)`, with the EUR trade dropped, not
blended). Indicative-USD stops being good enough the moment a second design
partner or a non-USD-heavy book appears. Needs a real FX source and a defensible
exposure methodology. **Trigger: second tenant, or first materially non-USD
book.**

### T3-4. Multi-tenant operation **(Decision 3 built the schema, deferred the operation)**
The schema carries `firmId` everywhere; there is no tenant-onboarding or
tenant-management UI, and the bank-panels admin is the only editable surface
(Decision 22 / D-8, ratified for bank-panels only). The "second design partner"
moment turns the unused multi-tenant columns into live infrastructure: onboarding
flow, per-tenant config, admin sections promoted from read-only (each already
carries a TODO comment marking what editability needs, per D-8).

### T3-5. Trade-transcription fallback **(deferred, Decision 2)**
A buy-side user submitting a quote on a dealer's behalf for dealers who will not
click a magic-link — one extra field on the quote path, no transcription code
exists yet. Low effort; sequence by whether real dealers actually refuse the
link.

### T3-6. Product coverage & term-modeling depth
Beyond the pilot's instrument set; the term-modeling depth real desks need.
Templates are a typed constant today (D-4, `lib/templates.ts`); productizing may
move them to per-firm persisted config.

### T3-7. Notification depth
Beyond transactional email (Decision 9, `lib/email.ts`): preferences, digests,
escalation. Also absorbs the **email-delivery-failure-invisible** gaps logged in
Block A and Block B (a down Resend silently swallows invitation and
award-approved sends) — the specced fix is an outbox/retry with a "resend"
affordance, which both blocks inherit once built.

---

## Track 4 — Scale & operations (gates reliability, not first revenue)

Has to be done before you *depend* on revenue, not before you can demo.

### O-1. Move off Hobby-tier constraints & re-validate the lazy sweep
The lazy auction sweep (Decision 19, `lib/auction-status.ts`) was partly a
Hobby-plan workaround for the sub-daily-cron limit — but it was a *good*
architectural choice (correctness lives in the write path, not the scheduler),
not only a workaround. At commercial volume, validate it holds under load, or
decide whether real scheduled processing is wanted alongside it.

### O-2. Observability
Error tracking, structured logging, uptime monitoring, alerting. A regulated
venue needs an operational posture, not just a green deploy.

### O-3. Database scale & connection management
Under real concurrency. The serverless-pooler choices (Decision 5) need load
validation. Several known races become more than "astronomically rare" under
load and should be hardened: the `nextExceptionRef` SELECT-MAX+1 race and the
re-recommend-after-reject `awards` unique-constraint block (both logged in
`open-decisions.md` Block B gaps) — Postgres sequences are the durable fix
flagged there.

### O-4. Incident response, DR, backup/restore drills
Provable, not theoretical, for a system of record holding trade data.

### O-5. Auction concurrency & Realtime load
The Realtime-as-signal-then-refetch pattern (Decision 18) is correct but chattier
under load (every quote change triggers a board refetch for every watcher).
Validate under realistic concurrent-auction load; consider debounce/coalescing if
it bites.

---

## Suggested sequencing

The instinct is to build Track 3 first because it is tractable and visible. **That
is the trap.** Tracks 1 and 2 have the longest lead times and gate whether you can
sell at all.

1. **This month, in parallel:** engage securities counsel on R-1 (classification)
   and start the S-1 (SOC 2) clock. Both are calendar-bound; neither is code.
2. **As counsel reports back:** let R-1 shape Track 3. If Veloce is a regulated
   venue, T3-1 and T3-2 acquire regulatory requirements and their specs change.
3. **Track 3 by design-partner pull:** sequence by what the first paying customer
   actually blocks on — most likely T3-1 (real STP) and T3-2 (governance).
4. **Track 4 before revenue dependence:** the reliability work that must precede
   relying on the platform, but not relying on the demo.

## Confidence & caveats

- **Tracks 2–4:** reasonable confidence. Standard commercialization with
  derivatives flavor; plannable now.
- **Track 1:** framed, not answered. The regulatory classification of a
  price-forming multi-dealer auction for OTC equity derivatives is a specialist
  legal question with consequences for the entire product shape. **Get that
  ruling early; it may reshape this roadmap.**

## Next step

Each track deserves the same design-tree walk the MVP got — decisions made
explicit, trade-offs surfaced, assumptions validated — before its items become
binding work. Track 3 can be taken furthest immediately, since it is mostly
downstream of decisions already in `open-decisions.md`. Track 1 should be opened
with counsel, not with a design-tree walk.
