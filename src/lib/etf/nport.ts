/**
 * A fund's holdings from its latest N-PORT filing at the SEC: every
 * position with its share of the fund's net assets. Filed monthly and made
 * public with a lag, so the holdings are a couple of months old; for an index
 * fund that changes little. Used when the issuer's own file is unavailable.
 */

import type { EtfFund, EtfHoldings, EtfHolding } from './ishares';

const UA = process.env.SEC_USER_AGENT || 'EquityLens/1.0 (paradiem.org)';

/** iShares Trust, the registrant both funds file under. */
export const ISHARES_TRUST_CIK = '1100663';

interface Filing {
  accession: string;
  periodEnding: string;
}

/** The latest N-PORT the trust filed that names the fund. */
export async function latestFiling(fund: EtfFund, fundName: string): Promise<Filing> {
  const q = encodeURIComponent(`"${fundName}"`);
  const res = await fetch(`https://efts.sec.gov/LATEST/search-index?q=${q}&forms=NPORT-P`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`SEC search for ${fund.symbol}: HTTP ${res.status}`);
  const body = (await res.json()) as {
    hits?: { hits?: Array<{ _id: string; _source: { ciks?: string[]; period_ending?: string; root_forms?: string[] } }> };
  };
  const hits = (body.hits?.hits ?? [])
    .filter((h) => h._source.ciks?.some((c) => Number(c) === Number(ISHARES_TRUST_CIK)))
    .filter((h) => h._source.root_forms?.includes('NPORT-P') && h._source.period_ending)
    .sort((a, b) => b._source.period_ending!.localeCompare(a._source.period_ending!));
  const top = hits[0];
  if (!top) throw new Error(`No N-PORT filing found for ${fund.symbol}`);
  return { accession: top._id.split(':')[0], periodEnding: top._source.period_ending! };
}

const tag = (xml: string, name: string) => new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1]?.trim() ?? null;

export interface NportHolding extends EtfHolding {
  cusip: string | null;
}

/** Common-equity positions from an N-PORT primary document. */
export function parseNport(xml: string): { seriesName: string | null; asOf: string | null; holdings: NportHolding[] } {
  const seriesName = tag(xml, 'seriesName');
  const asOf = tag(xml, 'repPdDate');
  const holdings: NportHolding[] = [];
  for (const block of xml.split('<invstOrSec>').slice(1)) {
    const body = block.split('</invstOrSec>')[0];
    if (tag(body, 'assetCat') !== 'EC') continue;
    const pct = Number(tag(body, 'pctVal'));
    if (!(pct > 0)) continue;
    const ticker = /<ticker\s+value="([^"]+)"/.exec(body)?.[1]?.trim().toUpperCase() ?? '';
    holdings.push({ ticker, name: tag(body, 'name') ?? '', weight: pct / 100, cusip: tag(body, 'cusip') });
  }
  return { seriesName, asOf, holdings };
}

export async function nportHoldings(fund: EtfFund, fundName: string): Promise<EtfHoldings & { holdings: NportHolding[] }> {
  const filing = await latestFiling(fund, fundName);
  const folder = filing.accession.replace(/-/g, '');
  const res = await fetch(`https://www.sec.gov/Archives/edgar/data/${ISHARES_TRUST_CIK}/${folder}/primary_doc.xml`, {
    headers: { 'User-Agent': UA, Accept: 'application/xml,text/xml' },
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`SEC N-PORT for ${fund.symbol}: HTTP ${res.status}`);
  const parsed = parseNport(await res.text());
  if (parsed.seriesName && parsed.seriesName.toLowerCase() !== fundName.toLowerCase()) {
    throw new Error(`${fund.symbol}: filing is for ${parsed.seriesName}`);
  }
  return { asOf: parsed.asOf ?? filing.periodEnding, holdings: parsed.holdings };
}
