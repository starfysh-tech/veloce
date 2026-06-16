// lib/queries/compliance.ts — tenant-scoped reads for the Compliance workspace.
// Child tables such as quotes/awards do not carry firmId, so export/bundle
// reads join through rfqs and filter on rfqs.firmId instead of trusting rfqId.
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { awards, events, exceptions, firms, quotes, rfqs } from '@/db/schema';
import { getDealerConcentration } from '@/lib/queries/concentration';
import type { AwardFlag } from '@/lib/policy';

const REVIEWABLE_STATUSES: Array<typeof rfqs.$inferSelect.status> = [
  'awaiting_approval',
  'awarded',
  'in_stp',
  'affirmed',
];

type Allocation = { dealerFirmId: string; pct: number; price: string };

const complianceEventSelect = {
  id: events.id,
  rfqId: events.rfqId,
  rfqRef: rfqs.ref,
  publicRef: rfqs.publicRef,
  rfqTitle: rfqs.title,
  type: events.type,
  actorLabel: events.actorLabel,
  summary: events.summary,
  detail: events.detail,
  createdAt: events.createdAt,
};

const complianceExceptionSelect = {
  id: exceptions.id,
  ref: exceptions.ref,
  rfqId: exceptions.rfqId,
  rfqRef: rfqs.ref,
  publicRef: rfqs.publicRef,
  rfqTitle: rfqs.title,
  severity: exceptions.severity,
  text: exceptions.text,
  status: exceptions.status,
  open: exceptions.open,
  openedAt: exceptions.openedAt,
};

export type ComplianceBestExRow = {
  rfqId: string;
  rfqRef: string;
  publicRef: string;
  title: string;
  product: string;
  notionalMinor: number;
  notionalLabel: string | null;
  ccy: string;
  quoteUnit: string;
  status: string;
  quoteCount: number;
  exceptionCount: number;
  award: null | {
    id: string;
    kind: 'single' | 'blended';
    blendedPrice: string;
    bestSinglePrice: string | null;
    savingsBps: string | null;
    savingsMinor: number | null;
    rationale: string | null;
    allocations: Allocation[];
    flags: AwardFlag[];
    approved: boolean;
    createdAt: Date;
    approvedAt: Date | null;
  };
};

export type ComplianceEventRow = {
  id: string;
  rfqId: string | null;
  rfqRef: string | null;
  publicRef: string | null;
  rfqTitle: string | null;
  type: string;
  actorLabel: string;
  summary: string;
  detail: unknown;
  createdAt: Date;
};

export type ComplianceExceptionRow = {
  id: string;
  ref: string;
  rfqId: string | null;
  rfqRef: string | null;
  publicRef: string | null;
  rfqTitle: string | null;
  severity: 'info' | 'warn';
  text: string;
  status: string;
  open: boolean;
  openedAt: Date;
};

export type ComplianceConcentrationRow = {
  dealerFirmId: string;
  dealerName: string;
  shareBps: number;
  notionalMinor: number;
};

export type ComplianceOverview = {
  bestEx: ComplianceBestExRow[];
  events: ComplianceEventRow[];
  exceptions: ComplianceExceptionRow[];
  concentration: ComplianceConcentrationRow[];
};

export type ComplianceQuoteLadderRow = {
  dealerFirmId: string;
  dealerName: string;
  price: string;
  pct: number;
  note: string | null;
  submittedAt: Date;
  revisedFromPrice: string | null;
};

export type ComplianceBestExBundle = {
  generatedAt: string;
  rfq: {
    id: string;
    ref: string;
    publicRef: string;
    title: string;
    product: string;
    notionalMinor: number;
    notionalLabel: string | null;
    ccy: string;
    quoteUnit: string;
    status: string;
    blind: boolean;
    deadline: Date | null;
    createdAt: Date;
    launchedAt: Date | null;
  };
  quoteLadderLatest: ComplianceQuoteLadderRow[];
  award: ComplianceBestExRow['award'];
  exceptions: ComplianceExceptionRow[];
  eventLog: ComplianceEventRow[];
  attestation: string;
};

export function complianceBestExQuery(firmId: string) {
  return db
    .select({
      rfqId: rfqs.id,
      rfqRef: rfqs.ref,
      publicRef: rfqs.publicRef,
      title: rfqs.title,
      product: rfqs.product,
      notionalMinor: rfqs.notionalMinor,
      notionalLabel: rfqs.notionalLabel,
      ccy: rfqs.ccy,
      quoteUnit: rfqs.quoteUnit,
      status: rfqs.status,
      quoteCount: sql<number>`(select count(*)::int from quotes q where q.rfq_id = rfqs.id)`,
      exceptionCount: sql<number>`(select count(*)::int from exceptions e where e.rfq_id = rfqs.id)`,
      awardId: awards.id,
      awardKind: awards.kind,
      blendedPrice: awards.blendedPrice,
      bestSinglePrice: awards.bestSinglePrice,
      savingsBps: awards.savingsBps,
      savingsMinor: awards.savingsMinor,
      rationale: awards.rationale,
      allocations: awards.allocations,
      flags: awards.flags,
      approved: awards.approved,
      awardCreatedAt: awards.createdAt,
      approvedAt: awards.approvedAt,
      createdAt: rfqs.createdAt,
    })
    .from(rfqs)
    .leftJoin(awards, eq(awards.rfqId, rfqs.id))
    .where(and(eq(rfqs.firmId, firmId), inArray(rfqs.status, REVIEWABLE_STATUSES)))
    .orderBy(desc(rfqs.createdAt));
}

export function complianceEventLogQuery(firmId: string) {
  return db
    .select(complianceEventSelect)
    .from(events)
    .leftJoin(rfqs, and(eq(rfqs.id, events.rfqId), eq(rfqs.firmId, firmId)))
    .where(eq(events.firmId, firmId))
    .orderBy(desc(events.createdAt))
    .limit(80);
}

export function complianceExceptionsQuery(firmId: string, rfqId?: string) {
  return db
    .select(complianceExceptionSelect)
    .from(exceptions)
    .leftJoin(rfqs, and(eq(rfqs.id, exceptions.rfqId), eq(rfqs.firmId, firmId)))
    .where(rfqId ? and(eq(exceptions.firmId, firmId), eq(exceptions.rfqId, rfqId)) : eq(exceptions.firmId, firmId))
    .orderBy(desc(exceptions.openedAt));
}

export function complianceRfqBundleQuery(firmId: string, rfqId: string) {
  return db
    .select({
      id: rfqs.id,
      ref: rfqs.ref,
      publicRef: rfqs.publicRef,
      title: rfqs.title,
      product: rfqs.product,
      notionalMinor: rfqs.notionalMinor,
      notionalLabel: rfqs.notionalLabel,
      ccy: rfqs.ccy,
      quoteUnit: rfqs.quoteUnit,
      status: rfqs.status,
      blind: rfqs.blind,
      deadline: rfqs.deadline,
      createdAt: rfqs.createdAt,
      launchedAt: rfqs.launchedAt,
    })
    .from(rfqs)
    .where(and(eq(rfqs.id, rfqId), eq(rfqs.firmId, firmId)))
    .limit(1);
}

export function complianceQuoteLadderQuery(firmId: string, rfqId: string) {
  return db
    .select({
      dealerFirmId: quotes.dealerFirmId,
      dealerName: firms.name,
      price: quotes.price,
      pct: quotes.pct,
      note: quotes.note,
      submittedAt: quotes.submittedAt,
      revisedFromPrice: quotes.revisedFromPrice,
    })
    .from(quotes)
    .innerJoin(rfqs, eq(rfqs.id, quotes.rfqId))
    .leftJoin(firms, eq(firms.id, quotes.dealerFirmId))
    .where(and(eq(rfqs.id, rfqId), eq(rfqs.firmId, firmId)))
    .orderBy(asc(quotes.price));
}

export function complianceAwardQuery(firmId: string, rfqId: string) {
  return db
    .select({
      awardId: awards.id,
      awardKind: awards.kind,
      blendedPrice: awards.blendedPrice,
      bestSinglePrice: awards.bestSinglePrice,
      savingsBps: awards.savingsBps,
      savingsMinor: awards.savingsMinor,
      rationale: awards.rationale,
      allocations: awards.allocations,
      flags: awards.flags,
      approved: awards.approved,
      awardCreatedAt: awards.createdAt,
      approvedAt: awards.approvedAt,
    })
    .from(awards)
    .innerJoin(rfqs, eq(rfqs.id, awards.rfqId))
    .where(and(eq(rfqs.id, rfqId), eq(rfqs.firmId, firmId)))
    .limit(1);
}

export function complianceRfqEventsQuery(firmId: string, rfqId: string) {
  return db
    .select(complianceEventSelect)
    .from(events)
    .innerJoin(rfqs, eq(rfqs.id, events.rfqId))
    .where(and(eq(events.firmId, firmId), eq(events.rfqId, rfqId)))
    .orderBy(asc(events.createdAt));
}

function shapeAward(row: {
  awardId: string | null;
  awardKind: 'single' | 'blended' | null;
  blendedPrice: string | null;
  bestSinglePrice: string | null;
  savingsBps: string | null;
  savingsMinor: number | null;
  rationale: string | null;
  allocations: unknown;
  flags: unknown;
  approved: boolean | null;
  awardCreatedAt: Date | null;
  approvedAt: Date | null;
}): ComplianceBestExRow['award'] {
  if (!row.awardId || !row.awardKind || !row.blendedPrice || !row.awardCreatedAt) return null;
  return {
    id: row.awardId,
    kind: row.awardKind,
    blendedPrice: row.blendedPrice,
    bestSinglePrice: row.bestSinglePrice,
    savingsBps: row.savingsBps,
    savingsMinor: row.savingsMinor,
    rationale: row.rationale,
    allocations: (row.allocations as Allocation[]) ?? [],
    flags: (row.flags as AwardFlag[]) ?? [],
    approved: row.approved ?? false,
    createdAt: row.awardCreatedAt,
    approvedAt: row.approvedAt,
  };
}

export async function getComplianceOverview(firmId: string): Promise<ComplianceOverview> {
  const [bestExRows, eventRows, exceptionRows, concentration] = await Promise.all([
    complianceBestExQuery(firmId),
    complianceEventLogQuery(firmId),
    complianceExceptionsQuery(firmId),
    getDealerConcentration(firmId),
  ]);

  const dealerIds = Object.keys(concentration);
  const dealerRows = dealerIds.length
    ? await db.select({ id: firms.id, name: firms.name }).from(firms).where(inArray(firms.id, dealerIds))
    : [];
  const dealerNameById = new Map(dealerRows.map((d) => [d.id, d.name]));

  return {
    bestEx: bestExRows.map((r) => ({
      rfqId: r.rfqId,
      rfqRef: r.rfqRef,
      publicRef: r.publicRef,
      title: r.title,
      product: r.product,
      notionalMinor: r.notionalMinor,
      notionalLabel: r.notionalLabel,
      ccy: r.ccy,
      quoteUnit: r.quoteUnit,
      status: r.status,
      quoteCount: r.quoteCount,
      exceptionCount: r.exceptionCount,
      award: shapeAward(r),
    })),
    events: eventRows,
    exceptions: exceptionRows,
    concentration: dealerIds
      .map((dealerFirmId) => ({
        dealerFirmId,
        dealerName: dealerNameById.get(dealerFirmId) ?? dealerFirmId,
        shareBps: concentration[dealerFirmId].shareBps,
        notionalMinor: concentration[dealerFirmId].notionalMinor,
      }))
      .sort((a, b) => b.shareBps - a.shareBps),
  };
}

export async function getBestExBundle(
  firmId: string,
  rfqId: string,
): Promise<ComplianceBestExBundle | null> {
  const rfqRows = await complianceRfqBundleQuery(firmId, rfqId);
  const rfq = rfqRows[0];
  if (!rfq) return null;

  const [quoteRows, awardRows, exceptionRows, eventRows] = await Promise.all([
    complianceQuoteLadderQuery(firmId, rfqId),
    complianceAwardQuery(firmId, rfqId),
    complianceExceptionsQuery(firmId, rfqId),
    complianceRfqEventsQuery(firmId, rfqId),
  ]);

  const award = awardRows[0] ? shapeAward(awardRows[0]) : null;
  return {
    generatedAt: new Date().toISOString(),
    rfq,
    quoteLadderLatest: quoteRows.map((q) => ({ ...q, dealerName: q.dealerName ?? '' })),
    award,
    exceptions: exceptionRows,
    eventLog: eventRows,
    attestation: 'Latest stored quote rows; full quote revision history is not persisted in the current schema.',
  };
}
