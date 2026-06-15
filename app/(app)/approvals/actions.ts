// app/(app)/approvals/actions.ts — approver mutations (Block B step 8).
//
// Three server actions: approveAward, rejectAward, requestClarification.
// Each is a single recordEvent() call wrapping all DB mutations in apply(tx).
// All three start with a conditional UPDATE on rfqs.status — only the caller
// that finds the row still 'awaiting_approval' wins; everyone else throws
// StaleApprovalError. This is the concurrency guard (no SELECT FOR UPDATE
// needed; per docs/blocks/block-b-approvals.md "Decisions resolved").
'use server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { rfqs, awards, trades, exceptions } from '@/db/schema';
import { resolveUser } from '@/lib/auth/caller';
import { recordEvent } from '@/lib/record-event';
import {
  type AwardFlag,
  validateFlagAcks,
  validateCommitteeNote,
  requiresCommitteeNote,
  concentrationFlag,
  projectConcentration,
} from '@/lib/policy';
import { getDealerConcentration } from '@/lib/queries/concentration';
import { generateTradeRef } from '@/lib/trade-ref';
import { notifyAwardApproved } from '@/lib/email';

/**
 * Thrown when an approver acts on an RFQ that has already moved past
 * `awaiting_approval` (someone else approved/rejected, or the auction was
 * re-opened). Carries a discriminating `name` so the client can render a
 * "refresh the page" message instead of a generic error.
 */
export class StaleApprovalError extends Error {
  override name = 'StaleApprovalError';
  constructor(message = 'RFQ no longer awaiting approval — refresh and try again.') {
    super(message);
  }
}

// ---------------------------------------------------------------- approve

export async function approveAward(input: {
  rfqId: string;
  ackedFlagIds: string[];
  committeeNote?: string;
}) {
  const caller = await resolveUser();
  if (caller.kind !== 'user' || caller.role !== 'approver') {
    throw new Error('Only an approver can approve an award.');
  }
  const { rfqId } = input;

  // Re-snapshot concentration BEFORE opening the tx (read-only). The
  // conditional UPDATE inside apply(tx) locks the rfq row, so the snapshot
  // cannot drift in a way the projection inside the tx would miss. Calling
  // getDealerConcentration with the tx is also fine; outside is the cleaner
  // pattern since the helper is exported against `db`.
  // NOTE: we re-fetch the rfq's firmId after the conditional update for the
  // tenant check, but the snapshot is per-firm so we need it first. Look up
  // the rfq's firmId once here; the conditional update inside the tx is the
  // source of truth.
  const rfqRow = await db
    .select({ firmId: rfqs.firmId })
    .from(rfqs)
    .where(eq(rfqs.id, rfqId))
    .limit(1);
  if (!rfqRow.length) throw new Error('RFQ not found.');
  if (rfqRow[0].firmId !== caller.firmId) throw new Error('Not your firm');
  const snapshot = await getDealerConcentration(rfqRow[0].firmId, new Date());

  // Mutable detail object — recordEvent reads `event.detail` AFTER apply()
  // returns (lib/record-event.ts:44-57), so mutations inside apply() are
  // observed by the event insert. Same pattern as recommendAwardAction.
  const detail: {
    tradeRefs: string[];
    closedExceptionRefs: string[];
    ackedFlagIds: string[];
    committeeNoteProvided: boolean;
  } = {
    tradeRefs: [],
    closedExceptionRefs: [],
    ackedFlagIds: input.ackedFlagIds,
    committeeNoteProvided: !!input.committeeNote,
  };

  const result = await recordEvent(
    { kind: 'user', userId: caller.userId, label: caller.label },
    {
      firmId: rfqRow[0].firmId,
      rfqId,
      type: 'award_approved',
      summary: 'Award approved',
      detail,
    },
    async (tx) => {
      // 1. Conditional UPDATE — concurrency guard.
      const [updated] = await tx
        .update(rfqs)
        .set({ status: 'awarded' })
        .where(and(eq(rfqs.id, rfqId), eq(rfqs.status, 'awaiting_approval')))
        .returning();
      if (!updated) throw new StaleApprovalError();
      if (updated.firmId !== caller.firmId) throw new Error('Not your firm');

      // 2. Re-fetch the award.
      const awardRows = await tx
        .select()
        .from(awards)
        .where(eq(awards.rfqId, rfqId))
        .limit(1);
      const award = awardRows[0];
      if (!award) throw new Error('No award to approve on this RFQ.');

      const flags = (award.flags ?? []) as AwardFlag[];

      // 3. Re-validate ack of every warn-severity flag id.
      const ackCheck = validateFlagAcks(flags, input.ackedFlagIds);
      if (!ackCheck.ok) {
        throw new Error(
          `Missing acknowledgements for flag(s): ${ackCheck.missing.join(', ')}`,
        );
      }

      // 4. Re-validate >$250M committee note.
      if (requiresCommitteeNote(updated.notionalMinor)) {
        const v = validateCommitteeNote(input.committeeNote);
        if (!v.ok) {
          throw new Error(
            v.reason ?? 'Committee note required (≥20 chars trimmed).',
          );
        }
      }

      // 5. Re-evaluate concentration vs the snapshot taken pre-tx. If a NEW
      // warn flag would emerge that is NOT already in award.flags (by id),
      // concentration drifted since recommend — fail loudly and ask the
      // trader to re-recommend.
      const allocations = award.allocations as Array<{
        dealerFirmId: string;
        pct: number;
        price: string;
      }>;
      const existingFlagIds = new Set(flags.map((f) => f.id));
      for (const alloc of allocations) {
        const allocNotionalMinor = Math.round(
          (updated.notionalMinor * alloc.pct) / 100,
        );
        const projected = projectConcentration(snapshot, {
          dealerFirmId: alloc.dealerFirmId,
          proposedNotionalMinor: allocNotionalMinor,
        });
        const dealerShareBps =
          projected[alloc.dealerFirmId]?.shareBps ?? 0;
        const newFlag = concentrationFlag(dealerShareBps);
        if (newFlag && !existingFlagIds.has(newFlag.id)) {
          throw new Error(
            'Concentration changed since recommend — re-recommend the award and retry approval.',
          );
        }
      }

      // 6. Mark award approved.
      await tx
        .update(awards)
        .set({
          approved: true,
          approvedBy: caller.userId,
          approvedAt: new Date(),
        })
        .where(eq(awards.id, award.id));

      // 7. Insert one trade per allocation. allocNotionalMinor uses BigInt
      // math to avoid float drift at large notionals (db/schema.ts:124, 231
      // are both bigint mode:number).
      const tradeRows = allocations.map((a) => ({
        ref: generateTradeRef(),
        rfqId,
        dealerFirmId: a.dealerFirmId,
        pct: a.pct,
        allocNotionalMinor: Number(
          (BigInt(updated.notionalMinor) * BigInt(a.pct)) / 100n,
        ),
        ccy: updated.ccy,
        price: a.price,
        priceUnit: updated.quoteUnit,
        // status defaults to 'captured' (db/schema.ts:235).
      }));
      await tx.insert(trades).values(tradeRows);

      // 8. Close ALL open exceptions for this rfq. `exceptions` has no
      // `closedAt` column (db/schema.ts:273-286) — only `status` and `open`.
      const openExceptions = await tx
        .select({ id: exceptions.id, ref: exceptions.ref })
        .from(exceptions)
        .where(
          and(eq(exceptions.rfqId, rfqId), eq(exceptions.open, true)),
        );
      if (openExceptions.length) {
        await tx
          .update(exceptions)
          .set({ status: 'closed', open: false })
          .where(
            and(eq(exceptions.rfqId, rfqId), eq(exceptions.open, true)),
          );
      }

      detail.tradeRefs = tradeRows.map((t) => t.ref);
      detail.closedExceptionRefs = openExceptions.map((e) => e.ref);

      return {
        tradeRefs: detail.tradeRefs,
        closedExceptionRefs: detail.closedExceptionRefs,
      };
    },
  );

  // Post-commit: fire-and-forget approval email. Failures logged inside
  // lib/email.ts (accepted gap per docs/open-decisions.md:67-75).
  notifyAwardApproved(rfqId).catch(() => {
    /* swallowed; lib/email.ts logs */
  });

  return {
    ok: true as const,
    tradeRefs: result.tradeRefs,
    closedExceptionRefs: result.closedExceptionRefs,
  };
}

// ---------------------------------------------------------------- reject

export async function rejectAward(input: { rfqId: string; reason: string }) {
  const caller = await resolveUser();
  if (caller.kind !== 'user' || caller.role !== 'approver') {
    throw new Error('Only an approver can reject an award.');
  }
  const reason = input.reason?.trim() ?? '';
  if (reason.length === 0) {
    throw new Error('A reason is required to reject an award.');
  }

  const rfqRow = await db
    .select({ firmId: rfqs.firmId })
    .from(rfqs)
    .where(eq(rfqs.id, input.rfqId))
    .limit(1);
  if (!rfqRow.length) throw new Error('RFQ not found.');
  if (rfqRow[0].firmId !== caller.firmId) throw new Error('Not your firm');

  await recordEvent(
    { kind: 'user', userId: caller.userId, label: caller.label },
    {
      firmId: rfqRow[0].firmId,
      rfqId: input.rfqId,
      type: 'award_rejected',
      summary: 'Award rejected',
      detail: { reason },
    },
    async (tx) => {
      const [updated] = await tx
        .update(rfqs)
        .set({ status: 'under_review' })
        .where(
          and(
            eq(rfqs.id, input.rfqId),
            eq(rfqs.status, 'awaiting_approval'),
          ),
        )
        .returning();
      if (!updated) throw new StaleApprovalError();
      if (updated.firmId !== caller.firmId) throw new Error('Not your firm');
    },
  );

  return { ok: true as const };
}

// ----------------------------------------------------- request clarification

export async function requestClarification(input: {
  rfqId: string;
  note: string;
}) {
  const caller = await resolveUser();
  if (caller.kind !== 'user' || caller.role !== 'approver') {
    throw new Error('Only an approver can request clarification.');
  }
  const note = input.note?.trim() ?? '';
  if (note.length === 0) {
    throw new Error('A note is required to request clarification.');
  }

  const rfqRow = await db
    .select({ firmId: rfqs.firmId })
    .from(rfqs)
    .where(eq(rfqs.id, input.rfqId))
    .limit(1);
  if (!rfqRow.length) throw new Error('RFQ not found.');
  if (rfqRow[0].firmId !== caller.firmId) throw new Error('Not your firm');

  await recordEvent(
    { kind: 'user', userId: caller.userId, label: caller.label },
    {
      firmId: rfqRow[0].firmId,
      rfqId: input.rfqId,
      type: 'clarification_requested',
      summary: 'Clarification requested',
      detail: { note },
    },
    async (tx) => {
      const [updated] = await tx
        .update(rfqs)
        .set({ status: 'under_review' })
        .where(
          and(
            eq(rfqs.id, input.rfqId),
            eq(rfqs.status, 'awaiting_approval'),
          ),
        )
        .returning();
      if (!updated) throw new StaleApprovalError();
      if (updated.firmId !== caller.firmId) throw new Error('Not your firm');
    },
  );

  return { ok: true as const };
}
