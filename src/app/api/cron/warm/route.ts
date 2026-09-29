import { NextResponse, type NextRequest } from 'next/server';
import { ALL_SLEEVE_TICKERS } from '@/data/sleeves';
import { runScreen } from '@/lib/screen/run';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Runs the full screen before the US open so the first visit of the day reads
 * from cache. Pricing every holding's peers adds several hundred requests to a
 * cold run; paying them here keeps the Screen page quick.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const started = Date.now();
  const rows = await runScreen(ALL_SLEEVE_TICKERS);
  return NextResponse.json({
    symbols: rows.length,
    scored: rows.filter((r) => r.expectedCagr !== null).length,
    unfinished: rows.filter((r) => r.note?.startsWith('Still loading')).length,
    seconds: Math.round((Date.now() - started) / 1000),
  });
}
