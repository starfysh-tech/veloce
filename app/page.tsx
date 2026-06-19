import Link from 'next/link';

export default function Home() {
  return (
    <main className="marketing-page">
      <section className="marketing-hero">
        <div className="marketing-copy">
          <div className="eyebrow">Institutional OTC control layer</div>
          <h1>Make complex RFQ decisions defensible under review.</h1>
          <p>
            Veloce sits beside execution as a parallel-run evidence layer for
            OTC equity-derivatives RFQs: governance, best-execution context,
            prepared payload review, and auditability without live trading.
          </p>
          <div className="marketing-actions">
            <Link className="btn btn-primary" href="/login">Sign in</Link>
            <Link className="btn" href="/dashboard">Open workspace</Link>
          </div>
          <p className="marketing-note">
            Parallel-run pilot · mock data · no live trading · prepared payload not transmitted
          </p>
        </div>

        <div className="marketing-video-card" aria-labelledby="pitch-video-heading">
          <div className="eyebrow">30-second institutional cut</div>
          <h2 id="pitch-video-heading">One RFQ decision becomes defensible evidence.</h2>
          <video className="marketing-video" controls playsInline preload="metadata">
            <source src="/veloce-pitch-30s.mp4" type="video/mp4" />
            Your browser does not support embedded video.
          </video>
        </div>
      </section>
    </main>
  );
}
