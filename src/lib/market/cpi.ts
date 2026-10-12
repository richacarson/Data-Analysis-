import 'server-only';

import { unstable_cache } from 'next/cache';

/**
 * US consumer prices (CPI-U, seasonally adjusted, monthly) from FRED, to put
 * a decade of earnings in today's dollars for CAPE. FMP's CPI series comes
 * back with gaps; FRED's needs no key.
 */
async function fetchCpi(): Promise<Array<[string, number]>> {
  const res = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL&cosd=2010-01-01', {
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`FRED CPI request failed: ${res.status}`);
  const rows = (await res.text())
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => line.split(','))
    .filter(([date, value]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number(value) > 0)
    .map(([date, value]) => [date.slice(0, 7), Number(value)] as [string, number]);
  if (rows.length < 100) throw new Error('FRED CPI came back short');
  return rows;
}

const cachedCpi = unstable_cache(fetchCpi, ['fred-cpi'], { revalidate: 60 * 60 * 24 });

export interface CpiIndex {
  /** CPI for the month, or the latest month before it. */
  at: (isoDate: string) => number | null;
  latest: number;
}

export async function getCpi(): Promise<CpiIndex> {
  const rows = await cachedCpi();
  return {
    latest: rows[rows.length - 1][1],
    at: (iso) => {
      const month = iso.slice(0, 7);
      let found: number | null = null;
      for (const [m, v] of rows) {
        if (m > month) break;
        found = v;
      }
      return found;
    },
  };
}
