/**
 * Estimate revisions from recorded consensus snapshots.
 *
 * FMP publishes today's consensus only, so the history is built by recording
 * it daily (see the cron route) and whenever a stock is opened. Thin-coverage
 * names are where this matters: a two-analyst FY2028 that has been cut twice
 * in a month reads the same as a stable one on any single day.
 */

import type { FinancialEstimate } from '../fmp/types';

const DAY = 86_400_000;

export interface SnapshotRow {
  symbol: string;
  fiscal_date: string;
  snapshot_date: string;
  eps_avg: number | null;
  eps_low: number | null;
  eps_high: number | null;
  revenue_avg: number | null;
  revenue_low: number | null;
  revenue_high: number | null;
  analysts_eps: number | null;
  analysts_revenue: number | null;
}

const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Today's consensus as snapshot rows: every year still open to revision.
 * A year keeps being revised after it ends until the company reports it, so
 * years that ended within the past four months are kept.
 */
export function snapshotRows(symbol: string, estimates: FinancialEstimate[], today: Date = new Date()): SnapshotRow[] {
  const snapshotDate = today.toISOString().slice(0, 10);
  const cutoff = new Date(today.getTime() - 120 * DAY).toISOString().slice(0, 10);
  return estimates
    .filter((e) => e.date && e.date.slice(0, 10) > cutoff)
    .map((e) => ({
      symbol: symbol.toUpperCase(),
      fiscal_date: e.date.slice(0, 10),
      snapshot_date: snapshotDate,
      eps_avg: finite(e.epsAvg),
      eps_low: finite(e.epsLow),
      eps_high: finite(e.epsHigh),
      revenue_avg: finite(e.revenueAvg),
      revenue_low: finite(e.revenueLow),
      revenue_high: finite(e.revenueHigh),
      analysts_eps: finite(e.numAnalystsEps),
      analysts_revenue: finite(e.numAnalystsRevenue),
    }));
}

export const REVISION_WINDOWS = [7, 30, 90] as const;
export type RevisionWindow = (typeof REVISION_WINDOWS)[number];

export interface RevisionYear {
  fiscalDate: string;
  eps: number | null;
  revenue: number | null;
  analysts: number | null;
  /** Change in consensus EPS over each window, as a fraction; null until the history reaches back that far. */
  epsChange: Record<RevisionWindow, number | null>;
  revenueChange: Record<RevisionWindow, number | null>;
  /** Analysts added or dropped over 30 days. */
  analystsChange30: number | null;
  series: Array<{ date: string; eps: number | null }>;
}

export interface RevisionSummary {
  years: RevisionYear[];
  /** First day on record for this symbol. */
  since: string | null;
  latest: string | null;
}

function change(now: number | null, then: number | null): number | null {
  if (now === null || then === null || then === 0) return null;
  // Against the absolute base, so a loss narrowing reads as an upward revision.
  return (now - then) / Math.abs(then);
}

/** Per fiscal year: latest consensus and how far it has moved over each window. */
export function summarizeRevisions(rows: SnapshotRow[]): RevisionSummary {
  if (!rows.length) return { years: [], since: null, latest: null };
  const dates = rows.map((r) => r.snapshot_date).sort();
  const since = dates[0];
  const latest = dates[dates.length - 1];

  const byYear = new Map<string, SnapshotRow[]>();
  for (const r of rows) {
    const list = byYear.get(r.fiscal_date) ?? [];
    list.push(r);
    byYear.set(r.fiscal_date, list);
  }

  const years: RevisionYear[] = [];
  for (const [fiscalDate, list] of byYear) {
    list.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    const now = list[list.length - 1];
    // A year no longer in today's consensus has been reported; it has nothing left to revise.
    if (now.snapshot_date !== latest) continue;

    const asOf = (days: number): SnapshotRow | null => {
      const target = new Date(Date.parse(`${latest}T00:00:00Z`) - days * DAY).toISOString().slice(0, 10);
      let hit: SnapshotRow | null = null;
      for (const r of list) {
        if (r.snapshot_date <= target) hit = r;
        else break;
      }
      return hit;
    };

    const epsChange = {} as Record<RevisionWindow, number | null>;
    const revenueChange = {} as Record<RevisionWindow, number | null>;
    for (const w of REVISION_WINDOWS) {
      const then = asOf(w);
      epsChange[w] = change(now.eps_avg, then?.eps_avg ?? null);
      revenueChange[w] = change(now.revenue_avg, then?.revenue_avg ?? null);
    }
    const month = asOf(30);

    years.push({
      fiscalDate,
      eps: now.eps_avg,
      revenue: now.revenue_avg,
      analysts: now.analysts_eps,
      epsChange,
      revenueChange,
      analystsChange30:
        month && now.analysts_eps !== null && month.analysts_eps !== null ? now.analysts_eps - month.analysts_eps : null,
      series: list.map((r) => ({ date: r.snapshot_date, eps: r.eps_avg })),
    });
  }

  years.sort((a, b) => a.fiscalDate.localeCompare(b.fiscalDate));
  return { years, since, latest };
}
