import type {CSSProperties} from 'react';

export type CaptionProps = {
  label: string;
  detail?: string;
};

const shellStyle: CSSProperties = {
  position: 'absolute',
  left: 120,
  right: 120,
  bottom: 78,
  padding: '28px 34px',
  border: '1px solid rgba(141, 255, 206, 0.18)',
  borderRadius: 28,
  background: 'rgba(8, 16, 28, 0.78)',
  boxShadow: '0 28px 90px rgba(0, 0, 0, 0.35)',
  backdropFilter: 'blur(18px)',
};

const labelStyle: CSSProperties = {
  margin: 0,
  color: '#f6fbff',
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: 48,
  fontWeight: 700,
  letterSpacing: '-0.035em',
  lineHeight: 1.08,
};

const detailStyle: CSSProperties = {
  margin: '14px 0 0',
  color: '#8dffce',
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: 28,
  fontWeight: 600,
  letterSpacing: '-0.015em',
  lineHeight: 1.25,
};

export const Caption = ({label, detail}: CaptionProps) => {
  return (
    <div style={shellStyle}>
      <p style={labelStyle}>{label}</p>
      {detail ? <p style={detailStyle}>{detail}</p> : null}
    </div>
  );
};
