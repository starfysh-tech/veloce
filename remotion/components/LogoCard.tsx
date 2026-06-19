import type {CSSProperties} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

export type LogoCardProps = {
  headline: string;
  subhead?: string;
  disclaimer?: string;
};

const backgroundStyle: CSSProperties = {
  background:
    'radial-gradient(circle at 22% 18%, rgba(77, 125, 251, 0.34), transparent 28%), radial-gradient(circle at 72% 68%, rgba(141, 255, 206, 0.18), transparent 30%), linear-gradient(135deg, #050a13 0%, #0b1728 45%, #06101d 100%)',
  color: '#f7fbff',
  fontFamily: 'Inter, Arial, sans-serif',
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'hidden',
};

const cardStyle: CSSProperties = {
  width: 1240,
  padding: '74px 86px',
  border: '1px solid rgba(206, 223, 255, 0.18)',
  borderRadius: 42,
  background: 'rgba(7, 17, 30, 0.68)',
  boxShadow: '0 42px 130px rgba(0, 0, 0, 0.42)',
  backdropFilter: 'blur(16px)',
};

const markStyle: CSSProperties = {
  width: 86,
  height: 86,
  borderRadius: 24,
  background: 'linear-gradient(135deg, #4d7dfb 0%, #8dffce 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 38,
  color: '#04101f',
  fontSize: 48,
  fontWeight: 900,
  letterSpacing: '-0.08em',
};

const eyebrowStyle: CSSProperties = {
  margin: '0 0 20px',
  color: '#8dffce',
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
};

const headlineStyle: CSSProperties = {
  margin: 0,
  fontSize: 86,
  fontWeight: 800,
  letterSpacing: '-0.06em',
  lineHeight: 0.95,
};

const subheadStyle: CSSProperties = {
  margin: '30px 0 0',
  maxWidth: 1000,
  color: '#c8d7eb',
  fontSize: 36,
  fontWeight: 500,
  letterSpacing: '-0.025em',
  lineHeight: 1.22,
};

const disclaimerStyle: CSSProperties = {
  position: 'absolute',
  left: 120,
  right: 120,
  bottom: 72,
  color: '#94a7bd',
  fontSize: 25,
  fontWeight: 600,
  letterSpacing: '0.02em',
  textAlign: 'center',
};

export const LogoCard = ({headline, subhead, disclaimer}: LogoCardProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entrance = interpolate(frame, [0, Math.round(0.7 * fps)], [0.94, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(frame, [0, Math.round(0.45 * fps)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={backgroundStyle}>
      <div style={{...cardStyle, opacity, transform: `scale(${entrance})`}}>
        <div style={markStyle}>V</div>
        <p style={eyebrowStyle}>Veloce</p>
        <h1 style={headlineStyle}>{headline}</h1>
        {subhead ? <p style={subheadStyle}>{subhead}</p> : null}
      </div>
      {disclaimer ? <div style={{...disclaimerStyle, opacity}}>{disclaimer}</div> : null}
    </AbsoluteFill>
  );
};
