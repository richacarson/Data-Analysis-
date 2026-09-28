import { NextResponse, type NextRequest } from 'next/server';
import { ALL_SLEEVE_TICKERS } from '@/data/sleeves';
import { getEstimates } from '@/lib/fmp/endpoints';
import { snapshotRows, type SnapshotRow } from '@/lib/estimates/revisions';
import { canRecord, recordSnapshots, trackedSymbols } from '@/lib/estimates/store';
import { pooled } from '@/lib/screen/run';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Records today's consensus for every holding and every stock opened in the
 * past 90 days. Vercel Cron calls this daily with `Authorization: Bearer
 * $CRON_SECRET`; nothing else can.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  if (!canRecord()) return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 });

  const started = Date.now();
  const symbols = [...new Set([...ALL_SLEEVE_TICKERS, ...(await trackedSymbols())].map((s) => s.toUpperCase()))];
  const failed: string[] = [];
  let skipped = 0;

  const rows = (
    await pooled(symbols, 8, async (symbol): Promise<SnapshotRow[]> => {
      // Leave time to write what was fetched rather than time out holding it.
      if (Date.now() - started > 240_000) {
        skipped++;
        return [];
      }
      try {
        return snapshotRows(symbol, await getEstimates(symbol, 'annual', 10));
      } catch {
        failed.push(symbol);
        return [];
      }
    })
  ).flat();

  let written = 0;
  for (let i = 0; i < rows.length; i += 500) written += await recordSnapshots(rows.slice(i, i + 500));

  return NextResponse.json({
    symbols: symbols.length,
    written,
    failed,
    skipped,
    seconds: Math.round((Date.now() - started) / 1000),
  });
}
