import { fmp, fmpList, TTL } from './client';
import type {
  BalanceSheetStatement,
  CashFlowStatement,
  EnterpriseValue,
  FinancialEstimate,
  FinancialScores,
  IncomeStatement,
  KeyMetricsTTM,
  Period,
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

export const getRatiosTTM = (symbol: string) =>
  fmpList<RatiosTTM>('ratios-ttm', { symbol }, TTL.ratios).then((r) => r[0] ?? null);

export const getFinancialScores = (symbol: string) =>
  fmpList<FinancialScores>('financial-scores', { symbol }, TTL.ratios).then((r) => r[0] ?? null);

export const getPriceTargetConsensus = (symbol: string) =>
  fmpList<PriceTargetConsensus>('price-target-consensus', { symbol }, TTL.estimates).then(
    (r) => r[0] ?? null,
  );

export const searchSymbols = (query: string, limit = 12) =>
  fmpList<SearchResult>('search-symbol', { query, limit }, TTL.search);

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
