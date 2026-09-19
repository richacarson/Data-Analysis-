/**
 * Which valuation models a given business can actually support.
 *
 * Pure and dependency-free so it can be tested directly, and so the rule lives
 * somewhere a reader can find it rather than buried in the orchestrator.
 */

export interface ModelVerdict {
  applies: boolean;
  reason?: string;
}

/**
 * Whether discounted-cash-flow models mean anything for this business.
 *
 * Banks and insurers report no meaningful capital expenditure, and their
 * operating cash flow is dominated by movements in the loan book and deposit
 * base — JPMorgan's swings between +$107bn and -$148bn across six years on a
 * stable, profitable business. A DCF over that produces a confident number with
 * no relationship to the company, so it is withheld rather than shown.
 */
export function cashFlowModelsApply(
  sector: string,
  industry: string,
  baseFreeCashFlow: number,
): ModelVerdict {
  const isFinancial = /financial|bank|insurance|capital market|mortgage|credit service/i.test(
    `${sector} ${industry}`,
  );
  if (isFinancial) {
    return {
      applies: false,
      reason:
        'Not shown for lenders and insurers: reported free cash flow tracks the loan book and deposit base, not the economics of the business.',
    };
  }
  // Compounding a negative base forward only ever produces a larger negative.
  if (!(baseFreeCashFlow > 0)) {
    return {
      applies: false,
      reason:
        'Not shown: trailing free cash flow is negative, so a growth forecast from it has no meaning.',
    };
  }
  return { applies: true };
}

export const isFinancialSector = (sector: string, industry: string): boolean =>
  /financial|bank|insurance|capital market|mortgage|credit service/i.test(`${sector} ${industry}`);
