import 'server-only';

import { getPeers, getRatiosTTM } from '../fmp/endpoints';
import { MAX_PEERS, type PeerPe } from './peer-pe';

/**
 * Trailing P/Es for the first peers FMP lists. Each is the same cached
 * ratios-ttm request the peer's own stock page makes, so the stock page and the
 * screen price the same peers identically and share the cache.
 */
export async function peerPes(
  symbol: string,
  ratios: (peer: string) => Promise<{ priceToEarningsRatioTTM?: number } | null> = getRatiosTTM,
): Promise<PeerPe[]> {
  const listed = await getPeers(symbol).catch(() => []);
  const peers = listed
    .map((p) => p.symbol)
    .filter((s) => s && s.toUpperCase() !== symbol.toUpperCase())
    .slice(0, MAX_PEERS);
  return Promise.all(
    peers.map(async (peer) => {
      const r = await ratios(peer).catch(() => null);
      const pe = r?.priceToEarningsRatioTTM;
      return { symbol: peer, pe: typeof pe === 'number' && Number.isFinite(pe) ? pe : null };
    }),
  );
}
