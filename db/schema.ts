// db/schema.ts
// ---------------------------------------------------------------------------
// Veloce MVP schema. Encodes the design-tree decisions:
//  - Multi-tenant: every business row carries firm_id (Decision 3).
//  - Integer money: notional in minor units (bigint), prices numeric(12,4)
//    (Decision 8).
//  - Transactional hybrid audit: mutable state tables + append-only `events`,
//    written together via recordEvent() (Decision 7).
//  - Dealer access: opaque capability tokens live in `invitations` (Decision 10).
//  - Auction lifecycle: rfqs.deadline is the authoritative timestamp; writes
//    self-validate against it (Decision 6).
// ---------------------------------------------------------------------------
import {
  pgTable, uuid, text, timestamp, bigint, numeric, integer,
  boolean, jsonb, pgEnum, index, primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ----------------------------------------------------------------- enums
export const firmType = pgEnum('firm_type', ['insurer', 'fund', 'dealer']);
export const userRole = pgEnum('user_role', [
  'trader', 'approver', 'ops', 'compliance', 'admin',
]);
export const rfqStatus = pgEnum('rfq_status', [
  'draft', 'live', 'under_review', 'awaiting_approval',
  'awarded', 'in_stp', 'affirmed', 'cancelled',
]);
export const auctionMode = pgEnum('auction_mode', ['split', 'full']);
export const awardKind = pgEnum('award_kind', ['single', 'blended']);
export const tradeStatus = pgEnum('trade_status', [
  'captured', 'sent', 'matched', 'affirmed',
]);
export const handoffStatus = pgEnum('handoff_status', [
  'sent', 'matched', 'affirmed',
]);
export const exceptionSeverity = pgEnum('exception_severity', ['info', 'warn']);
export const invitationStatus = pgEnum('invitation_status', [
  'pending', 'responded', 'expired', 'revoked',
]);

// Every meaningful action is one of these. The append-only event log is the
// legal record; this enum is the closed vocabulary of what can happen.
export const eventType = pgEnum('event_type', [
  'rfq_created', 'rfq_launched', 'rfq_cancelled',
  'invitation_sent',
  'quote_submitted', 'quote_revised',
  'auction_closed', 'auction_extended',
  'award_recommended', 'award_approved', 'award_rejected', 'clarification_requested',
  'trade_captured', 'handoff_sent', 'handoff_advanced',
  'exception_opened', 'exception_closed',
]);

// --------------------------------------------------------------- firms
export const firms = pgTable('firms', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: firmType('type').notNull(),
  city: text('city'),
  lei: text('lei'),
  // Dealer firms have a short code (ATL, KST) for the quote board.
  shortCode: text('short_code'),
  colorHex: text('color_hex'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// --------------------------------------------------------------- users
// Buy-side users only. Mirrors a Supabase Auth user via authId. Dealers are
// NOT users — they hold invitation tokens (Decision 10).
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  authId: uuid('auth_id').unique(), // supabase auth.users.id
  firmId: uuid('firm_id').notNull().references(() => firms.id),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  role: userRole('role').notNull(),
  desk: text('desk'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  firmIdx: index('users_firm_idx').on(t.firmId),
}));

// --------------------------------------------------------- bank panels
export const bankPanels = pgTable('bank_panels', {
  id: uuid('id').primaryKey().defaultRandom(),
  firmId: uuid('firm_id').notNull().references(() => firms.id),
  name: text('name').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  firmIdx: index('bank_panels_firm_idx').on(t.firmId),
}));

export const bankPanelMembers = pgTable('bank_panel_members', {
  panelId: uuid('panel_id').notNull().references(() => bankPanels.id, { onDelete: 'cascade' }),
  dealerFirmId: uuid('dealer_firm_id').notNull().references(() => firms.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.panelId, t.dealerFirmId] }),
}));

// ----------------------------------------------------------------- rfqs
export const rfqs = pgTable('rfqs', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Human-facing reference, e.g. VEL-2026-0142. Unique per tenant.
  ref: text('ref').notNull(),
  firmId: uuid('firm_id').notNull().references(() => firms.id),
  requesterId: uuid('requester_id').references(() => users.id),

  title: text('title').notNull(),
  product: text('product').notNull(),
  template: text('template'),
  side: text('side'),
  underlying: text('underlying'),
  refLevel: text('ref_level'),
  strike: text('strike'),
  expiry: text('expiry'),
  style: text('style'),
  tenor: text('tenor'),

  // Money: minor units, integer. ccy drives display symbol.
  notionalMinor: bigint('notional_minor', { mode: 'number' }).notNull(),
  ccy: text('ccy').notNull().default('USD'),
  // Some products quote vega/vol; keep a free-form label for those.
  notionalLabel: text('notional_label'),
  quoteUnit: text('quote_unit').notNull(),
  // Lower price is better for all current products; explicit for var swaps etc.
  lowerIsBetter: boolean('lower_is_better').notNull().default(true),

  mode: auctionMode('mode').notNull().default('split'),
  blind: boolean('blind').notNull().default(true),
  status: rfqStatus('status').notNull().default('draft'),

  // The authoritative auction clock. Null until launched.
  deadline: timestamp('deadline', { withTimezone: true }),
  windowMinutes: integer('window_minutes').notNull().default(30),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  launchedAt: timestamp('launched_at', { withTimezone: true }),
}, (t) => ({
  firmIdx: index('rfqs_firm_idx').on(t.firmId),
  statusIdx: index('rfqs_status_idx').on(t.status),
  deadlineIdx: index('rfqs_deadline_idx').on(t.deadline),
  refIdx: index('rfqs_ref_idx').on(t.firmId, t.ref),
}));

// Which dealers were invited to an RFQ (the panel snapshot at launch).
export const rfqInvitedDealers = pgTable('rfq_invited_dealers', {
  rfqId: uuid('rfq_id').notNull().references(() => rfqs.id, { onDelete: 'cascade' }),
  dealerFirmId: uuid('dealer_firm_id').notNull().references(() => firms.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.rfqId, t.dealerFirmId] }),
}));

// ----------------------------------------------------------- invitations
// One opaque capability token per dealer per RFQ. The token IS the
// authorization (Decision 10): scoped to one RFQ, two operations, expires at
// auction close, revocable by flipping status.
export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqId: uuid('rfq_id').notNull().references(() => rfqs.id, { onDelete: 'cascade' }),
  dealerFirmId: uuid('dealer_firm_id').notNull().references(() => firms.id),
  // High-entropy opaque token; only the hash is stored.
  tokenHash: text('token_hash').notNull().unique(),
  dealerEmail: text('dealer_email').notNull(),
  status: invitationStatus('status').notNull().default('pending'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
}, (t) => ({
  rfqIdx: index('invitations_rfq_idx').on(t.rfqId),
  tokenIdx: index('invitations_token_idx').on(t.tokenHash),
}));

// ---------------------------------------------------------------- quotes
export const quotes = pgTable('quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqId: uuid('rfq_id').notNull().references(() => rfqs.id, { onDelete: 'cascade' }),
  dealerFirmId: uuid('dealer_firm_id').notNull().references(() => firms.id),
  invitationId: uuid('invitation_id').references(() => invitations.id),

  // Price as exact numeric; pct as integer 1..100 (max size dealer will take).
  price: numeric('price', { precision: 12, scale: 4 }).notNull(),
  pct: integer('pct').notNull(),
  note: text('note'),

  // Revision tracking: a revise updates the row but stamps the prior price.
  revisedFromPrice: numeric('revised_from_price', { precision: 12, scale: 4 }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  rfqIdx: index('quotes_rfq_idx').on(t.rfqId),
  // One live quote per dealer per RFQ; revisions update in place.
  dealerRfqIdx: index('quotes_dealer_rfq_idx').on(t.rfqId, t.dealerFirmId),
}));

// ----------------------------------------------------- awards / proposals
// A proposal (recommended, pending approval) or an award (approved). Holds the
// computed blended figures so the read model never recomputes on the fly.
export const awards = pgTable('awards', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfqId: uuid('rfq_id').notNull().references(() => rfqs.id, { onDelete: 'cascade' }),
  kind: awardKind('kind').notNull(),
  blendedPrice: numeric('blended_price', { precision: 12, scale: 4 }).notNull(),
  bestSinglePrice: numeric('best_single_price', { precision: 12, scale: 4 }),
  bestSingleDealerId: uuid('best_single_dealer_id').references(() => firms.id),
  savingsBps: numeric('savings_bps', { precision: 8, scale: 2 }),
  savingsMinor: bigint('savings_minor', { mode: 'number' }),
  rationale: text('rationale'),
  // [{ dealerFirmId, pct, price }]
  allocations: jsonb('allocations').notNull(),
  // [{ severity, text }]
  flags: jsonb('flags').notNull().default('[]'),
  approved: boolean('approved').notNull().default(false),
  recommendedBy: uuid('recommended_by').references(() => users.id),
  approvedBy: uuid('approved_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
}, (t) => ({
  rfqIdx: index('awards_rfq_idx').on(t.rfqId),
}));

// ---------------------------------------------------------------- trades
export const trades = pgTable('trades', {
  id: uuid('id').primaryKey().defaultRandom(),
  ref: text('ref').notNull(),
  rfqId: uuid('rfq_id').notNull().references(() => rfqs.id, { onDelete: 'cascade' }),
  dealerFirmId: uuid('dealer_firm_id').notNull().references(() => firms.id),
  pct: integer('pct').notNull(),
  allocNotionalMinor: bigint('alloc_notional_minor', { mode: 'number' }).notNull(),
  ccy: text('ccy').notNull(),
  price: numeric('price', { precision: 12, scale: 4 }).notNull(),
  priceUnit: text('price_unit').notNull(),
  status: tradeStatus('status').notNull().default('captured'),
  tradeDate: text('trade_date'),
  settle: text('settle'),
  uti: text('uti'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  rfqIdx: index('trades_rfq_idx').on(t.rfqId),
}));

// ------------------------------------------------------------- handoffs
// STP capture record. Persisted but never transmitted (Decision 12). Holds the
// generated FpML-style payload for preview/inspection.
export const handoffs = pgTable('handoffs', {
  id: uuid('id').primaryKey().defaultRandom(),
  ref: text('ref').notNull(),
  rfqId: uuid('rfq_id').notNull().references(() => rfqs.id, { onDelete: 'cascade' }),
  tradeIds: jsonb('trade_ids').notNull(), // string[]
  channel: text('channel').notNull().default('MarkitWire (simulated)'),
  payloadLabel: text('payload_label'),
  payload: jsonb('payload').notNull(),
  status: handoffStatus('status').notNull().default('sent'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  rfqIdx: index('handoffs_rfq_idx').on(t.rfqId),
}));

export const handoffExceptions = pgTable('handoff_exceptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  handoffId: uuid('handoff_id').notNull().references(() => handoffs.id, { onDelete: 'cascade' }),
  severity: exceptionSeverity('severity').notNull().default('warn'),
  text: text('text').notNull(),
  open: boolean('open').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ------------------------------------------------------------ exceptions
// Compliance-level exceptions (best-ex deviation, concentration, overrides).
export const exceptions = pgTable('exceptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  ref: text('ref').notNull(),
  firmId: uuid('firm_id').notNull().references(() => firms.id),
  rfqId: uuid('rfq_id').references(() => rfqs.id, { onDelete: 'cascade' }),
  severity: exceptionSeverity('severity').notNull().default('warn'),
  text: text('text').notNull(),
  status: text('status').notNull(),
  open: boolean('open').notNull().default(true),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  firmIdx: index('exceptions_firm_idx').on(t.firmId),
}));

// ---------------------------------------------------------------- events
// Append-only legal record. Written in the same transaction as the state
// change via recordEvent(). Never updated, never deleted.
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  firmId: uuid('firm_id').notNull().references(() => firms.id),
  rfqId: uuid('rfq_id').references(() => rfqs.id, { onDelete: 'set null' }),
  type: eventType('type').notNull(),
  // Who acted: a user, or a dealer firm (via token), or the system.
  actorUserId: uuid('actor_user_id').references(() => users.id),
  actorDealerFirmId: uuid('actor_dealer_firm_id').references(() => firms.id),
  actorLabel: text('actor_label').notNull(), // denormalized for display
  summary: text('summary').notNull(),
  detail: jsonb('detail'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  firmIdx: index('events_firm_idx').on(t.firmId),
  rfqIdx: index('events_rfq_idx').on(t.rfqId),
  createdIdx: index('events_created_idx').on(t.createdAt),
}));

// ------------------------------------------------------------ relations
export const firmsRel = relations(firms, ({ many }) => ({
  users: many(users), rfqs: many(rfqs),
}));
export const rfqsRel = relations(rfqs, ({ one, many }) => ({
  firm: one(firms, { fields: [rfqs.firmId], references: [firms.id] }),
  requester: one(users, { fields: [rfqs.requesterId], references: [users.id] }),
  quotes: many(quotes),
  invited: many(rfqInvitedDealers),
  invitations: many(invitations),
  awards: many(awards),
  trades: many(trades),
}));
export const quotesRel = relations(quotes, ({ one }) => ({
  rfq: one(rfqs, { fields: [quotes.rfqId], references: [rfqs.id] }),
  dealer: one(firms, { fields: [quotes.dealerFirmId], references: [firms.id] }),
}));
export const invitationsRel = relations(invitations, ({ one }) => ({
  rfq: one(rfqs, { fields: [invitations.rfqId], references: [rfqs.id] }),
  dealer: one(firms, { fields: [invitations.dealerFirmId], references: [firms.id] }),
}));
