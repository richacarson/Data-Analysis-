import 'server-only';

import { getEstimates, getMarketQuotes, getSp500Constituents } from '../fmp/endpoints';
import { pooled } from '../screen/run';
import { basketYears, calendarize, type BasketHolding, type BasketYear } from '../valuation/aggregate';
import { forwardPeYears } from '../valuation/house';

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
}

export const SP500_TOP = 10;

interface Member extends BasketHolding {
  sector: string;
}

/**
 * Builds today's snapshot. About 510 requests on a cold cache (one consensus
 * per member, quotes in batches of 100); stops early and returns null rather
 * than record an index missing part of its members.
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
  let late = false;
  const members = await pooled([...byCompany.values()], 8, async (m): Promise<Member | null> => {
    if (Date.now() > deadline) {
      late = true;
      return null;
    }
    const q = quotes.get(m.symbol);
    if (!q || !(q.price > 0) || !(q.marketCap > 0)) return null;
    const estimates = await getEstimates(m.symbol, 'annual', 10).catch(() => []);
    return {
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
  const total = priced.reduce((t, m) => t + m.weight, 0);
  const summary = (group: Member[]): BasketSummary => ({
    names: group.length,
    share: total > 0 ? group.reduce((t, m) => t + m.weight, 0) / total : 0,
    years: basketYears(group, years).slice(1),
  });

  const ranked = [...priced].sort((a, b) => b.weight - a.weight);
  const top = ranked.slice(0, SP500_TOP);
  const sectorNames = [...new Set(priced.map((m) => m.sector))];

  return {
    index: 'sp500',
    asOf: today.toISOString().slice(0, 10),
    members: listed.length,
    used: priced.filter((m) => m.eps.size > 0).length,
    years: basketYears(priced, years).slice(1),
    top: { ...summary(top), symbols: top.map((m) => m.symbol) },
    rest: summary(ranked.slice(SP500_TOP)),
    sectors: sectorNames
      .map((sector) => ({ sector, ...summary(priced.filter((m) => m.sector === sector)) }))
      .sort((a, b) => b.share - a.share),
  };
}
