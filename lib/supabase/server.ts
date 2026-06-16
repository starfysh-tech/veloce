// lib/supabase/server.ts — server-side Supabase clients.
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { requireEnv } from '@/lib/env';

/**
 * Request-scoped client backed by the user's session cookie. Use in server
 * components and route handlers to read the authenticated buy-side user.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options));
          } catch {
            // set() throws in server components; middleware refreshes instead.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Bypasses RLS. SERVER-ONLY — never expose the key or
 * import this into a client component. Used for privileged operations like
 * resolving dealer tokens and minting invitations.
 */
export function createServiceRoleClient() {
  return createServiceClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
