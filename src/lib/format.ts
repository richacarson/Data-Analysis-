/** Display helpers. Every one tolerates null/undefined so a missing datum
 *  renders as an em dash instead of crashing a panel. */

export function money(n: number | null | undefined, currency = 'USD'): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Large figures as $4.70T / $416.2B / $12.7M. */
export function bigMoney(n: number | null | undefined, currency = 'USD'): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const sym = currency === 'USD' ? '$' : '';
  const units: Array<[number, string]> = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) return `${sign}${sym}${(abs / size).toFixed(2)}${suffix}`;
  }
  return `${sign}${sym}${abs.toFixed(2)}`;
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

/** For a value already expressed in percentage points. */
export function pctPoints(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export function num(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

export function signedPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const s = (n * 100).toFixed(digits);
  return `${n >= 0 ? '+' : ''}${s}%`;
}

/** Tailwind class for a value where positive is good and negative is bad. */
export function toneClass(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return 'text-muted';
  if (n > 0.0001) return 'text-pos';
  if (n < -0.0001) return 'text-neg';
  return 'text-ink';
}

export function fiscalYear(date: string): string {
  return date.slice(0, 4);
}
