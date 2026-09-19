'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Completes a magic-link sign-in.
 *
 * Supabase can deliver the session three different ways depending on the flow
 * the project and email template use, and only the browser can see two of them:
 *
 *   #access_token=…&refresh_token=…   implicit flow, in the URL fragment
 *   ?code=…                           PKCE flow
 *   ?token_hash=…&type=…              server-verifiable OTP
 *
 * Handling all three means sign-in works regardless of how the project is
 * configured, rather than depending on a template we cannot change from code.
 */
export function ConfirmSignIn() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [error, setError] = useState<string | null>(null);
  // React runs effects twice in development; the codes here are single-use.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!supabase) {
      setError('Authentication is not configured for this deployment.');
      return;
    }

    void (async () => {
      const url = new URL(window.location.href);
      const query = url.searchParams;
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''));

      // Supabase reports a refusal (expired or already-used link) in whichever
      // half of the URL it used, so check both before trying to redeem it.
      const failure = hash.get('error_description') ?? query.get('error_description');
      if (failure) {
        setError(failure);
        return;
      }

      const next = query.get('next');
      const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');
      const code = query.get('code');
      const tokenHash = query.get('token_hash');
      const type = query.get('type');

      try {
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as 'magiclink' | 'email' | 'signup' | 'recovery' | 'invite',
          });
          if (error) throw error;
        } else {
          setError('That sign-in link was incomplete. Links can only be used once.');
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'That link has expired or was already used.');
        return;
      }

      // Drop the tokens from the address bar before moving on, so the session
      // is not left sitting in browser history.
      window.history.replaceState({}, '', '/auth/confirm');
      router.replace(destination);
      router.refresh();
    })();
  }, [supabase, router]);

  if (error) {
    return (
      <div className="mx-auto max-w-md py-20">
        <div className="panel px-6 py-7">
          <h1 className="text-[18px] font-semibold">Could not sign you in</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{error}</p>
          <Link
            href="/login"
            className="mt-5 inline-block rounded-md bg-accent px-3 py-2 text-[13px] font-medium text-white"
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-20">
      <div className="panel px-6 py-7">
        <h1 className="text-[18px] font-semibold">Signing you in…</h1>
        <p className="mt-2 text-[13px] text-muted">One moment.</p>
      </div>
    </div>
  );
}
