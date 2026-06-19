import {Composition} from 'remotion';
import {VelocePitch30} from './VelocePitch30';

export const RemotionRoot = () => {
  return (
    <Composition
      id="VelocePitch30"
      component={VelocePitch30}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
