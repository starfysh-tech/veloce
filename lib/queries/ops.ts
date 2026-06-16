// lib/queries/ops.ts — tenant-scoped reads for the Ops / STP workspace.
// Every query joins through `rfqs.firm_id = $firmId` (Decision 11). `trades`
// itself has no firmId column (db/schema.ts:225), so the rfqs join IS the
// tenant gate — the generated-SQL test asserts the predicate is present on
// every query.
//
// Two reads:
//   getOpsTrades(firmId)    — every awarded allocation for the firm, with
//                             dealer display fields. Drives the economics table.
//   getOpsHandoffs(firmId)  — every handoff for the firm, with trade legs
//                             resolved and open exceptions attached. Drives the
//                             handoff cards.
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { firms, handoffs, handoffExceptions, rfqs, trades } from '@/db/schema';

export type OpsTradeRow = {
  tradeId: string;
  tradeRef: string;
  rfqId: string;
  rfqRef: string;
  publicRef: string;
  rfqTitle: string;
  dealerFirmId: string;
  dealerName: string;
  dealerShortCode: string | null;
  pct: number;
  allocNotionalMinor: number;
  ccy: string;
  price: string;
  priceUnit: string;
  status: 'captured' | 'sent' | 'matched' | 'affirmed';
  tradeDate: string | null;
  settle: string | null;
  uti: string | null;
};

export type OpsHandoffRow = {
  handoffId: string;
  handoffRef: string;
  rfqId: string;
  rfqRef: string;
  publicRef: string;
  rfqTitle: string;
  channel: string;
  payloadLabel: string | null;
  payload: unknown;
  status: 'sent' | 'matched' | 'affirmed';
  sentAt: Date;
  tradeIds: string[];
  legs: Array<{
    tradeId: string;
    tradeRef: string;
    dealerFirmId: string;
    dealerName: string;
    pct: number;
    price: string;
  }>;
  exceptions: Array<{
    id: string;
    severity: 'info' | 'warn';
    text: string;
    open: boolean;
    createdAt: Date;
  }>;
};

// --- Internal SQL builders (exported so .toSQL() tests can render them) -----

export function opsTradesQuery(firmId: string) {
  return db
    .select({
      tradeId: trades.id,
      tradeRef: trades.ref,
      rfqId: trades.rfqId,
      rfqRef: rfqs.ref,
      publicRef: rfqs.publicRef,
      rfqTitle: rfqs.title,
      dealerFirmId: trades.dealerFirmId,
      dealerName: firms.name,
      dealerShortCode: firms.shortCode,
      pct: trades.pct,
      allocNotionalMinor: trades.allocNotionalMinor,
      ccy: trades.ccy,
      price: trades.price,
      priceUnit: trades.priceUnit,
      status: trades.status,
      tradeDate: trades.tradeDate,
      settle: trades.settle,
      uti: trades.uti,
      createdAt: trades.createdAt,
    })
    .from(trades)
    .innerJoin(rfqs, eq(rfqs.id, trades.rfqId))
    .leftJoin(firms, eq(firms.id, trades.dealerFirmId))
    .where(eq(rfqs.firmId, firmId))
    .orderBy(desc(trades.createdAt));
}

export function opsHandoffsQuery(firmId: string) {
  return db
    .select({
      handoffId: handoffs.id,
      handoffRef: handoffs.ref,
      rfqId: handoffs.rfqId,
      rfqRef: rfqs.ref,
      publicRef: rfqs.publicRef,
      rfqTitle: rfqs.title,
      channel: handoffs.channel,
      payloadLabel: handoffs.payloadLabel,
      payload: handoffs.payload,
      status: handoffs.status,
      sentAt: handoffs.sentAt,
      tradeIds: handoffs.tradeIds,
    })
    .from(handoffs)
    .innerJoin(rfqs, eq(rfqs.id, handoffs.rfqId))
    .where(eq(rfqs.firmId, firmId))
    .orderBy(desc(handoffs.sentAt));
}

// --- Public API ------------------------------------------------------------

export async function getOpsTrades(firmId: string): Promise<OpsTradeRow[]> {
  const rows = await opsTradesQuery(firmId);
  return rows.map((r) => ({
    tradeId: r.tradeId,
    tradeRef: r.tradeRef,
    rfqId: r.rfqId,
    rfqRef: r.rfqRef,
    publicRef: r.publicRef,
    rfqTitle: r.rfqTitle,
    dealerFirmId: r.dealerFirmId,
    dealerName: r.dealerName ?? '',
    dealerShortCode: r.dealerShortCode,
    pct: r.pct,
    allocNotionalMinor: r.allocNotionalMinor,
    ccy: r.ccy,
    price: r.price,
    priceUnit: r.priceUnit,
    status: r.status,
    tradeDate: r.tradeDate,
    settle: r.settle,
    uti: r.uti,
  }));
}

export async function getOpsHandoffs(firmId: string): Promise<OpsHandoffRow[]> {
  const hRows = await opsHandoffsQuery(firmId);
  if (hRows.length === 0) return [];

  // Resolve trade legs in a single query, then group in JS. Same anti-explode
  // pattern as lib/queries/approvals.ts (separate roundtrips beat the row
  // multiplication of nested left joins).
  const allTradeIds = Array.from(new Set(hRows.flatMap((h) => (h.tradeIds as string[]) ?? [])));
  const legRows = allTradeIds.length
    ? await db
        .select({
          tradeId: trades.id,
          tradeRef: trades.ref,
          dealerFirmId: trades.dealerFirmId,
          dealerName: firms.name,
          pct: trades.pct,
          price: trades.price,
        })
        .from(trades)
        .leftJoin(firms, eq(firms.id, trades.dealerFirmId))
        .where(inArray(trades.id, allTradeIds))
    : [];
  const legsById = new Map(legRows.map((l) => [l.tradeId, l]));

  const handoffIds = hRows.map((h) => h.handoffId);
  const exRows = await db
    .select({
      id: handoffExceptions.id,
      handoffId: handoffExceptions.handoffId,
      severity: handoffExceptions.severity,
      text: handoffExceptions.text,
      open: handoffExceptions.open,
      createdAt: handoffExceptions.createdAt,
    })
    .from(handoffExceptions)
    .where(inArray(handoffExceptions.handoffId, handoffIds))
    .orderBy(desc(handoffExceptions.createdAt));
  const exByHandoff = new Map<string, OpsHandoffRow['exceptions']>();
  for (const e of exRows) {
    const list = exByHandoff.get(e.handoffId) ?? [];
    list.push({
      id: e.id,
      severity: e.severity,
      text: e.text,
      open: e.open,
      createdAt: e.createdAt,
    });
    exByHandoff.set(e.handoffId, list);
  }

  return hRows.map((h) => {
    const ids = (h.tradeIds as string[]) ?? [];
    return {
      handoffId: h.handoffId,
      handoffRef: h.handoffRef,
      rfqId: h.rfqId,
      rfqRef: h.rfqRef,
      publicRef: h.publicRef,
      rfqTitle: h.rfqTitle,
      channel: h.channel,
      payloadLabel: h.payloadLabel,
      payload: h.payload,
      status: h.status,
      sentAt: h.sentAt,
      tradeIds: ids,
      legs: ids
        .map((id) => legsById.get(id))
        .filter((l): l is NonNullable<typeof l> => Boolean(l))
        .map((l) => ({
          tradeId: l.tradeId,
          tradeRef: l.tradeRef,
          dealerFirmId: l.dealerFirmId,
          dealerName: l.dealerName ?? '',
          pct: l.pct,
          price: l.price,
        })),
      exceptions: exByHandoff.get(h.handoffId) ?? [],
    };
  });
}

/**
 * Tenant-scoped lookup: returns the rfq + its trades + the firms-by-id map
 * needed to build an STP payload. Used by `generateHandoff` so the action
 * fetches everything in one place and the builder stays pure.
 */
export async function getRfqForHandoff(rfqId: string, firmId: string) {
  const rfqRows = await db
    .select()
    .from(rfqs)
    .where(and(eq(rfqs.id, rfqId), eq(rfqs.firmId, firmId)));
  const rfq = rfqRows[0];
  if (!rfq) return null;

  const tradeRows = await db
    .select()
    .from(trades)
    .where(eq(trades.rfqId, rfqId));

  const dealerIds = Array.from(new Set(tradeRows.map((t) => t.dealerFirmId)));
  const firmRows = dealerIds.length
    ? await db.select().from(firms).where(inArray(firms.id, dealerIds))
    : [];
  const firmsById = Object.fromEntries(
    firmRows.map((f) => [f.id, { id: f.id, name: f.name, lei: f.lei, shortCode: f.shortCode }]),
  );

  return { rfq, trades: tradeRows, firmsById };
}
