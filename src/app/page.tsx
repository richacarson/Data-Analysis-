import Link from 'next/link';
import { Watchlist } from '@/components/Watchlist';
import { HoldingsBrowser } from '@/components/HoldingsBrowser';
import { SLEEVES, ALL_SLEEVE_TICKERS } from '@/data/sleeves';

export default function HomePage() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Link
          href="/screen"
          className="panel col-span-2 flex flex-col justify-between px-4 py-4 transition-colors hover:border-lineActive lg:col-span-1"
        >
          <p className="eyebrow">Screen</p>
          <div className="mt-3">
            <p className="font-serif text-[20px] leading-tight text-t1">All sleeves</p>
            <p className="mt-1 text-[12px] text-t4">
              {ALL_SLEEVE_TICKERS.length} holdings by expected 3-year return
            </p>
          </div>
        </Link>

        {SLEEVES.map((s) => (
          <Link
            key={s.key}
            href={`/screen?sleeve=${s.key}`}
            className="panel flex flex-col justify-between px-4 py-4 transition-colors hover:border-lineActive"
          >
            <p className="eyebrow-muted">Sleeve</p>
            <div className="mt-3">
              <p className="font-serif text-[18px] leading-tight text-t1 sm:text-[20px]">{s.name}</p>
              <p className="mt-1 text-[12px] text-t4">{s.tickers.length} holdings</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Watchlist />
        </div>
        <div className="lg:col-span-2">
          <HoldingsBrowser sleeves={SLEEVES} />
        </div>
      </div>
    </div>
  );
}
