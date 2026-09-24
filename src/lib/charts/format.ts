import type { ValueFormat } from './catalog';

function compactNumber(v: number, digits: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(digits)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(digits)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(digits)}K`;
  return `${sign}${abs.toFixed(digits)}`;
}

/** One decimal only where whole units would repeat a tick ($1B, $1B, $2B). */
function tickCompact(v: number): string {
  const abs = Math.abs(v);
  const unit = abs >= 1e12 ? 1e12 : abs >= 1e9 ? 1e9 : abs >= 1e6 ? 1e6 : abs >= 1e3 ? 1e3 : 1;
  return compactNumber(v, abs / unit < 10 && abs % unit !== 0 ? 1 : 0);
}

/** Axis ticks: short. */
export function formatTick(v: number, format: ValueFormat): string {
  if (!Number.isFinite(v)) return '';
  switch (format) {
    case 'money':
      return `${v < 0 ? '-' : ''}$${tickCompact(Math.abs(v))}`;
    case 'shares':
      return tickCompact(v);
    case 'perShare':
      return `${v < 0 ? '-' : ''}$${Math.abs(v) >= 100 ? Math.abs(v).toFixed(0) : Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 2)}`;
    case 'pct':
      return `${(v * 100).toFixed(Math.abs(v) < 0.1 && v !== 0 ? 1 : 0)}%`;
    case 'multiple':
      return `${v.toFixed(0)}x`;
    case 'ratio':
      return v.toFixed(1);
  }
}

/** Tooltips and tables: enough precision to read. */
export function formatValue(v: number | null | undefined, format: ValueFormat): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  switch (format) {
    case 'money':
      return `${v < 0 ? '-' : ''}$${compactNumber(Math.abs(v), 2)}`;
    case 'shares':
      return compactNumber(v, 2);
    case 'perShare':
      return `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`;
    case 'pct':
      return `${(v * 100).toFixed(1)}%`;
    case 'multiple':
      return `${v.toFixed(1)}x`;
    case 'ratio':
      return v.toFixed(2);
  }
}
