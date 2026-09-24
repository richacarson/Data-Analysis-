import 'server-only';

import {
  getBalanceSheets,
  getCashFlowStatements,
  getEarningsHistory,
  getEstimates,
  getGeographicSegments,
  getIncomeStatements,
  getPriceHistory,
  getRevenueSegments,
} from '../fmp/endpoints';
import { annualAdjustedEps } from '../valuation/earnings-basis';
import { fiscalYearLabeler, forwardEstimates } from '../valuation/fiscal';
import {
  annualRows,
  attachAdjustedEps,
  deriveRows,
  quarterRows,
  ttmRows,
  weeklyPrices,
  type BalanceInput,
  type CashFlowInput,
  type IncomeInput,
  type PeriodRow,
} from './rows';
import { foldSegments, type SegmentData } from './segments';

export interface ChartData {
  quarterly: PeriodRow[];
  ttm: PeriodRow[];
  annual: PeriodRow[];
  /** Consensus years after the last reported one, annual view only. */
  estimates: PeriodRow[];
  prices: Array<{ date: string; price: number }>;
  segments: { product: SegmentData; geographic: SegmentData };
  issues: string[];
}

/** Keeps the payload lean: nulls are the common case for sparse fields. */
function compact(rows: PeriodRow[]): PeriodRow[] {
  return rows.map((r) => {
    const out: PeriodRow = { key: r.key, label: r.label, date: r.date, fiscalYear: r.fiscalYear, period: r.period };
    for (const [k, v] of Object.entries(r)) {
      if (v === null || v === undefined) continue;
      out[k] = typeof v === 'number' ? Number(v.toPrecision(6)) : v;
    }
    return out;
  });
}

export async function buildChartData(symbol: string): Promise<ChartData> {
  const ticker = symbol.toUpperCase();
  const issues: string[] = [];
  const optional = async <T,>(label: string, p: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await p;
    } catch (e) {
      issues.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      return fallback;
    }
  };

  const [incQ, incA, cfQ, cfA, bsQ, bsA, earnings, estimates, product, geographic] = await Promise.all([
    optional('quarterly income', getIncomeStatements(ticker, 'quarter', 44), []),
    optional('annual income', getIncomeStatements(ticker, 'annual', 15), []),
    optional('quarterly cash flow', getCashFlowStatements(ticker, 'quarter', 44), []),
    optional('annual cash flow', getCashFlowStatements(ticker, 'annual', 15), []),
    optional('quarterly balance sheet', getBalanceSheets(ticker, 'quarter', 44), []),
    optional('annual balance sheet', getBalanceSheets(ticker, 'annual', 15), []),
    optional('earnings history', getEarningsHistory(ticker, 60), []),
    optional('analyst estimates', getEstimates(ticker, 'annual', 10), []),
    optional('product segments', getRevenueSegments(ticker, 'annual'), []),
    optional('geographic segments', getGeographicSegments(ticker, 'annual'), []),
  ]);

  const earliest = [...incQ, ...incA].reduce(
    (min, r) => (r.date < min ? r.date : min),
    new Date().toISOString().slice(0, 10),
  );
  // A few days' margin so the first period end has a close to read.
  const from = new Date(Date.parse(earliest) - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const daily = await optional('price history', getPriceHistory(ticker, from), []);
  const prices = daily
    .map((p) => ({ date: p.date, price: p.price }))
    .filter((p) => Number.isFinite(p.price))
    .sort((a, b) => a.date.localeCompare(b.date));

  const quarters = quarterRows(
    incQ as unknown as IncomeInput[],
    cfQ as unknown as CashFlowInput[],
    bsQ as unknown as BalanceInput[],
  );
  attachAdjustedEps(quarters, earnings);
  const trailing = ttmRows(quarters);
  const years = annualRows(
    incA as unknown as IncomeInput[],
    cfA as unknown as CashFlowInput[],
    bsA as unknown as BalanceInput[],
  );

  const fiscalYearEnds = incA.map((i) => ({ date: i.date, fiscalYear: i.fiscalYear }));
  const adjustedByYear = new Map(annualAdjustedEps(earnings, fiscalYearEnds).map((a) => [a.year, a.adjustedEps]));
  for (const y of years) y.epsAdjusted = adjustedByYear.get(y.fiscalYear) ?? null;

  const ttmByDate = new Map(trailing.map((t) => [t.date, t]));
  const quarterly = deriveRows(quarters, prices, (r) => ttmByDate.get(r.date), 4);
  const ttm = deriveRows(trailing, prices, (r) => r, 4);
  const annual = deriveRows(years, prices, (r) => r, 1);

  // Consensus for the years not yet reported, labelled by fiscal year.
  const labelOf = fiscalYearLabeler(fiscalYearEnds);
  const lastReported = years[years.length - 1]?.date ?? null;
  const forward: PeriodRow[] = forwardEstimates(estimates, lastReported).map((e) => {
    const fy = labelOf(e.date);
    return {
      key: `FY${fy}E`,
      label: `${fy}E`,
      date: e.date,
      fiscalYear: fy,
      period: 'FY',
      estimate: true,
      revenue: e.revenueAvg || null,
      epsAdjusted: e.epsAvg || null,
      analysts: e.numAnalystsEps,
    };
  });

  return {
    quarterly: compact(quarterly),
    ttm: compact(ttm),
    annual: compact(annual),
    estimates: compact(forward),
    prices: weeklyPrices(prices),
    segments: {
      product: foldSegments(product.map((s) => ({ fiscalYear: String(s.fiscalYear), data: s.data }))),
      geographic: foldSegments(geographic.map((s) => ({ fiscalYear: String(s.fiscalYear), data: s.data }))),
    },
    issues,
  };
}
