'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export function SetPassword() {
  const [supabase] = useState(() => createClient());
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 10) {
      setError('Use at least 10 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Those two passwords do not match.');
      return;
    }
    if (!supabase) {
      setError('Authentication is not configured for this deployment.');
      return;
    }

    setState('saving');
    // updateUser acts on the signed-in session, so this only ever sets the
    // password of the person already holding it.
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setState('idle');
      return;
    }
    setState('done');
  }

  if (state === 'done') {
    return (
      <div className="mt-5 space-y-3">
        <div className="border border-up/40 bg-up/10 px-3 py-3 text-[13px]">
          Password set. You can now sign in with your email and password, on any device, with no
          email round trip.
        </div>
        <Link href="/" className="inline-block text-[13px] text-gold hover:underline">
          Back to Equity Lens
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-3">
      <input
        type="password"
        required
        autoFocus
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password"
        aria-label="New password"
        className="w-full border border-line bg-card px-3 py-2 text-[13px] outline-none placeholder:text-t3 focus:border-lineActive"
      />
      <input
        type="password"
        required
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Confirm password"
        aria-label="Confirm password"
        className="w-full border border-line bg-card px-3 py-2 text-[13px] outline-none placeholder:text-t3 focus:border-lineActive"
      />
      <button
        type="submit"
        disabled={state === 'saving'}
        className="w-full bg-gold px-3 py-2 text-[13px] font-semibold text-bg disabled:opacity-60"
      >
        {state === 'saving' ? 'Saving…' : 'Set password'}
      </button>
      {error && <p className="text-[12px] text-dn">{error}</p>}
    </form>
  );
}
