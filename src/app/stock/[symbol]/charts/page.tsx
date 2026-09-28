import Link from 'next/link';
import { after } from 'next/server';
import { getEstimates, getPriceTargetSummary, getProfile, getRatingsHistory } from '@/lib/fmp/endpoints';
import { snapshotRows, summarizeRevisions } from '@/lib/estimates/revisions';
import { canRecord, loadSnapshots, recordSnapshots } from '@/lib/estimates/store';
import { fiscalYearLabeler } from '@/lib/valuation/fiscal';
import { EstimateRevisions } from '@/components/charts/EstimateRevisions';
import { buildChartData } from '@/lib/charts/build';
import { ChartGallery } from '@/components/charts/ChartGallery';
import { StockTabs } from '@/components/StockTabs';
import { num, signedPct } from '@/lib/format';

export const revalidate = 3600;
// Room to wait out an FMP rate-limit window rather than fail the page.
export const maxDuration = 120;

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} charts — Equity Lens` };
}

export default async function ChartsPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { symbol: raw } = await params;
  const { sleeve } = await searchParams;
  const symbol = raw.toUpperCase();

  let profile;
  let data;
  // Side panels: a failure here should cost the panel, not the page.
  const quiet = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
  const side = Promise.all([
    quiet(getEstimates(symbol, 'annual', 10), []),
    quiet(loadSnapshots(symbol), []),
    quiet(getPriceTargetSummary(symbol), null),
    quiet(getRatingsHistory(symbol), []),
  ]);
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

  const [estimates, recorded, targets, ratings] = await side;
  // Today's consensus joins the record now, so the table is never empty.
  const today = snapshotRows(symbol, estimates);
  const todayDate = today[0]?.snapshot_date;
  const revisions = summarizeRevisions([...recorded.filter((r) => r.snapshot_date !== todayDate), ...today]);
  if (canRecord() && today.length) after(() => recordSnapshots(today).catch(() => undefined));
  const labelOf = fiscalYearLabeler(data.annual.map((r) => ({ date: r.date, fiscalYear: String(r.fiscalYear) })));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-[40px] font-bold leading-none tracking-[-0.03em] text-t1 sm:text-[48px]">{symbol}</h1>
          <span className="text-[18px] text-t3 sm:text-[20px]">{profile?.companyName ?? ''}</span>
        </div>
        {profile && (
          <div className="flex items-baseline gap-3">
            <span className="text-[28px] font-light tracking-hero text-t1">{num(profile.price)}</span>
            <span className={`text-[13px] ${profile.change >= 0 ? 'text-up' : 'text-dn'}`}>
              {profile.change >= 0 ? '+' : ''}
              {num(profile.change)} ({signedPct(profile.changePercentage / 100)})
            </span>
          </div>
        )}
      </div>
      {data.convertedFrom && (
        <p className="-mt-3 text-[12px] text-t3">
          Reported in {data.convertedFrom.currency}, shown in {currency} at today&rsquo;s rate (
          {data.convertedFrom.fx.toPrecision(4)})
          {data.convertedFrom.shareRatio !== 1 ? ' · per-share figures per ADR' : ''}
        </p>
      )}
      <StockTabs symbol={symbol} active="charts" sleeve={sleeve} />
      <ChartGallery data={data} />
      <EstimateRevisions
        summary={revisions}
        labelOf={labelOf}
        price={profile?.price ?? null}
        currency={currency}
        targets={targets}
        ratings={ratings}
        recording={canRecord()}
      />
    </div>
  );
}
