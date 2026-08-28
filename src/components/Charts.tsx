'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { bigMoney, num } from '@/lib/format';

const AXIS = { stroke: '#8b93a5', fontSize: 11 };
const GRID = '#252b37';

const tooltipStyle = {
  contentStyle: {
    background: '#1b2029',
    border: '1px solid #252b37',
    borderRadius: 6,
    fontSize: 12,
  },
  labelStyle: { color: '#e6e9ef' },
};

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
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            {...tooltipStyle}
            formatter={(value: number, name: string) => [num(value), name]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#8b93a5' }} />
          <Bar dataKey="eps" name="Projected EPS" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              // Analyst-covered years are shown solid; extrapolated years are muted
              // so the eye can tell forecast from consensus.
              <Cell key={i} fill={d.source === 'analyst' ? '#5b8def' : '#38415a'} />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="presentValue"
            name="Discounted value/share"
            stroke="#2ec27e"
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
          <defs>
            <linearGradient id="cfFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5b8def" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#5b8def" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="pvFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2ec27e" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#2ec27e" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="year"
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            tickFormatter={(y) => `Y${y}`}
          />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={54} tickFormatter={(v) => bigMoney(v)} />
          <Tooltip {...tooltipStyle} formatter={(value: number, name: string) => [bigMoney(value), name]} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#8b93a5' }} />
          <Area
            type="monotone"
            dataKey="cashFlow"
            name="Forecast FCF"
            stroke="#5b8def"
            fill="url(#cfFill)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="presentValue"
            name="Present value"
            stroke="#2ec27e"
            fill="url(#pvFill)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Historical revenue with net income overlaid. */
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
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={54} tickFormatter={(v) => bigMoney(v)} />
          <Tooltip {...tooltipStyle} formatter={(value: number, name: string) => [bigMoney(value), name]} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#8b93a5' }} />
          <Bar dataKey="revenue" name="Revenue" fill="#38415a" radius={[3, 3, 0, 0]} />
          <Line type="monotone" dataKey="netIncome" name="Net income" stroke="#5b8def" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="freeCashFlow" name="Free cash flow" stroke="#2ec27e" strokeWidth={2} dot={false} />
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
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis type="category" dataKey="label" tick={AXIS} tickLine={false} axisLine={false} width={104} />
          <Tooltip {...tooltipStyle} formatter={(value: number) => [num(value), 'Fair value']} />
          <Bar dataKey="value" radius={[0, 3, 3, 0]}>
            {data.map((d, i) => (
              // Green where the model says the stock is worth more than it costs.
              <Cell key={i} fill={d.value >= price ? '#2ec27e' : '#f6685e'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
