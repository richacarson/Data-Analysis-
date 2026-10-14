import 'server-only';

import { sleeveByKey } from '@/data/sleeves';
import { createClient } from '../supabase/server';

/**
 * Position weights and the sleeves defined only in the database.
 *
 * Weights come from the IC proposals and are confidential, so they live in
 * Supabase (readable by signed-in users) rather than in the code. A sleeve
 * defined here, such as the post-rebalance Dividend and Growth sleeves, is
 * its weighted holdings; the standing sleeves keep their lists in
 * data/sleeves.ts and take their weights from here when present.
 */

export interface WeightSet {
  /** Fraction of the sleeve, by symbol. */
  bySymbol: Map<string, number>;
  asOf: string | null;
  source: string | null;
}

export interface StoredSleeve {
  key: string;
  name: string;
  /** Holdings, largest weight first. */
  tickers: string[];
  /** Set for an ETF sleeve (etf-dvy → DVY): the fund's own ticker. */
  etf?: string;
}

/**
 * Portfolios built from standing sleeves at fixed shares, each sleeve at its
 * own weights (equal where none are loaded). Computed on read, so a change
 * to a sleeve's weights carries through.
 */
export const BLENDS: Array<{ key: string; name: string; parts: Array<{ sleeve: string; share: number }> }> = [
  {
    key: 'blend-div65-gro35',
    name: 'Dividend 65 / Growth 35',
    parts: [
      { sleeve: 'dividend', share: 0.65 },
      { sleeve: 'growth', share: 0.35 },
    ],
  },
];

type WeightRow = { sleeve_key: string; symbol: string; weight: number; as_of: string; source: string | null };

/** Every weight row; PostgREST returns at most 1,000 a request, and IUSG alone is ~470. */
async function allWeightRows(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>): Promise<WeightRow[] | null> {
  const out: WeightRow[] = [];
  for (let page = 0; page < 20; page++) {
    const { data, error } = await supabase
      .from('eq_sleeve_weights')
      .select('sleeve_key, symbol, weight, as_of, source')
      .gt('weight', 0)
      .order('sleeve_key')
      .order('symbol')
      .range(page * 1000, page * 1000 + 999);
    if (error) return null;
    out.push(...((data ?? []) as WeightRow[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export interface WeightBook {
  weights: Map<string, WeightSet>;
  stored: StoredSleeve[];
}

const EMPTY: WeightBook = { weights: new Map(), stored: [] };

export async function getWeightBook(): Promise<WeightBook> {
  const supabase = await createClient();
  if (!supabase) return EMPTY;
  const [rows, s] = await Promise.all([
    allWeightRows(supabase),
    supabase.from('eq_sleeves').select('key, name, sort').order('sort'),
  ]);
  if (!rows) return EMPTY;

  const weights = new Map<string, WeightSet>();
  for (const row of rows) {
    const set = weights.get(row.sleeve_key) ?? { bySymbol: new Map(), asOf: row.as_of, source: row.source };
    set.bySymbol.set(row.symbol.toUpperCase(), row.weight);
    weights.set(row.sleeve_key, set);
  }

  const byWeight = (key: string) =>
    [...(weights.get(key)?.bySymbol.entries() ?? [])].sort((a, b) => b[1] - a[1]).map(([sym]) => sym);

  const stored: StoredSleeve[] = ((s.data ?? []) as Array<{ key: string; name: string }>).map((sl) => ({
    key: sl.key,
    name: sl.name,
    tickers: byWeight(sl.key),
    etf: sl.key.startsWith('etf-') ? sl.key.slice(4).toUpperCase() : undefined,
  }));

  for (const blend of BLENDS) {
    const bySymbol = new Map<string, number>();
    const sources: string[] = [];
    for (const { sleeve, share } of blend.parts) {
      const set = weights.get(sleeve);
      const tickers = set ? [...set.bySymbol.keys()] : (sleeveByKey(sleeve)?.tickers ?? []);
      if (!tickers.length) continue;
      const total = set ? [...set.bySymbol.values()].reduce((t, v) => t + v, 0) : tickers.length;
      for (const t of tickers) {
        const w = set ? set.bySymbol.get(t)! : 1;
        bySymbol.set(t, (bySymbol.get(t) ?? 0) + (share * w) / total);
      }
      sources.push(`${(share * 100).toFixed(0)}% ${sleeveByKey(sleeve)?.name ?? sleeve}${set ? '' : ' (equal weight)'}`);
    }
    if (!bySymbol.size) continue;
    const asOf = blend.parts.map((p) => weights.get(p.sleeve)?.asOf ?? null).find(Boolean) ?? null;
    weights.set(blend.key, { bySymbol, asOf, source: `${sources.join(', ')}, each at its own weights` });
    stored.push({ key: blend.key, name: blend.name, tickers: byWeight(blend.key) });
  }
  return { weights, stored };
}
