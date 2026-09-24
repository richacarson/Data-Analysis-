import { describe, expect, it } from 'vitest';
import { discountedCashFlow, growthPath, sensitivityGrid, type DcfAssumptions } from '../dcf';
import { reverseDcf } from '../reverse-dcf';
import { earningsDcf, fcfConversionRatio, adjustedFcfConversion } from '../earnings-dcf';
import { cagr, grahamNumber, ownerEarnings, peg, shareholderYields } from '../multiples';
import { costOfEquity, impliedCostOfDebt, wacc } from '../wacc';

const baseAssumptions: DcfAssumptions = {
  years: 10,
  discountRate: 0.09,
  initialGrowth: 0.08,
  terminalGrowth: 0.025,
  terminalMethod: 'perpetuity',
  midYear: true,
};

const bridge = { netDebt: 0, sharesOutstanding: 1000 };

describe('wacc', () => {
  it('computes CAPM cost of equity', () => {
    expect(costOfEquity({ riskFreeRate: 0.04, equityRiskPremium: 0.05, beta: 1.2 })).toBeCloseTo(0.1);
  });

  it('collapses to cost of equity when the company has no debt', () => {
    const r = wacc({
      riskFreeRate: 0.04,
      equityRiskPremium: 0.05,
      beta: 1,
      marketCap: 1_000,
      totalDebt: 0,
      costOfDebt: 0.05,
      taxRate: 0.21,
    });
    expect(r.wacc).toBeCloseTo(0.09);
    expect(r.debtWeight).toBe(0);
  });

  it('weights debt below equity because interest is tax deductible', () => {
    const r = wacc({
      riskFreeRate: 0.04,
      equityRiskPremium: 0.05,
      beta: 1,
      marketCap: 500,
      totalDebt: 500,
      costOfDebt: 0.06,
      taxRate: 0.25,
    });
    expect(r.afterTaxCostOfDebt).toBeCloseTo(0.045);
    expect(r.wacc).toBeCloseTo(0.5 * 0.09 + 0.5 * 0.045);
  });

  it('falls back to a spread over the risk-free rate when interest is undisclosed', () => {
    expect(impliedCostOfDebt(0, 100_000, 0.04)).toBeCloseTo(0.055);
    expect(impliedCostOfDebt(5_000, 100_000, 0.04)).toBeCloseTo(0.05);
  });
});

describe('growthPath', () => {
  it('fades linearly from the initial rate to the terminal rate', () => {
    const path = growthPath({ years: 5, initialGrowth: 0.2, terminalGrowth: 0.02 });
    expect(path).toHaveLength(5);
    expect(path[0]).toBeCloseTo(0.2);
    expect(path[4]).toBeCloseTo(0.02);
    // Monotonically decreasing.
    for (let i = 1; i < path.length; i++) expect(path[i]).toBeLessThan(path[i - 1]);
  });
});

describe('discountedCashFlow', () => {
  it('values a flat perpetuity at the textbook figure', () => {
    // No growth, no mid-year convention: PV should approach CF / r.
    const r = discountedCashFlow(
      100,
      {
        years: 100,
        discountRate: 0.1,
        initialGrowth: 0,
        terminalGrowth: 0,
        terminalMethod: 'perpetuity',
        midYear: false,
      },
      { netDebt: 0, sharesOutstanding: 1 },
    );
    expect(r.equityValue).toBeCloseTo(1000, 0);
  });

  it('subtracts net debt when bridging to equity value', () => {
    const noDebt = discountedCashFlow(100, baseAssumptions, bridge);
    const withDebt = discountedCashFlow(100, baseAssumptions, { ...bridge, netDebt: 5_000 });
    expect(noDebt.equityValue - withDebt.equityValue).toBeCloseTo(5_000);
  });

  it('produces a higher value at a lower discount rate', () => {
    const cheap = discountedCashFlow(100, { ...baseAssumptions, discountRate: 0.07 }, bridge);
    const dear = discountedCashFlow(100, { ...baseAssumptions, discountRate: 0.12 }, bridge);
    expect(cheap.fairValuePerShare).toBeGreaterThan(dear.fairValuePerShare);
  });

  it('never lets terminal growth reach the discount rate', () => {
    const r = discountedCashFlow(
      100,
      { ...baseAssumptions, discountRate: 0.08, terminalGrowth: 0.15 },
      bridge,
    );
    expect(Number.isFinite(r.fairValuePerShare)).toBe(true);
    expect(r.fairValuePerShare).toBeGreaterThan(0);
  });

  it('reports the share of value carried by the terminal value', () => {
    const r = discountedCashFlow(100, baseAssumptions, bridge);
    expect(r.terminalValueShare).toBeGreaterThan(0);
    expect(r.terminalValueShare).toBeLessThan(1);
    expect(r.pvOfForecast + r.pvOfTerminalValue).toBeCloseTo(r.enterpriseValue);
  });

  it('supports an exit-multiple terminal value', () => {
    const r = discountedCashFlow(
      100,
      { ...baseAssumptions, terminalMethod: 'exit-multiple', exitMultiple: 15 },
      bridge,
    );
    const finalCf = r.years[r.years.length - 1].cashFlow;
    expect(r.terminalValue).toBeCloseTo(finalCf * 15);
  });
});

describe('sensitivityGrid', () => {
  it('returns a cell for every rate combination', () => {
    const grid = sensitivityGrid(100, baseAssumptions, bridge, 1.5, [0.08, 0.09, 0.1], [0.02, 0.03]);
    expect(grid).toHaveLength(3);
    expect(grid[0]).toHaveLength(2);
    // Value falls as the discount rate rises, holding terminal growth fixed.
    expect(grid[0][0].fairValuePerShare).toBeGreaterThan(grid[2][0].fairValuePerShare);
  });
});

describe('reverseDcf', () => {
  it('recovers the growth rate that produced a given price', () => {
    const known = discountedCashFlow(100, { ...baseAssumptions, initialGrowth: 0.12 }, bridge);
    const solved = reverseDcf(100, baseAssumptions, bridge, known.fairValuePerShare);
    expect(solved.converged).toBe(true);
    expect(solved.impliedInitialGrowth).toBeCloseTo(0.12, 2);
  });

  it('implies higher growth for a more expensive stock', () => {
    const cheap = reverseDcf(100, baseAssumptions, bridge, 1.0);
    const rich = reverseDcf(100, baseAssumptions, bridge, 3.0);
    expect(rich.impliedInitialGrowth).toBeGreaterThan(cheap.impliedInitialGrowth);
  });

  it('flags non-convergence instead of inventing a rate', () => {
    const absurd = reverseDcf(100, baseAssumptions, bridge, 1_000_000);
    expect(absurd.converged).toBe(false);
  });
});

describe('earningsDcf', () => {
  const estimates = [
    { date: '2028-09-27', epsAvg: 10.6, epsLow: 9.5, epsHigh: 11.5, netIncomeAvg: 0, revenueAvg: 0, numAnalystsEps: 20 },
    { date: '2026-09-27', epsAvg: 8.8, epsLow: 8.8, epsHigh: 8.9, netIncomeAvg: 0, revenueAvg: 0, numAnalystsEps: 27 },
    { date: '2027-09-27', epsAvg: 9.5, epsLow: 9.0, epsHigh: 10.2, netIncomeAvg: 0, revenueAvg: 0, numAnalystsEps: 30 },
  ];

  const assumptions = {
    discountRate: 0.09,
    fcfConversion: 0.95,
    fadeYears: 5,
    postEstimateGrowth: 0.06,
    terminalGrowth: 0.025,
  };

  it('orders analyst years chronologically regardless of input order', () => {
    const r = earningsDcf(estimates, assumptions, 7.5);
    const analystYears = r.years.filter((y) => y.source === 'analyst');
    expect(analystYears.map((y) => y.label)).toEqual(['2026', '2027', '2028']);
  });

  it('extends the forecast past the analyst horizon with faded growth', () => {
    const r = earningsDcf(estimates, assumptions, 7.5);
    expect(r.years).toHaveLength(3 + 5);
    expect(r.years.filter((y) => y.source === 'faded')).toHaveLength(5);
  });

  it('brackets the base case with the analyst low and high range', () => {
    const r = earningsDcf(estimates, assumptions, 7.5);
    expect(r.bearFairValue).toBeLessThan(r.fairValuePerShare);
    expect(r.bullFairValue).toBeGreaterThan(r.fairValuePerShare);
  });

  it('discounts later cash flows more heavily', () => {
    const r = earningsDcf(estimates, assumptions, 7.5);
    for (let i = 1; i < r.years.length; i++) {
      expect(r.years[i].discountFactor).toBeLessThan(r.years[i - 1].discountFactor);
    }
  });

  it('still values a company with no analyst coverage', () => {
    const r = earningsDcf([], assumptions, 5);
    expect(r.fairValuePerShare).toBeGreaterThan(0);
    expect(r.years.every((y) => y.source === 'faded')).toBe(true);
  });
});

describe('fcfConversionRatio', () => {
  it('measures cash generated per dollar of reported earnings', () => {
    const ratio = fcfConversionRatio([
      { netIncome: 100, freeCashFlow: 90 },
      { netIncome: 100, freeCashFlow: 110 },
    ]);
    expect(ratio).toBeCloseTo(1.0);
  });

  it('clamps implausible ratios rather than propagating them', () => {
    expect(fcfConversionRatio([{ netIncome: 1, freeCashFlow: 500 }])).toBe(2);
    expect(fcfConversionRatio([{ netIncome: 100, freeCashFlow: 1 }])).toBe(0.3);
  });

  it('defaults to 1 when there is no profitable history', () => {
    expect(fcfConversionRatio([{ netIncome: -50, freeCashFlow: 10 }])).toBe(1);
  });
});

describe('multiples', () => {
  it('computes PEG and refuses it for non-growing companies', () => {
    expect(peg(30, 15)).toBeCloseTo(2);
    expect(peg(30, 0)).toBeNull();
    expect(peg(30, -5)).toBeNull();
    expect(peg(-10, 15)).toBeNull();
  });

  it('computes CAGR and refuses sign changes', () => {
    expect(cagr(100, 200, 5)).toBeCloseTo(0.1487, 3);
    expect(cagr(-10, 200, 5)).toBeNull();
  });

  it('computes the Graham number only for profitable companies', () => {
    expect(grahamNumber(7.49, 7.32)).toBeCloseTo(Math.sqrt(22.5 * 7.49 * 7.32));
    expect(grahamNumber(-1, 7.32)).toBeNull();
  });

  it('subtracts stock compensation and capex from owner earnings', () => {
    const oe = ownerEarnings({
      netIncome: 100,
      depreciationAndAmortization: 20,
      capitalExpenditure: -30,
      changeInWorkingCapital: 5,
      stockBasedCompensation: 10,
    });
    expect(oe).toBe(75);
  });

  it('treats capex sign-agnostically', () => {
    const args = {
      netIncome: 100,
      depreciationAndAmortization: 20,
      changeInWorkingCapital: 0,
      stockBasedCompensation: 0,
    };
    expect(ownerEarnings({ ...args, capitalExpenditure: -30 })).toBe(
      ownerEarnings({ ...args, capitalExpenditure: 30 }),
    );
  });

  it('sums dividends and buybacks into shareholder yield', () => {
    const y = shareholderYields({
      netIncome: 100,
      freeCashFlow: 90,
      dividendsPaid: -15,
      buybacks: -25,
      marketCap: 1000,
    });
    expect(y.dividendYield).toBeCloseTo(0.015);
    expect(y.buybackYield).toBeCloseTo(0.025);
    expect(y.shareholderYield).toBeCloseTo(0.04);
  });
});

describe('adjustedFcfConversion', () => {
  it('measures cash per dollar of adjusted earnings', () => {
    const r = adjustedFcfConversion([
      { fcfPerShare: 4.5, adjustedEps: 4.67 },
      { fcfPerShare: 5.0, adjustedEps: 4.15 },
      { fcfPerShare: 4.0, adjustedEps: 4.5 },
    ]);
    expect(r).toBeCloseTo(13.5 / 13.32, 3);
  });

  it('needs three comparable years before replacing the GAAP ratio', () => {
    expect(
      adjustedFcfConversion([
        { fcfPerShare: 4.5, adjustedEps: 4.67 },
        { fcfPerShare: Number.NaN, adjustedEps: 4.15 },
        { fcfPerShare: 4.0, adjustedEps: -1 },
      ]),
    ).toBeNull();
  });
});
