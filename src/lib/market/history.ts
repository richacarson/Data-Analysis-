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
