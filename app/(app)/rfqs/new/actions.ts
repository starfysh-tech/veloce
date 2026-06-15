// app/(app)/rfqs/new/actions.ts — launch a new RFQ.
// One rfq_launched event via recordEvent(); the invited-dealer list lives in
// that event's detail.invitedDealerIds for audit.
'use server';

import { randomBytes, randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import {
  bankPanels,
  bankPanelMembers,
  firms,
  invitations,
  rfqInvitedDealers,
  rfqs,
} from '@/db/schema';
import { hashToken, resolveUser } from '@/lib/auth/caller';
import { recordEvent } from '@/lib/record-event';
import { sendInvitation } from '@/lib/email';
import { generatePublicRef } from '@/lib/public-ref';
import { TEMPLATES, type TemplateId } from '@/lib/templates';

const TEMPLATE_IDS = TEMPLATES.map((t) => t.id) as [TemplateId, ...TemplateId[]];

const LaunchRfqSchema = z.object({
  template: z.enum(TEMPLATE_IDS),
  title: z.string().min(1),
  product: z.string().min(1),
  side: z.string().min(1),
  underlying: z.string().min(1),
  refLevel: z.string().min(1),
  strike: z.string().min(1),
  expiry: z.string().min(1),
  style: z.string().min(1),
  tenor: z.string().min(1),
  notionalMillions: z.number().positive(),
  ccy: z.string().min(1),
  quoteUnit: z.string().min(1),
  windowMinutes: z.number().int().positive(),
  mode: z.enum(['split', 'full']),
  blind: z.boolean(),
  panelId: z.string().uuid(),
  invited: z
    .array(z.string().uuid())
    .min(3)
    .refine((arr) => new Set(arr).size === arr.length, {
      message: 'Invited dealers must be unique',
    }),
});

export type LaunchRfqInput = z.infer<typeof LaunchRfqSchema>;

// Slugified dealer email. Collision handling (e.g. +digit suffix) deferred —
// no real collisions in current seed.
function dealerEmailFor(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `randall+${slug}@starfysh.net`;
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

export async function launchRfqAction(input: LaunchRfqInput): Promise<void> {
  const resolved = await resolveUser();
  if (resolved.kind !== 'user' || (resolved.role !== 'trader' && resolved.role !== 'admin')) {
    throw new Error('Only a trader can launch an RFQ.');
  }
  // Pin the narrowed shape so closures below keep type info.
  const caller = resolved;

  const parsed = LaunchRfqSchema.parse(input);

  // Validate panel belongs to this firm.
  const panel = await db.query.bankPanels.findFirst({
    where: and(eq(bankPanels.id, parsed.panelId), eq(bankPanels.firmId, caller.firmId)),
  });
  if (!panel) throw new Error('Invalid panel for this firm.');

  // Validate every invited dealer is a member of this panel.
  const members = await db
    .select({ dealerFirmId: bankPanelMembers.dealerFirmId })
    .from(bankPanelMembers)
    .where(eq(bankPanelMembers.panelId, parsed.panelId));
  const memberSet = new Set(members.map((m) => m.dealerFirmId));
  for (const id of parsed.invited) {
    if (!memberSet.has(id)) throw new Error('Invited dealer is not in the selected panel.');
  }

  // Fetch dealer firm names (for email slug + event detail).
  const dealerRows = await db
    .select({ id: firms.id, name: firms.name })
    .from(firms)
    .where(inArray(firms.id, parsed.invited));
  const dealerByFirmId = new Map(dealerRows.map((d) => [d.id, d]));

  // Pre-mint per-dealer tokens + emails.
  type Premint = { raw: string; email: string; name: string };
  const premintByDealer = new Map<string, Premint>();
  for (const dealerFirmId of parsed.invited) {
    const dealer = dealerByFirmId.get(dealerFirmId);
    if (!dealer) throw new Error('Invited dealer firm not found.');
    premintByDealer.set(dealerFirmId, {
      raw: randomBytes(24).toString('base64url'),
      email: dealerEmailFor(dealer.name),
      name: dealer.name,
    });
  }

  // One-shot publicRef (Crockford base32). Unique constraint is the backstop.
  const publicRef = generatePublicRef();

  // Pre-generate rfqId because recordEvent builds the event row from its
  // argument BEFORE apply runs — event.rfqId must be known up front
  // (lib/record-event.ts:44).
  const rfqId = randomUUID();

  const now = new Date();
  const deadline = new Date(now.getTime() + parsed.windowMinutes * 60_000);
  const notionalMinor = parsed.notionalMillions * 100_000_000;
  const year = now.getUTCFullYear();
  const refPrefix = `VEL-${year}-`;

  await recordEvent(
    { kind: 'user', userId: caller.userId, label: caller.label },
    {
      firmId: caller.firmId,
      rfqId,
      type: 'rfq_launched',
      summary: `Launched ${publicRef} — ${parsed.title}`,
      detail: {
        publicRef,
        template: parsed.template,
        panelId: parsed.panelId,
        invitedDealerIds: parsed.invited,
        notionalMinor,
        ccy: parsed.ccy,
        windowMinutes: parsed.windowMinutes,
      },
    },
    async (tx) => {
      // Compute next per-firm, per-year sequence inside the tx for snapshot
      // consistency. Drizzle sql template precedent: lib/queries/rfqs.ts:4.
      async function nextRef(): Promise<string> {
        const rows = await tx.execute<{ max_seq: number | null }>(
          sql`select max(cast(substring(${rfqs.ref} from ${refPrefix.length + 1}) as int)) as max_seq
              from ${rfqs}
              where ${rfqs.firmId} = ${caller.firmId} and ${rfqs.ref} like ${refPrefix + '%'}`,
        );
        const maxSeq = rows[0]?.max_seq ?? 0;
        return refPrefix + pad4(maxSeq + 1);
      }

      // Single insert. On the astronomically-rare (firm_id, ref) race the
      // uniqueIndex will throw 23505 to the user, who clicks Launch again.
      const ref = await nextRef();
      await tx.insert(rfqs).values({
        id: rfqId,
        ref,
        publicRef,
        firmId: caller.firmId,
        requesterId: caller.userId,
        title: parsed.title,
        product: parsed.product,
        template: parsed.template,
        side: parsed.side,
        underlying: parsed.underlying,
        refLevel: parsed.refLevel,
        strike: parsed.strike,
        expiry: parsed.expiry,
        style: parsed.style,
        tenor: parsed.tenor,
        notionalMinor,
        ccy: parsed.ccy,
        quoteUnit: parsed.quoteUnit,
        lowerIsBetter: true,
        mode: parsed.mode,
        blind: parsed.blind,
        status: 'live',
        deadline,
        windowMinutes: parsed.windowMinutes,
        launchedAt: now,
      });

      // Snapshot panel membership.
      await tx.insert(rfqInvitedDealers).values(
        parsed.invited.map((dealerFirmId) => ({ rfqId, dealerFirmId })),
      );

      // Insert invitations with hashed tokens.
      await tx.insert(invitations).values(
        parsed.invited.map((dealerFirmId) => {
          const pm = premintByDealer.get(dealerFirmId)!;
          return {
            id: randomUUID(),
            rfqId,
            dealerFirmId,
            tokenHash: hashToken(pm.raw),
            dealerEmail: pm.email,
          };
        }),
      );
    },
  );

  // Post-commit: dispatch emails in parallel. lib/email.ts swallows errors
  // internally (documented MVP gap), so Promise.all never rejects here.
  await Promise.all(
    parsed.invited.map((dealerFirmId) => {
      const pm = premintByDealer.get(dealerFirmId)!;
      return sendInvitation({
        to: pm.email,
        publicRef,
        rfqTitle: parsed.title,
        token: pm.raw,
        deadline,
      });
    }),
  );

  redirect(`/rfqs/${rfqId}`);
}
