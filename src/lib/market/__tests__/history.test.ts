import { describe, expect, it } from 'vitest';
import { historySeries, median, periodStats, HISTORY_THROUGH } from '../history';

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
  });

  it('ranks today against each period', () => {
    const stats = periodStats(historySeries('trailing'), 26);
    const since1960 = stats.find((p) => p.label === 'Since 1960')!;
    expect(since1960.percentile).toBeGreaterThan(0.8);
    expect(stats.find((p) => p.label === 'Last 10 years')!.from > '2013').toBe(true);
  });

  it('takes the middle of an even list', () => {
    expect(median([1, 3, 2, 10])).toBe(2.5);
  });
});
