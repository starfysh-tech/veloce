// lib/queries/dashboard-shape.ts — pure dashboard projections.
// Kept dependency-free so unit tests do not import DB-backed query modules.
import { CONCENTRATION_FLAG_THRESHOLD_BPS } from '@/lib/policy';

type ResponseRow = { status: string; quoteCount: number; invitedCount: number };

export function responseRatePct(rfqs: ResponseRow[]): number | null {
  const live = rfqs.filter((r) => r.status === 'live');
  const invited = live.reduce((sum, r) => sum + r.invitedCount, 0);
  if (invited === 0) return null;
  const quotes = live.reduce((sum, r) => sum + r.quoteCount, 0);
  return Math.round((quotes / invited) * 100);
}

export function highestConcentrationBps(concentration: Record<string, { shareBps: number }>): number | null {
  const shares = Object.values(concentration).map((c) => c.shareBps);
  return shares.length ? Math.max(...shares) : null;
}

export function concentrationBreachCount(
  rows: Array<{ shareBps: number }>,
  thresholdBps = CONCENTRATION_FLAG_THRESHOLD_BPS,
): number {
  return rows.filter((c) => c.shareBps > thresholdBps).length;
}
