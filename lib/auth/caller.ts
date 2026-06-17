// lib/auth/caller.ts
// ---------------------------------------------------------------------------
// Caller identity (Decision 10). Every read/write resolves the caller to one
// of three shapes before any data is returned. Masking and authorization key
// off this — never off client-supplied values.
// ---------------------------------------------------------------------------
import { createHash } from 'node:crypto';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { invitations, rfqs, users } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';

export type Caller =
  | {
      kind: 'user';
      userId: string;
      firmId: string;
      role: 'trader' | 'approver' | 'ops' | 'compliance' | 'admin';
      label: string;
    }
  | {
      kind: 'dealer';
      dealerFirmId: string;
      rfqId: string;
      invitationId: string;
      label: string;
    }
  | { kind: 'anonymous' };

/** Hash a raw dealer token; only the hash is ever stored or compared. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Resolve the authenticated buy-side user from the Supabase session cookie.
 * Returns anonymous if no valid session maps to a known user row.
 */
export async function resolveUser(): Promise<Caller> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { kind: 'anonymous' };

  const row = await db.query.users.findFirst({
    where: eq(users.authId, user.id),
  });
  if (!row || !row.active) return { kind: 'anonymous' };

  return {
    kind: 'user',
    userId: row.id,
    firmId: row.firmId,
    role: row.role,
    label: row.fullName,
  };
}

/**
 * Resolve a dealer from an opaque capability token. The token authorizes
 * exactly one RFQ. Read access remains valid after first response; write paths
 * independently enforce live/deadline state before accepting quotes.
 */
export async function resolveDealerToken(rawToken: string): Promise<Caller> {
  const tokenHash = hashToken(rawToken);
  const inv = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.tokenHash, tokenHash),
      inArray(invitations.status, ['pending', 'responded']),
    ),
  });
  if (!inv) return { kind: 'anonymous' };

  const rfq = await db.query.rfqs.findFirst({ where: eq(rfqs.id, inv.rfqId) });
  if (!rfq) return { kind: 'anonymous' };

  return {
    kind: 'dealer',
    dealerFirmId: inv.dealerFirmId,
    rfqId: inv.rfqId,
    invitationId: inv.id,
    label: 'Dealer (token)',
  };
}
