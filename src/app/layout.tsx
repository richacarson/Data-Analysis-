import type { Metadata } from 'next';
import Link from 'next/link';
import { DM_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { SearchBar } from '@/components/SearchBar';
import { UserMenu } from '@/components/UserMenu';

// The same pairing the Paradiem Dashboard uses.
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Equity Lens — Paradiem',
  description:
    'Discounted cash flow, reverse DCF, growth-adjusted multiples and quality scoring.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${plexMono.variable}`}>
      <body>
        <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] items-center gap-5 px-5 py-3">
            <Link href="/" className="flex shrink-0 items-baseline gap-2.5">
              <span className="font-serif text-[19px] leading-none tracking-tight text-t1">
                Equity Lens
              </span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-eyebrow text-gold sm:inline">
                Paradiem
              </span>
            </Link>
            <SearchBar />
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-5 py-6">{children}</main>

        <footer className="mx-auto max-w-[1400px] border-t border-line px-5 py-6">
          <p className="eyebrow-muted">Paradiem · Wealth beyond today</p>
          <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-t3">
            Data from Financial Modeling Prep. Valuation models are estimates built on
            assumptions shown alongside each figure — they are research tools, not investment
            advice.
          </p>
        </footer>
      </body>
    </html>
  );
}
