// lib/queries/admin.ts — tenant-aware reads for the Admin workspace.
// Bank panels are the first functional admin config surface because the RFQ
// wizard already consumes them. Product templates and policy gates remain
// code-backed/read-only until their enforcement paths read persisted config.
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { bankPanelMembers, bankPanels, events, firms, users } from '@/db/schema';
import {
  APPROVER_NOTIONAL_THRESHOLD_MINOR,
  COMMITTEE_NOTE_THRESHOLD_MINOR,
  CONCENTRATION_FLAG_THRESHOLD_BPS,
} from '@/lib/policy';
import { TEMPLATES } from '@/lib/templates';

export type AdminFirmRow = {
  id: string;
  name: string;
  type: 'insurer' | 'fund' | 'dealer';
  city: string | null;
  lei: string | null;
  shortCode: string | null;
  colorHex: string | null;
};

export type AdminUserRow = {
  id: string;
  email: string;
  fullName: string;
  role: 'trader' | 'approver' | 'ops' | 'compliance' | 'admin';
  desk: string | null;
  active: boolean;
};

export type AdminDealerRow = {
  id: string;
  name: string;
  lei: string | null;
  shortCode: string | null;
  colorHex: string | null;
};

export type AdminPanelRow = {
  id: string;
  name: string;
  isDefault: boolean;
  dealerIds: string[];
};

export type AdminEventRow = {
  id: string;
  type: string;
  actorLabel: string;
  summary: string;
  createdAt: Date;
};

export type AdminStaticRule = {
  id: string;
  label: string;
  value: string;
  note: string;
};

export type AdminOverview = {
  firm: AdminFirmRow | null;
  users: AdminUserRow[];
  dealers: AdminDealerRow[];
  panels: AdminPanelRow[];
  templates: typeof TEMPLATES;
  auctionRules: AdminStaticRule[];
  thresholds: AdminStaticRule[];
  events: AdminEventRow[];
};

export function adminFirmQuery(firmId: string) {
  return db
    .select({
      id: firms.id,
      name: firms.name,
      type: firms.type,
      city: firms.city,
      lei: firms.lei,
      shortCode: firms.shortCode,
      colorHex: firms.colorHex,
    })
    .from(firms)
    .where(eq(firms.id, firmId))
    .limit(1);
}

export function adminUsersQuery(firmId: string) {
  return db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      desk: users.desk,
      active: users.active,
    })
    .from(users)
    .where(eq(users.firmId, firmId))
    .orderBy(asc(users.fullName));
}

export function adminDealersQuery() {
  return db
    .select({
      id: firms.id,
      name: firms.name,
      lei: firms.lei,
      shortCode: firms.shortCode,
      colorHex: firms.colorHex,
    })
    .from(firms)
    .where(eq(firms.type, 'dealer'))
    .orderBy(asc(firms.name));
}

export function adminBankPanelsQuery(firmId: string) {
  return db
    .select({
      panelId: bankPanels.id,
      panelName: bankPanels.name,
      isDefault: bankPanels.isDefault,
      dealerFirmId: bankPanelMembers.dealerFirmId,
    })
    .from(bankPanels)
    .leftJoin(bankPanelMembers, eq(bankPanelMembers.panelId, bankPanels.id))
    .where(eq(bankPanels.firmId, firmId))
    .orderBy(desc(bankPanels.isDefault), asc(bankPanels.name));
}

export function adminEventsQuery(firmId: string) {
  return db
    .select({
      id: events.id,
      type: events.type,
      actorLabel: events.actorLabel,
      summary: events.summary,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(eq(events.firmId, firmId))
    .orderBy(desc(events.createdAt))
    .limit(80);
}

const AUCTION_RULES: AdminStaticRule[] = [
  {
    id: 'deadline',
    label: 'Auction deadline',
    value: 'Hard deadline',
    note: 'Quote writes self-validate against the stored deadline; no auto-extension is active.',
  },
  {
    id: 'revisions',
    label: 'Quote revisions',
    value: 'Unlimited before close',
    note: 'Dealers can revise while the RFQ is live; revisions update the latest quote row.',
  },
  {
    id: 'allocation',
    label: 'Allocation mode',
    value: 'Per RFQ',
    note: 'Create RFQ chooses split allocation or full-size-only for each auction.',
  },
  {
    id: 'blind',
    label: 'Dealer visibility',
    value: 'Per RFQ blind setting',
    note: 'Blind auctions never expose competitor identities or levels to dealers.',
  },
];

const THRESHOLDS: AdminStaticRule[] = [
  {
    id: 'approver',
    label: 'Approver required',
    value: 'Notional > $100M',
    note: `Enforced by requiresApprover(notionalMinor > ${APPROVER_NOTIONAL_THRESHOLD_MINOR}).`,
  },
  {
    id: 'committee',
    label: 'Committee note',
    value: 'Notional > $250M',
    note: `Trips at notionalMinor > ${COMMITTEE_NOTE_THRESHOLD_MINOR}; MVP enforces single approver plus note.`,
  },
  {
    id: 'concentration',
    label: 'Dealer concentration flag',
    value: 'Projected share > 35%',
    note: `Computed as shareBps > ${CONCENTRATION_FLAG_THRESHOLD_BPS} on trailing-90-day awarded notional, indicative USD basis.`,
  },
  {
    id: 'best-ex',
    label: 'Best-ex deviation',
    value: 'Award price != best quote',
    note: 'Requires explicit deviation rationale and opens a compliance exception.',
  },
];

function shapePanels(rows: Awaited<ReturnType<typeof adminBankPanelsQuery>>): AdminPanelRow[] {
  const byId = new Map<string, AdminPanelRow>();
  for (const row of rows) {
    let panel = byId.get(row.panelId);
    if (!panel) {
      panel = { id: row.panelId, name: row.panelName, isDefault: row.isDefault, dealerIds: [] };
      byId.set(row.panelId, panel);
    }
    if (row.dealerFirmId) panel.dealerIds.push(row.dealerFirmId);
  }
  return [...byId.values()];
}

export async function getAdminOverview(firmId: string): Promise<AdminOverview> {
  const [firmRows, userRows, dealerRows, panelRows, eventRows] = await Promise.all([
    adminFirmQuery(firmId),
    adminUsersQuery(firmId),
    adminDealersQuery(),
    adminBankPanelsQuery(firmId),
    adminEventsQuery(firmId),
  ]);

  return {
    firm: firmRows[0] ?? null,
    users: userRows,
    dealers: dealerRows,
    panels: shapePanels(panelRows),
    templates: TEMPLATES,
    auctionRules: AUCTION_RULES,
    thresholds: THRESHOLDS,
    events: eventRows,
  };
}
