import type { ReactNode } from 'react';
import { toneClass } from '@/lib/format';

export function Panel({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <h2 className="panel-title">{title}</h2>
        {subtitle ? <span className="panel-sub">{subtitle}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function Row({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: ReactNode;
  tone?: number | null;
  hint?: string;
}) {
  return (
    <div className="row">
      <span className="row-label" title={hint}>
        {label}
      </span>
      <span className={`row-value ${tone !== undefined ? toneClass(tone) : ''}`}>{value}</span>
    </div>
  );
}

export function Stat({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: ReactNode;
  tone?: number | null;
  sub?: ReactNode;
}) {
  return (
    <div className="px-4 py-3">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone !== undefined ? toneClass(tone) : ''}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-muted">{sub}</div> : null}
    </div>
  );
}

/** Horizontal bar showing where the current price sits inside a value range. */
export function RangeBar({
  low,
  high,
  marker,
  markerLabel,
}: {
  low: number;
  high: number;
  marker: number;
  markerLabel: string;
}) {
  const span = high - low;
  const positionPct = span > 0 ? ((marker - low) / span) * 100 : 50;
  const clamped = Math.min(100, Math.max(0, positionPct));
  // A price outside the modelled range is itself the signal, so say so.
  const outside = positionPct < 0 || positionPct > 100;

  return (
    <div className="px-4 py-3">
      <div className="relative h-2 rounded-full bg-gradient-to-r from-neg via-panel2 to-pos">
        <div
          className="absolute -top-1 h-4 w-0.5 bg-ink"
          style={{ left: `${clamped}%` }}
          aria-hidden
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>Bear</span>
        <span className={outside ? 'text-neg' : 'text-ink'}>
          {markerLabel}
          {outside ? ' (outside range)' : ''}
        </span>
        <span>Bull</span>
      </div>
    </div>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone: 'pos' | 'neg' | 'flat' }) {
  const styles = {
    pos: 'bg-pos/15 text-pos',
    neg: 'bg-neg/15 text-neg',
    flat: 'bg-line text-muted',
  }[tone];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${styles}`}>{children}</span>
  );
}
