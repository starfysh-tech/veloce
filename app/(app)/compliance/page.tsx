// app/(app)/compliance/page.tsx — compliance / best-execution workspace.
// Read-only server component: resolves the caller, role-gates, then fetches
// tenant-scoped compliance evidence for the client tabs.
import { resolveUser } from '@/lib/auth/caller';
import { getComplianceOverview } from '@/lib/queries/compliance';
import ComplianceClient from './compliance-client';

export default async function CompliancePage() {
  const caller = await resolveUser();
  if (caller.kind !== 'user') return null;
  if (caller.role !== 'compliance' && caller.role !== 'admin') {
    return (
      <div className="card">
        <h3>Not authorized</h3>
        <p className="t-faint">
          The compliance workspace is restricted to compliance and admin users.
          Your role is <span className="mono">{caller.role}</span>.
        </p>
      </div>
    );
  }

  const overview = await getComplianceOverview(caller.firmId);
  return <ComplianceClient overview={overview} />;
}
