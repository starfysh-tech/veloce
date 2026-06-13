// lib/queries/board.ts — assembles the masked quote board for a caller.
// Fetches raw rows server-side, then runs maskBoard() before returning, so the
// masking projection is the only path board data takes to any client
// (Decision 18). Also computes the award comparison for buy-side viewers.
import { eq, asc } from 'drizzle-orm';
import { db } from '@/db';
import { rfqs, quotes, firms, rfqInvitedDealers, awards } from '@/db/schema';
import { maskBoard, type RawQuote, type RfqState } from '@/lib/auth/mask';
import { bestSingle, bestBlended, savings, type QuoteLike } from '@/lib/award-math';
import type { Caller } from '@/lib/auth/caller';

export type BoardDealer = { id: string; name: string; shortCode: string | null; colorHex: string | null };

export async function getBoard(caller: Caller, rfqId: string) {
  const rfq = await db.query.rfqs.findFirst({ where: eq(rfqs.id, rfqId) });
  if (!rfq) return null;

  // Tenant / dealer-scope guard: a user must own the firm; a dealer must be
  // scoped to this RFQ. Anyone else gets nothing.
  const allowed =
    (caller.kind === 'user' && caller.firmId === rfq.firmId) ||
    (caller.kind === 'dealer' && caller.rfqId === rfqId);
  if (!allowed) return null;

  const rawQuotes = await db
    .select()
    .from(quotes)
    .where(eq(quotes.rfqId, rfqId))
    .orderBy(asc(quotes.price));

  const invited = await db
    .select({ dealerFirmId: rfqInvitedDealers.dealerFirmId })
    .from(rfqInvitedDealers)
    .where(eq(rfqInvitedDealers.rfqId, rfqId));

  const dealerRows = await db.select().from(firms);
  const dealerMap = new Map<string, BoardDealer>(
    dealerRows.map((d) => [d.id, { id: d.id, name: d.name, shortCode: d.shortCode, colorHex: d.colorHex }]),
  );

  const rfqState: RfqState = { id: rfq.id, firmId: rfq.firmId, blind: rfq.blind, status: rfq.status };
  const masked = maskBoard(
    caller,
    rfqState,
    rawQuotes.map<RawQuote>((q) => ({
      id: q.id, dealerFirmId: q.dealerFirmId, price: q.price, pct: q.pct,
      note: q.note, submittedAt: q.submittedAt, revisedFromPrice: q.revisedFromPrice,
    })),
  );

  // Award comparison: only computed for the full-visibility buy-side viewer.
  let comparison = null;
  if (masked.fullVisibility) {
    const ql: QuoteLike[] = rawQuotes.map((q) => ({
      id: q.id, dealerFirmId: q.dealerFirmId, price: q.price, pct: q.pct,
    }));
    const single = bestSingle(ql);
    const blend = bestBlended(ql);
    const sav = savings(rfq.notionalMinor, single, blend);
    comparison = {
      single: single ? { dealerFirmId: single.dealerFirmId, price: single.price } : null,
      blend: blend
        ? { fills: blend.fills, blendedPrice: (blend.blendedTicks / 10000).toFixed(4) }
        : null,
      savings: sav,
    };
  }

  const existingAward = await db.query.awards.findFirst({ where: eq(awards.rfqId, rfqId) });

  return {
    rfq,
    board: masked,
    comparison,
    award: existingAward ?? null,
    dealers: Object.fromEntries(dealerMap),
    invitedCount: invited.length,
  };
}
