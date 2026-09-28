import 'server-only';

import { createClient as createPlainClient } from '@supabase/supabase-js';
import { createClient } from '../supabase/server';
import type { SnapshotRow } from './revisions';

/**
 * Writes go through `eq_record_estimate_snapshots`, a database function that
 * checks CRON_SECRET and can only insert snapshots. The service-role key would
 * also work, but it bypasses row-level security on every table in the project.
 */
function writer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.CRON_SECRET;
  if (!url || !key || !secret) return null;
  return { client: createPlainClient(url, key, { auth: { persistSession: false } }), secret };
}

export const canRecord = () => writer() !== null;

/** Upserts snapshot rows; returns how many were written. */
export async function recordSnapshots(rows: SnapshotRow[]): Promise<number> {
  const w = writer();
  if (!w || !rows.length) return 0;
  const { data, error } = await w.client.rpc('eq_record_estimate_snapshots', { p_secret: w.secret, p_rows: rows });
  if (error) throw new Error(`Recording estimates failed: ${error.message}`);
  return typeof data === 'number' ? data : 0;
}

/** Symbols with a snapshot in the past 90 days (anything someone has opened) or on a watchlist. */
export async function trackedSymbols(): Promise<string[]> {
  const w = writer();
  if (!w) return [];
  const { data, error } = await w.client.rpc('eq_tracked_symbols', { p_secret: w.secret });
  if (error) throw new Error(`Listing tracked symbols failed: ${error.message}`);
  return Array.isArray(data) ? (data as unknown[]).map(String) : [];
}

/** A symbol's snapshots for years still open to revision, over the past ~13 months. */
export async function loadSnapshots(symbol: string): Promise<SnapshotRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const from = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
  const openYears = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);
  const out: SnapshotRow[] = [];
  // PostgREST caps a response at 1,000 rows; six years a day passes that in six months.
  for (let page = 0; page < 10; page++) {
    const { data, error } = await supabase
      .from('eq_estimate_snapshots')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .gte('snapshot_date', from)
      .gte('fiscal_date', openYears)
      .order('snapshot_date', { ascending: true })
      .order('fiscal_date', { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as SnapshotRow[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}
