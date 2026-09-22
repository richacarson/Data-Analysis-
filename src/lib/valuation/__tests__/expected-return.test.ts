import { describe, expect, it } from 'vitest';
import {
  expectedReturn,
  expectedReturnFromRevenue,
  justifiedPriceEarnings,
  requiredDiscount,
  requiredExitMultiple,
  scenarioGrid,
} from '../expected-return';
import { exitMultipleAnchors, median, percentile } from '../exit-multiple';

describe('requiredDiscount', () => {
  it('reproduces the rule of thumb at a three-year horizon', () => {
    // 15% a year on a 1% yielder needs roughly a third off the horizon target.
    expect(requiredDiscount(0.15, 0.01, 3)!).toBeCloseTo(0.325, 2);
    // 20% needs appreciably more.
    expect(requiredDiscount(0.2, 0.01, 3)!).toBeCloseTo(0.406, 2);
  });

  it('asks less of a higher yielder for the same total return', () => {
    const lowYield = requiredDiscount(0.15, 0.01, 3)!;
    const highYield = requiredDiscount(0.15, 0.04, 3)!;
    expect(highYield).toBeLessThan(lowYield);
  });

  it('needs a larger discount the longer the horizon', () => {
    // Holding the annual return fixed, a more distant target must be further
    // above today's price, so the discount to it widens with the horizon.
    expect(requiredDiscount(0.15, 0.01, 5)!).toBeGreaterThan(requiredDiscount(0.15, 0.01, 3)!);
    expect(requiredDiscount(0.15, 0.01, 5)!).toBeCloseTo(0.481, 2);
  });
});

describe('expectedReturn', () => {
  it('turns a horizon target into an annualised return', () => {
    // $100 today, $20 EPS at 10x in three years = $200, a double.
    const r = expectedReturn({
      price: 100,
      epsAtHorizon: 20,
      exitMultiple: 10,
      dividendYield: 0,
      years: 3,
    })!;
    expect(r.targetPrice).toBe(200);
    expect(r.priceCagr).toBeCloseTo(0.2599, 3);
    expect(r.discountToTarget).toBeCloseTo(0.5);
  });

  it('adds the dividend yield to the price return', () => {
    const base = expectedReturn({ price: 100, epsAtHorizon: 20, exitMultiple: 10, dividendYield: 0, years: 3 })!;
    const paying = expectedReturn({ price: 100, epsAtHorizon: 20, exitMultiple: 10, dividendYield: 0.02, years: 3 })!;
    expect(paying.totalCagr - base.totalCagr).toBeCloseTo(0.02);
  });

  it('round-trips against requiredDiscount', () => {
    const discount = requiredDiscount(0.15, 0.01, 3)!;
    const price = 100;
    const target = price / (1 - discount);
    const r = expectedReturn({
      price,
      epsAtHorizon: target,
      exitMultiple: 1,
      dividendYield: 0.01,
      years: 3,
    })!;
    expect(r.totalCagr).toBeCloseTo(0.15, 4);
  });

  it('refuses a company not earning anything at the horizon', () => {
    expect(
      expectedReturn({ price: 100, epsAtHorizon: -2, exitMultiple: 20, dividendYield: 0, years: 3 }),
    ).toBeNull();
  });
});

describe('requiredExitMultiple', () => {
  it('states what you must believe to clear the hurdle', () => {
    // Microsoft near $494 with ~$25.42 of 2028 EPS, targeting 15% on a 1% yield.
    const m = requiredExitMultiple(493.78, 25.42, 0.15, 0.01, 3)!;
    expect(m).toBeCloseTo(28.78, 1);
  });

  it('inverts expectedReturn exactly', () => {
    const m = requiredExitMultiple(100, 20, 0.15, 0.01, 3)!;
    const r = expectedReturn({ price: 100, epsAtHorizon: 20, exitMultiple: m, dividendYield: 0.01, years: 3 })!;
    expect(r.totalCagr).toBeCloseTo(0.15, 6);
  });

  it('demands a higher multiple for a higher hurdle', () => {
    expect(requiredExitMultiple(100, 20, 0.2, 0.01, 3)!).toBeGreaterThan(
      requiredExitMultiple(100, 20, 0.15, 0.01, 3)!,
    );
  });
});

describe('justifiedPriceEarnings', () => {
  it('pays more for the same growth when returns on capital are higher', () => {
    // Same 8% growth, same 12% discount rate, very different economics:
    // at 40% ROIC only a fifth of earnings funds growth, at 12% two thirds do.
    const highReturns = justifiedPriceEarnings(0.4, 0.08, 0.12)!;
    const lowReturns = justifiedPriceEarnings(0.12, 0.08, 0.12)!;
    expect(highReturns).toBeCloseTo(20, 0);
    expect(lowReturns).toBeCloseTo(8.33, 1);
    expect(highReturns).toBeGreaterThan(lowReturns);
  });

  it('refuses growth the returns on capital cannot fund', () => {
    expect(justifiedPriceEarnings(0.08, 0.1, 0.12)).toBeNull();
  });

  it('refuses growth at or above the discount rate', () => {
    expect(justifiedPriceEarnings(0.4, 0.1, 0.1)).toBeNull();
  });
});

describe('scenarioGrid', () => {
  const eps = [
    { label: 'Low', eps: 20 },
    { label: 'Consensus', eps: 25 },
    { label: 'High', eps: 30 },
  ];

  it('reports what share of outcomes clears the hurdle', () => {
    const g = scenarioGrid(400, eps, [20, 25, 30], 0.01, 3, 0.15);
    expect(g.cells).toHaveLength(9);
    expect(g.hitRate).toBeGreaterThan(0);
    expect(g.hitRate).toBeLessThanOrEqual(1);
    expect(g.worstCagr).toBeLessThanOrEqual(g.medianCagr);
    expect(g.medianCagr).toBeLessThanOrEqual(g.bestCagr);
  });

  it('clears nothing when the price already assumes everything', () => {
    const g = scenarioGrid(5000, eps, [20, 25, 30], 0.01, 3, 0.15);
    expect(g.hitRate).toBe(0);
  });

  it('clears everything when the price is low enough', () => {
    const g = scenarioGrid(50, eps, [20, 25, 30], 0.01, 3, 0.15);
    expect(g.hitRate).toBe(1);
  });
});

describe('expectedReturnFromRevenue', () => {
  it('routes revenue through an explicit margin rather than a sales multiple', () => {
    const r = expectedReturnFromRevenue({
      price: 50,
      revenueAtHorizon: 10e9,
      targetNetMargin: 0.2,
      dilutedSharesAtHorizon: 500e6,
      exitMultiple: 30,
      dividendYield: 0,
      years: 3,
    })!;
    expect(r.impliedEps).toBeCloseTo(4); // $2bn of earnings over 500m shares
    expect(r.targetPrice).toBeCloseTo(120);
  });

  it('refuses a margin assumption that is not positive', () => {
    expect(
      expectedReturnFromRevenue({
        price: 50, revenueAtHorizon: 10e9, targetNetMargin: -0.1,
        dilutedSharesAtHorizon: 500e6, exitMultiple: 30, dividendYield: 0, years: 3,
      }),
    ).toBeNull();
  });

  it('is diluted away by a rising share count', () => {
    const base = { price: 50, revenueAtHorizon: 10e9, targetNetMargin: 0.2, exitMultiple: 30, dividendYield: 0, years: 3 };
    const tight = expectedReturnFromRevenue({ ...base, dilutedSharesAtHorizon: 500e6 })!;
    const loose = expectedReturnFromRevenue({ ...base, dilutedSharesAtHorizon: 650e6 })!;
    expect(loose.totalCagr).toBeLessThan(tight.totalCagr);
  });
});

describe('exitMultipleAnchors', () => {
  // Microsoft's trailing P/E at each fiscal year end, newest first.
  const msft = [20.72, 36.31, 38.51, 35.03, 26.48, 33.36, 34.97, 26.55, 45.87, 20.95];

  it('computes separate ten- and five-year medians', () => {
    const a = exitMultipleAnchors({ ownHistory: msft });
    const ten = a.anchors.find((x) => x.label === 'Own 10-year median')!.value!;
    const five = a.anchors.find((x) => x.label === 'Own 5-year median')!.value!;
    expect(ten).toBeCloseTo(34.2, 0);
    expect(five).toBeCloseTo(35.03, 1);
  });

  it('defaults to the most conservative anchor available', () => {
    const a = exitMultipleAnchors({ ownHistory: msft, industryPe: 52.1, justified: 22 });
    expect(a.recommended).toBe(22);
    expect(a.recommendedSource).toBe('Justified by ROIC');
  });

  it('still produces a default when only one anchor exists', () => {
    const a = exitMultipleAnchors({ ownHistory: [], industryPe: 52.1 });
    expect(a.recommended).toBe(52.1);
  });

  it('reports no default when nothing is usable', () => {
    const a = exitMultipleAnchors({ ownHistory: [null, -3, 0] });
    expect(a.recommended).toBeNull();
    expect(a.recommendedSource).toBeNull();
  });
});

describe('median and percentile', () => {
  it('ignores nulls and non-positive values', () => {
    expect(median([10, null, 20, -5, 0, 30])).toBe(20);
  });
  it('averages the middle pair for an even count', () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });
  it('returns null for an empty set', () => {
    expect(median([])).toBeNull();
    expect(percentile([], 0.5)).toBeNull();
  });
  it('picks percentiles off the sorted values', () => {
    expect(percentile([10, 20, 30, 40, 50], 0)).toBe(10);
    expect(percentile([10, 20, 30, 40, 50], 1)).toBe(50);
    expect(percentile([10, 20, 30, 40, 50], 0.5)).toBe(30);
  });
});

describe('justified P/E for fast growers', () => {
  it('is defined once growth is capped below the discount rate', () => {
    // Microsoft-like: 19% forecast growth against a ~10.5% cost of equity makes
    // the raw formula undefined, which is exactly when the anchor is wanted.
    expect(justifiedPriceEarnings(0.3, 0.19, 0.105)).toBeNull();
    const capped = Math.max(0, Math.min(0.19, 0.3 * 0.9, 0.105 - 0.02));
    expect(capped).toBeCloseTo(0.085);
    expect(justifiedPriceEarnings(0.3, capped, 0.105)).toBeGreaterThan(0);
  });

  it('rewards the higher-return business at the same capped growth', () => {
    const high = justifiedPriceEarnings(0.4, 0.085, 0.105)!;
    const low = justifiedPriceEarnings(0.15, 0.085, 0.105)!;
    expect(high).toBeGreaterThan(low);
  });
});
