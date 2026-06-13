// lib/supabase/client.ts — browser Supabase client.
// Uses the anon key. The ONLY thing the client is allowed to do is subscribe
// to Realtime quote updates on the buy-side board (Decision 9). All reads and
// writes go through server route handlers, never this client.
'use client';
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
