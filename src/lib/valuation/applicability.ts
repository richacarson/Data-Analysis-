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

/** An annual report older than this means nothing newer was filed. */
const STALE_FILING_DAYS = 500;

/**
 * Why this listing cannot be valued as a going common stock, or null.
 *
 * Marathon Oil (acquired by ConocoPhillips) still returns a profile, a frozen
 * price and the estimates analysts left behind, so it valued like a live
 * company. Entergy Arkansas's 4.875% bond trades under EAI with the issuer's
 * statements attached, and valued like its equity. Each is caught here: FMP's
 * own inactive flag, a security name that describes a bond or preferred, or
 * annual reports that stopped.
 */
export function listingIssue(input: {
  companyName?: string | null;
  isActivelyTrading?: boolean | null;
  latestAnnualReport?: string | null;
  today?: Date;
}): string | null {
  if (input.isActivelyTrading === false) {
    return 'No longer trading: FMP marks this listing inactive, which usually means it was acquired, merged or delisted. Its price and estimates are frozen at the last trade.';
  }
  const name = input.companyName ?? '';
  // Securities names abbreviate: "1M BD 4.875%66", "PFD SER A", "5.25% NTS".
  if (/\d%|\b(BD|NTS?|DEB|PFD)\b/.test(name)) {
    return `Not common stock: "${name}" reads as a bond or preferred security. The statements and estimates belong to the issuer, so an equity valuation does not apply.`;
  }
  if (input.latestAnnualReport) {
    const today = input.today ?? new Date();
    const age = (today.getTime() - Date.parse(`${input.latestAnnualReport.slice(0, 10)}T00:00:00Z`)) / 86_400_000;
    if (age > STALE_FILING_DAYS) {
      return `Stale: the latest annual report covers the year to ${input.latestAnnualReport.slice(0, 10)} and nothing newer has been filed, which usually means the company was acquired or went private. Estimates may be left over.`;
    }
  }
  return null;
}
