/**
 * Period rows for the chart library.
 *
 * Three views of the same history, the way Qualtrim offers them: each quarter
 * on its own, trailing twelve months, and fiscal years. Every derived metric
 * is computed here once, so a chart definition only names a field.
 *
 * Valuation multiples always use a trailing-twelve-month denominator, even in
 * the quarterly view. FMP's quarterly ratios divide price by one quarter's
 * earnings — Stanley Black & Decker reads 9.9x on that basis against roughly
 * 20x on a year of earnings — which is not a P/E anyone quotes.
 */

export type ChartPeriod = 'quarterly' | 'ttm' | 'annual';

export interface IncomeInput {
  date: string;
  fiscalYear: string;
  period: string;
  revenue: number;
  costOfRevenue: number;
  grossProfit: number;
  researchAndDevelopmentExpenses: number;
  sellingGeneralAndAdministrativeExpenses: number;
  operatingExpenses: number;
  operatingIncome: number;
  ebitda: number;
  ebit: number;
  interestExpense: number;
  incomeBeforeTax: number;
  incomeTaxExpense: number;
  netIncome: number;
  epsDiluted: number;
  weightedAverageShsOutDil: number;
}

export interface CashFlowInput {
  date: string;
  operatingCashFlow: number;
  capitalExpenditure: number;
  freeCashFlow: number;
  stockBasedCompensation: number;
  depreciationAndAmortization: number;
  commonDividendsPaid: number;
  commonStockRepurchased: number;
}

export interface BalanceInput {
  date: string;
  cashAndShortTermInvestments: number;
  totalDebt: number;
  netDebt: number;
  totalAssets: number;
  totalLiabilities: number;
  totalStockholdersEquity: number;
  totalCurrentAssets: number;
  totalCurrentLiabilities: number;
  goodwill: number;
  intangibleAssets: number;
  inventory?: number;
}

/** One period. Every value is null where the inputs cannot support it. */
export interface PeriodRow {
  key: string;
  label: string;
  date: string;
  fiscalYear: string;
  period: string;
  /** Consensus rather than reported; drawn hatched. */
  estimate?: boolean;
  [field: string]: string | number | boolean | null | undefined;
}

type Num = number | null;

const DAY = 24 * 60 * 60 * 1000;

function finite(n: unknown): Num {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function ratio(a: Num, b: Num): Num {
  if (a === null || b === null || b === 0) return null;
  const r = a / b;
  return Number.isFinite(r) ? r : null;
}

/** Multiples only mean something on positive earnings; a negative P/E is noise. */
function multiple(price: Num, perShare: Num): Num {
  if (price === null || perShare === null || !(perShare > 0)) return null;
  return price / perShare;
}

function growth(now: Num, before: Num): Num {
  if (now === null || before === null || before === 0) return null;
  // Growth off a negative base has no sign convention a reader can trust.
  if (before < 0) return null;
  return now / before - 1;
}

/** Closing price on or before a date, from a date-sorted ascending series. */
export function priceOn(prices: Array<{ date: string; price: number }>, date: string): Num {
  let lo = 0;
  let hi = prices.length - 1;
  let found: Num = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (prices[mid].date <= date) {
      found = prices[mid].price;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

function quarterLabel(fiscalYear: string, period: string): string {
  return `${period} '${fiscalYear.slice(2)}`;
}

/** Flow fields, summed for trailing twelve months. */
const FLOWS = [
  'revenue',
  'costOfRevenue',
  'grossProfit',
  'rnd',
  'sga',
  'operatingExpenses',
  'operatingIncome',
  'ebitda',
  'ebit',
  'interestExpense',
  'pretaxIncome',
  'incomeTax',
  'netIncome',
  'eps',
  'epsAdjusted',
  'operatingCashFlow',
  'capex',
  'freeCashFlow',
  'sbc',
  'dna',
  'dividends',
  'buybacks',
] as const;

/** Merges one period's statements into raw fields; derived fields come later. */
function baseRow(
  inc: IncomeInput,
  cf: CashFlowInput | undefined,
  bs: BalanceInput | undefined,
  key: string,
  label: string,
): PeriodRow {
  return {
    key,
    label,
    date: inc.date,
    fiscalYear: inc.fiscalYear,
    period: inc.period,
    revenue: finite(inc.revenue),
    costOfRevenue: finite(inc.costOfRevenue),
    grossProfit: finite(inc.grossProfit),
    rnd: finite(inc.researchAndDevelopmentExpenses),
    sga: finite(inc.sellingGeneralAndAdministrativeExpenses),
    operatingExpenses: finite(inc.operatingExpenses),
    operatingIncome: finite(inc.operatingIncome),
    ebitda: finite(inc.ebitda),
    ebit: finite(inc.ebit),
    interestExpense: finite(inc.interestExpense),
    pretaxIncome: finite(inc.incomeBeforeTax),
    incomeTax: finite(inc.incomeTaxExpense),
    netIncome: finite(inc.netIncome),
    eps: finite(inc.epsDiluted),
    dilutedShares: finite(inc.weightedAverageShsOutDil),
    // Cash flow statement signs: outflows are negative. Charts show them as
    // positive amounts spent.
    operatingCashFlow: cf ? finite(cf.operatingCashFlow) : null,
    capex: cf ? finite(-cf.capitalExpenditure) : null,
    freeCashFlow: cf ? finite(cf.freeCashFlow) : null,
    sbc: cf ? finite(cf.stockBasedCompensation) : null,
    dna: cf ? finite(cf.depreciationAndAmortization) : null,
    dividends: cf ? finite(-cf.commonDividendsPaid) : null,
    buybacks: cf ? finite(-cf.commonStockRepurchased) : null,
    cash: bs ? finite(bs.cashAndShortTermInvestments) : null,
    totalDebt: bs ? finite(bs.totalDebt) : null,
    netDebt: bs ? finite(bs.netDebt) : null,
    totalAssets: bs ? finite(bs.totalAssets) : null,
    totalLiabilities: bs ? finite(bs.totalLiabilities) : null,
    equity: bs ? finite(bs.totalStockholdersEquity) : null,
    currentAssets: bs ? finite(bs.totalCurrentAssets) : null,
    currentLiabilities: bs ? finite(bs.totalCurrentLiabilities) : null,
    goodwillIntangibles: bs ? finite((bs.goodwill ?? 0) + (bs.intangibleAssets ?? 0)) : null,
    inventory: bs ? finite(bs.inventory ?? null) : null,
  };
}

/** Quarterly rows, oldest first. Only true quarters; FMP occasionally returns an FY row. */
export function quarterRows(
  income: IncomeInput[],
  cashflow: CashFlowInput[],
  balance: BalanceInput[],
): PeriodRow[] {
  const cfByDate = new Map(cashflow.map((c) => [c.date, c]));
  const bsByDate = new Map(balance.map((b) => [b.date, b]));
  return income
    .filter((q) => /^Q[1-4]$/.test(q.period))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((q) =>
      baseRow(
        q,
        cfByDate.get(q.date),
        bsByDate.get(q.date),
        `${q.fiscalYear}-${q.period}`,
        quarterLabel(q.fiscalYear, q.period),
      ),
    );
}

export function annualRows(
  income: IncomeInput[],
  cashflow: CashFlowInput[],
  balance: BalanceInput[],
): PeriodRow[] {
  const cfByDate = new Map(cashflow.map((c) => [c.date, c]));
  const bsByDate = new Map(balance.map((b) => [b.date, b]));
  return [...income]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((y) => baseRow(y, cfByDate.get(y.date), bsByDate.get(y.date), `FY${y.fiscalYear}`, y.fiscalYear));
}

/**
 * Trailing twelve months at each quarter end: flows summed over four
 * consecutive quarters, balances as of the quarter. A gap in the quarterly
 * history breaks the window rather than summing across it.
 */
export function ttmRows(quarters: PeriodRow[]): PeriodRow[] {
  const out: PeriodRow[] = [];
  for (let i = 3; i < quarters.length; i++) {
    const window = quarters.slice(i - 3, i + 1);
    const span = (Date.parse(window[3].date) - Date.parse(window[0].date)) / DAY;
    if (span < 250 || span > 300) continue;

    const row: PeriodRow = { ...quarters[i] };
    for (const f of FLOWS) {
      const values = window.map((q) => q[f] as Num);
      row[f] = values.every((v) => v !== null) ? (values as number[]).reduce((a, b) => a + b, 0) : null;
    }
    // Average share count over the year, as an annual EPS would use.
    const shares = window.map((q) => q.dilutedShares as Num);
    row.dilutedShares = shares.every((v) => v !== null)
      ? (shares as number[]).reduce((a, b) => a + b, 0) / 4
      : null;
    out.push(row);
  }
  return out;
}

/**
 * Adjusted EPS per quarter, from earnings reports.
 *
 * A report belongs to the quarter that ended most recently before it, provided
 * it came within 100 days — otherwise the quarter's report is missing.
 */
export function attachAdjustedEps(
  quarters: PeriodRow[],
  reports: Array<{ date: string; epsActual: number | null }>,
): void {
  const sorted = [...reports].sort((a, b) => a.date.localeCompare(b.date));
  for (const q of quarters) {
    const report = sorted.find((r) => r.date > q.date);
    const lag = report ? (Date.parse(report.date) - Date.parse(q.date)) / DAY : Infinity;
    q.epsAdjusted = report && lag <= 100 ? finite(report.epsActual) : null;
  }
}

/**
 * Derived metrics for one view.
 *
 * `valuationBasis` supplies the twelve-month flows that multiples and returns
 * are computed on: the rows themselves for TTM and annual, the matching TTM
 * row for the quarterly view.
 */
export function deriveRows(
  rows: PeriodRow[],
  prices: Array<{ date: string; price: number }>,
  valuationBasis: (row: PeriodRow) => PeriodRow | undefined,
  lagForGrowth: number,
): PeriodRow[] {
  return rows.map((row, i) => {
    const r: PeriodRow = { ...row };
    const n = (k: string) => finite(r[k]);
    const prior = rows[i - lagForGrowth];
    const p = (k: string) => (prior ? finite(prior[k]) : null);

    const revenue = n('revenue');
    const shares = n('dilutedShares');
    const price = priceOn(prices, r.date);
    r.price = price;

    // Growth against the same period a year earlier.
    r.revenueGrowth = growth(revenue, p('revenue'));
    r.epsGrowth = growth(n('eps'), p('eps'));
    r.fcfGrowth = growth(n('freeCashFlow'), p('freeCashFlow'));

    // Margins and intensities within the period.
    r.grossMargin = ratio(n('grossProfit'), revenue);
    r.operatingMargin = ratio(n('operatingIncome'), revenue);
    r.ebitdaMargin = ratio(n('ebitda'), revenue);
    r.netMargin = ratio(n('netIncome'), revenue);
    r.fcfMargin = ratio(n('freeCashFlow'), revenue);
    r.rndPct = n('rnd') ? ratio(n('rnd'), revenue) : null;
    r.sgaPct = ratio(n('sga'), revenue);
    r.sbcPct = ratio(n('sbc'), revenue);
    r.capexPct = ratio(n('capex'), revenue);
    r.effectiveTaxRate = n('pretaxIncome') !== null && n('pretaxIncome')! > 0 ? ratio(n('incomeTax'), n('pretaxIncome')) : null;

    // Per share.
    r.fcfPerShare = ratio(n('freeCashFlow'), shares);
    r.dividendPerShare = ratio(n('dividends'), shares);
    r.bookValuePerShare = ratio(n('equity'), shares);
    r.returnOfCapital =
      n('dividends') !== null || n('buybacks') !== null ? (n('dividends') ?? 0) + (n('buybacks') ?? 0) : null;
    r.fcfVsSbc = n('freeCashFlow') !== null && n('sbc') !== null ? n('freeCashFlow')! - n('sbc')! : null;

    // Balance sheet.
    r.currentRatio = ratio(n('currentAssets'), n('currentLiabilities'));
    r.debtToEquity = n('equity') !== null && n('equity')! > 0 ? ratio(n('totalDebt'), n('equity')) : null;
    r.goodwillPct = ratio(n('goodwillIntangibles'), n('totalAssets'));

    // Twelve-month basis for multiples and returns.
    const basis = valuationBasis(r);
    const b = (k: string) => (basis ? finite(basis[k]) : null);
    const ttmShares = b('dilutedShares');
    const marketCap = price !== null && shares !== null ? price * shares : null;
    const ev = marketCap !== null && n('netDebt') !== null ? marketCap + n('netDebt')! : null;
    r.marketCap = marketCap;
    r.enterpriseValue = ev;

    r.pe = multiple(price, b('eps'));
    r.peAdjusted = multiple(price, b('epsAdjusted'));
    r.ps = multiple(price, ratio(b('revenue'), ttmShares));
    r.pfcf = multiple(price, ratio(b('freeCashFlow'), ttmShares));
    r.evEbitda = ev !== null && b('ebitda') !== null && b('ebitda')! > 0 ? ev / b('ebitda')! : null;
    r.fcfYield = marketCap ? ratio(b('freeCashFlow'), marketCap) : null;
    r.dividendYield = marketCap && b('dividends') ? ratio(b('dividends'), marketCap) : null;
    r.payoutRatio = b('netIncome') !== null && b('netIncome')! > 0 && b('dividends') ? ratio(b('dividends'), b('netIncome')) : null;

    const equity = n('equity');
    const taxRate = b('pretaxIncome') && b('pretaxIncome')! > 0 ? ratio(b('incomeTax'), b('pretaxIncome')) : null;
    const nopat = b('ebit') !== null ? b('ebit')! * (1 - Math.min(Math.max(taxRate ?? 0.21, 0), 0.5)) : null;
    const investedCapital =
      n('totalDebt') !== null && equity !== null ? n('totalDebt')! + equity - (n('cash') ?? 0) : null;
    r.roic = investedCapital !== null && investedCapital > 0 ? ratio(nopat, investedCapital) : null;
    r.roe = equity !== null && equity > 0 ? ratio(b('netIncome'), equity) : null;
    r.roa = ratio(b('netIncome'), n('totalAssets'));
    r.netDebtToEbitda = b('ebitda') !== null && b('ebitda')! > 0 ? ratio(n('netDebt'), b('ebitda')) : null;
    r.interestCoverage =
      b('interestExpense') !== null && b('interestExpense')! > 0 ? ratio(b('ebit'), b('interestExpense')) : null;

    return r;
  });
}

/** Weekly closes for the price chart: one point per week keeps a decade light. */
export function weeklyPrices(prices: Array<{ date: string; price: number }>) {
  const out: Array<{ date: string; price: number }> = [];
  let lastWeek = '';
  for (const p of prices) {
    const d = new Date(`${p.date}T00:00:00Z`);
    const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10);
    if (monday === lastWeek) out[out.length - 1] = p;
    else {
      out.push(p);
      lastWeek = monday;
    }
  }
  return out;
}

/** Fields carried week by week rather than once per period. */
export const CONTINUOUS_KEYS = [
  'price',
  'marketCap',
  'pe',
  'peAdjusted',
  'ps',
  'pfcf',
  'evEbitda',
  'fcfYield',
  'dividendYield',
] as const;

export type WeeklyPoint = { date: string; price: number } & Partial<Record<(typeof CONTINUOUS_KEYS)[number], number | null>>;

/**
 * Valuation week by week: each weekly close against the latest twelve months
 * reported by then. This is how a P/E line moves between reports — the price
 * moves daily while the earnings under it step once a quarter.
 */
export function weeklyValuation(
  prices: Array<{ date: string; price: number }>,
  basis: PeriodRow[],
): WeeklyPoint[] {
  const sorted = [...basis].sort((a, b) => a.date.localeCompare(b.date));
  let j = -1;
  return prices.map((p) => {
    while (j + 1 < sorted.length && sorted[j + 1].date <= p.date) j++;
    const b = j >= 0 ? sorted[j] : undefined;
    const f = (k: string) => (b ? finite(b[k]) : null);
    const shares = f('dilutedShares');
    const marketCap = shares !== null ? p.price * shares : null;
    const positive = (v: Num) => (v !== null && v > 0 ? v : null);
    const ebitda = positive(f('ebitda'));
    const netDebt = f('netDebt');
    return {
      date: p.date,
      price: p.price,
      marketCap,
      pe: multiple(p.price, f('eps')),
      peAdjusted: multiple(p.price, f('epsAdjusted')),
      ps: marketCap !== null && positive(f('revenue')) ? marketCap / f('revenue')! : null,
      pfcf: marketCap !== null && positive(f('freeCashFlow')) ? marketCap / f('freeCashFlow')! : null,
      evEbitda: marketCap !== null && ebitda && netDebt !== null ? (marketCap + netDebt) / ebitda : null,
      fcfYield: marketCap ? ratio(f('freeCashFlow'), marketCap) : null,
      dividendYield: marketCap && f('dividends') ? ratio(f('dividends'), marketCap) : null,
    };
  });
}
