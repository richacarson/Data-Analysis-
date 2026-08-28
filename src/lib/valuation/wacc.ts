/** Cost-of-capital primitives. All rates are decimals (0.08 = 8%). */

export interface CapmInputs {
  riskFreeRate: number;
  equityRiskPremium: number;
  beta: number;
}

/** Cost of equity via CAPM: Rf + β × ERP. */
export function costOfEquity({ riskFreeRate, equityRiskPremium, beta }: CapmInputs): number {
  return riskFreeRate + beta * equityRiskPremium;
}

export interface WaccInputs extends CapmInputs {
  marketCap: number;
  totalDebt: number;
  /** Pre-tax cost of debt. */
  costOfDebt: number;
  /** Effective tax rate, decimal. */
  taxRate: number;
}

export interface WaccResult {
  wacc: number;
  costOfEquity: number;
  afterTaxCostOfDebt: number;
  equityWeight: number;
  debtWeight: number;
}

/**
 * Weighted average cost of capital.
 *
 * A company with no debt collapses to its cost of equity, which is the correct
 * result and avoids a divide-by-zero on the capital-structure weights.
 */
export function wacc(input: WaccInputs): WaccResult {
  const ke = costOfEquity(input);
  const capital = input.marketCap + input.totalDebt;

  if (capital <= 0) {
    return {
      wacc: ke,
      costOfEquity: ke,
      afterTaxCostOfDebt: 0,
      equityWeight: 1,
      debtWeight: 0,
    };
  }

  const equityWeight = input.marketCap / capital;
  const debtWeight = input.totalDebt / capital;
  const kdAfterTax = input.costOfDebt * (1 - clamp(input.taxRate, 0, 0.6));

  return {
    wacc: equityWeight * ke + debtWeight * kdAfterTax,
    costOfEquity: ke,
    afterTaxCostOfDebt: kdAfterTax,
    equityWeight,
    debtWeight,
  };
}

/**
 * Implied pre-tax cost of debt from the income statement. Falls back to a
 * spread over the risk-free rate when interest expense is not disclosed
 * separately, which is common for cash-rich issuers.
 */
export function impliedCostOfDebt(
  interestExpense: number,
  totalDebt: number,
  riskFreeRate: number,
): number {
  if (totalDebt > 0 && interestExpense > 0) {
    return clamp(interestExpense / totalDebt, 0.005, 0.25);
  }
  return riskFreeRate + 0.015;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
