// lib/supabase/client.ts — browser Supabase client.
// Uses the anon key. The ONLY thing the client is allowed to do is subscribe
// to Realtime quote updates on the buy-side board (Decision 9). All reads and
// writes go through server route handlers, never this client.
'use client';
import { createBrowserClient } from '@supabase/ssr';

// Next.js statically replaces `process.env.NEXT_PUBLIC_*` at build time, but
// only for *literal* property access — dynamic access like `process.env[name]`
// (what lib/env.ts:requireEnv does) returns undefined in the browser bundle
// because `process.env` is stubbed to {}. So this file uses the literal form
// directly; lib/env.ts is still used on the server side where dynamic access
// works.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in the client bundle. ' +
        'These must be set at build time, not just runtime.',
    );
  }
  return createBrowserClient(url, anonKey);
}
