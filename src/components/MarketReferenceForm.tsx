'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Where the team types FactSet's 5- and 10-year average forward P/E for the
 * S&P 500, from its weekly Earnings Insight. Stored for everyone signed in.
 */
export function MarketReferenceForm({
  fiveYear,
  tenYear,
  asOf,
}: {
  fiveYear: number | null;
  tenYear: number | null;
  asOf: string | null;
}) {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [open, setOpen] = useState(fiveYear === null && tenYear === null);
  const [five, setFive] = useState(fiveYear?.toString() ?? '');
  const [ten, setTen] = useState(tenYear?.toString() ?? '');
  const [date, setDate] = useState(asOf ?? '');
  const [status, setStatus] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
  }, [supabase]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !userId) return setStatus('Sign in to save.');
    const rows = [
      { key: 'factset_fwd_pe_5y', raw: five },
      { key: 'factset_fwd_pe_10y', raw: ten },
    ]
      .map(({ key, raw }) => ({ key, value: Number(raw) }))
      .filter((r) => Number.isFinite(r.value) && r.value > 0 && r.value < 200)
      .map((r) => ({
        ...r,
        as_of: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
        source: 'FactSet Earnings Insight',
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }));
    if (!rows.length) return setStatus('Enter at least one average, e.g. 19.9.');
    setStatus('Saving…');
    const { error } = await supabase.from('eq_market_reference').upsert(rows);
    if (error) return setStatus(`Could not save: ${error.message}`);
    setStatus('Saved.');
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[12px] font-medium text-goldInk hover:underline">
        Update FactSet averages
      </button>
    );
  }

  const field = 'w-24 border-b border-line bg-transparent px-1 py-1 text-[13px] text-t1 tabular outline-none focus:border-goldInk';
  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-x-5 gap-y-3 text-[12px] text-t3">
      <label className="flex flex-col gap-1">
        5-year average
        <input className={field} inputMode="decimal" value={five} onChange={(e) => setFive(e.target.value)} placeholder="19.9" />
      </label>
      <label className="flex flex-col gap-1">
        10-year average
        <input className={field} inputMode="decimal" value={ten} onChange={(e) => setTen(e.target.value)} placeholder="18.5" />
      </label>
      <label className="flex flex-col gap-1">
        As of
        <input className={`${field} w-36`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <button type="submit" className="border border-line px-3 py-1.5 font-medium text-t1 hover:border-goldInk">
        Save
      </button>
      {status && <span>{status}</span>}
    </form>
  );
}
