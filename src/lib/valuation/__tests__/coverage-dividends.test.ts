import { describe, expect, it } from 'vitest';
import { pickCoveredHorizon } from '../fiscal';
import { forwardDividend } from '../dividends';

const today = new Date('2026-09-25T00:00:00Z');

describe('pickCoveredHorizon', () => {
  // Keysight as FMP has it: FY2029 is one analyst, FY2028 two.
  const keys = [
    { date: '2026-10-31', epsAvg: 11.46, numAnalystsEps: 6 },
    { date: '2027-10-31', epsAvg: 13.7, numAnalystsEps: 6 },
    { date: '2028-10-31', epsAvg: 15.27, numAnalystsEps: 2 },
    { date: '2029-10-31', epsAvg: 11.18, numAnalystsEps: 1 },
  ];

  it('steps back from a year one analyst forecasts', () => {
    const h = pickCoveredHorizon(keys, 3, today)!;
    expect(h.estimate.epsAvg).toBe(13.7);
    expect(h.skipped?.analysts).toBe(1);
    expect(h.years).toBeCloseTo(1.1, 1);
  });

  it('drops a year covered by a sliver of the analysts following nearer years', () => {
    // Freeport: FY2029 has 4 analysts against 14 for FY2027.
    const fcx = [
      { date: '2027-12-31', epsAvg: 4.0, numAnalystsEps: 14 },
      { date: '2028-12-31', epsAvg: 4.46, numAnalystsEps: 10 },
      { date: '2029-12-31', epsAvg: 4.7, numAnalystsEps: 4 },
    ];
    expect(pickCoveredHorizon(fcx, 3, today)!.estimate.epsAvg).toBe(4.46);
  });

  it('keeps the nominal year when it is well covered', () => {
    const swk = [
      { date: '2028-01-03', epsAvg: 6.38, numAnalystsEps: 9 },
      { date: '2029-01-03', epsAvg: 7.19, numAnalystsEps: 6 },
      { date: '2030-01-03', epsAvg: 7.61, numAnalystsEps: 4 },
    ];
    const h = pickCoveredHorizon(swk, 3, today)!;
    expect(h.estimate.epsAvg).toBe(7.61);
    expect(h.skipped).toBeNull();
  });
});

describe('forwardDividend', () => {
  it('runs a quarterly payer at its latest declared rate', () => {
    const cl = [
      { date: '2026-10-20', dividend: 0.53, frequency: 'Quarterly' },
      { date: '2026-07-20', dividend: 0.52, frequency: 'Quarterly' },
    ];
    const d = forwardDividend(cl, 85.32, today);
    expect(d.method).toBe('run-rate');
    expect(d.annual).toBeCloseTo(2.12);
  });

  it('uses the trailing year for an uneven semi-annual payer', () => {
    // NatWest: a small interim and a larger final.
    const nwg = [
      { date: '2026-08-14', dividend: 0.32313, frequency: 'Semi-Annual' },
      { date: '2026-03-20', dividend: 0.62071, frequency: 'Semi-Annual' },
      { date: '2025-08-08', dividend: 0.25473, frequency: 'Semi-Annual' },
    ];
    const d = forwardDividend(nwg, 18.435, today);
    expect(d.method).toBe('trailing');
    expect(d.yield).toBeCloseTo(0.0512, 3);
  });

  it('reports nothing for a company that has stopped paying', () => {
    expect(forwardDividend([{ date: '2024-01-10', dividend: 1, frequency: 'Quarterly' }], 50, today).yield).toBe(0);
  });
});
