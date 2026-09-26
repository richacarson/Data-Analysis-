import { describe, expect, it } from 'vitest';
import {
  attachAdjustedEps,
  deriveRows,
  priceOn,
  quarterRows,
  ttmRows,
  weeklyPrices,
  type IncomeInput,
} from '../rows';
import { foldSegments } from '../segments';

const income = (date: string, fy: string, period: string, revenue: number, netIncome: number, eps: number): IncomeInput => ({
  date,
  fiscalYear: fy,
  period,
  revenue,
  costOfRevenue: revenue * 0.4,
  grossProfit: revenue * 0.6,
  researchAndDevelopmentExpenses: 0,
  sellingGeneralAndAdministrativeExpenses: revenue * 0.2,
  operatingExpenses: revenue * 0.2,
  operatingIncome: revenue * 0.4,
  ebitda: revenue * 0.45,
  ebit: revenue * 0.4,
  interestExpense: 10,
  incomeBeforeTax: netIncome / 0.8,
  incomeTaxExpense: netIncome / 4,
  netIncome,
  epsDiluted: eps,
  weightedAverageShsOutDil: 100,
});

const quarters = [
  income('2025-03-31', '2025', 'Q1', 1000, 100, 1.0),
  income('2025-06-30', '2025', 'Q2', 1100, 110, 1.1),
  income('2025-09-30', '2025', 'Q3', 1200, 120, 1.2),
  income('2025-12-31', '2025', 'Q4', 1300, 130, 1.3),
  income('2026-03-31', '2026', 'Q1', 1400, 140, 1.4),
];

const prices = [
  { date: '2025-12-31', price: 100 },
  { date: '2026-03-27', price: 120 },
  { date: '2026-04-01', price: 125 },
];

describe('priceOn', () => {
  it('takes the last close on or before the date', () => {
    expect(priceOn(prices, '2026-03-31')).toBe(120);
    expect(priceOn(prices, '2025-12-31')).toBe(100);
    expect(priceOn(prices, '2025-01-01')).toBeNull();
  });
});

describe('ttmRows', () => {
  const q = quarterRows(quarters, [], []);

  it('sums four quarters and needs four to start', () => {
    const t = ttmRows(q);
    expect(t).toHaveLength(2);
    expect(t[0].revenue).toBe(4600);
    expect(t[0].eps).toBeCloseTo(4.6);
    expect(t[1].revenue).toBe(5000);
  });

  it('refuses to sum across a gap in the history', () => {
    const gapped = quarterRows([quarters[0], quarters[1], quarters[3], quarters[4]], [], []);
    expect(ttmRows(gapped)).toHaveLength(0);
  });
});

describe('deriveRows', () => {
  it('prices a quarter on trailing-year earnings, not the quarter alone', () => {
    const q = quarterRows(quarters, [], []);
    const t = ttmRows(q);
    const byDate = new Map(t.map((r) => [r.date, r]));
    const derived = deriveRows(q, prices, (r) => byDate.get(r.date), 4);
    const latest = derived[derived.length - 1];
    // 120 over 1.2 + 1.3 + 1.4 + 1.1 = 5.0 is 24x; over the quarter's 1.4 it would read 86x.
    expect(latest.pe).toBeCloseTo(120 / 5.0);
  });

  it('measures growth against the same quarter a year earlier', () => {
    const q = quarterRows(quarters, [], []);
    const derived = deriveRows(q, prices, () => undefined, 4);
    expect(derived[4].revenueGrowth).toBeCloseTo(0.4);
    expect(derived[3].revenueGrowth).toBeNull();
  });

  it('leaves a multiple empty on negative earnings', () => {
    const loss = quarterRows([income('2025-12-31', '2025', 'Q4', 1000, -50, -0.5)], [], []);
    const derived = deriveRows(loss, prices, (r) => r, 4);
    expect(derived[0].pe).toBeNull();
  });
});

describe('attachAdjustedEps', () => {
  it('assigns each report to the quarter that ended before it', () => {
    const q = quarterRows(quarters.slice(0, 2), [], []);
    attachAdjustedEps(q, [
      { date: '2025-04-24', epsActual: 1.05 },
      { date: '2025-07-24', epsActual: 1.15 },
    ]);
    expect(q[0].epsAdjusted).toBe(1.05);
    expect(q[1].epsAdjusted).toBe(1.15);
  });

  it('leaves a quarter empty when its report is missing', () => {
    const q = quarterRows(quarters.slice(0, 1), [], []);
    attachAdjustedEps(q, [{ date: '2025-10-24', epsActual: 1.2 }]);
    expect(q[0].epsAdjusted).toBeNull();
  });
});

describe('weeklyPrices', () => {
  it('keeps the last close of each week', () => {
    const w = weeklyPrices([
      { date: '2026-03-23', price: 1 },
      { date: '2026-03-27', price: 2 },
      { date: '2026-03-30', price: 3 },
    ]);
    expect(w).toEqual([
      { date: '2026-03-27', price: 2 },
      { date: '2026-03-30', price: 3 },
    ]);
  });
});

describe('foldSegments', () => {
  it('names the largest five and folds the rest into Other', () => {
    const data = { A: 60, B: 50, C: 40, D: 30, E: 20, F: 10, G: 5 };
    const s = foldSegments([{ fiscalYear: '2025', data }]);
    expect(s.segments).toEqual(['A', 'B', 'C', 'D', 'E', 'Other']);
    expect(s.rows[0].Other).toBe(15);
  });

  it('keeps a renamed segment in Other so the year still sums to revenue', () => {
    const s = foldSegments([
      { fiscalYear: '2024', data: { Old: 30, A: 50 } },
      { fiscalYear: '2025', data: { A: 60, B: 40 } },
    ]);
    const y2024 = s.rows.find((r) => r.label === '2024')!;
    expect((y2024.A as number) + (y2024.B as number) + (y2024.Other as number)).toBe(80);
  });
});

describe('consensus rows', () => {
  const est = (date: string, revenue: number, eps: number) => ({
    date,
    revenueAvg: revenue,
    ebitdaAvg: revenue * 0.4,
    ebitAvg: revenue * 0.3,
    netIncomeAvg: revenue * 0.2,
    epsAvg: eps,
    numAnalystsEps: 10,
  });

  it('labels forward quarters by carrying the fiscal quarter on, across a year end', async () => {
    const { quarterEstimateRows } = await import('../rows');
    const q = quarterRows(quarters, [], []); // last reported: Q1 FY2026 at 2026-03-31
    const rows = quarterEstimateRows(
      [est('2026-03-31', 1, 1), est('2026-06-30', 1450, 1.45), est('2026-09-30', 1500, 1.5), est('2026-12-31', 1550, 1.55), est('2027-03-31', 1600, 1.6)],
      q[q.length - 1],
    );
    // The already-reported quarter is dropped; the rest run Q2 FY26 to Q1 FY27.
    expect(rows.map((r) => r.label)).toEqual(["Q2 '26E", "Q3 '26E", "Q4 '26E", "Q1 '27E"]);
    expect(rows.every((r) => r.estimate)).toBe(true);
  });

  it('runs trailing twelve months from reported quarters into consensus ones', async () => {
    const { quarterEstimateRows, ttmEstimateRows } = await import('../rows');
    const q = quarterRows(quarters, [], []);
    const fwd = quarterEstimateRows([est('2026-06-30', 1500, 1.5)], q[q.length - 1]);
    const t = ttmEstimateRows(q, fwd);
    // Q3 '25 + Q4 '25 + Q1 '26 reported, Q2 '26 consensus.
    expect(t[0].revenue).toBe(1200 + 1300 + 1400 + 1500);
  });

  it('measures consensus growth and margins against the view it continues', async () => {
    const { deriveEstimates, estimateRow } = await import('../rows');
    const history = [{ key: 'FY2025', label: '2025', date: '2025-12-31', fiscalYear: '2025', period: 'FY', revenue: 1000, epsAdjusted: 4 }];
    const [e] = deriveEstimates(history, [estimateRow(est('2026-12-31', 1100, 5), 'FY2026E', '2026E', '2026', 'FY')], 1);
    expect(e.revenueGrowth).toBeCloseTo(0.1);
    expect(e.epsAdjustedGrowth).toBeCloseTo(0.25);
    expect(e.operatingMargin).toBeCloseTo(0.3);
  });
});

describe('ROIC', () => {
  it('uses FMP’s invested capital: working capital, net PP&E, goodwill and intangibles', () => {
    // Stanley Black & Decker's Q2 2026 balance sheet; FMP reports 13,911.5M.
    const bs = {
      date: '2026-03-31',
      cashAndShortTermInvestments: 592.4,
      totalDebt: 4757.9,
      netDebt: 4165.5,
      totalAssets: 20093.5,
      totalLiabilities: 11134.7,
      totalStockholdersEquity: 8958.8,
      totalCurrentAssets: 6343.7,
      totalCurrentLiabilities: 4429.1,
      goodwill: 7265.6,
      intangibleAssets: 3023.8,
      propertyPlantEquipmentNet: 1707.5,
    };
    const t = ttmRows(quarterRows(quarters, [], [bs]));
    const row = deriveRows(t, prices, (r) => r, 4).at(-1)!;
    // TTM EBIT 2,000 (40% of 5,000 revenue) × (1 − 20% tax) over 13,911.5.
    expect(row.roic as number).toBeCloseTo((2000 * 0.8) / 13911.5, 4);
  });
});
