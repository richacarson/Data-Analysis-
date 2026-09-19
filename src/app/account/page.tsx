import { SetPassword } from '@/components/SetPassword';

export const metadata = { title: 'Account — Equity Lens' };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-md py-12">
      <div className="panel px-6 py-7">
        <h1 className="font-serif text-[22px] tracking-tight text-t1">Set a password</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-t3">
          Emailed sign-in links are fragile behind corporate mail scanning, which opens links
          automatically and spends them before you click. A password avoids email entirely.
        </p>
        <SetPassword />
      </div>
    </div>
  );
}
