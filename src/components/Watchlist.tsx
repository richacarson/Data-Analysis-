'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { WatchlistItemRow } from '@/lib/supabase/types';
import { Panel } from './ui';

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
  const [email, setEmail] = useState('');
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

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
    setStatus(error ? error.message : 'Check your email for a sign-in link.');
  }

  const subtitle = !supabase
    ? 'Stored in this browser'
    : session
      ? session.user.email
      : 'Stored in this browser — sign in to sync';

  return (
    <Panel title="Watchlist" subtitle={subtitle}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add(input)}
          placeholder="Add ticker…"
          aria-label="Add a ticker to your watchlist"
          className="w-40 rounded-md border border-line bg-panel2 px-2.5 py-1.5 text-[13px] outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          onClick={() => add(input)}
          className="rounded-md border border-line bg-panel2 px-3 py-1.5 text-[13px] font-medium hover:border-accent hover:text-accent"
        >
          Add
        </button>
      </div>

      {loading ? (
        <p className="px-4 py-4 text-[13px] text-muted">Loading…</p>
      ) : symbols.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-muted">
          No tickers yet. Add one above to track it here.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2 px-4 py-3">
          {symbols.map((symbol) => (
            <li key={symbol} className="flex items-center gap-1.5 rounded-md border border-line bg-panel2 pl-3 pr-1.5 py-1">
              <Link href={`/stock/${symbol}`} className="text-[13px] font-medium hover:text-accent">
                {symbol}
              </Link>
              <button
                onClick={() => remove(symbol)}
                aria-label={`Remove ${symbol}`}
                className="rounded px-1 text-[13px] leading-none text-muted hover:text-neg"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {supabase && !session && (
        <form onSubmit={signIn} className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email address for sign-in link"
            className="w-56 rounded-md border border-line bg-panel2 px-2.5 py-1.5 text-[13px] outline-none placeholder:text-muted focus:border-accent"
          />
          <button className="rounded-md border border-line bg-panel2 px-3 py-1.5 text-[13px] font-medium hover:border-accent hover:text-accent">
            Email me a sign-in link
          </button>
        </form>
      )}

      {supabase && session && (
        <div className="border-t border-line px-4 py-3">
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-[12px] text-muted hover:text-ink"
          >
            Sign out
          </button>
        </div>
      )}

      {status && <p className="px-4 pb-3 text-[12px] text-muted">{status}</p>}
    </Panel>
  );
}
