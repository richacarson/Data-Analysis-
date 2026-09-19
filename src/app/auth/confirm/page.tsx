import { Suspense } from 'react';
import { ConfirmSignIn } from '@/components/ConfirmSignIn';

export const metadata = { title: 'Signing you in — Equity Lens' };

// Tokens can arrive in the URL fragment, which only the browser can read, so
// this page has to render on the client.
export const dynamic = 'force-dynamic';

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={<p className="px-1 py-20 text-center text-[13px] text-muted">Signing you in…</p>}
    >
      <ConfirmSignIn />
    </Suspense>
  );
}
