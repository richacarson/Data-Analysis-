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

/**
 * Whether per-share valuations can be compared against the quoted price.
 *
 * A foreign issuer reports in its home currency while its ADR trades in
 * dollars. The build converts its statements first (see fmp/currency.ts), after
 * which they are in the quote's currency and this passes. It fails only when no
 * exchange rate was available: TSMC's New Taiwan dollar figures against an ADR
 * near $435 would put its Graham number around $3,481, so the models are
 * withheld rather than shown in the wrong unit.
 */
export function perShareModelsApply(
  reportingCurrency: string | undefined,
  tradingCurrency: string | undefined,
): ModelVerdict {
  if (!reportingCurrency || !tradingCurrency) return { applies: true };
  if (reportingCurrency.toUpperCase() === tradingCurrency.toUpperCase()) return { applies: true };
  return {
    applies: false,
    reason:
      `Not shown: the accounts are reported in ${reportingCurrency.toUpperCase()} while the shares trade in ` +
      `${tradingCurrency.toUpperCase()}. Per-share values from the statements are not comparable to the quoted ` +
      `price, and no exchange rate was available to convert them.`,
  };
}

/**
 * REITs are not suppressed, but earnings-based models understate them badly:
 * property depreciation is a large non-cash charge, so reported EPS sits far
 * below the cash the business actually distributes. Realty Income earns $1.42 a
 * share and pays $3.24 — a payout ratio of 227% that is normal for the
 * structure, not a warning. The industry measures itself in funds from
 * operations for exactly this reason.
 */
export function isRealEstateTrust(sector: string, industry: string): boolean {
  return /real estate|reit/i.test(`${sector} ${industry}`);
}
