/**
 * Reconciling the two earnings bases.
 *
 * Analyst estimates are quoted on an adjusted, non-GAAP basis. Income
 * statements are GAAP. Mixing them silently is the most damaging thing this
 * app can do, because the error runs the same direction every time: a GAAP
 * history against a non-GAAP forecast makes growth look faster than it is, and
 * a P/E anchored on GAAP earnings applied to non-GAAP forward earnings inflates
 * the target price.
 *
 * Stanley Black & Decker is the illustration. FY2024 GAAP diluted EPS was
 * $1.95; consensus for the same year was $4.15. Anchoring a multiple on the
 * first and applying it to the second roughly doubles the answer.
 */

export interface QuarterlyEarnings {
  date: string;
  epsActual: number | null;
}

export interface AnnualAdjustedEps {
  /** Calendar year the four quarters fall in; fiscal years rarely align exactly. */
  year: string;
  adjustedEps: number;
  quarters: number;
}

/**
 * Annual adjusted EPS, summed from reported quarters.
 *
 * Only complete years are returned: three quarters summed and labelled annual
 * would understate earnings by roughly a quarter and look like a collapse.
 */
export function annualAdjustedEps(quarters: QuarterlyEarnings[]): AnnualAdjustedEps[] {
  const byYear = new Map<string, number[]>();

  for (const q of quarters) {
    if (q.epsActual === null || !Number.isFinite(q.epsActual)) continue;
    const year = q.date.slice(0, 4);
    const bucket = byYear.get(year) ?? [];
    bucket.push(q.epsActual);
    byYear.set(year, bucket);
  }

  return [...byYear.entries()]
    .filter(([, values]) => values.length === 4)
    .map(([year, values]) => ({
      year,
      adjustedEps: values.reduce((sum, v) => sum + v, 0),
      quarters: values.length,
    }))
    .sort((a, b) => a.year.localeCompare(b.year));
}

export interface BasisGap {
  year: string;
  gaapEps: number;
  adjustedEps: number;
  /** Adjusted over GAAP. Above 1 means the adjustments add back to earnings. */
  ratio: number;
}

export interface BasisComparison {
  years: BasisGap[];
  /** Median ratio across the years compared. */
  medianRatio: number | null;
  /** Set where adjustments persistently move earnings by more than a quarter. */
  materialGap: boolean;
  note: string | null;
}

/**
 * Compares the two bases over the years where both exist.
 *
 * A persistent gap is itself a finding, not a nuisance to normalise away: a
 * company adding back the same class of charge every year is telling you those
 * costs are recurring, whatever they are labelled.
 */
export function compareBases(
  gaap: Array<{ fiscalYear: string; epsDiluted: number }>,
  adjusted: AnnualAdjustedEps[],
): BasisComparison {
  const adjustedByYear = new Map(adjusted.map((a) => [a.year, a.adjustedEps]));
  const years: BasisGap[] = [];

  for (const g of gaap) {
    const adj = adjustedByYear.get(g.fiscalYear);
    if (adj === undefined) continue;
    // A ratio against zero or negative GAAP earnings is not interpretable.
    if (!(g.epsDiluted > 0)) continue;
    years.push({
      year: g.fiscalYear,
      gaapEps: g.epsDiluted,
      adjustedEps: adj,
      ratio: adj / g.epsDiluted,
    });
  }

  if (!years.length) {
    return { years, medianRatio: null, materialGap: false, note: null };
  }

  const ratios = years.map((y) => y.ratio).sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  const medianRatio =
    ratios.length % 2 === 0 ? (ratios[mid - 1] + ratios[mid]) / 2 : ratios[mid];

  const materialGap = Math.abs(medianRatio - 1) > 0.25;

  return {
    years: years.sort((a, b) => b.year.localeCompare(a.year)),
    medianRatio,
    materialGap,
    note: materialGap
      ? `Adjusted earnings have run about ${medianRatio.toFixed(2)}x GAAP across the years compared. Consensus forecasts are quoted on the adjusted basis, so multiples here are anchored on adjusted history to match. A gap this size every year means the add-backs are recurring costs, whatever they are called.`
      : null,
  };
}

/**
 * Trailing P/E on the adjusted basis, to match the basis of the forecast.
 *
 * Pairs the share price at each fiscal year end with that year's adjusted
 * earnings, rather than the GAAP figure the ratios endpoint uses.
 */
export function adjustedPeHistory(
  pricesByYear: Array<{ year: string; price: number }>,
  adjusted: AnnualAdjustedEps[],
): number[] {
  const adjustedByYear = new Map(adjusted.map((a) => [a.year, a.adjustedEps]));

  return pricesByYear
    .map(({ year, price }) => {
      const eps = adjustedByYear.get(year);
      if (eps === undefined || !(eps > 0) || !(price > 0)) return null;
      return price / eps;
    })
    .filter((pe): pe is number => pe !== null);
}
