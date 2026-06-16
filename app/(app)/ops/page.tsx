// app/(app)/ops/page.tsx — middle-office workspace (Block C).
// Server component, tenant-scoped via resolveUser().firmId. Layout already
// redirects anonymous; here we gate by role so a non-ops authenticated user
// sees a clear "not authorized" notice rather than a blank page (mirrors
// app/(app)/approvals/page.tsx).
import { resolveUser } from '@/lib/auth/caller';
import { getOpsTrades, getOpsHandoffs } from '@/lib/queries/ops';
import OpsClient from './ops-client';

export default async function OpsPage() {
  const caller = await resolveUser();
  if (caller.kind !== 'user') return null;
  if (caller.role !== 'ops' && caller.role !== 'admin') {
    return (
      <div className="card">
        <h3>Not authorized</h3>
        <p className="t-faint">
          The Ops &amp; STP workspace is for middle-office users. Your role is
          {' '}<span className="mono">{caller.role}</span>.
        </p>
      </div>
    );
  }

  const [tradeRows, handoffRows] = await Promise.all([
    getOpsTrades(caller.firmId),
    getOpsHandoffs(caller.firmId),
  ]);

  // Group trades by rfq for the "Generate handoff" affordance: a rfq is
  // eligible only when all its trades are still `captured` AND no handoff
  // exists yet. This matches the action's preconditions so the button never
  // appears in a state that would throw.
  const handoffRfqIds = new Set(handoffRows.map((h) => h.rfqId));
  const byRfq = new Map<string, typeof tradeRows>();
  for (const t of tradeRows) {
    const list = byRfq.get(t.rfqId) ?? [];
    list.push(t);
    byRfq.set(t.rfqId, list);
  }
  const eligibleHandoffs = Array.from(byRfq.entries())
    .filter(([rfqId, ts]) => !handoffRfqIds.has(rfqId) && ts.every((t) => t.status === 'captured'))
    .map(([rfqId, ts]) => ({
      rfqId,
      rfqRef: ts[0].rfqRef,
      publicRef: ts[0].publicRef,
      rfqTitle: ts[0].rfqTitle,
      legCount: ts.length,
    }));

  return <OpsClient trades={tradeRows} handoffs={handoffRows} eligibleHandoffs={eligibleHandoffs} />;
}
