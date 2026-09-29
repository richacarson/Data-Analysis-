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
import { isFinancialSector } from './applicability';
import { peerMedian, type PeerPe } from './peer-pe';

/**
 * A P/E this high comes from a year of near-zero earnings, not from what the
 * market pays for the business. Pagaya's history carried such years and put
 * its exit multiple at 113x.
 */
export const MAX_HISTORICAL_PE = 100;

/** An industry P/E older than this is not today's sector rating. */
export const MAX_INDUSTRY_AGE_DAYS = 14;

/** Consensus EPS growth to the horizon above which the exit cannot exceed today's multiple. */
export const FAST_GROWTH = 0.15;

/** Years of own history needed before its high caps the exit multiple. */
export const MIN_HISTORY_FOR_CAP = 3;

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
  industryPe: Array<{ date: string; pe: number; exchange?: string; industry?: string }>;
  /** Trailing P/Es of the company's listed peers; their median is the sector anchor when enough are usable. */
  peers?: PeerPe[];
  /** Where the stock trades, to match the industry rows against. */
  exchange?: string;
  sector?: string;
  industry?: string;
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
  /** Set when the listing is inactive, stale or not common stock (see listingIssue). */
  listingIssue?: string | null;
  today?: Date;
}

export interface HouseResult {
  horizon: { estimate: HouseEstimate; years: number; fiscalYear: string } | null;
  horizonNote: string | null;
  /** Set when a thin horizon year was replaced by extending the furthest well-covered year. */
  horizonExtended: { fromFiscalYear: string; growth: number; capped: boolean; years: number } | null;
  /** Consensus at the horizon, in the quote currency. */
  epsAtHorizon: number | null;
  anchors: ExitMultipleAnchors;
  exitPe: number | null;
  exitPeSource: string | null;
  /** The exit multiple the anchors (and cap) give, before any manual override. */
  modelExitPe: number | null;
  /** Set when the exit was capped: at the company's own highest P/E, or at today's multiple for a fast grower. */
  exitCapNote: string | null;
  /** The fast-grower cap bound: the exit is today's multiple of current-year consensus. */
  growthCapped: boolean;
  /** Consensus EPS growth a year from the current year to the horizon. */
  epsGrowthToHorizon: number | null;
  /** The exit and return the fast-grower cap replaced. */
  beforeGrowthCap: { exitPe: number; totalCagr: number } | null;
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

/** Growth used to extend consensus past its last well-covered year, bounded both ways. */
export const MAX_EXTENSION_GROWTH = 0.25;
export const MIN_EXTENSION_GROWTH = -0.1;

/**
 * The company's consensus growth rate, to carry its last well-covered year out
 * to the horizon: from the first forecast year to that year where they are at
 * least ten months apart, otherwise across every published year.
 */
export function extensionGrowth(
  forward: HouseEstimate[],
  covered: HouseEstimate,
  today: Date,
): { rate: number; capped: boolean } | null {
  const yearsTo = (e: HouseEstimate) =>
    (Date.parse(`${e.date.slice(0, 10)}T00:00:00Z`) - today.getTime()) / 86_400_000 / 365.25;
  const first = forward[0];
  const last = forward[forward.length - 1];
  const pairs: Array<[HouseEstimate, HouseEstimate]> = [];
  if (first && first !== covered) pairs.push([first, covered]);
  if (first && last && last !== first) pairs.push([first, last]);
  for (const [a, b] of pairs) {
    const span = yearsTo(b) - yearsTo(a);
    if (span < 0.8 || !(a.epsAvg > 0) || !(b.epsAvg > 0)) continue;
    const raw = Math.pow(b.epsAvg / a.epsAvg, 1 / span) - 1;
    const rate = Math.min(MAX_EXTENSION_GROWTH, Math.max(MIN_EXTENSION_GROWTH, raw));
    return { rate, capped: rate !== raw };
  }
  return null;
}

export function houseReturn(input: HouseInputs): HouseResult {
  const today = input.today ?? new Date();
  const fiscalYearEnds = input.annual.map((r) => ({ date: r.date, fiscalYear: r.fiscalYear }));
  const fiscalYearOf = fiscalYearLabeler(fiscalYearEnds);

  // ---- Horizon: the well-covered year nearest the target -----------------
  /*
   * Where the year nearest the target is too thinly covered, the furthest
   * well-covered year is extended out to it at the company's own consensus
   * growth, so every return spans roughly the same holding period. Shortening
   * the horizon instead left a third of the screen annualized over 1.3 or 2
   * years, and a short period magnifies any gap to the price.
   */
  const chosen = pickCoveredHorizon(input.forward, input.horizonYears, today);
  let horizon = chosen ? { estimate: chosen.estimate, years: chosen.years, fiscalYear: fiscalYearOf(chosen.estimate.date) } : null;
  let horizonNote: string | null = null;
  let horizonExtended: HouseResult['horizonExtended'] = null;
  // The year to extend to: the thin year nearest the target, or, where FMP
  // publishes nothing that far out (JPMorgan, Jabil), the last year carried
  // forward by whole years until it lands nearest the target.
  let target: { date: string; thin: string } | null = null;
  if (chosen?.skipped) {
    const a = chosen.skipped.analysts;
    target = {
      date: chosen.skipped.estimate.date,
      thin: `FY${fiscalYearOf(chosen.skipped.estimate.date)} rests on ${a} analyst${a === 1 ? '' : 's'}, too thin to anchor on`,
    };
  } else if (chosen && input.horizonYears - chosen.years >= 0.5) {
    const k = Math.round(input.horizonYears - chosen.years);
    const d = new Date(`${chosen.estimate.date.slice(0, 10)}T00:00:00Z`);
    d.setUTCFullYear(d.getUTCFullYear() + k);
    const date = d.toISOString().slice(0, 10);
    target = { date, thin: `Consensus is published only to FY${fiscalYearOf(chosen.estimate.date)}` };
  }
  if (target && chosen && horizon) {
    const targetYears = (Date.parse(`${target.date}T00:00:00Z`) - today.getTime()) / 86_400_000 / 365.25;
    const growth = extensionGrowth(input.forward, chosen.estimate, today);
    const span = targetYears - chosen.years;
    if (growth !== null && span > 0 && chosen.estimate.epsAvg > 0) {
      const factor = Math.pow(1 + growth.rate, span);
      const from = horizon.fiscalYear;
      horizon = {
        estimate: {
          ...chosen.estimate,
          date: target.date,
          epsAvg: chosen.estimate.epsAvg * factor,
          epsLow: chosen.estimate.epsLow * factor,
          epsHigh: chosen.estimate.epsHigh * factor,
        },
        years: targetYears,
        fiscalYear: fiscalYearOf(target.date),
      };
      horizonExtended = { fromFiscalYear: from, growth: growth.rate, capped: growth.capped, years: span };
      horizonNote = `${target.thin}, so FY${from}'s consensus of ${(chosen.estimate.epsAvg * input.fxRate).toFixed(2)} (${
        chosen.estimate.numAnalystsEps
      } analysts) is extended ${span.toFixed(1)} years at ${(growth.rate * 100).toFixed(1)}% a year, its consensus growth rate${
        growth.capped ? ', capped' : ''
      }.`;
    } else if (chosen.skipped) {
      horizonNote = `${target.thin}, so the horizon is FY${horizon.fiscalYear}.`;
    }
  }
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
  /*
   * FMP publishes industry P/Es per exchange, and lately for NASDAQ alone.
   * Atmos Energy (NYSE) was anchored on 8.0x: two NASDAQ "Regulated Gas" rows
   * from October 2025, treated as today's sector rating. A figure only counts
   * if it is recent and describes companies on the stock's own exchange.
   */
  let industryNow: number | null = null;
  let industryMedian: number | null = null;
  let industryExcluded: string | null = null;
  if (input.industryPe.length) {
    const exchange = input.exchange?.toUpperCase();
    const onExchange = exchange
      ? input.industryPe.filter((r) => (r.exchange ?? '').toUpperCase() === exchange)
      : input.industryPe;
    const pool = onExchange.length ? onExchange : input.industryPe;
    const latest = pool.reduce((a, r) => (r.date > a ? r.date : a), pool[0].date);
    industryNow = median(pool.filter((r) => r.date === latest).map((r) => r.pe));
    industryMedian = median(pool.map((r) => r.pe));
    const ageDays = (today.getTime() - Date.parse(`${latest.slice(0, 10)}T00:00:00Z`)) / 86_400_000;
    const name = input.industry ?? pool[0].industry ?? 'industry';
    if (!onExchange.length) {
      const exchanges = [...new Set(input.industryPe.map((r) => r.exchange).filter(Boolean))].join(' and ');
      industryExcluded = `Excluded: FMP's ${name} figure covers ${exchanges || 'another exchange'}-listed companies only, and this stock trades on ${input.exchange}. A different, often much smaller set of companies is not its peer group.`;
    } else if (ageDays > MAX_INDUSTRY_AGE_DAYS) {
      industryExcluded = `Excluded: FMP's latest ${name} figure is from ${latest.slice(0, 10)}, ${Math.round(ageDays / 30)} months old, so it says nothing about the sector's rating today.`;
    }
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
  // Regulated utilities earn close to their cost of capital by design and a
  // lender's ROIC describes nothing, so the formula gave Atmos Energy 2.6x.
  const sectorText = `${input.sector ?? ''} ${input.industry ?? ''}`;
  const justifiedExcluded = /utilit|regulated/i.test(sectorText)
    ? 'Excluded: a regulated utility earns close to its cost of capital by design, so this formula returns a multiple no utility trades at.'
    : isFinancialSector(input.sector ?? '', input.industry ?? '')
      ? "Excluded: return on invested capital does not describe a lender's or insurer's economics, so the formula has nothing sound to work from."
      : null;

  const anchors = exitMultipleAnchors({
    ownHistory,
    industryPe: industryNow,
    industryMedian,
    justified,
    industryExcluded,
    justifiedExcluded,
    peers: input.peers ? peerMedian(input.peers) : null,
    industryNotComparable:
      peBasis === 'adjusted' && basis.materialGap && basis.medianRatio
        ? `Excluded: industry multiples are computed on GAAP earnings, and this company's adjusted earnings run ${basis.medianRatio.toFixed(2)}x GAAP. Applied to adjusted consensus they would overstate the exit price.`
        : null,
  });

  // The anchors can blend toward a sector or justified multiple the stock has
  // never traded at: Full Truck Alliance and Atour screened at +76% and +65%
  // on re-ratings toward US peers. Without an override, the exit multiple
  // stops at the highest P/E the company has actually carried.
  const ownMax = ownHistory.length >= MIN_HISTORY_FOR_CAP ? Math.max(...ownHistory) : null;

  /*
   * No multiple expansion for fast growers. Nu, Toast and Q2 turned
   * profitable recently, so their own-history P/Es come from years of tiny
   * earnings: exits of 27x, 41x and 63x against 14x, 22x and 19x on this
   * year's consensus today. A company growing fast now is growing slower at the
   * horizon, and its multiple compresses rather than doubles. Where consensus
   * EPS compounds faster than 15% a year to the horizon, the exit stops at
   * today's multiple of current-year consensus, and even that is generous.
   */
  const current = input.forward[0];
  const yearsToCurrent = current
    ? (Date.parse(`${current.date.slice(0, 10)}T00:00:00Z`) - today.getTime()) / 86_400_000 / 365.25
    : null;
  const epsGrowthToHorizon =
    current && horizon && yearsToCurrent !== null && horizon.years - yearsToCurrent >= 0.8 && current.epsAvg > 0 && horizon.estimate.epsAvg > 0
      ? Math.pow(horizon.estimate.epsAvg / current.epsAvg, 1 / (horizon.years - yearsToCurrent)) - 1
      : null;
  const todaysPe = current && current.epsAvg > 0 ? input.price / (current.epsAvg * input.fxRate) : null;
  const growthCap =
    epsGrowthToHorizon !== null && epsGrowthToHorizon > FAST_GROWTH && todaysPe !== null ? todaysPe : null;

  // What the model would use: the anchors, then whichever cap binds lower.
  let modelExitPe = anchors.recommended ?? null;
  let capNote: string | null = null;
  let capSource: string | null = null;
  if (modelExitPe !== null && ownMax !== null && modelExitPe > ownMax) {
    capNote = `Exit multiple capped at ${ownMax.toFixed(1)}x, the highest P/E it has traded at in the ${ownHistory.length} years used. The anchors' ${modelExitPe.toFixed(1)}x would assume a re-rating it has never had.`;
    capSource = "the company's own highest historical P/E (capped)";
    modelExitPe = ownMax;
  }
  const exitBeforeGrowthCap = modelExitPe;
  if (modelExitPe !== null && growthCap !== null && modelExitPe > growthCap) {
    capNote = `Exit capped at today's ${growthCap.toFixed(1)}x (price over FY${fiscalYearOf(current!.date)} consensus). With EPS compounding ${(
      epsGrowthToHorizon! * 100
    ).toFixed(0)}% a year, the model's ${modelExitPe.toFixed(1)}x would assume a fast grower re-rates upward as its growth slows. Multiples usually compress instead, so treat this return as an upper bound.`;
    capSource = "today's multiple of current-year consensus (fast-grower cap)";
    modelExitPe = growthCap;
  }
  const capped = input.exitPeOverride === undefined && capNote !== null;
  const exitPe = input.exitPeOverride ?? modelExitPe;
  const exitPeSource =
    input.exitPeOverride !== undefined
      ? `your own exit multiple${modelExitPe !== null ? ` (the model's is ${modelExitPe.toFixed(1)}x)` : ''}`
      : capped
        ? capSource
        : anchors.recommendedSource;
  const exitCapNote = capped ? capNote : null;
  const growthCapped = capped && capSource?.includes('fast-grower') === true;
  const years = horizon?.years ?? input.horizonYears;

  const expected =
    exitPe !== null && epsAtHorizon !== null
      ? expectedReturn({ price: input.price, epsAtHorizon, exitMultiple: exitPe, dividendYield: input.dividendYield, years })
      : null;
  // What the cap changed, for reviewing it across the whole screen.
  const uncapped =
    growthCapped && exitBeforeGrowthCap !== null && epsAtHorizon !== null
      ? expectedReturn({
          price: input.price,
          epsAtHorizon,
          exitMultiple: exitBeforeGrowthCap,
          dividendYield: input.dividendYield,
          years,
        })
      : null;
  const beforeGrowthCap =
    uncapped && exitBeforeGrowthCap !== null ? { exitPe: exitBeforeGrowthCap, totalCagr: uncapped.totalCagr } : null;
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

  const review =
    input.listingIssue ?? implausibleReturn({ exitPe, totalCagr: expected?.totalCagr ?? null, requiredExitPe: required });

  return {
    horizon,
    horizonNote,
    horizonExtended,
    epsAtHorizon,
    anchors,
    exitPe,
    exitPeSource,
    modelExitPe,
    exitCapNote,
    growthCapped,
    epsGrowthToHorizon,
    beforeGrowthCap,
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
