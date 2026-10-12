import Link from 'next/link';
import { runScreen } from '@/lib/screen/run';
import { SLEEVES, sleeveByKey, ALL_SLEEVE_TICKERS } from '@/data/sleeves';
import { DEFAULT_HURDLE } from '@/lib/valuation/build';
import { getWatchlistSymbols } from '@/lib/watchlist';
import { sleeveMarketLink } from '@/lib/valuation/market';
import { getWeightBook } from '@/lib/sleeves/weights';
import { forwardPeYears } from '@/lib/valuation/house';
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
  const [watchlist, book] = await Promise.all([getWatchlistSymbols(), getWeightBook()]);
  const onWatchlist = sleeveKey === 'watchlist';
  // A sleeve in the code, or one defined only by its weights (post-rebalance).
  const sleeve =
    sleeveKey && !onWatchlist ? (sleeveByKey(sleeveKey) ?? book.stored.find((s) => s.key === sleeveKey)) : undefined;
  const tickers = onWatchlist ? watchlist : sleeve ? sleeve.tickers : ALL_SLEEVE_TICKERS;
  const weightSet = sleeve ? book.weights.get(sleeve.key) : undefined;
  const weightOf = (symbol: string) => (weightSet ? (weightSet.bySymbol.get(symbol.toUpperCase()) ?? 0) : 1);

  const parsedHurdle = hurdleParam ? Number(hurdleParam) : NaN;
  const hurdle = Number.isFinite(parsedHurdle) && parsedHurdle > 0 ? parsedHurdle : DEFAULT_HURDLE;

  const screened = await runScreen(tickers, { hurdle });
  const rows = weightSet ? screened.map((r) => ({ ...r, weight: weightOf(r.symbol) })) : screened;
  // The same cached price histories the rows used, combined into one portfolio.
  const portfolio = await sleeveMarketLink(tickers, weightSet ? tickers.map(weightOf) : undefined).catch(() => null);

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
   * The sleeve's forward P/E by fiscal year. The average is harmonic (total
   * price over total earnings, by weight), the way index P/Es are built: a
   * plain mean of P/Es lets one 90x name pull the figure far off what the
   * sleeve pays for its earnings. Loss years have no P/E and are counted aside.
   */
  const forwardPe = forwardPeYears(new Date()).map((year) => {
    const pes: Array<{ pe: number; w: number }> = [];
    let losses = 0;
    for (const r of rows) {
      const f = r.forwardPe?.find((p) => p.fiscalYear === year);
      if (!f || f.eps === null) continue;
      if (f.pe === null) losses += 1;
      else pes.push({ pe: f.pe, w: weightOf(r.symbol) });
    }
    const w = pes.reduce((t, p) => t + p.w, 0);
    const inverse = pes.reduce((t, p) => t + p.w / p.pe, 0);
    return { year, average: w > 0 && inverse > 0 ? w / inverse : null, count: pes.length, losses };
  });

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

      <div className="panel stat-grid md:grid-cols-5">
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
            median === null
              ? undefined
              : weightSet && weighted && equalAverage !== null
                ? `${((weighted.weight / totalWeight) * 100).toFixed(0)}% of weight scored · equal-weighted ${(equalAverage * 100).toFixed(1)}% · median ${(median * 100).toFixed(1)}%`
                : `Equal-weighted across ${scored.length} scored · median ${(median * 100).toFixed(1)}%`
          }
        />
        <Stat
          label="Correlation to S&P 500"
          value={correlation ? correlation.value.toFixed(2) : '—'}
          sub={
            portfolio
              ? `${weightSet ? 'Weighted average' : 'Average'} of ${correlationCount} · as one portfolio ${portfolio.correlation.toFixed(2)}, beta ${portfolio.beta.toFixed(2)}`
              : correlationCount
                ? `Average of ${correlationCount}, weekly returns over 3 years`
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
        {forwardPe.map((f) => (
          <Stat
            key={f.year}
            label={`FY${f.year} P/E · ${weightSet ? 'weighted avg' : 'average'}`}
            value={f.average !== null ? `${f.average.toFixed(1)}×` : '—'}
            sub={
              f.count
                ? `${f.count} with consensus${f.losses ? ` · ${f.losses} at a loss` : ''}`
                : 'No consensus this far out'
            }
          />
        ))}
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
