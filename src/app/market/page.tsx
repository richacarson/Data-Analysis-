import { Panel, Stat } from '@/components/ui';
import { MarketHistory } from '@/components/MarketHistory';
import { loadMarketSnapshots } from '@/lib/market/store';
import type { BasketSummary } from '@/lib/market/sp500';
import type { BasketYear } from '@/lib/valuation/aggregate';
import { pct, signedPct, toneClass } from '@/lib/format';

// A single small database read; always today's snapshot.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Market — Equity Lens' };

const pe = (y: BasketYear | undefined) => (y?.pe ? `${y.pe.toFixed(1)}×` : '—');

function day(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** One row of a breakdown table: share of the index, P/E by year, first-year growth. */
function BreakdownRow({ label, detail, group, years }: { label: string; detail?: string; group: BasketSummary; years: string[] }) {
  const first = group.years[0];
  return (
    <tr className="border-b border-hairline last:border-0">
      <td className="min-w-[8.5rem] px-4 py-2 text-t1">
        {label}
        {detail ? <span className="mt-0.5 block text-[11px] text-t4">{detail}</span> : null}
      </td>
      <td className="tabular px-2 py-2 text-right text-t2">{pct(group.share, 1)}</td>
      {years.map((year, i) => (
        <td key={year} className={`tabular px-2 py-2 text-right text-t1 ${i > 0 ? 'hidden sm:table-cell' : ''}`}>
          {pe(group.years.find((y) => y.year === year))}
        </td>
      ))}
      <td className={`tabular px-4 py-2 text-right ${first?.growth != null ? toneClass(first.growth) : 'text-t4'}`}>
        {signedPct(first?.growth ?? null)}
      </td>
    </tr>
  );
}

function BreakdownTable({ years, children }: { years: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-line text-[10px] uppercase tracking-label text-t4">
            <th className="px-4 py-2 text-left font-medium" />
            <th className="px-2 py-2 text-right font-medium">Of index</th>
            {years.map((year, i) => (
              <th key={year} className={`px-2 py-2 text-right font-medium ${i > 0 ? 'hidden sm:table-cell' : ''}`}>
                CY{year} P/E
              </th>
            ))}
            <th className="px-4 py-2 text-right font-medium">EPS growth {years[0]}</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default async function MarketPage() {
  const snapshots = await loadMarketSnapshots('sp500');
  const latest = snapshots[snapshots.length - 1] ?? null;

  if (!latest) {
    return (
      <div className="panel px-4 py-4 sm:px-5">
        <p className="eyebrow">Market</p>
        <h1 className="mt-1.5 font-serif text-[24px] tracking-tight text-t1">S&amp;P 500</h1>
        <p className="mt-2 text-[13px] text-t3">
          No reading yet. The index is rebuilt from its members&rsquo; consensus each evening after the close; the first
          reading appears after tonight&rsquo;s run.
        </p>
      </div>
    );
  }

  const years = latest.years.map((y) => y.year);

  return (
    <div className="space-y-4">
      <div className="panel px-4 py-4 sm:px-5">
        <p className="eyebrow">Market</p>
        <h1 className="mt-1.5 font-serif text-[24px] tracking-tight text-t1">S&amp;P 500</h1>
        <p className="mt-1 text-[12px] text-t3">
          Built bottom-up from {latest.used} of {latest.members} members&rsquo; consensus, weighted by market value, in
          calendar years · as of {day(latest.asOf)}
        </p>
      </div>

      <div className="panel stat-grid grid-cols-2 md:grid-cols-4">
        {latest.years.map((y) => (
          <Stat
            key={y.year}
            label={`CY${y.year} P/E`}
            value={pe(y)}
            sub={
              <>
                <span className="block">EPS growth {signedPct(y.growth)}</span>
                <span className="block">
                  {pct(y.coverage, 0)} of index value covered{y.losses ? ` · ${y.losses} at a loss` : ''}
                </span>
              </>
            }
          />
        ))}
      </div>

      <Panel
        eyebrow="History"
        title="Forward P/E over time"
        subtitle={snapshots.length > 1 ? `${snapshots.length} daily readings` : `Recorded daily from ${day(latest.asOf)}`}
      >
        {snapshots.length > 1 ? (
          <MarketHistory snapshots={snapshots} years={years} />
        ) : (
          <p className="px-4 py-3 text-[12px] text-t3">
            One reading so far. A line builds here as a reading is added each evening.
          </p>
        )}
      </Panel>

      <Panel eyebrow="Concentration" title={`The ${latest.top.names} largest against the rest`}>
        <BreakdownTable years={years}>
          <BreakdownRow label={`Top ${latest.top.names}`} detail={latest.top.symbols.join(', ')} group={latest.top} years={years} />
          <BreakdownRow label={`Other ${latest.rest.names}`} group={latest.rest} years={years} />
          <BreakdownRow label="Whole index" group={{ names: latest.used, share: 1, years: latest.years }} years={years} />
        </BreakdownTable>
      </Panel>

      <Panel eyebrow="Sectors" title="By sector" subtitle="Largest first">
        <BreakdownTable years={years}>
          {latest.sectors.map((s) => (
            <BreakdownRow key={s.sector} label={s.sector} detail={`${s.names} members`} group={s} years={years} />
          ))}
        </BreakdownTable>
      </Panel>

      <p className="px-1 text-[11px] leading-relaxed text-t4">
        Total market value over total consensus earnings, the way FactSet and S&amp;P report the index&rsquo;s forward
        P/E. Each member&rsquo;s fiscal years are restated to calendar years. Market value stands in for the index&rsquo;s
        float-adjusted weights. Members expected to lose money in a year are left out of that year&rsquo;s P/E. Growth
        compares the same members in both years. Sleeve P/Es on the Screen are by fiscal year, so a member with a
        non-December year differs slightly between the two.
      </p>
    </div>
  );
}
