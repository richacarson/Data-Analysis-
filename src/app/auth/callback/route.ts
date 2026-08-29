import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Completes a magic-link sign-in by exchanging the one-time code for a session
 * cookie, then returns the visitor to wherever they were originally headed.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  // Only allow same-site redirects — an attacker-supplied absolute URL here
  // would turn the sign-in flow into an open redirect.
  const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?reason=missing-code`);
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/auth/error?reason=not-configured`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/auth/error?reason=exchange-failed`);
  }

  return NextResponse.redirect(`${origin}${destination}`);
}
