'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Sleeve } from '@/data/sleeves';

/** One sleeve's holdings at a time, as a ruled grid of tickers. */
export function HoldingsBrowser({ sleeves }: { sleeves: Sleeve[] }) {
  const [key, setKey] = useState(sleeves[0]?.key);
  const sleeve = sleeves.find((s) => s.key === key) ?? sleeves[0];
  if (!sleeve) return null;

  return (
    <section>
      <div className="flex items-end justify-between gap-4 border-b border-line">
        <div className="-mb-px flex gap-7 overflow-x-auto" role="tablist" aria-label="Sleeves">
          {sleeves.map((s) => {
            const active = s.key === sleeve.key;
            return (
              <button
                key={s.key}
                role="tab"
                aria-selected={active}
                onClick={() => setKey(s.key)}
                className={`shrink-0 border-b-2 pb-3 text-[14px] font-medium transition-colors ${
                  active ? 'border-gold text-t1' : 'border-transparent text-t3 hover:text-t1'
                }`}
              >
                {s.name}
              </button>
            );
          })}
        </div>
        <Link
          href={`/screen?sleeve=${sleeve.key}`}
          className="hidden shrink-0 pb-3 text-[13px] font-medium text-t1 hover:text-goldInk sm:block"
        >
          Screen {sleeve.name} →
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-x-6 sm:grid-cols-5 lg:grid-cols-6" role="tabpanel">
        {sleeve.tickers.map((t) => (
          <Link
            key={t}
            href={`/stock/${t}?sleeve=${sleeve.key}`}
            className="tabular flex min-h-[44px] items-center border-b border-hairline text-[14px] font-medium text-t1 transition-colors hover:text-goldInk"
          >
            {t}
          </Link>
        ))}
      </div>
      <Link href={`/screen?sleeve=${sleeve.key}`} className="mt-4 block text-[13px] font-medium text-t1 sm:hidden">
        Screen {sleeve.name} →
      </Link>
    </section>
  );
}
