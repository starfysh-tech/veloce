# Current institutional v3 30-second Veloce pitch video Remotion plan

## Goal

Maintain the v3 30-second institutional pitch video that frames Veloce as a parallel-run control and evidence layer beside execution. The cut should show how a hard OTC hedge decision becomes structured, governed, auditable, and defensible without implying live trading, broker connectivity, or trade-system-of-record responsibility.

The durable render target is a Remotion composition named `VelocePitch30`, 1920×1080, 30fps, 900 frames, rendered to `out/veloce-pitch-30s.mp4`.

## Audience assumption

Primary audience: institutional investors, financial-services operators, compliance leaders, and pilot sponsors evaluating whether Veloce can make complex RFQ decisions provable under review.

The video should feel like a concise institutional control story for a parallel-run pilot: calm, specific, explicit about guardrails, and clear that the demo uses mock/seeded data.

## Accuracy guardrails

- Say and show that this is a parallel-run pilot using mock/seeded-demo data.
- Position Veloce beside execution as a control and evidence layer, not as an execution venue.
- Do not imply live trading, automated execution, broker connectivity, production STP transmission, or a system of record for trades.
- Position STP/FpML-style output as a prepared payload for operations review, not as a transmitted downstream instruction.
- Keep the story anchored to visible MVP capabilities: governed RFQ record, invited/responded dealer evidence, award rationale, policy exceptions, approval governance, prepared payload, and compliance evidence.
- Use only product-backed seeded/mock figures when showing pricing math: blended `2.656%` vs best single `2.79%`, `13.4 bps`, and `$335,000 on $250M`.
- Final close must include: `Parallel-run pilot · mock data · no live trading`.

## Recommended institutional approach

Use Remotion as a narrative layer, not as a screenshot tour. Screenshots should appear as brief receipt panels inside motion-native scenes; the primary story is the control path from fragmented evidence to a governed, client-owned review packet.

Implementation rules:

- Store copied screenshots in `public/pitch/`.
- Reference images with `staticFile()` and render them with Remotion `<Img>`.
- Drive motion with `useCurrentFrame()`, `useVideoConfig()`, and `interpolate()`.
- Use `<Sequence>` with `premountFor={30}` where screenshot receipt panels benefit from preloading.
- Do not use CSS transitions, CSS keyframes, Tailwind animation classes, native `<img>`, Next.js `<Image>`, or CSS `background-image`.

## Current v3 institutional storyboard

| Section | Frames | Seconds | Visual | Message |
| --- | ---: | ---: | --- | --- |
| Old world | 0-119 | 0.0-4.0 | Chat, email, spreadsheet, and phone-log fragments collapse into one RFQ record | A $250M hedge starts as scattered evidence; Veloce makes the decision record structured. |
| Decision lifecycle | 120-299 | 4.0-10.0 | Graph nodes assemble around the RFQ record: invited, responded, liquidity, allocation, concentration, exception, approval, evidence | The winning quote is only part of a decision that must survive best-execution review. |
| Governance moment | 300-509 | 10.0-17.0 | Concentration check fires amber, exception is logged, approver acknowledgment stamps the record | Veloce governs the decision before execution while preserving segregation of duties. |
| Pricing proof | 510-689 | 17.0-23.0 | Partial-liquidity bars combine into a blended award against the best single quote | Product-backed pilot math shows `13.4 bps` / `$335,000 on $250M` as supporting evidence, not an unsupported savings claim. |
| Evidence close | 690-899 | 23.0-30.0 | Event log, quote ladder, approval, and prepared payload stack into one evidence packet, then widen into client-owned best-execution evidence | Every decision leaves a defensible record that survives review. |

## Scene implementation notes

| Scene | Primary copy | Detail line | Suggested motion |
| --- | --- | --- | --- |
| Old world | "A $250M hedge starts as calls, chats, spreadsheets, and inbox evidence." | "Veloce structures the RFQ record without touching live execution." | Fragments enter as specific evidence cards, then collapse into one governed RFQ record. |
| Decision lifecycle | "The winning quote is only part of the decision." | "Invited, responded, liquidity, allocation, exceptions, approvals, and evidence stay connected." | Build graph nodes sequentially around the record so the lifecycle is legible. |
| Governance moment | "Veloce structures and governs the decision before execution." | "Policy breach: `38%` vs `35%` cap; exception logged; approver acknowledgment preserved." | Let the amber control state become the narrative climax; avoid fast movement over the exception text. |
| Pricing proof | "Pilot math supports best-execution evidence." | "`2.656%` blended vs `2.79%` best single · `13.4 bps` · `$335,000 on $250M`." | Stack partial quotes into a blended award, then reveal the product-backed comparison. |
| Evidence close | "Every decision leaves a record that survives review." | "Client-owned evidence and benchmarks · prepared payload, not transmitted · parallel-run pilot, mock data, no live trading." | Stack evidence artifacts into one packet; hold the disclaimer readable for at least one second. |

## Visual direction

- Style: institutional, dark, high-contrast, calm motion.
- Background: deep navy/charcoal with subtle gradients or grid accents.
- Accent: restrained amber for governance exceptions, green/cyan for confirmed controls and evidence continuity.
- Typography: large concise headlines, readable supporting lines, no dense paragraphs on screen.
- Motion: frame-driven assembly, small pan offsets, and controlled scale changes that clarify control flow.
- Captions: institutional lower-third blocks with one primary phrase and one optional evidence line.
- Cuts: simple sequence changes or short opacity fades driven by frame interpolation.

## Asset list

These source screenshots are available as receipt panels in Remotion's public asset path:

| Source | Remotion path | Use |
| --- | --- | --- |
| `site/images/trader-01-dashboard.png` | `public/pitch/trader-01-dashboard.png` | Governed RFQ queue / desk context receipt |
| `site/images/trader-03-create.png` | `public/pitch/trader-03-create.png` | Structured RFQ / controlled panel receipt |
| `site/images/trader-04-board.png` | `public/pitch/trader-04-board.png` | Dealer response / award rationale receipt |
| `site/images/approver-02-queue.png` | `public/pitch/approver-02-queue.png` | Approval queue / policy warning receipt |
| `site/images/approver-03-detail.png` | `public/pitch/approver-03-detail.png` | Approval detail / exception evidence receipt |
| `site/images/ops-03-payload.png` | `public/pitch/ops-03-payload.png` | Prepared payload preview receipt |
| `site/images/compliance-03-concentration.png` | `public/pitch/compliance-03-concentration.png` | Compliance evidence / concentration review receipt |

`trader-02-blotter.png` and `compliance-02-bestex.png` remain available as supporting receipt panels if the institutional cut needs additional evidence context.

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
remotion/components/InstitutionalScenes.tsx
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

`InstitutionalScenes.tsx` owns the motion-native v3 scenes; `VelocePitch30.tsx` remains the single owner of sequence timing and scene order.

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
Old world:            0-119
Decision lifecycle:   120-299
Governance moment:    300-509
Pricing proof:        510-689
Evidence close:       690-899
```

Component responsibilities:

- `Caption` renders reusable readable lower-third copy.
- `ScreenshotScene` handles image loading, crop, scale, pan, and caption overlay for receipt panels.
- `LogoCard` renders intro/outro cards without external assets when needed.
- `InstitutionalScenes` renders the motion-native old-world fragments, decision lifecycle, governance moment, pricing proof, and evidence packet scenes.
- `VelocePitch30` owns the 900-frame sequence order and institutional scene copy.

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

Use local sequence frames inside reusable scene components: `useCurrentFrame()` inside a scene mounted by `<Sequence>` should start at `0` for that scene. Use `useVideoConfig()` for frame-rate-aware timing constants where useful.

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
| Old world | "A $250M hedge starts as calls, chats, spreadsheets, and inbox evidence." |
| Decision lifecycle | "The winning quote is only part of the decision." |
| Governance moment | "Veloce structures and governs the decision before execution." |
| Pricing proof | "Pilot math supports best-execution evidence: `2.656%` blended versus `2.79%` best single in the mock pilot record." |
| Evidence close | "Every decision leaves client-owned evidence that survives review. Parallel-run pilot, mock data, no live trading." |

## Current implementation contract

- Remotion scripts and dependencies are present in the npm workspace.
- V3 pitch screenshots remain in `public/pitch/` as receipt panels.
- `VelocePitch30` remains registered at 1920×1080, 30fps, 900 frames.
- `Caption`, `ScreenshotScene`, and `LogoCard` must continue to use frame-driven Remotion animation.
- The v3 storyboard covers old-world evidence fragmentation, decision lifecycle, governance moment, pricing proof, and evidence close.
- The final card includes `Parallel-run pilot · mock data · no live trading`.

## Current decisions

- The institutional v3 cut is captions-first; recorded voiceover and background music are optional future production choices.
- The close card remains a neutral institutional evidence close, not a conversion CTA.
- Pan, zoom, and graph assembly choices should serve auditability, governance, and best-execution evidence rather than generic screen-tour motion.
