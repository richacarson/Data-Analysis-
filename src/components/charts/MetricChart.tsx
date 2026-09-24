'use client';

import { useId } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartDef, ValueFormat } from '@/lib/charts/catalog';
import { formatTick, formatValue } from '@/lib/charts/format';
import { OTHER } from '@/lib/charts/segments';

export type ChartRow = Record<string, string | number | boolean | null | undefined>;

// Brand chart tokens, validated against the navy surface: two hues, plus a
// recessive backdrop. A third series is carried by a dashed neutral line, so
// identity never rests on a hue the palette cannot separate.
export const S1 = '#AE8E2F';
export const S2 = '#5D82D8';
const NEUTRAL = '#B8B4AC';
const BACKDROP = '#38386B';
const SURFACE = '#1F1F45';
const GRID = 'rgba(201,168,76,0.08)';
const AXIS = { fill: '#A09C94', stroke: 'none', fontSize: 10, fontFamily: 'var(--font-plex-mono)' };
/** Ordinal gold ramp for composition, largest segment brightest. */
const RAMP = ['#E2D09E', '#CEB574', '#B99B47', '#A58100', '#8C6900'];

export function seriesColor(def: ChartDef, index: number, key: string): string {
  if (def.kind === 'segments') return key === OTHER ? BACKDROP : RAMP[index % RAMP.length];
  return [S1, S2, NEUTRAL][index] ?? NEUTRAL;
}

function ReadoutRow({ color, dashed, label, value }: { color: string; dashed?: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-t3">
        <svg width="12" height="4" aria-hidden>
          <line x1="0" y1="2" x2="12" y2="2" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '3 2' : undefined} />
        </svg>
        {label}
      </span>
      <span className="tabular font-semibold text-t1">{value}</span>
    </div>
  );
}

/** One readout for every series at the hovered period, overlay included. */
function Readout({
  active,
  payload,
  def,
  keys,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
  def: ChartDef;
  keys: Array<{ key: string; label: string }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const estimate = Boolean(row.estimate);
  return (
    <div className="min-w-[160px] border border-lineHover bg-card px-3 py-2 text-[11px] shadow-lg">
      <p className="mb-1.5 font-semibold text-t1">
        {String(row.label ?? row.date ?? '')}
        {estimate && (
          <span className="ml-1.5 font-normal text-t3">
            consensus{typeof row.analysts === 'number' ? ` · ${row.analysts} analysts` : ''}
          </span>
        )}
      </p>
      <div className="space-y-1">
        {keys.map((s, i) => (
          <ReadoutRow
            key={s.key}
            color={seriesColor(def, i, s.key)}
            dashed={def.kind === 'line' && i === 2}
            label={s.label}
            value={formatValue(row[s.key] as number, def.format)}
          />
        ))}
        {def.overlay && !estimate && (
          <ReadoutRow
            color={S2}
            label={def.overlay.label}
            value={formatValue(row[def.overlay.key] as number, def.overlay.format)}
          />
        )}
      </div>
    </div>
  );
}

function hasData(rows: ChartRow[], key: string) {
  return rows.some((r) => typeof r[key] === 'number');
}

export function MetricChart({
  def,
  rows,
  height,
  segmentKeys = [],
  compactAxes = false,
}: {
  def: ChartDef;
  rows: ChartRow[];
  height: number;
  segmentKeys?: string[];
  compactAxes?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const hatch = `hatch-${uid}`;
  const syncId = `sync-${uid}`;

  const keys =
    def.kind === 'segments'
      ? segmentKeys.map((k) => ({ key: k, label: k }))
      : def.series.filter((s) => hasData(rows, s.key));

  if (!keys.length || !rows.length) {
    return (
      <div className="flex items-center justify-center text-[11px] text-t4" style={{ height }}>
        Not reported for this company
      </div>
    );
  }

  const overlay = def.overlay && hasData(rows, def.overlay.key) ? def.overlay : null;
  const stripHeight = overlay ? Math.round(height * 0.26) : 0;
  const mainHeight = height - stripHeight;
  const xKey = def.kind === 'price' ? 'date' : 'label';
  const yWidth = compactAxes ? 40 : 48;
  const anyNegative = keys.some((s) => rows.some((r) => typeof r[s.key] === 'number' && (r[s.key] as number) < 0));

  const tick = (fmt: ValueFormat) => (v: number) => formatTick(v, fmt);

  // Price runs weekly: tick the first week of each year, thinned on long spans.
  let priceTicks: string[] | undefined;
  if (def.kind === 'price') {
    const starts = rows.filter((r, i) => i === 0 || String(r.date).slice(0, 4) !== String(rows[i - 1].date).slice(0, 4)).map((r) => String(r.date));
    const step = Math.ceil(starts.length / (compactAxes ? 6 : 10));
    priceTicks = starts.filter((_, i) => i % step === 0);
  }
  // Quarterly and TTM views: one tick per fiscal year, at its first quarter.
  let quarterTicks: string[] | undefined;
  if (def.kind !== 'price' && rows.some((r) => /^Q[1-4]$/.test(String(r.period)))) {
    const firsts = rows.filter((r) => r.period === 'Q1').map((r) => String(r.label));
    const step = Math.ceil(firsts.length / (compactAxes ? 6 : 10));
    quarterTicks = firsts.filter((_, i) => i % step === 0);
  }
  const xTicks = priceTicks ?? quarterTicks;
  const xTick =
    def.kind === 'price'
      ? (d: string) => String(d).slice(0, 4)
      : quarterTicks
        ? (l: string) => `FY${String(l).slice(-2)}`
        : undefined;

  // The strip carries only its range: low and high, so the scale is readable
  // without competing with the main axis.
  let stripTicks: number[] | undefined;
  if (overlay) {
    const values = rows.map((r) => r[overlay.key]).filter((v): v is number => typeof v === 'number');
    stripTicks = values.length ? [Math.min(...values), Math.max(...values)] : undefined;
  }

  const readout = <Tooltip content={<Readout def={def} keys={keys} />} cursor={{ fill: 'rgba(201,168,76,0.06)', stroke: 'rgba(201,168,76,0.3)' }} isAnimationActive={false} />;

  return (
    <div style={{ height }}>
      {overlay && (
        <div style={{ height: stripHeight }} className="border-b border-dashed border-hairline">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} syncId={syncId} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <XAxis dataKey={xKey} hide />
              <YAxis
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                width={yWidth}
                ticks={stripTicks}
                domain={['dataMin', 'dataMax']}
                tickFormatter={tick(overlay.format)}
              />
              <Tooltip content={() => null} cursor={{ stroke: 'rgba(201,168,76,0.3)' }} />
              {/* Invisible columns give the strip the same banded x-scale as the
                  bars below, so each point sits over its own bar. */}
              <Bar dataKey={overlay.key} fill="transparent" maxBarSize={24} isAnimationActive={false} />
              <Line
                dataKey={overlay.key}
                stroke={S2}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: S2, stroke: SURFACE, strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      <div style={{ height: mainHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            syncId={overlay ? syncId : undefined}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            barCategoryGap="18%"
            barGap={2}
          >
            <defs>
              <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="5" height="5" fill={S1} fillOpacity={0.18} />
                <line x1="0" y1="0" x2="0" y2="5" stroke={S1} strokeWidth="2" />
              </pattern>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey={xKey}
              tick={AXIS}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              minTickGap={compactAxes ? 14 : 10}
              tickFormatter={xTick}
              ticks={xTicks}
              interval={xTicks ? 0 : 'preserveStartEnd'}
            />
            <YAxis
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              width={yWidth}
              tickCount={4}
              tickFormatter={tick(def.format)}
              domain={def.kind === 'line' || def.kind === 'price' ? ['auto', 'auto'] : [anyNegative ? 'auto' : 0, 'auto']}
            />
            {anyNegative && <ReferenceLine y={0} stroke="rgba(250,247,242,0.25)" />}
            {readout}

            {def.kind === 'price' && (
              <Area
                dataKey="price"
                stroke={S1}
                strokeWidth={2}
                fill={S1}
                fillOpacity={0.1}
                dot={false}
                activeDot={{ r: 4, fill: S1, stroke: SURFACE, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            )}

            {def.kind === 'line' &&
              keys.map((s, i) => (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  stroke={seriesColor(def, i, s.key)}
                  strokeWidth={2}
                  strokeDasharray={i === 2 ? '5 3' : undefined}
                  dot={false}
                  activeDot={{ r: 4, fill: seriesColor(def, i, s.key), stroke: SURFACE, strokeWidth: 2 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}

            {(def.kind === 'bar' || def.kind === 'group') &&
              keys.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  fill={seriesColor(def, i, s.key)}
                  maxBarSize={24}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                >
                  {def.kind === 'bar' &&
                    rows.map((r, j) => (
                      <Cell key={j} fill={r.estimate ? `url(#${hatch})` : seriesColor(def, i, s.key)} />
                    ))}
                </Bar>
              ))}

            {(def.kind === 'stack' || def.kind === 'segments') &&
              keys.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  stackId="stack"
                  fill={seriesColor(def, i, s.key)}
                  stroke={SURFACE}
                  strokeWidth={1}
                  maxBarSize={28}
                  radius={i === keys.length - 1 ? [3, 3, 0, 0] : 0}
                  isAnimationActive={false}
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** The colour key: a swatch for bars, a line key for lines. Shown for two or more series. */
export function ChartLegend({ def, segmentKeys = [], rows }: { def: ChartDef; segmentKeys?: string[]; rows: ChartRow[] }) {
  const keys =
    def.kind === 'segments'
      ? segmentKeys.map((k) => ({ key: k, label: k }))
      : def.series.filter((s) => hasData(rows, s.key));
  const overlay = def.overlay && hasData(rows, def.overlay.key) ? def.overlay : null;
  const isLine = def.kind === 'line';
  if (keys.length < 2 && !overlay) return null;

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-t3">
      {keys.length >= 2 &&
        keys.map((s, i) => (
          <span key={s.key} className="flex items-center gap-1.5">
            {isLine ? (
              <svg width="12" height="4" aria-hidden>
                <line x1="0" y1="2" x2="12" y2="2" stroke={seriesColor(def, i, s.key)} strokeWidth="2" strokeDasharray={i === 2 ? '3 2' : undefined} />
              </svg>
            ) : (
              <span className="h-2 w-2" style={{ background: seriesColor(def, i, s.key) }} aria-hidden />
            )}
            {s.label}
          </span>
        ))}
      {overlay && (
        <span className="flex items-center gap-1.5">
          <svg width="12" height="4" aria-hidden>
            <line x1="0" y1="2" x2="12" y2="2" stroke={S2} strokeWidth="2" />
          </svg>
          {overlay.label} (above)
        </span>
      )}
    </div>
  );
}
