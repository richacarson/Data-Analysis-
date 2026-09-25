'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ChartDef, ValueFormat } from '@/lib/charts/catalog';
import { formatTick, formatValue } from '@/lib/charts/format';
import { OTHER } from '@/lib/charts/segments';
import { CONTINUOUS_KEYS, type WeeklyPoint } from '@/lib/charts/rows';

export type ChartRow = Record<string, string | number | boolean | null | undefined>;

/*
 * Drawn directly in SVG rather than through a charting library, so the
 * details a reader actually uses — the price line running over the bars, the
 * first and last values called out, a crosshair that reads every series at
 * once — are exact rather than approximated.
 *
 * Brand tokens validated against the navy surface: gold columns, periwinkle
 * overlay, a dashed neutral for a third line, a gold ramp for composition.
 */
export const S1 = '#AE8E2F';
export const S2 = '#5D82D8';
const NEUTRAL = '#B8B4AC';
const BACKDROP = '#38386B';
const SURFACE = '#1F1F45';
const GRID = 'rgba(201,168,76,0.09)';
const TICK = '#A09C94';
const RAMP = ['#E2D09E', '#CEB574', '#B99B47', '#A58100', '#8C6900'];

const CONTINUOUS = new Set<string>(CONTINUOUS_KEYS);
const DAY = 86_400_000;

export function seriesColor(def: ChartDef, index: number, key: string): string {
  if (def.kind === 'segments') return key === OTHER ? BACKDROP : RAMP[index % RAMP.length];
  return [S1, S2, NEUTRAL][index] ?? NEUTRAL;
}

const toT = (date: unknown) => Date.parse(`${String(date).slice(0, 10)}T00:00:00Z`);

/** Round-number ticks spanning [min, max]. */
function niceTicks(min: number, max: number, count: number): number[] {
  if (!(max > min)) {
    const pad = Math.abs(max) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

interface Line {
  key: string;
  label: string;
  color: string;
  format: ValueFormat;
  axis: 'left' | 'right';
  points: Array<{ t: number; v: number; label?: string; est?: boolean }>;
  dashed?: boolean;
  area?: boolean;
  continuous: boolean;
}

interface Spec {
  bars: Array<{ key: string; label: string; color: string }>;
  mode: 'single' | 'stack' | 'group';
  rows: ChartRow[];
  lines: Line[];
  leftFormat: ValueFormat;
  rightFormat: ValueFormat | null;
  average: number | null;
}

function hasData(rows: ChartRow[], key: string) {
  return rows.some((r) => typeof r[key] === 'number');
}

function weeklyLine(
  weekly: WeeklyPoint[],
  key: string,
  from: number,
  to: number,
): Array<{ t: number; v: number }> {
  const out: Array<{ t: number; v: number }> = [];
  for (const p of weekly) {
    const v = (p as Record<string, unknown>)[key];
    const t = toT(p.date);
    if (typeof v === 'number' && t >= from && t <= to) out.push({ t, v });
  }
  return out;
}

/**
 * How far before the first column a weekly overlay starts: a full period, so
 * the line runs in from the left axis rather than beginning mid-column. The
 * clip path trims whatever falls outside the plot.
 */
function overlayLead(rows: ChartRow[]): number {
  if (rows.length < 2) return 366 * DAY;
  return Math.max(60 * DAY, toT(rows[1].date) - toT(rows[0].date));
}

/** A line's latest value, short enough to sit in the axis gutter. */
function axisValue(v: number, fmt: ValueFormat): string {
  if (fmt === 'perShare') return Math.abs(v) >= 100 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`;
  if (fmt === 'multiple') return `${v.toFixed(1)}x`;
  if (fmt === 'pct') return `${(v * 100).toFixed(1)}%`;
  return formatTick(v, fmt);
}

/** Turns a catalog entry and the current rows into what gets drawn. */
function buildSpec(def: ChartDef, rows: ChartRow[], weekly: WeeklyPoint[], segmentKeys: string[]): Spec {
  const spec: Spec = { bars: [], mode: 'single', rows, lines: [], leftFormat: def.format, rightFormat: null, average: null };
  const firstT = rows.length ? toT(rows[0].date) : -Infinity;

  if (def.kind === 'price' || (def.kind === 'line' && def.series.length === 1 && CONTINUOUS.has(def.series[0].key))) {
    // Continuous series over the selected range, ending today.
    const key = def.kind === 'price' ? 'price' : def.series[0].key;
    const from = rows.length ? toT(rows[0].date) : -Infinity;
    const points = weeklyLine(weekly, key, from, Infinity);
    spec.lines.push({ key, label: def.series[0].label, color: S1, format: def.format, axis: 'left', points, area: def.kind === 'price', continuous: true });
    if (def.kind === 'line' && key !== 'marketCap' && points.length) {
      spec.average = points.reduce((a, p) => a + p.v, 0) / points.length;
    }
    return spec;
  }

  if (def.kind === 'line') {
    def.series
      .filter((s) => hasData(rows, s.key))
      .forEach((s, i) =>
        spec.lines.push({
          key: s.key,
          label: s.label,
          color: seriesColor(def, i, s.key),
          format: def.format,
          axis: 'left',
          dashed: i === 2,
          continuous: false,
          points: rows
            .filter((r) => typeof r[s.key] === 'number')
            .map((r) => ({ t: toT(r.date), v: r[s.key] as number, label: String(r.label), est: Boolean(r.estimate) })),
        }),
      );
    return spec;
  }

  const keys =
    def.kind === 'segments' ? segmentKeys.map((k) => ({ key: k, label: k })) : def.series.filter((s) => hasData(rows, s.key));
  spec.bars = keys.map((s, i) => ({ ...s, color: seriesColor(def, i, s.key) }));
  spec.mode = def.kind === 'stack' || def.kind === 'segments' ? 'stack' : def.kind === 'group' ? 'group' : 'single';

  if (def.overlay) {
    const o = def.overlay;
    const continuous = CONTINUOUS.has(o.key);
    // Estimates have no price; the line runs through the reported periods to today.
    // Weekly lines stop at today; period lines carry on into consensus where
    // it exists (a margin on consensus revenue and profit, say).
    const points = continuous
      ? weeklyLine(weekly, o.key, firstT - overlayLead(rows), Infinity)
      : rows.filter((r) => typeof r[o.key] === 'number').map((r) => ({ t: toT(r.date), v: r[o.key] as number, label: String(r.label), est: Boolean(r.estimate) }));
    if (points.length > 1) {
      spec.lines.push({ key: o.key, label: o.label, color: S2, format: o.format, axis: 'right', points, continuous });
      spec.rightFormat = o.format;
    }
  }
  return spec;
}

/** A value called out on the chart: a filled tag, legible on either series colour. */
function Tag({ x, y, text, color, anchor }: { x: number; y: number; text: string; color: string; anchor: 'start' | 'end' | 'middle' }) {
  const w = text.length * 6 + 10;
  const left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  const ink = color === S2 ? '#FFFFFF' : '#171738';
  return (
    <g pointerEvents="none">
      <rect x={left} y={y - 8} width={w} height={16} rx={2} fill={color} />
      <text x={left + w / 2} y={y + 3.5} textAnchor="middle" fontSize={10} fontWeight={600} fill={ink} fontFamily="var(--font-plex-mono)">
        {text}
      </text>
    </g>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

function formatDate(t: number) {
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function MetricChart({
  def,
  rows,
  weekly,
  height,
  segmentKeys = [],
  compact = false,
}: {
  def: ChartDef;
  rows: ChartRow[];
  weekly: WeeklyPoint[];
  height: number;
  segmentKeys?: string[];
  compact?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const spec = useMemo(() => buildSpec(def, rows, weekly, segmentKeys), [def, rows, weekly, segmentKeys]);
  const empty = !spec.bars.length && !spec.lines.some((l) => l.points.length);

  const hasRight = spec.lines.some((l) => l.axis === 'right');
  const legendItems = [
    ...(spec.bars.length > 1 || hasRight ? spec.bars.map((b) => ({ label: b.label, color: b.color, kind: 'bar' as const })) : []),
    ...(spec.lines.length > 1 || hasRight
      ? spec.lines.map((l) => ({ label: l.axis === 'right' ? `${l.label} (right axis)` : l.label, color: l.color, kind: 'line' as const, dashed: l.dashed }))
      : []),
  ];

  const legend = legendItems.length ? (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pb-1.5 text-[10px] text-t3">
      {legendItems.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          {it.kind === 'bar' ? (
            <span className="h-2 w-2" style={{ background: it.color }} aria-hidden />
          ) : (
            <svg width="12" height="4" aria-hidden>
              <line x1="0" y1="2" x2="12" y2="2" stroke={it.color} strokeWidth="2" strokeDasharray={it.dashed ? '3 2' : undefined} />
            </svg>
          )}
          {it.label}
        </span>
      ))}
    </div>
  ) : null;

  if (empty) {
    return (
      <div className="flex items-center justify-center text-[11px] text-t4" style={{ height }}>
        Not reported for this company
      </div>
    );
  }

  const legendH = legend ? 20 : 0;
  const plotH = height - legendH;
  const m = { top: 14, right: hasRight ? (compact ? 50 : 58) : 10, bottom: 20, left: compact ? 42 : 52 };
  const innerW = Math.max(10, width - m.left - m.right);
  const innerH = Math.max(10, plotH - m.top - m.bottom);

  // ---- x: time ----------------------------------------------------------
  const barTs = spec.rows.map((r) => toT(r.date));
  const gaps = barTs.slice(1).map((t, i) => t - barTs[i]).sort((a, b) => a - b);
  const period = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 365 * DAY;
  const lineTs = spec.lines.flatMap((l) => l.points.map((p) => p.t));
  let t0 = Math.min(...(spec.bars.length ? barTs.map((t) => t - period / 2) : []), ...lineTs);
  let t1 = Math.max(...(spec.bars.length ? barTs.map((t) => t + period / 2) : []), ...lineTs);
  if (!(t1 > t0)) {
    t0 -= DAY;
    t1 += DAY;
  }
  const x = (t: number) => m.left + ((t - t0) / (t1 - t0)) * innerW;
  const slotPx = spec.bars.length ? (period / (t1 - t0)) * innerW : 0;
  const barW = Math.max(2, Math.min(slotPx * 0.72, 40));

  // ---- y: left (bars or primary lines), right (overlay) -----------------
  const leftVals: number[] = [];
  for (const r of spec.rows) {
    if (!spec.bars.length) break;
    if (spec.mode === 'stack') {
      let pos = 0;
      let neg = 0;
      for (const b of spec.bars) {
        const v = r[b.key];
        if (typeof v === 'number') v >= 0 ? (pos += v) : (neg += v);
      }
      leftVals.push(pos, neg);
    } else {
      for (const b of spec.bars) if (typeof r[b.key] === 'number') leftVals.push(r[b.key] as number);
    }
  }
  for (const l of spec.lines) if (l.axis === 'left') for (const p of l.points) leftVals.push(p.v);
  const leftTicks = niceTicks(Math.min(0, ...leftVals), Math.max(0, ...leftVals), compact ? 4 : 5);
  const rightVals = spec.lines.filter((l) => l.axis === 'right').flatMap((l) => l.points.map((p) => p.v));
  const rightTicks = hasRight ? niceTicks(Math.min(0, ...rightVals), Math.max(0, ...rightVals), leftTicks.length - 1) : [];

  const scale = (ticks: number[]) => {
    const lo = ticks[0];
    const hi = ticks[ticks.length - 1];
    return (v: number) => m.top + innerH - ((v - lo) / (hi - lo || 1)) * innerH;
  };
  const yL = scale(leftTicks);
  const yR = hasRight ? scale(rightTicks) : yL;
  const yOf = (l: Line) => (l.axis === 'right' ? yR : yL);

  // ---- x ticks ----------------------------------------------------------
  const maxLabels = Math.max(2, Math.floor(innerW / (compact ? 52 : 64)));
  let xTicks: Array<{ t: number; label: string }>;
  if (spec.bars.length) {
    const step = Math.ceil(spec.rows.length / maxLabels);
    const lastIdx = spec.rows.length - 1;
    xTicks = spec.rows
      .map((r, i) => ({ t: toT(r.date), label: String(r.label), i }))
      .filter(({ i }) => (lastIdx - i) % step === 0);
  } else {
    const years = (t1 - t0) / (365.25 * DAY);
    const everyYears = years > 12 ? 4 : years > 7 ? 2 : 1;
    xTicks = [];
    const startYear = new Date(t0).getUTCFullYear() + 1;
    for (let yv = startYear; Date.UTC(yv, 0, 1) <= t1; yv += everyYears) {
      xTicks.push({ t: Date.UTC(yv, 0, 1), label: String(yv) });
    }
    if (years < 2.5) {
      xTicks = [];
      const d = new Date(t0);
      let mo = d.getUTCMonth() + 1 - ((d.getUTCMonth() + 1) % 3) + 3;
      let yv = d.getUTCFullYear();
      for (;;) {
        if (mo > 11) {
          mo -= 12;
          yv += 1;
        }
        const t = Date.UTC(yv, mo, 1);
        if (t > t1) break;
        xTicks.push({ t, label: new Date(t).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace(' ', " '") });
        mo += years < 1.2 ? 3 : 6;
      }
    }
  }

  // ---- hover ------------------------------------------------------------
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - box.left;
    setHover(t0 + ((px - m.left) / innerW) * (t1 - t0));
  };
  let hoverBar: ChartRow | null = null;
  let hoverX: number | null = null;
  if (hover !== null && spec.bars.length) {
    let best = -1;
    let bestD = Infinity;
    barTs.forEach((t, i) => {
      const d = Math.abs(t - hover);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) {
      hoverBar = spec.rows[best];
      hoverX = x(barTs[best]);
    }
  }
  const nearest = (l: Line, t: number) => {
    let lo = 0;
    let hi = l.points.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (l.points[mid].t < t) lo = mid;
      else hi = mid;
    }
    return Math.abs(l.points[lo].t - t) <= Math.abs(l.points[hi].t - t) ? l.points[lo] : l.points[hi];
  };
  const hoverT = hoverBar ? barTs[spec.rows.indexOf(hoverBar)] : hover;
  const hoverLines =
    hoverT !== null
      ? spec.lines.filter((l) => l.points.length).map((l) => {
          // Continuous overlays read at the cursor; period lines at the period.
          const p = nearest(l, l.continuous && hover !== null ? hover : hoverT);
          return { l, p };
        })
      : [];
  if (hover !== null && !spec.bars.length && hoverLines[0]) hoverX = x(hoverLines[0].p.t);

  // ---- marks ------------------------------------------------------------
  const zero = yL(0);
  const bars: React.ReactNode[] = [];
  spec.rows.forEach((r, i) => {
    const cx = x(barTs[i]);
    const active = hoverBar === r;
    if (spec.mode === 'stack') {
      let pos = 0;
      let neg = 0;
      spec.bars.forEach((b, k) => {
        const v = r[b.key];
        if (typeof v !== 'number' || v === 0) return;
        const base = v >= 0 ? pos : neg;
        const top = base + v;
        if (v >= 0) pos = top;
        else neg = top;
        const y1 = yL(Math.max(base, top));
        const y2 = yL(Math.min(base, top));
        bars.push(
          <rect key={`${i}-${k}`} x={cx - barW / 2} y={y1} width={barW} height={Math.max(0.5, y2 - y1 - 1)} fill={b.color} opacity={hoverBar && !active ? 0.55 : 1} />,
        );
      });
    } else {
      const n = spec.mode === 'group' ? spec.bars.length : 1;
      const w = spec.mode === 'group' ? (barW - (n - 1) * 2) / n : barW;
      spec.bars.forEach((b, k) => {
        const v = r[b.key];
        if (typeof v !== 'number') return;
        const left = cx - barW / 2 + k * (w + 2);
        const y1 = Math.min(yL(v), zero);
        const h = Math.max(0.5, Math.abs(yL(v) - zero));
        bars.push(
          <rect
            key={`${i}-${k}`}
            x={left}
            y={y1}
            width={w}
            height={h}
            rx={Math.min(2, w / 4)}
            fill={r.estimate ? `url(#hatch-${uid})` : b.color}
            opacity={hoverBar && !active ? 0.55 : 1}
          />,
        );
      });
    }
  });

  const paths = spec.lines.map((l) => {
    const y = yOf(l);
    const seg = (pts: Line['points']) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
    // Reported history solid; consensus continues from the last reported
    // point, dashed, so the forecast is never mistaken for a result.
    const firstEst = l.points.findIndex((p) => p.est);
    const actual = firstEst < 0 ? l.points : l.points.slice(0, firstEst);
    const forecast = firstEst < 0 ? [] : l.points.slice(Math.max(0, firstEst - 1));
    const d = seg(actual);
    const area =
      l.area && l.points.length
        ? `${d}L${x(l.points[l.points.length - 1].t).toFixed(1)},${(m.top + innerH).toFixed(1)}L${x(l.points[0].t).toFixed(1)},${(m.top + innerH).toFixed(1)}Z`
        : null;
    return (
      <g key={l.key}>
        {area && <path d={area} fill={l.color} opacity={0.1} />}
        <path d={d} fill="none" stroke={l.color} strokeWidth={l.continuous ? 1.6 : 2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={l.dashed ? '5 3' : undefined} />
        {forecast.length > 1 && (
          <path d={seg(forecast)} fill="none" stroke={l.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="2 4" opacity={0.85} />
        )}
        {!l.continuous && l.points.length <= 16 && l.points.map((p) => <circle key={p.t} cx={x(p.t)} cy={y(p.v)} r={2.5} fill={p.est ? SURFACE : l.color} stroke={p.est ? l.color : SURFACE} strokeWidth={1.5} />)}
      </g>
    );
  });

  // First and last values, the Qualtrim way: where the story starts and ends.
  type TagSpec = { key: string; x: number; y: number; text: string; color: string; anchor: 'start' | 'end' | 'middle' };
  const tagSpecs: TagSpec[] = [];
  const primaryBar = spec.bars.length && spec.mode === 'single' ? spec.bars[0] : null;
  if (primaryBar) {
    const reported = spec.rows.map((r, i) => ({ r, i })).filter(({ r }) => !r.estimate && typeof r[primaryBar.key] === 'number');
    const first = reported[0];
    const last = reported[reported.length - 1];
    const forecasts = spec.rows.map((r, i) => ({ r, i })).filter(({ r }) => r.estimate && typeof r[primaryBar.key] === 'number');
    const furthest = forecasts[forecasts.length - 1];
    if (furthest) {
      const v = furthest.r[primaryBar.key] as number;
      tagSpecs.push({
        key: `bar-est-${furthest.i}`,
        x: x(barTs[furthest.i]) + barW / 2,
        y: Math.max(m.top + 8, Math.min(yL(v), zero) - 11),
        text: `${formatValue(v, spec.leftFormat).replace('.00', '')}E`,
        color: '#8C6900',
        anchor: 'end',
      });
    }
    for (const pt of [first, last].filter(Boolean)) {
      if (!pt || (pt === first && reported.length < 2)) continue;
      const v = pt.r[primaryBar.key] as number;
      const yy = Math.max(m.top + 8, Math.min(yL(v), zero) - 11);
      const xx = x(barTs[pt.i]);
      tagSpecs.push({ key: `bar-${pt.i}`, x: xx, y: yy, text: formatValue(v, spec.leftFormat).replace('.00', ''), color: primaryBar.color, anchor: pt === first ? 'start' : 'end' });
    }
  }
  // An overlay's latest value sits on its axis, like a live-price marker,
  // instead of on top of the columns.
  const axisMarks: Array<{ key: string; y: number; text: string; color: string }> = [];
  for (const l of spec.lines) {
    if (l.axis !== 'right' || !l.points.length) continue;
    const last = l.points[l.points.length - 1];
    axisMarks.push({
      key: l.key,
      y: Math.max(m.top + 7, Math.min(yR(last.v), m.top + innerH - 7)),
      text: `${axisValue(last.v, l.format)}${last.est ? 'E' : ''}`,
      color: l.color,
    });
  }
  for (const l of spec.lines) {
    if (l.axis === 'right') continue;
    if (l.points.length < 2 || l.dashed) continue;
    if (spec.lines.length > 2) break;
    const y = yOf(l);
    const a = l.points[0];
    const reportedPts = l.points.filter((p) => !p.est);
    const b = reportedPts[reportedPts.length - 1] ?? l.points[l.points.length - 1];
    const lastEst = l.points[l.points.length - 1]?.est ? l.points[l.points.length - 1] : null;
    tagSpecs.push({ key: `${l.key}-end`, x: Math.min(x(b.t), m.left + innerW), y: Math.max(m.top + 8, Math.min(y(b.v), m.top + innerH - 8)), text: formatValue(b.v, l.format), color: l.color, anchor: 'end' });
    if (lastEst) {
      tagSpecs.push({ key: `${l.key}-est`, x: Math.min(x(lastEst.t), m.left + innerW), y: Math.max(m.top + 8, Math.min(y(lastEst.v) - 14, m.top + innerH - 8)), text: `${formatValue(lastEst.v, l.format)}E`, color: l.color, anchor: 'end' });
    }
    if (l.continuous || spec.lines.length === 1) {
      tagSpecs.push({ key: `${l.key}-start`, x: x(a.t), y: Math.max(m.top + 8, Math.min(y(a.v) - 12, m.top + innerH - 8)), text: formatValue(a.v, l.format), color: l.color, anchor: 'start' });
    }
  }
  // Tags at the same end of the chart and within a line of each other would
  // overlap; push the later one clear rather than hide either value.
  const placed: TagSpec[] = [];
  for (const t of tagSpecs) {
    const w = t.text.length * 6 + 10;
    const left = t.anchor === 'start' ? t.x : t.anchor === 'end' ? t.x - w : t.x - w / 2;
    for (const p of placed) {
      const pw = p.text.length * 6 + 10;
      const pl = p.anchor === 'start' ? p.x : p.anchor === 'end' ? p.x - pw : p.x - pw / 2;
      const overlapX = left < pl + pw && pl < left + w;
      if (overlapX && Math.abs(p.y - t.y) < 18) {
        t.y = p.y + (t.y >= p.y ? 18 : -18);
        if (t.y > m.top + innerH - 8) t.y = p.y - 18;
        if (t.y < m.top + 8) t.y = p.y + 18;
      }
    }
    placed.push(t);
  }
  const tags = placed.map((t) => <Tag key={t.key} x={t.x} y={t.y} text={t.text} color={t.color} anchor={t.anchor} />);

  const tooltipLeft = hoverX !== null ? (hoverX > width / 2 ? hoverX - 8 : hoverX + 8) : 0;

  return (
    <div>
      {legend}
      <div ref={ref} className="relative select-none" style={{ height: plotH, touchAction: 'pan-y' }}>
        {width > 0 && (
          <svg width={width} height={plotH} role="img" aria-label={def.title}>
            <defs>
              <pattern id={`hatch-${uid}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="5" height="5" fill={S1} fillOpacity={0.15} />
                <line x1="0" y1="0" x2="0" y2="5" stroke={S1} strokeWidth="2" />
              </pattern>
              <clipPath id={`clip-${uid}`}>
                <rect x={m.left} y={m.top - 2} width={innerW} height={innerH + 4} />
              </clipPath>
            </defs>

            {leftTicks.map((v) => (
              <g key={`l${v}`}>
                <line x1={m.left} x2={m.left + innerW} y1={yL(v)} y2={yL(v)} stroke={v === 0 && leftTicks[0] < 0 ? 'rgba(250,247,242,0.25)' : GRID} />
                <text x={m.left - 6} y={yL(v) + 3} textAnchor="end" fontSize={10} fill={TICK} fontFamily="var(--font-plex-mono)">
                  {formatTick(v, spec.leftFormat)}
                </text>
              </g>
            ))}
            {hasRight &&
              rightTicks
                // A tick the value marker would sit on is dropped, not overprinted.
                .filter((v) => !axisMarks.some((a) => Math.abs(a.y - yR(v)) < 12))
                .map((v) => (
                  <text key={`r${v}`} x={m.left + innerW + 6} y={yR(v) + 3} fontSize={10} fill={TICK} fontFamily="var(--font-plex-mono)">
                    {formatTick(v, spec.rightFormat!)}
                  </text>
                ))}
            {axisMarks.map((a) => {
              const w = Math.min(m.right - 2, a.text.length * 6 + 8);
              return (
                <g key={`axis-${a.key}`} pointerEvents="none">
                  <path d={`M${m.left + innerW},${a.y} l4,-7 h${w} v14 h-${w} z`} fill={a.color} />
                  <text x={m.left + innerW + 4 + w / 2} y={a.y + 3.5} textAnchor="middle" fontSize={10} fontWeight={600} fill="#FFFFFF" fontFamily="var(--font-plex-mono)">
                    {a.text}
                  </text>
                </g>
              );
            })}
            {xTicks.map((tk) => (
              <text key={tk.t} x={x(tk.t)} y={plotH - 5} textAnchor="middle" fontSize={10} fill={TICK} fontFamily="var(--font-plex-mono)">
                {tk.label}
              </text>
            ))}

            <g clipPath={`url(#clip-${uid})`}>
              {bars}
              {spec.average !== null && (
                <g>
                  <line x1={m.left} x2={m.left + innerW} y1={yL(spec.average)} y2={yL(spec.average)} stroke={NEUTRAL} strokeDasharray="4 4" strokeWidth={1} />
                </g>
              )}
              {paths}
            </g>
            {spec.average !== null && (
              <text x={m.left + innerW / 2} y={yL(spec.average) - 5} textAnchor="middle" fontSize={10} fill="#D6D2CA" stroke={SURFACE} strokeWidth={4} paintOrder="stroke" fontFamily="var(--font-plex-mono)">
                Average {formatValue(spec.average, spec.leftFormat)}
              </text>
            )}
            {tags}

            {hoverX !== null && <line x1={hoverX} x2={hoverX} y1={m.top} y2={m.top + innerH} stroke="rgba(250,247,242,0.35)" strokeWidth={1} />}
            {hoverLines.map(({ l, p }) => (
              <circle key={l.key} cx={x(p.t)} cy={yOf(l)(p.v)} r={4} fill={l.color} stroke={SURFACE} strokeWidth={2} />
            ))}

            <rect
              x={m.left}
              y={0}
              width={innerW}
              height={plotH}
              fill="transparent"
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
        )}

        {hoverX !== null && (hoverBar || hoverLines.length > 0) && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-[150px] border border-lineHover bg-card/95 px-2.5 py-2 text-[11px] shadow-lg"
            style={hoverX > width / 2 ? { right: width - tooltipLeft } : { left: tooltipLeft }}
          >
            <p className="mb-1 font-semibold text-t1">
              {hoverBar
                ? String(hoverBar.label)
                : hoverLines[0]
                  ? (hoverLines[0].p.label ?? formatDate(hoverLines[0].p.t)) + (hoverLines[0].p.est ? ' · consensus' : '')
                  : ''}
              {hoverBar?.estimate ? (
                <span className="ml-1.5 font-normal text-t3">
                  consensus{typeof hoverBar.analysts === 'number' ? ` · ${hoverBar.analysts} analysts` : ''}
                </span>
              ) : null}
            </p>
            {hoverBar &&
              spec.bars.map((b) => (
                <div key={b.key} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-t3">
                    <span className="h-2 w-2" style={{ background: b.color }} />
                    {b.label}
                  </span>
                  <span className="tabular font-semibold text-t1">{formatValue(hoverBar[b.key] as number, spec.leftFormat)}</span>
                </div>
              ))}
            {hoverLines.map(({ l, p }) => (
              <div key={l.key} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-t3">
                  <svg width="10" height="4" aria-hidden>
                    <line x1="0" y1="2" x2="10" y2="2" stroke={l.color} strokeWidth="2" strokeDasharray={l.dashed ? '3 2' : undefined} />
                  </svg>
                  {l.label}
                  {l.continuous && hoverBar ? <span className="text-t4">{formatDate(p.t).replace(/, \d{4}$/, '')}</span> : null}
                </span>
                <span className="tabular font-semibold text-t1">{formatValue(p.v, l.format)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
