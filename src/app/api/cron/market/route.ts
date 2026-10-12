import { after, NextResponse, type NextRequest } from 'next/server';
import { buildSp500Snapshot } from '@/lib/market/sp500';
import { recordMarketSnapshot } from '@/lib/market/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Records the day's S&P 500 snapshot after the close. A cold run is about 510
 * requests; if one invocation runs out of time, what it fetched is cached and
 * the next pass (chained, up to three) finishes from there.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const started = Date.now();
  const pass = Number(request.nextUrl.searchParams.get('pass') ?? '1');
  const snapshot = await buildSp500Snapshot(started + 240_000);

  if (!snapshot) {
    if (pass < 3) {
      const next = new URL(request.nextUrl);
      next.searchParams.set('pass', String(pass + 1));
      after(() =>
        fetch(next, { headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(10_000) }).catch(
          () => undefined,
        ),
      );
    }
    return NextResponse.json({ pass, recorded: false, seconds: Math.round((Date.now() - started) / 1000) });
  }

  // ?dry=1 returns the snapshot without saving it, for checking the figures.
  if (request.nextUrl.searchParams.get('dry') === '1') return NextResponse.json(snapshot);
  await recordMarketSnapshot(snapshot);
  return NextResponse.json({
    pass,
    recorded: snapshot.asOf,
    members: snapshot.members,
    used: snapshot.used,
    years: snapshot.years.map((y) => ({ year: y.year, pe: y.pe && Number(y.pe.toFixed(2)), growth: y.growth })),
    seconds: Math.round((Date.now() - started) / 1000),
  });
}
