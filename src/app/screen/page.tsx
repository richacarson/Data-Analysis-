import Link from 'next/link';
import { runScreen } from '@/lib/screen/run';
import { SLEEVES, sleeveByKey, ALL_SLEEVE_TICKERS } from '@/data/sleeves';
import { DEFAULT_HURDLE } from '@/lib/valuation/build';
import { getWatchlistSymbols } from '@/lib/watchlist';
import { marketLinks, sleeveMarketLink } from '@/lib/valuation/market';
import { getWeightBook } from '@/lib/sleeves/weights';
import { forwardPeYears } from '@/lib/valuation/house';
import { basketYears } from '@/lib/valuation/aggregate';
import { latestMarketSnapshot } from '@/lib/market/store';
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
  const [watchlist, book, market] = await Promise.all([
    getWatchlistSymbols(),
    getWeightBook(),
    latestMarketSnapshot().catch(() => null),
  ]);
  const onWatchlist = sleeveKey === 'watchlist';
  // A sleeve in the code, or one defined only by its weights (post-rebalance).
  const sleeve =
    sleeveKey && !onWatchlist ? (sleeveByKey(sleeveKey) ?? book.stored.find((s) => s.key === sleeveKey)) : undefined;
  const tickers = onWatchlist ? watchlist : sleeve ? sleeve.tickers : ALL_SLEEVE_TICKERS;
  const weightSet = sleeve ? book.weights.get(sleeve.key) : undefined;
  const weightOf = (symbol: string) => (weightSet ? (weightSet.bySymbol.get(symbol.toUpperCase()) ?? 0) : 1);

  const parsedHurdle = hurdleParam ? Number(hurdleParam) : NaN;
  const hurdle = Number.isFinite(parsedHurdle) && parsedHurdle > 0 ? parsedHurdle : DEFAULT_HURDLE;

  // An ETF sleeve is hundreds of names: its correlation comes from the fund's
  // own price rather than three years of prices for every holding.
  const etf = sleeve && 'etf' in sleeve ? (sleeve.etf as string | undefined) : undefined;
  const screened = await runScreen(tickers, { hurdle, correlation: !etf });
  const rows = weightSet ? screened.map((r) => ({ ...r, weight: weightOf(r.symbol) })) : screened;
  // The same cached price histories the rows used, combined into one portfolio.
  const portfolio = etf
    ? ((await marketLinks(etf).catch(() => null))?.threeYear ?? null)
    : await sleeveMarketLink(tickers, weightSet ? tickers.map(weightOf) : undefined).catch(() => null);

  /** Average of a field across rows that have it, by position weight (equal without weights). */
  const weightedMean = (pick: (r: (typeof rows)[number]) => number | null | undefined) => {
    let sum = 0;
    let weight = 0;
    for (const r of rows) {
      const v = pick(r);
      if (typeof v !== 'number') continue;
      sum += weightOf(r.symbol) * v;
      weight += weightOf(r.symbol);
    }
    return weight > 0 ? { value: sum / weight, weight } : null;
  };
  const totalWeight = rows.reduce((t, r) => t + weightOf(r.symbol), 0);
  const correlation = weightedMean((r) => r.correlation);
  // Non-payers count at 0%; a row that failed to load has no yield to count.
  const dividendYield = weightedMean((r) => (r.price ? r.dividendYield : null));
  const priced = rows.filter((r) => r.price);
  const equalYield = priced.length ? priced.reduce((t, r) => t + r.dividendYield, 0) / priced.length : null;
  const payers = priced.filter((r) => r.dividendYield > 0).length;
  const correlationCount = rows.filter((r) => typeof r.correlation === 'number').length;

  const scored = rows.filter((r) => r.expectedCagr !== null);
  // Implausible outputs (a currency mix-up, a broken feed) are kept out of
  // every count and the average rather than topping the ranking.
  const held = rows.filter((r) => r.review);
  // A pass that rests on one or two analysts is counted separately: FRHC
  // cleared on a single estimate, which is not the same claim as twenty.
  const thin = (r: (typeof rows)[number]) => r.analystCount > 0 && r.analystCount < 3;
  const clearing = scored.filter((r) => r.clearsHurdle && !thin(r));
  const clearingThin = scored.filter((r) => r.clearsHurdle && thin(r));
  // A sleeve returns the weighted average of its holdings, so that is the
  // headline; the equal-weighted figure and the median show what the weights do.
  const weighted = weightedMean((r) => r.expectedCagr);
  const average = weighted?.value ?? null;
  const equalAverage = scored.length > 0 ? scored.reduce((sum, r) => sum + r.expectedCagr!, 0) / scored.length : null;
  const clearingWeight = clearing.reduce((t, r) => t + weightOf(r.symbol), 0);
  const weightNote = weightSet
    ? `Weighted to ${weightSet.source ?? 'stored weights'}${weightSet.asOf ? `, as of ${weightSet.asOf}` : ''}`
    : sleeve || !onWatchlist
      ? 'Equal-weighted: no position weights loaded for this view'
      : 'Equal-weighted';
  const median =
    scored.length > 0
      ? [...scored].sort((a, b) => a.expectedCagr! - b.expectedCagr!)[
          Math.floor(scored.length / 2)
        ].expectedCagr
      : null;

  /*
   * The sleeve's forward P/E and earnings growth by fiscal year, built the way
   * index P/Es are (total value over total earnings, by weight), beside the
   * S&P 500's from the latest daily snapshot.
   */
  const peYears = forwardPeYears(new Date());
  const baseYear = String(Number(peYears[0]) - 1);
  const forwardPe = basketYears(
    rows
      .filter((r) => r.price && r.forwardPe)
      .map((r) => ({
        symbol: r.symbol,
        weight: weightOf(r.symbol),
        price: r.price!,
        eps: new Map(
          [r.forwardPeBase, ...(r.forwardPe ?? [])]
            .filter((f): f is NonNullable<typeof f> => !!f && f.eps !== null)
            .map((f) => [f.fiscalYear, f.eps!]),
        ),
      })),
    [baseYear, ...peYears],
  ).slice(1);
  const marketYear = (year: string) => market?.years.find((y) => y.year === year) ?? null;

  return (
    <div className="space-y-4">
      <div className="panel px-4 py-4 sm:px-5">
        <p className="eyebrow">Portfolio screen</p>
        <h1 className="mt-1.5 font-serif text-[24px] tracking-tight text-t1">
          {onWatchlist ? 'Watchlist' : sleeve ? sleeve.name : 'All sleeves'}
        </h1>
        <p className="mt-1 text-[12px] text-t3">{weightNote}</p>
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
          {book.stored.map((s) => (
            <Link
              key={s.key}
              href={`/screen?sleeve=${s.key}`}
              className={`shrink-0 border px-3 py-1.5 text-[12px] font-medium ${
                sleeve?.key === s.key ? 'border-lineActive text-gold' : 'border-line bg-card text-t2 hover:text-gold'
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

      <div className="panel stat-grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <Stat label={onWatchlist ? 'Names screened' : 'Holdings screened'} value={String(tickers.length)} sub={`${scored.length} with usable estimates`} />
        <Stat
          label={`Clear ${(hurdle * 100).toFixed(0)}%`}
          value={String(clearing.length)}
          tone={clearing.length - scored.length / 2}
          sub={
            scored.length
              ? `${
                  weightSet
                    ? `${((clearingWeight / totalWeight) * 100).toFixed(0)}% of the sleeve's weight`
                    : `${((clearing.length / scored.length) * 100).toFixed(0)}% of scored`
                }${clearingThin.length ? ` · ${clearingThin.length} more on fewer than 3 analysts` : ''}`
              : undefined
          }
        />
        <Stat
          label={weightSet ? 'Weighted expected CAGR' : 'Average expected CAGR'}
          value={average !== null ? `${(average * 100).toFixed(1)}%` : '—'}
          tone={average !== null ? average - hurdle : undefined}
          sub={
            median === null ? undefined : (
              <>
                <span className="block">
                  {weightSet && weighted && equalAverage !== null
                    ? `${((weighted.weight / totalWeight) * 100).toFixed(0)}% of weight scored · equal-weighted ${(equalAverage * 100).toFixed(1)}% · median ${(median * 100).toFixed(1)}%`
                    : `Equal-weighted across ${scored.length} scored · median ${(median * 100).toFixed(1)}%`}
                </span>
                {market?.expected?.average != null ? (
                  <span className="block">S&amp;P 500 {(market.expected.average * 100).toFixed(1)}% by value</span>
                ) : null}
              </>
            )
          }
        />
        <Stat
          label="Correlation to S&P 500"
          value={etf ? (portfolio ? portfolio.correlation.toFixed(2) : '—') : correlation ? correlation.value.toFixed(2) : '—'}
          sub={
            etf
              ? portfolio
                ? `${etf} itself, weekly returns over 3 years · beta ${portfolio.beta.toFixed(2)}`
                : undefined
              : portfolio
                ? `${weightSet ? 'Weighted average' : 'Average'} of ${correlationCount} · as one portfolio ${portfolio.correlation.toFixed(2)}, beta ${portfolio.beta.toFixed(2)}`
                : correlationCount
                  ? `Average of ${correlationCount}, weekly returns over 3 years`
                  : undefined
          }
        />
        <Stat
          label={weightSet ? 'Weighted dividend yield' : 'Dividend yield'}
          value={dividendYield ? `${(dividendYield.value * 100).toFixed(2)}%` : '—'}
          sub={
            dividendYield
              ? `${weightSet && equalYield !== null ? `Equal-weighted ${(equalYield * 100).toFixed(2)}% · ` : weightSet ? '' : 'Equal-weighted · '}${payers} of ${priced.length} pay a dividend · forward`
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

      <div className="panel stat-grid grid-cols-2 md:grid-cols-4">
        {forwardPe.map((f) => {
          const m = marketYear(f.year);
          const gap = f.pe && m?.pe ? f.pe / m.pe - 1 : null;
          return (
            <Stat
              key={f.year}
              label={`FY${f.year} P/E · ${weightSet ? 'weighted avg' : 'average'}`}
              value={f.pe !== null ? `${f.pe.toFixed(1)}×` : '—'}
              sub={
                f.count ? (
                  <>
                    {m?.pe ? (
                      <span className="block">
                        S&amp;P 500 {m.pe.toFixed(1)}×
                        {gap !== null ? ` · ${Math.abs(gap * 100).toFixed(0)}% ${gap < 0 ? 'below' : 'above'}` : ''}
                      </span>
                    ) : null}
                    {f.growth !== null ? (
                      <span className="block">
                        EPS growth {f.growth >= 0 ? '+' : ''}
                        {(f.growth * 100).toFixed(1)}%
                        {m?.growth != null ? ` · S&P ${m.growth >= 0 ? '+' : ''}${(m.growth * 100).toFixed(1)}%` : ''}
                      </span>
                    ) : null}
                    <span className="block">
                      {f.count} with consensus{f.losses ? ` · ${f.losses} at a loss` : ''}
                    </span>
                  </>
                ) : (
                  'No consensus this far out'
                )
              }
            />
          );
        })}
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
