import { describe, expect, it } from 'vitest';
import { fiscalYearLabeler, forwardEstimates, pickHorizon } from '../fiscal';

/** SWK: FY2025 ended 3 January 2026, and FMP dates each year by its end. */
const swk = fiscalYearLabeler([
  { date: '2024-12-28', fiscalYear: '2024' },
  { date: '2026-01-03', fiscalYear: '2025' },
  { date: '2023-12-31', fiscalYear: '2023' },
]);

const swkEstimates = [
  { date: '2030-01-03', epsAvg: 7.61 },
  { date: '2029-01-03', epsAvg: 7.19 },
  { date: '2028-01-03', epsAvg: 6.38 },
  { date: '2027-01-03', epsAvg: 5.59 },
  { date: '2026-01-03', epsAvg: 4.55 },
  { date: '2024-12-28', epsAvg: 4.15 },
  { date: '2020-12-31', epsAvg: 8.75 },
];

describe('fiscalYearLabeler', () => {
  it('labels a year ending in early January as the prior fiscal year', () => {
    expect(swk('2026-01-03')).toBe('2025');
    expect(swk('2029-01-03')).toBe('2028');
    expect(swk('2030-01-03')).toBe('2029');
  });

  it('absorbs a 52/53-week year end drifting across the new year', () => {
    expect(swk('2024-12-28')).toBe('2024');
    expect(swk('2023-12-30')).toBe('2023');
  });

  it('follows companies that label by the year their fiscal year ends', () => {
    // A late-January year end labelled with the new calendar year.
    const nvda = fiscalYearLabeler([{ date: '2026-01-25', fiscalYear: '2026' }]);
    expect(nvda('2027-01-31')).toBe('2027');
    expect(nvda('2024-01-28')).toBe('2024');
  });

  it('falls back to the calendar year with no reported anchor', () => {
    expect(fiscalYearLabeler([])('2028-06-30')).toBe('2028');
  });
});

describe('forwardEstimates', () => {
  const today = new Date('2026-09-24T00:00:00Z');

  it('drops years already reported and orders the rest', () => {
    const f = forwardEstimates(swkEstimates, '2026-01-03', today);
    expect(f.map((e) => swk(e.date))).toEqual(['2026', '2027', '2028', '2029']);
  });

  it('drops a year that has ended but is not yet filed', () => {
    const f = forwardEstimates(swkEstimates, '2024-12-28', new Date('2026-02-01T00:00:00Z'));
    expect(f[0].date).toBe('2027-01-03');
  });
});

describe('pickHorizon', () => {
  const forward = forwardEstimates(swkEstimates, '2026-01-03', new Date('2026-09-24T00:00:00Z'));

  it('picks the fiscal year ending nearest the horizon, with the real time to it', () => {
    const h = pickHorizon(forward, 3, new Date('2026-09-24T00:00:00Z'));
    expect(swk(h!.estimate.date)).toBe('2029');
    expect(h!.years).toBeCloseTo(3.28, 1);
  });

  it('moves to the earlier year when that one ends nearer the horizon', () => {
    const h = pickHorizon(forward, 3, new Date('2026-03-01T00:00:00Z'));
    expect(swk(h!.estimate.date)).toBe('2028');
    expect(h!.years).toBeGreaterThan(2.5);
    expect(h!.years).toBeLessThan(3.5);
  });

  it('returns null with nothing to choose from', () => {
    expect(pickHorizon([], 3)).toBeNull();
  });
});
