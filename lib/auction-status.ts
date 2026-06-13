// lib/auction-status.ts
// ---------------------------------------------------------------------------
// Lazy auction sweep (Decision 19). No cron: a live RFQ past its deadline is
// "effectively closed" the instant the clock passes, derived from the stored
// timestamp at read time. The displayed status is corrected opportunistically
// — when a buy-side reader loads the RFQ, we flip live → under_review through
// recordEvent() and fire the auction-closed notification once.
//
// Correctness never depends on the flip: the write path validates now <
// deadline independently (Decision 6), so late quotes are rejected whether or
// not the flip has happened yet.
// ---------------------------------------------------------------------------
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { rfqs } from '@/db/schema';
import { recordEvent } from '@/lib/record-event';
import { notifyAuctionClosed } from '@/lib/email';

/** True when a live RFQ has passed its deadline. */
export function isExpired(rfq: { status: string; deadline: Date | string | null }): boolean {
  if (rfq.status !== 'live' || !rfq.deadline) return false;
  return new Date(rfq.deadline).getTime() <= Date.now();
}

/** The status to display: a live-but-expired RFQ reads as under_review. */
export function effectiveStatus(rfq: { status: string; deadline: Date | string | null }): string {
  return isExpired(rfq) ? 'under_review' : rfq.status;
}

/**
 * Opportunistic flip. Call after reading an RFQ that may have expired. Flips
 * the row live → under_review exactly once (guarded by a conditional update so
 * concurrent readers don't double-fire) and sends the auction-closed email.
 * Safe to call on every read; it no-ops unless a flip is actually due.
 */
export async function sweepIfExpired(rfq: {
  id: string; firmId: string; ref: string; status: string; deadline: Date | string | null;
}): Promise<boolean> {
  if (!isExpired(rfq)) return false;

  const flipped = await recordEvent(
    { kind: 'system', label: 'System' },
    {
      firmId: rfq.firmId, rfqId: rfq.id,
      type: 'auction_closed',
      summary: 'Auction window closed',
      detail: { ref: rfq.ref },
    },
    async (tx) => {
      // Conditional flip: only the first caller to find it still 'live' wins.
      const res = await tx
        .update(rfqs)
        .set({ status: 'under_review' })
        .where(and(eq(rfqs.id, rfq.id), eq(rfqs.status, 'live')))
        .returning({ id: rfqs.id });
      return res.length > 0;
    },
  );

  // Fire-and-forget notification only if this caller performed the flip.
  if (flipped) {
    void notifyAuctionClosed(rfq.id).catch(() => {});
  }
  return flipped;
}
