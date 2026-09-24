import type { MetadataRoute } from 'next';

/** Lets the app be added to a phone's home screen and open without browser chrome. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Equity Lens — Paradiem',
    short_name: 'Equity Lens',
    description: 'Paradiem equity research: expected returns, valuation models and sleeve screens.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#171738',
    theme_color: '#171738',
    icons: [
      { src: '/icons/icon-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png?v=2',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
