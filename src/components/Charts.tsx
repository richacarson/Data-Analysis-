'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { bigMoney, num } from '@/lib/format';

/**
 * Chart colours are the validated Paradiem series pair: gold and periwinkle
 * clear colour-vision separation against the navy surface, a third hue does
 * not. Anything beyond two series is drawn as a recessive backdrop instead.
 */
const S1 = 'rgb(var(--s1))'; // gold
const S2 = 'rgb(var(--s2))'; // periwinkle
const BACKDROP = 'rgb(var(--elevated))';
const UP = 'rgb(var(--up))';
const DN = 'rgb(var(--dn))';

const GRID = 'var(--chart-grid)';
// Tick text is filled, not stroked: a stroke on glyphs smears them into a faux bold.
const AXIS = { fill: 'var(--chart-tick)', stroke: 'none', fontSize: 10, fontFamily: 'var(--font-plex-mono)' };

// Square-edged, flat — no shadow, matching the brand's print rules.
const tooltip = {
  contentStyle: {
    background: 'rgb(var(--card))',
    border: '1px solid var(--line-hover)',
    borderRadius: 0,
    fontSize: 12,
    fontFamily: 'var(--font-dm-sans)',
  },
  labelStyle: { color: 'rgb(var(--t1))', fontWeight: 600 },
  cursor: { fill: 'rgb(var(--gold) / 0.06)' },
};

const legend = { wrapperStyle: { fontSize: 11, color: 'rgb(var(--t3))', paddingTop: 4 } };

/** Projected EPS from analyst consensus, split into covered and faded years. */
export function EpsProjectionChart({
  data,
}: {
  data: Array<{ label: string; eps: number; source: string; presentValue: number }>;
}) {
  return (
    <div className="h-64 px-2 py-3">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} />
          <Tooltip {...tooltip} formatter={(v: number, n: string) => [num(v), n]} />
          <Legend {...legend} />
          <Bar dataKey="eps" name="Projected EPS" fill={S1} maxBarSize={38}>
            {data.map((d, i) => (
              // Analyst-covered years are solid gold; extrapolated years recede,
              // so the eye can tell consensus from our own assumption.
              <Cell key={i} fill={d.source === 'analyst' ? S1 : BACKDROP} />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="presentValue"
            name="Discounted value per share"
            stroke={S2}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Forecast free cash flow and its present value, year by year. */
export function CashFlowChart({
  data,
}: {
  data: Array<{ year: number; cashFlow: number; presentValue: number }>;
}) {
  return (
    <div className="h-64 px-2 py-3">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="year"
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            tickFormatter={(y) => `Y${y}`}
          />
          <YAxis
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v) => bigMoney(v)}
          />
          <Tooltip {...tooltip} formatter={(v: number, n: string) => [bigMoney(v), n]} />
          <Legend {...legend} />
          {/* Flat translucent fills — the brand system does not use gradients. */}
          <Area
            type="monotone"
            dataKey="cashFlow"
            name="Forecast free cash flow"
            stroke={S1}
            fill={S1}
            fillOpacity={0.14}
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="presentValue"
            name="Present value"
            stroke={S2}
            fill={S2}
            fillOpacity={0.14}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Reported revenue, with earnings and cash flow overlaid. */
export function HistoryChart({
  data,
}: {
  data: Array<{ year: string; revenue: number; netIncome: number; freeCashFlow: number }>;
}) {
  return (
    <div className="h-64 px-2 py-3">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="year" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v) => bigMoney(v)}
          />
          <Tooltip {...tooltip} formatter={(v: number, n: string) => [bigMoney(v), n]} />
          <Legend {...legend} />
          {/* Revenue is scale context for the two margins, so it recedes. */}
          <Bar dataKey="revenue" name="Revenue" fill={BACKDROP} maxBarSize={34} />
          <Line
            type="monotone"
            dataKey="netIncome"
            name="Net income"
            stroke={S1}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="freeCashFlow"
            name="Free cash flow"
            stroke={S2}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Fair value produced by each model, against the current price. */
export function ModelSpreadChart({
  data,
  price,
}: {
  data: Array<{ label: string; value: number }>;
  price: number;
}) {
  return (
    <div className="h-56 px-2 py-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 20, right: 20, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis
            type="number"
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            domain={[
              0,
              // Round the top out to a clean tick rather than showing 533.2824.
              (max: number) => {
                const top = Math.max(max, price) * 1.08;
                const step = Math.pow(10, Math.floor(Math.log10(top))) / 2;
                return Math.ceil(top / step) * step;
              },
            ]}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ ...AXIS, fontFamily: 'var(--font-dm-sans)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={104}
          />
          <Tooltip {...tooltip} formatter={(v: number) => [num(v), 'Fair value']} />
          {/* The price is the thing every model is being judged against, so it
              is drawn explicitly rather than left implicit in the colours. */}
          <ReferenceLine
            x={price}
            stroke="rgb(var(--t1))"
            strokeWidth={1}
            strokeDasharray="3 3"
            label={{
              value: 'Price',
              position: 'top',
              fill: 'rgb(var(--t3))',
              fontSize: 10,
            }}
          />
          <Bar dataKey="value" maxBarSize={26}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.value >= price ? UP : DN} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
