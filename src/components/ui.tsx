import type { ReactNode } from 'react';
import { toneClass } from '@/lib/format';

export function Panel({
  title,
  subtitle,
  eyebrow,
  children,
  className = '',
}: {
  title: string;
  subtitle?: ReactNode;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <div>
          {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
          <h2 className="panel-title">{title}</h2>
        </div>
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
    <div className="px-4 py-3.5">
      <div className="stat-label">{label}</div>
      <div className={`stat-value mt-1.5 ${tone !== undefined ? toneClass(tone) : ''}`}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-[11px] leading-snug text-t4">{sub}</div> : null}
    </div>
  );
}

/**
 * Where the current price sits inside a modelled value range.
 *
 * Drawn as discrete segments rather than a gradient — the brand system is flat,
 * and steps are easier to read against than a continuous wash.
 */
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

  const segments = ['bg-dn/55', 'bg-dn/30', 'bg-elevated', 'bg-up/30', 'bg-up/55'];

  return (
    <div className="px-4 py-3">
      <div className="relative flex h-1.5 gap-px">
        {segments.map((tone, i) => (
          <div key={i} className={`flex-1 ${tone}`} />
        ))}
        <div
          className="absolute -top-1 h-3.5 w-0.5 bg-t1"
          style={{ left: `${clamped}%` }}
          aria-hidden
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] uppercase tracking-label">
        <span className="text-t4">Bear</span>
        <span className={outside ? 'text-dn' : 'text-t2'}>
          {markerLabel}
          {outside ? ' · outside range' : ''}
        </span>
        <span className="text-t4">Bull</span>
      </div>
    </div>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone: 'pos' | 'neg' | 'flat' }) {
  const styles = {
    pos: 'border-up/40 bg-up/10 text-up',
    neg: 'border-dn/40 bg-dn/10 text-dn',
    flat: 'border-line bg-card text-t3',
  }[tone];
  return (
    <span className={`border px-2 py-1 text-[11px] font-medium leading-tight ${styles}`}>
      {children}
    </span>
  );
}
