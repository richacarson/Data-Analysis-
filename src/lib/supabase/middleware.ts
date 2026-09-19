import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Paths reachable without a session. Everything else requires sign-in. */
const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/confirm', '/auth/error'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase session and enforces the sign-in gate.
 *
 * Every valuation page spends paid FMP API calls, so an unauthenticated visitor
 * must never reach one.
 */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;

  if (!url || !key) {
    // Without Supabase there is no way to authenticate anyone. Locally that
    // should not block development, but a deployed instance must not serve the
    // API to the open internet just because it was misconfigured.
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse(
        'Authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
        { status: 503, headers: { 'content-type': 'text/plain' } },
      );
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser revalidates the token with Supabase; getSession only reads the
  // cookie and can be spoofed, so it must not be used for an access decision.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    // Send the visitor back where they were headed after signing in.
    redirect.searchParams.set('next', pathname + request.nextUrl.search);
    return NextResponse.redirect(redirect);
  }

  // A signed-in user has no reason to sit on the sign-in page.
  if (user && pathname === '/login') {
    const home = request.nextUrl.clone();
    home.pathname = '/';
    home.search = '';
    return NextResponse.redirect(home);
  }

  return response;
}
