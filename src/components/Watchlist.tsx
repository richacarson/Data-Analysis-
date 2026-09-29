'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { WatchlistItemRow } from '@/lib/supabase/types';

/**
 * Watchlist backed by Supabase when a user is signed in.
 *
 * Signed out, it falls back to localStorage so the feature is usable
 * immediately and nothing is lost if the database is not configured yet.
 */
const LOCAL_KEY = 'equity-lens:watchlist';

function readLocal(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(symbols: string[]) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(symbols));
  } catch {
    // Private browsing or a full quota — the in-memory list still works.
  }
}

export function Watchlist() {
  const [supabase] = useState(() => createClient());
  const [session, setSession] = useState<Session | null>(null);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setSymbols(readLocal());
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const loadRemote = useCallback(async () => {
    if (!supabase || !session) return;
    const { data, error } = await supabase
      .from('eq_watchlist_items')
      .select('symbol')
      .order('added_at', { ascending: false });
    if (!error && data) setSymbols((data as Pick<WatchlistItemRow, 'symbol'>[]).map((r) => r.symbol));
    setLoading(false);
  }, [supabase, session]);

  useEffect(() => {
    if (!supabase) return;
    if (session) {
      void loadRemote();
    } else {
      setSymbols(readLocal());
      setLoading(false);
    }
  }, [supabase, session, loadRemote]);

  /** Ensures the signed-in user has a watchlist to attach items to. */
  async function ensureWatchlistId(): Promise<string | null> {
    if (!supabase || !session) return null;
    const { data: existing } = await supabase
      .from('eq_watchlists')
      .select('id')
      .limit(1)
      .maybeSingle();
    if (existing?.id) return existing.id as string;

    const { data: created, error } = await supabase
      .from('eq_watchlists')
      .insert({ user_id: session.user.id, name: 'My watchlist' })
      .select('id')
      .single();
    if (error) return null;
    return created.id as string;
  }

  async function add(raw: string) {
    const symbol = raw.trim().toUpperCase();
    if (!symbol || symbols.includes(symbol)) return;

    const next = [symbol, ...symbols];
    setSymbols(next);
    setInput('');

    if (supabase && session) {
      const watchlistId = await ensureWatchlistId();
      if (!watchlistId) {
        setStatus('Could not save — check your database connection.');
        return;
      }
      const { error } = await supabase
        .from('eq_watchlist_items')
        .insert({ watchlist_id: watchlistId, user_id: session.user.id, symbol });
      if (error) {
        // Roll the optimistic update back so the UI never claims a save that failed.
        setSymbols(symbols);
        setStatus(error.message);
      }
    } else {
      writeLocal(next);
    }
  }

  async function remove(symbol: string) {
    const next = symbols.filter((s) => s !== symbol);
    setSymbols(next);
    if (supabase && session) {
      await supabase.from('eq_watchlist_items').delete().eq('symbol', symbol);
    } else {
      writeLocal(next);
    }
  }

  const subtitle = session ? 'Synced to your account' : 'Stored in this browser';

  return (
    <section>
      <div className="flex items-end justify-between gap-4 border-b border-line pb-3">
        <h2 className="text-[14px] font-medium text-t1">Watchlist</h2>
        <span className="text-[12px] text-t3">{subtitle}</span>
      </div>
      <div className="flex items-end gap-4 border-b border-hairline py-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add(input)}
          placeholder="Add ticker…"
          aria-label="Add a ticker to your watchlist"
          className="min-w-0 flex-1 border-0 border-b border-rule/60 bg-transparent px-0 py-1.5 text-[16px] uppercase text-t1 outline-none placeholder:normal-case placeholder:text-t3 focus:border-rule sm:text-[14px]"
        />
        <button onClick={() => add(input)} className="pb-1.5 text-[14px] font-medium text-t1 hover:text-goldInk">
          Add
        </button>
      </div>

      {loading ? (
        <p className="py-4 text-[13px] text-t3">Loading…</p>
      ) : symbols.length === 0 ? (
        <p className="py-4 text-[14px] leading-relaxed text-t3">No tickers yet. Add one above to track it here.</p>
      ) : (
        <ul>
          {symbols.map((symbol) => (
            <li key={symbol} className="flex min-h-[44px] items-center justify-between border-b border-hairline">
              <Link href={`/stock/${symbol}`} className="tabular text-[14px] font-medium text-t1 hover:text-goldInk">
                {symbol}
              </Link>
              <button
                onClick={() => remove(symbol)}
                aria-label={`Remove ${symbol}`}
                className="flex h-11 w-11 items-center justify-center text-[16px] leading-none text-t3 hover:text-dn"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {status && <p className="pt-3 text-[12px] text-t3">{status}</p>}
    </section>
  );
}
