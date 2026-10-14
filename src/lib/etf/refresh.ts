import 'server-only';

import { getMarketQuotes } from '../fmp/endpoints';
import { writer } from '../estimates/store';
import { etfSleeveKey, fetchHoldings, tickerCandidates, type EtfFund } from './ishares';

export interface EtfRefresh {
  symbol: string;
  asOf: string | null;
  holdings: number;
  /** Holdings matched to a ticker FMP prices; the rest are left out and the weights rescaled. */
  matched: number;
  unmatched: string[];
  /** Share of the fund's equity weight the matched holdings carry. */
  coverage: number;
  top: Array<{ symbol: string; weight: number }>;
  written?: number;
}

/** Fetches a fund's holdings, matches them to FMP tickers and (unless dry) saves the sleeve. */
export async function refreshEtfSleeve(fund: EtfFund, sort: number, dry: boolean): Promise<EtfRefresh> {
  const { asOf, holdings } = await fetchHoldings(fund);
  if (holdings.length < 10) throw new Error(`${fund.symbol}: only ${holdings.length} equity holdings in the file`);

  const candidates = [...new Set(holdings.flatMap((h) => tickerCandidates(h.ticker)))];
  const priced = new Set<string>();
  for (let i = 0; i < candidates.length; i += 100) {
    for (const q of await getMarketQuotes(candidates.slice(i, i + 100))) if (q.price > 0) priced.add(q.symbol.toUpperCase());
  }

  const matched: Array<{ symbol: string; weight: number }> = [];
  const unmatched: string[] = [];
  for (const h of holdings) {
    const symbol = tickerCandidates(h.ticker).find((c) => priced.has(c));
    if (symbol) matched.push({ symbol, weight: h.weight });
    else unmatched.push(h.ticker);
  }
  const total = holdings.reduce((t, h) => t + h.weight, 0);
  const kept = matched.reduce((t, h) => t + h.weight, 0);
  if (!(kept > 0)) throw new Error(`${fund.symbol}: no holdings matched a priced ticker`);
  const rows = matched.map((h) => ({ symbol: h.symbol, weight: h.weight / kept }));

  const result: EtfRefresh = {
    symbol: fund.symbol,
    asOf,
    holdings: holdings.length,
    matched: matched.length,
    unmatched,
    coverage: total > 0 ? kept / total : 0,
    top: [...rows].sort((a, b) => b.weight - a.weight).slice(0, 10),
  };
  if (dry) return result;

  const w = writer();
  if (!w) throw new Error('Supabase is not configured');
  const { data, error } = await w.client.rpc('eq_record_etf_sleeve', {
    p_secret: w.secret,
    p_key: etfSleeveKey(fund.symbol),
    p_name: fund.name,
    p_sort: sort,
    p_as_of: asOf ?? new Date().toISOString().slice(0, 10),
    p_source: `iShares ${fund.symbol} holdings`,
    p_rows: rows,
  });
  if (error) throw new Error(`Saving ${fund.symbol} failed: ${error.message}`);
  return { ...result, written: typeof data === 'number' ? data : undefined };
}
