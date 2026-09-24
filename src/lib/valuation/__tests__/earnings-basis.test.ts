import { describe, expect, it } from 'vitest';
import {
  adjustedPeHistory,
  annualAdjustedEps,
  compareBases,
} from '../earnings-basis';

/** Stanley Black & Decker's reported quarters, the case this exists for. */
const swkQuarters = [
  { date: '2025-02-05', epsActual: 1.49 },
  { date: '2025-04-30', epsActual: 0.75 },
  { date: '2025-07-29', epsActual: 1.08 },
  { date: '2025-11-04', epsActual: 1.43 },
  { date: '2026-02-04', epsActual: 1.41 },
  { date: '2026-04-29', epsActual: 0.8 },
  { date: '2026-07-29', epsActual: 1.57 },
  { date: '2026-11-03', epsActual: null }, // not yet reported
];

describe('annualAdjustedEps', () => {
  it('sums four reported quarters into an annual figure', () => {
    const years = annualAdjustedEps(swkQuarters);
    expect(years).toHaveLength(1);
    expect(years[0].year).toBe('2025');
    expect(years[0].adjustedEps).toBeCloseTo(4.75, 2);
  });

  it('refuses a partial year rather than understating it', () => {
    // 2026 has three reported quarters; summing them would look like a collapse.
    const years = annualAdjustedEps(swkQuarters);
    expect(years.find((y) => y.year === '2026')).toBeUndefined();
  });

  it('ignores quarters with no reported figure', () => {
    const years = annualAdjustedEps([
      ...swkQuarters.slice(0, 4),
      { date: '2025-12-31', epsActual: null },
    ]);
    expect(years[0].quarters).toBe(4);
  });

  it('handles an empty history', () => {
    expect(annualAdjustedEps([])).toEqual([]);
  });
});

describe('compareBases', () => {
  it('measures how far adjusted earnings run above GAAP', () => {
    const c = compareBases(
      [
        { fiscalYear: '2025', epsDiluted: 2.65 },
        { fiscalYear: '2024', epsDiluted: 1.95 },
      ],
      [
        { year: '2025', adjustedEps: 4.75, quarters: 4 },
        { year: '2024', adjustedEps: 4.15, quarters: 4 },
      ],
    );
    expect(c.years).toHaveLength(2);
    // SWK's adjusted earnings run roughly twice its GAAP earnings.
    expect(c.medianRatio!).toBeGreaterThan(1.7);
    expect(c.materialGap).toBe(true);
    expect(c.note).toMatch(/recurring costs/);
  });

  it('stays quiet where the two bases broadly agree', () => {
    const c = compareBases(
      [{ fiscalYear: '2025', epsDiluted: 7.29 }],
      [{ year: '2025', adjustedEps: 7.5, quarters: 4 }],
    );
    expect(c.materialGap).toBe(false);
    expect(c.note).toBeNull();
  });

  it('skips years where GAAP earnings are negative, leaving no ratio to take', () => {
    const c = compareBases(
      [
        { fiscalYear: '2023', epsDiluted: -2.07 },
        { fiscalYear: '2025', epsDiluted: 2.65 },
      ],
      [
        { year: '2023', adjustedEps: 4.6, quarters: 4 },
        { year: '2025', adjustedEps: 4.75, quarters: 4 },
      ],
    );
    expect(c.years.map((y) => y.year)).toEqual(['2025']);
  });

  it('reports nothing when the years do not overlap', () => {
    const c = compareBases(
      [{ fiscalYear: '2019', epsDiluted: 5 }],
      [{ year: '2025', adjustedEps: 4.75, quarters: 4 }],
    );
    expect(c.medianRatio).toBeNull();
    expect(c.materialGap).toBe(false);
  });
});

describe('adjustedPeHistory', () => {
  it('prices each year against that year\'s adjusted earnings', () => {
    const pe = adjustedPeHistory(
      [{ year: '2025', price: 70 }, { year: '2024', price: 80 }],
      [
        { year: '2025', adjustedEps: 4.75, quarters: 4 },
        { year: '2024', adjustedEps: 4.15, quarters: 4 },
      ],
    );
    expect(pe).toHaveLength(2);
    expect(pe[0]).toBeCloseTo(14.74, 1);
    // On GAAP EPS of $2.65 the same price reads 26x, nearly double.
    expect(pe[0]).toBeLessThan(70 / 2.65);
  });

  it('drops years with no adjusted figure to pair against', () => {
    const pe = adjustedPeHistory(
      [{ year: '2025', price: 70 }, { year: '2020', price: 150 }],
      [{ year: '2025', adjustedEps: 4.75, quarters: 4 }],
    );
    expect(pe).toHaveLength(1);
  });

  it('drops non-positive prices and earnings', () => {
    expect(
      adjustedPeHistory(
        [{ year: '2025', price: 0 }],
        [{ year: '2025', adjustedEps: 4.75, quarters: 4 }],
      ),
    ).toHaveLength(0);
  });
});
