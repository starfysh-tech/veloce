# Current 30-second Veloce pitch video Remotion plan

## Goal

Maintain the v2 30-second screenshot-led pitch video that frames Veloce as a controlled evidence-record workflow for OTC RFQs: dealer quotes, award rationale, approval gates, STP preview, and compliance evidence stay together through the parallel-run pilot.

The durable render target is a Remotion composition named `VelocePitch30`, 1920×1080, 30fps, 900 frames, rendered to `out/veloce-pitch-30s.mp4`.

## Audience assumption

Primary audience: experienced financial-services operators, compliance leaders, and pilot sponsors who need to understand why the workflow matters without being shown a live production system.

The video should feel like a concise institutional pitch for a parallel-run pilot: sharp on stakes, explicit about guardrails, and clear that the demo uses mock/seeded data.

## Accuracy guardrails

- Say and show that this is a parallel-run pilot using mock/seeded-demo data.
- Do not imply live trading, automated execution, broker connectivity, or production STP transmission.
- Position STP as previewed and persisted for operations review, not transmitted downstream.
- Keep the story anchored to visible MVP capabilities: governed RFQ queue, RFQ creation, dealer board, approval queue/detail, operations payload preview, and compliance evidence.
- Avoid unverified quantified outcome, regulatory, or adoption claims.
- Final close must include: `Parallel-run pilot · mock data · no live trading`.

## Recommended screenshot-led approach

Use the existing static product screenshots as the primary source of truth. The video should rely on slow frame-driven pans and zooms, short lower-third captions, and simple branded intro/outro cards.

Implementation rules:

- Store copied screenshots in `public/pitch/`.
- Reference images with `staticFile()` and render them with Remotion `<Img>`.
- Drive motion with `useCurrentFrame()`, `useVideoConfig()`, and `interpolate()`.
- Use `<Sequence>` with `premountFor={30}` for screenshot scenes.
- Do not use CSS transitions, CSS keyframes, Tailwind animation classes, native `<img>`, Next.js `<Image>`, or CSS `background-image`.

## Current v2 storyboard

| Section | Frames | Seconds | Visual | Message |
| --- | ---: | ---: | --- | --- |
| Stakes | 0-89 | 0.0-3.0 | Dark branded intro card | A $250M OTC hedge, multiple dealers, and one award decision that has to survive review. |
| Desk context | 90-179 | 3.0-6.0 | `trader-01-dashboard.png` | The desk starts from a governed RFQ queue, not an inbox. |
| Structure | 180-269 | 6.0-9.0 | `trader-03-create.png` | Structure the request once and invite the controlled panel. |
| Auction decision | 270-449 | 9.0-15.0 | `trader-04-board.png` | Blind responses stay beside the award rationale. |
| Approval tension | 450-569 | 15.0-19.0 | `approver-02-queue.png` | Policy warnings surface before the record advances. |
| Approval detail | 570-659 | 19.0-22.0 | `approver-03-detail.png` | Exceptions, rationale, and STP guardrails move with the award. |
| Ops handoff | 660-749 | 22.0-25.0 | `ops-03-payload.png` | Ops reviews a persisted STP preview, not a live transmission. |
| Compliance proof | 750-839 | 25.0-28.0 | `compliance-03-concentration.png` | Compliance reviews the same evidence record after the decision. |
| Close | 840-899 | 28.0-30.0 | Dark branded outro card | Veloce turns RFQ workflow into a controlled evidence record. |

## Scene implementation notes

| Scene | Asset | Primary caption | Detail line | Suggested motion |
| --- | --- | --- | --- | --- |
| Stakes | Logo card | "A $250M OTC hedge. Multiple dealers. One award decision that has to survive review." | "Veloce keeps dealer quotes, award rationale, controls, and evidence in one pilot record." | Fade in headline and detail quickly enough that both remain readable. |
| Desk context | `trader-01-dashboard.png` | "The desk starts from a governed RFQ queue, not an inbox." | "Seeded parallel-run workflow, scoped to the buyer desk." | Slow crop toward queue status and governance signals. |
| Structure | `trader-03-create.png` | "Structure the request once. Invite the controlled panel." | "Terms, economics, dealer panel, and launch checks stay attached." | Start wide, slowly zoom toward the RFQ form and dealer selection. |
| Auction decision | `trader-04-board.png` | "Blind responses stay beside the award rationale." | "Dealer levels and split allocation context remain in the same record." | Pan from board summary toward bid rows and award fields. |
| Approval tension | `approver-02-queue.png` | "Policy warnings surface before the record advances." | "Approvers see warnings and open exceptions before sign-off." | Tighten on exception and review-state cues. |
| Approval detail | `approver-03-detail.png` | "Exceptions, rationale, and STP guardrails move with the award." | "Approval context travels with the evidence record." | Slight zoom into the approval detail and policy context. |
| Ops handoff | `ops-03-payload.png` | "Ops reviews a persisted STP preview — not a live transmission." | "Preview payload is saved for review; no broker connectivity is implied." | Slow zoom toward payload detail and status metadata. |
| Compliance proof | `compliance-03-concentration.png` | "Compliance reviews the same evidence record after the decision." | "Concentration, exceptions, and best-ex evidence are reviewed from the pilot record." | Hold on the evidence workspace; avoid fast motion over dense data. |
| Close | Logo card | "Veloce turns RFQ workflow into a controlled evidence record." | "Dealer quotes, award rationale, approval gates, STP preview, and compliance evidence stay together. / Parallel-run pilot · mock data · no live trading" | Fade out after the disclaimer has been readable for at least one second. |

## Visual direction

- Style: institutional, dark, high-contrast, calm motion.
- Background: deep navy/charcoal with subtle gradients or grid accents.
- Accent: restrained green or cyan for successful controls and handoff points.
- Typography: large concise headlines, readable lower thirds, no dense paragraphs on screen.
- Motion: slow 3-5% zooms and small pan offsets to guide attention across screenshots.
- Captions: lower-third blocks with one primary phrase and one optional detail line.
- Cuts: simple sequence changes or short opacity fades driven by frame interpolation.

## Asset list

These source screenshots are copied into Remotion's public asset path:

| Source | Remotion path | Use |
| --- | --- | --- |
| `site/images/trader-01-dashboard.png` | `public/pitch/trader-01-dashboard.png` | Governed RFQ queue / desk context |
| `site/images/trader-03-create.png` | `public/pitch/trader-03-create.png` | RFQ setup / controlled panel |
| `site/images/trader-04-board.png` | `public/pitch/trader-04-board.png` | Dealer board / award rationale |
| `site/images/approver-02-queue.png` | `public/pitch/approver-02-queue.png` | Approval queue / policy warnings |
| `site/images/approver-03-detail.png` | `public/pitch/approver-03-detail.png` | Approval detail / STP guardrails |
| `site/images/ops-03-payload.png` | `public/pitch/ops-03-payload.png` | Persisted STP payload preview |
| `site/images/compliance-03-concentration.png` | `public/pitch/compliance-03-concentration.png` | Compliance evidence / concentration review |

`trader-02-blotter.png` and `compliance-02-bestex.png` are available supporting assets, but the v2 cut uses the dashboard and concentration screens for the desk-context and compliance-proof beats.

No external brand, market-data, broker, or trading-system assets are required.

## Remotion setup

Remotion is installed in the existing npm workspace, with package scripts:

```json
{
  "video:studio": "remotion studio remotion/index.ts",
  "video:render:pitch": "remotion render remotion/index.ts VelocePitch30 out/veloce-pitch-30s.mp4"
}
```

Expected Remotion files:

```text
remotion/index.ts
remotion/Root.tsx
remotion/VelocePitch30.tsx
remotion/components/Caption.tsx
remotion/components/ScreenshotScene.tsx
remotion/components/LogoCard.tsx
public/pitch/trader-01-dashboard.png
public/pitch/trader-03-create.png
public/pitch/trader-04-board.png
public/pitch/approver-02-queue.png
public/pitch/approver-03-detail.png
public/pitch/ops-03-payload.png
public/pitch/compliance-03-concentration.png
```

## Composition and timeline contract

Register one composition:

- Composition ID: `VelocePitch30`
- Entry: `remotion/index.ts`
- Root: `remotion/Root.tsx`
- Component: `remotion/VelocePitch30.tsx`
- Width: `1920`
- Height: `1080`
- FPS: `30`
- Duration: `900` frames
- Output: `out/veloce-pitch-30s.mp4`

Timeline:

```text
Stakes:            0-89
Desk context:      90-179
Structure:         180-269
Auction decision:  270-449
Approval tension:  450-569
Approval detail:   570-659
Ops handoff:       660-749
Compliance proof:  750-839
Close:             840-899
```

Component responsibilities:

- `Caption` renders reusable readable lower-third copy.
- `ScreenshotScene` handles image loading, crop, scale, pan, and caption overlay.
- `LogoCard` renders intro/outro cards without external assets.
- `VelocePitch30` owns the 900-frame sequence order and scene copy.

Reference implementation outline:

```tsx
<Composition
  id="VelocePitch30"
  component={VelocePitch30}
  durationInFrames={900}
  fps={30}
  width={1920}
  height={1080}
/>
```

```tsx
<Sequence from={270} durationInFrames={180} premountFor={30}>
  <ScreenshotScene
    src="pitch/trader-04-board.png"
    caption="Blind responses stay beside the award rationale."
    detail="Dealer levels and split allocation context remain in the same record."
    startScale={1.1}
    endScale={1.2}
  />
</Sequence>
```

Use local sequence frames inside reusable scene components: `useCurrentFrame()` inside `ScreenshotScene` should start at `0` for each scene because it is mounted inside that scene's `<Sequence>`.

## Preview and render commands

Preview locally:

```bash
npm run video:studio
```

Render the approved composition:

```bash
npm run video:render:pitch
```

Equivalent direct render command:

```bash
remotion render remotion/index.ts VelocePitch30 out/veloce-pitch-30s.mp4
```

After rendering, inspect the media metadata with available local tooling and confirm approximately 30 seconds at 1920×1080.

## Voiceover script

Use this as optional narration or as timing guidance for on-screen captions.

| Section | Script |
| --- | --- |
| Stakes | "A $250M OTC hedge. Multiple dealers. One award decision that has to survive review." |
| Desk context | "The desk starts from a governed RFQ queue, not an inbox." |
| Structure | "Veloce captures the request once and invites the controlled panel." |
| Auction decision | "Blind responses stay beside the award rationale." |
| Approval | "Policy warnings, exceptions, rationale, and STP guardrails move with the award." |
| Ops handoff | "Operations reviews a persisted STP preview, not a live transmission." |
| Compliance proof | "Compliance reviews the same evidence record after the decision." |
| Close | "Veloce turns RFQ workflow into a controlled evidence record for a parallel-run mock-data pilot." |

## Current implementation contract

- Remotion scripts and dependencies are present in the npm workspace.
- V2 pitch screenshots live in `public/pitch/`.
- `VelocePitch30` remains registered at 1920×1080, 30fps, 900 frames.
- `Caption`, `ScreenshotScene`, and `LogoCard` use frame-driven Remotion animation.
- The v2 storyboard covers stakes, desk context, structure, auction decision, approval tension/detail, ops handoff, compliance proof, and close.
- The final card includes `Parallel-run pilot · mock data · no live trading`.

## Current decisions

- The current cut is captions-first; recorded voiceover and background music are optional future production choices.
- The close card remains a neutral brand close, not a conversion CTA.
- Pan and zoom choices should serve readable decision artifacts rather than generic screen-tour motion.
