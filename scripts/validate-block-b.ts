// scripts/validate-block-b.ts — one-shot validation that the approve action
// flipped state cleanly. Run after manually approving rfq:0141 in the browser.
//
//   npx tsx --env-file-if-exists=.env scripts/validate-block-b.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { and, eq, desc } from 'drizzle-orm';
import * as schema from '../db/schema';
import { seedId } from '../db/seed-data';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');

const sql = postgres(DB_URL, { prepare: false });
const db = drizzle(sql, { schema });

const rfqId = seedId('rfq:0141');

function ok(label: string) { console.log(`  [32m✓[0m ${label}`); }
function bad(label: string, detail?: string) {
  console.log(`  [31m✗[0m ${label}${detail ? '  — ' + detail : ''}`);
  process.exitCode = 1;
}

async function main() {
  console.log('Block B approve-state validation for rfq:0141\n');

  // 1. RFQ status
  const rfq = await db.query.rfqs.findFirst({ where: eq(schema.rfqs.id, rfqId) });
  if (!rfq) { bad('rfq:0141 not found in DB'); return; }
  console.log(`RFQ ${rfq.ref} (${rfq.publicRef})  notional=$${(rfq.notionalMinor / 100_000_000).toFixed(0)}M`);
  rfq.status === 'awarded'
    ? ok(`status = 'awarded'`)
    : bad(`status = '${rfq.status}' (expected 'awarded')`);

  // 2. Award row
  const award = await db.query.awards.findFirst({ where: eq(schema.awards.rfqId, rfqId) });
  if (!award) { bad('no awards row'); return; }
  award.approved === true
    ? ok('awards.approved = true')
    : bad(`awards.approved = ${award.approved}`);
  award.approvedBy
    ? ok(`awards.approvedBy = ${award.approvedBy}`)
    : bad('awards.approvedBy not set');
  award.approvedAt
    ? ok(`awards.approvedAt = ${award.approvedAt.toISOString()}`)
    : bad('awards.approvedAt not set');

  // 3. Trades — one per allocation
  const tradeRows = await db.query.trades.findMany({ where: eq(schema.trades.rfqId, rfqId) });
  tradeRows.length === 2
    ? ok(`trades count = 2 (one per allocation)`)
    : bad(`trades count = ${tradeRows.length} (expected 2)`);

  for (const t of tradeRows) {
    t.ref.startsWith('T-')
      ? ok(`trade ${t.ref}  dealer=${t.dealerFirmId.slice(0,8)}…  pct=${t.pct}  notional=$${(t.allocNotionalMinor/100).toLocaleString()}`)
      : bad(`trade ref '${t.ref}' missing T- prefix`);
    const expected = Number(BigInt(rfq.notionalMinor) * BigInt(t.pct) / 100n);
    t.allocNotionalMinor === expected
      ? ok(`  → allocNotionalMinor = ${t.allocNotionalMinor} (integer-exact, matches BigInt(${rfq.notionalMinor})*${t.pct}/100)`)
      : bad(`  → allocNotionalMinor mismatch: got ${t.allocNotionalMinor}, expected ${expected}`);
    t.status === 'captured'
      ? ok(`  → status = 'captured' (default)`)
      : bad(`  → status = '${t.status}'`);
  }

  // 4. Exceptions — all open ones should be closed now
  const exns = await db.query.exceptions.findMany({ where: eq(schema.exceptions.rfqId, rfqId) });
  exns.length > 0
    ? ok(`exceptions count = ${exns.length}`)
    : bad('no exceptions row found — seed should have created EX-2026-0001');
  for (const e of exns) {
    (e.status === 'closed' && e.open === false)
      ? ok(`exception ${e.ref} closed (status=closed, open=false)`)
      : bad(`exception ${e.ref} not closed: status=${e.status}, open=${e.open}`);
  }

  // 5. Event log — single aggregate award_approved with rich detail
  const events = await db.query.events.findMany({
    where: and(eq(schema.events.rfqId, rfqId), eq(schema.events.type, 'award_approved')),
    orderBy: [desc(schema.events.createdAt)],
  });
  events.length === 1
    ? ok(`award_approved events = 1 (aggregate event pattern)`)
    : bad(`award_approved events = ${events.length} (expected 1)`);

  if (events[0]) {
    const detail = events[0].detail as Record<string, unknown>;
    const tradeRefs = detail?.tradeRefs as string[] | undefined;
    const closedExceptionRefs = detail?.closedExceptionRefs as string[] | undefined;
    const ackedFlagIds = detail?.ackedFlagIds as string[] | undefined;
    tradeRefs?.length === 2
      ? ok(`event.detail.tradeRefs = [${tradeRefs.join(', ')}]`)
      : bad(`event.detail.tradeRefs = ${JSON.stringify(tradeRefs)} (expected 2 entries)`);
    closedExceptionRefs && closedExceptionRefs.length >= 1
      ? ok(`event.detail.closedExceptionRefs = [${closedExceptionRefs.join(', ')}]`)
      : bad(`event.detail.closedExceptionRefs = ${JSON.stringify(closedExceptionRefs)}`);
    ackedFlagIds && ackedFlagIds.length === 2
      ? ok(`event.detail.ackedFlagIds = [${ackedFlagIds.join(', ')}] (both warn flags acked)`)
      : bad(`event.detail.ackedFlagIds = ${JSON.stringify(ackedFlagIds)} (expected 2)`);
    'committeeNoteProvided' in detail
      ? ok(`event.detail.committeeNoteProvided = ${detail.committeeNoteProvided} ($120M < $250M → false expected)`)
      : bad(`event.detail.committeeNoteProvided missing`);
  }

  // 6. trades_ref_uniq sanity — refs must be globally distinct
  const allRefs = (await db.select({ ref: schema.trades.ref }).from(schema.trades)).map(r => r.ref);
  const uniq = new Set(allRefs);
  allRefs.length === uniq.size
    ? ok(`trade refs globally unique (${allRefs.length} rows, ${uniq.size} distinct)`)
    : bad(`duplicate trade refs detected (${allRefs.length} rows, ${uniq.size} distinct)`);

  await sql.end();
  console.log(process.exitCode ? '\n✗ Validation failed' : '\n✓ Block B post-approve state is consistent');
}

main().catch((e) => { console.error(e); process.exit(1); });
