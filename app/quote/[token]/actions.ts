// app/quote/[token]/actions.ts — dealer quote submission.
// Authenticated by token, not session. Self-validates the deadline server-side
// (Decision 6): a write after the deadline is rejected regardless of what the
// client shows. Submit and revise both flow through recordEvent() (Decision 7).
'use server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { rfqs, quotes, invitations } from '@/db/schema';
import { resolveDealerToken } from '@/lib/auth/caller';
import { recordEvent } from '@/lib/record-event';

export type SubmitResult = { ok: true } | { ok: false; error: string };

export async function submitQuoteAction(
  token: string,
  input: { price: number; pct: number; note: string },
): Promise<SubmitResult> {
  const caller = await resolveDealerToken(token);
  if (caller.kind !== 'dealer') return { ok: false, error: 'Invalid or expired link.' };

  const rfq = await db.query.rfqs.findFirst({ where: eq(rfqs.id, caller.rfqId) });
  if (!rfq) return { ok: false, error: 'RFQ not found.' };

  // Deadline self-validation — the authoritative gate (Decision 6).
  const open = rfq.status === 'live' && rfq.deadline != null && new Date(rfq.deadline).getTime() > Date.now();
  if (!open) return { ok: false, error: 'The auction window is closed.' };

  // Validate inputs.
  if (!(input.price > 0)) return { ok: false, error: 'Enter a valid level.' };
  if (![100, 75, 60, 50, 40, 25].includes(input.pct)) return { ok: false, error: 'Invalid participation size.' };
  if (rfq.mode === 'full' && input.pct !== 100) return { ok: false, error: 'This RFQ accepts full-size quotes only.' };

  const price = input.price.toFixed(4);

  const existing = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.rfqId, caller.rfqId), eq(quotes.dealerFirmId, caller.dealerFirmId)))
    .limit(1);

  const isRevision = existing.length > 0;

  await recordEvent(
    { kind: 'dealer', dealerFirmId: caller.dealerFirmId, label: 'Dealer' },
    {
      firmId: rfq.firmId, rfqId: rfq.id,
      type: isRevision ? 'quote_revised' : 'quote_submitted',
      summary: `Quote ${isRevision ? 'revised' : 'received'} — ${input.pct}% @ ${price}`,
      detail: { pct: input.pct, price },
    },
    async (tx) => {
      if (isRevision) {
        await tx.update(quotes)
          .set({ revisedFromPrice: existing[0].price, price, pct: input.pct, note: input.note, submittedAt: new Date() })
          .where(eq(quotes.id, existing[0].id));
      } else {
        await tx.insert(quotes).values({
          rfqId: rfq.id, dealerFirmId: caller.dealerFirmId,
          invitationId: caller.invitationId, price, pct: input.pct, note: input.note,
        });
      }
      // Mark the invitation as responded (first submission only).
      if (!isRevision) {
        await tx.update(invitations)
          .set({ status: 'responded', respondedAt: new Date() })
          .where(eq(invitations.id, caller.invitationId));
      }
    },
  );

  return { ok: true };
}
