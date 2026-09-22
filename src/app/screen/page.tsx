import Link from 'next/link';
import { runScreen } from '@/lib/screen/run';
import { SLEEVES, sleeveByKey, ALL_SLEEVE_TICKERS } from '@/data/sleeves';
import { DEFAULT_HURDLE } from '@/lib/valuation/build';
import { Panel, Stat } from '@/components/ui';
import { ScreenTable } from '@/components/ScreenTable';

// A full sleeve is a few hundred API calls; an hour of cache keeps it usable.
export const revalidate = 3600;

/*
 * The 154-holding screen is roughly 460 requests. At the concurrency below that
 * is well inside a minute, but comfortably past the default serverless ceiling,
 * so the limit is raised explicitly rather than left to time out on a cold
 * cache.
 */
export const maxDuration = 60;

export const metadata = { title: 'Screen — Equity Lens' };

export default async function ScreenPage({
  searchParams,
}: {
  searchParams: Promise<{ sleeve?: string; hurdle?: string }>;
}) {
  const { sleeve: sleeveKey, hurdle: hurdleParam } = await searchParams;
  const sleeve = sleeveKey ? sleeveByKey(sleeveKey) : undefined;
  const tickers = sleeve ? sleeve.tickers : ALL_SLEEVE_TICKERS;

  const parsedHurdle = hurdleParam ? Number(hurdleParam) : NaN;
  const hurdle = Number.isFinite(parsedHurdle) && parsedHurdle > 0 ? parsedHurdle : DEFAULT_HURDLE;

  const rows = await runScreen(tickers, { hurdle });

  const scored = rows.filter((r) => r.expectedCagr !== null);
  const clearing = scored.filter((r) => r.clearsHurdle);
  const median =
    scored.length > 0
      ? [...scored].sort((a, b) => a.expectedCagr! - b.expectedCagr!)[
          Math.floor(scored.length / 2)
        ].expectedCagr
      : null;

  return (
    <div className="space-y-4">
      <div className="panel px-5 py-4">
        <p className="eyebrow">Portfolio screen</p>
        <h1 className="mt-1.5 font-serif text-[24px] tracking-tight text-t1">
          {sleeve ? sleeve.name : 'All sleeves'}
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/screen"
            className={`border px-3 py-1.5 text-[12px] font-medium ${
              !sleeve ? 'border-lineActive text-gold' : 'border-line bg-card text-t2 hover:text-gold'
            }`}
          >
            All ({ALL_SLEEVE_TICKERS.length})
          </Link>
          {SLEEVES.map((s) => (
            <Link
              key={s.key}
              href={`/screen?sleeve=${s.key}`}
              className={`border px-3 py-1.5 text-[12px] font-medium ${
                sleeve?.key === s.key
                  ? 'border-lineActive text-gold'
                  : 'border-line bg-card text-t2 hover:text-gold'
              }`}
            >
              {s.name} ({s.tickers.length})
            </Link>
          ))}
        </div>
      </div>

      <div className="panel grid grid-cols-2 divide-x divide-line md:grid-cols-4">
        <Stat label="Holdings screened" value={String(tickers.length)} sub={`${scored.length} with usable estimates`} />
        <Stat
          label={`Clear ${(hurdle * 100).toFixed(0)}%`}
          value={String(clearing.length)}
          tone={clearing.length - scored.length / 2}
          sub={scored.length ? `${((clearing.length / scored.length) * 100).toFixed(0)}% of scored` : undefined}
        />
        <Stat
          label="Median expected CAGR"
          value={median !== null ? `${(median * 100).toFixed(1)}%` : '—'}
          tone={median !== null ? median - hurdle : undefined}
        />
        <Stat
          label="Not scored"
          value={String(rows.length - scored.length)}
          sub="No consensus, price or usable multiple"
        />
      </div>

      <Panel
        eyebrow="Ranked"
        title="Expected 3-year total return"
        subtitle="Exit multiple = most conservative anchor"
      >
        <ScreenTable rows={rows} hurdle={hurdle} />
      </Panel>
    </div>
  );
}
