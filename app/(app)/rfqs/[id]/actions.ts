// app/(app)/rfqs/[id]/actions.ts — RFQ detail mutations.
// recommendAwardAction is the first write to flow through recordEvent(): it
// computes the proposal server-side, inserts the award row, flips RFQ status,
// and appends the event — all in one transaction (Decision 7).
'use server';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/db';
import { rfqs, quotes, awards } from '@/db/schema';
import { resolveUser } from '@/lib/auth/caller';
import { recordEvent } from '@/lib/record-event';
import { bestSingle, bestBlended, savings, type QuoteLike } from '@/lib/award-math';

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

  await recordEvent(
    { kind: 'user', userId: caller.userId, label: caller.label },
    {
      firmId: rfq.firmId, rfqId,
      type: 'award_recommended',
      summary: `Recommended ${mode} award${mode === 'blended' && sav ? ` — saves ${sav.bps.toFixed(1)} bps` : ''} — routed to Treasury Committee`,
      detail: { mode, allocations, blendedPrice },
    },
    async (tx) => {
      await tx.insert(awards).values({
        rfqId, kind: mode,
        blendedPrice,
        bestSinglePrice: single ? single.price : null,
        bestSingleDealerId: single ? single.dealerFirmId : null,
        savingsBps: sav ? String(sav.bps) : null,
        savingsMinor: sav ? sav.minor : null,
        rationale: mode === 'blended'
          ? 'Stacked partial-percentage quotes beat the best full-size level while covering 100% of size.'
          : 'Best full-size level selected for single-counterparty execution.',
        allocations,
        flags: [],
        approved: false,
        recommendedBy: caller.userId,
      });
      await tx.update(rfqs).set({ status: 'awaiting_approval' }).where(eq(rfqs.id, rfqId));
    },
  );
}
