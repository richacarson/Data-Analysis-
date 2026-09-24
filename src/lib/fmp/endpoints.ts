import { fmp, fmpList, TTL } from './client';
import type {
  AnnualRatios,
  BatchQuote,
  EarningsReport,
  RevenueSegment,
  BalanceSheetStatement,
  CashFlowStatement,
  EnterpriseValue,
  FinancialEstimate,
  FinancialScores,
  IncomeStatement,
  KeyMetricsTTM,
  IndustryPe,
  Period,
  PriceBar,
  PriceTargetConsensus,
  Profile,
  RatiosTTM,
  SearchResult,
} from './types';

export const getProfile = (symbol: string) =>
  fmpList<Profile>('profile', { symbol }, TTL.profile).then((r) => r[0] ?? null);

export const getIncomeStatements = (symbol: string, period: Period = 'annual', limit = 12) =>
  fmpList<IncomeStatement>('income-statement', { symbol, period, limit });

export const getCashFlowStatements = (symbol: string, period: Period = 'annual', limit = 12) =>
  fmpList<CashFlowStatement>('cash-flow-statement', { symbol, period, limit });

export const getBalanceSheets = (symbol: string, period: Period = 'annual', limit = 12) =>
  fmpList<BalanceSheetStatement>('balance-sheet-statement', { symbol, period, limit });

export const getEnterpriseValues = (symbol: string, limit = 12) =>
  fmpList<EnterpriseValue>('enterprise-values', { symbol, limit });

export const getEstimates = (symbol: string, period: Period = 'annual', limit = 10) =>
  fmpList<FinancialEstimate>('analyst-estimates', { symbol, period, limit }, TTL.estimates);

export const getKeyMetricsTTM = (symbol: string) =>
  fmpList<KeyMetricsTTM>('key-metrics-ttm', { symbol }, TTL.ratios).then((r) => r[0] ?? null);

/** Annual ratios, used for the company's own trailing P/E at each year end. */
export const getAnnualRatios = (symbol: string, limit = 10) =>
  fmpList<AnnualRatios>('ratios', { symbol, period: 'annual', limit }, TTL.ratios);

/**
 * Daily P/E for an industry. Returns one row per exchange per day, so callers
 * should reduce across exchanges rather than assume a single series.
 */
export const getIndustryPe = (industry: string, from: string, to: string) =>
  fmpList<IndustryPe>('historical-industry-pe', { industry, from, to }, TTL.ratios);

export const getRatiosTTM = (symbol: string) =>
  fmpList<RatiosTTM>('ratios-ttm', { symbol }, TTL.ratios).then((r) => r[0] ?? null);

export const getFinancialScores = (symbol: string) =>
  fmpList<FinancialScores>('financial-scores', { symbol }, TTL.ratios).then((r) => r[0] ?? null);

export const getPriceTargetConsensus = (symbol: string) =>
  fmpList<PriceTargetConsensus>('price-target-consensus', { symbol }, TTL.estimates).then(
    (r) => r[0] ?? null,
  );


/**
 * Reported quarterly results. The only place actual adjusted EPS is available,
 * which is the basis analyst estimates are quoted on.
 */
export const getEarningsHistory = (symbol: string, limit = 40) =>
  fmpList<EarningsReport>('earnings', { symbol, limit }, TTL.estimates);

/** Revenue split by product line, used for the stacked composition chart. */
export const getRevenueSegments = (symbol: string, period: Period = 'annual') =>
  fmpList<RevenueSegment>('revenue-product-segmentation', { symbol, period });

export const getGeographicSegments = (symbol: string, period: Period = 'annual') =>
  fmpList<RevenueSegment>('revenue-geographic-segmentation', { symbol, period });

/** Daily closes, newest first. Split-adjusted, so they line up with per-share history. */
export const getPriceHistory = (symbol: string, from: string) =>
  fmpList<PriceBar>('historical-price-eod/light', { symbol, from }, TTL.ratios);

/** Prices for many symbols in one request, so a screen is not N calls. */
export const getBatchQuotes = (symbols: string[]) =>
  fmpList<BatchQuote>('batch-quote-short', { symbols: symbols.join(',') }, TTL.quote);

/**
 * Symbol lookup. FMP splits this across two endpoints: `search-symbol` matches
 * ticker text and `search-name` matches company names, so "AAPL" and "apple"
 * each only hit one of them. Both are queried and the results merged.
 */
export async function searchSymbols(query: string, limit = 12): Promise<SearchResult[]> {
  const [bySymbol, byName] = await Promise.all([
    fmpList<SearchResult>('search-symbol', { query, limit }, TTL.search).catch(() => []),
    fmpList<SearchResult>('search-name', { query, limit }, TTL.search).catch(() => []),
  ]);

  // Ticker matches rank first — typing a ticker should not be buried under
  // companies that merely mention it in their name.
  const seen = new Set<string>();
  const merged: SearchResult[] = [];
  for (const row of [...bySymbol, ...byName]) {
    if (!row?.symbol || seen.has(row.symbol)) continue;
    seen.add(row.symbol);
    merged.push(row);
  }
  return merged.slice(0, limit);
}

/** 10-year Treasury, used as the default risk-free rate in the CAPM cost of equity. */
export async function getRiskFreeRate(): Promise<number> {
  try {
    const rows = await fmpList<{ date: string; month10?: number; year10?: number }>(
      'treasury-rates',
      {},
      TTL.ratios,
    );
    const latest = rows[0];
    const pct = latest?.year10 ?? latest?.month10;
    if (typeof pct === 'number' && pct > 0) return pct / 100;
  } catch {
    // Fall through to the default below — a missing macro feed should never
    // take down the whole valuation.
  }
  return 0.042;
}

export { fmp, fmpList };
