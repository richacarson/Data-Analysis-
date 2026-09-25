/**
 * The chart library. Each entry names fields computed in rows.ts; rendering is
 * generic, so adding a chart is one entry here.
 *
 * Overlays (price over revenue, P/E over EPS) are drawn in a strip above the
 * bars on their own scale, sharing the time axis and the readout. Laid over the
 * bars on a second axis they would appear to cross wherever the two scales
 * happen to put them, which is a relationship the data does not contain.
 */

export type ValueFormat = 'money' | 'perShare' | 'pct' | 'multiple' | 'shares' | 'ratio';

export type ChartKind =
  | 'bar' // one series of columns
  | 'stack' // stacked columns
  | 'group' // side-by-side columns
  | 'line' // one or more lines
  | 'price' // weekly share price
  | 'segments'; // stacked columns from segment data

export interface SeriesDef {
  key: string;
  label: string;
}

export interface ChartDef {
  id: string;
  title: string;
  category: Category;
  kind: ChartKind;
  series: SeriesDef[];
  format: ValueFormat;
  overlay?: SeriesDef & { format: ValueFormat };
  /** Shown under the title. */
  note?: string;
  /** Segment charts are published annually. */
  annualOnly?: boolean;
  /** Draws consensus years after the reported ones, in the annual view. */
  withEstimates?: boolean;
  segmentSource?: 'product' | 'geographic';
}

export const CATEGORIES = [
  'Price & valuation',
  'Income',
  'Growth & margins',
  'Cash flow',
  'Per share',
  'Capital return',
  'Balance sheet',
  'Returns',
  'Mix',
] as const;
export type Category = (typeof CATEGORIES)[number];

const PRICE = { key: 'price', label: 'Share price', format: 'perShare' as const };

export const CHARTS: ChartDef[] = [
  // ---- Price & valuation --------------------------------------------------
  { id: 'price', title: 'Share price', category: 'Price & valuation', kind: 'price', series: [{ key: 'price', label: 'Price' }], format: 'perShare', note: 'Weekly close, split-adjusted' },
  { id: 'marketCap', title: 'Market cap', category: 'Price & valuation', kind: 'line', series: [{ key: 'marketCap', label: 'Market cap' }], format: 'money', note: 'Weekly' },
  { id: 'pe', title: 'P/E', category: 'Price & valuation', kind: 'line', series: [{ key: 'pe', label: 'P/E' }], format: 'multiple', note: 'Price over trailing-year GAAP EPS' },
  { id: 'peAdjusted', title: 'P/E (adjusted EPS)', category: 'Price & valuation', kind: 'line', series: [{ key: 'peAdjusted', label: 'P/E adjusted' }], format: 'multiple', note: 'The basis consensus is quoted on' },
  { id: 'ps', title: 'Price / sales', category: 'Price & valuation', kind: 'line', series: [{ key: 'ps', label: 'P/S' }], format: 'multiple', note: 'Trailing-year revenue' },
  { id: 'pfcf', title: 'Price / free cash flow', category: 'Price & valuation', kind: 'line', series: [{ key: 'pfcf', label: 'P/FCF' }], format: 'multiple', note: 'Trailing-year FCF' },
  { id: 'evEbitda', title: 'EV / EBITDA', category: 'Price & valuation', kind: 'line', series: [{ key: 'evEbitda', label: 'EV/EBITDA' }], format: 'multiple', note: 'Trailing-year EBITDA' },
  { id: 'fcfYield', title: 'Free cash flow yield', category: 'Price & valuation', kind: 'line', series: [{ key: 'fcfYield', label: 'FCF yield' }], format: 'pct', note: 'Trailing-year FCF over market cap' },
  { id: 'dividendYield', title: 'Dividend yield', category: 'Price & valuation', kind: 'line', series: [{ key: 'dividendYield', label: 'Dividend yield' }], format: 'pct', note: 'Trailing-year dividends over market cap' },

  // ---- Income -------------------------------------------------------------
  { id: 'revenue', title: 'Revenue', category: 'Income', kind: 'bar', series: [{ key: 'revenue', label: 'Revenue' }], format: 'money', overlay: PRICE, withEstimates: true },
  { id: 'grossProfit', title: 'Gross profit', category: 'Income', kind: 'bar', series: [{ key: 'grossProfit', label: 'Gross profit' }], format: 'money', overlay: { key: 'grossMargin', label: 'Gross margin', format: 'pct' } },
  { id: 'operatingIncome', title: 'Operating income', category: 'Income', kind: 'bar', series: [{ key: 'operatingIncome', label: 'Operating income' }], format: 'money', overlay: { key: 'operatingMargin', label: 'Operating margin', format: 'pct' }, withEstimates: true },
  { id: 'ebitda', title: 'EBITDA', category: 'Income', kind: 'bar', series: [{ key: 'ebitda', label: 'EBITDA' }], format: 'money', overlay: { key: 'evEbitda', label: 'EV/EBITDA', format: 'multiple' }, withEstimates: true },
  { id: 'netIncome', title: 'Net income', category: 'Income', kind: 'bar', series: [{ key: 'netIncome', label: 'Net income' }], format: 'money', overlay: { key: 'netMargin', label: 'Net margin', format: 'pct' }, withEstimates: true },
  { id: 'eps', title: 'EPS (GAAP)', category: 'Income', kind: 'bar', series: [{ key: 'eps', label: 'Diluted EPS' }], format: 'perShare', overlay: { key: 'pe', label: 'P/E', format: 'multiple' } },
  { id: 'epsAdjusted', title: 'EPS (adjusted)', category: 'Income', kind: 'bar', series: [{ key: 'epsAdjusted', label: 'Adjusted EPS' }], format: 'perShare', overlay: { key: 'peAdjusted', label: 'P/E adjusted', format: 'multiple' }, withEstimates: true, note: 'As reported; hatched bars are consensus' },
  { id: 'opex', title: 'Operating expenses', category: 'Income', kind: 'stack', series: [{ key: 'sga', label: 'SG&A' }, { key: 'rnd', label: 'R&D' }], format: 'money' },
  { id: 'rnd', title: 'Research & development', category: 'Income', kind: 'bar', series: [{ key: 'rnd', label: 'R&D' }], format: 'money', overlay: { key: 'rndPct', label: 'R&D / revenue', format: 'pct' } },
  { id: 'interestExpense', title: 'Interest expense', category: 'Income', kind: 'bar', series: [{ key: 'interestExpense', label: 'Interest expense' }], format: 'money', overlay: { key: 'interestCoverage', label: 'Interest coverage', format: 'multiple' } },
  { id: 'incomeTax', title: 'Income tax', category: 'Income', kind: 'bar', series: [{ key: 'incomeTax', label: 'Income tax' }], format: 'money', overlay: { key: 'effectiveTaxRate', label: 'Effective tax rate', format: 'pct' } },

  // ---- Growth & margins ---------------------------------------------------
  { id: 'margins', title: 'Margins', category: 'Growth & margins', kind: 'line', series: [{ key: 'grossMargin', label: 'Gross' }, { key: 'operatingMargin', label: 'Operating' }, { key: 'netMargin', label: 'Net' }], format: 'pct', withEstimates: true },
  { id: 'revenueGrowth', title: 'Revenue growth', category: 'Growth & margins', kind: 'bar', series: [{ key: 'revenueGrowth', label: 'Revenue growth' }], format: 'pct', note: 'Against the same period a year earlier', withEstimates: true },
  { id: 'epsGrowth', title: 'EPS growth', category: 'Growth & margins', kind: 'bar', series: [{ key: 'epsGrowth', label: 'EPS growth' }], format: 'pct', note: 'GAAP, against the same period a year earlier' },
  { id: 'epsAdjustedGrowth', title: 'EPS growth (adjusted)', category: 'Growth & margins', kind: 'bar', series: [{ key: 'epsAdjustedGrowth', label: 'Adjusted EPS growth' }], format: 'pct', note: 'Against the same period a year earlier', withEstimates: true },
  { id: 'fcfGrowth', title: 'Free cash flow growth', category: 'Growth & margins', kind: 'bar', series: [{ key: 'fcfGrowth', label: 'FCF growth' }], format: 'pct', note: 'Against the same period a year earlier' },
  { id: 'ebitdaMargin', title: 'EBITDA margin', category: 'Growth & margins', kind: 'line', series: [{ key: 'ebitdaMargin', label: 'EBITDA margin' }], format: 'pct', withEstimates: true },
  { id: 'fcfMargin', title: 'Free cash flow margin', category: 'Growth & margins', kind: 'line', series: [{ key: 'fcfMargin', label: 'FCF margin' }], format: 'pct' },

  // ---- Cash flow ----------------------------------------------------------
  { id: 'operatingCashFlow', title: 'Operating cash flow', category: 'Cash flow', kind: 'bar', series: [{ key: 'operatingCashFlow', label: 'Operating cash flow' }], format: 'money' },
  { id: 'freeCashFlow', title: 'Free cash flow', category: 'Cash flow', kind: 'bar', series: [{ key: 'freeCashFlow', label: 'Free cash flow' }], format: 'money', overlay: { key: 'pfcf', label: 'P/FCF', format: 'multiple' } },
  { id: 'fcfVsNetIncome', title: 'Free cash flow vs net income', category: 'Cash flow', kind: 'group', series: [{ key: 'freeCashFlow', label: 'Free cash flow' }, { key: 'netIncome', label: 'Net income' }], format: 'money', note: 'Earnings quality: cash against accounting profit' },
  { id: 'capex', title: 'Capital expenditure', category: 'Cash flow', kind: 'bar', series: [{ key: 'capex', label: 'Capex' }], format: 'money', overlay: { key: 'capexPct', label: 'Capex / revenue', format: 'pct' } },
  { id: 'capexVsDna', title: 'Capex vs depreciation', category: 'Cash flow', kind: 'group', series: [{ key: 'capex', label: 'Capex' }, { key: 'dna', label: 'D&A' }], format: 'money', note: 'Capex above depreciation is investing for growth' },
  { id: 'sbc', title: 'Stock-based compensation', category: 'Cash flow', kind: 'bar', series: [{ key: 'sbc', label: 'SBC' }], format: 'money', overlay: { key: 'sbcPct', label: 'SBC / revenue', format: 'pct' } },
  { id: 'fcfAfterSbc', title: 'Free cash flow after SBC', category: 'Cash flow', kind: 'bar', series: [{ key: 'fcfVsSbc', label: 'FCF less SBC' }], format: 'money', note: 'Treats share-based pay as the cost it is' },

  // ---- Per share ----------------------------------------------------------
  { id: 'fcfPerShare', title: 'Free cash flow per share', category: 'Per share', kind: 'bar', series: [{ key: 'fcfPerShare', label: 'FCF / share' }], format: 'perShare', overlay: PRICE },
  { id: 'bookValuePerShare', title: 'Book value per share', category: 'Per share', kind: 'bar', series: [{ key: 'bookValuePerShare', label: 'Book / share' }], format: 'perShare', overlay: PRICE },
  { id: 'dilutedShares', title: 'Shares outstanding', category: 'Per share', kind: 'bar', series: [{ key: 'dilutedShares', label: 'Diluted shares' }], format: 'shares', note: 'Falling means buybacks outpace dilution' },

  // ---- Capital return -----------------------------------------------------
  { id: 'dividendPerShare', title: 'Dividends per share', category: 'Capital return', kind: 'bar', series: [{ key: 'dividendPerShare', label: 'Dividend / share' }], format: 'perShare', overlay: { key: 'dividendYield', label: 'Dividend yield', format: 'pct' } },
  { id: 'returnOfCapital', title: 'Return of capital', category: 'Capital return', kind: 'stack', series: [{ key: 'dividends', label: 'Dividends' }, { key: 'buybacks', label: 'Buybacks' }], format: 'money' },
  { id: 'buybacks', title: 'Buybacks', category: 'Capital return', kind: 'bar', series: [{ key: 'buybacks', label: 'Buybacks' }], format: 'money', overlay: { key: 'dilutedShares', label: 'Shares outstanding', format: 'shares' } },
  { id: 'payoutRatio', title: 'Dividend payout ratio', category: 'Capital return', kind: 'line', series: [{ key: 'payoutRatio', label: 'Payout ratio' }], format: 'pct', note: 'Trailing-year dividends over net income' },

  // ---- Balance sheet ------------------------------------------------------
  { id: 'cashDebt', title: 'Cash & debt', category: 'Balance sheet', kind: 'group', series: [{ key: 'cash', label: 'Cash & investments' }, { key: 'totalDebt', label: 'Total debt' }], format: 'money' },
  { id: 'netDebt', title: 'Net debt', category: 'Balance sheet', kind: 'bar', series: [{ key: 'netDebt', label: 'Net debt' }], format: 'money', overlay: { key: 'netDebtToEbitda', label: 'Net debt / EBITDA', format: 'multiple' } },
  { id: 'assetsLiabilities', title: 'Assets & liabilities', category: 'Balance sheet', kind: 'group', series: [{ key: 'totalAssets', label: 'Assets' }, { key: 'totalLiabilities', label: 'Liabilities' }], format: 'money' },
  { id: 'equity', title: "Shareholders' equity", category: 'Balance sheet', kind: 'bar', series: [{ key: 'equity', label: 'Equity' }], format: 'money' },
  { id: 'goodwill', title: 'Goodwill & intangibles', category: 'Balance sheet', kind: 'bar', series: [{ key: 'goodwillIntangibles', label: 'Goodwill & intangibles' }], format: 'money', overlay: { key: 'goodwillPct', label: 'Share of assets', format: 'pct' } },
  { id: 'inventory', title: 'Inventory', category: 'Balance sheet', kind: 'bar', series: [{ key: 'inventory', label: 'Inventory' }], format: 'money' },
  { id: 'currentRatio', title: 'Current ratio', category: 'Balance sheet', kind: 'line', series: [{ key: 'currentRatio', label: 'Current ratio' }], format: 'ratio', note: 'Current assets over current liabilities' },
  { id: 'debtToEquity', title: 'Debt / equity', category: 'Balance sheet', kind: 'line', series: [{ key: 'debtToEquity', label: 'Debt / equity' }], format: 'ratio' },

  // ---- Returns ------------------------------------------------------------
  { id: 'roic', title: 'Return on invested capital', category: 'Returns', kind: 'line', series: [{ key: 'roic', label: 'ROIC' }], format: 'pct', note: 'Trailing-year after-tax EBIT over debt plus equity less cash' },
  { id: 'roe', title: 'Return on equity', category: 'Returns', kind: 'line', series: [{ key: 'roe', label: 'ROE' }], format: 'pct' },
  { id: 'roa', title: 'Return on assets', category: 'Returns', kind: 'line', series: [{ key: 'roa', label: 'ROA' }], format: 'pct' },

  // ---- Mix ----------------------------------------------------------------
  { id: 'productSegments', title: 'Revenue by segment', category: 'Mix', kind: 'segments', series: [], format: 'money', annualOnly: true, segmentSource: 'product' },
  { id: 'geoSegments', title: 'Revenue by geography', category: 'Mix', kind: 'segments', series: [], format: 'money', annualOnly: true, segmentSource: 'geographic' },
];

/** What a new user sees: the Qualtrim-style overview. */
export const DEFAULT_CHART_IDS = [
  'price',
  'revenue',
  'epsAdjusted',
  'freeCashFlow',
  'ebitda',
  'netIncome',
  'margins',
  'revenueGrowth',
  'dilutedShares',
  'cashDebt',
  'returnOfCapital',
  'dividendPerShare',
  'roic',
  'productSegments',
  'sbc',
  'pe',
];

export const chartById = new Map(CHARTS.map((c) => [c.id, c]));
