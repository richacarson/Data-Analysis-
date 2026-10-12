import type { MarketSnapshot } from '@/lib/market/sp500';

const LINE_COLORS = ['rgb(var(--s1))', 'rgb(var(--s2))'];

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** The index's forward P/E for the next two calendar years, one point a day. */
export function MarketHistory({ snapshots, years }: { snapshots: MarketSnapshot[]; years: string[] }) {
  const lines = years.slice(0, 2).map((year) => ({
    year,
    points: snapshots
      .map((s) => ({ t: Date.parse(`${s.asOf}T00:00:00Z`), v: s.years.find((y) => y.year === year)?.pe ?? null }))
      .filter((p): p is { t: number; v: number } => p.v !== null),
  }));
  const all = lines.flatMap((l) => l.points);
  if (all.length < 2) return null;

  const W = 600;
  const H = 170;
  const pad = { l: 40, r: 12, t: 12, b: 22 };
  const t0 = Math.min(...all.map((p) => p.t));
  const t1 = Math.max(...all.map((p) => p.t));
  const lo = Math.floor(Math.min(...all.map((p) => p.v)) - 0.5);
  const hi = Math.ceil(Math.max(...all.map((p) => p.v)) + 0.5);
  const x = (t: number) => pad.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + ((hi - v) / Math.max(1e-9, hi - lo)) * (H - pad.t - pad.b);
  const ticks = [hi, (hi + lo) / 2, lo];

  return (
    <div className="px-4 py-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="S&P 500 forward P/E over time">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="var(--chart-tick)">
              {v.toFixed(1)}×
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 6} fontSize="10" fill="var(--chart-tick)">
          {dayLabel(new Date(t0).toISOString().slice(0, 10))}
        </text>
        <text x={W - pad.r} y={H - 6} textAnchor="end" fontSize="10" fill="var(--chart-tick)">
          {dayLabel(new Date(t1).toISOString().slice(0, 10))}
        </text>
        {lines.map((l, i) =>
          l.points.length > 1 ? (
            <polyline
              key={l.year}
              points={l.points.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')}
              fill="none"
              stroke={LINE_COLORS[i]}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          ) : null,
        )}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-t3">
        {lines.map((l, i) => (
          <span key={l.year} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3" style={{ background: LINE_COLORS[i] }} />
            CY{l.year} P/E
          </span>
        ))}
      </div>
    </div>
  );
}
