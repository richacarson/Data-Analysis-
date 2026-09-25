import { describe, expect, it } from 'vitest';
import { houseReturn, type HouseInputs } from '../house';

const today = new Date('2026-09-25T00:00:00Z');

const base = (over: Partial<HouseInputs> = {}): HouseInputs => ({
  price: 100,
  forward: [
    { date: '2026-12-31', epsAvg: 5, epsLow: 4.5, epsHigh: 5.5, numAnalystsEps: 12 },
    { date: '2027-12-31', epsAvg: 5.5, epsLow: 5, epsHigh: 6, numAnalystsEps: 12 },
    { date: '2028-12-31', epsAvg: 6, epsLow: 5.4, epsHigh: 6.6, numAnalystsEps: 10 },
    { date: '2029-12-31', epsAvg: 6.6, epsLow: 6, epsHigh: 7.2, numAnalystsEps: 8 },
  ],
  annual: [2025, 2024, 2023, 2022, 2021].map((y) => ({
    date: `${y}-12-31`,
    fiscalYear: String(y),
    priceToEarningsRatio: 20,
    netIncomePerShare: 4,
  })),
  earnings: [],
  industryPe: [],
  roic: 0.15,
  beta: 1,
  riskFreeRate: 0.042,
  equityRiskPremium: 0.05,
  dividendYield: 0.01,
  horizonYears: 3,
  hurdle: 0.15,
  fxRate: 1,
  foreign: false,
  today,
  ...over,
});

describe('houseReturn', () => {
  it('ignores historical multiples from years of near-zero earnings', () => {
    // Pagaya-like: two years at 400x and 250x sitting in the history.
    const annual = base().annual.map((r, i) => (i < 2 ? { ...r, priceToEarningsRatio: [400, 250][i] } : r));
    const r = houseReturn(base({ annual }));
    const own = r.anchors.anchors.find((a) => a.label === 'Own 10-year median')!;
    expect(own.value).toBe(20);
  });

  it('converts consensus reported in another currency before pricing it', () => {
    // TSM-like: consensus in TWD against a dollar price.
    const twd = base({
      forward: base().forward.map((e) => ({ ...e, epsAvg: e.epsAvg * 31.7, epsLow: e.epsLow * 31.7, epsHigh: e.epsHigh * 31.7 })),
      fxRate: 1 / 31.7,
      foreign: true,
    });
    expect(houseReturn(twd).epsAtHorizon).toBeCloseTo(6.6, 2);
    expect(houseReturn(twd).review).toBeNull();
  });

  it('holds an unconverted foreign row for review', () => {
    const unconverted = base({
      forward: base().forward.map((e) => ({ ...e, epsAvg: e.epsAvg * 31.7 })),
      foreign: true,
    });
    expect(houseReturn(unconverted).review).toMatch(/Held for review/);
  });

  it('uses the industry and justified anchors alongside the company’s own history', () => {
    const r = houseReturn(base({ industryPe: [{ date: '2026-09-24', pe: 30 }, { date: '2026-03-01', pe: 26 }] }));
    const labels = r.anchors.anchors.filter((a) => a.value !== null).map((a) => a.label);
    expect(labels).toEqual(expect.arrayContaining(['Own 10-year median', 'Industry now', 'Industry median', 'Justified by ROIC']));
    expect(r.exitPeSource).toMatch(/Median of 5 anchors/);
  });
});
