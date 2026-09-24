import Link from 'next/link';

/** Switches between a stock's valuation and its chart library. */
export function StockTabs({ symbol, active }: { symbol: string; active: 'valuation' | 'charts' }) {
  const tabs = [
    { key: 'valuation', label: 'Valuation', href: `/stock/${symbol}` },
    { key: 'charts', label: 'Charts', href: `/stock/${symbol}/charts` },
  ] as const;
  return (
    <nav className="flex gap-5 border-b border-line" aria-label={`${symbol} views`}>
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? 'page' : undefined}
          className={`-mb-px border-b-2 pb-2.5 text-[13px] font-semibold transition-colors ${
            active === t.key ? 'border-gold text-t1' : 'border-transparent text-t3 hover:text-t1'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
