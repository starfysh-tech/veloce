// app/(app)/layout.tsx — authenticated shell. Resolves the caller; anonymous
// callers are redirected to login. The rail nav is role-aware.
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { resolveUser } from '@/lib/auth/caller';
import { signOut } from '@/app/login/actions';
import { Icon } from '@/components/ui';

const NAV: Record<string, { href: string; label: string; icon: string }[]> = {
  trader: [
    { href: '/rfqs', label: 'RFQs', icon: 'list' },
    { href: '/rfqs/new', label: 'Create RFQ', icon: 'plus' },
  ],
  approver: [
    { href: '/rfqs', label: 'RFQs', icon: 'list' },
    { href: '/approvals', label: 'Approvals', icon: 'check' },
  ],
  ops: [
    { href: '/rfqs', label: 'RFQs', icon: 'list' },
    { href: '/ops', label: 'Trades & STP', icon: 'flow' },
  ],
  compliance: [
    { href: '/rfqs', label: 'RFQs', icon: 'list' },
    { href: '/compliance', label: 'Best Execution', icon: 'shield' },
  ],
  admin: [
    { href: '/rfqs', label: 'RFQs', icon: 'list' },
    { href: '/admin', label: 'Administration', icon: 'gear' },
  ],
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const caller = await resolveUser();
  if (caller.kind !== 'user') redirect('/login');

  const nav = NAV[caller.role] ?? NAV.trader;
  const initials = caller.label.split(' ').map((w) => w[0]).join('').slice(0, 2);

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <div className="brand-mark" aria-hidden><Icon name="bolt" size={18} /></div>
          <div>
            <div className="brand-name">VELOCE</div>
            <div className="brand-sub">Financial Technologies</div>
          </div>
        </div>
        <div className="rail-label">Workspace</div>
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className="nav-item">
            <Icon name={n.icon} size={15} /> {n.label}
          </Link>
        ))}
        <div className="rail-foot">
          <div className="persona">
            <div className="avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{caller.label}</b>
              <span style={{ textTransform: 'capitalize' }}>{caller.role}</span>
            </div>
          </div>
          <form action={signOut} style={{ marginTop: 10 }}>
            <button className="btn btn-ghost btn-sm" type="submit" style={{ width: '100%' }}>Sign out</button>
          </form>
        </div>
      </aside>
      <div className="main">
        <main className="content">
          <div className="content-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
