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

Confidence is called out per track. Tracks 2 and 4 are standard hard-mode SaaS
commercialization with derivatives-specific flavor; they can be planned with
reasonable confidence now. **Track 3 is mostly plannable now, with one
exception: T3-1 (real STP) and T3-2 (governance) are regulatory-contingent —
their specs change if R-1 classifies Veloce as a venue, so do not finalize them
ahead of R-1.** **Track 1 (regulatory) can only be framed here, not answered —
it needs securities counsel, and a confident-sounding guess would be a
liability.**

---

## Track 1 — Regulatory & legal (the real gate; longest lead time)

First because it has the longest calendar lead time and because everything
downstream is wasted effort if the classification comes back differently than
assumed. **Most of this is not engineering.** Engage counsel before building
venue features, not after.

### R-0. Compile & classify the pilot instrument list **(prerequisite for R-1; do first)**
R-1 cannot be answered in the abstract — its answer is **data-dependent on which
instruments Veloce intends to support**, because the SEC/CFTC jurisdictional
split turns on index breadth (see R-1). Before counsel can rule, produce a single
table: every structure in scope, its underlying, and whether that underlying is a
single name, a **narrow-based** security index, or a **broad-based** index. From
the current seed data the structures are SPX / NDX / RTY / SX5E / UKX
puts/collars/spreads, an SX5E variance swap, and a **custom 32-name basket
overlay** (`db/seed-data.ts`). The broad indices likely point CFTC; the custom
basket is the one most likely to be narrow-based and land under SEC jurisdiction.
- **"Broad-based security index" has a specific regulatory definition** (component
  count and concentration tests under the SEC/CFTC joint rules). **Do not rely on
  this roadmap's characterization of any instrument as broad or narrow — that
  classification is counsel's to make.** The roadmap's job is to surface the
  question and hand over the list, not to answer it.
- Effort: low (it is a list), but it gates the highest-lead-time item, so it is
  literally the first thing to do.

### R-1. Regulatory classification of the auction **(gates T3-1, T3-2; needs R-0 + counsel)**
The hardest open question, and the one that can reshape the product. A timed
multi-dealer auction that **determines execution price** may require registration
as a venue. The specific US framework is **SEC Regulation SE** (adopted Nov 2023),
which created the **security-based swap execution facility (SBSEF)** regime under
Exchange Act Section 3D, modeled on the CFTC's SEF rules, with 14 Core Principles.
The threshold question: is Veloce "a facility for the trading or processing of
SBS" that must register as an SBSEF (or national securities exchange)?
- **The jurisdiction depends on the product mix (this is the key finding).** The
  **SEC** governs security-based swaps (single-name / narrow-index equity); the
  **CFTC** governs swaps (broad-based index). Veloce's pilot spans both, so
  **which regulator's venue rules apply — possibly both — depends on R-0's
  classification.** This is why R-0 comes first.
- The pilot sidesteps all of this by keeping execution on existing rails
  (Decision 1; Decision 12: `lib/stp.ts` generates and persists capture payloads
  but **never transmits**, enforced by an allowlist test). Commercial use, where
  Veloce *is* the execution venue, may not.
- **Needs: R-0 complete, then securities counsel ruling before Track 3 venue work
  begins.** Claude cannot and should not rule on this.
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
satisfy actual recordkeeping regulation. If R-1 lands on SBSEF/SBS, the specific
bars are knowable today: **Regulation SBSR Rule 901** (reporting executed SBS to
a registered SDR), and the SBS recordkeeping rules — **Exchange Act Rules
17a-3/17a-4** (broker-dealers) and **18a-5/18a-6** (SBSDs) — which set retention
periods, required data elements (execution date/time, notional, currency,
counterparty UIC), and immutability expectations. **The architecture is a strong
foundation; "good architecture" and "meets the retention rule" are different
bars.** Counsel sets which rules apply; the engineering follow-on (retention
policy, WORM-style storage or equivalent attestation, regulator-accessible
export) is then scoped against the named rule, not invented.

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

## What we included to start (the initial cut)

This roadmap is deliberately a **first cut, not a committed plan.** What is in it
right now:

- **Four tracks**, derived by walking every MVP deferral logged in
  `open-decisions.md` and asking "what makes this commercial?" — plus the
  regulatory and trust dimensions the pilot was allowed to skip.
- **Each item cross-referenced to evidence** — a `Decision N`, a `D-n`
  resolution, or a `file:line` — so nothing here is a vibe; it traces to
  something real in the codebase or the decision log.
- **External references verified against primary sources** (SEC, CFTC, AICPA,
  ISDA) on 2026-06-18, with the one product-shaping finding (the SEC/CFTC split
  depends on instrument mix) promoted into R-0 and R-1.

What is **deliberately not** in it yet: cost estimates, effort sizing beyond
rough labels, a committed timeline, and — most importantly — anything downstream
of the R-1 classification, which can reshape Track 3. Those are filled in
incrementally as the gating unknowns resolve.

## How to move forward (incremental, gating-first)

The method mirrors how the MVP was built: **resolve the highest-leverage unknown
first, let its answer shape the next layer, never commit work that a pending
decision could invalidate.** Concretely:

1. **Start the two calendar-bound, code-free items this month, in parallel.**
   They have the longest lead times and gate whether you can sell at all:
   - **R-0 → R-1:** compile the instrument list (R-0, low effort, days), hand it
     to securities counsel, get the classification (R-1, weeks-to-months).
   - **S-1:** start the SOC 2 clock (the observation window is months regardless
     of how fast the controls work lands).
   The instinct is to build Track 3 first because it is tractable and visible.
   **That is the trap** — it is the one thing that can be invalidated by R-1.

2. **Let R-1's answer gate Track 3.** Do not finalize T3-1 (real STP) or T3-2
   (governance) before R-1 returns. If Veloce is a venue, both acquire regulatory
   requirements and their specs change. Everything else in Track 3 (T3-3 through
   T3-7) is not regulatory-contingent and can proceed on product pull.

3. **Sequence each track with its own design-tree walk, one at a time, when its
   gate clears.** Each track becomes binding work only after the MVP-style
   treatment: decisions made explicit, trade-offs surfaced, assumptions
   validated, logged in `open-decisions.md` with the same `D-n` discipline. Do
   not pre-plan a track whose inputs are still pending — that just creates
   rework when the gate resolves differently than assumed.

4. **Track 3 by design-partner pull.** Within the non-gated items, sequence by
   what the first paying customer actually blocks on, not by what is interesting
   to build.

5. **Track 4 before revenue dependence, not before the demo.** The reliability
   work (observability, DR, load validation, the known concurrency races in
   O-3) must precede *relying* on the platform commercially, but it does not gate
   a pilot or a demo.

6. **Re-verify the references when you act on them.** Regulatory and SOC 2
   guidance moves (the AICPA already revised its applying-guidance in March
   2026). Treat the External References section as current-as-of-draft, not
   evergreen — re-check before a track that depends on it goes binding.

**The throughline:** this document gets *more* certain over time, not less, as
each gating unknown resolves and feeds the next track's design-tree walk. It is
structured to be revised — every item has a stable ID (R-n, S-n, T3-n, O-n) so
updates and resolutions can be tracked against it the way `D-n` decisions were
tracked against the MVP.

## Confidence & caveats


- **Tracks 2–4:** reasonable confidence. Standard commercialization with
  derivatives flavor; plannable now.
- **Track 1:** framed, not answered. The regulatory classification of a
  price-forming multi-dealer auction for OTC equity derivatives is a specialist
  legal question with consequences for the entire product shape. **Get that
  ruling early; it may reshape this roadmap.**

## External references

Primary sources, verified current as of 2026-06-18. These are starting points
for the specialist conversations, **not** substitutes for them — especially
counsel on Track 1. Cited because they are the actual governing authorities a
lawyer or auditor will work from, not secondary summaries.

### Track 1 — regulatory (give these to securities counsel)

- **SEC Regulation SE — Registration and Regulation of Security-Based Swap
  Execution Facilities** (adopted Nov 2, 2023). This is the framework R-1 turns
  on: it created the SBSEF regime under Exchange Act Section 3D, explicitly
  modeled on the CFTC's SEF rules, with 14 Core Principles. The threshold
  question for Veloce is whether a price-forming multi-dealer auction for
  security-based swaps is "a facility for the trading or processing of SBS" that
  must register as an SBSEF or national securities exchange.
  - Adopting release / press: https://www.sec.gov/news/press-release/2023-230
  - Final rule (full text, SEA Release 34-98845): https://www.sec.gov/files/rules/final/2023/34-98845.pdf
- **The SBS vs. swap split matters for which regulator.** The SEC governs
  security-based swaps (single-name / narrow-index equity); the CFTC governs
  swaps (broad-based index). Veloce's pilot instruments span both
  (single-name-ish hedges and broad-index SPX/SX5E structures), so **product mix
  may determine which regulator's venue rules apply, or both.** Counsel needs the
  exact instrument list to assess this. CFTC SEF background:
  https://www.cftc.gov/IndustryOversight/TradingOrganizations/SEF2
- **Regulation SBSR — Reporting and Dissemination of SBS Information.** Bears on
  R-4: if Veloce is a platform on which SBS are executed, Rule 901(a)(1) reporting
  duties to a registered SDR may attach.
  https://www.sec.gov/rules-regulations/2016/07/regulation-sbsr-reporting-dissemination-security-based-swap-information
- **SBS recordkeeping/reporting rules (Exchange Act Rules 17a-3/17a-4 for
  broker-dealers, 18a-5/18a-6 for SBSDs).** The bar R-4 must clear if real
  recordkeeping obligations attach to the `events` log. SEC adopting release:
  https://www.sec.gov/rules-regulations/2019/09/recordkeeping-reporting-requirements-security-based-swap-dealers-major-security-based-swap
- **ISDA** — for R-3 (dealer/client legal onboarding): Master Agreement, CSA, and
  the documentation architecture real counterparty relationships require.
  https://www.isda.org/

### Track 2 — security & trust

- **AICPA SOC 2 / Trust Services Criteria** (S-1). The current framework is the
  **2017 Trust Services Criteria with Revised Points of Focus (2022)**; Security
  (CC1–CC9) is the only mandatory criterion, the other four
  (Availability, Processing Integrity, Confidentiality, Privacy) are scoped in by
  choice. For an insurer-facing trade platform, expect Security + Availability +
  Confidentiality at minimum, likely Processing Integrity given it handles trade
  economics. Note: the AICPA **revised the applying-guidance in March 2026** — make
  sure any auditor works from the latest.
  https://www.aicpa-cima.com/resources/download/get-description-criteria-for-your-organizations-soc-2-r-report
- **Type II requires an observation window** (commonly 3–12 months) on top of
  remediation — this is the calendar constraint behind "start the clock now."

### Internal cross-references

- Locked MVP decisions: `docs/HANDOFF.md`
- Per-block resolutions (D-1…D-9) and accepted gaps: `docs/open-decisions.md`
- The deferrals this roadmap pays down are grounded in code: `lib/stp.ts`
  (no-transmit, Decision 12), `lib/queries/concentration.ts` (`TODO(multi-ccy)`,
  Decision 20), `app/(app)/approvals/actions.ts` (`committeeNote`, Decision 21).

## Next step

Each track deserves the same design-tree walk the MVP got — decisions made
explicit, trade-offs surfaced, assumptions validated — before its items become
binding work. Track 3 can be taken furthest immediately, since it is mostly
downstream of decisions already in `open-decisions.md`. Track 1 should be opened
with counsel, not with a design-tree walk.

One specific thing to hand counsel first: **the exact pilot instrument list**,
because the SEC/CFTC jurisdictional split (security-based swaps vs. swaps) turns
on whether each structure references a single name / narrow index or a broad
index — and that split determines which venue rules, if any, apply.
