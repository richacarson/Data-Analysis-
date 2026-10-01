import { describe, expect, it } from 'vitest';
import { marketLink } from '../correlation';

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
