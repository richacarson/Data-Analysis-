'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { bigMoney, num, pct } from '@/lib/format';

const GRID = 'rgba(201,168,76,0.10)';
// Tick text is filled, not stroked: a stroke on glyphs smears them into a faux bold.
const AXIS = { fill: '#A09C94', stroke: 'none', fontSize: 10, fontFamily: 'var(--font-plex-mono)' };
const S1 = '#AE8E2F';
const S2 = '#5D82D8';
const UP = '#34D399';
const DN = '#F87171';

/**
 * Ordinal gold ramp for stacked composition, brightest first so the largest
 * segment is the most legible. Validated for monotone lightness, adjacent
 * separation, contrast and single hue against the navy surface.
 */
const RAMP = ['#E2D09E', '#CEB574', '#B99B47', '#A58100', '#8C6900', '#724F00'];

const tooltip = {
  contentStyle: {
    background: '#252551',
    border: '1px solid rgba(201,168,76,0.24)',
    borderRadius: 0,
    fontSize: 12,
    fontFamily: 'var(--font-dm-sans)',
  },
  labelStyle: { color: '#FAF7F2', fontWeight: 600 },
  cursor: { fill: 'rgba(201,168,76,0.06)' },
};
const legend = { wrapperStyle: { fontSize: 11, color: '#B8B4AC', paddingTop: 4 } };

/** Trailing-twelve-month margin, quarter by quarter. */
export function MarginTtmChart({
  data,
}: {
  data: Array<{ label: string; margin: number }>;
}) {
  return (
    <div className="h-72 px-2 py-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ ...AXIS, fontSize: 9 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            interval="preserveStartEnd"
            angle={-35}
            textAnchor="end"
            height={52}
          />
          <YAxis
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => pct(v, 0)}
          />
          <Tooltip {...tooltip} formatter={(v: number) => [pct(v), 'Net margin']} />
          <Bar dataKey="margin" maxBarSize={30}>
            {data.map((d, i) => (
              // Crossing into profit is the story; colour carries it.
              <Cell key={i} fill={d.margin >= 0 ? S1 : DN} />
            ))}
            {/* Only the latest quarter is labelled. A number on every bar is
                noise; the current level is the figure people quote. */}
            <LabelList
              dataKey="margin"
              position="top"
              content={(props) => {
                const { x, y, width, index, value } = props as {
                  x: number; y: number; width: number; index: number; value: number;
                };
                if (index !== data.length - 1) return null;
                return (
                  <text
                    x={x + width / 2}
                    y={y - 6}
                    textAnchor="middle"
                    fill="#FAF7F2"
                    fontSize={12}
                    fontWeight={600}
                    fontFamily="var(--font-plex-mono)"
                  >
                    {pct(value)}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Reported EPS, then consensus. Estimates are hatched so they read as forecast. */
export function EpsHistoryChart({
  data,
}: {
  data: Array<{ year: string; eps: number; actual: boolean }>;
}) {
  return (
    <div className="h-72 px-2 py-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 12, left: 4, bottom: 4 }}>
          <defs>
            <pattern id="epsForecast" patternUnits="userSpaceOnUse" width={6} height={6}>
              <rect width={6} height={6} fill="#171738" />
              <path d="M0,6 l6,-6 M-1.5,1.5 l3,-3 M4.5,7.5 l3,-3" stroke={S1} strokeWidth={1.6} />
            </pattern>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="year" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            {...tooltip}
            formatter={(v: number, _n, p) => [
              num(v),
              (p?.payload as { actual?: boolean })?.actual ? 'Reported' : 'Consensus',
            ]}
          />
          <Bar dataKey="eps" maxBarSize={44}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.actual ? S1 : 'url(#epsForecast)'} stroke={d.actual ? undefined : S1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Revenue by segment, stacked. */
export function SegmentChart({
  points,
  segments,
}: {
  points: Array<Record<string, string | number>>;
  segments: string[];
}) {
  return (
    <div className="h-80 px-2 py-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="year" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={54}
            tickFormatter={(v) => bigMoney(v)}
          />
          <Tooltip {...tooltip} formatter={(v: number, n: string) => [bigMoney(v), n]} />
          <Legend {...legend} />
          {segments.map((s, i) => (
            <Bar
              key={s}
              dataKey={s}
              stackId="revenue"
              fill={RAMP[i % RAMP.length]}
              maxBarSize={46}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Price against a fundamental, both rebased to 100.
 *
 * The familiar version of this chart puts the two on separate axes, where the
 * apparent relationship depends entirely on the ranges chosen. Rebasing makes
 * the divergence itself the subject and cannot be tuned to flatter.
 */
export function IndexedChart({
  data,
  fundamentalLabel,
}: {
  data: Array<{ year: string; price: number; fundamental: number }>;
  fundamentalLabel: string;
}) {
  return (
    <div className="h-72 px-2 py-3">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="year" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => String(Math.round(v))}
          />
          <Tooltip
            {...tooltip}
            formatter={(v: number, n: string) => [`${Math.round(v)} (start = 100)`, n]}
          />
          <Legend {...legend} />
          <Area
            type="monotone"
            dataKey="fundamental"
            name={fundamentalLabel}
            stroke={S1}
            fill={S1}
            fillOpacity={0.12}
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="price"
            name="Share price"
            stroke={S2}
            fill={S2}
            fillOpacity={0.12}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
