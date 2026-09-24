'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, CHARTS, DEFAULT_CHART_IDS, chartById, type ChartDef } from '@/lib/charts/catalog';
import type { ChartData } from '@/lib/charts/build';
import type { ChartPeriod } from '@/lib/charts/rows';
import { formatValue } from '@/lib/charts/format';
import { ChartLegend, MetricChart, type ChartRow } from './MetricChart';
import { useChartPrefs } from './useChartPrefs';

const PERIODS: Array<{ key: ChartPeriod; label: string }> = [
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'ttm', label: 'TTM' },
  { key: 'annual', label: 'Annual' },
];
const RANGES = [
  { key: '3', label: '3Y', years: 3 },
  { key: '5', label: '5Y', years: 5 },
  { key: '10', label: '10Y', years: 10 },
  { key: 'all', label: 'All', years: Infinity },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

const VIEW_KEY = 'equity-lens:chart-view';

function useView() {
  const [period, setPeriod] = useState<ChartPeriod>('annual');
  const [range, setRange] = useState<RangeKey>('10');
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(VIEW_KEY) ?? 'null');
      if (saved?.period) setPeriod(saved.period);
      if (saved?.range) setRange(saved.range);
    } catch {
      // No saved view; defaults stand.
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_KEY, JSON.stringify({ period, range }));
    } catch {
      // Storage unavailable; the view still works for this visit.
    }
  }, [period, range]);
  return { period, setPeriod, range, setRange };
}

/** Rows for one chart under the current controls. */
function rowsFor(def: ChartDef, data: ChartData, period: ChartPeriod, years: number): ChartRow[] {
  if (def.kind === 'price') {
    if (!Number.isFinite(years)) return data.prices;
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - years);
    const iso = cutoff.toISOString().slice(0, 10);
    return data.prices.filter((p) => p.date >= iso);
  }
  if (def.kind === 'segments') {
    const rows = def.segmentSource === 'geographic' ? data.segments.geographic.rows : data.segments.product.rows;
    return Number.isFinite(years) ? rows.slice(-years) : rows;
  }
  const effective: ChartPeriod = def.annualOnly ? 'annual' : period;
  const base = data[effective];
  const count = Number.isFinite(years) ? (effective === 'annual' ? years : years * 4) : base.length;
  const rows: ChartRow[] = base.slice(-count);
  if (def.withEstimates && effective === 'annual') return [...rows, ...data.estimates.slice(0, 3)];
  return rows;
}

function segmentKeys(def: ChartDef, data: ChartData) {
  if (def.kind !== 'segments') return [];
  return def.segmentSource === 'geographic' ? data.segments.geographic.segments : data.segments.product.segments;
}

/** Latest reported value of the chart's first series, for the card header. */
function latest(def: ChartDef, rows: ChartRow[]): string | null {
  const key = def.kind === 'segments' ? null : def.series[0]?.key;
  if (!key) return null;
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = rows[i][key];
    if (!rows[i].estimate && typeof v === 'number') return formatValue(v, def.format);
  }
  return null;
}

/** Renders its chart only once scrolled near, so fifty charts stay light on a phone. */
function WhenVisible({ height, children }: { height: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return (
    <div ref={ref} style={{ minHeight: height }}>
      {seen ? children : <div className="animate-pulse bg-card/40" style={{ height }} />}
    </div>
  );
}

function ChartCard({
  def,
  data,
  period,
  years,
  onExpand,
}: {
  def: ChartDef;
  data: ChartData;
  period: ChartPeriod;
  years: number;
  onExpand: () => void;
}) {
  const rows = rowsFor(def, data, period, years);
  const keys = segmentKeys(def, data);
  const value = latest(def, rows);
  return (
    <section className="panel flex min-w-0 flex-col">
      <div className="flex items-start justify-between gap-3 px-3.5 pb-1 pt-3">
        <div className="min-w-0">
          <h3 className="truncate text-[12px] font-semibold text-t1">{def.title}</h3>
          <p className="truncate text-[10px] text-t4">
            {[def.annualOnly && period !== 'annual' ? 'Annual figures' : null, def.note].filter(Boolean).join(' · ') || '\u00a0'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {value && <span className="tabular text-[12px] font-semibold text-t2">{value}</span>}
          <button
            onClick={onExpand}
            className="-m-1.5 p-1.5 text-t4 transition-colors hover:text-gold"
            aria-label={`Expand ${def.title}`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M7 1h4v4M5 11H1V7M11 1 7 5M1 11l4-4" />
            </svg>
          </button>
        </div>
      </div>
      <div className="px-1.5">
        <WhenVisible height={190}>
          <MetricChart def={def} rows={rows} height={190} segmentKeys={keys} compactAxes />
        </WhenVisible>
      </div>
      <div className="min-h-[22px] px-3.5 pb-2.5 pt-1">
        <ChartLegend def={def} rows={rows} segmentKeys={keys} />
      </div>
    </section>
  );
}

/** Full-size chart with the values as a table, so nothing depends on hovering. */
function Expanded({
  def,
  data,
  period,
  years,
  onClose,
}: {
  def: ChartDef;
  data: ChartData;
  period: ChartPeriod;
  years: number;
  onClose: () => void;
}) {
  const rows = rowsFor(def, data, period, years);
  const keys = segmentKeys(def, data);
  const columns =
    def.kind === 'segments'
      ? keys.map((k) => ({ key: k, label: k, format: def.format }))
      : [
          ...def.series.map((s) => ({ ...s, format: def.format })),
          ...(def.overlay ? [{ key: def.overlay.key, label: def.overlay.label, format: def.overlay.format }] : []),
        ];
  const tableRows = def.kind === 'price' ? rows.filter((_, i) => i % 4 === 0 || i === rows.length - 1) : rows;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={def.title}
        className="panel flex max-h-[92vh] w-full max-w-5xl flex-col bg-surface pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div>
            <p className="eyebrow">{def.category}</p>
            <h2 className="mt-1 text-[15px] font-semibold text-t1">{def.title}</h2>
            {def.note && <p className="mt-0.5 text-[11px] text-t3">{def.note}</p>}
          </div>
          <button onClick={onClose} className="btn shrink-0">
            Close
          </button>
        </div>
        <div className="overflow-y-auto">
          <div className="px-2 pt-3">
            <MetricChart def={def} rows={rows} height={340} segmentKeys={keys} />
          </div>
          <div className="px-4 pb-2 pt-2">
            <ChartLegend def={def} rows={rows} segmentKeys={keys} />
          </div>
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-2 font-medium text-t4">Period</th>
                  {columns.map((c) => (
                    <th key={c.key} className="px-4 py-2 text-right font-medium text-t4">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...tableRows].reverse().map((r, i) => (
                  <tr key={i} className="border-b border-hairline">
                    <td className="px-4 py-1.5 text-t2">
                      {String(r.label ?? r.date)}
                      {r.estimate ? <span className="ml-1 text-t4">(consensus)</span> : null}
                    </td>
                    {columns.map((c) => (
                      <td key={c.key} className="tabular px-4 py-1.5 text-right text-t1">
                        {formatValue(r[c.key] as number, c.format)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Picker({
  selected,
  onChange,
  onClose,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const set = new Set(selected);
  const toggle = (id: string) => {
    // Keep catalog order, so the grid reads the same way every time.
    const next = set.has(id) ? selected.filter((x) => x !== id) : CHARTS.map((c) => c.id).filter((x) => set.has(x) || x === id);
    onChange(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose charts"
        className="panel flex max-h-[92vh] w-full max-w-3xl flex-col bg-surface pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-t1">Choose charts</h2>
            <p className="text-[11px] text-t3">
              {selected.length} of {CHARTS.length} shown · saved to your account
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={() => onChange(DEFAULT_CHART_IDS)}>
              Default
            </button>
            <button className="btn" onClick={() => onChange(CHARTS.map((c) => c.id))}>
              All
            </button>
            <button className="btn" onClick={() => onChange([])}>
              None
            </button>
            <button className="btn-primary px-4 py-1.5 text-[12px]" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
        <div className="grid gap-x-6 gap-y-5 overflow-y-auto px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <fieldset key={cat}>
              <legend className="eyebrow-muted mb-2">{cat}</legend>
              <div className="space-y-0.5">
                {CHARTS.filter((c) => c.category === cat).map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2.5 py-1.5 text-[13px] text-t2 hover:text-t1 sm:py-1">
                    <input type="checkbox" checked={set.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-gold" />
                    {c.title}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<{ key: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex border border-line" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${
            value === o.key ? 'bg-gold text-bg' : 'text-t3 hover:text-t1'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ChartGallery({ data }: { data: ChartData }) {
  const { period, setPeriod, range, setRange } = useView();
  const { ids, save } = useChartPrefs();
  const [picking, setPicking] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const years = RANGES.find((r) => r.key === range)?.years ?? 10;

  const selected = useMemo(() => ids.map((id) => chartById.get(id)).filter((c): c is ChartDef => Boolean(c)), [ids]);
  const expandedDef = expanded ? chartById.get(expanded) : undefined;

  return (
    <div className="space-y-3">
      {/* One row of controls scopes every chart below it. */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Period" options={PERIODS} value={period} onChange={setPeriod} />
        <Segmented label="Range" options={RANGES} value={range} onChange={setRange} />
        <button className="btn ml-auto py-2 sm:py-1.5" onClick={() => setPicking(true)}>
          Charts · {selected.length}
        </button>
      </div>

      {data.issues.length > 0 && (
        <p className="border border-dn/40 bg-dn/10 px-3 py-2 text-[11px] text-t3">
          Some feeds did not respond, so a few charts may be empty: {data.issues.join('; ')}
        </p>
      )}

      {selected.length === 0 ? (
        <div className="panel px-4 py-10 text-center text-[13px] text-t3">
          No charts selected.{' '}
          <button className="text-gold hover:underline" onClick={() => setPicking(true)}>
            Choose some
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {selected.map((def) => (
            <ChartCard
              key={def.id}
              def={def}
              data={data}
              period={period}
              years={years}
              onExpand={() => setExpanded(def.id)}
            />
          ))}
        </div>
      )}

      {picking && <Picker selected={ids} onChange={save} onClose={() => setPicking(false)} />}
      {expandedDef && (
        <Expanded def={expandedDef} data={data} period={period} years={years} onClose={() => setExpanded(null)} />
      )}
    </div>
  );
}
