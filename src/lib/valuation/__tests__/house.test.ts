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
    expect(r.anchors.recommendedSource).toMatch(/Median of 5 anchors/);
  });

  it('caps the exit multiple at the highest P/E the company has traded at', () => {
    // Full Truck Alliance-like: own history 12-16x, peers and justified far higher.
    const annual = base().annual.map((r, i) => ({ ...r, priceToEarningsRatio: [12, 14, 16, 13, 15][i] }));
    const r = houseReturn(base({ annual, industryPe: [{ date: '2026-09-24', pe: 40 }, { date: '2026-03-01', pe: 36 }] }));
    expect(r.anchors.recommended!).toBeGreaterThan(16);
    expect(r.exitPe).toBe(16);
    expect(r.exitPeSource).toMatch(/highest historical P\/E \(capped\)/);
    expect(r.exitCapNote).toMatch(/capped at 16\.0x/);
  });

  it('leaves the multiple alone when the anchors sit within the company’s range', () => {
    const annual = base().annual.map((r, i) => ({ ...r, priceToEarningsRatio: [18, 30, 22, 25, 20][i] }));
    const r = houseReturn(base({ annual }));
    expect(r.exitCapNote).toBeNull();
    expect(r.exitPe).toBe(r.anchors.recommended);
  });

  it('does not cap a manual override or a short history', () => {
    const annual = base().annual.map((r, i) => ({ ...r, priceToEarningsRatio: [12, 14, 16, 13, 15][i] }));
    const peers = [{ date: '2026-09-24', pe: 40 }];
    expect(houseReturn(base({ annual, industryPe: peers, exitPeOverride: 30 })).exitPe).toBe(30);
    const short = houseReturn(base({ annual: annual.slice(0, 2), industryPe: peers }));
    expect(short.exitCapNote).toBeNull();
  });

  it('excludes an industry P/E distorted by near-zero earners, and a zero one', () => {
    const r = houseReturn(base({ industryPe: [{ date: '2026-09-24', pe: 96.78 }, { date: '2026-03-01', pe: 0 }] }));
    const industry = r.anchors.anchors.filter((a) => a.label.startsWith('Industry'));
    expect(industry.length).toBeGreaterThan(0);
    for (const a of industry) {
      if (a.value !== null) expect(a.excluded).toBe(true);
    }
    expect(r.anchors.recommendedSource).not.toMatch(/5 anchors/);
  });

  it('ignores an industry figure from another exchange or a past date (Atmos Energy)', () => {
    const stale = [
      { date: '2025-10-14', pe: 8.03, exchange: 'NASDAQ', industry: 'Regulated Gas' },
      { date: '2025-10-13', pe: 7.56, exchange: 'NASDAQ', industry: 'Regulated Gas' },
    ];
    const nyse = houseReturn(base({ industryPe: stale, exchange: 'NYSE', industry: 'Regulated Gas' }));
    const industry = nyse.anchors.anchors.filter((a) => a.label.startsWith('Industry'));
    expect(industry.every((a) => a.excluded)).toBe(true);
    expect(industry[0].detail).toMatch(/NASDAQ-listed companies only/);

    const nasdaqButOld = houseReturn(base({ industryPe: stale, exchange: 'NASDAQ', industry: 'Regulated Gas' }));
    expect(nasdaqButOld.anchors.anchors.find((a) => a.label === 'Industry now')?.detail).toMatch(/months old/);

    const fresh = houseReturn(
      base({ industryPe: [{ date: '2026-09-24', pe: 22, exchange: 'NASDAQ' }], exchange: 'NASDAQ' }),
    );
    expect(fresh.anchors.anchors.find((a) => a.label === 'Industry now')?.excluded).toBeFalsy();
  });

  it('drops the ROIC-justified anchor for utilities and lenders', () => {
    const utility = houseReturn(base({ sector: 'Utilities', industry: 'Regulated Gas' }));
    expect(utility.anchors.anchors.find((a) => a.label.startsWith('Justified'))?.excluded).toBe(true);
    const bank = houseReturn(base({ sector: 'Financial Services', industry: 'Banks - Regional' }));
    expect(bank.anchors.anchors.find((a) => a.label.startsWith('Justified'))?.excluded).toBe(true);
    const industrial = houseReturn(base({ sector: 'Industrials', industry: 'Tools' }));
    expect(industrial.anchors.anchors.find((a) => a.label.startsWith('Justified'))?.excluded).toBeFalsy();
  });

  it('extends the last well-covered year to a thin horizon year at consensus growth (ASO)', () => {
    const forward = [
      { date: '2027-01-31', epsAvg: 6.0, epsLow: 5.5, epsHigh: 6.5, numAnalystsEps: 11 },
      { date: '2028-01-31', epsAvg: 6.6, epsLow: 6.0, epsHigh: 7.2, numAnalystsEps: 9 },
      { date: '2029-01-31', epsAvg: 7.0, epsLow: 7.0, epsHigh: 7.0, numAnalystsEps: 1 },
      { date: '2030-01-31', epsAvg: 9.0, epsLow: 9.0, epsHigh: 9.0, numAnalystsEps: 1 },
    ];
    const r = houseReturn(base({ forward }));
    // Target is the year ending nearest three years out: January 2030.
    expect(r.horizon!.estimate.date).toBe('2030-01-31');
    expect(r.horizon!.years).toBeGreaterThan(3);
    expect(r.horizonExtended!.fromFiscalYear).toBe('2027');
    // 10% a year from FY(Jan 2027) to FY(Jan 2028), carried two more years.
    expect(r.horizonExtended!.growth).toBeCloseTo(0.1, 2);
    expect(r.epsAtHorizon!).toBeCloseTo(6.6 * Math.pow(1.1, 2), 1);
    expect(r.horizon!.estimate.numAnalystsEps).toBe(9);
    expect(r.horizonNote).toMatch(/extended 2\.0 years at 10\.0% a year/);
  });

  it('caps the growth used to extend', () => {
    const forward = [
      { date: '2026-12-31', epsAvg: 1.0, epsLow: 1, epsHigh: 1, numAnalystsEps: 8 },
      { date: '2027-12-31', epsAvg: 2.0, epsLow: 2, epsHigh: 2, numAnalystsEps: 6 },
      { date: '2029-12-31', epsAvg: 9.0, epsLow: 9, epsHigh: 9, numAnalystsEps: 1 },
    ];
    const r = houseReturn(base({ forward }));
    expect(r.horizonExtended!.growth).toBe(0.25);
    expect(r.horizonExtended!.capped).toBe(true);
  });
});
