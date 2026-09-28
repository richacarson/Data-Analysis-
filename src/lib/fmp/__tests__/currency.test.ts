import { describe, expect, it } from 'vitest';
import { convertRow, depositaryRatio } from '../currency';

describe('depositaryRatio', () => {
  it('reads 1 where the statements already count ADR-equivalent shares', () => {
    // Novo Nordisk: $171.9bn at $38.71 is 4.44bn ADRs; the statements count 4.44bn shares.
    expect(depositaryRatio(171_895_959_525, 38.71, 4.44e9)).toBe(1);
  });

  it('snaps a one-for-five ADR to 0.2 when the statements count ordinary shares', () => {
    // TSMC's $2.35tn at $452.88 is 5.19bn ADRs against 25.93bn ordinary shares.
    expect(depositaryRatio(2_348_853_062_400, 452.88, 25.93e9)).toBeCloseTo(0.2, 10);
  });

  it('falls back to 1 on missing or implausible inputs', () => {
    expect(depositaryRatio(0, 10, 1e9)).toBe(1);
    expect(depositaryRatio(1e12, 10, 1)).toBe(1);
  });
});

describe('convertRow', () => {
  it('converts amounts by the rate, per-share figures per ADR, and leaves counts of analysts alone', () => {
    // Novo-like: DKK 309bn of revenue at 0.1522 is about $47bn.
    const row = {
      date: '2025-12-31',
      fiscalYear: '2025',
      reportedCurrency: 'DKK',
      revenue: 309.06e9,
      epsDiluted: 23.03,
      weightedAverageShsOutDil: 4.44e9,
      numAnalystsEps: 12,
    };
    const out = convertRow(row, { fx: 0.1522, shareRatio: 1, from: 'DKK', to: 'USD' });
    expect(out.revenue / 1e9).toBeCloseTo(47.04, 1);
    expect(out.epsDiluted).toBeCloseTo(3.505, 3);
    expect(out.weightedAverageShsOutDil).toBe(4.44e9);
    expect(out.numAnalystsEps).toBe(12);
    expect(out.fiscalYear).toBe('2025');
    expect(out.reportedCurrency).toBe('USD');
  });

  it('restates per-share figures and share counts on the ADR basis', () => {
    const out = convertRow({ eps: 10, weightedAverageShsOut: 25e9, netIncome: 250e9 }, { fx: 0.03, shareRatio: 0.2, from: 'TWD', to: 'USD' });
    expect(out.eps).toBeCloseTo(1.5, 10); // 10 TWD × 0.03 per share, × 5 shares per ADR
    expect(out.weightedAverageShsOut).toBe(5e9);
    expect(out.netIncome).toBeCloseTo(7.5e9, 0);
    // Net income over ADR count still equals EPS.
    expect(out.netIncome / out.weightedAverageShsOut).toBeCloseTo(out.eps, 10);
  });
});
