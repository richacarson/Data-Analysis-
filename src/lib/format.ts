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
  if (n === null || n === undefined || !Number.isFinite(n)) return 'text-t3';
  if (n > 0.0001) return 'text-up';
  if (n < -0.0001) return 'text-dn';
  return 'text-t1';
}

export function fiscalYear(date: string): string {
  return date.slice(0, 4);
}

/**
 * A valuation multiple, shown only when it means something.
 *
 * A negative multiple is an artifact of a negative denominator, not a cheap
 * stock: McDonald's price-to-book reads -172 because buybacks have taken its
 * book equity below zero, and a loss-making company's P/E is negative for the
 * same reason. Printing either invites exactly the wrong reading.
 */
export function multiple(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n <= 0) return 'n/m';
  return n.toFixed(digits);
}

/**
 * A ratio where zero is a real answer but a negative one is not — debt to
 * equity is legitimately zero for a debt-free company, and negative only when
 * equity itself has gone negative.
 */
export function nonNegativeRatio(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n < 0) return 'n/m';
  return n.toFixed(digits);
}

/**
 * Interest coverage. FMP reports zero both for a company that cannot cover its
 * interest and for one with no interest expense to cover — opposite meanings
 * from the same number — so the caller passes whether any interest was charged.
 */
export function coverage(n: number | null | undefined, hasInterestExpense: boolean): string {
  if (!hasInterestExpense) return 'No interest expense';
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toFixed(2);
}
