// app/quote/[token]/form.tsx — dealer quote entry (client).
// Submit or revise a quote; live countdown off the stored deadline; the
// auction-closed state disables entry. No competitor data is ever in props.
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, fmtPrice } from '@/components/ui';
import { submitQuoteAction } from './actions';

export function DealerForm({
  token, quoteUnit, mode, isOpen, deadline, existing,
}: {
  token: string; quoteUnit: string; mode: 'split' | 'full'; isOpen: boolean;
  deadline: number | null; existing: { price: string; pct: number; note: string | null } | null;
}) {
  const router = useRouter();
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [pct, setPct] = useState(existing ? existing.pct : 100);
  const [note, setNote] = useState(existing?.note ?? '');
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);

  const left = deadline ? Math.max(0, deadline - now) : 0;
  const stillOpen = isOpen && left > 0;
  const pctOptions = mode === 'full' ? [100] : [100, 75, 60, 50, 40, 25];

  async function submit() {
    setSubmitting(true); setError(null);
    const res = await submitQuoteAction(token, { price: parseFloat(price), pct, note });
    setSubmitting(false);
    if (res.ok) { setDone(true); router.refresh(); }
    else setError(res.error);
  }

  if (done) {
    return (
      <div className="card">
        <div className="flag flag-ok"><Icon name="check" size={16} /> <span>Your quote is live on the buy-side board: <b>{pct}% @ {fmtPrice(price, quoteUnit)}</b>. You may revise it until the window closes.</span></div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => setDone(false)} disabled={!stillOpen}>Revise quote</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="row">
        <h3 style={{ margin: 0 }}>{existing ? 'Revise your quote' : 'Submit a quote'}</h3>
        <span className="spacer" />
        {deadline && (
          <span className="mono t-strong" style={{ color: stillOpen && left < 120000 ? 'var(--red)' : 'var(--accent)' }}>
            {stillOpen ? `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')} left` : 'CLOSED'}
          </span>
        )}
      </div>
      <hr className="hr" />

      {!stillOpen ? (
        <div className="flag flag-info"><Icon name="clock" size={15} /> <span>The auction window is closed. {existing ? 'Your final quote stands on the board.' : 'No further quotes can be submitted.'}</span></div>
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          <div className="grid g2" style={{ gap: 10 }}>
            <label className="fld">Level ({quoteUnit})
              <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 2.79" />
            </label>
            <label className="fld">Participation
              <select value={pct} onChange={(e) => setPct(Number(e.target.value))}>
                {pctOptions.map((p) => <option key={p} value={p}>{p === 100 ? 'Full size (100%)' : `Up to ${p}%`}</option>)}
              </select>
            </label>
          </div>
          <label className="fld">Conditions / notes
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Firm for 30 minutes…" />
          </label>
          {error && <div className="flag flag-warn">{error}</div>}
          <div className="btn-row">
            <button className="btn btn-primary" disabled={submitting || !price} onClick={submit}>
              {submitting ? 'Submitting…' : existing ? 'Revise quote' : 'Submit quote'}
            </button>
            <span className="note">Revisions allowed until the window closes; full history is retained.</span>
          </div>
        </div>
      )}
    </div>
  );
}
