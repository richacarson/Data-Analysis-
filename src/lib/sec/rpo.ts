import 'server-only';
import { unstable_cache } from 'next/cache';

/**
 * Backlog, as companies report it to the SEC.
 *
 * FMP's statements carry no backlog. Under ASC 606 every US filer discloses
 * its remaining performance obligations (RPO): contracted revenue not yet
 * recognised, which is what industrials call backlog and software companies
 * call contracted or committed revenue. The SEC's XBRL API serves each filing's
 * figure, free and keyless; it asks only for a User-Agent that identifies the
 * caller (set SEC_USER_AGENT to add a contact address).
 */

const CONCEPT = 'us-gaap/RevenueRemainingPerformanceObligation';

export interface RpoPoint {
  /** Balance-sheet date the figure is reported at. */
  date: string;
  value: number;
}

interface ConceptFact {
  end: string;
  val: number;
  filed: string;
  form: string;
}

async function fetchRpo(cik: string): Promise<RpoPoint[]> {
  const padded = cik.replace(/\D/g, '').padStart(10, '0');
  const res = await fetch(`https://data.sec.gov/api/xbrl/companyconcept/CIK${padded}/${CONCEPT}.json`, {
    headers: { 'User-Agent': process.env.SEC_USER_AGENT || 'EquityLens/1.0 (paradiem.org)' },
    signal: AbortSignal.timeout(10_000),
  });
  // Companies that do not tag RPO (most banks, many retailers) return 404.
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`SEC ${res.status}`);
  const body = (await res.json()) as { units?: Record<string, ConceptFact[]> };
  const facts = body.units?.USD ?? [];
  // A figure is repeated in later filings as a comparative; the latest filing
  // of each date wins, so restatements replace the original.
  const byDate = new Map<string, ConceptFact>();
  for (const f of facts) {
    if (!Number.isFinite(f.val) || !f.end) continue;
    const prior = byDate.get(f.end);
    if (!prior || f.filed > prior.filed) byDate.set(f.end, f);
  }
  return [...byDate.values()]
    .map((f) => ({ date: f.end, value: f.val }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** RPO by period end, oldest first; empty when the company does not report it. */
export function getRpoSeries(cik: string | null | undefined): Promise<RpoPoint[]> {
  if (!cik) return Promise.resolve([]);
  return unstable_cache(() => fetchRpo(cik), ['sec-rpo', cik], { revalidate: 60 * 60 * 12 })();
}
