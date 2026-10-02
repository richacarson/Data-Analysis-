import 'server-only';

import { getPriceHistory } from '../fmp/endpoints';
import { marketLink, portfolioLink, type MarketLink } from './correlation';

/** The S&P 500, through the ETF that tracks it; FMP's index series is not on every plan. */
export const MARKET_PROXY = 'SPY';

export interface MarketLinks {
  threeYear: MarketLink | null;
  oneYear: MarketLink | null;
}

// Start of the month three years back (plus a margin), so the request is the
// same all month and the cache serves it.
function historyStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - 3, now.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
}

/** A sleeve as one equal-weighted portfolio, over three years, from the same cached prices. */
export async function sleeveMarketLink(symbols: string[]) {
  const from = historyStart();
  const [market, ...stocks] = await Promise.all([
    getPriceHistory(MARKET_PROXY, from),
    ...symbols.map((s) => getPriceHistory(s, from).catch(() => [])),
  ]);
  return portfolioLink(stocks, market, 156);
}

/**
 * Correlation and beta to the S&P 500 over three years and one. The market's
 * series is the same request for every stock, so it is fetched once and served
 * from cache after that.
 */
export async function marketLinks(symbol: string): Promise<MarketLinks> {
  const from = historyStart();
  const [stock, market] = await Promise.all([getPriceHistory(symbol, from), getPriceHistory(MARKET_PROXY, from)]);
  return { threeYear: marketLink(stock, market, 156), oneYear: marketLink(stock, market, 52) };
}
