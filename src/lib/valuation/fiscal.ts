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
