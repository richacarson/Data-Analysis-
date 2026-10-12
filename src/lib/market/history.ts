import shiller from '../../data/shiller-history.json';

/**
 * The S&P 500's valuation history from Robert Shiller's monthly data (1871
 * on): price over trailing twelve-month reported earnings, and CAPE, price
 * over ten years of inflation-adjusted earnings.
 *
 * Reported (GAAP) earnings are the only kind with a long free history. The
 * analyst EPS behind a forward P/E excludes one-off charges and runs above
 * them, so a forward P/E is never set against these figures.
 */

export type HistoryMetric = 'trailing' | 'cape';

export interface HistoryPoint {
  month: string;
  value: number;
}

export interface PeriodStats {
  label: string;
  from: string;
  average: number;
  median: number;
  /** Share of months in the period below today's value; null without today's value. */
  percentile: number | null;
}

type Row = [string, number, number, number | null];

const ROWS = (shiller as unknown as { rows: Row[] }).rows;

export const HISTORY_SOURCE = (shiller as { source: string }).source;

export function historySeries(metric: HistoryMetric): HistoryPoint[] {
  return ROWS.flatMap(([month, price, earnings, cape]) => {
    const value = metric === 'trailing' ? price / earnings : cape;
    return value !== null && Number.isFinite(value) && value > 0 ? [{ month, value }] : [];
  });
}

/** Last month in the data. */
export const HISTORY_THROUGH = ROWS[ROWS.length - 1]?.[0] ?? null;

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length / 2;
  return s.length % 2 ? s[Math.floor(mid)] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Average, median and today's rank over standard look-backs. The ten- and
 * thirty-year windows end with the data, not today.
 */
export function periodStats(series: HistoryPoint[], today: number | null): PeriodStats[] {
  if (!series.length) return [];
  const lastYear = Number(series[series.length - 1].month.slice(0, 4));
  const periods = [
    { label: 'Since 1871', from: '1871-01' },
    { label: 'Since 1960', from: '1960-01' },
    { label: 'Last 30 years', from: `${lastYear - 29}-${series[series.length - 1].month.slice(5)}` },
    { label: 'Last 10 years', from: `${lastYear - 9}-${series[series.length - 1].month.slice(5)}` },
  ];
  return periods.flatMap(({ label, from }) => {
    const values = series.filter((p) => p.month >= from).map((p) => p.value);
    if (!values.length) return [];
    const start = series.find((p) => p.month >= from)!.month;
    return [
      {
        label,
        from: start,
        average: values.reduce((t, v) => t + v, 0) / values.length,
        median: median(values),
        percentile: today !== null ? values.filter((v) => v < today).length / values.length : null,
      },
    ];
  });
}

/** Months between two YYYY-MM strings. */
function monthsBetween(a: string, b: string): number {
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
}

function addMonths(month: string, n: number): string {
  const total = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/**
 * Today's CAPE the way Shiller computes it: the index level over ten years of
 * the index's own trailing earnings, each month in today's dollars.
 *
 * Built company by company from today's members, CAPE overstates: Nvidia's
 * earnings a decade ago were a sliver of today's, though it was a small part
 * of the index then. So the index's earnings are used instead: Shiller's
 * series to the end of his data, today's from the index level over the
 * bottom-up trailing P/E, and a straight line between the two.
 */
export function indexCape(input: {
  /** Today's S&P 500 level. */
  level: number;
  /** Today's index earnings (level over trailing P/E). */
  earnings: number;
  /** YYYY-MM for today. */
  month: string;
  /** CPI for a month (YYYY-MM), or null where unknown. */
  cpi: (month: string) => number | null;
}): number | null {
  const last = ROWS[ROWS.length - 1];
  if (!last || !(input.level > 0) || !(input.earnings > 0)) return null;
  const [lastMonth, , lastEarnings] = last;
  const gap = monthsBetween(lastMonth, input.month);
  if (gap < 0) return null;

  const byMonth = new Map(ROWS.map(([m, , e]) => [m, e]));
  for (let k = 1; k <= gap; k++) {
    byMonth.set(addMonths(lastMonth, k), lastEarnings + ((input.earnings - lastEarnings) * k) / gap);
  }

  const now = input.cpi(input.month);
  if (!now) return null;
  const real: number[] = [];
  for (let k = 0; k < 120; k++) {
    const m = addMonths(input.month, -k);
    const e = byMonth.get(m);
    const then = input.cpi(m);
    if (e === undefined || !then) return null;
    real.push((e * now) / then);
  }
  const average = real.reduce((t, v) => t + v, 0) / real.length;
  return average > 0 ? input.level / average : null;
}
