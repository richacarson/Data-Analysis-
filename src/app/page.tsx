import Link from 'next/link';
import { Watchlist } from '@/components/Watchlist';

const EXAMPLES = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META', 'BRK-B', 'COST', 'UNH'];

const CAPABILITIES = [
  {
    title: 'DCF on earnings projections',
    body: 'Consensus EPS for every year analysts publish, converted to cash at a historically observed rate, then faded to a terminal growth rate.',
  },
  {
    title: 'Reverse DCF',
    body: 'Solves for the growth rate the current price already pays for, so you can judge it against what analysts and history actually support.',
  },
  {
    title: 'Growth-adjusted multiples',
    body: 'Trailing and forward PEG, EV/EBITDA, EV/FCF, P/FCF, Graham number and a zero-growth earnings power floor.',
  },
  {
    title: 'Quality and returns',
    body: 'ROIC against cost of capital, Piotroski F-score, Altman Z-score, owner earnings, and total shareholder yield including buybacks.',
  },
  {
    title: 'Sensitivity analysis',
    body: 'Fair value across a grid of discount and terminal-growth rates, because the range matters more than the point estimate.',
  },
  {
    title: 'Full cost-of-capital build-up',
    body: 'CAPM cost of equity from a live 10-year Treasury, implied cost of debt, and capital-structure weighted WACC — every input visible.',
  },
];

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section className="panel px-6 py-8">
        <h1 className="text-[26px] font-semibold tracking-tight">
          Deep fundamental analysis, one ticker at a time.
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">
          Search any listed company to get a full valuation workup — five independent models,
          the assumptions behind each one, and the sensitivity around them.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {EXAMPLES.map((symbol) => (
            <Link
              key={symbol}
              href={`/stock/${symbol}`}
              className="rounded-md border border-line bg-panel2 px-3 py-1.5 text-[13px] font-medium hover:border-accent hover:text-accent"
            >
              {symbol}
            </Link>
          ))}
        </div>
      </section>

      <Watchlist />

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CAPABILITIES.map((c) => (
          <div key={c.title} className="panel px-4 py-4">
            <h2 className="text-[13px] font-semibold">{c.title}</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{c.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
