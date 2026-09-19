import Link from 'next/link';

const REASONS: Record<string, string> = {
  'missing-code': 'That sign-in link was incomplete. Links can only be used once.',
  'not-configured': 'Authentication is not configured for this deployment.',
  'exchange-failed': 'That sign-in link has expired or was already used.',
};

export const metadata = { title: 'Sign-in problem — Equity Lens' };

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  return (
    <div className="mx-auto max-w-md py-20">
      <div className="panel px-6 py-7">
        <h1 className="font-serif text-[20px] text-t1">Could not sign you in</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-t3">
          {(reason && REASONS[reason]) ?? 'Something went wrong during sign-in.'}
        </p>
        <Link
          href="/login"
          className="mt-5 inline-block bg-gold px-3 py-2 text-[13px] font-semibold text-bg"
        >
          Request a new link
        </Link>
      </div>
    </div>
  );
}
