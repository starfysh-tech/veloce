// app/(app)/admin/actions.ts — functional admin config mutations.
// Bank panels are tenant-owned config already consumed by Create RFQ. Each
// mutation writes through recordEvent() so the audit log stays aligned with
// the state tables.
'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { bankPanelMembers, bankPanels, firms } from '@/db/schema';
import { resolveUser } from '@/lib/auth/caller';
import { hasUniqueIds, MIN_RFQ_DEALERS } from '@/lib/panel-policy';
import { recordEvent } from '@/lib/record-event';

const PanelName = z.string().trim().min(1, 'Panel name is required.').max(80, 'Panel name is too long.');
const DealerIds = z
  .array(z.string().uuid())
  .min(MIN_RFQ_DEALERS, `At least ${MIN_RFQ_DEALERS} dealers are required for an RFQ-ready panel.`)
  .refine(hasUniqueIds, 'Dealer list cannot contain duplicates.');

const CreatePanelSchema = z.object({
  name: PanelName,
  dealerFirmIds: DealerIds,
  isDefault: z.boolean().optional(),
});
const RenamePanelSchema = z.object({ panelId: z.string().uuid(), name: PanelName });
const SetDefaultPanelSchema = z.object({ panelId: z.string().uuid() });
const UpdateMembersSchema = z.object({ panelId: z.string().uuid(), dealerFirmIds: DealerIds });
const DeletePanelSchema = z.object({ panelId: z.string().uuid() });

async function requireAdmin() {
  const caller = await resolveUser();
  if (caller.kind !== 'user' || caller.role !== 'admin') {
    throw new Error('Only an admin user can perform this action.');
  }
  return caller;
}

async function getOwnedPanel(panelId: string, firmId: string) {
  const rows = await db
    .select({ id: bankPanels.id, name: bankPanels.name, isDefault: bankPanels.isDefault })
    .from(bankPanels)
    .where(and(eq(bankPanels.id, panelId), eq(bankPanels.firmId, firmId)))
    .limit(1);
  const panel = rows[0];
  if (!panel) throw new Error('Panel not found.');
  return panel;
}

async function assertDealerFirms(dealerFirmIds: string[]) {
  const rows = await db
    .select({ id: firms.id })
    .from(firms)
    .where(and(eq(firms.type, 'dealer'), inArray(firms.id, dealerFirmIds)));
  if (rows.length !== dealerFirmIds.length) {
    throw new Error('One or more selected dealers are invalid.');
  }
}

function revalidateAdminConfig() {
  revalidatePath('/admin');
  revalidatePath('/rfqs/new');
}

export async function createBankPanelAction(input: unknown) {
  const caller = await requireAdmin();
  const parsed = CreatePanelSchema.parse(input);
  await assertDealerFirms(parsed.dealerFirmIds);

  const panelId = randomUUID();
  const isDefault = parsed.isDefault ?? false;

  await recordEvent(
    { kind: 'user', userId: caller.userId, label: caller.label },
    {
      firmId: caller.firmId,
      type: 'bank_panel_updated',
      summary: `Created bank panel ${parsed.name}`,
      detail: { action: 'created', panelId, name: parsed.name, dealerFirmIds: parsed.dealerFirmIds, isDefault },
    },
    async (tx) => {
      if (isDefault) {
        await tx
          .update(bankPanels)
          .set({ isDefault: false })
          .where(and(eq(bankPanels.firmId, caller.firmId), eq(bankPanels.isDefault, true)));
      }
      await tx.insert(bankPanels).values({
        id: panelId,
        firmId: caller.firmId,
        name: parsed.name,
        isDefault,
      });
      await tx.insert(bankPanelMembers).values(
        parsed.dealerFirmIds.map((dealerFirmId) => ({ panelId, dealerFirmId })),
      );
    },
  );

  revalidateAdminConfig();
  return { ok: true as const, panelId };
}

export async function renameBankPanelAction(input: unknown) {
  const caller = await requireAdmin();
  const parsed = RenamePanelSchema.parse(input);
  const panel = await getOwnedPanel(parsed.panelId, caller.firmId);

  await recordEvent(
    { kind: 'user', userId: caller.userId, label: caller.label },
    {
      firmId: caller.firmId,
      type: 'bank_panel_updated',
      summary: `Renamed bank panel ${panel.name} to ${parsed.name}`,
      detail: { action: 'renamed', panelId: parsed.panelId, from: panel.name, to: parsed.name },
    },
    async (tx) => {
      const [updated] = await tx
        .update(bankPanels)
        .set({ name: parsed.name })
        .where(and(eq(bankPanels.id, parsed.panelId), eq(bankPanels.firmId, caller.firmId)))
        .returning({ id: bankPanels.id });
      if (!updated) throw new Error('Panel state changed — refresh and try again.');
    },
  );

  revalidateAdminConfig();
  return { ok: true as const };
}

export async function setDefaultBankPanelAction(input: unknown) {
  const caller = await requireAdmin();
  const parsed = SetDefaultPanelSchema.parse(input);
  const panel = await getOwnedPanel(parsed.panelId, caller.firmId);

  await recordEvent(
    { kind: 'user', userId: caller.userId, label: caller.label },
    {
      firmId: caller.firmId,
      type: 'bank_panel_updated',
      summary: `Set default bank panel to ${panel.name}`,
      detail: { action: 'default_set', panelId: parsed.panelId, name: panel.name },
    },
    async (tx) => {
      await tx
        .update(bankPanels)
        .set({ isDefault: false })
        .where(and(eq(bankPanels.firmId, caller.firmId), ne(bankPanels.id, parsed.panelId)));
      const [updated] = await tx
        .update(bankPanels)
        .set({ isDefault: true })
        .where(and(eq(bankPanels.id, parsed.panelId), eq(bankPanels.firmId, caller.firmId)))
        .returning({ id: bankPanels.id });
      if (!updated) throw new Error('Panel state changed — refresh and try again.');
    },
  );

  revalidateAdminConfig();
  return { ok: true as const };
}

export async function updateBankPanelMembersAction(input: unknown) {
  const caller = await requireAdmin();
  const parsed = UpdateMembersSchema.parse(input);
  const panel = await getOwnedPanel(parsed.panelId, caller.firmId);
  await assertDealerFirms(parsed.dealerFirmIds);

  await recordEvent(
    { kind: 'user', userId: caller.userId, label: caller.label },
    {
      firmId: caller.firmId,
      type: 'bank_panel_updated',
      summary: `Updated dealers for ${panel.name}`,
      detail: { action: 'members_updated', panelId: parsed.panelId, name: panel.name, dealerFirmIds: parsed.dealerFirmIds },
    },
    async (tx) => {
      const [owned] = await tx
        .select({ id: bankPanels.id })
        .from(bankPanels)
        .where(and(eq(bankPanels.id, parsed.panelId), eq(bankPanels.firmId, caller.firmId)))
        .limit(1);
      if (!owned) throw new Error('Panel state changed — refresh and try again.');
      await tx.delete(bankPanelMembers).where(eq(bankPanelMembers.panelId, parsed.panelId));
      await tx.insert(bankPanelMembers).values(
        parsed.dealerFirmIds.map((dealerFirmId) => ({ panelId: parsed.panelId, dealerFirmId })),
      );
    },
  );

  revalidateAdminConfig();
  return { ok: true as const };
}

export async function deleteBankPanelAction(input: unknown) {
  const caller = await requireAdmin();
  const parsed = DeletePanelSchema.parse(input);
  const panel = await getOwnedPanel(parsed.panelId, caller.firmId);
  if (panel.isDefault) throw new Error('Choose another default panel before deleting this one.');

  const siblingPanels = await db
    .select({ id: bankPanels.id })
    .from(bankPanels)
    .where(eq(bankPanels.firmId, caller.firmId))
    .limit(2);
  if (siblingPanels.length <= 1) throw new Error('At least one bank panel is required.');

  await recordEvent(
    { kind: 'user', userId: caller.userId, label: caller.label },
    {
      firmId: caller.firmId,
      type: 'bank_panel_updated',
      summary: `Deleted bank panel ${panel.name}`,
      detail: { action: 'deleted', panelId: parsed.panelId, name: panel.name },
    },
    async (tx) => {
      const [deleted] = await tx
        .delete(bankPanels)
        .where(and(eq(bankPanels.id, parsed.panelId), eq(bankPanels.firmId, caller.firmId)))
        .returning({ id: bankPanels.id });
      if (!deleted) throw new Error('Panel state changed — refresh and try again.');
    },
  );

  revalidateAdminConfig();
  return { ok: true as const };
}
