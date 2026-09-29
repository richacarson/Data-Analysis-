import Link from 'next/link';
import { sleeveByKey, sleevesHolding } from '@/data/sleeves';
import { multiple, num, pct, roundMoney, signedPct, toneClass } from '@/lib/format';

/**
 * 4a Hairline stock header: sleeve position + prev/next, big ticker, then four
 * rule-topped figures. Replaces the old "Company header" panel and the five-up
 * "Verdict strip" on /stock/[symbol].
 */
export function StockHero({
  symbol,
  companyName,
  sleeveKey,
  price,
  change,
  changePercentage,
  currency,
  expectedCagr,
  hurdle,
  horizonYears,
  valueLow,
  valueHigh,
  requiredExitMultiple,
}: {
  symbol: string;
  companyName: string;
  /** From ?sleeve=; falls back to the first sleeve that holds the ticker. */
  sleeveKey?: string;
  price: number;
  change: number;
  changePercentage: number;
  currency: string;
  expectedCagr: number | null;
  hurdle: number;
  horizonYears: number;
  valueLow: number | null;
  valueHigh: number | null;
  /** Kept for callers; the range note now reads price against low/high directly. */
  upside?: number;
  requiredExitMultiple: number | null;
}) {
  const sym = symbol.toUpperCase();
  const sleeve =
    (sleeveKey && sleeveByKey(sleeveKey)?.tickers.includes(sym) ? sleeveByKey(sleeveKey) : undefined) ??
    sleevesHolding(sym)[0];
  const idx = sleeve ? sleeve.tickers.indexOf(sym) : -1;
  const prev = sleeve && idx > 0 ? sleeve.tickers[idx - 1] : null;
  const next = sleeve && idx >= 0 && idx < sleeve.tickers.length - 1 ? sleeve.tickers[idx + 1] : null;
  const q = sleeve ? `?sleeve=${sleeve.key}` : '';

  const shortName = companyName.replace(/,?\s+(Inc\.?|Corp\.?|Corporation|Ltd\.?|plc|N\.V\.)$/i, '');
  // Where the price sits against the modelled range. Inside it is neither cheap nor dear.
  const valueNote =
    valueLow === null || valueHigh === null
      ? 'No growth model applies'
      : price < valueLow
        ? 'Below the range'
        : price > valueHigh
          ? 'Above the range'
          : 'Inside the range';
  const valueTone = valueNote === 'Below the range' ? 'text-up' : valueNote === 'Above the range' ? 'text-dn' : 'text-t1';
  const horizon = Number.isInteger(horizonYears) ? `${horizonYears}Y` : `${horizonYears.toFixed(1)}-year`;

  const range =
    valueLow !== null && valueHigh !== null
      ? `${roundMoney(valueLow, currency).replace(/^\$/, '')}–${roundMoney(valueHigh, currency).replace(/^\$/, '')}`
      : '—';

  return (
    <section className="space-y-9">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          {sleeve && (
            <span className="text-[13px] text-t3">
              {sleeve.name} · {idx + 1} of {sleeve.tickers.length}
            </span>
          )}
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="text-[40px] font-bold leading-none tracking-[-0.03em] text-t1 sm:text-[48px]">{sym}</h1>
            <span className="text-[18px] text-t3 sm:text-[20px]">{shortName}</span>
          </div>
        </div>
        {sleeve && (
          <nav className="flex gap-6 text-[14px] font-medium" aria-label={`${sleeve.name} sleeve`}>
            {prev ? (
              <Link href={`/stock/${prev}${q}`} className="text-t1 hover:text-goldInk">← {prev}</Link>
            ) : <span className="text-t4">←</span>}
            {next ? (
              <Link href={`/stock/${next}${q}`} className="text-t1 hover:text-goldInk">{next} →</Link>
            ) : <span className="text-t4">→</span>}
          </nav>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4 md:gap-10">
        <div className="hero-stat hero-stat-lead">
          <span className="hero-label">Expected {horizon} return</span>
          <span className={`hero-value ${expectedCagr !== null ? toneClass(expectedCagr - hurdle) : ''}`}>
            {pct(expectedCagr)}
          </span>
          <span className="hero-sub">vs {pct(hurdle, 0)} hurdle</span>
        </div>
        <div className="hero-stat">
          <span className="hero-label">Price</span>
          <span className="hero-value">{num(price)}</span>
          <span className={`hero-sub ${change >= 0 ? 'text-up' : 'text-dn'}`}>
            {change >= 0 ? '+' : ''}
            {num(change)} ({signedPct(changePercentage / 100)})
          </span>
        </div>
        <div className="hero-stat">
          <span className="hero-label">Fair value</span>
          <span className="hero-value">{range}</span>
          <span className={`hero-sub ${valueTone}`}>{valueNote}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-label">Must believe</span>
          <span className="hero-value">{requiredExitMultiple && requiredExitMultiple > 0 ? `${multiple(requiredExitMultiple, 1)}×` : 'n/m'}</span>
          <span className="hero-sub">Exit multiple for {pct(hurdle, 0)}</span>
        </div>
      </div>
    </section>
  );
}
