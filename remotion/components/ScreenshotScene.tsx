import type {CSSProperties} from 'react';
import {Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Caption} from './Caption';

export type ScreenshotSceneProps = {
  src: string;
  caption?: string;
  detail?: string;
  durationFrames?: number;
  startScale?: number;
  endScale?: number;
  startX?: number;
  endX?: number;
  startY?: number;
  endY?: number;
  objectPosition?: CSSProperties['objectPosition'];
};

const fillStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  background: '#07101d',
};

const backdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(circle at 18% 12%, rgba(77, 125, 251, 0.24), transparent 34%), linear-gradient(135deg, #07101d 0%, #0d1b2e 48%, #08111f 100%)',
};

const frameStyle: CSSProperties = {
  position: 'absolute',
  inset: 80,
  borderRadius: 34,
  overflow: 'hidden',
  border: '1px solid rgba(206, 223, 255, 0.18)',
  boxShadow: '0 36px 110px rgba(0, 0, 0, 0.46)',
  background: '#0b1524',
};

const imageStyleBase: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  transformOrigin: 'center center',
};

const vignetteStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'linear-gradient(180deg, rgba(5, 10, 18, 0.06) 0%, rgba(5, 10, 18, 0.18) 70%, rgba(5, 10, 18, 0.66) 100%)',
  pointerEvents: 'none',
};

export const ScreenshotScene = ({
  src,
  caption,
  detail,
  durationFrames,
  startScale = 1.03,
  endScale = 1.11,
  startX = 0,
  endX = 0,
  startY = 0,
  endY = 0,
  objectPosition = 'center center',
}: ScreenshotSceneProps) => {
  const frame = useCurrentFrame();
  const {durationInFrames, fps} = useVideoConfig();
  const sceneDuration = Math.max(2, durationFrames ?? durationInFrames);
  const fadeFrames = Math.max(1, Math.round(0.4 * fps));
  const lastFrame = sceneDuration - 1;

  const scale = interpolate(frame, [0, lastFrame], [startScale, endScale], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const x = interpolate(frame, [0, lastFrame], [startX, endX], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, [0, lastFrame], [startY, endY], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(frame, [0, fadeFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={fillStyle}>
      <div style={backdropStyle} />
      <div style={{...frameStyle, opacity}}>
        <Img
          src={staticFile(src)}
          style={{
            ...imageStyleBase,
            objectPosition,
            transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
          }}
        />
        <div style={vignetteStyle} />
      </div>
      {caption ? <Caption label={caption} detail={detail} /> : null}
    </div>
  );
};
