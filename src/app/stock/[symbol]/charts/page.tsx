import Link from 'next/link';
import { getProfile } from '@/lib/fmp/endpoints';
import { buildChartData } from '@/lib/charts/build';
import { ChartGallery } from '@/components/charts/ChartGallery';
import { StockTabs } from '@/components/StockTabs';
import { money, num, signedPct } from '@/lib/format';

export const revalidate = 3600;
// Room to wait out an FMP rate-limit window rather than fail the page.
export const maxDuration = 120;

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} charts — Equity Lens` };
}

export default async function ChartsPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();

  let profile;
  let data;
  try {
    [profile, data] = await Promise.all([getProfile(symbol), buildChartData(symbol)]);
  } catch (error) {
    return (
      <div className="panel p-8">
        <h1 className="text-lg font-semibold">Could not load charts for {symbol}</h1>
        <p className="mt-2 text-[13px] text-t3">{error instanceof Error ? error.message : 'Unknown error'}</p>
        <Link href={`/stock/${symbol}`} className="mt-4 inline-block text-[13px] text-gold underline">
          Back to the valuation
        </Link>
      </div>
    );
  }

  const currency = profile?.currency || 'USD';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="eyebrow">
            {profile?.exchange ?? ''} · {symbol}
          </p>
          <h1 className="mt-1 truncate font-serif text-[21px] leading-tight tracking-tight text-t1 sm:text-[24px]">
            {profile?.companyName ?? symbol}
          </h1>
        </div>
        {profile && (
          <div className="flex items-baseline gap-3">
            <span className="tabular text-[22px] font-semibold text-t1">{money(profile.price, currency)}</span>
            <span className={`tabular text-[13px] ${profile.change >= 0 ? 'text-up' : 'text-dn'}`}>
              {profile.change >= 0 ? '+' : ''}
              {num(profile.change)} ({signedPct(profile.changePercentage / 100)})
            </span>
          </div>
        )}
      </div>
      <StockTabs symbol={symbol} active="charts" />
      <ChartGallery data={data} />
    </div>
  );
}
