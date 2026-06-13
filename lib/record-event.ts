// lib/record-event.ts
// ---------------------------------------------------------------------------
// The single chokepoint for every state mutation (Decision 7).
//
// Rule, enforced by convention and code review: no route handler updates a
// state table directly. Every mutation goes through recordEvent(), which runs
// the caller's state change AND appends the immutable event row in ONE
// transaction. If either fails, both roll back — the log can never drift from
// state.
// ---------------------------------------------------------------------------
import { db } from '@/db';
import { events } from '@/db/schema';
import type { PgTransaction } from 'drizzle-orm/pg-core';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type Actor =
  | { kind: 'user'; userId: string; label: string }
  | { kind: 'dealer'; dealerFirmId: string; label: string }
  | { kind: 'system'; label?: string };

export type EventInput = {
  firmId: string;
  rfqId?: string | null;
  type: typeof events.$inferInsert.type;
  summary: string;
  detail?: unknown;
};

/**
 * Run a state mutation and append its event atomically.
 *
 * @param actor   who is acting (user / dealer-via-token / system)
 * @param event   the event metadata to append
 * @param apply   the state change; receives the same transaction so its writes
 *                commit or roll back together with the event row
 * @returns whatever `apply` returns
 */
export async function recordEvent<T>(
  actor: Actor,
  event: EventInput,
  apply: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const result = await apply(tx);

    await tx.insert(events).values({
      firmId: event.firmId,
      rfqId: event.rfqId ?? null,
      type: event.type,
      actorUserId: actor.kind === 'user' ? actor.userId : null,
      actorDealerFirmId: actor.kind === 'dealer' ? actor.dealerFirmId : null,
      actorLabel:
        actor.kind === 'system' ? (actor.label ?? 'System') : actor.label,
      summary: event.summary,
      detail: (event.detail ?? null) as object | null,
    });

    return result;
  });
}
