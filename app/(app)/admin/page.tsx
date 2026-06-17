// app/(app)/admin/page.tsx — admin configuration workspace.
// Server component: resolves caller, gates to admin, then fetches the tenant's
// admin overview. Panel edits are handled by client-triggered server actions.
import { resolveUser } from '@/lib/auth/caller';
import { getAdminOverview } from '@/lib/queries/admin';
import AdminClient from './admin-client';

export default async function AdminPage() {
  const caller = await resolveUser();
  if (caller.kind !== 'user') return null;
  if (caller.role !== 'admin') {
    return (
      <div className="card">
        <h3>Not authorized</h3>
        <p className="t-faint">
          The administration workspace is restricted to admin users. Your role is{' '}
          <span className="mono">{caller.role}</span>.
        </p>
      </div>
    );
  }

  const overview = await getAdminOverview(caller.firmId);
  return <AdminClient overview={overview} />;
}
