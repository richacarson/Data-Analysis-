import Link from 'next/link';
import { sleeveByKey, sleevesHolding } from '@/data/sleeves';
import { multiple, num, pct, signedPct, toneClass } from '@/lib/format';
import type { ForwardPe } from '@/lib/valuation/house';

/**
 * 4a Hairline stock header: sleeve position + prev/next, big ticker, then three
 * rule-topped figures. Replaces the old "Company header" panel and the five-up
 * "Verdict strip" on /stock/[symbol]. The fair-value range stays with the
 * models further down the page.
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
  requiredExitMultiple,
  totalReturn,
  userExitPe,
  upperBound,
  forwardPe = [],
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
  requiredExitMultiple: number | null;
  /** Total (not annualized) return to the horizon; shown when the horizon is under two years. */
  totalReturn?: number | null;
  /** Set when the return uses your own exit multiple rather than the model's. */
  userExitPe?: number | null;
  /** Fast grower capped at today's multiple: the return is a ceiling, not an estimate. */
  upperBound?: boolean;
  /** Price over consensus EPS, next four fiscal years. */
  forwardPe?: ForwardPe[];
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
  const horizon = Number.isInteger(horizonYears) ? `${horizonYears}Y` : `${horizonYears.toFixed(1)}-year`;

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

      <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3 md:gap-10">
        <div className="hero-stat hero-stat-lead">
          <span className="hero-label">Expected {horizon} return</span>
          <span className={`hero-value ${expectedCagr !== null ? toneClass(expectedCagr - hurdle) : ''}`}>
            {pct(expectedCagr)}
          </span>
          <span className="hero-sub">
            vs {pct(hurdle, 0)} hurdle
            {horizonYears < 2 && totalReturn !== null && totalReturn !== undefined
              ? ` · ${signedPct(totalReturn)} in total`
              : ''}
            {userExitPe ? ` · at your ${multiple(userExitPe, 1)}×` : ''}
            {upperBound && !userExitPe ? ' · upper bound' : ''}
          </span>
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
          <span className="hero-label">Must believe</span>
          <span className="hero-value">{requiredExitMultiple && requiredExitMultiple > 0 ? `${multiple(requiredExitMultiple, 1)}×` : 'n/m'}</span>
          <span className="hero-sub">Exit multiple for {pct(hurdle, 0)}</span>
        </div>
      </div>

      {forwardPe.length > 0 && (
        <div className="border-t border-line pt-4">
          <span className="text-[13px] text-t3">Forward P/E · price over consensus EPS</span>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 md:gap-10">
            {forwardPe.map((f) => {
              const thin = f.analysts > 0 && f.analysts < 3;
              return (
                <div key={f.fiscalYear} className="flex flex-col gap-0.5">
                  <dt className="text-[12px] text-t3">FY{f.fiscalYear}</dt>
                  <dd className={`tabular text-[24px] font-light leading-none tracking-[-0.02em] ${f.pe === null || thin ? 'text-t3' : 'text-t1'}`}>
                    {f.pe !== null ? `${multiple(f.pe, 1)}×` : f.eps !== null ? 'n/m' : '—'}
                  </dd>
                  <dd className="text-[11px] text-t4">
                    {f.eps === null
                      ? 'No consensus'
                      : `EPS ${num(f.eps)} · ${f.analysts} analyst${f.analysts === 1 ? '' : 's'}`}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}
    </section>
  );
}
