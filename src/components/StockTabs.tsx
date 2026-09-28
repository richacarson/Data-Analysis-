import Link from 'next/link';

/** Switches between a stock's valuation and its chart library, keeping the sleeve context. */
export function StockTabs({
  symbol,
  active,
  sleeve,
}: {
  symbol: string;
  active: 'valuation' | 'charts';
  sleeve?: string;
}) {
  const q = sleeve ? `?sleeve=${encodeURIComponent(sleeve)}` : '';
  const tabs = [
    { key: 'valuation', label: 'Valuation', href: `/stock/${symbol}${q}` },
    { key: 'charts', label: 'Charts', href: `/stock/${symbol}/charts${q}` },
  ] as const;
  return (
    <nav className="flex gap-7 border-b border-line" aria-label={`${symbol} views`}>
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? 'page' : undefined}
          className={`-mb-px border-b-2 pb-3 text-[14px] font-medium transition-colors ${
            active === t.key ? 'border-gold text-t1' : 'border-transparent text-t3 hover:text-t1'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
