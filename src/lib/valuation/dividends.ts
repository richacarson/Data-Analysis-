/**
 * Dividend yield going forward.
 *
 * For quarterly and monthly payers the latest declared payment times its
 * frequency is the forward rate, and picks up a raise the trailing figure
 * has not seen yet. For semi-annual and annual payers it misleads: NatWest
 * pays a small interim and a larger final, so doubling the latest interim
 * (Seeking Alpha's 3.56%) understates what a holder actually receives, while
 * the last twelve months (5.1%) is the two payments it makes a year. Those
 * use the trailing year instead. Special dividends are left out of both.
 */
export interface DividendPayment {
  date: string;
  dividend: number;
  frequency?: string | null;
}

const PER_YEAR: Record<string, number> = {
  monthly: 12,
  quarterly: 4,
  'semi-annual': 2,
  'semi annual': 2,
  annual: 1,
};

export interface ForwardDividend {
  annual: number;
  yield: number;
  method: 'run-rate' | 'trailing' | 'none';
}

export function forwardDividend(
  payments: DividendPayment[],
  price: number,
  today: Date = new Date(),
): ForwardDividend {
  const none: ForwardDividend = { annual: 0, yield: 0, method: 'none' };
  if (!(price > 0)) return none;
  const regular = payments
    .filter((p) => p.dividend > 0 && PER_YEAR[(p.frequency ?? '').toLowerCase()] !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date));
  const latest = regular[0];
  // A payer that has gone quiet for over a year is not paying one now.
  if (!latest || today.getTime() - Date.parse(latest.date) > 400 * 86_400_000) return none;

  const perYear = PER_YEAR[(latest.frequency ?? '').toLowerCase()];
  if (perYear >= 4) {
    const annual = latest.dividend * perYear;
    return { annual, yield: annual / price, method: 'run-rate' };
  }
  const since = Date.parse(latest.date) - 350 * 86_400_000;
  const annual = regular.filter((p) => Date.parse(p.date) > since).reduce((a, p) => a + p.dividend, 0);
  return { annual, yield: annual / price, method: 'trailing' };
}
