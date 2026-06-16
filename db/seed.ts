// db/seed.ts — run with `npm run db:seed`.
// Idempotent: clears prior seed rows for the demo firms, then inserts fresh.
// Creates Supabase Auth users (service-role) and links them to user rows.
// Requires DATABASE_URL and SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL.
import { randomBytes, createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import { inArray } from 'drizzle-orm';
import { generatePublicRef } from '../lib/public-ref';
import { makeAwardFlag } from '../lib/policy';
import * as schema from './schema';
import {
  FIRMS, USERS, PANELS, RFQS, QUOTES, DEALER_EMAILS, DEMO_PASSWORD, DEALER, seedId,
} from './seed-data';

const DB_URL = process.env.DATABASE_URL;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!DB_URL) throw new Error('DATABASE_URL not set');
if (!SB_URL || !SB_KEY) throw new Error('Supabase URL or service-role key not set');

const sql = postgres(DB_URL, { prepare: false });
const db = drizzle(sql, { schema });
const supabase = createClient(SB_URL, SB_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const now = Date.now();
const deadlineFrom = (offsetMin: number | null) =>
  offsetMin === null ? null : new Date(now + offsetMin * 60_000);

const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

async function main() {
  console.log('Seeding Veloce demo tenant…');

  const firmIds = FIRMS.map((f) => f.id);
  const rfqIds = RFQS.map((r) => seedId(r.key));

  // --- clean prior seed (idempotent) -------------------------------------
  // Children first; FKs cascade on rfq deletes but events/exceptions need help.
  await db.delete(schema.events).where(inArray(schema.events.firmId, firmIds));
  await db.delete(schema.exceptions).where(inArray(schema.exceptions.firmId, firmIds));
  await db.delete(schema.rfqs).where(inArray(schema.rfqs.id, rfqIds));
  await db.delete(schema.bankPanels).where(inArray(schema.bankPanels.firmId, firmIds));
  await db.delete(schema.users).where(inArray(schema.users.firmId, firmIds));
  await db.delete(schema.firms).where(inArray(schema.firms.id, firmIds));

  // --- firms --------------------------------------------------------------
  await db.insert(schema.firms).values(FIRMS);
  console.log(`  ${FIRMS.length} firms`);

  // --- auth users + user rows --------------------------------------------
  for (const u of USERS) {
    // Create or fetch the Auth user. createUser is idempotent-ish: on
    // duplicate email it errors, so we look up and reuse.
    let authId: string | undefined;
    const created = await supabase.auth.admin.createUser({
      email: u.email, password: DEMO_PASSWORD, email_confirm: true,
    });
    if (created.error) {
      // Already exists — find by listing (small demo roster).
      const list = await supabase.auth.admin.listUsers();
      authId = list.data.users.find((x) => x.email === u.email)?.id;
      // Reset password so it always matches DEMO_PASSWORD.
      if (authId) await supabase.auth.admin.updateUserById(authId, { password: DEMO_PASSWORD });
    } else {
      authId = created.data.user?.id;
    }
    await db.insert(schema.users).values({
      id: u.id, authId, firmId: u.firmId, email: u.email,
      fullName: u.fullName, role: u.role, desk: u.desk, active: true,
    });
  }
  console.log(`  ${USERS.length} buy-side users (password: ${DEMO_PASSWORD})`);

  // --- panels -------------------------------------------------------------
  for (const p of PANELS) {
    await db.insert(schema.bankPanels).values({
      id: p.id, firmId: p.firmId, name: p.name, isDefault: p.isDefault,
    });
    await db.insert(schema.bankPanelMembers).values(
      p.members.map((dealerFirmId) => ({ panelId: p.id, dealerFirmId })),
    );
  }
  console.log(`  ${PANELS.length} bank panels`);

  // --- rfqs + invited dealers + invitation tokens ------------------------
  const tokenLines: string[] = [];
  for (const r of RFQS) {
    const id = seedId(r.key);
    const deadline = deadlineFrom(r.deadlineOffsetMin);
    await db.insert(schema.rfqs).values({
      id, ref: r.ref,
      publicRef: generatePublicRef(),
      firmId: r.firmId, requesterId: r.requesterId,
      title: r.title, product: r.product, template: r.template, side: r.side,
      underlying: r.underlying, refLevel: r.refLevel, strike: r.strike,
      expiry: r.expiry, style: r.style, tenor: r.tenor,
      notionalMinor: r.notionalMinor, ccy: r.ccy, notionalLabel: r.notionalLabel,
      quoteUnit: r.quoteUnit, mode: r.mode, blind: r.blind,
      status: r.status as typeof schema.rfqs.$inferInsert.status,
      deadline, windowMinutes: r.windowMinutes,
      launchedAt: r.status === 'draft' ? null : new Date(now - 60 * 60_000),
    });
    await db.insert(schema.rfqInvitedDealers).values(
      r.invited.map((dealerFirmId) => ({ rfqId: id, dealerFirmId })),
    );

    // Mint dealer tokens only for the live RFQ (the others are closed).
    if (r.status === 'live') {
      for (const dealerFirmId of r.invited) {
        const raw = randomBytes(24).toString('base64url');
        await db.insert(schema.invitations).values({
          rfqId: id, dealerFirmId, tokenHash: hashToken(raw),
          dealerEmail: DEALER_EMAILS[dealerFirmId] ?? 'desk@example.com',
          status: 'pending',
        });
        tokenLines.push(`    ${r.ref}  ${dealerFirmId.slice(0, 8)}…  /quote/${raw}`);
      }
    }
  }
  console.log(`  ${RFQS.length} RFQs (+ invited dealers, + live-RFQ tokens)`);

  // --- quotes -------------------------------------------------------------
  for (const q of QUOTES) {
    await db.insert(schema.quotes).values({
      rfqId: seedId(q.rfqKey), dealerFirmId: q.dealer,
      price: q.price, pct: q.pct, note: q.note,
    });
  }
  console.log(`  ${QUOTES.length} quotes`);

  // --- block-b: seed a recommended award for rfq:0141 ---------------------
  // Mirrors what recommendAwardAction(rfqKey, 'blended') would produce, but
  // server actions need cookie auth (resolveUser) which CLI scripts can't
  // satisfy — so we insert the result directly. Values reflect:
  //   $120M Russell 2000 collar, quotes Atlas 0.4500/50%, Kestrel 0.5200/100%,
  //   Marlowe 0.5800/100%. Blended fill: Atlas 50% + Kestrel 50% = 0.4850
  //   blended; best single = Kestrel @ 0.5200. Atlas's 0.4500 deviates from
  //   the best single → opens an exception. With no prior trades, projected
  //   concentration for any single dealer is 100% → also flags.
  const meridian = seedId('firm:meridian');
  const dana = seedId('user:dana');
  const rfq0141Id = seedId('rfq:0141');
  const concFlag = makeAwardFlag('warn', 'Dealer concentration projected at 100.0% (>35% threshold)');
  const devFlag = makeAwardFlag('warn', 'Awarded price 0.4500 deviates from best quote 0.5200');
  await db.insert(schema.awards).values({
    rfqId: rfq0141Id,
    kind: 'blended',
    blendedPrice: '0.4850',
    bestSinglePrice: '0.5200',
    bestSingleDealerId: DEALER.kestrel,
    // savings() formula in lib/award-math.ts:94-96 (matches what
    // recommendAwardAction writes). deltaTicks = toTicks(0.5200) - 4850 = 350.
    //   bps   = (350 / SCALE) * 100        = 3.50
    //   minor = round((350 / SCALE / 100) * 12_000_000_000) = 4_200_000 cents
    savingsBps: '3.50',
    savingsMinor: 4_200_000,
    rationale: 'Blended fill: Atlas 50% @ 0.4500 + Kestrel 50% @ 0.5200.\n\n' +
      'Deviation note: Atlas allocation at 0.4500 deviates from the best single quote (Kestrel @ 0.5200).',
    allocations: [
      { dealerFirmId: DEALER.atlas, pct: 50, price: '0.4500' },
      { dealerFirmId: DEALER.kestrel, pct: 50, price: '0.5200' },
    ],
    flags: [concFlag, devFlag],
    approved: false,
    recommendedBy: dana,
  });
  await db.insert(schema.exceptions).values({
    ref: 'EX-2026-0001',
    firmId: meridian,
    rfqId: rfq0141Id,
    severity: 'warn',
    text: 'Best-execution deviation: Atlas allocation at 0.4500 vs best single quote 0.5200 (Kestrel).',
    status: 'open',
    open: true,
  });
  console.log('  1 recommended award + 1 open exception for rfq:0141');

  console.log('\nDealer magic-link tokens for the live RFQ (dev only):');
  tokenLines.forEach((l) => console.log(l));

  console.log('\nDone. Sign in at /login with any user email and password "' + DEMO_PASSWORD + '".');
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
