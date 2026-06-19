import {AbsoluteFill, Sequence} from 'remotion';
import {LogoCard} from './components/LogoCard';
import {ScreenshotScene} from './components/ScreenshotScene';


const stakesDuration = 90;
const deskStart = 90;
const deskDuration = 90;
const structureStart = 180;
const structureDuration = 90;
const decisionStart = 270;
const decisionDuration = 180;
const approvalQueueStart = 450;
const approvalQueueDuration = 120;
const approvalDetailStart = 570;
const approvalDetailDuration = 90;
const opsStart = 660;
const opsDuration = 90;
const complianceStart = 750;
const complianceDuration = 90;
const closeStart = 840;
const closeDuration = 60;

export const VelocePitch30 = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#050a13'}}>
      <Sequence from={0} durationInFrames={stakesDuration} premountFor={30}>
        <LogoCard
          headline="A $250M OTC hedge. Multiple dealers. One award decision that has to survive review."
          subhead="Veloce keeps dealer quotes, award rationale, controls, and evidence in one pilot record."
        />
      </Sequence>

      <Sequence from={deskStart} durationInFrames={deskDuration} premountFor={30}>
        <ScreenshotScene
          src="pitch/trader-01-dashboard.png"
          durationFrames={deskDuration}
          caption="The desk starts from a governed RFQ queue, not an inbox."
          detail="Seeded parallel-run workflow, scoped to the buyer desk."
          startScale={1.12}
          endScale={1.18}
          startX={-112}
          endX={-34}
          startY={-54}
          endY={-16}
        />
      </Sequence>

      <Sequence from={structureStart} durationInFrames={structureDuration} premountFor={30}>
        <ScreenshotScene
          src="pitch/trader-03-create.png"
          durationFrames={structureDuration}
          caption="Structure the request once. Invite the controlled panel."
          detail="Terms, economics, dealer panel, and launch checks stay attached."
          startScale={1.14}
          endScale={1.2}
          startX={-40}
          endX={34}
          startY={-108}
          endY={-66}
        />
      </Sequence>

      <Sequence from={decisionStart} durationInFrames={decisionDuration} premountFor={30}>
        <ScreenshotScene
          src="pitch/trader-04-board.png"
          durationFrames={decisionDuration}
          caption="Blind responses stay beside the award rationale."
          detail="Dealer levels and split allocation context remain in the same record."
          startScale={1.1}
          endScale={1.2}
          startX={-26}
          endX={-74}
          startY={74}
          endY={4}
        />
      </Sequence>

      <Sequence from={approvalQueueStart} durationInFrames={approvalQueueDuration} premountFor={30}>
        <ScreenshotScene
          src="pitch/approver-02-queue.png"
          durationFrames={approvalQueueDuration}
          caption="Policy warnings surface before the record advances."
          detail="Approvers see warnings and open exceptions before sign-off."
          startScale={1.01}
          endScale={1.05}
          startX={0}
          endX={0}
          startY={0}
          endY={24}
          objectPosition="center top"
        />
      </Sequence>

      <Sequence from={approvalDetailStart} durationInFrames={approvalDetailDuration} premountFor={30}>
        <ScreenshotScene
          src="pitch/approver-03-detail.png"
          durationFrames={approvalDetailDuration}
          caption="Exceptions, rationale, and STP guardrails move with the award."
          detail="Approval context travels with the evidence record."
          startScale={1.18}
          endScale={1.24}
          startX={-12}
          endX={26}
          startY={-230}
          endY={-274}
        />
      </Sequence>

      <Sequence from={opsStart} durationInFrames={opsDuration} premountFor={30}>
        <ScreenshotScene
          src="pitch/ops-03-payload.png"
          durationFrames={opsDuration}
          caption="Ops reviews a persisted STP preview — not a live transmission."
          detail="Preview payload is saved for review; no broker connectivity is implied."
          startScale={1.18}
          endScale={1.24}
          startX={18}
          endX={-36}
          startY={18}
          endY={-18}
        />
      </Sequence>

      <Sequence from={complianceStart} durationInFrames={complianceDuration} premountFor={30}>
        <ScreenshotScene
          src="pitch/compliance-03-concentration.png"
          durationFrames={complianceDuration}
          caption="Compliance reviews the same evidence record after the decision."
          detail="Concentration, exceptions, and best-ex evidence are reviewed from the pilot record."
          startScale={1.02}
          endScale={1.06}
          startX={0}
          endX={0}
          startY={0}
          endY={20}
          objectPosition="center top"
        />
      </Sequence>

      <Sequence from={closeStart} durationInFrames={closeDuration} premountFor={30}>
        <LogoCard
          headline="Veloce turns RFQ workflow into a controlled evidence record."
          subhead="Dealer quotes, award rationale, approval gates, STP preview, and compliance evidence stay together."
          disclaimer="Parallel-run pilot · mock data · no live trading"
        />
      </Sequence>
    </AbsoluteFill>
  );
};
