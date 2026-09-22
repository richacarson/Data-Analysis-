import { NextResponse } from 'next/server';
import { fmpList } from '@/lib/fmp/client';

/**
 * Pings every FMP endpoint the app depends on and reports which ones answer.
 *
 * FMP moves endpoint paths between plan tiers and API generations, so this is
 * the fastest way to confirm a key is wired up and to spot a renamed route.
 */
const CHECKS: Array<{ name: string; endpoint: string; params: Record<string, string> }> = [
  { name: 'profile', endpoint: 'profile', params: { symbol: 'AAPL' } },
  { name: 'income statement', endpoint: 'income-statement', params: { symbol: 'AAPL', limit: '1' } },
  { name: 'cash flow statement', endpoint: 'cash-flow-statement', params: { symbol: 'AAPL', limit: '1' } },
  { name: 'balance sheet', endpoint: 'balance-sheet-statement', params: { symbol: 'AAPL', limit: '1' } },
  { name: 'enterprise values', endpoint: 'enterprise-values', params: { symbol: 'AAPL', limit: '1' } },
  { name: 'analyst estimates', endpoint: 'analyst-estimates', params: { symbol: 'AAPL', period: 'annual', limit: '1' } },
  { name: 'key metrics TTM', endpoint: 'key-metrics-ttm', params: { symbol: 'AAPL' } },
  { name: 'ratios TTM', endpoint: 'ratios-ttm', params: { symbol: 'AAPL' } },
  { name: 'financial scores', endpoint: 'financial-scores', params: { symbol: 'AAPL' } },
  { name: 'price target consensus', endpoint: 'price-target-consensus', params: { symbol: 'AAPL' } },
  { name: 'symbol search', endpoint: 'search-symbol', params: { query: 'AAPL', limit: '1' } },
  { name: 'company name search', endpoint: 'search-name', params: { query: 'apple', limit: '1' } },
  { name: 'annual ratios', endpoint: 'ratios', params: { symbol: 'AAPL', period: 'annual', limit: '3' } },
  {
    name: 'industry P/E history',
    endpoint: 'historical-industry-pe',
    params: { industry: 'Software - Infrastructure', from: '2026-09-01', to: '2026-09-18' },
  },
  { name: 'treasury rates', endpoint: 'treasury-rates', params: {} },
];

export const dynamic = 'force-dynamic';

export async function GET() {
  const results = await Promise.all(
    CHECKS.map(async (check) => {
      const started = Date.now();
      try {
        const rows = await fmpList(check.endpoint, check.params, 0);
        return {
          ...check,
          ok: true,
          rows: rows.length,
          ms: Date.now() - started,
        };
      } catch (error) {
        return {
          ...check,
          ok: false,
          rows: 0,
          ms: Date.now() - started,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const failing = results.filter((r) => !r.ok);
  return NextResponse.json(
    {
      keyConfigured: Boolean(process.env.FMP_KEY || process.env.FMP_API_KEY),
      healthy: failing.length === 0,
      passed: results.length - failing.length,
      total: results.length,
      results,
    },
    { status: failing.length ? 207 : 200 },
  );
}
