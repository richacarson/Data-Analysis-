/**
 * The sector multiple, from the company's own peers.
 *
 * FMP's industry P/E now covers NASDAQ listings only, and even there it is an
 * average over whatever small caps share the label: Aerospace & Defense at
 * 7.5x, Banks at 2.1x. For a NYSE utility like Atmos Energy there was no
 * current figure at all, only a year-old NASDAQ one at 8.0x. The peers FMP
 * lists for each company (similar size, same business) are a far better
 * sample, so their median trailing P/E stands in for the sector.
 */

/** How many listed peers to price; FMP returns about ten, closest first. */
export const MAX_PEERS = 8;
/** Fewer usable peers than this is not a sector rating. */
export const MIN_PEERS = 3;
/** Above this a peer's P/E reflects near-zero earnings, not a rating (as for the company's own history). */
export const MAX_PEER_PE = 100;

export interface PeerPe {
  symbol: string;
  pe: number | null;
}

export interface PeerMedian {
  value: number;
  /** The peers that counted, with their P/Es. */
  used: Array<{ symbol: string; pe: number }>;
  /** Listed peers left out: no earnings, or a P/E past the cap. */
  dropped: string[];
}

export function peerMedian(peers: PeerPe[]): PeerMedian | null {
  const used = peers
    .filter((p): p is { symbol: string; pe: number } => typeof p.pe === 'number' && p.pe > 0 && p.pe <= MAX_PEER_PE)
    .sort((a, b) => a.pe - b.pe);
  if (used.length < MIN_PEERS) return null;
  const mid = Math.floor(used.length / 2);
  const value = used.length % 2 ? used[mid].pe : (used[mid - 1].pe + used[mid].pe) / 2;
  const kept = new Set(used.map((p) => p.symbol));
  return { value, used, dropped: peers.filter((p) => !kept.has(p.symbol)).map((p) => p.symbol) };
}
