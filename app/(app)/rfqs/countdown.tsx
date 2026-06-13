// app/(app)/rfqs/countdown.tsx — client component. The countdown is a pure
// client render off the stored deadline timestamp (Decision 9); no network
// call ticks the clock. Server-side validation, not this display, enforces the
// deadline.
'use client';
import { useEffect, useState } from 'react';

export function Countdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const left = Math.max(0, deadline - now);
  if (left <= 0) return <span className="t-faint">Closed</span>;
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  const hot = left < 2 * 60000;
  return (
    <span className="mono t-strong" style={{ color: hot ? 'var(--red)' : 'var(--accent)' }}>
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')} left
    </span>
  );
}
