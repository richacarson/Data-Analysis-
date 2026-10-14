/**
 * An iShares ETF's full holdings from the fund's daily holdings file, the
 * same CSV behind "Download holdings" on its page. FMP serves ETF holdings
 * only on a higher plan than ours; iShares publishes them free.
 */

export interface EtfFund {
  /** The ETF's ticker. */
  symbol: string;
  name: string;
  /** iShares product id and page slug, from the fund's URL. */
  productId: string;
  slug: string;
}

export const ETF_FUNDS: EtfFund[] = [
  { symbol: 'DVY', name: 'DVY · iShares Select Dividend', productId: '239500', slug: 'ishares-select-dividend-etf' },
  { symbol: 'IUSG', name: 'IUSG · iShares Core S&P US Growth', productId: '239725', slug: 'ishares-core-sp-us-growth-etf' },
];

/** Sleeve key for an ETF, e.g. etf-dvy. */
export const etfSleeveKey = (symbol: string) => `etf-${symbol.toLowerCase()}`;

export interface EtfHolding {
  /** Ticker as iShares lists it (BRKB, not BRK-B). */
  ticker: string;
  name: string;
  /** Fraction of the fund (0.021 for 2.1%). */
  weight: number;
}

export interface EtfHoldings {
  asOf: string | null;
  holdings: EtfHolding[];
}

/** Splits one CSV line, honouring quoted fields with commas in them. */
export function csvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      out.push(field);
      field = '';
    } else field += c;
  }
  out.push(field);
  return out.map((f) => f.trim());
}

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/** Equity holdings and their weights; cash, futures and the like are dropped. */
export function parseHoldings(csv: string): EtfHoldings {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/);
  const asOfLine = lines.find((l) => /^Fund Holdings as of/i.test(l));
  const m = asOfLine && /"?([A-Z][a-z]{2}) (\d{1,2}), (\d{4})"?/.exec(asOfLine);
  const asOf = m ? `${m[3]}-${MONTHS[m[1]] ?? '01'}-${m[2].padStart(2, '0')}` : null;

  const headerAt = lines.findIndex((l) => /^"?Ticker"?,/.test(l));
  if (headerAt < 0) throw new Error('No holdings table in the file');
  const header = csvLine(lines[headerAt]);
  const col = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const [iTicker, iName, iClass, iWeight] = [col('Ticker'), col('Name'), col('Asset Class'), col('Weight (%)')];
  if ([iTicker, iName, iClass, iWeight].some((i) => i < 0)) throw new Error('Holdings columns not found');

  const holdings: EtfHolding[] = [];
  for (const line of lines.slice(headerAt + 1)) {
    if (!line.trim() || line.startsWith(' ')) break;
    const f = csvLine(line);
    if (f.length < header.length - 2) break;
    if (f[iClass] !== 'Equity') continue;
    const weight = Number(f[iWeight].replace(/,/g, '')) / 100;
    const ticker = f[iTicker].toUpperCase();
    if (!ticker || ticker === '-' || !(weight > 0)) continue;
    holdings.push({ ticker, name: f[iName], weight });
  }
  return { asOf, holdings };
}

export async function fetchHoldings(fund: EtfFund): Promise<EtfHoldings> {
  const page = `https://www.ishares.com/us/products/${fund.productId}/${fund.slug}`;
  const res = await fetch(`${page}/1467271812596.ajax?fileType=csv&fileName=${fund.symbol}_holdings&dataType=fund`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      Accept: 'text/csv,text/plain,*/*',
      Referer: page,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`iShares ${fund.symbol} holdings: HTTP ${res.status}`);
  const text = await res.text();
  if (/^\s*<!DOCTYPE|<html/i.test(text.slice(0, 200))) throw new Error(`iShares ${fund.symbol} sent a web page, not the holdings file`);
  return parseHoldings(text);
}

/**
 * iShares writes share classes without a separator (BRKB, BFB); FMP and the
 * rest of the app use BRK-B. Candidates to try, in order.
 */
export function tickerCandidates(ticker: string): string[] {
  const t = ticker.replace(/[.\s/]/g, '-');
  const out = [t];
  if (!t.includes('-') && t.length >= 3 && /[AB]$/.test(t)) out.push(`${t.slice(0, -1)}-${t.slice(-1)}`);
  return out;
}
