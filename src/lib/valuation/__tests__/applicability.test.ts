import { describe, expect, it } from 'vitest';
import { cashFlowModelsApply } from '../applicability';
import { usablePeg } from '../multiples';
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
