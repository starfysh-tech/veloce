// app/(app)/rfqs/new/page.tsx — Create-RFQ wizard host.
// Server component: resolves the trader, fetches this firm's panels + members
// inline (no separate query module per plan), and hands serialized data to the
// client wizard. Tenant boundary is firmId; dealer firms reached only via
// panels owned by the caller's firm.
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { bankPanels, bankPanelMembers, firms } from '@/db/schema';
import { resolveUser } from '@/lib/auth/caller';
import { Wizard } from './wizard';

export const dynamic = 'force-dynamic';

export type DealerOption = { id: string; name: string };
export type PanelOption = { id: string; name: string; isDefault: boolean; dealerIds: string[] };

export default async function NewRfqPage() {
  const caller = await resolveUser();
  if (caller.kind !== 'user') redirect('/login');
  if (caller.role !== 'trader' && caller.role !== 'admin') {
    redirect('/rfqs');
  }

  const panelRows = await db
    .select({
      panelId: bankPanels.id,
      panelName: bankPanels.name,
      isDefault: bankPanels.isDefault,
      dealerFirmId: bankPanelMembers.dealerFirmId,
      dealerName: firms.name,
    })
    .from(bankPanels)
    .innerJoin(bankPanelMembers, eq(bankPanelMembers.panelId, bankPanels.id))
    .innerJoin(firms, eq(firms.id, bankPanelMembers.dealerFirmId))
    .where(eq(bankPanels.firmId, caller.firmId));

  // Fold flat rows into panel + dealer maps.
  const panelMap = new Map<string, PanelOption>();
  const dealerMap = new Map<string, DealerOption>();
  for (const row of panelRows) {
    let p = panelMap.get(row.panelId);
    if (!p) {
      p = { id: row.panelId, name: row.panelName, isDefault: row.isDefault, dealerIds: [] };
      panelMap.set(row.panelId, p);
    }
    p.dealerIds.push(row.dealerFirmId);
    if (!dealerMap.has(row.dealerFirmId)) {
      dealerMap.set(row.dealerFirmId, { id: row.dealerFirmId, name: row.dealerName });
    }
  }

  const panels = [...panelMap.values()].sort((a, b) =>
    a.isDefault === b.isDefault ? a.name.localeCompare(b.name) : a.isDefault ? -1 : 1,
  );
  const dealers = [...dealerMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div className="row">
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Create RFQ</h2>
          <div className="t-faint">Configure the auction, invite dealers, launch.</div>
        </div>
      </div>
      <Wizard panels={panels} dealers={dealers} />
    </>
  );
}
