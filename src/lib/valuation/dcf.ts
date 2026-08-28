import { clamp } from './wacc';

export type TerminalMethod = 'perpetuity' | 'exit-multiple';

export interface DcfAssumptions {
  /** Explicit forecast horizon in years. */
  years: number;
  /** Discount rate (WACC for firm-level FCFF, cost of equity for FCFE). */
  discountRate: number;
  /** Growth applied in year 1, decaying linearly to `terminalGrowth` by the final year. */
  initialGrowth: number;
  /** Perpetual growth after the forecast horizon. Must stay below the discount rate. */
  terminalGrowth: number;
  terminalMethod: TerminalMethod;
  /** EV/EBITDA (or EV/FCF) multiple applied to the final year under 'exit-multiple'. */
  exitMultiple?: number;
  /** Mid-year convention discounts cash flows from the middle of each period. */
  midYear?: boolean;
}

export interface DcfYear {
  year: number;
  growth: number;
  cashFlow: number;
  discountFactor: number;
  presentValue: number;
}

export interface DcfResult {
  years: DcfYear[];
  pvOfForecast: number;
  terminalValue: number;
  pvOfTerminalValue: number;
  enterpriseValue: number;
  equityValue: number;
  fairValuePerShare: number;
  /** Share of total value sitting in the terminal value — a fragility check. */
  terminalValueShare: number;
}

export interface BridgeInputs {
  netDebt: number;
  sharesOutstanding: number;
}

/**
 * Growth path that decays linearly from `initialGrowth` toward `terminalGrowth`.
 * Fading growth is more defensible than holding a high rate flat for a decade.
 */
export function growthPath(a: Pick<DcfAssumptions, 'years' | 'initialGrowth' | 'terminalGrowth'>): number[] {
  const path: number[] = [];
  for (let i = 0; i < a.years; i++) {
    const t = a.years === 1 ? 1 : i / (a.years - 1);
    path.push(a.initialGrowth + (a.terminalGrowth - a.initialGrowth) * t);
  }
  return path;
}

/**
 * Multi-stage discounted cash flow.
 *
 * `baseCashFlow` is the trailing cash flow the forecast grows from (FCFF for an
 * enterprise valuation, FCFE for an equity one). Pass the matching discount rate.
 */
export function discountedCashFlow(
  baseCashFlow: number,
  assumptions: DcfAssumptions,
  bridge: BridgeInputs,
): DcfResult {
  const { discountRate, terminalMethod, midYear = true } = assumptions;
  // A terminal growth rate at or above the discount rate implies infinite value.
  const terminalGrowth = clamp(assumptions.terminalGrowth, -0.02, discountRate - 0.005);

  const growths = growthPath({ ...assumptions, terminalGrowth });
  const years: DcfYear[] = [];

  let cashFlow = baseCashFlow;
  let pvOfForecast = 0;

  for (let i = 0; i < assumptions.years; i++) {
    const growth = growths[i];
    cashFlow = cashFlow * (1 + growth);
    const exponent = midYear ? i + 0.5 : i + 1;
    const discountFactor = 1 / Math.pow(1 + discountRate, exponent);
    const presentValue = cashFlow * discountFactor;

    years.push({ year: i + 1, growth, cashFlow, discountFactor, presentValue });
    pvOfForecast += presentValue;
  }

  const finalCashFlow = cashFlow;

  const terminalValue =
    terminalMethod === 'exit-multiple'
      ? finalCashFlow * (assumptions.exitMultiple ?? 12)
      : (finalCashFlow * (1 + terminalGrowth)) / (discountRate - terminalGrowth);

  // The terminal value lands at the end of the final year regardless of the
  // mid-year convention used for the interim flows.
  const terminalDiscount = 1 / Math.pow(1 + discountRate, assumptions.years);
  const pvOfTerminalValue = terminalValue * terminalDiscount;

  const enterpriseValue = pvOfForecast + pvOfTerminalValue;
  const equityValue = enterpriseValue - bridge.netDebt;
  const fairValuePerShare =
    bridge.sharesOutstanding > 0 ? equityValue / bridge.sharesOutstanding : 0;

  return {
    years,
    pvOfForecast,
    terminalValue,
    pvOfTerminalValue,
    enterpriseValue,
    equityValue,
    fairValuePerShare,
    terminalValueShare: enterpriseValue !== 0 ? pvOfTerminalValue / enterpriseValue : 0,
  };
}

export interface SensitivityCell {
  discountRate: number;
  terminalGrowth: number;
  fairValuePerShare: number;
  upside: number;
}

/**
 * Fair value across a grid of discount and terminal-growth rates. The single
 * point estimate is far less informative than the range around it.
 */
export function sensitivityGrid(
  baseCashFlow: number,
  assumptions: DcfAssumptions,
  bridge: BridgeInputs,
  currentPrice: number,
  discountRates: number[],
  terminalGrowths: number[],
): SensitivityCell[][] {
  return discountRates.map((discountRate) =>
    terminalGrowths.map((terminalGrowth) => {
      const result = discountedCashFlow(
        baseCashFlow,
        { ...assumptions, discountRate, terminalGrowth },
        bridge,
      );
      return {
        discountRate,
        terminalGrowth,
        fairValuePerShare: result.fairValuePerShare,
        upside: currentPrice > 0 ? result.fairValuePerShare / currentPrice - 1 : 0,
      };
    }),
  );
}
