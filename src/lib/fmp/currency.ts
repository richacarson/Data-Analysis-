/**
 * Putting a foreign issuer's statements in the currency and share units of its quote.
 *
 * Novo Nordisk reports in Danish kroner and trades in New York in dollars.
 * Shown as they come, its revenue read "$309B" (DKK 309bn, about $47bn), its
 * dividend yield 30.2% and its earnings DCF $1,086 against a $38.71 price. Two
 * adjustments close the gap:
 *
 * - Currency: every monetary figure is converted at today's rate. Historical
 *   figures move with the rate, which is the usual trade-off; the multiples are
 *   unaffected, because price and earnings convert together.
 * - Share units: an ADR can represent several ordinary shares, and the feed's
 *   per-share figures may be on either basis. FMP's market cap divided by the
 *   ADR price gives the number of ADR-equivalent shares outstanding; its ratio
 *   to the statements' share count converts their per-share figures to a per-ADR
 *   basis. TSMC's statements are already per ADR (ratio 1); a feed on ordinary
 *   shares would come out at 0.2, one ADR to five shares.
 *
 * Domestic issuers are left alone: dual share classes would otherwise read as a
 * depositary ratio (Berkshire's B shares against its A-equivalent count).
 */

export interface Conversion {
  /** Quote-currency units per reporting-currency unit. */
  fx: number;
  /** ADR-equivalent shares per share in the statements. */
  shareRatio: number;
  from: string;
  to: string;
}

export const IDENTITY: Conversion = {
  fx: 1,
  shareRatio: 1,
  from: 'USD',
  to: 'USD',
};

/** Snaps near-integer depositary ratios (and their reciprocals) so rounding in the feed does not show. */
function snapRatio(r: number): number {
  if (!Number.isFinite(r) || r <= 0) return 1;
  if (Math.abs(r - 1) < 0.1) return 1;
  const whole = Math.round(r);
  if (r > 1 && Math.abs(r - whole) / r < 0.05) return whole;
  const inverse = Math.round(1 / r);
  if (r < 1 && inverse > 0 && Math.abs(1 / r - inverse) * r < 0.05) return 1 / inverse;
  return r;
}

/**
 * The share ratio implied by the quote: (market cap ÷ price) ÷ statement shares.
 * Outside a plausible depositary range, it says more about a stale field than a
 * ratio, so 1 is used instead.
 */
export function depositaryRatio(marketCap: number, price: number, statementShares: number): number {
  if (!(marketCap > 0) || !(price > 0) || !(statementShares > 0)) return 1;
  const raw = marketCap / price / statementShares;
  if (raw < 0.01 || raw > 100) return 1;
  return snapRatio(raw);
}

const SHARE_COUNT = /shs|shares|numberof/i;
const PER_SHARE = /^eps|pershare/i;
const NOT_AMOUNTS = new Set(['fiscalYear', 'cik', 'calendarYear']);
/** Counts and ratios: analyst numbers, margins. */
const UNITLESS = /^num|ratio$|margin|yield/i;

/**
 * Converts one statement row. Share counts scale by the share ratio, per-share
 * figures by the rate over the ratio, and every other number by the rate.
 */
export function convertRow<T extends object>(row: T, c: Conversion): T {
  if (c.fx === 1 && c.shareRatio === 1) return row;
  const out: Record<string, unknown> = { ...(row as Record<string, unknown>) };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || NOT_AMOUNTS.has(key) || UNITLESS.test(key)) continue;
    if (SHARE_COUNT.test(key)) out[key] = value * c.shareRatio;
    else if (PER_SHARE.test(key)) out[key] = (value * c.fx) / c.shareRatio;
    else out[key] = value * c.fx;
  }
  if ('reportedCurrency' in out) out.reportedCurrency = c.to;
  return out as T;
}

export const convertRows = <T extends object>(rows: T[], c: Conversion): T[] => rows.map((r) => convertRow(r, c));
