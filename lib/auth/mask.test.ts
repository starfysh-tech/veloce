// lib/auth/mask.test.ts
// The security canary (Decision 13). If a dealer ever receives a competitor's
// identity or level on a blind auction, one of these fails. Treat a failure
// here as a stop-ship.
import { describe, it, expect } from 'vitest';
import { maskBoard, type RawQuote, type RfqState } from './mask';
import type { Caller } from './caller';

const QUOTES: RawQuote[] = [
  { id: 'q-atl', dealerFirmId: 'atlas', price: '2.8400', pct: 100, note: 'a', submittedAt: '2026-06-12T14:02:00Z', revisedFromPrice: null },
  { id: 'q-kst', dealerFirmId: 'kestrel', price: '2.7900', pct: 100, note: 'k', submittedAt: '2026-06-12T14:05:00Z', revisedFromPrice: null },
  { id: 'q-mrl', dealerFirmId: 'marlowe', price: '2.6200', pct: 40, note: 'm', submittedAt: '2026-06-12T14:08:00Z', revisedFromPrice: null },
];

const blindLive: RfqState = { id: 'rfq1', firmId: 'meridian', blind: true, status: 'live' };
const blindAwarded: RfqState = { id: 'rfq1', firmId: 'meridian', blind: true, status: 'awarded' };

const owner: Caller = { kind: 'user', userId: 'u1', firmId: 'meridian', role: 'trader', label: 'Dana' };
const otherFirmUser: Caller = { kind: 'user', userId: 'u2', firmId: 'halcyon', role: 'trader', label: 'J.C.' };
const kestrelDealer: Caller = { kind: 'dealer', dealerFirmId: 'kestrel', rfqId: 'rfq1', invitationId: 'i1', label: 'Dealer' };

describe('buy-side owner', () => {
  it('sees every quote with full detail', () => {
    const board = maskBoard(owner, blindLive, QUOTES);
    expect(board.fullVisibility).toBe(true);
    expect(board.quotes).toHaveLength(3);
    expect(board.quotes.every((q) => !q.masked && q.price !== null)).toBe(true);
  });
});

describe('dealer on a blind auction', () => {
  it('sees ONLY its own quote, never competitors', () => {
    const board = maskBoard(kestrelDealer, blindLive, QUOTES);
    expect(board.quotes).toHaveLength(1);
    expect(board.quotes[0].dealerFirmId).toBe('kestrel');
    expect(board.quotes[0].isOwn).toBe(true);
  });

  it('never leaks a competitor identity or price', () => {
    const board = maskBoard(kestrelDealer, blindLive, QUOTES);
    const leaked = board.quotes.some(
      (q) => q.dealerFirmId === 'atlas' || q.dealerFirmId === 'marlowe' || q.price === '2.8400' || q.price === '2.6200',
    );
    expect(leaked).toBe(false);
  });

  it('still hides competitors AFTER award on a blind auction', () => {
    const board = maskBoard(kestrelDealer, blindAwarded, QUOTES);
    const competitorVisible = board.quotes.some((q) => q.dealerFirmId === 'atlas' || q.dealerFirmId === 'marlowe');
    expect(competitorVisible).toBe(false);
  });

  it('reports rank without revealing who is ahead', () => {
    const board = maskBoard(kestrelDealer, blindLive, QUOTES);
    // kestrel 2.79 is 2nd cheapest behind marlowe 2.62.
    expect(board.ownRank).toBe(2);
    expect(board.responderCount).toBe(3);
  });
});

describe('cross-tenant and anonymous', () => {
  it('a user from another firm sees nothing', () => {
    const board = maskBoard(otherFirmUser, blindLive, QUOTES);
    expect(board.quotes).toHaveLength(0);
    expect(board.fullVisibility).toBe(false);
  });

  it('anonymous sees nothing', () => {
    const board = maskBoard({ kind: 'anonymous' }, blindLive, QUOTES);
    expect(board.quotes).toHaveLength(0);
  });

  it('a dealer scoped to a different RFQ sees nothing here', () => {
    const wrongRfq: Caller = { ...kestrelDealer, rfqId: 'rfq-other' } as Caller;
    const board = maskBoard(wrongRfq, blindLive, QUOTES);
    expect(board.quotes).toHaveLength(0);
  });
});
