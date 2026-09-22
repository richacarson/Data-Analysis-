/**
 * Expected-return valuation.
 *
 * Rather than discounting cash flows to a present "fair value", this projects
 * earnings to a horizon, applies an exit multiple, and reports the annualised
 * return that implies from today's price. Total return is an identity —
 * earnings growth, plus multiple change, plus dividends — and this states it
 * directly, with two assumptions instead of a DCF's five.
 *
 * Pure functions, no I/O.
 */

export interface ExpectedReturnInputs {
  price: number;
  /** Consensus earnings per share at the horizon. */
  epsAtHorizon: number;
  /** Multiple applied to those earnings to get the price at the horizon. */
  exitMultiple: number;
  /** Current dividend yield, decimal. Treated as paid and not reinvested. */
  dividendYield: number;
  years: number;
}

export interface ExpectedReturnResult {
  targetPrice: number;
  /** Annualised return from price appreciation alone. */
  priceCagr: number;
  /** Price appreciation plus dividend yield. */
  totalCagr: number;
  /** How far below the horizon target today's price sits. */
  discountToTarget: number;
}

/**
 * Annualised return implied by a horizon price target.
 *
 * The dividend yield is added rather than compounded into the price path,
 * which is the convention the method is normally used with. It slightly
 * understates a reinvested dividend and overstates one that is spent.
 */
export function expectedReturn(input: ExpectedReturnInputs): ExpectedReturnResult | null {
  const { price, epsAtHorizon, exitMultiple, dividendYield, years } = input;
  if (!(price > 0) || !(years > 0)) return null;
  // A negative target price has no annualised return; the method needs the
  // company to be earning something at the horizon.
  if (!(epsAtHorizon > 0) || !(exitMultiple > 0)) return null;

  const targetPrice = epsAtHorizon * exitMultiple;
  const priceCagr = Math.pow(targetPrice / price, 1 / years) - 1;

  return {
    targetPrice,
    priceCagr,
    totalCagr: priceCagr + dividendYield,
    discountToTarget: 1 - price / targetPrice,
  };
}

/**
 * The discount to a horizon target needed to clear a return hurdle.
 *
 * At three years with a 1% yield, 15% a year needs roughly a 32% discount and
 * 20% needs roughly 41% — the arithmetic behind the usual rule of thumb.
 */
export function requiredDiscount(
  targetReturn: number,
  dividendYield: number,
  years: number,
): number | null {
  const priceReturn = targetReturn - dividendYield;
  if (!(years > 0) || priceReturn <= -1) return null;
  return 1 - 1 / Math.pow(1 + priceReturn, years);
}

/**
 * The exit multiple today's price requires in order to clear a hurdle.
 *
 * This is the question worth asking: not "what is it worth" but "what must I
 * believe", checked against what the company and its industry have actually
 * traded at.
 */
export function requiredExitMultiple(
  price: number,
  epsAtHorizon: number,
  targetReturn: number,
  dividendYield: number,
  years: number,
): number | null {
  if (!(price > 0) || !(epsAtHorizon > 0) || !(years > 0)) return null;
  const priceReturn = targetReturn - dividendYield;
  if (priceReturn <= -1) return null;
  return (price * Math.pow(1 + priceReturn, years)) / epsAtHorizon;
}

/**
 * The multiple a business deserves on its own economics:
 *
 *   P/E = (1 - g/ROIC) / (r - g)
 *
 * The numerator is the share of earnings left over after funding growth, so a
 * company earning 40% on capital keeps far more of each dollar than one
 * earning 12% at the same growth rate, and is worth more per unit of earnings
 * for that reason alone.
 */
export function justifiedPriceEarnings(
  roic: number,
  growth: number,
  discountRate: number,
): number | null {
  if (!(roic > 0) || !(discountRate > growth)) return null;
  // Growth beyond what the returns on capital can fund is not self-financing.
  if (growth >= roic) return null;
  const payoutShare = 1 - growth / roic;
  const value = payoutShare / (discountRate - growth);
  return value > 0 ? value : null;
}

export interface ScenarioCell {
  epsLabel: string;
  eps: number;
  exitMultiple: number;
  totalCagr: number;
  clearsHurdle: boolean;
}

export interface ScenarioGrid {
  cells: ScenarioCell[];
  /** Share of the grid that clears the hurdle, 0–1. */
  hitRate: number;
  medianCagr: number;
  worstCagr: number;
  bestCagr: number;
}

/**
 * Return across a grid of earnings and exit-multiple scenarios.
 *
 * A single expected return hides which of the two assumptions is carrying it.
 * The share of the grid that clears the hurdle is a far better input to a
 * decision than one point estimate.
 */
export function scenarioGrid(
  price: number,
  epsScenarios: Array<{ label: string; eps: number }>,
  exitMultiples: number[],
  dividendYield: number,
  years: number,
  hurdle: number,
): ScenarioGrid {
  const cells: ScenarioCell[] = [];

  for (const scenario of epsScenarios) {
    for (const exitMultiple of exitMultiples) {
      const r = expectedReturn({
        price,
        epsAtHorizon: scenario.eps,
        exitMultiple,
        dividendYield,
        years,
      });
      if (!r) continue;
      cells.push({
        epsLabel: scenario.label,
        eps: scenario.eps,
        exitMultiple,
        totalCagr: r.totalCagr,
        clearsHurdle: r.totalCagr >= hurdle,
      });
    }
  }

  if (!cells.length) {
    return { cells, hitRate: 0, medianCagr: 0, worstCagr: 0, bestCagr: 0 };
  }

  const sorted = [...cells].map((c) => c.totalCagr).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return {
    cells,
    hitRate: cells.filter((c) => c.clearsHurdle).length / cells.length,
    medianCagr:
      sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid],
    worstCagr: sorted[0],
    bestCagr: sorted[sorted.length - 1],
  };
}

/**
 * The same method for a company that does not yet earn anything.
 *
 * Price-to-sales is only comparable between businesses at similar margins, so
 * applying one directly buries the margin assumption inside the multiple.
 * Routing revenue through an explicit target margin to implied earnings puts
 * that assumption in the open, where it can be argued with.
 *
 * Shares must be the diluted count at the horizon: a company paying heavily in
 * stock funds its growth by issuing, and ignoring that overstates every
 * per-share figure.
 */
export function expectedReturnFromRevenue(input: {
  price: number;
  revenueAtHorizon: number;
  targetNetMargin: number;
  dilutedSharesAtHorizon: number;
  exitMultiple: number;
  dividendYield: number;
  years: number;
}): (ExpectedReturnResult & { impliedEps: number }) | null {
  const { revenueAtHorizon, targetNetMargin, dilutedSharesAtHorizon } = input;
  if (!(revenueAtHorizon > 0) || !(dilutedSharesAtHorizon > 0)) return null;
  if (!(targetNetMargin > 0)) return null;

  const impliedEps = (revenueAtHorizon * targetNetMargin) / dilutedSharesAtHorizon;
  const result = expectedReturn({ ...input, epsAtHorizon: impliedEps });
  return result ? { ...result, impliedEps } : null;
}
