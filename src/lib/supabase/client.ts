'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client. Uses the publishable key, which is safe to ship to
 * the client — every table is protected by row level security keyed on auth.uid().
 *
 * Returns null when the environment is not configured, so the app still runs
 * as a pure valuation tool without a database attached.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createBrowserClient(url, key, {
    auth: {
      // PKCE is the stronger flow, but it keeps a one-time verifier in the
      // storage of the browser that requested the link. People read email in a
      // mail app and tap the link in its in-app browser, which has its own
      // storage, so the verifier is simply not there and sign-in can never
      // complete. The implicit flow carries the session in the URL fragment
      // instead, so the link works wherever it is opened. /auth/confirm strips
      // those tokens out of the address bar immediately afterwards.
      flowType: 'implicit',
    },
  });
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
