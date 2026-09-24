'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Sleeve } from '@/data/sleeves';

/** One sleeve's holdings at a time, rather than every sleeve stacked. */
export function HoldingsBrowser({ sleeves }: { sleeves: Sleeve[] }) {
  const [key, setKey] = useState(sleeves[0]?.key);
  const sleeve = sleeves.find((s) => s.key === key) ?? sleeves[0];
  if (!sleeve) return null;

  return (
    <section className="panel">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 pt-3">
        <div className="-mb-px flex gap-4 overflow-x-auto" role="tablist" aria-label="Sleeves">
          {sleeves.map((s) => {
            const active = s.key === sleeve.key;
            return (
              <button
                key={s.key}
                role="tab"
                aria-selected={active}
                onClick={() => setKey(s.key)}
                className={`shrink-0 border-b-2 pb-2.5 text-[12px] font-semibold transition-colors ${
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
          className="hidden shrink-0 pb-2.5 text-[12px] font-medium text-gold hover:underline sm:block"
        >
          Screen {sleeve.name} →
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-1.5 p-3 sm:grid-cols-8 sm:p-4 lg:grid-cols-10" role="tabpanel">
        {sleeve.tickers.map((t) => (
          <Link
            key={t}
            href={`/stock/${t}`}
            className="tabular border border-line bg-card py-2 text-center text-[12px] font-medium text-t2 transition-colors hover:border-lineActive hover:text-gold sm:py-1.5 sm:text-[11px]"
          >
            {t}
          </Link>
        ))}
      </div>
      <div className="border-t border-line px-4 py-2.5 sm:hidden">
        <Link href={`/screen?sleeve=${sleeve.key}`} className="text-[12px] font-medium text-gold">
          Screen {sleeve.name} →
        </Link>
      </div>
    </section>
  );
}
