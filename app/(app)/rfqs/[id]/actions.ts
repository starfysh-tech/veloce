// app/(app)/rfqs/[id]/actions.ts — RFQ detail mutations.
// recommendAwardAction is the first write to flow through recordEvent(): it
// computes the proposal server-side, inserts the award row, flips RFQ status,
// and appends the event — all in one transaction (Decision 7).
'use server';
import { randomUUID } from 'node:crypto';
import { eq, asc, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { rfqs, quotes, awards, exceptions, firms } from '@/db/schema';
import { resolveUser } from '@/lib/auth/caller';
import { recordEvent } from '@/lib/record-event';
import { bestSingle, bestBlended, savings, toTicks, allocNotionalMinor, type QuoteLike } from '@/lib/award-math';
import {
  type AwardFlag,
  bestExDeviationFlag,
  concentrationFlag,
  projectConcentration,
} from '@/lib/policy';
import { getDealerConcentration } from '@/lib/queries/concentration';
import { nextExceptionRef } from '@/lib/exception-ref';
import { uploadAttachment } from '@/lib/storage';

export async function recommendAwardAction(rfqId: string, mode: 'single' | 'blended') {
  const caller = await resolveUser();
  if (caller.kind !== 'user' || caller.role !== 'trader') {
    throw new Error('Only a trader can recommend an award.');
  }

  const rfq = await db.query.rfqs.findFirst({ where: eq(rfqs.id, rfqId) });
  if (!rfq || rfq.firmId !== caller.firmId) throw new Error('RFQ not found.');
  if (!['live', 'under_review'].includes(rfq.status)) {
    throw new Error('RFQ is not in a state where an award can be recommended.');
  }

  const raw = await db.select().from(quotes).where(eq(quotes.rfqId, rfqId)).orderBy(asc(quotes.price));
  const ql: QuoteLike[] = raw.map((q) => ({ id: q.id, dealerFirmId: q.dealerFirmId, price: q.price, pct: q.pct }));

  const single = bestSingle(ql);
  const blend = bestBlended(ql);
  const sav = savings(rfq.notionalMinor, single, blend);

  if (mode === 'blended' && !blend) throw new Error('Partial quotes cannot cover full size; blended award unavailable.');
  if (mode === 'single' && !single) throw new Error('No full-size quote available for a single-bank award.');

  const allocations = mode === 'blended'
    ? blend!.fills.map((f) => ({ dealerFirmId: f.dealerFirmId, pct: f.take, price: f.price }))
    : [{ dealerFirmId: single!.dealerFirmId, pct: 100, price: single!.price }];
  const blendedPrice = mode === 'blended'
    ? (blend!.blendedTicks / 10000).toFixed(4)
    : single!.price;

  // ---------------------------------------------------------------- flags
  // Snapshot dealer concentration outside the tx (read-only; the >35% rule is
  // re-evaluated inside the approve tx — see policy.test for stale-snapshot
  // documentation). For multi-dealer blended awards, project each allocation
  // INDEPENDENTLY against the base snapshot: the rule asks "does ANY single
  // dealer's projected share exceed 35%". Layering allocations cumulatively
  // would inflate the denominator and mask a real breach.
  const snapshot = await getDealerConcentration(rfq.firmId);

  // Map dealerFirmId → short name for human-readable deviation notes.
  const dealerIds = Array.from(new Set(allocations.map((a) => a.dealerFirmId)));
  const dealerNameRows = dealerIds.length
    ? await db.select({ id: firms.id, name: firms.name }).from(firms).where(inArray(firms.id, dealerIds))
    : [];
  const nameByDealer = new Map(dealerNameRows.map((r) => [r.id, r.name]));

  const flagsById = new Map<string, AwardFlag>();
  const deviationNotes: string[] = [];

  for (const alloc of allocations) {
    const proposedNotionalMinor = allocNotionalMinor(rfq.notionalMinor, alloc.pct);
    const projected = projectConcentration(snapshot, {
      dealerFirmId: alloc.dealerFirmId,
      proposedNotionalMinor,
    });
    const dealerShareBps = projected[alloc.dealerFirmId]?.shareBps ?? 0;
    const concFlag = concentrationFlag(dealerShareBps);
    if (concFlag && !flagsById.has(concFlag.id)) flagsById.set(concFlag.id, concFlag);

    // Rule (d): per-allocation deviation vs the best single quote price.
    if (single) {
      const allocTicks = toTicks(alloc.price);
      const bestTicks = toTicks(single.price);
      const devFlag = bestExDeviationFlag(allocTicks, bestTicks);
      if (devFlag) {
        if (!flagsById.has(devFlag.id)) flagsById.set(devFlag.id, devFlag);
        const dealerName = nameByDealer.get(alloc.dealerFirmId) ?? alloc.dealerFirmId;
        deviationNotes.push(
          `Awarded ${dealerName} at ${alloc.price}, best quote was ${single.price}.`,
        );
      }
    }
  }

  const flags = Array.from(flagsById.values());
  const hasDeviation = flags.some(
    (f) => f.severity === 'warn' && f.text.startsWith('Awarded price'),
  );

  const baseRationale = mode === 'blended'
    ? 'Stacked partial-percentage quotes beat the best full-size level while covering 100% of size.'
    : 'Best full-size level selected for single-counterparty execution.';
  const rationale = deviationNotes.length
    ? `${baseRationale}\n\nDeviation note: ${deviationNotes.join(' ')}`
    : baseRationale;

  // detail.openedExceptionRef is mutated in-place inside apply() once the
  // firm-scoped sequence resolves. recordEvent inserts the event row AFTER
  // apply() returns and reads `event.detail` by reference at insert time
  // (lib/record-event.ts:44-57), so the mutation is observed.
  const detail: {
    mode: 'single' | 'blended';
    allocations: typeof allocations;
    blendedPrice: string;
    openedExceptionRef: string | null;
  } = { mode, allocations, blendedPrice, openedExceptionRef: null };

  await recordEvent(
    { kind: 'user', userId: caller.userId, label: caller.label },
    {
      firmId: rfq.firmId, rfqId,
      type: 'award_recommended',
      summary: `Recommended ${mode} award${mode === 'blended' && sav ? ` — saves ${sav.bps.toFixed(1)} bps` : ''} — routed to Treasury Committee`,
      detail,
    },
    async (tx) => {
      // If rule (d) fired, reserve the exception ref now so we can both insert
      // the row AND surface the ref in the event detail (mutation propagates
      // because recordEvent reads `event.detail` after apply returns).
      if (hasDeviation) {
        detail.openedExceptionRef = await nextExceptionRef(tx, rfq.firmId, new Date().getFullYear());
      }

      await tx.insert(awards).values({
        rfqId, kind: mode,
        blendedPrice,
        bestSinglePrice: single ? single.price : null,
        bestSingleDealerId: single ? single.dealerFirmId : null,
        savingsBps: sav ? String(sav.bps) : null,
        savingsMinor: sav ? sav.minor : null,
        rationale,
        allocations,
        flags,
        approved: false,
        recommendedBy: caller.userId,
      });
      await tx.update(rfqs).set({ status: 'awaiting_approval' }).where(eq(rfqs.id, rfqId));

      if (hasDeviation && detail.openedExceptionRef) {
        // Build a single exception row summarizing the best-ex deviation. One
        // row per recommend (not one per deviating allocation) — the approve
        // path closes "all open exceptions for the rfq" without a kind
        // discriminator, so multiplying rows here would create ambiguity.
        const detailText = deviationNotes.join(' ');
        await tx.insert(exceptions).values({
          id: randomUUID(),
          ref: detail.openedExceptionRef,
          firmId: rfq.firmId,
          rfqId,
          severity: 'warn',
          text: `Best-execution deviation: ${detailText}`,
          status: 'open',
          open: true,
        });
      }
    },
  );
}

export async function uploadRfqAttachmentAction(rfqId: string, formData: FormData) {
  const caller = await resolveUser();
  if (caller.kind !== 'user' || (caller.role !== 'trader' && caller.role !== 'admin')) {
    throw new Error('Only a trader or admin can upload attachments.');
  }

  const files = formData
    .getAll('attachments')
    .filter((value): value is File => value instanceof File && value.size > 0);
  if (!files.length) throw new Error('Choose at least one attachment.');

  await Promise.all(files.map((file) => uploadAttachment(caller, rfqId, file)));
}
