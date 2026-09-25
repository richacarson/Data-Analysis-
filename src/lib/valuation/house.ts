/**
 * The house expected return, in one place.
 *
 * The screen and the stock page used to compute this separately and drifted:
 * the page took the median of five anchors while the screen used the
 * company's own history alone, so Agnico Eagle read +26.9% in the table and
 * +16.0% on its page. Both now call this with the same inputs, fetched the
 * same way, so they can only differ by the moment the price was read.
 */

import { adjustedPeHistory, annualAdjustedEps, compareBases, type BasisComparison } from './earnings-basis';
import { expectedReturn, implausibleReturn, justifiedPriceEarnings, requiredExitMultiple, scenarioGrid } from './expected-return';
import { exitMultipleAnchors, median, type ExitMultipleAnchors } from './exit-multiple';
import { fiscalYearLabeler, pickCoveredHorizon } from './fiscal';
import { costOfEquity } from './wacc';

/**
 * A P/E this high comes from a year of near-zero earnings, not from what the
 * market pays for the business. Pagaya's history carried such years and put
 * its exit multiple at 113x.
 */
export const MAX_HISTORICAL_PE = 100;

export interface HouseEstimate {
  date: string;
  epsAvg: number;
  epsLow: number;
  epsHigh: number;
  numAnalystsEps: number;
}

export interface HouseInputs {
  price: number;
  /** Consensus for unreported years only, oldest first. */
  forward: HouseEstimate[];
  /** Annual ratios, newest first: fiscal year ends, FMP's P/E and GAAP EPS per share. */
  annual: Array<{ date: string; fiscalYear: string; priceToEarningsRatio: number; netIncomePerShare: number }>;
  earnings: Array<{ date: string; epsActual: number | null }>;
  /** Industry P/E rows over the past year, per exchange per day. */
  industryPe: Array<{ date: string; pe: number }>;
  roic: number;
  beta: number;
  riskFreeRate: number;
  equityRiskPremium: number;
  dividendYield: number;
  horizonYears: number;
  hurdle: number;
  /** Units of the quote currency per unit of the reporting currency. */
  fxRate: number;
  /** Reports in another currency: the earnings feed's adjusted history is not dependable. */
  foreign: boolean;
  exitPeOverride?: number;
  today?: Date;
}

export interface HouseResult {
  horizon: { estimate: HouseEstimate; years: number; fiscalYear: string } | null;
  horizonNote: string | null;
  /** Consensus at the horizon, in the quote currency. */
  epsAtHorizon: number | null;
  anchors: ExitMultipleAnchors;
  exitPe: number | null;
  exitPeSource: string | null;
  peBasis: 'adjusted' | 'gaap';
  basis: BasisComparison;
  sustainableGrowth: number;
  forwardEpsCagr: number | null;
  expected: ReturnType<typeof expectedReturn>;
  requiredExitMultiple: number | null;
  scenarios: ReturnType<typeof scenarioGrid> | null;
  /** Set when the output is implausible; the row is held rather than ranked. */
  review: string | null;
}

export function houseReturn(input: HouseInputs): HouseResult {
  const today = input.today ?? new Date();
  const fiscalYearEnds = input.annual.map((r) => ({ date: r.date, fiscalYear: r.fiscalYear }));
  const fiscalYearOf = fiscalYearLabeler(fiscalYearEnds);

  // ---- Horizon: the well-covered year nearest the target -----------------
  const chosen = pickCoveredHorizon(input.forward, input.horizonYears, today);
  const horizon = chosen ? { estimate: chosen.estimate, years: chosen.years, fiscalYear: fiscalYearOf(chosen.estimate.date) } : null;
  const horizonNote = chosen?.skipped
    ? `FY${fiscalYearOf(chosen.skipped.estimate.date)} rests on ${chosen.skipped.analysts} analyst${chosen.skipped.analysts === 1 ? '' : 's'}, too thin to anchor on, so the horizon is FY${horizon?.fiscalYear}.`
    : null;
  const epsAtHorizon = horizon && horizon.estimate.epsAvg > 0 ? horizon.estimate.epsAvg * input.fxRate : null;

  // ---- Own history, on the basis consensus is quoted on -------------------
  // Price at each fiscal year end from FMP's own P/E and EPS; paired with
  // adjusted earnings where the quarterly history supports it.
  const adjustedYears = input.foreign ? [] : annualAdjustedEps(input.earnings, fiscalYearEnds);
  const adjustedPes = adjustedPeHistory(
    input.annual
      .filter((r) => r.priceToEarningsRatio * r.netIncomePerShare > 0)
      .map((r) => ({ year: fiscalYearOf(r.date), price: r.priceToEarningsRatio * r.netIncomePerShare })),
    adjustedYears,
  );
  const peBasis: 'adjusted' | 'gaap' = adjustedPes.length >= 3 ? 'adjusted' : 'gaap';
  const ownHistory = (peBasis === 'adjusted' ? adjustedPes : input.annual.map((r) => r.priceToEarningsRatio)).filter(
    (pe) => pe > 0 && pe <= MAX_HISTORICAL_PE,
  );
  const basis = compareBases(
    input.annual.map((r) => ({ fiscalYear: r.fiscalYear, epsDiluted: r.netIncomePerShare })),
    adjustedYears,
  );

  // ---- Sector: today's industry multiple and its past year ---------------
  let industryNow: number | null = null;
  let industryMedian: number | null = null;
  if (input.industryPe.length) {
    const latest = input.industryPe.reduce((a, r) => (r.date > a ? r.date : a), input.industryPe[0].date);
    industryNow = median(input.industryPe.filter((r) => r.date === latest).map((r) => r.pe));
    industryMedian = median(input.industryPe.map((r) => r.pe));
  }

  // ---- What the returns on capital justify --------------------------------
  const first = input.forward[0];
  const last = input.forward[input.forward.length - 1];
  const forwardEpsCagr =
    first && last && input.forward.length > 1 && first.epsAvg > 0 && last.epsAvg > 0
      ? Math.pow(last.epsAvg / first.epsAvg, 1 / (input.forward.length - 1)) - 1
      : null;
  const ke = costOfEquity({ riskFreeRate: input.riskFreeRate, equityRiskPremium: input.equityRiskPremium, beta: input.beta || 1 });
  // A perpetuity needs a sustainable rate: capped below the cost of equity and
  // what returns on capital can fund, so fast growers still get an anchor.
  const sustainableGrowth = Math.max(0, Math.min(forwardEpsCagr ?? 0, input.roic * 0.9, ke - 0.02));
  const justified = justifiedPriceEarnings(input.roic, sustainableGrowth, ke);

  const anchors = exitMultipleAnchors({
    ownHistory,
    industryPe: industryNow,
    industryMedian,
    justified,
    industryNotComparable:
      peBasis === 'adjusted' && basis.materialGap && basis.medianRatio
        ? `Excluded: industry multiples are computed on GAAP earnings, and this company's adjusted earnings run ${basis.medianRatio.toFixed(2)}x GAAP. Applied to adjusted consensus they would overstate the exit price.`
        : null,
  });

  const exitPe = input.exitPeOverride ?? anchors.recommended ?? null;
  const exitPeSource = input.exitPeOverride !== undefined ? 'Manual override' : anchors.recommendedSource;
  const years = horizon?.years ?? input.horizonYears;

  const expected =
    exitPe !== null && epsAtHorizon !== null
      ? expectedReturn({ price: input.price, epsAtHorizon, exitMultiple: exitPe, dividendYield: input.dividendYield, years })
      : null;
  const required =
    epsAtHorizon !== null ? requiredExitMultiple(input.price, epsAtHorizon, input.hurdle, input.dividendYield, years) : null;
  const scenarios =
    horizon && exitPe !== null && epsAtHorizon !== null
      ? scenarioGrid(
          input.price,
          [
            { label: 'Analyst low', eps: horizon.estimate.epsLow * input.fxRate },
            { label: 'Consensus', eps: epsAtHorizon },
            { label: 'Analyst high', eps: horizon.estimate.epsHigh * input.fxRate },
          ],
          [exitPe * 0.8, exitPe, exitPe * 1.2],
          input.dividendYield,
          years,
          input.hurdle,
        )
      : null;

  const review = implausibleReturn({ exitPe, totalCagr: expected?.totalCagr ?? null, requiredExitPe: required });

  return {
    horizon,
    horizonNote,
    epsAtHorizon,
    anchors,
    exitPe,
    exitPeSource,
    peBasis,
    basis,
    sustainableGrowth,
    forwardEpsCagr,
    expected,
    requiredExitMultiple: required,
    scenarios,
    review: review ? `Held for review: ${review}` : null,
  };
}
