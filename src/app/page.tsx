import Link from 'next/link';
import { Watchlist } from '@/components/Watchlist';
import { HoldingsBrowser } from '@/components/HoldingsBrowser';
import { SLEEVES, ALL_SLEEVE_TICKERS } from '@/data/sleeves';
import { getWatchlistSymbols } from '@/lib/watchlist';

/**
 * 4a Hairline home: a page title, then one rule-topped figure per sleeve
 * (the screen of everything leads, under the gold rule), then holdings and
 * the watchlist as plain ruled lists — no boxed panels.
 */
export default async function HomePage() {
  const watchlist = await getWatchlistSymbols();
  return (
    <div className="space-y-12 sm:space-y-14">
      <div className="flex flex-col gap-2">
        <h1 className="text-[40px] font-bold leading-none tracking-[-0.03em] text-t1 sm:text-[48px]">Sleeves</h1>
        <p className="text-[16px] text-t3 sm:text-[18px]">
          {ALL_SLEEVE_TICKERS.length} holdings across {SLEEVES.length} sleeves
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-6 md:gap-10">
        <Link href="/screen" className="hero-stat hero-stat-lead group col-span-2 md:col-span-1">
          <span className="hero-label">Screen</span>
          <span className="hero-value">{ALL_SLEEVE_TICKERS.length}</span>
          <span className="hero-sub group-hover:text-goldInk">All sleeves by expected return →</span>
        </Link>
        {SLEEVES.map((s) => (
          <Link key={s.key} href={`/screen?sleeve=${s.key}`} className="hero-stat group">
            <span className="hero-label">{s.name}</span>
            <span className="hero-value">{s.tickers.length}</span>
            <span className="hero-sub group-hover:text-goldInk">Screen {s.name} →</span>
          </Link>
        ))}
        <Link
          href={watchlist.length ? '/screen?sleeve=watchlist' : '#watchlist'}
          className="hero-stat group col-span-2 md:col-span-1"
        >
          <span className="hero-label">Watchlist</span>
          <span className="hero-value">{watchlist.length}</span>
          <span className="hero-sub group-hover:text-goldInk">
            {watchlist.length ? 'Screen Watchlist →' : 'Add tickers below ↓'}
          </span>
        </Link>
      </div>

      <div className="grid gap-12 lg:grid-cols-3 lg:gap-10">
        <div className="lg:col-span-2">
          <HoldingsBrowser sleeves={SLEEVES} />
        </div>
        <div id="watchlist" className="lg:col-span-1">
          <Watchlist />
        </div>
      </div>
    </div>
  );
}
