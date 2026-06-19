# Pitch video institutional cut plan

> Drafted 2026-06-19 from Randall's institutional video direction. This is the current v3 direction for the Remotion pitch video: less screenshot tour, more institutional story about control, evidence, governance, and auditability.

## Audience

Institutional investors evaluating Veloce as both prospective users and strategic capital.

Register:

- control
- evidence
- best-execution
- governance
- auditability
- segregation of duties
- operational risk
- vendor/model risk
- defensible decisions

Avoid non-institutional framing. Do not describe the product as a market-entry tactic, a broad capital-market slogan, a cumulative advantage claim, or an abstract AI layer. Also avoid claims that Veloce is a system of record for trades or an execution venue.

## Core story

OTC equity-derivatives execution is high-value, opaque, and hard to defend after the fact.

The decision is not `which quote wins`. It is the full lifecycle:

- who was invited
- who responded
- what liquidity existed
- why this award was chosen
- which policy exceptions fired
- who approved
- what payload was prepared
- what evidence survives review

Veloce turns that decision into a structured, governed, replayable record — a control and evidence layer that sits beside execution, not in it.

The point is not to promise better pricing. The point is a hard hedging decision a desk can defend under audit a year later; product-backed pilot math can support that control story without becoming an unsupported savings claim.

## Institutional framing

| Concept | Institutional framing |
| --- | --- |
| Pain | Large OTC hedges run on calls/chat/email. They are hard to compare, approve, evidence, and reconstruct under review. That is operational and regulatory risk, not only inefficiency. |
| Position | Parallel-run control and evidence layer for complex RFQs where best-execution, segregation of duties, and audit survivability matter. |
| Insight | Execution is a decision lifecycle, not a trade event. |
| Defensibility | Evidence continuity inside the desk's control workflow. Evidence and benchmarks are client-owned, serving the client's best-execution and dealer-transparency needs. |
| Promise | Make a complex award decision and still explain it later. |

Do not imply Veloce is or becomes an execution venue or system of record for trades. Sitting beside execution is a feature for this audience: lighter diligence, no regulatory entanglement to inherit.

## Story spine

```text
fragmented decision
  -> structured record
  -> governed approval
  -> defensible evidence
  -> pricing proof as supporting evidence
```

Destination: hardest hedging decisions become provable.

## 30-second institutional story

| Time | Beat | Motion language | On-screen copy |
| ---: | --- | --- | --- |
| 0-4s | Old world | Specific fragments appear: chat, email, spreadsheet, phone log. They feel legible, not generic. They collapse into one RFQ record. | `A $250M hedge starts as calls, chats, spreadsheets, and inbox evidence.` |
| 4-10s | Decision problem | Decision graph assembles sequentially around the RFQ: invited -> responded -> liquidity -> allocation -> concentration -> exception -> approval -> evidence. | `The winning quote is only part of the decision.` |
| 10-17s | Governance moment | Concentration check fires amber: `38% vs 35% cap`; exception logs; approver acknowledgment stamps the record. This is the climax. | `Veloce structures and governs the decision before execution.` |
| 17-23s | Pricing proof | Two partial quotes stack into a blended award: `2.656% blended` vs `2.79% best single`; `13.4 bps`; `$335,000 on $250M`. | `Pilot math supports best-execution evidence.` |
| 23-30s | Evidence close | Evidence artifacts stack into one packet: event log, quote ladder, approval, FpML-style prepared payload. One packet multiplies into client-owned best-ex / dealer-performance view. | `Every decision leaves a record that survives review.` |

## On-screen numbers

Only use product-backed figures from the current seeded/mock workflow:

- Blended `2.656%` vs best single `2.79%`
- `13.4 bps`
- `$335,000 on $250M`
- Concentration breach: `38%` vs `35%` policy cap
- Best-ex deviation flag: award differs from best quoted price -> mandatory note / auto-exception
- FpML-style capture payload prepared, not transmitted

## Remotion implementation direction

V3 should use Remotion as a narrative layer, not as a screenshot pan tool.

Build motion-native scenes:

- `OldWorldFragments`: chat/email/spreadsheet/phone-log cards collapse into a single RFQ record.
- `DecisionLifecycle`: graph nodes assemble sequentially around the RFQ record.
- `GovernanceMoment`: policy check fires amber, exception is acknowledged, rationale is captured.
- `PricingProof`: partial liquidity bars combine into a blended award and compare against best single quote.
- `EvidencePacket`: event log, quote ladder, approval, and payload cards stack into one evidence packet, then multiply into a client-owned best-ex view.

Screenshots should appear as receipt panels inside the sequence, not dominate the sequence.

## Required guardrails

- Final disclaimer: `Parallel-run pilot · mock data · no live trading`.
- Say `beside execution`, not `in execution`.
- Say `prepared payload`, not transmitted payload.
- Say client-owned evidence/benchmarks.
- Do not imply execution venue, production trading, broker connectivity, or trade system of record.

## Current implementation contract

- Current cut: institutional v3 story map in `VelocePitch30`.
- Composition contract remains `VelocePitch30`, 900 frames, 1920×1080, 30fps.
- Remotion-native scenes should cover fragments, decision lifecycle, governance, pricing proof, and evidence packet.
- Screenshots remain brief receipt panels using existing `ScreenshotScene`/assets where useful.
- `docs/pitch-video-remotion-plan.md` is the current v3 implementation reference.
- `docs/pitch-video-v2-plan.md` remains prior critique-driven rationale, not the current cut.
- Site copy should describe the video as an institutional control/evidence story.
- Main owns final render, render metadata, visual-frame review, tests, typecheck, lint, build, and browser embed verification after the composition is approved.
