import type {CSSProperties, ReactNode} from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const palette = {
  bg: '#050a13',
  panel: '#0a1423',
  panelSoft: 'rgba(9, 20, 35, 0.78)',
  line: 'rgba(193, 214, 244, 0.18)',
  text: '#f7fbff',
  muted: '#97aabe',
  blue: '#6f95ff',
  green: '#8dffce',
  amber: '#ffbd66',
  red: '#ff7e7e',
};

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const baseFont: CSSProperties = {
  fontFamily: 'Inter, Arial, sans-serif',
};

const sceneStyle: CSSProperties = {
  ...baseFont,
  backgroundColor: palette.bg,
  color: palette.text,
  overflow: 'hidden',
};

const gridColumns = Array.from({length: 28}, (_, index) => index * 72);
const gridRows = Array.from({length: 16}, (_, index) => index * 72);

const gridStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  opacity: 0.5,
};

const captionShell: CSSProperties = {
  position: 'absolute',
  left: 96,
  right: 96,
  bottom: 58,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 48,
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: palette.green,
  fontSize: 23,
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
};

const headlineStyle: CSSProperties = {
  margin: '12px 0 0',
  maxWidth: 1120,
  color: palette.text,
  fontSize: 54,
  fontWeight: 800,
  letterSpacing: '-0.048em',
  lineHeight: 1.02,
};

const supportingStyle: CSSProperties = {
  margin: '14px 0 0',
  maxWidth: 980,
  color: '#c7d7e9',
  fontSize: 27,
  fontWeight: 600,
  letterSpacing: '-0.018em',
  lineHeight: 1.25,
};

const packetLabelStyle: CSSProperties = {
  color: '#cfe0f4',
  fontSize: 20,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const valueStyle: CSSProperties = {
  color: palette.text,
  fontSize: 42,
  fontWeight: 850,
  letterSpacing: '-0.045em',
};

const smallTextStyle: CSSProperties = {
  color: palette.muted,
  fontSize: 21,
  fontWeight: 650,
  letterSpacing: '-0.012em',
  lineHeight: 1.26,
};

const reveal = (frame: number, start: number, duration: number) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
const slide = (progress: number, from: number, to: number) => interpolate(progress, [0, 1], [from, to], clamp);
const frameAt = (fps: number, seconds: number) => Math.round(seconds * fps);

const SceneFrame = ({children}: {children: ReactNode}) => (
  <AbsoluteFill style={sceneStyle}>
    <svg style={gridStyle} viewBox="0 0 1920 1080">
      <rect x="0" y="0" width="1920" height="1080" fill="#050a13" />
      <rect x="0" y="0" width="1920" height="1080" fill="#0a1423" opacity="0.62" />
      <circle cx="340" cy="170" r="360" fill={palette.blue} opacity="0.18" filter="blur(70px)" />
      <circle cx="1570" cy="800" r="420" fill={palette.green} opacity="0.08" filter="blur(80px)" />
      {gridColumns.map((x) => (
        <line key={`x-${x}`} x1={x} y1="0" x2={x} y2="1080" stroke="rgba(193, 214, 244, 0.07)" />
      ))}
      {gridRows.map((y) => (
        <line key={`y-${y}`} x1="0" y1={y} x2="1920" y2={y} stroke="rgba(193, 214, 244, 0.07)" />
      ))}
    </svg>
    {children}
  </AbsoluteFill>
);

const CaptionBlock = ({
  eyebrow,
  headline,
  detail,
  right,
}: {
  eyebrow: string;
  headline: string;
  detail?: string;
  right?: ReactNode;
}) => (
  <div style={captionShell}>
    <div>
      <p style={eyebrowStyle}>{eyebrow}</p>
      <h2 style={headlineStyle}>{headline}</h2>
      {detail ? <p style={supportingStyle}>{detail}</p> : null}
    </div>
    {right}
  </div>
);

const GlassPanel = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) => (
  <div
    style={{
      position: 'absolute',
      border: `1px solid ${palette.line}`,
      borderRadius: 28,
      background: palette.panelSoft,
      boxShadow: '0 32px 90px rgba(0, 0, 0, 0.34)',
      backdropFilter: 'blur(18px)',
      ...style,
    }}
  >
    {children}
  </div>
);

const ReceiptPanel = ({
  src,
  label,
  style,
}: {
  src: string;
  label: string;
  style: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entrance = reveal(frame, frameAt(fps, 0.33), frameAt(fps, 0.6));

  return (
    <GlassPanel
      style={{
        width: 360,
        height: 250,
        padding: 12,
        overflow: 'hidden',
        opacity: entrance,
        transform: `translate3d(0, ${slide(entrance, 20, 0)}px, 0)`,
        ...style,
      }}
    >
      <Img
        src={staticFile(src)}
        style={{
          width: '100%',
          height: 188,
          objectFit: 'cover',
          objectPosition: 'center top',
          borderRadius: 18,
          border: '1px solid rgba(193, 214, 244, 0.12)',
        }}
      />
      <div style={{padding: '11px 8px 0', color: '#c8d8eb', fontSize: 18, fontWeight: 800}}>{label}</div>
    </GlassPanel>
  );
};

const DataPill = ({label, value, color = palette.green}: {label: string; value: string; color?: string}) => (
  <div
    style={{
      minWidth: 190,
      padding: '18px 20px',
      border: `1px solid ${color}55`,
      borderRadius: 18,
      background: `${color}14`,
    }}
  >
    <div style={{...packetLabelStyle, color}}>{label}</div>
    <div style={{...valueStyle, marginTop: 8}}>{value}</div>
  </div>
);

const RfqRecord = ({progress, compact = false}: {progress: number; compact?: boolean}) => (
  <div
    style={{
      width: compact ? 440 : 560,
      padding: compact ? '26px 30px' : '34px 38px',
      border: '1px solid rgba(141, 255, 206, 0.28)',
      borderRadius: 28,
      background: 'rgba(10, 27, 46, 0.96)',
      boxShadow: '0 34px 110px rgba(0,0,0,0.42), 0 0 64px rgba(141, 255, 206, 0.1)',
      transform: `scale(${slide(progress, 0.92, 1)})`,
      opacity: progress,
    }}
  >
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18}}>
      <div style={packetLabelStyle}>RFQ control record</div>
      <div style={{color: palette.green, fontSize: 18, fontWeight: 850}}>Parallel-run</div>
    </div>
    <div style={{...valueStyle, marginTop: 17}}>RFQ-250M-06</div>
    <div style={{...smallTextStyle, marginTop: 8}}>$250M hedge · dealer panel · allocation rationale · evidence attached</div>
    <div style={{display: 'flex', gap: 10, marginTop: 22}}>
      {['Terms', 'Quotes', 'Controls', 'Approval'].map((item) => (
        <div
          key={item}
          style={{
            padding: '9px 13px',
            borderRadius: 999,
            background: 'rgba(193, 214, 244, 0.1)',
            color: '#cfe0f4',
            fontSize: 16,
            fontWeight: 800,
          }}
        >
          {item}
        </div>
      ))}
    </div>
  </div>
);

export const OldWorldFragments = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const collapse = reveal(frame, frameAt(fps, 2.27), frameAt(fps, 1.13));
  const recordIn = reveal(frame, frameAt(fps, 2.67), frameAt(fps, 0.8));

  const fragments = [
    {
      title: 'Chat',
      body: 'Dealer B can show size if split is acceptable.',
      meta: '10:42',
      x: 185,
      y: 150,
      rotate: -5,
      color: palette.blue,
    },
    {
      title: 'Email',
      body: 'Please confirm final strike and indicative level.',
      meta: 'Inbox evidence',
      x: 1180,
      y: 126,
      rotate: 4,
      color: palette.green,
    },
    {
      title: 'Spreadsheet',
      body: 'Dealer A 2.79% · Dealer B partial · Dealer C no quote',
      meta: 'manual compare',
      x: 260,
      y: 520,
      rotate: 3,
      color: '#c8d8ff',
    },
    {
      title: 'Phone log',
      body: 'Verbal update: capacity constrained above 35% policy cap.',
      meta: 'call note',
      x: 1245,
      y: 540,
      rotate: -3,
      color: palette.amber,
    },
  ];

  return (
    <SceneFrame>
      {fragments.map((fragment, index) => {
        const inProgress = reveal(frame, frameAt(fps, index * 0.27), frameAt(fps, 0.53));
        const opacity =
          inProgress *
          interpolate(frame, [frameAt(fps, 3.07), frameAt(fps, 3.67)], [1, 0], {
            ...clamp,
            easing: Easing.in(Easing.cubic),
          });
        const x = slide(collapse, fragment.x, 748 + index * 18);
        const y = slide(collapse, fragment.y, 394 + index * 12);
        const scale = slide(collapse, 1, 0.58);
        const rotate = slide(collapse, fragment.rotate, 0);

        return (
          <GlassPanel
            key={fragment.title}
            style={{
              left: x,
              top: y,
              width: 420,
              minHeight: 164,
              padding: '24px 26px',
              opacity,
              transform: `translate3d(0, ${slide(inProgress, 30, 0)}px, 0) rotate(${rotate}deg) scale(${scale})`,
            }}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', gap: 20}}>
              <div style={{...packetLabelStyle, color: fragment.color}}>{fragment.title}</div>
              <div style={{color: palette.muted, fontSize: 17, fontWeight: 800}}>{fragment.meta}</div>
            </div>
            <div style={{...smallTextStyle, marginTop: 18, color: '#e6f0fb', fontSize: 24}}>{fragment.body}</div>
          </GlassPanel>
        );
      })}
      <div style={{position: 'absolute', left: 680, top: 330}}>
        <RfqRecord progress={recordIn} />
      </div>
      <CaptionBlock
        eyebrow="Old world"
        headline="A $250M hedge starts as calls, chats, spreadsheets, and inbox evidence."
        detail="Veloce turns fragments into one governed RFQ record beside execution."
      />
    </SceneFrame>
  );
};

const lifecycleNodes = [
  {label: 'Invited', x: 380, y: 210, detail: 'controlled panel'},
  {label: 'Responded', x: 710, y: 140, detail: 'blind quotes'},
  {label: 'Liquidity', x: 1115, y: 190, detail: 'partial capacity'},
  {label: 'Allocation', x: 1290, y: 430, detail: 'split award'},
  {label: 'Concentration', x: 1115, y: 670, detail: 'policy cap'},
  {label: 'Exception', x: 710, y: 735, detail: 'mandatory note'},
  {label: 'Approval', x: 380, y: 640, detail: 'segregation'},
  {label: 'Evidence', x: 210, y: 410, detail: 'audit trail'},
];

export const DecisionLifecycle = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const centerIn = reveal(frame, frameAt(fps, 0.07), frameAt(fps, 0.6));

  return (
    <SceneFrame>
      <svg style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} viewBox="0 0 1920 1080">
        {lifecycleNodes.map((node, index) => {
          const lineIn = reveal(frame, frameAt(fps, 0.93 + index * 0.47), frameAt(fps, 0.47));
          return (
            <line
              key={node.label}
              x1="960"
              y1="454"
              x2={node.x + 130}
              y2={node.y + 54}
              stroke="rgba(141, 255, 206, 0.42)"
              strokeWidth="3"
              strokeDasharray="8 12"
              strokeDashoffset={(1 - lineIn) * 120}
              opacity={lineIn * 0.72}
            />
          );
        })}
      </svg>

      <div style={{position: 'absolute', left: 740, top: 330}}>
        <RfqRecord progress={centerIn} compact />
      </div>

      {lifecycleNodes.map((node, index) => {
        const nodeIn = reveal(frame, frameAt(fps, 1.13 + index * 0.47), frameAt(fps, 0.53));
        const isAmber = node.label === 'Concentration' || node.label === 'Exception';
        return (
          <div
            key={node.label}
            style={{
              position: 'absolute',
              left: node.x,
              top: node.y,
              width: 260,
              padding: '22px 24px',
              border: `1px solid ${isAmber ? 'rgba(255, 189, 102, 0.42)' : palette.line}`,
              borderRadius: 22,
              background: isAmber ? 'rgba(60, 39, 12, 0.84)' : 'rgba(9, 20, 35, 0.86)',
              opacity: nodeIn,
              transform: `translate3d(0, ${slide(nodeIn, 26, 0)}px, 0) scale(${slide(nodeIn, 0.92, 1)})`,
              boxShadow: isAmber ? '0 0 46px rgba(255, 189, 102, 0.12)' : '0 24px 70px rgba(0,0,0,0.26)',
            }}
          >
            <div style={{...packetLabelStyle, color: isAmber ? palette.amber : palette.green}}>{node.label}</div>
            <div style={{...smallTextStyle, marginTop: 8, color: '#d7e5f5'}}>{node.detail}</div>
          </div>
        );
      })}

      <CaptionBlock
        eyebrow="Decision lifecycle"
        headline="The winning quote is only part of the decision."
        detail="The full record shows who was invited, who responded, what liquidity existed, why the award was chosen, which controls fired, who approved, and what evidence survives review."
      />
    </SceneFrame>
  );
};

export const GovernanceMoment = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const amberPulse = interpolate(Math.sin((frame / fps) * Math.PI * 2), [-1, 1], [0.36, 1], clamp);
  const checkIn = reveal(frame, frameAt(fps, 0.33), frameAt(fps, 0.6));
  const exceptionIn = reveal(frame, frameAt(fps, 2.07), frameAt(fps, 0.6));
  const stamp = spring({frame: frame - frameAt(fps, 4.2), fps, config: {damping: 18, stiffness: 220}});
  const rationaleIn = reveal(frame, frameAt(fps, 5), frameAt(fps, 0.73));

  return (
    <SceneFrame>
      <GlassPanel style={{left: 126, top: 138, width: 910, height: 590, padding: '42px 46px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div>
            <div style={{...packetLabelStyle, color: palette.amber}}>Concentration control</div>
            <div style={{...valueStyle, marginTop: 12}}>38% vs 35% cap</div>
          </div>
          <div
            style={{
              width: 124,
              height: 124,
              borderRadius: 999,
              border: `5px solid rgba(255, 189, 102, ${0.45 + amberPulse * 0.4})`,
              background: 'rgba(255, 189, 102, 0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: palette.amber,
              fontSize: 48,
              fontWeight: 950,
              opacity: checkIn,
              transform: `scale(${slide(checkIn, 0.74, 1)})`,
            }}
          >
            !
          </div>
        </div>

        <div style={{height: 22}} />
        {[
          ['Policy exception logged', 'Dealer concentration exceeds configured desk cap.'],
          ['Mandatory rationale opened', 'Split allocation documented for best-execution review.'],
          ['Approver acknowledgment required', 'Segregation of duties before the record advances.'],
        ].map(([title, detail], index) => {
          const rowIn = reveal(frame, frameAt(fps, 1.73 + index * 0.87), frameAt(fps, 0.47));
          return (
            <div
              key={title}
              style={{
                marginTop: 14,
                padding: '20px 22px',
                borderRadius: 18,
                border: '1px solid rgba(255, 189, 102, 0.28)',
                background: 'rgba(255, 189, 102, 0.08)',
                opacity: rowIn,
                transform: `translate3d(${slide(rowIn, -26, 0)}px, 0, 0)`,
              }}
            >
              <div style={{color: '#ffe0b4', fontSize: 26, fontWeight: 850}}>{title}</div>
              <div style={{...smallTextStyle, marginTop: 8}}>{detail}</div>
            </div>
          );
        })}

        <div
          style={{
            position: 'absolute',
            right: 42,
            bottom: 38,
            padding: '18px 24px',
            border: '3px solid rgba(141, 255, 206, 0.82)',
            borderRadius: 18,
            color: palette.green,
            fontSize: 25,
            fontWeight: 950,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            opacity: stamp,
            transform: `rotate(-6deg) scale(${slide(stamp, 0.82, 1)})`,
          }}
        >
          acknowledged
        </div>
      </GlassPanel>

      <GlassPanel
        style={{
          right: 148,
          top: 196,
          width: 560,
          padding: '30px 34px',
          opacity: exceptionIn,
          transform: `translate3d(0, ${slide(exceptionIn, 42, 0)}px, 0)`,
        }}
      >
        <div style={{...packetLabelStyle, color: palette.green}}>Rationale captured</div>
        <div style={{...smallTextStyle, marginTop: 18, color: '#e6f0fb', fontSize: 28}}>
          Award split accepted after documenting partial liquidity, policy exception, and approver acknowledgment.
        </div>
      </GlassPanel>

      <ReceiptPanel src="pitch/approver-03-detail.png" label="Approval detail receipt" style={{right: 160, top: 506}} />

      <div
        style={{
          position: 'absolute',
          left: 888,
          top: 348,
          width: 260,
          height: 3,
          background: `rgba(255, 189, 102, ${rationaleIn})`,
          transform: `scaleX(${rationaleIn})`,
          transformOrigin: 'left center',
        }}
      />

      <CaptionBlock
        eyebrow="Governance moment"
        headline="Veloce structures and governs the decision before execution."
        detail="A defensible control point captures the exception, approval, and rationale before the record advances."
      />
    </SceneFrame>
  );
};

export const PricingProof = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const barA = reveal(frame, frameAt(fps, 0.67), frameAt(fps, 0.73));
  const barB = reveal(frame, frameAt(fps, 1.73), frameAt(fps, 0.73));
  const blend = reveal(frame, frameAt(fps, 3.07), frameAt(fps, 0.8));
  const savings = reveal(frame, frameAt(fps, 4.2), frameAt(fps, 0.8));

  return (
    <SceneFrame>
      <GlassPanel style={{left: 130, top: 150, width: 960, height: 520, padding: '44px 48px'}}>
        <div style={{...packetLabelStyle, color: palette.green}}>Partial liquidity stack</div>
        <div style={{marginTop: 36, display: 'grid', gap: 28}}>
          {[
            {dealer: 'Dealer A', text: 'Partial quote allocated into the blend', value: 'Partial size', width: 0.78, progress: barA, color: palette.blue},
            {dealer: 'Dealer B', text: 'Second partial quote completes the award', value: 'Partial size', width: 0.62, progress: barB, color: palette.green},
          ].map((row) => (
            <div key={row.dealer}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 12}}>
                <div style={{color: '#e6f0fb', fontSize: 27, fontWeight: 850}}>{row.dealer}</div>
                <div style={{color: row.color, fontSize: 25, fontWeight: 850}}>{row.value}</div>
              </div>
              <div style={{height: 42, borderRadius: 999, background: 'rgba(193, 214, 244, 0.1)', overflow: 'hidden'}}>
                <div
                  style={{
                    width: `${slide(row.progress, 0, row.width * 100)}%`,
                    height: '100%',
                    borderRadius: 999,
                    backgroundColor: row.color,
                  }}
                />
              </div>
              <div style={{...smallTextStyle, marginTop: 9}}>{row.text}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            position: 'absolute',
            right: 42,
            bottom: 42,
            padding: '22px 26px',
            border: '1px solid rgba(141, 255, 206, 0.42)',
            borderRadius: 22,
            background: 'rgba(141, 255, 206, 0.12)',
            opacity: blend,
            transform: `translate3d(0, ${slide(blend, 28, 0)}px, 0)`,
          }}
        >
          <div style={{...packetLabelStyle, color: palette.green}}>Blended award</div>
          <div style={{...valueStyle, marginTop: 8}}>2.656%</div>
        </div>
      </GlassPanel>

      <div style={{position: 'absolute', right: 122, top: 172, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, opacity: savings}}>
        <DataPill label="Best single" value="2.79%" color={palette.blue} />
        <DataPill label="vs best single" value="13.4 bps" color={palette.green} />
        <div style={{gridColumn: '1 / span 2'}}>
          <DataPill label="Product-backed mock / pilot math" value="$335,000 on $250M" color={palette.green} />
        </div>
      </div>

      <ReceiptPanel src="pitch/trader-04-board.png" label="Quote ladder receipt" style={{right: 154, top: 520}} />

      <CaptionBlock
        eyebrow="Pricing proof"
        headline="Pilot math supports best-execution evidence."
        detail="Pricing is supporting proof: two partial quotes stack into a blended award with mock pilot math attached to the record."
      />
    </SceneFrame>
  );
};

export const EvidencePacket = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stackProgress = reveal(frame, frameAt(fps, 0.8), frameAt(fps, 3.07));
  const fanOut = reveal(frame, frameAt(fps, 4.07), frameAt(fps, 1.2));
  const disclaimerIn = reveal(frame, frameAt(fps, 5), frameAt(fps, 0.6));

  const artifacts = [
    {label: 'Event log', detail: 'who did what, when', color: palette.blue},
    {label: 'Quote ladder', detail: 'dealer levels and partial size', color: palette.green},
    {label: 'Approval', detail: 'acknowledgment and rationale', color: palette.amber},
    {label: 'Prepared FpML-style payload', detail: 'review-only control capture', color: '#c8d8ff'},
  ];

  return (
    <SceneFrame>
      {artifacts.map((artifact, index) => {
        const itemIn = reveal(frame, frameAt(fps, 0.6 + index * 0.73), frameAt(fps, 0.53));
        const x = slide(stackProgress, 210 + index * 295, 650 + index * 24);
        const y = slide(stackProgress, 220 + (index % 2) * 170, 230 + index * 58);
        const rotate = slide(stackProgress, index % 2 === 0 ? -3 : 3, -4 + index * 2.5);
        const scale = slide(stackProgress, 1, 0.96);

        return (
          <GlassPanel
            key={artifact.label}
            style={{
              left: x,
              top: y,
              width: 380,
              padding: '28px 30px',
              opacity: itemIn,
              transform: `translate3d(0, ${slide(itemIn, 34, 0)}px, 0) rotate(${rotate}deg) scale(${scale})`,
            }}
          >
            <div style={{...packetLabelStyle, color: artifact.color}}>{artifact.label}</div>
            <div style={{...smallTextStyle, marginTop: 14, color: '#e6f0fb', fontSize: 25}}>{artifact.detail}</div>
          </GlassPanel>
        );
      })}

      <GlassPanel
        style={{
          left: 600,
          top: 190,
          width: 600,
          height: 410,
          padding: '42px 46px',
          opacity: stackProgress,
          transform: `scale(${slide(stackProgress, 0.9, 1)})`,
          borderColor: 'rgba(141, 255, 206, 0.36)',
        }}
      >
        <div style={{...packetLabelStyle, color: palette.green}}>Client-owned evidence packet</div>
        <div style={{...valueStyle, marginTop: 22}}>One governed record</div>
        <div style={{...smallTextStyle, marginTop: 18, color: '#dce9f6', fontSize: 28}}>
          Event log, quote ladder, approval, and prepared payload stay attached for best-execution and auditability.
        </div>
      </GlassPanel>

      {[
        {title: 'Best-ex view', detail: 'decision evidence by RFQ', x: 190, y: 170},
        {title: 'Dealer performance', detail: 'client-owned benchmarks', x: 1245, y: 160},
        {title: 'Audit packet', detail: 'replayable review trail', x: 1260, y: 492},
      ].map((view, index) => (
        <GlassPanel
          key={view.title}
          style={{
            left: view.x,
            top: view.y,
            width: 420,
            padding: '28px 30px',
            opacity: fanOut,
            transform: `translate3d(${slide(fanOut, index === 0 ? 80 : -80, 0)}px, 0, 0)`,
          }}
        >
          <div style={{...packetLabelStyle, color: index === 1 ? palette.green : palette.blue}}>{view.title}</div>
          <div style={{...smallTextStyle, marginTop: 14, color: '#e6f0fb', fontSize: 25}}>{view.detail}</div>
        </GlassPanel>
      ))}

      <ReceiptPanel src="pitch/ops-03-payload.png" label="Prepared payload receipt" style={{left: 190, top: 500, width: 330, height: 232}} />
      <ReceiptPanel src="pitch/compliance-02-bestex.png" label="Best-ex evidence receipt" style={{right: 174, top: 720, width: 330, height: 232}} />

      <CaptionBlock
        eyebrow="Evidence close"
        headline="Every decision leaves a record that survives review."
        detail="Veloce is a parallel-run control and evidence layer beside execution. Evidence and benchmarks remain client-owned."
        right={
          <div
            style={{
              minWidth: 470,
              padding: '20px 26px',
              border: '1px solid rgba(193, 214, 244, 0.18)',
              borderRadius: 999,
              color: '#cfe0f4',
              background: 'rgba(9, 20, 35, 0.84)',
              fontSize: 22,
              fontWeight: 850,
              textAlign: 'center',
              opacity: disclaimerIn,
            }}
          >
            Parallel-run pilot · mock data · no live trading
          </div>
        }
      />
    </SceneFrame>
  );
};
