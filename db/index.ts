// db/index.ts — server-only Drizzle client over the Supabase pooled connection.
// Uses the postgres-js HTTP-friendly driver. Never imported by client code.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Add it in Vercel env vars (Supabase pooled connection, port 6543).');
}

// prepare:false is required for the Supabase transaction pooler.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export { schema };
