import { describe, expect, it } from 'vitest';
import {
  cashFlowModelsApply,
  isRealEstateTrust,
  perShareModelsApply,
} from '../applicability';
import { usablePeg } from '../multiples';
import { coverage, multiple, nonNegativeRatio } from '../../format';
import { discountedCashFlow } from '../dcf';
import { reverseDcf } from '../reverse-dcf';

/**
 * These lock down the JPMorgan case. Run against its real reported figures the
 * engine produced a fair value of -$1,969 a share and a reverse DCF claiming
 * the market expects 150% annual growth — a number the solver never found, it
 * simply hit its upper bound and stopped.
 */
describe('cashFlowModelsApply', () => {
  it('withholds cash flow models from banks whatever their cash flow looks like', () => {
    const r = cashFlowModelsApply('Financial Services', 'Banks - Diversified', 50e9);
    expect(r.applies).toBe(false);
    expect(r.reason).toMatch(/loan book/);
  });

  it('withholds them from insurers and capital markets firms too', () => {
    expect(cashFlowModelsApply('Financial Services', 'Insurance - Life', 10e9).applies).toBe(false);
    expect(cashFlowModelsApply('Financial Services', 'Capital Markets', 5e9).applies).toBe(false);
  });

  it('withholds them when trailing free cash flow is negative', () => {
    const r = cashFlowModelsApply('Technology', 'Software - Application', -2e9);
    expect(r.applies).toBe(false);
    expect(r.reason).toMatch(/negative/);
  });

  it('treats zero free cash flow as unusable, not as a starting point', () => {
    expect(cashFlowModelsApply('Technology', 'Software', 0).applies).toBe(false);
  });

  it('allows them for a profitable operating company', () => {
    const r = cashFlowModelsApply('Technology', 'Consumer Electronics', 98e9);
    expect(r.applies).toBe(true);
    expect(r.reason).toBeUndefined();
  });

  it('does not mistake an industrial for a financial on the word "credit"', () => {
    // "Credit Services" is a lender; "Specialty Industrial Machinery" is not.
    expect(cashFlowModelsApply('Industrials', 'Specialty Industrial Machinery', 3e9).applies).toBe(true);
  });
});

describe('the JPMorgan failure mode', () => {
  const assumptions = {
    years: 10,
    discountRate: 0.064,
    initialGrowth: 0.05,
    terminalGrowth: 0.025,
    terminalMethod: 'perpetuity' as const,
    midYear: true,
  };
  const bridge = { netDebt: 928e9, sharesOutstanding: 2.679e9 };

  it('produces a deeply negative fair value from negative cash flow', () => {
    const r = discountedCashFlow(-147.782e9, assumptions, bridge);
    expect(r.fairValuePerShare).toBeLessThan(-1000);
  });

  it('reports non-convergence rather than a real growth rate', () => {
    const r = reverseDcf(-147.782e9, assumptions, bridge, 349.67);
    expect(r.converged).toBe(false);
    // The value it carries is the search bound, which must never be shown.
    expect(r.impliedInitialGrowth).toBe(1.5);
  });
});

describe('usablePeg', () => {
  it('rejects the negative PEG a loss-making company produces', () => {
    // Rivian's reported trailing PEG is -0.25; shown raw it reads as "cheap".
    expect(usablePeg(-0.25248899315370543)).toBeNull();
    expect(usablePeg(0)).toBeNull();
  });

  it('passes a genuine PEG through untouched', () => {
    expect(usablePeg(1.115)).toBeCloseTo(1.115);
  });

  it('rejects missing and non-finite values', () => {
    expect(usablePeg(null)).toBeNull();
    expect(usablePeg(undefined)).toBeNull();
    expect(usablePeg(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('perShareModelsApply', () => {
  it('withholds per-share models when the ADR trades in a different currency', () => {
    // TSMC files in TWD (EPS 333, book 1,248) against a ~$435 ADR. Mixing them
    // put the Graham number near $3,481 and showed ~700% upside.
    const r = perShareModelsApply('TWD', 'USD');
    expect(r.applies).toBe(false);
    expect(r.reason).toMatch(/TWD/);
    expect(r.reason).toMatch(/USD/);
  });

  it('allows them when the statements and the quote share a currency', () => {
    expect(perShareModelsApply('USD', 'USD').applies).toBe(true);
    expect(perShareModelsApply('usd', 'USD').applies).toBe(true);
  });

  it('does not block a company whose reporting currency is unknown', () => {
    expect(perShareModelsApply(undefined, 'USD').applies).toBe(true);
    expect(perShareModelsApply('EUR', undefined).applies).toBe(true);
  });
});

describe('isRealEstateTrust', () => {
  it('flags REITs so earnings-based models are read with care', () => {
    expect(isRealEstateTrust('Real Estate', 'REIT - Retail')).toBe(true);
  });
  it('leaves operating companies alone', () => {
    expect(isRealEstateTrust('Technology', 'Semiconductors')).toBe(false);
  });
});

describe('meaningful multiples', () => {
  it('refuses a negative price-to-book instead of printing it', () => {
    // McDonald's book equity is negative from buybacks; FMP reports P/B -172.46.
    expect(multiple(-172.45764222873902)).toBe('n/m');
  });

  it('refuses a negative P/E and a negative price-to-free-cash-flow', () => {
    expect(multiple(-5.810077519379845)).toBe('n/m'); // Rivian
    expect(multiple(-16.49716612)).toBe('n/m'); // NextEra
  });

  it('keeps a genuine multiple', () => {
    expect(multiple(28.515126927089373)).toBe('28.52');
  });

  it('keeps zero debt to equity but refuses a negative one', () => {
    expect(nonNegativeRatio(0)).toBe('0.00');
    expect(nonNegativeRatio(-53.364613880742915)).toBe('n/m');
  });

  it('distinguishes no interest expense from failing to cover it', () => {
    // FMP reports 0 for both cases; they mean opposite things.
    expect(coverage(0, false)).toBe('No interest expense');
    expect(coverage(0, true)).toBe('0.00');
    expect(coverage(7.81, true)).toBe('7.81');
  });
});
