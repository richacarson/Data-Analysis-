'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_CHART_IDS, chartById } from '@/lib/charts/catalog';

const LOCAL_KEY = 'equity-lens:charts';

function readLocal(): string[] | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}

function writeLocal(ids: string[]) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(ids));
  } catch {
    // Private mode or full storage: the in-memory choice still applies.
  }
}

/** Drops ids for charts that no longer exist, so a renamed chart cannot wedge the grid. */
function known(ids: string[]) {
  return ids.filter((id) => chartById.has(id));
}

/**
 * The chart selection, synced to the signed-in account so it follows the user
 * between the phone app and the desktop, with this browser's copy as a fast
 * first paint and a fallback when offline.
 */
export function useChartPrefs() {
  const [supabase] = useState(() => createClient());
  const [ids, setIds] = useState<string[]>(DEFAULT_CHART_IDS);
  const userId = useRef<string | null>(null);

  useEffect(() => {
    const local = readLocal();
    if (local) setIds(known(local));
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || cancelled) return;
      userId.current = auth.user.id;
      const { data } = await supabase
        .from('eq_user_preferences')
        .select('chart_ids')
        .eq('user_id', auth.user.id)
        .maybeSingle();
      const remote = (data as { chart_ids: string[] | null } | null)?.chart_ids;
      if (!cancelled && Array.isArray(remote)) {
        setIds(known(remote));
        writeLocal(remote);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback(
    async (next: string[]) => {
      if (!supabase) return;
      // The first load may still be resolving the user; don't drop the save.
      if (!userId.current) {
        const { data } = await supabase.auth.getUser();
        userId.current = data.user?.id ?? null;
      }
      if (!userId.current) return;
      // Supabase queries are lazy: nothing is sent until the builder is awaited.
      const { error } = await supabase
        .from('eq_user_preferences')
        .upsert({ user_id: userId.current, chart_ids: next, updated_at: new Date().toISOString() });
      if (error) console.warn('Chart selection not synced:', error.message);
    },
    [supabase],
  );

  const save = useCallback(
    (next: string[]) => {
      setIds(next);
      writeLocal(next);
      // Ticking through the list sends one write when the user pauses, so
      // writes cannot land out of order and leave an older selection saved.
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(() => void push(next), 600);
    },
    [push],
  );

  return { ids, save };
}
