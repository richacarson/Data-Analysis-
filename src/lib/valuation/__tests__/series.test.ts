import { describe, expect, it } from 'vitest';
import {
  epsActualVsEstimate,
  indexedToStart,
  revenueBySegment,
  trailingTwelveMonths,
} from '../series';

const quarter = (date: string, fy: string, p: string, revenue: number, netIncome: number) => ({
  date, fiscalYear: fy, period: p, revenue, netIncome,
});

describe('trailingTwelveMonths', () => {
  const quarters = [
    quarter('2025-03-31', '2025', 'Q1', 100, 10),
    quarter('2025-06-30', '2025', 'Q2', 110, 12),
    quarter('2025-09-30', '2025', 'Q3', 120, 15),
    quarter('2025-12-31', '2025', 'Q4', 130, 20),
    quarter('2026-03-31', '2026', 'Q1', 140, 25),
  ];

  it('sums four quarters and needs four to start', () => {
    const ttm = trailingTwelveMonths(quarters);
    expect(ttm).toHaveLength(2);
    expect(ttm[0].revenue).toBe(460);
    expect(ttm[0].netIncome).toBe(57);
    expect(ttm[0].margin).toBeCloseTo(57 / 460);
  });

  it('rolls the window forward one quarter at a time', () => {
    const ttm = trailingTwelveMonths(quarters);
    expect(ttm[1].revenue).toBe(500); // drops Q1 2025, adds Q1 2026
    expect(ttm[1].label).toBe('Q1 2026');
  });

  it('sorts newest-first input into chronological order', () => {
    const reversed = [...quarters].reverse();
    expect(trailingTwelveMonths(reversed)).toEqual(trailingTwelveMonths(quarters));
  });

  it('keeps a negative margin, which is the loss-making era', () => {
    const losses = [
      quarter('2025-03-31', '2025', 'Q1', 100, -40),
      quarter('2025-06-30', '2025', 'Q2', 100, -30),
      quarter('2025-09-30', '2025', 'Q3', 100, -20),
      quarter('2025-12-31', '2025', 'Q4', 100, -10),
    ];
    expect(trailingTwelveMonths(losses)[0].margin).toBeCloseTo(-0.25);
  });

  it('returns nothing with fewer than four quarters', () => {
    expect(trailingTwelveMonths(quarters.slice(0, 3))).toHaveLength(0);
  });
});

describe('epsActualVsEstimate', () => {
  it('marks reported years actual and future years estimated', () => {
    const out = epsActualVsEstimate(
      [{ fiscalYear: '2025', epsDiluted: 13.64 }, { fiscalYear: '2026', epsDiluted: 17.95 }],
      [
        { date: '2027-06-30', epsAvg: 21.36, epsLow: 19, epsHigh: 23 },
        { date: '2028-06-30', epsAvg: 25.42, epsLow: 22, epsHigh: 28 },
      ],
    );
    expect(out.map((p) => p.year)).toEqual(['2025', '2026', '2027', '2028']);
    expect(out.filter((p) => p.actual).map((p) => p.year)).toEqual(['2025', '2026']);
  });

  it('lets a reported result supersede the estimate for the same year', () => {
    const out = epsActualVsEstimate(
      [{ fiscalYear: '2026', epsDiluted: 17.95 }],
      [{ date: '2026-06-30', epsAvg: 17.2, epsLow: 17, epsHigh: 17.5 }],
    );
    expect(out).toHaveLength(1);
    expect(out[0].eps).toBe(17.95);
    expect(out[0].actual).toBe(true);
  });
});

describe('revenueBySegment', () => {
  const rows: Array<{ fiscalYear: number; data: Record<string, number> }> = [
    { fiscalYear: 2011, data: { Portables: 15344, iPod: 7453 } },
    { fiscalYear: 2024, data: { iPhone: 201183, Service: 96169, Mac: 29984 } },
    { fiscalYear: 2025, data: { iPhone: 209586, Service: 109158, Mac: 33708 } },
  ];

  it('uses the latest year to define the segments, largest first', () => {
    const s = revenueBySegment(rows);
    expect(s.segments).toEqual(['iPhone', 'Service', 'Mac']);
  });

  it('drops years that predate the current taxonomy entirely', () => {
    // 2011's Portables/iPod share no labels with the 2025 breakdown.
    const s = revenueBySegment(rows);
    expect(s.points.map((p) => p.year)).toEqual(['2024', '2025']);
  });

  it('fills a segment missing from an older year with zero', () => {
    const s = revenueBySegment([
      { fiscalYear: 2024, data: { iPhone: 100 } },
      { fiscalYear: 2025, data: { iPhone: 110, Vision: 5 } },
    ]);
    expect(s.points[0].Vision).toBe(0);
  });

  it('handles an empty input', () => {
    expect(revenueBySegment([])).toEqual({ points: [], segments: [] });
  });
});

describe('indexedToStart', () => {
  it('rebases both series to 100 and exposes the divergence', () => {
    const out = indexedToStart([
      { year: '2022', price: 10, fundamental: 100 },
      { year: '2025', price: 40, fundamental: 150 },
    ]);
    expect(out[0]).toEqual({ year: '2022', price: 100, fundamental: 100 });
    // Price quadrupled while the business grew 50%.
    expect(out[1].price).toBe(400);
    expect(out[1].fundamental).toBe(150);
  });

  it('skips periods that cannot be rebased', () => {
    const out = indexedToStart([
      { year: '2022', price: 0, fundamental: 100 },
      { year: '2023', price: 10, fundamental: 100 },
      { year: '2024', price: 20, fundamental: -50 },
      { year: '2025', price: 30, fundamental: 200 },
    ]);
    expect(out.map((p) => p.year)).toEqual(['2023', '2025']);
    expect(out[0].price).toBe(100);
  });

  it('returns nothing when no period is usable', () => {
    expect(indexedToStart([{ year: '2025', price: 0, fundamental: 0 }])).toEqual([]);
  });
});
