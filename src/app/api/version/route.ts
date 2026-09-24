import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** The deployed build, so an open app can tell it is running an older one. */
export function GET() {
  return NextResponse.json(
    { version: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev' },
    { headers: { 'cache-control': 'no-store' } },
  );
}
