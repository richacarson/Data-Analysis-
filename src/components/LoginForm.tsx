'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function LoginForm({ next }: { next?: string }) {
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setState('error');
      setMessage('Authentication is not configured for this deployment.');
      return;
    }

    setState('sending');
    // Carry the originally requested page through the email round trip.
    const callback = new URL('/auth/callback', window.location.origin);
    if (next) callback.searchParams.set('next', next);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback.toString() },
    });

    if (error) {
      setState('error');
      setMessage(error.message);
      return;
    }
    setState('sent');
    setMessage(`Check ${email} for your sign-in link.`);
  }

  if (state === 'sent') {
    return (
      <div className="mt-5 rounded-md border border-pos/40 bg-pos/10 px-3 py-3 text-[13px]">
        {message}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-3">
      <input
        type="email"
        required
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        aria-label="Email address"
        className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-[13px] outline-none placeholder:text-muted focus:border-accent"
      />
      <button
        type="submit"
        disabled={state === 'sending'}
        className="w-full rounded-md bg-accent px-3 py-2 text-[13px] font-medium text-white disabled:opacity-60"
      >
        {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      {state === 'error' && <p className="text-[12px] text-neg">{message}</p>}
    </form>
  );
}
