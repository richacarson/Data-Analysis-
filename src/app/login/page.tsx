import { LoginForm } from '@/components/LoginForm';

export const metadata = { title: 'Sign in — Equity Lens' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center py-20">
      <div className="panel px-6 py-7">
        <h1 className="text-[20px] font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          Equity Lens is private. Enter your email and we&apos;ll send a six-digit code — no
          password to remember.
        </p>
        <LoginForm next={next} />
      </div>
      <p className="mt-4 px-1 text-[11px] leading-relaxed text-muted">
        Access is limited to approved addresses. The email also contains a link, but if your
        mail provider scans links it may consume it before you click — type the code instead.
      </p>
    </div>
  );
}
