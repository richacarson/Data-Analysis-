import 'server-only';

import {
  getAnnualRatios,
  getBatchQuotes,
  getDividends,
  getEarningsHistory,
  getEstimates,
  getFxRate,
} from '../fmp/endpoints';
import { forwardDividend } from '../valuation/dividends';
import { adjustedPeHistory, annualAdjustedEps } from '../valuation/earnings-basis';
import { fiscalYearLabeler, forwardEstimates, pickCoveredHorizon } from '../valuation/fiscal';
import { expectedReturn, implausibleReturn, requiredExitMultiple } from '../valuation/expected-return';
import { exitMultipleAnchors } from '../valuation/exit-multiple';
import { DEFAULT_HORIZON_YEARS, DEFAULT_HURDLE } from '../valuation/build';

export interface ScreenRow {
  symbol: string;
  price: number | null;
  epsAtHorizon: number | null;
  horizonFiscalYear: string | null;
  analystCount: number;
  exitPe: number | null;
  exitPeSource: string | null;
  ownMedianPe: number | null;
  dividendYield: number;
  expectedCagr: number | null;
  requiredExitPe: number | null;
  /** How far the required multiple sits above the anchor — the stretch. */
  stretch: number | null;
  clearsHurdle: boolean | null;
  /** Anchors more than a factor of two apart; the chosen multiple is doing real work. */
  anchorsDisagree: boolean;
  /** Why the horizon is shorter than asked: the nearer year lacked coverage. */
  horizonNote?: string;
  /** Held out of the ranking: the output is implausible and needs a look. */
  review?: string;
  /** Reporting currency, where it differs from the dollar quote. */
  convertedFrom?: string;
  note?: string;
}

/**
 * Runs promises with a ceiling on concurrency.
 *
 * A screen over every holding is a few hundred requests; firing them all at
 * once gets the key rate-limited and the run comes back half empty.
 */
async function pooled<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function drain(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, drain));
  return results;
}

/**
 * Expected return for every ticker given.
 *
 * Deliberately lighter than the full valuation: prices arrive in batched calls
 * and each ticker costs four more, so a 154-holding screen is a few hundred
 * requests rather than two thousand.
 */
export async function runScreen(
  symbols: string[],
  options: { horizonYears?: number; hurdle?: number } = {},
): Promise<ScreenRow[]> {
  const horizonYears = options.horizonYears ?? DEFAULT_HORIZON_YEARS;
  const hurdle = options.hurdle ?? DEFAULT_HURDLE;

  const prices = new Map<string, number>();
  for (let i = 0; i < symbols.length; i += 50) {
    const chunk = symbols.slice(i, i + 50);
    try {
      for (const q of await getBatchQuotes(chunk)) prices.set(q.symbol, q.price);
    } catch {
      // A failed chunk leaves those rows without a price rather than failing
      // the whole screen.
    }
  }

  // One rate per reporting currency, shared across the run.
  const fx = new Map<string, Promise<number | null>>();
  const rateToUsd = (currency: string) => {
    if (!fx.has(currency)) fx.set(currency, getFxRate(currency, 'USD'));
    return fx.get(currency)!;
  };

  return pooled(symbols, 12, async (symbol): Promise<ScreenRow> => {
    const base: ScreenRow = {
      symbol,
      price: prices.get(symbol) ?? null,
      epsAtHorizon: null,
      horizonFiscalYear: null,
      analystCount: 0,
      exitPe: null,
      exitPeSource: null,
      ownMedianPe: null,
      dividendYield: 0,
      expectedCagr: null,
      requiredExitPe: null,
      stretch: null,
      clearsHurdle: null,
      anchorsDisagree: false,
    };

    try {
      const [estimates, annual, dividends, earnings] = await Promise.all([
        getEstimates(symbol, 'annual', 10),
        getAnnualRatios(symbol, 10),
        getDividends(symbol).catch(() => []),
        getEarningsHistory(symbol, 44).catch(() => []),
      ]);

      /*
       * ADRs report in their home currency while the quote is in dollars:
       * Taiwan Semiconductor's consensus arrives in New Taiwan dollars. The
       * estimate is converted before it meets the price. The adjusted P/E
       * history is skipped for them too — the earnings feed's currency is not
       * dependable for ADRs — and FMP's own P/E, a ratio, is used instead.
       */
      const reportedCurrency = (annual.find((r) => r.reportedCurrency)?.reportedCurrency ?? 'USD').toUpperCase();
      const foreign = reportedCurrency !== 'USD';
      const rate = foreign ? await rateToUsd(reportedCurrency) : 1;

      // Same fiscal-year handling as the stock page, so the two agree.
      const fiscalYearEnds = annual.map((r) => ({ date: r.date, fiscalYear: r.fiscalYear }));
      const fiscalYearOf = fiscalYearLabeler(fiscalYearEnds);
      const lastReported = annual.reduce<string | null>(
        (latest, r) => (latest === null || r.date > latest ? r.date : latest),
        null,
      );
      const chosen = pickCoveredHorizon(forwardEstimates(estimates, lastReported), horizonYears);
      const horizon = chosen?.estimate ?? null;
      const years = chosen?.years ?? horizonYears;
      const horizonNote = chosen?.skipped
        ? `FY${fiscalYearOf(chosen.skipped.estimate.date)} has ${chosen.skipped.analysts} analyst${chosen.skipped.analysts === 1 ? '' : 's'}; using FY${horizon ? fiscalYearOf(horizon.date) : ''}`
        : undefined;

      // Consensus is adjusted, so the historical multiple is too where the
      // quarterly history allows; the ratios feed's P/E is GAAP.
      const adjustedPes = adjustedPeHistory(
        annual
          .filter((r) => r.priceToEarningsRatio * r.netIncomePerShare > 0)
          .map((r) => ({
            year: fiscalYearOf(r.date),
            price: r.priceToEarningsRatio * r.netIncomePerShare,
          })),
        annualAdjustedEps(earnings, fiscalYearEnds),
      );
      const anchors = exitMultipleAnchors({
        ownHistory:
          !foreign && adjustedPes.length >= 3 ? adjustedPes : annual.map((r) => r.priceToEarningsRatio),
      });

      const price = base.price;
      const dividendYield = price ? forwardDividend(dividends, price).yield : 0;

      if (!horizon || !(horizon.epsAvg > 0)) {
        return { ...base, dividendYield, note: 'No positive consensus EPS at the horizon' };
      }
      if (!price || !(price > 0)) return { ...base, dividendYield, note: 'No price' };
      if (!rate) {
        return { ...base, dividendYield, note: `Reports in ${reportedCurrency}; no exchange rate to convert` };
      }
      const epsAtHorizon = horizon.epsAvg * rate;

      const exitPe = anchors.recommended;
      const result = exitPe
        ? expectedReturn({
            price,
            epsAtHorizon,
            exitMultiple: exitPe,
            dividendYield,
            years,
          })
        : null;
      const required = requiredExitMultiple(
        price,
        epsAtHorizon,
        hurdle,
        dividendYield,
        years,
      );

      const review = implausibleReturn({
        exitPe,
        totalCagr: result?.totalCagr ?? null,
        requiredExitPe: required,
      });
      if (review) {
        return {
          ...base,
          dividendYield,
          epsAtHorizon,
          horizonFiscalYear: fiscalYearOf(horizon.date),
          analystCount: horizon.numAnalystsEps,
          exitPe,
          review: `Held for review: ${review}`,
          note: `Held for review: ${review}`,
          convertedFrom: foreign ? reportedCurrency : undefined,
        };
      }

      return {
        ...base,
        dividendYield,
        horizonNote,
        convertedFrom: foreign ? reportedCurrency : undefined,
        epsAtHorizon,
        horizonFiscalYear: fiscalYearOf(horizon.date),
        analystCount: horizon.numAnalystsEps,
        exitPe,
        exitPeSource: anchors.recommendedSource,
        ownMedianPe: anchors.anchors.find((a) => a.label === 'Own 10-year median')?.value ?? null,
        anchorsDisagree: anchors.anchorsDisagree,
        expectedCagr: result?.totalCagr ?? null,
        requiredExitPe: required,
        // Above zero means the price needs a re-rating beyond what the company
        // has historically traded at just to deliver the hurdle.
        stretch: required && exitPe ? required / exitPe - 1 : null,
        clearsHurdle: result ? result.totalCagr >= hurdle : null,
      };
    } catch (error) {
      return {
        ...base,
        note: error instanceof Error ? error.message.slice(0, 80) : 'Failed to load',
      };
    }
  });
}
