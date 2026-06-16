// lib/env.ts — required env access with loud, specific failures.
// Use requireEnv() in any module that needs a value to function at all.
// The non-null assertion (process.env.FOO!) silently casts undefined into a
// downstream cryptic third-party error (e.g. "Your Supabase URL is required").
// requireEnv throws at the access site with the variable name in the message,
// so a fresh clone with a partial .env.local fails on the first request with
// a clear pointer.

const HINT =
  'Set it in .env.local (or .env). See the "Required env vars" section in CLAUDE.md.';

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}. ${HINT}`);
  }
  return value;
}
