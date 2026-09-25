/**
 * Fiscal-year bookkeeping.
 *
 * FMP dates every annual record by its period end, and companies label their
 * fiscal years inconsistently against that date. Stanley Black & Decker's
 * fiscal 2025 ended on 3 January 2026, so reading the year off the date calls
 * it 2026 and every consensus figure lands one year late: the app showed $7.19
 * as FY2029 when it is the FY2028 estimate. Retailers and chipmakers ending in
 * late January label the other way round. The only reliable key is the
 * company's own `fiscalYear` on a reported statement, carried forward by
 * elapsed time.
 */

const DAY = 24 * 60 * 60 * 1000;
const YEAR_DAYS = 365.25;

function toTime(date: string): number {
  return Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
}

export interface FiscalAnchor {
  /** Period end of a reported annual statement. */
  date: string;
  /** The company's own label for that year. */
  fiscalYear: string;
}

/**
 * Returns a function labelling any annual period end with its fiscal year.
 *
 * Calibrated on the most recent reported year and extended by whole years of
 * elapsed time, which absorbs 52/53-week calendars whose end date drifts by a
 * few days either side of the new year.
 */
export function fiscalYearLabeler(anchors: FiscalAnchor[]): (date: string) => string {
  const usable = anchors
    .filter((a) => /^\d{4}$/.test(a.fiscalYear) && Number.isFinite(toTime(a.date)))
    .sort((a, b) => b.date.localeCompare(a.date));
  const anchor = usable[0];

  if (!anchor) return (date) => date.slice(0, 4);

  const anchorTime = toTime(anchor.date);
  const anchorYear = Number(anchor.fiscalYear);

  return (date) => {
    const t = toTime(date);
    if (!Number.isFinite(t)) return date.slice(0, 4);
    return String(anchorYear + Math.round((t - anchorTime) / DAY / YEAR_DAYS));
  };
}

/**
 * Estimates for fiscal years not yet reported.
 *
 * FMP's estimates endpoint returns historical consensus alongside forecasts.
 * Treating the 2020 estimate as the first forecast year made a nine-year
 * "forward" growth rate out of stale numbers and discounted six years that had
 * already happened.
 */
export function forwardEstimates<T extends { date: string }>(
  estimates: T[],
  lastReportedPeriodEnd: string | null,
  today: Date = new Date(),
): T[] {
  const todayIso = today.toISOString().slice(0, 10);
  const cutoff =
    lastReportedPeriodEnd && lastReportedPeriodEnd > todayIso ? lastReportedPeriodEnd : todayIso;
  // A year that has ended but is not yet filed is history, not a forecast.
  return [...estimates]
    .filter((e) => e.date.slice(0, 10) > cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface HorizonChoice<T> {
  estimate: T;
  /** Actual time from today to that fiscal year end, used in the return maths. */
  years: number;
}

/**
 * The forecast year whose end falls closest to the chosen horizon.
 *
 * "Three years out" in September lands nearer one fiscal year end than the
 * next; picking by label instead can leave the real holding period anywhere
 * between three and four years while the CAGR divides by three.
 */
export function pickHorizon<T extends { date: string }>(
  forward: T[],
  horizonYears: number,
  today: Date = new Date(),
): HorizonChoice<T> | null {
  let best: HorizonChoice<T> | null = null;
  let bestGap = Infinity;

  for (const estimate of forward) {
    const years = (toTime(estimate.date) - today.getTime()) / DAY / YEAR_DAYS;
    if (!(years > 0)) continue;
    const gap = Math.abs(years - horizonYears);
    // On a tie prefer the later year: it is the more conservative holding period.
    if (gap < bestGap || (gap === bestGap && best && years > best.years)) {
      best = { estimate, years };
      bestGap = gap;
    }
  }

  return best;
}

/** Estimates need this many analysts before they anchor a horizon. */
export const MIN_ANALYSTS = 3;
/** ...and at least this share of the company's best-covered forecast year. */
export const MIN_COVERAGE_SHARE = 0.3;

export interface CoveredHorizon<T> extends HorizonChoice<T> {
  /** Set when the year nearest the horizon was too thinly covered to use. */
  skipped: { estimate: T; analysts: number } | null;
}

/**
 * The horizon year, restricted to estimates with real coverage.
 *
 * FMP's furthest years often rest on one or two analysts and do not hang
 * together: Keysight's FY2029 was a single analyst at $11.18 (below its own
 * FY2028), Fortinet's FY2029 sat below FY2028 on 5 analysts against 25 for
 * FY2027. Where coverage is solid FMP agrees with other sources — Freeport's
 * FY2028 is $4.46 on 10 analysts against Seeking Alpha's $4.49. So a year
 * counts only with at least three analysts and at least 30% of the
 * best-covered year; otherwise the horizon steps back to the furthest year
 * that does, and the return is measured over that shorter holding period.
 */
export function pickCoveredHorizon<T extends { date: string; numAnalystsEps?: number }>(
  forward: T[],
  horizonYears: number,
  today: Date = new Date(),
): CoveredHorizon<T> | null {
  const nominal = pickHorizon(forward, horizonYears, today);
  if (!nominal) return null;
  const peak = Math.max(0, ...forward.map((e) => e.numAnalystsEps ?? 0));
  const covered = forward.filter((e) => {
    const n = e.numAnalystsEps ?? 0;
    return n >= MIN_ANALYSTS && n >= peak * MIN_COVERAGE_SHARE;
  });
  const choice = pickHorizon(covered, horizonYears, today);
  if (!choice) return { ...nominal, skipped: null };
  const skipped =
    choice.estimate === nominal.estimate
      ? null
      : { estimate: nominal.estimate, analysts: nominal.estimate.numAnalystsEps ?? 0 };
  return { ...choice, skipped };
}
