/**
 * A basket's forward P/E and earnings growth, built bottom-up the way index
 * providers build theirs: total value over total earnings, each holding
 * counted by its weight. A plain mean of P/Es lets one 90x name pull the
 * figure far off what the basket pays for its earnings.
 *
 * Used for the sleeves (weights from the IC proposal, or equal) and for the
 * S&P 500 (weights by market value), so the two compare like for like.
 */

export interface BasketHolding {
  symbol: string;
  /** Any positive scale: a fraction of the sleeve, or dollars of market value. */
  weight: number;
  price: number;
  /** Consensus EPS by fiscal year, in the quote currency. */
  eps: Map<string, number>;
}

export interface BasketYear {
  year: string;
  /** Null when no holding has positive consensus for the year. */
  pe: number | null;
  /** Earnings growth from the year before, on the holdings with consensus for both. */
  growth: number | null;
  /** Holdings with positive consensus, which the P/E is built from. */
  count: number;
  /** Holdings expected to lose money that year: no P/E, counted aside. */
  losses: number;
  /** Share of the basket's weight the P/E covers. */
  coverage: number;
}

/**
 * Below this a "P/E" is almost certainly a currency mix-up (consensus in yen
 * or Taiwan dollars against a dollar price), not a cheap stock.
 */
export const MIN_SANE_PE = 2;

/** Weight-scaled earnings: what the holding contributes to the basket's earnings. */
const earned = (h: BasketHolding, eps: number) => (h.weight * eps) / h.price;

export function basketYears(holdings: BasketHolding[], years: string[]): BasketYear[] {
  const usable = holdings.filter((h) => h.weight > 0 && h.price > 0);
  const total = usable.reduce((t, h) => t + h.weight, 0);
  const sane = (h: BasketHolding, eps: number | undefined): eps is number =>
    eps !== undefined && Number.isFinite(eps) && !(eps > 0 && h.price / eps < MIN_SANE_PE);

  return years.map((year, i) => {
    let weight = 0;
    let earnings = 0;
    let count = 0;
    let losses = 0;
    for (const h of usable) {
      const eps = h.eps.get(year);
      if (!sane(h, eps)) continue;
      if (eps <= 0) {
        losses += 1;
        continue;
      }
      weight += h.weight;
      earnings += earned(h, eps);
      count += 1;
    }

    // Growth on a constant set of holdings, losses included, so a name
    // entering coverage is not mistaken for earnings growth.
    let growth: number | null = null;
    const prior = i > 0 ? years[i - 1] : null;
    if (prior) {
      let before = 0;
      let after = 0;
      for (const h of usable) {
        const a = h.eps.get(prior);
        const b = h.eps.get(year);
        if (!sane(h, a) || !sane(h, b)) continue;
        before += earned(h, a);
        after += earned(h, b);
      }
      growth = before > 0 ? after / before - 1 : null;
    }

    return {
      year,
      pe: earnings > 0 ? weight / earnings : null,
      growth,
      count,
      losses,
      coverage: total > 0 ? weight / total : 0,
    };
  });
}

const DAY = 86_400_000;
const at = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

/**
 * Consensus EPS restated to calendar years, as index providers report them.
 * A fiscal year is the twelve months to its end date; calendar year Y takes
 * each fiscal year's EPS in proportion to the days it shares with Y. Apple's
 * year to September counts three-quarters to its own year and a quarter to
 * the next, so its earnings line up with a December reporter's. A calendar
 * year is left out unless fiscal years cover nearly all of it.
 */
export function calendarize(estimates: Array<{ date: string; eps: number }>, years: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const year of years) {
    const start = at(`${year}-01-01`);
    const end = at(`${Number(year) + 1}-01-01`);
    let eps = 0;
    let covered = 0;
    for (const e of estimates) {
      if (!Number.isFinite(e.eps)) continue;
      const fyEnd = at(e.date) + DAY;
      const fyStart = fyEnd - 365.25 * DAY;
      const overlap = Math.min(end, fyEnd) - Math.max(start, fyStart);
      if (overlap <= 0) continue;
      const share = overlap / (365.25 * DAY);
      eps += e.eps * share;
      covered += share;
    }
    if (covered >= 0.97) out.set(year, eps / covered);
  }
  return out;
}

export interface TotalMultiple {
  /** Total value over total earnings; null when the earnings sum to a loss. */
  value: number | null;
  count: number;
  /** Share of the basket's weight with the earnings figure. */
  coverage: number;
}

/**
 * Value over earnings with losses netted in, the way an index's reported
 * earnings are: Shiller's S&P 500 earnings are the members' profits less
 * their losses. Used for the trailing P/E and CAPE that are set against his
 * history; the forward P/E leaves loss years out instead.
 */
export function totalMultiple(items: Array<{ weight: number; price: number; perShare: number | null }>): TotalMultiple {
  const usable = items.filter((i) => i.weight > 0 && i.price > 0);
  const total = usable.reduce((t, i) => t + i.weight, 0);
  let weight = 0;
  let earnings = 0;
  let count = 0;
  for (const i of usable) {
    if (i.perShare === null || !Number.isFinite(i.perShare)) continue;
    if (i.perShare > 0 && i.price / i.perShare < MIN_SANE_PE) continue;
    weight += i.weight;
    earnings += (i.weight * i.perShare) / i.price;
    count += 1;
  }
  return { value: earnings > 0 ? weight / earnings : null, count, coverage: total > 0 ? weight / total : 0 };
}

export interface ReturnSummary {
  /** Average expected CAGR by weight, over the holdings scored. */
  average: number | null;
  /** The CAGR with half the scored weight above it. */
  median: number | null;
  /** Share of the scored weight at or above the hurdle. */
  clearing: number;
  /** Share of the whole basket's weight that was scored. */
  coverage: number;
  count: number;
}

export function returnSummary(items: Array<{ weight: number; cagr: number | null }>, hurdle: number): ReturnSummary {
  const total = items.reduce((t, i) => t + (i.weight > 0 ? i.weight : 0), 0);
  const scored = items.filter((i): i is { weight: number; cagr: number } => i.weight > 0 && i.cagr !== null && Number.isFinite(i.cagr));
  const w = scored.reduce((t, i) => t + i.weight, 0);
  if (!scored.length || w <= 0) return { average: null, median: null, clearing: 0, coverage: 0, count: 0 };
  const sorted = [...scored].sort((a, b) => a.cagr - b.cagr);
  let running = 0;
  let med: number | null = null;
  for (const i of sorted) {
    running += i.weight;
    if (running >= w / 2) {
      med = i.cagr;
      break;
    }
  }
  return {
    average: scored.reduce((t, i) => t + i.weight * i.cagr, 0) / w,
    median: med,
    clearing: scored.filter((i) => i.cagr >= hurdle).reduce((t, i) => t + i.weight, 0) / w,
    coverage: total > 0 ? w / total : 0,
    count: scored.length,
  };
}
