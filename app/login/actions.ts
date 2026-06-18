// app/login/actions.ts — auth server actions (Decision 17).
// Two paths: email+password (demo-safe, no inbox dependency) and magic-link.
'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect('/dashboard');
}

export async function signInWithMagicLink(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || '';
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect('/login?sent=1');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
