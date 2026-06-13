// lib/email.ts — transactional email via Resend (Decision 9).
// Degrades safely: if RESEND_API_KEY is absent (e.g. local dev), sends are
// logged and skipped rather than throwing, so the app stays functional.
import { Resend } from 'resend';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { rfqs } from '@/db/schema';

const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || 'Veloce <onboarding@resend.dev>';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || '';

const resend = KEY ? new Resend(KEY) : null;

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    console.log(`[email skipped — no RESEND_API_KEY] to=${to} subject="${subject}"`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (e) {
    console.error('[email send failed]', e);
  }
}

/** Dealer invitation carrying the magic-link to the scoped response page. */
export async function sendInvitation(opts: {
  to: string; rfqRef: string; rfqTitle: string; token: string; deadline: Date | null;
}) {
  const link = `${SITE}/quote/${opts.token}`;
  const deadlineStr = opts.deadline
    ? new Date(opts.deadline).toUTCString()
    : 'see RFQ';
  await send(
    opts.to,
    `Quote request: ${opts.rfqRef} — ${opts.rfqTitle}`,
    `<div style="font-family:system-ui,sans-serif;max-width:520px">
      <h2 style="margin:0 0 4px">You're invited to quote</h2>
      <p style="color:#555">${opts.rfqRef} — ${opts.rfqTitle}</p>
      <p>Auction closes: <b>${deadlineStr}</b></p>
      <p><a href="${link}" style="display:inline-block;background:#4d7dfb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Respond to this RFQ</a></p>
      <p style="color:#888;font-size:12px">This link is unique to your firm and this RFQ. Do not forward it.</p>
    </div>`,
  );
}

/** Notify the buy-side requester that an auction has closed. */
export async function notifyAuctionClosed(rfqId: string) {
  const rfq = await db.query.rfqs.findFirst({
    where: eq(rfqs.id, rfqId),
    with: { requester: true },
  });
  if (!rfq?.requester?.email) return;
  await send(
    rfq.requester.email,
    `Auction closed: ${rfq.ref}`,
    `<div style="font-family:system-ui,sans-serif;max-width:520px">
      <h2 style="margin:0 0 4px">Auction window closed</h2>
      <p style="color:#555">${rfq.ref} — ${rfq.title}</p>
      <p>The quote board is final. Review responses and construct an award.</p>
      <p><a href="${SITE}/rfqs/${rfq.id}" style="display:inline-block;background:#4d7dfb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Open RFQ</a></p>
    </div>`,
  );
}

/** Notify the requester that an award was approved. */
export async function notifyAwardApproved(rfqId: string) {
  const rfq = await db.query.rfqs.findFirst({
    where: eq(rfqs.id, rfqId),
    with: { requester: true },
  });
  if (!rfq?.requester?.email) return;
  await send(
    rfq.requester.email,
    `Award approved: ${rfq.ref}`,
    `<div style="font-family:system-ui,sans-serif;max-width:520px">
      <h2 style="margin:0 0 4px">Award approved</h2>
      <p style="color:#555">${rfq.ref} — ${rfq.title}</p>
      <p>The Treasury Committee approved the award. Trades are captured and queued for STP.</p>
      <p><a href="${SITE}/rfqs/${rfq.id}" style="display:inline-block;background:#2eb67d;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">View award</a></p>
    </div>`,
  );
}
