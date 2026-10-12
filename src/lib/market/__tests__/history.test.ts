import { describe, expect, it } from 'vitest';
import { historySeries, indexCape, median, periodStats, HISTORY_THROUGH } from '../history';

describe('Shiller history', () => {
  it('covers 1871 to the end of the data', () => {
    const s = historySeries('trailing');
    expect(s[0].month).toBe('1871-01');
    expect(s[s.length - 1].month).toBe(HISTORY_THROUGH);
  });

  it('matches the well-known long-run figures', () => {
    const [all] = periodStats(historySeries('trailing'), null);
    expect(all.average).toBeGreaterThan(15);
    expect(all.average).toBeLessThan(17);
    const [cape] = periodStats(historySeries('cape'), null);
    expect(cape.average).toBeGreaterThan(16.5);
    expect(cape.average).toBeLessThan(18.5);
  });

  it('ranks today against each period', () => {
    const stats = periodStats(historySeries('cape'), 34);
    const since1960 = stats.find((p) => p.label === 'Since 1960')!;
    expect(since1960.percentile).toBeGreaterThan(0.9);
    expect(stats.find((p) => p.label === 'Last 10 years')!.from > '2013').toBe(true);
  });

  it('takes the middle of an even list', () => {
    expect(median([1, 3, 2, 10])).toBe(2.5);
  });
});

describe('indexCape', () => {
  it("reproduces Shiller's CAPE at the end of his data", () => {
    // Flat prices: CPI cancels and CAPE is the level over average earnings.
    const cape = indexCape({ level: 5415.14, earnings: 196.76, month: '2024-06', cpi: () => 300 });
    // Shiller's own figure for June 2024 is 34.8 with real CPI; nominal
    // earnings make this a little higher, nothing like the bottom-up 47.
    expect(cape).toBeGreaterThan(30);
    expect(cape).toBeLessThan(42);
  });

  it('bridges from the end of the data to today', () => {
    const cape = indexCape({ level: 7800, earnings: 297, month: '2026-10', cpi: () => 300 });
    expect(cape).not.toBeNull();
    expect(cape!).toBeGreaterThan(30);
  });

  it('needs ten years of CPI', () => {
    expect(indexCape({ level: 7800, earnings: 297, month: '2026-10', cpi: (m) => (m > '2020-01' ? 300 : null) })).toBeNull();
  });
});
