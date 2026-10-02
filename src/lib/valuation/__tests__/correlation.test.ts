import { describe, expect, it } from 'vitest';
import { marketLink, portfolioLink } from '../correlation';

/** Daily closes, Monday to Friday, from weekly returns. */
function series(weekly: number[], start = '2023-01-02'): Array<{ date: string; price: number }> {
  const out: Array<{ date: string; price: number }> = [];
  let price = 100;
  const t0 = Date.parse(`${start}T00:00:00Z`);
  weekly.forEach((r, w) => {
    price *= Math.exp(r);
    for (let d = 0; d < 5; d++) {
      out.push({ date: new Date(t0 + (w * 7 + d) * 86_400_000).toISOString().slice(0, 10), price });
    }
  });
  return out;
}

const market = Array.from({ length: 160 }, (_, i) => Math.sin(i * 1.7) * 0.02 + Math.cos(i * 0.9) * 0.01);

describe('marketLink', () => {
  it('reads a stock that is the market at twice the size as correlation 1 and beta 2', () => {
    const m = series(market);
    const s = series(market.map((r) => 2 * r));
    const link = marketLink(s, m, 156)!;
    expect(link.correlation).toBeCloseTo(1, 6);
    expect(link.beta).toBeCloseTo(2, 6);
    expect(link.weeks).toBe(156);
  });

  it('reads a stock moving against the market as negatively correlated', () => {
    const link = marketLink(series(market.map((r) => -r)), series(market), 52)!;
    expect(link.correlation).toBeCloseTo(-1, 6);
    expect(link.weeks).toBe(52);
  });

  it('finds little relation between unrelated series', () => {
    const other = Array.from({ length: 160 }, (_, i) => Math.sin(i * 2.9 + 1) * 0.02);
    const link = marketLink(series(other), series(market), 156)!;
    expect(Math.abs(link.correlation)).toBeLessThan(0.3);
  });

  it('needs half a year of overlapping weeks', () => {
    expect(marketLink(series(market.slice(0, 20)), series(market), 156)).toBeNull();
  });
});

describe('portfolioLink', () => {
  it('reads an equal-weighted sleeve as more correlated than its average holding', () => {
    // Each holding is the market plus its own noise; the noise cancels in the portfolio.
    const noise = (seed: number) => Array.from({ length: 160 }, (_, i) => Math.sin(i * (2.3 + seed) + seed) * 0.03);
    const holdings = [0.4, 1.1, 1.7, 2.6].map((seed) => market.map((r, i) => r + noise(seed)[i]));
    const m = series(market);
    const single = holdings.map((h) => marketLink(series(h), m, 156)!.correlation);
    const average = single.reduce((t, c) => t + c, 0) / single.length;
    const sleeve = portfolioLink(holdings.map((h) => series(h)), m, 156)!;
    expect(sleeve.holdings).toBe(4);
    expect(sleeve.correlation).toBeGreaterThan(average);
    expect(sleeve.beta).toBeCloseTo(1, 1);
  });
});
