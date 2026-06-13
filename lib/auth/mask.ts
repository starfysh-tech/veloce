// lib/auth/mask.ts
// ---------------------------------------------------------------------------
// Blind-auction masking projection (Decision 10). This is a PURE function so
// it can be exhaustively tested (Decision 13). It decides, for a given caller
// and auction state, which quotes are visible and how much of each.
//
// The rule:
//  - Buy-side users of the owning firm see everything (they run the auction).
//  - A dealer (via token) on a BLIND auction sees ONLY their own quote, plus
//    their rank among N — never a competitor's identity or level — until the
//    RFQ is awarded, after which their own allocation is revealed but
//    competitors stay masked.
//  - A dealer on a NON-blind auction sees levels but still not until close.
//  - Anonymous sees nothing.
//
// This function never touches the DB. Callers fetch raw rows, then pass them
// through here before anything leaves the server.
// ---------------------------------------------------------------------------
import type { Caller } from './caller';

export type RawQuote = {
  id: string;
  dealerFirmId: string;
  price: string;
  pct: number;
  note: string | null;
  submittedAt: Date | string;
  revisedFromPrice: string | null;
};

export type RfqState = {
  id: string;
  firmId: string;
  blind: boolean;
  status: string; // rfq_status
};

export type MaskedQuote = {
  id: string;
  dealerFirmId: string | null; // null when masked
  price: string | null;        // null when masked
  pct: number | null;
  note: string | null;
  submittedAt: Date | string;
  revisedFromPrice: string | null;
  isOwn: boolean;
  masked: boolean;
};

export type MaskedBoard = {
  quotes: MaskedQuote[];
  /** dealer-only: this dealer's rank by level among responders, 1-based */
  ownRank?: number;
  /** total responders, for "rank N of M" */
  responderCount: number;
  /** whether the caller may see the full board (buy-side owner) */
  fullVisibility: boolean;
};

const AWARDED_STATES = new Set(['awarded', 'in_stp', 'affirmed']);

export function maskBoard(
  caller: Caller,
  rfq: RfqState,
  quotes: RawQuote[],
): MaskedBoard {
  const responderCount = quotes.length;

  // Buy-side owner: full visibility. Admins of the owning firm too.
  if (
    caller.kind === 'user' &&
    caller.firmId === rfq.firmId
  ) {
    return {
      quotes: quotes.map((q) => ({ ...q, dealerFirmId: q.dealerFirmId, isOwn: false, masked: false })),
      responderCount,
      fullVisibility: true,
    };
  }

  // Dealer via token, scoped to this RFQ only.
  if (caller.kind === 'dealer' && caller.rfqId === rfq.id) {
    const own = quotes.find((q) => q.dealerFirmId === caller.dealerFirmId) ?? null;
    const awarded = AWARDED_STATES.has(rfq.status);

    // Rank by level among all responders (cheaper = better rank).
    let ownRank: number | undefined;
    if (own) {
      const sorted = [...quotes].sort(
        (a, b) => parseFloat(a.price) - parseFloat(b.price),
      );
      ownRank = sorted.findIndex((q) => q.dealerFirmId === caller.dealerFirmId) + 1;
    }

    const masked: MaskedQuote[] = [];
    if (own) {
      masked.push({
        ...own,
        isOwn: true,
        masked: false,
      });
    }
    // Competitors: in a blind auction they are NEVER itemized to a dealer,
    // awarded or not. We expose only the count via responderCount above.
    if (!rfq.blind) {
      // Non-blind: competitor levels visible once the window has closed.
      const windowClosed = rfq.status !== 'live' && rfq.status !== 'draft';
      for (const q of quotes) {
        if (q.dealerFirmId === caller.dealerFirmId) continue;
        masked.push({
          ...q,
          dealerFirmId: windowClosed ? q.dealerFirmId : null,
          price: windowClosed ? q.price : null,
          pct: windowClosed ? q.pct : null,
          note: windowClosed ? q.note : null,
          isOwn: false,
          masked: !windowClosed,
        });
      }
    }

    return { quotes: masked, ownRank, responderCount, fullVisibility: false };
  }

  // Anyone else: nothing.
  return { quotes: [], responderCount: 0, fullVisibility: false };
}
