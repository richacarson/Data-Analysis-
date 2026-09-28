import { Panel } from '@/components/ui';
import { bigMoney, money, num, signedPct, toneClass } from '@/lib/format';
import type { RevisionSummary, RevisionYear } from '@/lib/estimates/revisions';
import type { PriceTargetSummary, RatingsMonth } from '@/lib/fmp/types';

// The chart palette (MetricChart is a client module, so its constants are not importable here).
const LINE_COLORS = ['#AE8E2F', '#5D82D8', '#B8B4AC'];

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-t4">—</span>;
  // Under a tenth of a percent is rounding, not a revision.
  if (Math.abs(value) < 0.001) return <span className="text-t3">0.0%</span>;
  return <span className={toneClass(value)}>{signedPct(value)}</span>;
}

function monthLabel(date: string): string {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Each year's consensus EPS indexed to its first snapshot, so direction reads at a glance. */
function RevisionLines({ years, labelOf }: { years: RevisionYear[]; labelOf: (d: string) => string }) {
  const lines = years
    .slice(0, 3)
    .map((y) => {
      const base = y.series.find((p) => p.eps !== null)?.eps ?? null;
      if (base === null || base === 0) return null;
      return {
        label: `FY${labelOf(y.fiscalDate)}`,
        points: y.series.filter((p) => p.eps !== null).map((p) => ({ t: Date.parse(p.date), v: (p.eps! - base) / Math.abs(base) })),
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null && l.points.length > 1);
  if (!lines.length) return null;

  const W = 600;
  const H = 150;
  const pad = { l: 44, r: 12, t: 12, b: 22 };
  const all = lines.flatMap((l) => l.points);
  const t0 = Math.min(...all.map((p) => p.t));
  const t1 = Math.max(...all.map((p) => p.t));
  const maxAbs = Math.max(0.01, ...all.map((p) => Math.abs(p.v)));
  const x = (t: number) => pad.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + ((maxAbs - v) / (2 * maxAbs)) * (H - pad.t - pad.b);

  return (
    <div className="border-b border-line px-4 py-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Consensus EPS change since recording began">
        {[maxAbs, 0, -maxAbs].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="rgba(201,168,76,0.07)" strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#A09C94">
              {signedPct(v)}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 6} fontSize="10" fill="#A09C94">
          {monthLabel(new Date(t0).toISOString())}
        </text>
        <text x={W - pad.r} y={H - 6} textAnchor="end" fontSize="10" fill="#A09C94">
          {monthLabel(new Date(t1).toISOString())}
        </text>
        {lines.map((l, i) => (
          <polyline
            key={l.label}
            points={l.points.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')}
            fill="none"
            stroke={LINE_COLORS[i]}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-t3">
        {lines.map((l, i) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3" style={{ background: LINE_COLORS[i] }} />
            {l.label} EPS
          </span>
        ))}
      </div>
    </div>
  );
}

export function EstimateRevisions({
  summary,
  labelOf,
  price,
  currency,
  targets,
  ratings,
  recording,
}: {
  summary: RevisionSummary;
  labelOf: (fiscalDate: string) => string;
  price: number | null;
  currency: string;
  targets: PriceTargetSummary | null;
  ratings: RatingsMonth[];
  recording: boolean;
}) {
  const days =
    summary.since && summary.latest
      ? Math.round((Date.parse(summary.latest) - Date.parse(summary.since)) / 86_400_000)
      : 0;
  const subtitle = !recording
    ? 'Not recording yet'
    : days > 0
      ? `Recorded daily since ${monthLabel(summary.since!)}`
      : 'Recording from today';

  const targetRows = targets
    ? [
        { label: 'Past month', value: targets.lastMonthAvgPriceTarget, count: targets.lastMonthCount },
        { label: 'Past quarter', value: targets.lastQuarterAvgPriceTarget, count: targets.lastQuarterCount },
        { label: 'Past year', value: targets.lastYearAvgPriceTarget, count: targets.lastYearCount },
      ].filter((r) => r.count > 0 && r.value > 0)
    : [];

  const months = [...ratings].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <Panel eyebrow="Estimate revisions" title="How consensus is moving" subtitle={subtitle}>
      {days < 7 && (
        <p className="border-b border-line px-4 py-3 text-[12px] leading-relaxed text-t3">
          FMP publishes today&rsquo;s consensus only, so the history is recorded here: once a day for every holding, and
          whenever a stock is opened. Changes fill in as the record grows: 7-day after a week, 30-day after a month.
        </p>
      )}

      <RevisionLines years={summary.years} labelOf={labelOf} />

      {summary.years.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-label text-t4">
                <th className="px-4 py-2 text-left font-medium">Year</th>
                <th className="px-2 py-2 text-right font-medium">EPS</th>
                <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">7d</th>
                <th className="px-2 py-2 text-right font-medium">30d</th>
                <th className="px-2 py-2 text-right font-medium">90d</th>
                <th className="px-2 py-2 text-right font-medium">Analysts</th>
                <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">Revenue · 30d</th>
              </tr>
            </thead>
            <tbody>
              {summary.years.map((y) => (
                <tr key={y.fiscalDate} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-2 text-t2">FY{labelOf(y.fiscalDate)}</td>
                  <td className="tabular px-2 py-2 text-right text-t1">{num(y.eps)}</td>
                  <td className="tabular hidden px-2 py-2 text-right sm:table-cell">
                    <Change value={y.epsChange[7]} />
                  </td>
                  <td className="tabular px-2 py-2 text-right">
                    <Change value={y.epsChange[30]} />
                  </td>
                  <td className="tabular px-2 py-2 text-right">
                    <Change value={y.epsChange[90]} />
                  </td>
                  <td className={`tabular px-2 py-2 text-right ${y.analysts !== null && y.analysts < 3 ? 'text-dn' : 'text-t2'}`}>
                    {y.analysts ?? '—'}
                    {y.analystsChange30 ? (
                      <span className={`ml-1 text-[10px] ${toneClass(y.analystsChange30)}`}>
                        {y.analystsChange30 > 0 ? '+' : ''}
                        {y.analystsChange30}
                      </span>
                    ) : null}
                  </td>
                  <td className="tabular hidden px-4 py-2 text-right text-t3 sm:table-cell">
                    {bigMoney(y.revenue, currency)} · <Change value={y.revenueChange[30]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(targetRows.length > 0 || months.length > 0) && (
        <div className="grid grid-cols-1 border-t border-line sm:grid-cols-2">
          {targetRows.length > 0 && (
            <div className="min-w-0 px-4 py-3 sm:border-r sm:border-line">
              <p className="eyebrow-muted">Average price target</p>
              {targetRows.map((r) => (
                <div key={r.label} className="mt-1.5 flex items-baseline justify-between gap-3 text-[12px]">
                  <span className="text-t3">
                    {r.label} <span className="text-t4">({r.count})</span>
                  </span>
                  <span className="tabular text-t1">
                    {money(r.value, currency)}
                    {price ? (
                      <span className={`ml-2 text-[11px] ${toneClass(r.value / price - 1)}`}>{signedPct(r.value / price - 1)}</span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          )}
          {months.length > 0 && (
            <div className="min-w-0 px-4 py-3">
              <p className="eyebrow-muted">Analyst ratings by month</p>
              {months.map((m) => {
                const buy = m.analystRatingsStrongBuy + m.analystRatingsBuy;
                const hold = m.analystRatingsHold;
                const sell = m.analystRatingsSell + m.analystRatingsStrongSell;
                const total = buy + hold + sell || 1;
                return (
                  <div key={m.date} className="mt-1.5 flex items-center gap-3 text-[11px]">
                    <span className="w-12 shrink-0 text-t4">
                      {new Date(`${m.date.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })}
                    </span>
                    <div className="flex h-1.5 min-w-0 flex-1 gap-px">
                      <div className="bg-up/60" style={{ width: `${(buy / total) * 100}%` }} />
                      <div className="bg-elevated" style={{ width: `${(hold / total) * 100}%` }} />
                      <div className="bg-dn/60" style={{ width: `${(sell / total) * 100}%` }} />
                    </div>
                    <span className="tabular w-16 shrink-0 text-right text-t3">
                      {buy}/{hold}/{sell}
                    </span>
                  </div>
                );
              })}
              <p className="mt-1.5 text-[10px] text-t4">Buy / hold / sell</p>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
