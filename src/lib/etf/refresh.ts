import 'server-only';

import { getMarketQuotes } from '../fmp/endpoints';
import { writer } from '../estimates/store';
import { etfSleeveKey, fetchHoldings, tickerCandidates, type EtfFund, type EtfHoldings } from './ishares';
import { nportHoldings } from './nport';

export interface EtfRefresh {
  symbol: string;
  /** Where the holdings came from: the issuer's daily file or the SEC filing. */
  source: 'ishares' | 'sec';
  /** Holdings the source listed without a ticker. */
  noTicker: number;
  sample: unknown[];
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
  // The issuer's daily file first; it refuses some callers, so the SEC
  // filing (a couple of months older) is the fallback.
  let source: EtfRefresh['source'] = 'ishares';
  let fetched: EtfHoldings;
  let issuerError: string | null = null;
  try {
    fetched = await fetchHoldings(fund);
  } catch (error) {
    issuerError = error instanceof Error ? error.message : String(error);
    source = 'sec';
    fetched = await nportHoldings(fund, fund.secName);
  }
  const { asOf, holdings } = fetched;
  if (holdings.length < 10) throw new Error(`${fund.symbol}: only ${holdings.length} equity holdings in the file`);

  const candidates = [...new Set(holdings.filter((h) => h.ticker).flatMap((h) => tickerCandidates(h.ticker)))];
  const priced = new Set<string>();
  for (let i = 0; i < candidates.length; i += 100) {
    for (const q of await getMarketQuotes(candidates.slice(i, i + 100))) if (q.price > 0) priced.add(q.symbol.toUpperCase());
  }

  const matched: Array<{ symbol: string; weight: number }> = [];
  const unmatched: string[] = [];
  for (const h of holdings) {
    const symbol = h.ticker ? tickerCandidates(h.ticker).find((c) => priced.has(c)) : undefined;
    if (symbol) matched.push({ symbol, weight: h.weight });
    else unmatched.push(h.ticker || h.name);
  }
  const total = holdings.reduce((t, h) => t + h.weight, 0);
  const kept = matched.reduce((t, h) => t + h.weight, 0);
  if (!(kept > 0) && dry) {
    return { symbol: fund.symbol, source, asOf, holdings: holdings.length, matched: 0, unmatched: unmatched.slice(0, 20), coverage: 0, top: [], noTicker: holdings.filter((h) => !h.ticker).length, sample: holdings.slice(0, 3) };
  }
  if (!(kept > 0)) throw new Error(`${fund.symbol}: no holdings matched a priced ticker`);
  const rows = matched.map((h) => ({ symbol: h.symbol, weight: h.weight / kept }));

  const result: EtfRefresh = {
    symbol: fund.symbol,
    source,
    noTicker: holdings.filter((h) => !h.ticker).length,
    sample: [...holdings.slice(0, 3), ...(issuerError ? [{ issuerError }] : [])],
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
    p_source: source === 'ishares' ? `iShares ${fund.symbol} holdings` : `${fund.symbol} holdings filed with the SEC (N-PORT)`,
    p_rows: rows,
  });
  if (error) throw new Error(`Saving ${fund.symbol} failed: ${error.message}`);
  return { ...result, written: typeof data === 'number' ? data : undefined };
}
