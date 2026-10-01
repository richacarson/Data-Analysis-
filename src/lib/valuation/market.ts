import 'server-only';

import { getPriceHistory } from '../fmp/endpoints';
import { marketLink, type MarketLink } from './correlation';

/** The S&P 500, through the ETF that tracks it; FMP's index series is not on every plan. */
export const MARKET_PROXY = 'SPY';

export interface MarketLinks {
  threeYear: MarketLink | null;
  oneYear: MarketLink | null;
}

/**
 * Correlation and beta to the S&P 500 over three years and one. The market's
 * series is the same request for every stock, so it is fetched once and served
 * from cache after that.
 */
export async function marketLinks(symbol: string): Promise<MarketLinks> {
  // Start of the month three years back (plus a margin), so the request is the
  // same all month and the cache serves it.
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear() - 3, now.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const [stock, market] = await Promise.all([getPriceHistory(symbol, from), getPriceHistory(MARKET_PROXY, from)]);
  return { threeYear: marketLink(stock, market, 156), oneYear: marketLink(stock, market, 52) };
}
