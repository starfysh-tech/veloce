// app/login/page.tsx — buy-side sign-in. Password is the demo default;
// magic-link is offered alongside (Decision 17).
import { signInWithPassword, signInWithMagicLink } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="card" style={{ width: 'min(420px, 100%)' }}>
        <div className="brand" style={{ paddingBottom: 18 }}>
          <div className="brand-mark" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></svg>
          </div>
          <div>
            <div className="brand-name">VELOCE</div>
            <div className="brand-sub">Financial Technologies</div>
          </div>
        </div>

        <h3 style={{ marginTop: 0 }}>Sign in</h3>
        <p className="sub">Buy-side desk access. Dealers respond via their invitation link.</p>

        {sp.error && <div className="flag flag-warn" style={{ marginBottom: 12 }}>{sp.error}</div>}
        {sp.sent && <div className="flag flag-ok" style={{ marginBottom: 12 }}>Check your email for a sign-in link.</div>}

        <form action={signInWithPassword} className="grid" style={{ gap: 10 }}>
          <label className="fld">Email
            <input type="email" name="email" required placeholder="dana@meridian.example" autoComplete="username" />
          </label>
          <label className="fld">Password
            <input type="password" name="password" required autoComplete="current-password" />
          </label>
          <button className="btn btn-primary" type="submit">Sign in</button>
        </form>

        <hr className="hr" />

        <form action={signInWithMagicLink} className="grid" style={{ gap: 10 }}>
          <p className="note" style={{ margin: 0 }}>Or get a one-time sign-in link by email:</p>
          <label className="fld">Email
            <input type="email" name="email" required placeholder="dana@meridian.example" />
          </label>
          <button className="btn" type="submit">Email me a link</button>
        </form>
      </div>
    </div>
  );
}
