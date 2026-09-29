import 'server-only';

import { createClient } from './supabase/server';

/**
 * The signed-in user's watchlist, newest first. Row-level security limits the
 * query to the user's own rows; signed out (or without Supabase) it is empty,
 * since a browser-only list is not visible to the server.
 */
export async function getWatchlistSymbols(): Promise<string[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('eq_watchlist_items')
    .select('symbol')
    .order('added_at', { ascending: false });
  if (error || !data) return [];
  return [...new Set((data as Array<{ symbol: string }>).map((r) => r.symbol.toUpperCase()))];
}
