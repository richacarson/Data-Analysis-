'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Stage = 'password' | 'signing-in' | 'email' | 'sending' | 'code' | 'verifying';

/**
 * Email sign-in with a typed code rather than a clicked link.
 *
 * Corporate mail security (Microsoft Safe Links and similar) fetches every URL
 * in an incoming message to scan it. Magic links are single-use, so that scan
 * consumes the link and the recipient's own click then fails as "already used".
 * A six-digit code cannot be spent by something fetching a URL, so it is the
 * only reliable option behind a scanner. The emailed link still works where it
 * is not being scanned.
 */
export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [stage, setStage] = useState<Stage>('password');
  const [error, setError] = useState('');

  const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError('Authentication is not configured for this deployment.');
      return;
    }
    setError('');
    setStage('signing-in');

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setStage('password');
      return;
    }
    router.replace(destination);
    router.refresh();
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError('Authentication is not configured for this deployment.');
      return;
    }
    setError('');
    setStage('sending');

    const callback = new URL('/auth/confirm', window.location.origin);
    if (next) callback.searchParams.set('next', next);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback.toString() },
    });

    if (error) {
      setError(error.message);
      setStage('email');
      return;
    }
    setStage('code');
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError('');
    setStage('verifying');

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    });

    if (error) {
      setError(error.message);
      setStage('code');
      return;
    }

    router.replace(destination);
    router.refresh();
  }

  if (stage === 'password' || stage === 'signing-in') {
    return (
      <form onSubmit={signInWithPassword} className="mt-5 space-y-3">
        <input
          type="email"
          required
          autoFocus
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className="w-full border border-line bg-card px-3 py-2 text-[13px] outline-none placeholder:text-t3 focus:border-lineActive"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          aria-label="Password"
          className="w-full border border-line bg-card px-3 py-2 text-[13px] outline-none placeholder:text-t3 focus:border-lineActive"
        />
        <button
          type="submit"
          disabled={stage === 'signing-in'}
          className="w-full bg-gold px-3 py-2 text-[13px] font-semibold text-bg disabled:opacity-60"
        >
          {stage === 'signing-in' ? 'Signing in…' : 'Sign in'}
        </button>
        {error && <p className="text-[12px] text-dn">{error}</p>}
        <button
          type="button"
          onClick={() => {
            setError('');
            setStage('email');
          }}
          className="w-full text-[12px] text-t3 hover:text-t1"
        >
          No password yet? Email me a code instead
        </button>
      </form>
    );
  }

  if (stage === 'code' || stage === 'verifying') {
    return (
      <form onSubmit={verifyCode} className="mt-5 space-y-3">
        <p className="text-[13px] leading-relaxed text-t3">
          We sent a six-digit code to <span className="text-t1">{email}</span>. Enter it below.
        </p>
        <input
          required
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          aria-label="Six-digit sign-in code"
          className="tabular w-full border border-line bg-card px-3 py-2 text-center text-[18px] tracking-[0.3em] outline-none placeholder:tracking-normal placeholder:text-t3 focus:border-lineActive"
        />
        <button
          type="submit"
          disabled={stage === 'verifying'}
          className="w-full bg-gold px-3 py-2 text-[13px] font-semibold text-bg disabled:opacity-60"
        >
          {stage === 'verifying' ? 'Signing in…' : 'Sign in'}
        </button>
        {error && <p className="text-[12px] text-dn">{error}</p>}
        <button
          type="button"
          onClick={() => {
            setCode('');
            setError('');
            setStage('password');
          }}
          className="w-full text-[12px] text-t3 hover:text-t1"
        >
          Back to password sign-in
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="mt-5 space-y-3">
      <input
        type="email"
        required
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        aria-label="Email address"
        className="w-full border border-line bg-card px-3 py-2 text-[13px] outline-none placeholder:text-t3 focus:border-lineActive"
      />
      <button
        type="submit"
        disabled={stage === 'sending'}
        className="w-full bg-gold px-3 py-2 text-[13px] font-semibold text-bg disabled:opacity-60"
      >
        {stage === 'sending' ? 'Sending…' : 'Email me a code'}
      </button>
      {error && <p className="text-[12px] text-dn">{error}</p>}
    </form>
  );
}
