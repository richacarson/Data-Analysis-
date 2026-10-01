import { after, NextResponse, type NextRequest } from 'next/server';
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
  // A cold run is more requests than one invocation's time allows (every
  // holding's peers and three years of prices). What finished is cached, so a
  // follow-up pass picks up where this one stopped.
  const unfinished = rows.filter((r) => r.note?.startsWith('Still loading')).length;
  const pass = Number(request.nextUrl.searchParams.get('pass') ?? '1');
  if (unfinished > 0 && pass < 4) {
    const next = new URL(request.nextUrl);
    next.searchParams.set('pass', String(pass + 1));
    // Only the hand-off is awaited: the next pass runs in its own invocation
    // with its own time limit, so this one need not wait for it to finish.
    after(() =>
      fetch(next, { headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(10_000) }).catch(
        () => undefined,
      ),
    );
  }
  return NextResponse.json({
    pass,
    symbols: rows.length,
    scored: rows.filter((r) => r.expectedCagr !== null).length,
    unfinished: rows.filter((r) => r.note?.startsWith('Still loading')).length,
    seconds: Math.round((Date.now() - started) / 1000),
  });
}
