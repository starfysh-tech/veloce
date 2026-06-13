import type { Config } from 'drizzle-kit';

// Migrations run against the dev DATABASE_URL (Supabase pooled connection).
// Randall runs `npm run db:migrate` locally; this file is never given prod creds.
export default {
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
  verbose: true,
  strict: true,
} satisfies Config;
