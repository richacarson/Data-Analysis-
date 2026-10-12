import 'server-only';

import { writer } from '../estimates/store';
import { createClient } from '../supabase/server';
import type { MarketSnapshot } from './sp500';

/** Saves the day's snapshot through the secret-checked database function. */
export async function recordMarketSnapshot(snapshot: MarketSnapshot): Promise<void> {
  const w = writer();
  if (!w) throw new Error('Supabase is not configured');
  const { error } = await w.client.rpc('eq_record_market_snapshot', {
    p_secret: w.secret,
    p_index: snapshot.index,
    p_date: snapshot.asOf,
    p_payload: snapshot,
  });
  if (error) throw new Error(`Recording the market snapshot failed: ${error.message}`);
}

/** Snapshots over the past ~13 months, oldest first. Empty when none are recorded yet. */
export async function loadMarketSnapshots(index: MarketSnapshot['index'] = 'sp500'): Promise<MarketSnapshot[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const from = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('eq_market_snapshots')
    .select('payload')
    .eq('index_key', index)
    .gte('snapshot_date', from)
    .order('snapshot_date', { ascending: true });
  if (error || !data) return [];
  return data.map((r) => r.payload as MarketSnapshot);
}

/** The latest snapshot alone, for pages that only compare against today's figures. */
export async function latestMarketSnapshot(index: MarketSnapshot['index'] = 'sp500'): Promise<MarketSnapshot | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('eq_market_snapshots')
    .select('payload')
    .eq('index_key', index)
    .order('snapshot_date', { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;
  return data[0].payload as MarketSnapshot;
}

export interface MarketReference {
  value: number;
  asOf: string | null;
}

/** Figures typed in by the team (FactSet's average forward P/Es), by key. */
export async function loadMarketReference(): Promise<Map<string, MarketReference>> {
  const supabase = await createClient();
  if (!supabase) return new Map();
  const { data, error } = await supabase.from('eq_market_reference').select('key, value, as_of');
  if (error || !data) return new Map();
  return new Map(
    (data as Array<{ key: string; value: number; as_of: string | null }>).map((r) => [r.key, { value: r.value, asOf: r.as_of }]),
  );
}
