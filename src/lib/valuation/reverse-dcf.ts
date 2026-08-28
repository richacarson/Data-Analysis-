import { discountedCashFlow, type BridgeInputs, type DcfAssumptions, type DcfResult } from './dcf';

export interface ReverseDcfResult {
  /** Year-1 growth rate that makes the DCF fair value equal today's price. */
  impliedInitialGrowth: number;
  /** Compound growth over the forecast horizon implied by that path. */
  impliedCagr: number;
  converged: boolean;
  iterations: number;
  checkValue: number;
}

/**
 * Reverse DCF: instead of asking what a stock is worth, ask what growth the
 * market is already paying for. Solved by bisection on the year-1 growth rate.
 *
 * Fair value rises monotonically with growth for any sane parameter set, which
 * is what makes bisection safe here.
 */
export function reverseDcf(
  baseCashFlow: number,
  assumptions: DcfAssumptions,
  bridge: BridgeInputs,
  currentPrice: number,
  options: { lo?: number; hi?: number; tolerance?: number; maxIterations?: number } = {},
): ReverseDcfResult {
  const { lo: loInit = -0.5, hi: hiInit = 1.5, tolerance = 0.0005, maxIterations = 100 } = options;

  const valueAt = (growth: number) =>
    discountedCashFlow(baseCashFlow, { ...assumptions, initialGrowth: growth }, bridge)
      .fairValuePerShare;

  let lo = loInit;
  let hi = hiInit;
  let iterations = 0;
  let mid = (lo + hi) / 2;

  // If the price sits outside the value range the bounds can produce, report the
  // nearest bound rather than a fabricated interior solution.
  if (valueAt(hi) < currentPrice) {
    return {
      impliedInitialGrowth: hi,
      impliedCagr: hi,
      converged: false,
      iterations: 0,
      checkValue: valueAt(hi),
    };
  }
  if (valueAt(lo) > currentPrice) {
    return {
      impliedInitialGrowth: lo,
      impliedCagr: lo,
      converged: false,
      iterations: 0,
      checkValue: valueAt(lo),
    };
  }

  while (iterations < maxIterations) {
    mid = (lo + hi) / 2;
    const value = valueAt(mid);
    if (Math.abs(value - currentPrice) < currentPrice * tolerance) break;
    if (value < currentPrice) lo = mid;
    else hi = mid;
    iterations++;
  }

  const result: DcfResult = discountedCashFlow(
    baseCashFlow,
    { ...assumptions, initialGrowth: mid },
    bridge,
  );

  // Compound rate actually delivered by the fading growth path.
  const finalCashFlow = result.years[result.years.length - 1]?.cashFlow ?? baseCashFlow;
  const impliedCagr =
    baseCashFlow > 0 && assumptions.years > 0
      ? Math.pow(finalCashFlow / baseCashFlow, 1 / assumptions.years) - 1
      : mid;

  return {
    impliedInitialGrowth: mid,
    impliedCagr,
    converged: iterations < maxIterations,
    iterations,
    checkValue: result.fairValuePerShare,
  };
}
