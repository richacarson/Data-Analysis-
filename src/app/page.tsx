import Link from 'next/link';
import { Watchlist } from '@/components/Watchlist';
import { SLEEVES, ALL_SLEEVE_TICKERS } from '@/data/sleeves';
import { Panel } from '@/components/ui';

export default function HomePage() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/screen"
          className="panel px-5 py-5 transition-colors hover:border-lineActive"
        >
          <p className="eyebrow">Screen</p>
          <p className="mt-2 font-serif text-[20px] leading-tight text-t1">All sleeves</p>
          <p className="mt-1.5 text-[12px] text-t4">
            {ALL_SLEEVE_TICKERS.length} holdings ranked by expected 3-year return
          </p>
        </Link>

        {SLEEVES.map((s) => (
          <Link
            key={s.key}
            href={`/screen?sleeve=${s.key}`}
            className="panel px-5 py-5 transition-colors hover:border-lineActive"
          >
            <p className="eyebrow-muted">Sleeve</p>
            <p className="mt-2 font-serif text-[20px] leading-tight text-t1">{s.name}</p>
            <p className="mt-1.5 text-[12px] text-t4">{s.tickers.length} holdings</p>
          </Link>
        ))}
      </div>

      <Watchlist />

      {SLEEVES.map((s) => (
        <Panel key={s.key} eyebrow="Holdings" title={s.name} subtitle={`${s.tickers.length} positions`}>
          <div className="flex flex-wrap gap-1.5 px-4 py-3">
            {s.tickers.map((t) => (
              <Link
                key={t}
                href={`/stock/${t}`}
                className="tabular border border-line bg-card px-2 py-1 text-[11px] text-t2 transition-colors hover:border-lineActive hover:text-gold"
              >
                {t}
              </Link>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}
