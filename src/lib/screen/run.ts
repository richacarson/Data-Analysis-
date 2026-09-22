import 'server-only';

import { getAnnualRatios, getBatchQuotes, getEstimates, getRatiosTTM } from '../fmp/endpoints';
import { expectedReturn, requiredExitMultiple } from '../valuation/expected-return';
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
 * and each ticker costs three more, so a 154-holding screen is a few hundred
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

  const targetFiscalYear = new Date().getFullYear() + horizonYears;

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
    };

    try {
      const [estimates, annual, ttm] = await Promise.all([
        getEstimates(symbol, 'annual', 10),
        getAnnualRatios(symbol, 10),
        getRatiosTTM(symbol),
      ]);

      const sorted = [...estimates].sort((a, b) => a.date.localeCompare(b.date));
      const horizon =
        sorted.find((e) => Number(e.date.slice(0, 4)) >= targetFiscalYear) ??
        sorted[sorted.length - 1] ??
        null;

      const anchors = exitMultipleAnchors({
        ownHistory: annual.map((r) => r.priceToEarningsRatio),
      });

      const price = base.price;
      const dividendYield = ttm?.dividendYieldTTM ?? 0;

      if (!horizon || !(horizon.epsAvg > 0)) {
        return { ...base, dividendYield, note: 'No positive consensus EPS at the horizon' };
      }
      if (!price || !(price > 0)) return { ...base, dividendYield, note: 'No price' };

      const exitPe = anchors.recommended;
      const result = exitPe
        ? expectedReturn({
            price,
            epsAtHorizon: horizon.epsAvg,
            exitMultiple: exitPe,
            dividendYield,
            years: horizonYears,
          })
        : null;
      const required = requiredExitMultiple(
        price,
        horizon.epsAvg,
        hurdle,
        dividendYield,
        horizonYears,
      );

      return {
        ...base,
        dividendYield,
        epsAtHorizon: horizon.epsAvg,
        horizonFiscalYear: horizon.date.slice(0, 4),
        analystCount: horizon.numAnalystsEps,
        exitPe,
        exitPeSource: anchors.recommendedSource,
        ownMedianPe: anchors.anchors.find((a) => a.label === 'Own 10-year median')?.value ?? null,
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
