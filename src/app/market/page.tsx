import { Panel, Stat } from '@/components/ui';
import { MarketHistory } from '@/components/MarketHistory';
import { MarketReferenceForm } from '@/components/MarketReferenceForm';
import { loadMarketReference, loadMarketSnapshots } from '@/lib/market/store';
import type { BasketSummary } from '@/lib/market/sp500';
import { HISTORY_SOURCE, HISTORY_THROUGH, historySeries, periodStats, type HistoryMetric } from '@/lib/market/history';
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

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Today's figure against Shiller's history: average, median and rank by period. */
function HistoryTable({ metric, today }: { metric: HistoryMetric; today: number | null }) {
  const stats = periodStats(historySeries(metric), today);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-line text-[10px] uppercase tracking-label text-t4">
            <th className="px-4 py-2 text-left font-medium">Period</th>
            <th className="px-2 py-2 text-right font-medium">Average</th>
            <th className="px-2 py-2 text-right font-medium">Median</th>
            <th className="px-2 py-2 text-right font-medium">Today vs avg</th>
            <th className="px-4 py-2 text-right font-medium">Today above</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((p) => {
            const gap = today !== null ? today / p.average - 1 : null;
            return (
              <tr key={p.label} className="border-b border-hairline last:border-0">
                <td className="px-4 py-2 text-t1">
                  {p.label}
                  <span className="mt-0.5 block text-[11px] text-t4">from {monthLabel(p.from)}</span>
                </td>
                <td className="tabular px-2 py-2 text-right text-t1">{p.average.toFixed(1)}×</td>
                <td className="tabular px-2 py-2 text-right text-t1">{p.median.toFixed(1)}×</td>
                <td className={`tabular px-2 py-2 text-right ${gap !== null ? toneClass(-gap) : 'text-t4'}`}>{signedPct(gap, 0)}</td>
                <td className="tabular px-4 py-2 text-right text-t2">
                  {p.percentile !== null ? `${(p.percentile * 100).toFixed(0)}% of months` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function MarketPage() {
  const [snapshots, reference] = await Promise.all([loadMarketSnapshots('sp500'), loadMarketReference()]);
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
        eyebrow="Against history"
        title="Is the market expensive?"
        subtitle={`Reported earnings, Shiller data through ${HISTORY_THROUGH ? monthLabel(HISTORY_THROUGH) : '—'}`}
      >
        {latest.trailing || latest.cape ? (
          <>
            <div className="grid grid-cols-2 border-b border-line">
              <Stat
                label="Trailing P/E today"
                value={latest.trailing?.value ? `${latest.trailing.value.toFixed(1)}×` : '—'}
                sub={latest.trailing ? `Last 4 reported quarters · ${pct(latest.trailing.coverage, 0)} of index value` : undefined}
              />
              <Stat
                label="CAPE today"
                value={latest.cape?.value ? `${latest.cape.value.toFixed(1)}×` : '—'}
                sub={latest.cape ? `10-year real earnings · ${pct(latest.cape.coverage, 0)} of index value` : undefined}
              />
            </div>
            <p className="eyebrow-muted px-4 pt-3">Trailing P/E</p>
            <HistoryTable metric="trailing" today={latest.trailing?.value ?? null} />
            <p className="eyebrow-muted border-t border-line px-4 pt-3">CAPE (Shiller P/E)</p>
            <HistoryTable metric="cape" today={latest.cape?.value ?? null} />
          </>
        ) : (
          <p className="px-4 py-3 text-[12px] text-t3">Trailing P/E and CAPE start with the next evening&rsquo;s reading.</p>
        )}
        <p className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-t4">
          Today&rsquo;s figures are built from the members&rsquo; own reported earnings, weighted by market value, with
          losses netted in, as the index&rsquo;s reported earnings are; CAPE uses each member&rsquo;s last ten annual
          reports in today&rsquo;s dollars (CPI from FRED). History: {HISTORY_SOURCE}. Green means cheaper than the
          average, red dearer.
        </p>
      </Panel>

      <Panel eyebrow="Forward P/E" title="Against FactSet's averages" subtitle="Next twelve months' consensus">
        {(() => {
          const ntm = latest.ntmPe ?? latest.years[0]?.pe ?? null;
          const refs = [
            { label: '5-year average', ref: reference.get('factset_fwd_pe_5y') },
            { label: '10-year average', ref: reference.get('factset_fwd_pe_10y') },
          ];
          const asOf = refs.find((r) => r.ref?.asOf)?.ref?.asOf ?? null;
          return (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3">
                <Stat label="Today" value={ntm ? `${ntm.toFixed(1)}×` : '—'} sub="Bottom-up, analyst EPS" />
                {refs.map(({ label, ref }) => {
                  const gap = ntm && ref ? ntm / ref.value - 1 : null;
                  return (
                    <Stat
                      key={label}
                      label={`FactSet ${label}`}
                      value={ref ? `${ref.value.toFixed(1)}×` : '—'}
                      sub={
                        gap !== null ? (
                          <span className={toneClass(-gap)}>Today {signedPct(gap, 0)} {gap >= 0 ? 'above' : 'below'}</span>
                        ) : (
                          'Not entered yet'
                        )
                      }
                    />
                  );
                })}
              </div>
              <div className="border-t border-line px-4 py-3">
                <MarketReferenceForm
                  fiveYear={reference.get('factset_fwd_pe_5y')?.value ?? null}
                  tenYear={reference.get('factset_fwd_pe_10y')?.value ?? null}
                  asOf={asOf}
                />
                <p className="mt-2 text-[11px] leading-relaxed text-t4">
                  FactSet publishes both averages each week in its free Earnings Insight report. Analyst EPS leaves out
                  one-off charges, so forward P/Es are only compared with forward averages, never with the reported-earnings
                  history above.{asOf ? ` Averages as of ${day(asOf)}.` : ''}
                </p>
              </div>
            </>
          );
        })()}
      </Panel>

      {latest.expected && (
        <Panel
          eyebrow="Expected return"
          title="The market through the house model"
          subtitle="Same 3-year calculation as each stock page"
        >
          <div className="stat-grid grid-cols-2 md:grid-cols-4">
            <Stat
              label="Expected CAGR · by value"
              value={pct(latest.expected.average, 1)}
              tone={latest.expected.average !== null ? latest.expected.average - latest.expected.hurdle : undefined}
              sub={`vs ${pct(latest.expected.hurdle, 0)} hurdle`}
            />
            <Stat label="Median · by value" value={pct(latest.expected.median, 1)} sub="Half the index's value above it" />
            <Stat
              label={`Clearing ${pct(latest.expected.hurdle, 0)}`}
              value={pct(latest.expected.clearing, 0)}
              sub="Share of the scored value"
            />
            <Stat
              label="Scored"
              value={String(latest.expected.count)}
              sub={`${pct(latest.expected.coverage, 0)} of index value`}
            />
          </div>
        </Panel>
      )}

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
