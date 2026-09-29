import { NextResponse, type NextRequest } from 'next/server';
import { ALL_SLEEVE_TICKERS } from '@/data/sleeves';
import { runScreen } from '@/lib/screen/run';
import { trackedSymbols } from '@/lib/estimates/store';

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
  // Holdings first, then watchlist names and anything opened recently.
  const extra = await trackedSymbols().catch(() => []);
  const symbols = [...new Set([...ALL_SLEEVE_TICKERS, ...extra.map((s) => s.toUpperCase())])];
  const rows = await runScreen(symbols);
  // ?report=growth-cap lists every name the fast-grower cap changed, before and after.
  if (request.nextUrl.searchParams.get('report') === 'growth-cap') {
    const changed = rows
      .filter((r) => r.growthCapped && r.beforeGrowthCap)
      .map((r) => ({
        symbol: r.symbol,
        epsGrowth: r.epsGrowthToHorizon,
        exitBefore: r.beforeGrowthCap!.exitPe,
        exitAfter: r.exitPe,
        cagrBefore: r.beforeGrowthCap!.totalCagr,
        cagrAfter: r.expectedCagr,
        horizon: r.horizonFiscalYear,
      }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
    return NextResponse.json({ symbols: rows.length, scored: rows.filter((r) => r.expectedCagr !== null).length, changed });
  }
  return NextResponse.json({
    symbols: rows.length,
    scored: rows.filter((r) => r.expectedCagr !== null).length,
    unfinished: rows.filter((r) => r.note?.startsWith('Still loading')).length,
    seconds: Math.round((Date.now() - started) / 1000),
  });
}
