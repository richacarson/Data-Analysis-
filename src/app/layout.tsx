import type { Metadata, Viewport } from 'next';
import { DM_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { AppHeader, MobileTabBar } from '@/components/AppChrome';
import { VersionWatcher } from '@/components/VersionWatcher';
import { themeInitScript } from '@/components/ThemeToggle';

// 300 added for the 4a light-weight hero figures.
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
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
      { url: '/favicon.svg?v=3', type: 'image/svg+xml' },
      { url: '/icons/favicon-32.png?v=3', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png?v=3', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Equity Lens',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  other: { 'apple-mobile-web-app-capable': 'yes' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#FAF7F2',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${dmSans.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AppHeader />

        <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-4 sm:px-14 sm:pt-5 md:pb-12">{children}</main>

        <MobileTabBar />
        <VersionWatcher />
      </body>
    </html>
  );
}
