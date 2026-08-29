import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { SearchBar } from '@/components/SearchBar';
import { UserMenu } from '@/components/UserMenu';

export const metadata: Metadata = {
  title: 'Equity Lens — deep fundamental analysis',
  description:
    'Discounted cash flow, reverse DCF, growth-adjusted multiples and quality scoring, powered by Financial Modeling Prep.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-5 py-3">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <span className="grid h-7 w-7 place-items-center rounded bg-accent text-[13px] font-bold text-white">
                EL
              </span>
              <span className="text-[15px] font-semibold tracking-tight">Equity Lens</span>
            </Link>
            <SearchBar />
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-5 py-6">{children}</main>
        <footer className="mx-auto max-w-[1400px] px-5 py-8 text-[11px] leading-relaxed text-muted">
          Data from Financial Modeling Prep. Valuation models are estimates built on
          assumptions shown alongside each figure — they are research tools, not investment
          advice.
        </footer>
      </body>
    </html>
  );
}
