import Link from 'next/link';
import { runScreen } from '@/lib/screen/run';
import { SLEEVES, sleeveByKey, ALL_SLEEVE_TICKERS } from '@/data/sleeves';
import { DEFAULT_HURDLE } from '@/lib/valuation/build';
import { getWatchlistSymbols } from '@/lib/watchlist';
import { sleeveMarketLink } from '@/lib/valuation/market';
import { Panel, Stat } from '@/components/ui';
import { ScreenTable } from '@/components/ScreenTable';

// A full sleeve is a few hundred API calls; an hour of cache keeps it usable.
export const revalidate = 3600;

/*
 * The 154-holding screen is roughly 620 requests. The FMP client paces them to
 * stay inside the key's per-minute allowance, so a cold run takes a minute or
 * so; the limit is raised to cover it. Warm runs are served from cache.
 */
export const maxDuration = 300;

export const metadata = { title: 'Screen — Equity Lens' };

export default async function ScreenPage({
  searchParams,
}: {
  searchParams: Promise<{ sleeve?: string; hurdle?: string }>;
}) {
  const { sleeve: sleeveKey, hurdle: hurdleParam } = await searchParams;
  const watchlist = await getWatchlistSymbols();
  const onWatchlist = sleeveKey === 'watchlist';
  const sleeve = sleeveKey && !onWatchlist ? sleeveByKey(sleeveKey) : undefined;
  const tickers = onWatchlist ? watchlist : sleeve ? sleeve.tickers : ALL_SLEEVE_TICKERS;

  const parsedHurdle = hurdleParam ? Number(hurdleParam) : NaN;
  const hurdle = Number.isFinite(parsedHurdle) && parsedHurdle > 0 ? parsedHurdle : DEFAULT_HURDLE;

  const rows = await runScreen(tickers, { hurdle });
  // The same cached price histories the rows used, combined into one portfolio.
  const portfolio = await sleeveMarketLink(tickers).catch(() => null);
  const correlations = rows.map((r) => r.correlation).filter((c): c is number => typeof c === 'number');
  const averageCorrelation = correlations.length
    ? correlations.reduce((t, c) => t + c, 0) / correlations.length
    : null;

  const scored = rows.filter((r) => r.expectedCagr !== null);
  // Implausible outputs (a currency mix-up, a broken feed) are kept out of
  // every count and the average rather than topping the ranking.
  const held = rows.filter((r) => r.review);
  // A pass that rests on one or two analysts is counted separately: FRHC
  // cleared on a single estimate, which is not the same claim as twenty.
  const thin = (r: (typeof rows)[number]) => r.analystCount > 0 && r.analystCount < 3;
  const clearing = scored.filter((r) => r.clearsHurdle && !thin(r));
  const clearingThin = scored.filter((r) => r.clearsHurdle && thin(r));
  // An equal-weighted sleeve returns the average of its holdings, so that is
  // the headline; the median beside it shows whether a few names skew it.
  const average = scored.length > 0 ? scored.reduce((sum, r) => sum + r.expectedCagr!, 0) / scored.length : null;
  const median =
    scored.length > 0
      ? [...scored].sort((a, b) => a.expectedCagr! - b.expectedCagr!)[
          Math.floor(scored.length / 2)
        ].expectedCagr
      : null;

  return (
    <div className="space-y-4">
      <div className="panel px-4 py-4 sm:px-5">
        <p className="eyebrow">Portfolio screen</p>
        <h1 className="mt-1.5 font-serif text-[24px] tracking-tight text-t1">
          {onWatchlist ? 'Watchlist' : sleeve ? sleeve.name : 'All sleeves'}
        </h1>
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:px-0">
          <Link
            href="/screen"
            className={`shrink-0 border px-3 py-1.5 text-[12px] font-medium ${
              !sleeve && !onWatchlist ? 'border-lineActive text-gold' : 'border-line bg-card text-t2 hover:text-gold'
            }`}
          >
            All ({ALL_SLEEVE_TICKERS.length})
          </Link>
          {SLEEVES.map((s) => (
            <Link
              key={s.key}
              href={`/screen?sleeve=${s.key}`}
              className={`shrink-0 border px-3 py-1.5 text-[12px] font-medium ${
                sleeve?.key === s.key
                  ? 'border-lineActive text-gold'
                  : 'border-line bg-card text-t2 hover:text-gold'
              }`}
            >
              {s.name} ({s.tickers.length})
            </Link>
          ))}
          {watchlist.length > 0 && (
            <Link
              href="/screen?sleeve=watchlist"
              className={`shrink-0 border px-3 py-1.5 text-[12px] font-medium ${
                onWatchlist ? 'border-lineActive text-gold' : 'border-line bg-card text-t2 hover:text-gold'
              }`}
            >
              Watchlist ({watchlist.length})
            </Link>
          )}
        </div>
      </div>

      <div className="panel stat-grid md:grid-cols-5">
        <Stat label={onWatchlist ? 'Names screened' : 'Holdings screened'} value={String(tickers.length)} sub={`${scored.length} with usable estimates`} />
        <Stat
          label={`Clear ${(hurdle * 100).toFixed(0)}%`}
          value={String(clearing.length)}
          tone={clearing.length - scored.length / 2}
          sub={
            scored.length
              ? `${((clearing.length / scored.length) * 100).toFixed(0)}% of scored${
                  clearingThin.length ? ` · ${clearingThin.length} more on fewer than 3 analysts` : ''
                }`
              : undefined
          }
        />
        <Stat
          label="Average expected CAGR"
          value={average !== null ? `${(average * 100).toFixed(1)}%` : '—'}
          tone={average !== null ? average - hurdle : undefined}
          sub={
            median !== null
              ? `Equal-weighted across ${scored.length} scored · median ${(median * 100).toFixed(1)}%`
              : undefined
          }
        />
        <Stat
          label="Correlation to S&P 500"
          value={averageCorrelation !== null ? averageCorrelation.toFixed(2) : '—'}
          sub={
            portfolio
              ? `Average of ${correlations.length} · as one portfolio ${portfolio.correlation.toFixed(2)}, beta ${portfolio.beta.toFixed(2)}`
              : correlations.length
                ? `Average of ${correlations.length}, weekly returns over 3 years`
                : undefined
          }
        />
        <Stat
          label="Not scored"
          value={String(rows.length - scored.length)}
          sub={
            held.length
              ? `${held.length} held for review · the rest lack consensus, price or a usable multiple`
              : 'No consensus, price or usable multiple'
          }
        />
      </div>

      <Panel
        eyebrow="Ranked"
        title="Expected 3-year total return"
        subtitle="Same calculation as each stock page: median of own, peer and justified P/E"
      >
        <ScreenTable rows={rows} hurdle={hurdle} />
      </Panel>
    </div>
  );
}
