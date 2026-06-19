import {AbsoluteFill, Sequence} from 'remotion';
import {LogoCard} from './components/LogoCard';
import {ScreenshotScene} from './components/ScreenshotScene';


const problemDuration = 120;
const auctionStart = 120;
const auctionDuration = 150;
const awardStart = 270;
const awardDuration = 210;
const controlsStart = 480;
const controlsDuration = 180;
const downstreamStart = 660;
const downstreamDuration = 150;
const closeStart = 810;
const closeDuration = 90;

export const VelocePitch30 = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#050a13'}}>
      <Sequence from={0} durationInFrames={problemDuration} premountFor={30}>
        <LogoCard
          headline="Problem: RFQ evidence is hard to review when work is split."
          subhead="This 30-second walkthrough uses mock data in a parallel-run pilot from trader action through approval, STP preview, and compliance review."
        />
      </Sequence>

      <Sequence from={auctionStart} durationInFrames={auctionDuration} premountFor={30}>
        <ScreenshotScene
          src="pitch/trader-03-create.png"
          durationFrames={auctionDuration}
          caption="Create the RFQ and move it into a dealer auction."
          detail="Parallel-run pilot workflow with mock data."
          startScale={1.02}
          endScale={1.09}
          startX={-18}
          endX={22}
          startY={0}
          endY={-18}
        />
      </Sequence>

      <Sequence from={awardStart} durationInFrames={awardDuration} premountFor={30}>
        <ScreenshotScene
          src="pitch/trader-04-board.png"
          durationFrames={awardDuration}
          caption="Illustrative award math stays visible before the pilot record advances."
          detail="Seeded demo compares single-bank and blended allocation."
          startScale={1.04}
          endScale={1.13}
          startX={30}
          endX={-34}
          startY={-12}
          endY={16}
        />
      </Sequence>

      <Sequence from={controlsStart} durationInFrames={controlsDuration} premountFor={30}>
        <ScreenshotScene
          src="pitch/approver-03-detail.png"
          durationFrames={controlsDuration}
          caption="Approvers review exceptions before any downstream handoff."
          detail="STP is previewed and persisted, not transmitted."
          startScale={1.03}
          endScale={1.1}
          startX={-24}
          endX={20}
          startY={18}
          endY={-22}
        />
      </Sequence>

      <Sequence from={downstreamStart} durationInFrames={downstreamDuration} premountFor={30}>
        <Sequence from={0} durationInFrames={75} premountFor={30}>
          <ScreenshotScene
            src="pitch/ops-03-payload.png"
            durationFrames={75}
            caption="Ops reviews the persisted STP preview."
            detail="Pilot payload only; no live trading transmission."
            startScale={1.04}
            endScale={1.1}
            startX={20}
            endX={-20}
            startY={-18}
            endY={12}
          />
        </Sequence>
        <Sequence from={75} durationInFrames={75} premountFor={30}>
          <ScreenshotScene
            src="pitch/compliance-02-bestex.png"
            durationFrames={75}
            caption="Compliance reviews best-ex evidence from the mock pilot data."
            detail="Shared record, controlled workflow, no live trading."
            startScale={1.03}
            endScale={1.09}
            startX={-18}
            endX={18}
            startY={16}
            endY={-14}
          />
        </Sequence>
      </Sequence>

      <Sequence from={closeStart} durationInFrames={closeDuration} premountFor={30}>
        <LogoCard
          headline="Veloce connects auction, controls, and evidence."
          subhead="A 30-second walkthrough of the RFQ pilot workflow."
          disclaimer="Parallel-run pilot · mock data · no live trading"
        />
      </Sequence>
    </AbsoluteFill>
  );
};
