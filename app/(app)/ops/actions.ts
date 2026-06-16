// app/(app)/ops/actions.ts — Block C STP/Ops mutations.
//
// Every action routes through recordEvent() (Decision 7). The conditional
// UPDATE + stale-state pattern mirrors approveAward (app/(app)/approvals/
// actions.ts:88): a wrong-state caller never wins the race and every
// transition fails loudly rather than silently no-op'ing — surfaced as the
// docs/blocks/block-c-ops-stp.md /vr critical findings C2, C3.
//
// Compliance `exceptions` (the separate db/schema.ts:273 table) do NOT block
// the in_stp -> affirmed flip. They are bulk-closed at award time by
// approveAward (app/(app)/approvals/actions.ts:189) so by in_stp the compliance
// side is already clean. Block D may add a reopen flow; this gate would then
// need to consult that table as well.
'use server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  handoffs,
  handoffExceptions,
  rfqs,
  trades,
  type handoffStatus,
  type tradeStatus,
} from '@/db/schema';
import { db } from '@/db';
import { resolveUser } from '@/lib/auth/caller';
import { recordEvent } from '@/lib/record-event';
import { getRfqForHandoff } from '@/lib/queries/ops';
import {
  buildStpPayload,
  payloadLabel,
  STP_CHANNEL,
  type StpFirmInput,
  type StpTradeInput,
} from '@/lib/stp';
import { generateHandoffRef } from '@/lib/handoff-ref';

type TradeStatus = (typeof tradeStatus.enumValues)[number];
type HandoffStatus = (typeof handoffStatus.enumValues)[number];

const staleError = () =>
  new Error('Handoff state drifted — refresh and try again.');

function requireOps() {
  // Resolution is async; this is a tiny wrapper to keep call sites readable.
  return resolveUser().then((c) => {
    if (c.kind !== 'user' || c.role !== 'ops') {
      throw new Error('Only an ops user can perform this action.');
    }
    return c;
  });
}

// ------------------------------------------------------------- generateHandoff

export async function generateHandoff(input: { rfqId: string }) {
  const caller = await requireOps();
  const { rfqId } = input;

  // Tenant gate + pre-tx data load in one shot. getRfqForHandoff filters on
  // (id, firmId) so a wrong-tenant caller gets null; firmId for the
  // EventInput comes off the returned rfq. The action stays out of the tx
  // for the pure payload build so the tx body is only conditional writes.
  const pkg = await getRfqForHandoff(rfqId, caller.firmId);
  if (!pkg) throw new Error('RFQ not found.');
  const { rfq, trades: tradeRows, firmsById } = pkg;
  const firmId = rfq.firmId;
  if (!tradeRows.length) {
    throw new Error('No trades to hand off — approve the award first.');
  }
  if (tradeRows.some((t) => t.status !== 'captured')) {
    throw new Error('Handoff already generated for this RFQ.');
  }

  const payload = buildStpPayload({
    rfq: {
      publicRef: rfq.publicRef,
      product: rfq.product,
      underlying: rfq.underlying ?? '',
      expiry: rfq.expiry ?? '',
      strike: rfq.strike ?? '',
      notionalMinor: rfq.notionalMinor,
      ccy: rfq.ccy,
      quoteUnit: rfq.quoteUnit,
    },
    trades: tradeRows.map((t) => ({
      ref: t.ref,
      dealerFirmId: t.dealerFirmId,
      pct: t.pct,
      allocNotionalMinor: t.allocNotionalMinor,
      price: t.price,
      uti: t.uti,
    })),
    firms: firmsById as Record<string, StpFirmInput>,
    generatedAt: new Date(),
  });

  const tradeIds = tradeRows.map((t) => t.id);
  const handoffRef = generateHandoffRef();

  const detail = {
    handoffRef,
    tradeRefs: tradeRows.map((t) => t.ref),
    legCount: tradeRows.length,
  };

  const result = await recordEvent(
    { kind: 'user', userId: caller.userId, label: caller.label },
    { firmId, rfqId, type: 'handoff_sent', summary: 'STP handoff generated', detail },
    async (tx) => {
      // 1. rfqs: awarded -> in_stp (tenant + state guard).
      const [updatedRfq] = await tx
        .update(rfqs)
        .set({ status: 'in_stp' })
        .where(and(eq(rfqs.id, rfqId), eq(rfqs.status, 'awarded'), eq(rfqs.firmId, caller.firmId)))
        .returning();
      if (!updatedRfq) throw staleError();

      // 2. trades: captured -> sent for THIS rfq. Driven by rfqId+status,
      // not by jsonb tradeIds — `trades` has no firmId column (tenant gate
      // is the rfq update above). Count must match exactly; partial means a
      // concurrent writer moved one row out from under us.
      const updatedTrades = await tx
        .update(trades)
        .set({ status: 'sent' satisfies TradeStatus })
        .where(and(eq(trades.rfqId, rfqId), eq(trades.status, 'captured' satisfies TradeStatus)))
        .returning({ id: trades.id });
      if (updatedTrades.length !== tradeIds.length) throw staleError();

      // 3. handoffs: insert the sent row carrying the payload.
      const [inserted] = await tx
        .insert(handoffs)
        .values({
          ref: handoffRef,
          rfqId,
          tradeIds: updatedTrades.map((t) => t.id),
          channel: STP_CHANNEL,
          payloadLabel: payloadLabel(
            tradeRows.map((t): StpTradeInput => ({
              ref: t.ref,
              dealerFirmId: t.dealerFirmId,
              pct: t.pct,
              allocNotionalMinor: t.allocNotionalMinor,
              price: t.price,
              uti: t.uti,
            })),
          ),
          payload,
          status: 'sent',
        })
        .returning({ id: handoffs.id, ref: handoffs.ref });

      return { handoffId: inserted.id, handoffRef: inserted.ref };
    },
  );

  return { ok: true as const, ...result };
}

// ------------------------------------------------------------- advanceHandoff

export async function advanceHandoff(input: { handoffId: string; to: 'matched' | 'affirmed' }) {
  const caller = await requireOps();
  const { handoffId, to } = input;

  // Tenant gate: load handoff + its rfq.firmId in one shot. If the handoff
  // doesn't belong to the caller's firm, this returns nothing and we throw —
  // same surface as a 404 (don't leak existence cross-tenant).
  const lookup = await db
    .select({
      handoffId: handoffs.id,
      rfqId: handoffs.rfqId,
      firmId: rfqs.firmId,
      status: handoffs.status,
      tradeIds: handoffs.tradeIds,
    })
    .from(handoffs)
    .innerJoin(rfqs, eq(rfqs.id, handoffs.rfqId))
    .where(and(eq(handoffs.id, handoffId), eq(rfqs.firmId, caller.firmId)))
    .limit(1);
  const h = lookup[0];
  if (!h) throw new Error('Handoff not found.');

  const from: HandoffStatus = to === 'matched' ? 'sent' : 'matched';
  if (h.status !== from) {
    throw new Error(`Cannot advance handoff from ${h.status} to ${to}.`);
  }
  const tradeIds = (h.tradeIds as string[]) ?? [];

  const detail: {
    handoffId: string;
    from: HandoffStatus;
    to: HandoffStatus;
    rfqAffirmed: boolean;
  } = { handoffId, from, to, rfqAffirmed: false };

  await recordEvent(
    { kind: 'user', userId: caller.userId, label: caller.label },
    {
      firmId: h.firmId,
      rfqId: h.rfqId,
      type: 'handoff_advanced',
      summary: `Handoff ${from} → ${to}`,
      detail,
    },
    async (tx) => {
      // 1. handoffs: from -> to (state guard).
      const [updatedHandoff] = await tx
        .update(handoffs)
        .set({ status: to })
        .where(and(eq(handoffs.id, handoffId), eq(handoffs.status, from)))
        .returning();
      if (!updatedHandoff) throw staleError();

      // 2. trades: matching transition for every leg of this rfq. Treat
      // tradeIds[] as snapshot; drive the update by rfqId+status so a future
      // refactor that removes a trade row doesn't silently desync.
      const updatedTrades = await tx
        .update(trades)
        .set({ status: to satisfies TradeStatus })
        .where(and(eq(trades.rfqId, h.rfqId), eq(trades.status, from satisfies TradeStatus)))
        .returning({ id: trades.id });
      if (updatedTrades.length !== tradeIds.length) throw staleError();

      // 3. When affirming the last handoff for the rfq with NO open
      // handoff_exceptions, flip the rfq to 'affirmed'. The query checks
      // BOTH conditions inline so we don't race a concurrently-opened
      // exception. Compliance exceptions intentionally do not gate here —
      // see file header.
      if (to === 'affirmed') {
        const openEx = await tx
          .select({ id: handoffExceptions.id })
          .from(handoffExceptions)
          .innerJoin(handoffs, eq(handoffs.id, handoffExceptions.handoffId))
          .where(and(eq(handoffs.rfqId, h.rfqId), eq(handoffExceptions.open, true)))
          .limit(1);
        const stillSentOrMatched = await tx
          .select({ id: handoffs.id })
          .from(handoffs)
          .where(and(eq(handoffs.rfqId, h.rfqId), inArray(handoffs.status, ['sent', 'matched'])))
          .limit(1);
        if (openEx.length === 0 && stillSentOrMatched.length === 0) {
          const [flipped] = await tx
            .update(rfqs)
            .set({ status: 'affirmed' })
            .where(and(eq(rfqs.id, h.rfqId), eq(rfqs.status, 'in_stp'), eq(rfqs.firmId, caller.firmId)))
            .returning({ id: rfqs.id });
          // If the rfq drifted (e.g. cancelled), throw inside the tx so the
          // trade-affirm rolls back rather than silently committing against
          // an inconsistent rfq.
          if (!flipped) throw staleError();
          detail.rfqAffirmed = true;
        }
      }
    },
  );

  return { ok: true as const, rfqAffirmed: detail.rfqAffirmed };
}

// ------------------------------------------------------------- openException

export async function openException(input: {
  handoffId: string;
  text: string;
  severity?: 'info' | 'warn';
}) {
  const caller = await requireOps();
  const text = input.text?.trim() ?? '';
  if (text.length === 0) throw new Error('Exception text is required.');

  const lookup = await db
    .select({ rfqId: handoffs.rfqId, firmId: rfqs.firmId })
    .from(handoffs)
    .innerJoin(rfqs, eq(rfqs.id, handoffs.rfqId))
    .where(and(eq(handoffs.id, input.handoffId), eq(rfqs.firmId, caller.firmId)))
    .limit(1);
  if (!lookup[0]) throw new Error('Handoff not found.');

  const result = await recordEvent(
    { kind: 'user', userId: caller.userId, label: caller.label },
    {
      firmId: lookup[0].firmId,
      rfqId: lookup[0].rfqId,
      type: 'exception_opened',
      summary: 'Handoff exception opened',
      detail: { handoffId: input.handoffId, severity: input.severity ?? 'warn', text },
    },
    async (tx) => {
      const [inserted] = await tx
        .insert(handoffExceptions)
        .values({
          handoffId: input.handoffId,
          severity: input.severity ?? 'warn',
          text,
          open: true,
        })
        .returning({ id: handoffExceptions.id });
      return { exceptionId: inserted.id };
    },
  );

  return { ok: true as const, ...result };
}

// ------------------------------------------------------------- closeException

export async function closeException(input: { exceptionId: string }) {
  const caller = await requireOps();

  // Tenant gate: handoff_exceptions has no firmId; reach it via the
  // handoff -> rfq chain. Same lookup is reused as the precondition for
  // the conditional UPDATE below.
  const lookup = await db
    .select({
      exceptionId: handoffExceptions.id,
      handoffId: handoffExceptions.handoffId,
      rfqId: handoffs.rfqId,
      firmId: rfqs.firmId,
      open: handoffExceptions.open,
    })
    .from(handoffExceptions)
    .innerJoin(handoffs, eq(handoffs.id, handoffExceptions.handoffId))
    .innerJoin(rfqs, eq(rfqs.id, handoffs.rfqId))
    .where(and(eq(handoffExceptions.id, input.exceptionId), eq(rfqs.firmId, caller.firmId)))
    .limit(1);
  if (!lookup[0]) throw new Error('Exception not found.');
  if (!lookup[0].open) throw new Error('Exception already closed.');

  await recordEvent(
    { kind: 'user', userId: caller.userId, label: caller.label },
    {
      firmId: lookup[0].firmId,
      rfqId: lookup[0].rfqId,
      type: 'exception_closed',
      summary: 'Handoff exception resolved',
      detail: { exceptionId: input.exceptionId, handoffId: lookup[0].handoffId },
    },
    async (tx) => {
      // Conditional update: only close if still open. Closes the race
      // with a parallel close from another tab.
      const [updated] = await tx
        .update(handoffExceptions)
        .set({ open: false })
        .where(
          and(
            eq(handoffExceptions.id, input.exceptionId),
            eq(handoffExceptions.open, true),
            // Defense-in-depth tenant gate (the pre-tx lookup already
            // proved ownership; this matches if-and-only-if that lookup is
            // still true under serializable isolation).
            inArray(
              handoffExceptions.handoffId,
              sql`(select h.id from handoffs h join rfqs r on r.id = h.rfq_id where r.firm_id = ${caller.firmId})`,
            ),
          ),
        )
        .returning({ id: handoffExceptions.id });
      if (!updated) throw staleError();
    },
  );

  return { ok: true as const };
}
