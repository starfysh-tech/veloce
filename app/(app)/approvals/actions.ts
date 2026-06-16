// app/(app)/approvals/actions.ts — approver mutations (Block B step 8).
//
// Three server actions: approveAward, rejectAward, requestClarification.
// Each is a single recordEvent() call wrapping all DB mutations in apply(tx).
// All three start with a conditional UPDATE on rfqs.status — only the caller
// that finds the row still 'awaiting_approval' wins; everyone else throws a
// stale-approval error (see staleApprovalError() below). This is the
// concurrency guard (no SELECT FOR UPDATE needed; per
// docs/blocks/block-b-approvals.md "Decisions resolved").
'use server';
import { and, eq } from 'drizzle-orm';
import { rfqs, awards, trades, exceptions } from '@/db/schema';
import { resolveUser } from '@/lib/auth/caller';
import { recordEvent } from '@/lib/record-event';
import { allocNotionalMinor } from '@/lib/award-math';
import { getRfqFirmIdOrThrow } from '@/lib/queries/rfqs';
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

// Thrown when an approver acts on an RFQ that has already moved past
// `awaiting_approval` (someone else approved/rejected, or the auction was
// re-opened). Next's "use server" boundary forbids non-async exports, so this
// is a plain factory + sentinel message — the client matches on the message
// substring "no longer awaiting approval" to render a "refresh" hint.
const STALE_APPROVAL_MESSAGE =
  'RFQ no longer awaiting approval — refresh and try again.';
const staleApprovalError = () => new Error(STALE_APPROVAL_MESSAGE);

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

  // Cheap pre-tx fetch of firmId — needed to build the EventInput before
  // opening recordEvent. The TRUE tenant gate runs inside apply(tx) after the
  // conditional UPDATE returns; the concentration snapshot also runs inside
  // the tx so it sees committed state at the moment the rfq row is locked,
  // eliminating the inter-RFQ drift window an outer snapshot would have.
  const firmId = await getRfqFirmIdOrThrow(rfqId, caller.firmId);

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
      firmId,
      rfqId,
      type: 'award_approved',
      summary: 'Award approved',
      detail,
    },
    async (tx) => {
      // 1. Conditional UPDATE — concurrency + tenant guard in one. firmId in
      // the WHERE means a wrong-firm caller never even acquires the row lock;
      // the pre-tx getRfqFirmIdOrThrow throws earlier with a clearer message,
      // so reaching this with firmId mismatch is impossible — the predicate
      // is defense-in-depth.
      const [updated] = await tx
        .update(rfqs)
        .set({ status: 'awarded' })
        .where(
          and(
            eq(rfqs.id, rfqId),
            eq(rfqs.status, 'awaiting_approval'),
            eq(rfqs.firmId, caller.firmId),
          ),
        )
        .returning();
      if (!updated) throw staleApprovalError();

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

      // 5. Snapshot concentration INSIDE the tx so it sees committed state at
      // the moment the rfq row is locked (READ COMMITTED). Then project each
      // allocation independently. If a NEW warn flag would emerge that is NOT
      // already in award.flags (by id), concentration drifted since recommend
      // — fail loudly and ask the trader to re-recommend.
      const snapshot = await getDealerConcentration(
        updated.firmId,
        new Date(),
        tx,
      );
      const allocations = award.allocations as Array<{
        dealerFirmId: string;
        pct: number;
        price: string;
      }>;
      const existingFlagIds = new Set(flags.map((f) => f.id));
      for (const alloc of allocations) {
        const projected = projectConcentration(snapshot, {
          dealerFirmId: alloc.dealerFirmId,
          proposedNotionalMinor: allocNotionalMinor(updated.notionalMinor, alloc.pct),
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

      // 7. Insert one trade per allocation. allocNotionalMinor() in
      // lib/award-math.ts is the single source of truth for the BigInt math;
      // see the comment there for why number * number / 100 isn't safe.
      const tradeRows = allocations.map((a) => ({
        ref: generateTradeRef(),
        rfqId,
        dealerFirmId: a.dealerFirmId,
        pct: a.pct,
        allocNotionalMinor: allocNotionalMinor(updated.notionalMinor, a.pct),
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

  const firmId = await getRfqFirmIdOrThrow(input.rfqId, caller.firmId);

  await recordEvent(
    { kind: 'user', userId: caller.userId, label: caller.label },
    {
      firmId,
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
            eq(rfqs.firmId, caller.firmId),
          ),
        )
        .returning();
      if (!updated) throw staleApprovalError();
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

  const firmId = await getRfqFirmIdOrThrow(input.rfqId, caller.firmId);

  await recordEvent(
    { kind: 'user', userId: caller.userId, label: caller.label },
    {
      firmId,
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
            eq(rfqs.firmId, caller.firmId),
          ),
        )
        .returning();
      if (!updated) throw staleApprovalError();
    },
  );

  return { ok: true as const };
}
