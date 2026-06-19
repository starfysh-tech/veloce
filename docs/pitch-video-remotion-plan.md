# Approved 30-second Veloce pitch video Remotion plan

## Goal

Create a 30-second screenshot-led pitch video that explains Veloce's RFQ workflow from trader intent through approval, award rationale, compliance visibility, and downstream operations handoff.

The durable render target is a Remotion composition named `VelocePitch30`, 1920×1080, 30fps, 900 frames, rendered to `out/veloce-pitch-30s.mp4`.

## Audience assumption

Primary audience: experienced financial-services operators, compliance leaders, and pilot sponsors who need to understand the workflow quickly without being shown a live production system.

The video should feel like a controlled product walkthrough for a parallel-run pilot, not a launch claim or live-trading demonstration.

## Accuracy guardrails

- Say and show that this is a parallel-run pilot using mock data.
- Do not imply live trading, automated execution, broker connectivity, or production STP transmission.
- Position STP as previewed and persisted for operations review, not transmitted downstream.
- Keep the story anchored to visible MVP capabilities: RFQ creation, dealer board, approval detail, award/compliance rationale, and operations payload preview.
- Avoid unverified performance, savings, regulatory, or adoption claims.
- Final close must include: `Parallel-run pilot · mock data · no live trading`.

## Recommended screenshot-led approach

Use the existing static product screenshots as the primary source of truth. The video should rely on slow frame-driven pans and zooms, short lower-third captions, and simple branded intro/outro cards.

Implementation rules:

- Store copied screenshots in `public/pitch/`.
- Reference images with `staticFile()` and render them with Remotion `<Img>`.
- Drive motion with `useCurrentFrame()`, `useVideoConfig()`, and `interpolate()`.
- Use `<Sequence>` with `premountFor={30}` for screenshot scenes.
- Do not use CSS transitions, CSS keyframes, Tailwind animation classes, native `<img>`, Next.js `<Image>`, or CSS `background-image`.

## Storyboard

| Section | Frames | Seconds | Visual | Message |
| --- | ---: | ---: | --- | --- |
| Problem | 0-119 | 0.0-4.0 | Dark branded intro card | OTC RFQ evidence is hard to review when auction work, approvals, STP preview, and compliance records are split. |
| Auction | 120-269 | 4.0-9.0 | `trader-03-create.png` | Veloce structures the RFQ and dealer outreach in one controlled workspace. |
| Award math | 270-479 | 9.0-16.0 | `trader-04-board.png` | The mock scenario shows quote-board context and illustrative award math before the pilot record advances. |
| Controls | 480-659 | 16.0-22.0 | `approver-03-detail.png` | Approvers review exceptions, rationale, and STP guardrails before downstream handoff. |
| Downstream | 660-809 | 22.0-27.0 | `ops-03-payload.png`, then `compliance-02-bestex.png` | Operations reviews the persisted STP preview; compliance reviews best-ex evidence from mock pilot data. |
| Close | 810-899 | 27.0-30.0 | Dark branded outro card | Veloce connects auction, controls, and evidence for a parallel-run mock-data pilot. |

## Scene implementation notes

| Scene | Asset | Primary caption | Detail line | Suggested motion |
| --- | --- | --- | --- | --- |
| Problem | Logo card | "Problem: RFQ evidence is hard to review when work is split." | "This 30-second walkthrough uses mock data in a parallel-run pilot from trader action through approval, STP preview, and compliance review." | Fade in headline and detail over the first second. |
| Auction | `trader-03-create.png` | "Create the RFQ and move it into a dealer auction." | "Parallel-run pilot workflow with mock data." | Start wide, slowly zoom toward the RFQ form and dealer selection. |
| Award math | `trader-04-board.png` | "Illustrative award math stays visible before the pilot record advances." | "Seeded demo compares single-bank and blended allocation." | Pan from the board summary toward bid rows and award fields. |
| Approval controls | `approver-03-detail.png` | "Approvers review exceptions before any downstream handoff." | "STP is previewed and persisted, not transmitted." | Slight zoom into the approval detail and policy context. |
| Ops preview | `ops-03-payload.png` | "Ops reviews the persisted STP preview." | "Pilot payload only; no live trading transmission." | Slow zoom toward payload detail and status metadata. |
| Compliance evidence | `compliance-02-bestex.png` | "Compliance reviews best-ex evidence from the mock pilot data." | "Shared record, controlled workflow, no live trading." | Hold on the evidence workspace; avoid fast motion over dense data. |
| Close | Logo card | "Veloce connects auction, controls, and evidence." | "Parallel-run pilot · mock data · no live trading" | Fade out after the disclaimer has been readable for at least one second. |

## Visual direction

- Style: institutional, dark, high-contrast, calm motion.
- Background: deep navy/charcoal with subtle gradients or grid accents.
- Accent: restrained green or cyan for successful controls and handoff points.
- Typography: large concise headlines, readable lower thirds, no dense paragraphs on screen.
- Motion: slow 3-5% zooms and small pan offsets to guide attention across screenshots.
- Captions: lower-third blocks with one primary phrase and one optional detail line.
- Cuts: simple sequence changes or short opacity fades driven by frame interpolation.

## Asset list

Copy these source screenshots exactly into Remotion's public asset path:

| Source | Remotion path | Use |
| --- | --- | --- |
| `site/images/trader-03-create.png` | `public/pitch/trader-03-create.png` | RFQ setup / auction creation |
| `site/images/trader-04-board.png` | `public/pitch/trader-04-board.png` | Dealer board / bid comparison |
| `site/images/approver-03-detail.png` | `public/pitch/approver-03-detail.png` | Approval detail / award rationale |
| `site/images/compliance-02-bestex.png` | `public/pitch/compliance-02-bestex.png` | Best-execution controls |
| `site/images/ops-03-payload.png` | `public/pitch/ops-03-payload.png` | Persisted STP payload preview |

No external brand, market-data, broker, or trading-system assets are required.

## Remotion setup

Install Remotion in the existing npm workspace:

```bash
npm install --save-dev remotion @remotion/cli @remotion/renderer
```

Add package scripts:

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
public/pitch/trader-03-create.png
public/pitch/trader-04-board.png
public/pitch/approver-03-detail.png
public/pitch/compliance-02-bestex.png
public/pitch/ops-03-payload.png
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
Problem:    0-119
Auction:    120-269
Award math: 270-479
Controls:   480-659
Downstream: 660-809
Close:      810-899
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
<Sequence from={120} durationInFrames={150} premountFor={30}>
  <ScreenshotScene
    src="pitch/trader-03-create.png"
    caption="Structure the RFQ once"
    detail="Trader intent, invitation list, economics, and context stay together."
    startScale={1}
    endScale={1.05}
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
| Problem | "Private-credit RFQs still move through fragmented messages, spreadsheets, and manual checks." |
| Auction | "Veloce gives traders one controlled workspace to structure the RFQ and invite dealers." |
| Award math | "Bids, economics, approval context, and exception rationale stay visible before award." |
| Controls | "Compliance can review best-execution evidence and concentration impact in the same flow." |
| Downstream | "Operations receives a persisted STP payload preview for parallel-run review." |
| Close | "Veloce is a mock-data pilot for controlled RFQ workflows: no live trading." |

## Implementation checklist

- [ ] Install Remotion dev dependencies with npm and commit the lockfile changes.
- [ ] Add `video:studio` and `video:render:pitch` scripts.
- [ ] Copy the five pitch screenshots into `public/pitch/`.
- [ ] Register `VelocePitch30` in `remotion/Root.tsx` at 1920×1080, 30fps, 900 frames.
- [ ] Build `Caption`, `ScreenshotScene`, and `LogoCard` with frame-driven Remotion animation.
- [ ] Assemble the six storyboard sections in `VelocePitch30` with the contracted frame ranges.
- [ ] Confirm the final card includes `Parallel-run pilot · mock data · no live trading`.
- [ ] Preview in Remotion Studio and adjust framing only if captions or screenshot focal points are hard to read.
- [ ] Render `out/veloce-pitch-30s.mp4` and verify duration/dimensions.

## Open choices

- Whether to use recorded voiceover, captions only, or both.
- Whether to include a subtle background music bed; if used, it must not obscure narration.
- Exact pan/zoom focal points for each screenshot after viewing them in Remotion Studio.
- Whether the close card should use "Request pilot review" or remain a neutral brand close.
