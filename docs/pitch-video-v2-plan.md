# Pitch video v2 plan

> Drafted 2026-06-19 from the creative-director and investor critique of the first Remotion cut. This remains the rationale and critique-driven change record for the current v2 30-second pitch video.

## Goal

Make the pitch video resonate as a high-stakes institutional workflow story, not a procedural product tour.

V2 should communicate:

> Veloce turns one OTC RFQ decision into a controlled evidence record: dealer quotes, award rationale, approval gates, STP preview, and compliance evidence stay together through the parallel-run pilot.

## What changes from v1

V1 was accurate but too defensive and procedural. It showed that software exists. V2 should show why the workflow matters.

Changes:

- Open on the decision stakes instead of an abstract product problem.
- Follow one canonical RFQ-style narrative from trader to approver to ops to compliance.
- Use tighter video-native crops and callout-style captions.
- Give the quote board and approval gate more narrative weight.
- Use compliance and ops screens as proof moments, not unreadable flashes.
- Keep the pilot disclaimer, but stop repeating defensive language in every caption.

## Accuracy guardrails

- Show and say this is a parallel-run pilot with mock/seeded-demo data.
- Do not imply live trading, broker connectivity, automated execution, or production STP transmission.
- Position STP as previewed and persisted for operations review, not transmitted downstream.
- Avoid standalone quantified-outcome claims in video overlays.
- Final close must include: `Parallel-run pilot · mock data · no live trading`.

## Current v2 storyboard

| Frames | Seconds | Beat | Visual | Caption |
| ---: | ---: | --- | --- | --- |
| 0-89 | 0.0-3.0 | Stakes | Dark brand card with deal-focused copy | `A $250M OTC hedge. Multiple dealers. One award decision that has to survive review.` |
| 90-179 | 3.0-6.0 | Desk context | `trader-01-dashboard.png` | `The desk starts from a governed RFQ queue, not an inbox.` |
| 180-269 | 6.0-9.0 | Structure | `trader-03-create.png` | `Structure the request once. Invite the controlled panel.` |
| 270-449 | 9.0-15.0 | Auction decision | `trader-04-board.png` | `Blind responses stay beside the award rationale.` |
| 450-569 | 15.0-19.0 | Approval tension | `approver-02-queue.png` | `Policy warnings surface before the record advances.` |
| 570-659 | 19.0-22.0 | Approval detail | `approver-03-detail.png` | `Exceptions, rationale, and STP guardrails move with the award.` |
| 660-749 | 22.0-25.0 | Ops handoff | `ops-03-payload.png` | `Ops reviews a persisted STP preview — not a live transmission.` |
| 750-839 | 25.0-28.0 | Compliance proof | `compliance-03-concentration.png` | `Compliance reviews the same evidence record after the decision.` |
| 840-899 | 28.0-30.0 | Close | Brand card | `Veloce turns RFQ workflow into a controlled evidence record.` |

## V2 asset set

Primary v2 screenshots in `public/pitch/`:

- `site/images/trader-01-dashboard.png` → `public/pitch/trader-01-dashboard.png`
- `site/images/trader-03-create.png` → `public/pitch/trader-03-create.png`
- `site/images/trader-04-board.png` → `public/pitch/trader-04-board.png`
- `site/images/approver-02-queue.png` → `public/pitch/approver-02-queue.png`
- `site/images/approver-03-detail.png` → `public/pitch/approver-03-detail.png`
- `site/images/ops-03-payload.png` → `public/pitch/ops-03-payload.png`
- `site/images/compliance-03-concentration.png` → `public/pitch/compliance-03-concentration.png`

Supporting assets retained in `public/pitch/`:

- `trader-02-blotter.png`
- `compliance-02-bestex.png`

## Motion direction

- Use fewer generic pans; make each move point to a decision artifact.
- Use tighter crops so video viewers can read the important panel in under two seconds.
- Keep dense screenshots on screen long enough to understand, or crop to the one control that matters.
- Prefer confident editorial pacing over screen-recording pacing.
- No bounce, CSS transitions, or unsupported animation. Continue using Remotion frame-driven interpolation only.

## Copy direction

Use buyer/investor-relevant stakes rather than implementation labels.

Better lines:

- `A $250M OTC hedge. Multiple dealers. One award decision that has to survive review.`
- `Structure the request once. Invite the controlled panel.`
- `Blind responses stay beside the award rationale.`
- `Policy warnings surface before the record advances.`
- `Ops reviews a persisted STP preview — not a live transmission.`
- `Compliance reviews the same evidence record after the decision.`
- `Veloce turns RFQ workflow into a controlled evidence record.`

Avoid:

- procedural tour framing
- repeated `mock data` in every scene
- standalone quantified-outcome overlays
- generic process labels like `Create RFQ` unless the UI itself is the focus

## Implementation reconciliation

- The current v2 cut follows the frame map above while preserving the `VelocePitch30` composition contract: 900 frames, 1920×1080, 30fps.
- `docs/pitch-video-remotion-plan.md` is the current implementation reference; this file explains why v2 changed.
- Site copy should introduce the video as a controlled evidence-record pitch, not a generic product tour.
- Final render and project-wide verification are owned by the main session.
