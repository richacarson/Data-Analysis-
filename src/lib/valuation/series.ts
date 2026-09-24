/**
 * Derived chart series. Pure functions over statement rows.
 */

export interface QuarterRow {
  date: string;
  fiscalYear: string;
  period: string;
  revenue: number;
  netIncome: number;
  freeCashFlow?: number;
}

export interface TtmPoint {
  label: string;
  date: string;
  revenue: number;
  netIncome: number;
  margin: number;
}

/**
 * Trailing-twelve-month series from quarterly statements.
 *
 * A single quarter's margin is noisy and seasonal; summing four of them is how
 * these are read. Quarters arrive newest-first from the API and are summed in
 * chronological order here.
 */
export function trailingTwelveMonths(quarters: QuarterRow[]): TtmPoint[] {
  const chronological = [...quarters].sort((a, b) => a.date.localeCompare(b.date));
  const points: TtmPoint[] = [];

  for (let i = 3; i < chronological.length; i++) {
    const window = chronological.slice(i - 3, i + 1);
    const revenue = window.reduce((sum, q) => sum + (q.revenue || 0), 0);
    const netIncome = window.reduce((sum, q) => sum + (q.netIncome || 0), 0);
    const current = chronological[i];

    points.push({
      label: `${current.period} ${current.fiscalYear}`,
      date: current.date,
      revenue,
      netIncome,
      // A negative margin is meaningful here — it is the loss-making era, and
      // watching it cross zero is the point of the chart.
      margin: revenue > 0 ? netIncome / revenue : 0,
    });
  }

  return points;
}

export interface EpsPoint {
  year: string;
  eps: number;
  /** Reported results versus analyst consensus, drawn differently. */
  actual: boolean;
  low?: number;
  high?: number;
}

/**
 * Reported EPS joined to consensus for the years ahead.
 *
 * Where a fiscal year appears in both, the reported figure wins: an actual
 * result supersedes the estimate that preceded it.
 */
export function epsActualVsEstimate(
  reported: Array<{ fiscalYear: string; epsDiluted: number }>,
  estimates: Array<{ date: string; epsAvg: number; epsLow: number; epsHigh: number }>,
  fiscalYearOf: (date: string) => string = (date) => date.slice(0, 4),
): EpsPoint[] {
  const byYear = new Map<string, EpsPoint>();

  for (const e of estimates) {
    const year = fiscalYearOf(e.date);
    if (!Number.isFinite(e.epsAvg)) continue;
    byYear.set(year, { year, eps: e.epsAvg, actual: false, low: e.epsLow, high: e.epsHigh });
  }
  for (const r of reported) {
    if (!Number.isFinite(r.epsDiluted)) continue;
    byYear.set(r.fiscalYear, { year: r.fiscalYear, eps: r.epsDiluted, actual: true });
  }

  return [...byYear.values()].sort((a, b) => a.year.localeCompare(b.year));
}

export interface SegmentPoint {
  year: string;
  [segment: string]: string | number;
}

export interface SegmentSeries {
  points: SegmentPoint[];
  segments: string[];
}

/**
 * Revenue by segment, as a stacked series.
 *
 * Companies rename and re-cut their segments — Apple's 2011 breakdown shares no
 * labels with its 2025 one — so only segments present in the most recent year
 * are charted, and only years that report them.
 */
export function revenueBySegment(
  rows: Array<{ fiscalYear: number; data: Record<string, number> }>,
  years = 10,
): SegmentSeries {
  const chronological = [...rows].sort((a, b) => a.fiscalYear - b.fiscalYear);
  const latest = chronological[chronological.length - 1];
  if (!latest) return { points: [], segments: [] };

  const segments = Object.keys(latest.data).sort(
    (a, b) => (latest.data[b] ?? 0) - (latest.data[a] ?? 0),
  );

  const points = chronological
    // A year missing every current segment predates this taxonomy entirely.
    .filter((r) => segments.some((s) => typeof r.data[s] === 'number'))
    .slice(-years)
    .map((r) => {
      const point: SegmentPoint = { year: String(r.fiscalYear) };
      for (const s of segments) point[s] = r.data[s] ?? 0;
      return point;
    });

  return { points, segments };
}

export interface IndexedPoint {
  year: string;
  price: number;
  fundamental: number;
}

/**
 * Two series rebased to 100 at the first period.
 *
 * The usual "price versus free cash flow" chart puts them on two axes, where
 * the apparent relationship is an artifact of whichever ranges were chosen —
 * nudge the scales and the same data shows price running ahead or behind.
 * Rebasing both to a common start makes the divergence the actual subject: if
 * price reads 400 and cash flow 150, price has outrun the business by that gap.
 */
export function indexedToStart(
  rows: Array<{ year: string; price: number; fundamental: number }>,
): IndexedPoint[] {
  const usable = rows.filter((r) => r.price > 0 && r.fundamental > 0);
  const first = usable[0];
  if (!first) return [];

  return usable.map((r) => ({
    year: r.year,
    price: (r.price / first.price) * 100,
    fundamental: (r.fundamental / first.fundamental) * 100,
  }));
}
