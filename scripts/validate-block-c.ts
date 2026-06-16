// scripts/validate-block-c.ts — one-shot validation that the Block C Ops
// surface produces consistent state through the full handoff lifecycle.
// Mirrors scripts/validate-block-b.ts. Concurrency surfaces (stale state,
// partial trade lock loss) are unit-tested at the gate level in
// app/(app)/ops/actions.test.ts; this script verifies the post-state.
//
// Manual flow before running (logged in via the app):
//   1. `npm run db:seed` — produces rfq:0138 (in_stp, 1 sent trade,
//      1 sent handoff, 1 open exception) and rfq:0139 (awarded, 1 captured
//      trade, no handoff).
//   2. Sign in as tomas@meridian.example (ops).
//   3. /ops → click "Generate handoff" for rfq:0139 (HALCYON appears in the
//      blotter; ops still sees Meridian-scope only — actually rfq:0139 is
//      HALCYON-owned, so use a HALCYON ops user if testing that case; for
//      this script's MERIDIAN flow stick with rfq:0138).
//   4. /ops → on the rfq:0138 handoff card click "Resolve" on the open
//      exception, then "Mark matched", then "Mark affirmed".
//
// Then run:
//   npx tsx --env-file-if-exists=.env scripts/validate-block-c.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { and, asc, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { seedId } from '../db/seed-data';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL not set');

const sql = postgres(DB_URL, { prepare: false });
const db = drizzle(sql, { schema });

const rfq0138 = seedId('rfq:0138');
const rfq0139 = seedId('rfq:0139');

function ok(label: string) {
  console.log(`  \x1b[32m✓\x1b[0m ${label}`);
}
function bad(label: string, detail?: string) {
  console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? '  — ' + detail : ''}`);
  process.exitCode = 1;
}

async function checkSeedState() {
  console.log('\n[1/3] Post-seed state');

  // rfq:0138 — in_stp with one sent trade + one sent handoff + one open exception.
  const rfq38 = await db.query.rfqs.findFirst({ where: eq(schema.rfqs.id, rfq0138) });
  rfq38
    ? ok(`rfq:0138 present (status=${rfq38.status})`)
    : bad('rfq:0138 missing — run npm run db:seed');

  const trades38 = await db.query.trades.findMany({ where: eq(schema.trades.rfqId, rfq0138) });
  trades38.length === 1
    ? ok(`rfq:0138 trades count = 1`)
    : bad(`rfq:0138 trades count = ${trades38.length} (expected 1)`);
  if (trades38[0]) {
    const t = trades38[0];
    t.ref.startsWith('T-')
      ? ok(`  → ref ${t.ref} (T- prefix)`)
      : bad(`  → ref '${t.ref}' missing T- prefix`);
    t.allocNotionalMinor === 150_000_000 * 100
      ? ok(`  → allocNotionalMinor = ${t.allocNotionalMinor}`)
      : bad(`  → allocNotionalMinor mismatch (got ${t.allocNotionalMinor})`);
  }

  const handoffs38 = await db.query.handoffs.findMany({ where: eq(schema.handoffs.rfqId, rfq0138) });
  handoffs38.length === 1
    ? ok(`rfq:0138 handoffs count = 1`)
    : bad(`rfq:0138 handoffs count = ${handoffs38.length} (expected 1)`);
  if (handoffs38[0]) {
    const h = handoffs38[0];
    h.ref.startsWith('H-')
      ? ok(`  → ref ${h.ref} (H- prefix)`)
      : bad(`  → ref '${h.ref}' missing H- prefix`);
    const p = h.payload as Record<string, unknown>;
    p?.messageType === 'TradeCaptureReport'
      ? ok(`  → payload.messageType = '${p.messageType}'`)
      : bad(`  → payload.messageType = ${JSON.stringify(p?.messageType)}`);
    Array.isArray(p?.counterpartyLegs) && (p.counterpartyLegs as unknown[]).length === 1
      ? ok(`  → payload.counterpartyLegs = 1`)
      : bad(`  → payload.counterpartyLegs malformed`);

    const exns = await db.query.handoffExceptions.findMany({
      where: eq(schema.handoffExceptions.handoffId, h.id),
    });
    exns.length === 1 && exns[0].open
      ? ok(`  → handoff_exceptions = 1 open ("${exns[0].text.slice(0, 40)}…")`)
      : bad(`  → handoff_exceptions state wrong (count=${exns.length})`);
  }

  // rfq:0139 — awarded with one captured trade, no handoff yet.
  const rfq39 = await db.query.rfqs.findFirst({ where: eq(schema.rfqs.id, rfq0139) });
  rfq39?.status === 'awarded'
    ? ok(`rfq:0139 status = 'awarded'`)
    : bad(`rfq:0139 status = '${rfq39?.status}' (expected awarded)`);
  const trades39 = await db.query.trades.findMany({ where: eq(schema.trades.rfqId, rfq0139) });
  trades39.length === 1 && trades39[0].status === 'captured'
    ? ok(`rfq:0139 trades = 1 (status=captured)`)
    : bad(`rfq:0139 trades unexpected (count=${trades39.length}, status=${trades39[0]?.status})`);
  const handoffs39 = await db.query.handoffs.findMany({ where: eq(schema.handoffs.rfqId, rfq0139) });
  handoffs39.length === 0
    ? ok(`rfq:0139 handoffs = 0 (clean slate)`)
    : bad(`rfq:0139 handoffs = ${handoffs39.length} (expected 0 pre-generate)`);
}

async function checkPostGenerate0139() {
  console.log('\n[2/3] Post-generateHandoff state for rfq:0139 (skip if not yet run)');

  const handoffs = await db.query.handoffs.findMany({ where: eq(schema.handoffs.rfqId, rfq0139) });
  if (handoffs.length === 0) {
    console.log(`  \x1b[33m·\x1b[0m no handoff generated yet for rfq:0139 — skipping`);
    return;
  }

  const rfq = await db.query.rfqs.findFirst({ where: eq(schema.rfqs.id, rfq0139) });
  rfq?.status === 'in_stp'
    ? ok(`rfq:0139 status flipped to 'in_stp'`)
    : bad(`rfq:0139 status = '${rfq?.status}' (expected in_stp)`);

  const trades = await db.query.trades.findMany({ where: eq(schema.trades.rfqId, rfq0139) });
  trades.every((t) => t.status === 'sent')
    ? ok(`rfq:0139 trades all status='sent' (${trades.length})`)
    : bad(`rfq:0139 trade statuses = ${trades.map((t) => t.status).join(',')}`);

  handoffs.length === 1
    ? ok(`rfq:0139 handoffs = 1`)
    : bad(`rfq:0139 handoffs = ${handoffs.length} (expected exactly 1)`);
  const h = handoffs[0];
  if (h) {
    h.status === 'sent'
      ? ok(`  → handoff ${h.ref} status='sent'`)
      : bad(`  → handoff ${h.ref} status='${h.status}'`);
    const ids = (h.tradeIds as string[]) ?? [];
    ids.length === trades.length && ids.every((id) => trades.some((t) => t.id === id))
      ? ok(`  → tradeIds match trade rows (${ids.length})`)
      : bad(`  → tradeIds mismatch (ids=${ids.length}, trades=${trades.length})`);
  }

  const events = await db.query.events.findMany({
    where: and(eq(schema.events.rfqId, rfq0139), eq(schema.events.type, 'handoff_sent')),
  });
  events.length === 1
    ? ok(`handoff_sent event = 1`)
    : bad(`handoff_sent event count = ${events.length}`);
}

async function checkPostLifecycle0138() {
  console.log('\n[3/3] Post-lifecycle state for rfq:0138 (skip if not yet advanced)');

  const handoffs = await db.query.handoffs.findMany({ where: eq(schema.handoffs.rfqId, rfq0138) });
  const h = handoffs[0];
  if (!h || h.status === 'sent') {
    console.log(`  \x1b[33m·\x1b[0m rfq:0138 handoff still at 'sent' — skipping`);
    return;
  }

  h.status === 'affirmed'
    ? ok(`rfq:0138 handoff status='affirmed'`)
    : bad(`rfq:0138 handoff status='${h.status}' (expected affirmed)`);

  const trades = await db.query.trades.findMany({ where: eq(schema.trades.rfqId, rfq0138) });
  trades.every((t) => t.status === 'affirmed')
    ? ok(`rfq:0138 trades all status='affirmed' (${trades.length})`)
    : bad(`rfq:0138 trade statuses = ${trades.map((t) => t.status).join(',')}`);

  const exns = await db.query.handoffExceptions.findMany({
    where: eq(schema.handoffExceptions.handoffId, h.id),
  });
  exns.every((e) => !e.open)
    ? ok(`rfq:0138 handoff exceptions all closed (${exns.length})`)
    : bad(`rfq:0138 open exceptions = ${exns.filter((e) => e.open).length}`);

  const rfq = await db.query.rfqs.findFirst({ where: eq(schema.rfqs.id, rfq0138) });
  rfq?.status === 'affirmed'
    ? ok(`rfq:0138 status flipped to 'affirmed' (all legs affirmed, no open exceptions)`)
    : bad(`rfq:0138 status = '${rfq?.status}' (expected affirmed)`);

  const events = await db.query.events.findMany({
    where: eq(schema.events.rfqId, rfq0138),
    orderBy: [asc(schema.events.createdAt)],
  });
  const types = events.map((e) => e.type);
  const advCount = types.filter((t) => t === 'handoff_advanced').length;
  const closedCount = types.filter((t) => t === 'exception_closed').length;
  advCount === 2
    ? ok(`handoff_advanced events = 2 (sent→matched, matched→affirmed)`)
    : bad(`handoff_advanced events = ${advCount} (expected 2)`);
  closedCount >= 1
    ? ok(`exception_closed events = ${closedCount}`)
    : bad(`exception_closed events = 0 (did you resolve the open exception?)`);
}

async function main() {
  console.log('Validating Block C post-state…');
  await checkSeedState();
  await checkPostGenerate0139();
  await checkPostLifecycle0138();
  await sql.end();
  console.log(
    process.exitCode
      ? '\n\x1b[31m✗ Validation failed\x1b[0m'
      : '\n\x1b[32m✓ Block C post-state is consistent\x1b[0m',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
