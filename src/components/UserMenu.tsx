'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function UserMenu({ variant = 'inline' }: { variant?: 'inline' | 'panel' }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setEmail(session?.user?.email ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  if (!email) return null;

  async function signOut() {
    await supabase?.auth.signOut();
    // Refresh so the middleware re-evaluates and redirects to /login.
    router.replace('/login');
    router.refresh();
  }

  if (variant === 'panel') {
    return (
      <div className="panel flex items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <div className="min-w-0">
          <p className="eyebrow-muted">Signed in</p>
          <p className="mt-1 truncate text-[13px] text-t1">{email}</p>
        </div>
        <button onClick={signOut} className="btn shrink-0 py-2">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-3">
      <Link
        href="/account"
        className="hidden text-[12px] text-t3 hover:text-t1 sm:inline"
        title="Account settings"
      >
        {email}
      </Link>
      <button
        onClick={signOut}
        className="border border-line bg-card px-2.5 py-1.5 text-[12px] font-medium hover:border-lineActive hover:text-gold"
      >
        Sign out
      </button>
    </div>
  );
}
