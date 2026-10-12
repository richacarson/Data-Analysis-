import 'server-only';

import {
  getEstimates,
  getIndexQuote,
  getMarketQuotes,
  getRatiosTTM,
  getSp500Constituents,
} from '../fmp/endpoints';
import { pooled, runScreen } from '../screen/run';
import {
  basketYears,
  calendarize,
  returnSummary,
  totalMultiple,
  type BasketHolding,
  type BasketYear,
  type ReturnSummary,
  type TotalMultiple,
} from '../valuation/aggregate';
import { DEFAULT_HURDLE } from '../valuation/build';
import { forwardPeYears } from '../valuation/house';
import { getCpi } from './cpi';
import { indexCape } from './history';

/**
 * The S&P 500 built bottom-up from its members' consensus, the way FactSet and
 * S&P report the index's forward P/E: every member weighted by market value,
 * earnings restated to calendar years, total value over total earnings.
 *
 * Market value stands in for the index's float-adjusted weights; the two
 * differ by a few tenths of a point at most. Share classes of one company
 * (Alphabet, Fox, News Corp) each report the whole company's value, so one
 * class per company is kept.
 */

export interface BasketSummary {
  names: number;
  /** Share of the index's value. */
  share: number;
  years: BasketYear[];
}

export interface MarketSnapshot {
  index: 'sp500';
  asOf: string;
  /** Members listed, and those priced with consensus the figures rest on. */
  members: number;
  used: number;
  years: BasketYear[];
  top: BasketSummary & { symbols: string[] };
  rest: BasketSummary;
  sectors: Array<BasketSummary & { sector: string }>;
  /**
   * Forward twelve-month P/E, the basis FactSet's averages are quoted on: the
   * rest of this calendar year's consensus and the matching part of next year's.
   */
  ntmPe?: number | null;
  /** Price over the last four reported quarters' earnings, losses netted in. */
  trailing?: TotalMultiple;
  /** Price over ten years of inflation-adjusted reported earnings, at index level. */
  cape?: { value: number | null; level: number; earnings: number };
  /** The house 3-year expected return across the members, by market value. */
  expected?: ReturnSummary & { hurdle: number };
}

export const SP500_TOP = 10;

interface Member extends BasketHolding {
  sector: string;
  /** Reported (GAAP) EPS over the last twelve months. */
  trailingEps: number | null;
}

/**
 * Builds today's snapshot: about 1,500 requests for the P/Es (consensus, TTM
 * ratios and ten years of statements per member) and several thousand more for
 * the expected return. Stops at the deadline and returns null rather than
 * record an index missing part of its members; what was fetched is cached, so
 * the next pass picks up where this one stopped.
 */
export async function buildSp500Snapshot(deadline: number, today = new Date()): Promise<MarketSnapshot | null> {
  const listed = await getSp500Constituents();
  if (listed.length < 400) throw new Error(`S&P 500 list came back with ${listed.length} members`);

  const quotes = new Map<string, { price: number; marketCap: number }>();
  const symbols = listed.map((m) => m.symbol);
  for (let i = 0; i < symbols.length; i += 100) {
    for (const q of await getMarketQuotes(symbols.slice(i, i + 100))) quotes.set(q.symbol, q);
  }

  // One share class per company: the larger listing carries the value.
  const byCompany = new Map<string, (typeof listed)[number]>();
  for (const m of listed) {
    const key = m.cik || m.symbol;
    const held = byCompany.get(key);
    if (!held || (quotes.get(m.symbol)?.marketCap ?? 0) > (quotes.get(held.symbol)?.marketCap ?? 0)) byCompany.set(key, m);
  }

  const shown = forwardPeYears(today);
  // The year before the first shown, so the first year has a growth rate.
  const years = [String(Number(shown[0]) - 1), ...shown];
  // Without CPI or the index level only CAPE is lost; the rest stands.
  const [cpi, spx] = await Promise.all([getCpi().catch(() => null), getIndexQuote('^GSPC').catch(() => null)]);
  let late = false;
  const members = await pooled([...byCompany.values()], 8, async (m): Promise<Member | null> => {
    if (Date.now() > deadline) {
      late = true;
      return null;
    }
    const q = quotes.get(m.symbol);
    if (!q || !(q.price > 0) || !(q.marketCap > 0)) return null;
    const [estimates, ratios] = await Promise.all([
      getEstimates(m.symbol, 'annual', 10).catch(() => []),
      getRatiosTTM(m.symbol).catch(() => null),
    ]);
    return {
      trailingEps: ratios && Number.isFinite(ratios.netIncomePerShareTTM) ? ratios.netIncomePerShareTTM : null,
      symbol: m.symbol,
      sector: m.sector || 'Other',
      weight: q.marketCap,
      price: q.price,
      eps: calendarize(
        estimates.map((e) => ({ date: e.date, eps: e.epsAvg })),
        years,
      ),
    };
  });
  if (late) return null;

  const priced = members.filter((m): m is Member => m !== null);

  // The house expected return for every member, the model the stock pages use.
  const screened = await runScreen(
    priced.map((m) => m.symbol),
    { deadline, correlation: false, hurdle: DEFAULT_HURDLE },
  );
  if (screened.some((r) => r.note?.startsWith('Still loading'))) return null;
  const cagrOf = new Map(screened.map((r) => [r.symbol, r.review ? null : r.expectedCagr]));

  const total = priced.reduce((t, m) => t + m.weight, 0);
  const summary = (group: Member[]): BasketSummary => ({
    names: group.length,
    share: total > 0 ? group.reduce((t, m) => t + m.weight, 0) / total : 0,
    years: basketYears(group, years).slice(1),
  });

  const ranked = [...priced].sort((a, b) => b.weight - a.weight);
  const top = ranked.slice(0, SP500_TOP);
  const sectorNames = [...new Set(priced.map((m) => m.sector))];

  const trailing = totalMultiple(priced.map((m) => ({ weight: m.weight, price: m.price, perShare: m.trailingEps })));
  const all = basketYears(priced, years);
  const [current, next] = all;
  const yearStart = Date.UTC(today.getUTCFullYear(), 0, 1);
  const left = Math.max(0, Math.min(1, 1 - (today.getTime() - yearStart) / (365.25 * 86_400_000)));
  const ntmYield = current?.pe && next?.pe ? left / current.pe + (1 - left) / next.pe : null;

  return {
    index: 'sp500',
    ntmPe: ntmYield ? 1 / ntmYield : null,
    asOf: today.toISOString().slice(0, 10),
    members: listed.length,
    used: priced.filter((m) => m.eps.size > 0).length,
    years: all.slice(1),
    top: { ...summary(top), symbols: top.map((m) => m.symbol) },
    rest: summary(ranked.slice(SP500_TOP)),
    sectors: sectorNames
      .map((sector) => ({ sector, ...summary(priced.filter((m) => m.sector === sector)) }))
      .sort((a, b) => b.share - a.share),
    trailing,
    cape:
      cpi && spx?.price && trailing.value
        ? {
            level: spx.price,
            earnings: spx.price / trailing.value,
            value: indexCape({
              level: spx.price,
              earnings: spx.price / trailing.value,
              month: today.toISOString().slice(0, 7),
              cpi: (month) => cpi.at(`${month}-01`),
            }),
          }
        : undefined,
    expected: {
      ...returnSummary(
        priced.map((m) => ({ weight: m.weight, cagr: cagrOf.get(m.symbol) ?? null })),
        DEFAULT_HURDLE,
      ),
      hurdle: DEFAULT_HURDLE,
    },
  };
}
