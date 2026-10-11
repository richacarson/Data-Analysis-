import 'server-only';

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
}

export interface WeightBook {
  weights: Map<string, WeightSet>;
  stored: StoredSleeve[];
}

const EMPTY: WeightBook = { weights: new Map(), stored: [] };

export async function getWeightBook(): Promise<WeightBook> {
  const supabase = await createClient();
  if (!supabase) return EMPTY;
  const [w, s] = await Promise.all([
    supabase.from('eq_sleeve_weights').select('sleeve_key, symbol, weight, as_of, source'),
    supabase.from('eq_sleeves').select('key, name, sort').order('sort'),
  ]);
  if (w.error || !w.data) return EMPTY;

  const weights = new Map<string, WeightSet>();
  for (const row of w.data as Array<{ sleeve_key: string; symbol: string; weight: number; as_of: string; source: string | null }>) {
    const set = weights.get(row.sleeve_key) ?? { bySymbol: new Map(), asOf: row.as_of, source: row.source };
    set.bySymbol.set(row.symbol.toUpperCase(), row.weight);
    weights.set(row.sleeve_key, set);
  }

  const stored = ((s.data ?? []) as Array<{ key: string; name: string }>).map((sl) => ({
    key: sl.key,
    name: sl.name,
    tickers: [...(weights.get(sl.key)?.bySymbol.entries() ?? [])].sort((a, b) => b[1] - a[1]).map(([sym]) => sym),
  }));
  return { weights, stored };
}
