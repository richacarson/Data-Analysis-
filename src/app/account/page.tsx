import { SetPassword } from '@/components/SetPassword';
import { UserMenu } from '@/components/UserMenu';

export const metadata = { title: 'Account — Equity Lens' };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-4 sm:py-12">
      <UserMenu variant="panel" />
      <div className="panel px-4 py-6 sm:px-6 sm:py-7">
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
