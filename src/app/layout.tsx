import type { Metadata, Viewport } from 'next';
import { DM_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { AppHeader, MobileTabBar } from '@/components/AppChrome';

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
    'Paradiem equity research: expected returns, valuation models and sleeve screens.',
  applicationName: 'Equity Lens',
  icons: {
    icon: [
      { url: '/favicon.svg?v=2', type: 'image/svg+xml' },
      { url: '/icons/favicon-32.png?v=2', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png?v=2', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Equity Lens',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#171738',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${plexMono.variable}`}>
      <body>
        <AppHeader />

        <main className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 sm:py-6">{children}</main>

        <footer className="mx-auto flex max-w-[1400px] justify-center border-t border-line px-3 pb-24 pt-8 sm:px-5 md:justify-start md:pb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/paradiem-logo-white.png"
            alt="Paradiem"
            width={824}
            height={226}
            className="h-auto w-[132px]"
          />
        </footer>

        <MobileTabBar />
      </body>
    </html>
  );
}
