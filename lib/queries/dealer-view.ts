// lib/queries/dealer-view.ts
// ---------------------------------------------------------------------------
// Token-scoped read for the dealer response page. Strict isolation:
//  - instrument economics come from the rfqs row (unmasked — the dealer needs
//    full terms to price), but ONLY the presentational fields are selected,
//    never firmId/requesterId internals.
//  - the dealer's OWN quote (if any) is fetched by (rfqId, theirFirmId).
//  - NOTHING here touches rfq_invited_dealers, other invitations, or other
//    quotes — so the invited-dealer list and competitor data cannot leak.
// The caller is always a resolved dealer token (Decision 10).
// ---------------------------------------------------------------------------
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { rfqs, quotes, firms } from '@/db/schema';
import { effectiveStatus } from '@/lib/auction-status';
import type { Caller } from '@/lib/auth/caller';

export async function getDealerView(caller: Caller, rfqId: string) {
  if (caller.kind !== 'dealer' || caller.rfqId !== rfqId) return null;

  // Select only presentational instrument fields — no firmId, no requesterId.
  const rfqRow = await db
    .select({
      id: rfqs.id, ref: rfqs.ref, publicRef: rfqs.publicRef, title: rfqs.title, product: rfqs.product,
      side: rfqs.side, underlying: rfqs.underlying, refLevel: rfqs.refLevel,
      strike: rfqs.strike, expiry: rfqs.expiry, style: rfqs.style, tenor: rfqs.tenor,
      notionalMinor: rfqs.notionalMinor, ccy: rfqs.ccy, notionalLabel: rfqs.notionalLabel,
      quoteUnit: rfqs.quoteUnit, mode: rfqs.mode, blind: rfqs.blind,
      status: rfqs.status, deadline: rfqs.deadline,
    })
    .from(rfqs)
    .where(eq(rfqs.id, rfqId))
    .limit(1);

  const rfq = rfqRow[0];
  if (!rfq) return null;

  // The dealer's own quote only — scoped to their firm.
  const ownRows = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.rfqId, rfqId), eq(quotes.dealerFirmId, caller.dealerFirmId)))
    .limit(1);
  const own = ownRows[0] ?? null;

  // The dealer's own firm identity (name/short) for display — their row only.
  const firmRows = await db
    .select({ id: firms.id, name: firms.name, shortCode: firms.shortCode })
    .from(firms)
    .where(eq(firms.id, caller.dealerFirmId))
    .limit(1);

  const status = effectiveStatus(rfq);
  const isOpen = status === 'live' && rfq.deadline != null && new Date(rfq.deadline).getTime() > Date.now();

  return {
    rfq: { ...rfq, status },
    own,
    dealerFirm: firmRows[0] ?? null,
    isOpen,
  };
}
