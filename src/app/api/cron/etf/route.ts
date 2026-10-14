import { NextResponse, type NextRequest } from 'next/server';
import { ETF_FUNDS } from '@/lib/etf/ishares';
import { refreshEtfSleeve } from '@/lib/etf/refresh';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Refreshes the ETF sleeves (DVY, IUSG) from the funds' published holdings.
 * ?dry=1 reports what would be saved; ?symbol=DVY does one fund.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const dry = request.nextUrl.searchParams.get('dry') === '1';
  const only = request.nextUrl.searchParams.get('symbol')?.toUpperCase();
  const funds = ETF_FUNDS.filter((f) => !only || f.symbol === only);

  const results = [];
  for (const [i, fund] of funds.entries()) {
    try {
      results.push(await refreshEtfSleeve(fund, 20 + ETF_FUNDS.indexOf(fund), dry));
    } catch (error) {
      results.push({ symbol: fund.symbol, error: error instanceof Error ? error.message : String(error), index: i });
    }
  }
  return NextResponse.json({ dry, results });
}
