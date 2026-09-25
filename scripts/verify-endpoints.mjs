#!/usr/bin/env node
/**
 * Verifies every FMP endpoint the app depends on, against the live API.
 *
 * This exists because FMP's documentation page slugs do not always match the
 * REST paths, and endpoints move between plan tiers. Rather than trust that the
 * paths in src/lib/fmp/endpoints.ts are right, this proves it — and checks that
 * the fields the valuation engine reads are actually present, so schema drift
 * fails loudly instead of silently rendering zeros.
 *
 * Usage: FMP_KEY=... node scripts/verify-endpoints.mjs
 */

const KEY = process.env.FMP_KEY || process.env.FMP_API_KEY;
if (!KEY) {
  console.error('FMP_KEY is not set.');
  process.exit(1);
}

const BASE = 'https://financialmodelingprep.com/stable';
const SYMBOL = 'AAPL';

/** `fields` are the properties the valuation engine actually reads. */
const CHECKS = [
  {
    endpoint: 'profile',
    params: { symbol: SYMBOL },
    fields: ['symbol', 'price', 'marketCap', 'beta', 'currency', 'companyName'],
  },
  {
    endpoint: 'income-statement',
    params: { symbol: SYMBOL, period: 'annual', limit: 2 },
    fields: ['revenue', 'ebit', 'netIncome', 'epsDiluted', 'weightedAverageShsOutDil', 'incomeBeforeTax', 'incomeTaxExpense'],
  },
  {
    endpoint: 'cash-flow-statement',
    params: { symbol: SYMBOL, period: 'annual', limit: 2 },
    fields: ['freeCashFlow', 'operatingCashFlow', 'capitalExpenditure', 'netIncome', 'stockBasedCompensation', 'changeInWorkingCapital', 'commonDividendsPaid', 'commonStockRepurchased'],
  },
  {
    endpoint: 'balance-sheet-statement',
    params: { symbol: SYMBOL, period: 'annual', limit: 2 },
    fields: ['totalDebt', 'netDebt', 'totalStockholdersEquity'],
  },
  {
    endpoint: 'enterprise-values',
    params: { symbol: SYMBOL, limit: 2 },
    fields: ['enterpriseValue', 'numberOfShares', 'marketCapitalization'],
  },
  {
    endpoint: 'analyst-estimates',
    params: { symbol: SYMBOL, period: 'annual', limit: 3 },
    fields: ['date', 'epsAvg', 'epsLow', 'epsHigh', 'numAnalystsEps'],
  },
  {
    endpoint: 'key-metrics-ttm',
    params: { symbol: SYMBOL },
    fields: ['returnOnInvestedCapitalTTM', 'evToEBITDATTM', 'evToFreeCashFlowTTM', 'investedCapitalTTM'],
  },
  {
    endpoint: 'ratios-ttm',
    params: { symbol: SYMBOL },
    fields: ['priceToEarningsRatioTTM', 'priceToEarningsGrowthRatioTTM', 'bookValuePerShareTTM', 'netIncomePerShareTTM', 'effectiveTaxRateTTM'],
  },
  {
    endpoint: 'financial-scores',
    params: { symbol: SYMBOL },
    fields: ['altmanZScore', 'piotroskiScore'],
  },
  {
    endpoint: 'price-target-consensus',
    params: { symbol: SYMBOL },
    fields: ['targetConsensus', 'targetHigh', 'targetLow'],
  },
  {
    // search-symbol matches ticker text, so it must be probed with a ticker.
    endpoint: 'search-symbol',
    params: { query: 'AAPL', limit: 3 },
    fields: ['symbol', 'name'],
  },
  {
    // search-name matches company names — the other half of the search box.
    endpoint: 'search-name',
    params: { query: 'apple', limit: 3 },
    fields: ['symbol', 'name'],
  },
  {
    endpoint: 'earnings',
    params: { symbol: SYMBOL, limit: 4 },
    fields: ['symbol', 'date', 'epsActual'],
  },
  {
    endpoint: 'revenue-product-segmentation',
    params: { symbol: SYMBOL, period: 'annual' },
    fields: ['fiscalYear', 'data'],
  },
  {
    endpoint: 'analyst-estimates',
    params: { symbol: SYMBOL, period: 'quarter', limit: 4 },
    fields: ['date', 'revenueAvg', 'ebitdaAvg', 'ebitAvg', 'netIncomeAvg', 'epsAvg'],
  },
  {
    endpoint: 'dividends',
    params: { symbol: SYMBOL, limit: 4 },
    fields: ['date', 'dividend', 'frequency'],
  },
  {
    endpoint: 'quote-short',
    params: { symbol: 'TWDUSD' },
    fields: ['symbol', 'price'],
  },
  {
    endpoint: 'revenue-geographic-segmentation',
    params: { symbol: SYMBOL, period: 'annual' },
    fields: ['fiscalYear', 'data'],
  },
  {
    endpoint: 'historical-price-eod/light',
    params: { symbol: SYMBOL, from: '2026-01-02' },
    fields: ['date', 'price'],
  },
  {
    endpoint: 'income-statement',
    params: { symbol: SYMBOL, period: 'quarter', limit: 2 },
    fields: ['date', 'fiscalYear', 'period', 'revenue', 'epsDiluted'],
  },
  {
    endpoint: 'ratios',
    params: { symbol: SYMBOL, period: 'annual', limit: 3 },
    fields: ['priceToEarningsRatio', 'netIncomePerShare', 'fiscalYear'],
  },
  {
    endpoint: 'historical-industry-pe',
    params: { industry: 'Software - Infrastructure', from: '2026-09-01', to: '2026-09-18' },
    fields: ['date', 'industry', 'pe'],
  },
  {
    endpoint: 'treasury-rates',
    params: {},
    fields: ['date'],
  },
];

/** Strips the key from anything before it reaches a log or CI output. */
const redact = (text) => String(text).replaceAll(KEY, '***');

async function check({ endpoint, params, fields }) {
  const url = new URL(`${BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set('apikey', KEY);

  const started = Date.now();
  let res;
  try {
    res = await fetch(url);
  } catch (error) {
    return { endpoint, ok: false, reason: `network error: ${redact(error.message)}` };
  }
  const ms = Date.now() - started;

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { endpoint, ok: false, ms, reason: `HTTP ${res.status}: ${redact(body).slice(0, 160)}` };
  }

  const json = await res.json().catch(() => null);
  if (json && !Array.isArray(json) && json['Error Message']) {
    return { endpoint, ok: false, ms, reason: redact(json['Error Message']).slice(0, 160) };
  }
  if (!Array.isArray(json)) {
    return { endpoint, ok: false, ms, reason: `expected an array, got ${typeof json}` };
  }
  if (json.length === 0) {
    return { endpoint, ok: false, ms, reason: 'endpoint returned no rows' };
  }

  const row = json[0];
  const missing = fields.filter((f) => !(f in row));
  if (missing.length) {
    return { endpoint, ok: false, ms, rows: json.length, reason: `missing fields: ${missing.join(', ')}` };
  }

  return { endpoint, ok: true, ms, rows: json.length };
}

const results = await Promise.all(CHECKS.map(check));

let failed = 0;
for (const r of results) {
  if (r.ok) {
    console.log(`  PASS  ${r.endpoint.padEnd(26)} ${String(r.rows).padStart(3)} rows  ${r.ms}ms`);
  } else {
    failed++;
    console.log(`  FAIL  ${r.endpoint.padEnd(26)} ${r.reason}`);
  }
}

console.log(`\n${results.length - failed}/${results.length} endpoints verified.`);
process.exit(failed ? 1 : 0);
