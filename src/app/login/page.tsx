import { LoginForm } from '@/components/LoginForm';
import { ShieldMark } from '@/components/Logo';

export const metadata = { title: 'Sign in — Equity Lens' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center py-8 sm:py-20">
      <ShieldMark className="mx-auto mb-6 h-16 w-auto" />
      <div className="panel px-5 py-6 sm:px-6 sm:py-7">
        <h1 className="font-serif text-[22px] tracking-tight text-t1">Sign in</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-t3">
          Equity Lens is private. Sign in with your password, or have a one-time code emailed
          to you.
        </p>
        <LoginForm next={next} />
      </div>
      <p className="mt-4 px-1 text-[11px] leading-relaxed text-t3">
        Access is limited to approved addresses. Emailed links are unreliable behind corporate
        mail scanning, which opens them automatically and spends them before you click, so a
        password is the dependable option.
      </p>
    </div>
  );
}
