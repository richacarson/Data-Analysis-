import 'server-only';

import {
  getAnnualRatios,
  getDividends,
  getEarningsHistory,
  getEstimates,
  getFxRate,
  getIndustryPe,
  getKeyMetricsTTM,
  getProfile,
  getRiskFreeRate,
} from '../fmp/endpoints';
import { forwardDividend } from '../valuation/dividends';
import { forwardEstimates } from '../valuation/fiscal';
import { houseReturn } from '../valuation/house';
import { DEFAULT_ERP, DEFAULT_HORIZON_YEARS, DEFAULT_HURDLE } from '../valuation/build';

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
 * Runs the same calculation as the stock page, on the same requests, so a row
 * and its page agree (and whichever loads second is served from cache). Each
 * ticker costs six calls; industry multiples, the risk-free rate and exchange
 * rates are fetched once per run and shared.
 */
export async function runScreen(
  symbols: string[],
  options: { horizonYears?: number; hurdle?: number } = {},
): Promise<ScreenRow[]> {
  const horizonYears = options.horizonYears ?? DEFAULT_HORIZON_YEARS;
  const hurdle = options.hurdle ?? DEFAULT_HURDLE;
  const started = Date.now();

  const once = <T,>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>) => {
    if (!cache.has(key)) cache.set(key, load());
    return cache.get(key)!;
  };
  const fx = new Map<string, Promise<number | null>>();
  const industries = new Map<string, Promise<Array<{ date: string; pe: number }>>>();
  const riskFree = getRiskFreeRate();
  const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  return pooled(symbols, 12, async (symbol): Promise<ScreenRow> => {
    const base: ScreenRow = {
      symbol,
      price: null,
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

    // A cold run is paced to FMP's rate limit. Past four minutes, stop starting
    // new tickers and say so: everything fetched so far is cached, so a reload
    // finishes the rest in seconds instead of the page timing out.
    if (Date.now() - started > 240_000) {
      return { ...base, note: 'Still loading. Reload in a minute to finish.' };
    }

    try {
      const [profile, estimates, annual, dividends, earnings, metrics] = await Promise.all([
        getProfile(symbol),
        getEstimates(symbol, 'annual', 10),
        getAnnualRatios(symbol, 10),
        getDividends(symbol).catch(() => []),
        getEarningsHistory(symbol, 44).catch(() => []),
        getKeyMetricsTTM(symbol).catch(() => null),
      ]);

      const price = profile?.price ?? null;
      if (!price || !(price > 0)) return { ...base, note: 'No price' };
      const dividendYield = forwardDividend(dividends, price).yield;

      // ADRs report at home and quote in dollars; consensus is converted.
      const reported = (annual.find((r) => r.reportedCurrency)?.reportedCurrency ?? profile?.currency ?? 'USD').toUpperCase();
      const quote = (profile?.currency || 'USD').toUpperCase();
      const rate = reported === quote ? 1 : await once(fx, `${reported}${quote}`, () => getFxRate(reported, quote));
      if (!rate) return { ...base, price, dividendYield, note: `Reports in ${reported}; no exchange rate to convert` };

      const industryPe = profile?.industry
        ? await once(industries, profile.industry, () => getIndustryPe(profile.industry, yearAgo, today).catch(() => []))
        : [];

      const lastReported = annual.reduce<string | null>((a, r) => (a === null || r.date > a ? r.date : a), null);
      const house = houseReturn({
        price,
        forward: forwardEstimates(estimates, lastReported),
        annual,
        earnings,
        industryPe,
        roic: metrics?.returnOnInvestedCapitalTTM ?? 0,
        beta: profile?.beta || 1,
        riskFreeRate: await riskFree,
        equityRiskPremium: DEFAULT_ERP,
        dividendYield,
        horizonYears,
        hurdle,
        fxRate: rate,
        foreign: reported !== quote,
      });

      const common: ScreenRow = {
        ...base,
        price,
        dividendYield,
        epsAtHorizon: house.epsAtHorizon,
        horizonFiscalYear: house.horizon?.fiscalYear ?? null,
        analystCount: house.horizon?.estimate.numAnalystsEps ?? 0,
        exitPe: house.exitPe,
        exitPeSource: house.exitPeSource,
        ownMedianPe: house.anchors.anchors.find((a) => a.label === 'Own 10-year median')?.value ?? null,
        anchorsDisagree: house.anchors.anchorsDisagree,
        horizonNote: house.horizonNote ?? undefined,
        convertedFrom: reported !== quote ? reported : undefined,
      };

      if (house.epsAtHorizon === null) return { ...common, note: 'No positive consensus EPS at the horizon' };
      if (house.review) return { ...common, review: house.review, note: house.review };
      if (house.exitPe === null) return { ...common, note: 'No usable exit multiple' };

      const cagr = house.expected?.totalCagr ?? null;
      const required = house.requiredExitMultiple;
      return {
        ...common,
        expectedCagr: cagr,
        requiredExitPe: required,
        // Above zero means the price needs a re-rating beyond the anchor just
        // to deliver the hurdle.
        stretch: required && house.exitPe ? required / house.exitPe - 1 : null,
        clearsHurdle: cagr !== null ? cagr >= hurdle : null,
      };
    } catch (error) {
      return {
        ...base,
        note: error instanceof Error ? error.message.slice(0, 80) : 'Failed to load',
      };
    }
  });
}
