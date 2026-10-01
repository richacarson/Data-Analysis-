/**
 * How a stock moves with the S&P 500.
 *
 * Weekly returns rather than daily: daily closes are noisy for thinly traded
 * names and misalign across time zones for ADRs, while weekly closes keep
 * enough observations (about 156 over three years) for a stable estimate.
 * Correlation says how much of the stock's movement is the market's; beta
 * says how far it moves when the market does. Both come from the same
 * aligned returns, so they can be read together.
 */

export interface MarketLink {
  /** Pearson correlation of weekly log returns with the market. */
  correlation: number;
  /** Covariance with the market over the market's variance. */
  beta: number;
  /** Weekly returns the estimate rests on. */
  weeks: number;
}

/** Fewer weekly returns than this is not an estimate worth showing. */
export const MIN_WEEKS = 26;

/** Monday of the week a date falls in, as YYYY-MM-DD. */
function weekKey(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/** The last close of each week. */
export function weeklyCloses(prices: Array<{ date: string; price: number }>): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of [...prices].sort((a, b) => a.date.localeCompare(b.date))) {
    if (Number.isFinite(p.price) && p.price > 0) out.set(weekKey(p.date), p.price);
  }
  return out;
}

/**
 * Correlation and beta over the most recent `weeks` weekly returns where both
 * series traded in consecutive weeks.
 */
export function marketLink(
  stock: Array<{ date: string; price: number }>,
  market: Array<{ date: string; price: number }>,
  weeks: number,
): MarketLink | null {
  const s = weeklyCloses(stock);
  const m = weeklyCloses(market);
  const keys = [...s.keys()].filter((k) => m.has(k)).sort();
  const rs: number[] = [];
  const rm: number[] = [];
  for (let i = 1; i < keys.length; i++) {
    const gap = (Date.parse(keys[i]) - Date.parse(keys[i - 1])) / 86_400_000;
    if (gap !== 7) continue; // a missing week would fold two weeks into one return
    rs.push(Math.log(s.get(keys[i])! / s.get(keys[i - 1])!));
    rm.push(Math.log(m.get(keys[i])! / m.get(keys[i - 1])!));
  }
  const a = rs.slice(-weeks);
  const b = rm.slice(-weeks);
  if (a.length < MIN_WEEKS) return null;
  const mean = (x: number[]) => x.reduce((t, v) => t + v, 0) / x.length;
  const ma = mean(a);
  const mb = mean(b);
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < a.length; i++) {
    cov += (a[i] - ma) * (b[i] - mb);
    va += (a[i] - ma) ** 2;
    vb += (b[i] - mb) ** 2;
  }
  if (!(va > 0) || !(vb > 0)) return null;
  return { correlation: cov / Math.sqrt(va * vb), beta: cov / vb, weeks: a.length };
}
