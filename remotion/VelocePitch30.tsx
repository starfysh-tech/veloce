import {AbsoluteFill, Sequence} from 'remotion';
import {
  DecisionLifecycle,
  EvidencePacket,
  GovernanceMoment,
  OldWorldFragments,
  PricingProof,
} from './components/InstitutionalScenes';

const oldWorldDuration = 120;
const decisionStart = oldWorldDuration;
const decisionDuration = 180;
const governanceStart = decisionStart + decisionDuration;
const governanceDuration = 210;
const pricingStart = governanceStart + governanceDuration;
const pricingDuration = 180;
const evidenceStart = pricingStart + pricingDuration;
const evidenceDuration = 210;

export const VelocePitch30 = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#050a13'}}>
      <Sequence from={0} durationInFrames={oldWorldDuration}>
        <OldWorldFragments />
      </Sequence>

      <Sequence from={decisionStart} durationInFrames={decisionDuration}>
        <DecisionLifecycle />
      </Sequence>

      <Sequence from={governanceStart} durationInFrames={governanceDuration}>
        <GovernanceMoment />
      </Sequence>

      <Sequence from={pricingStart} durationInFrames={pricingDuration}>
        <PricingProof />
      </Sequence>

      <Sequence from={evidenceStart} durationInFrames={evidenceDuration}>
        <EvidencePacket />
      </Sequence>
    </AbsoluteFill>
  );
};
