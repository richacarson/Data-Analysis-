import { describe, expect, it } from 'vitest';
import { snapshotRows, summarizeRevisions, type SnapshotRow } from '../revisions';
import type { FinancialEstimate } from '../../fmp/types';

const est = (date: string, epsAvg: number, n = 5): FinancialEstimate => ({
  symbol: 'RRX',
  date,
  revenueLow: 0,
  revenueHigh: 0,
  revenueAvg: 1000,
  ebitdaAvg: 0,
  ebitAvg: 0,
  netIncomeAvg: 0,
  epsAvg,
  epsHigh: epsAvg * 1.1,
  epsLow: epsAvg * 0.9,
  numAnalystsRevenue: n,
  numAnalystsEps: n,
});

const row = (snapshot: string, fiscal: string, eps: number, analysts = 5): SnapshotRow => ({
  symbol: 'RRX',
  fiscal_date: fiscal,
  snapshot_date: snapshot,
  eps_avg: eps,
  eps_low: null,
  eps_high: null,
  revenue_avg: 1000,
  revenue_low: null,
  revenue_high: null,
  analysts_eps: analysts,
  analysts_revenue: analysts,
});

describe('snapshotRows', () => {
  it('keeps years still open to revision and drops reported history', () => {
    const today = new Date('2026-09-28T00:00:00Z');
    const rows = snapshotRows('rrx', [est('2024-12-31', 8), est('2026-06-30', 9), est('2026-12-31', 10), est('2027-12-31', 11)], today);
    expect(rows.map((r) => r.fiscal_date)).toEqual(['2026-06-30', '2026-12-31', '2027-12-31']);
    expect(rows[0].symbol).toBe('RRX');
    expect(rows[0].snapshot_date).toBe('2026-09-28');
  });
});

describe('summarizeRevisions', () => {
  it('measures each window against the last snapshot on or before it', () => {
    const rows = [
      row('2026-06-01', '2027-12-31', 10, 4),
      row('2026-08-20', '2027-12-31', 10.5, 4),
      row('2026-09-21', '2027-12-31', 11, 5),
      row('2026-09-28', '2027-12-31', 11, 6),
    ];
    const s = summarizeRevisions(rows);
    const y = s.years[0];
    expect(s.since).toBe('2026-06-01');
    expect(y.epsChange[7]).toBeCloseTo(0, 6);
    expect(y.epsChange[30]).toBeCloseTo(11 / 10.5 - 1, 6);
    expect(y.epsChange[90]).toBeCloseTo(0.1, 6);
    expect(y.analystsChange30).toBe(2);
  });

  it('reads a narrowing loss as an upward revision and leaves short history blank', () => {
    const s = summarizeRevisions([row('2026-09-20', '2026-12-31', -2), row('2026-09-28', '2026-12-31', -1)]);
    expect(s.years[0].epsChange[7]).toBeCloseTo(0.5, 6);
    expect(s.years[0].epsChange[30]).toBeNull();
  });

  it('drops a year missing from the latest snapshot: it has been reported', () => {
    const s = summarizeRevisions([row('2026-09-20', '2026-06-30', 3), row('2026-09-28', '2027-06-30', 4)]);
    expect(s.years.map((y) => y.fiscalDate)).toEqual(['2027-06-30']);
  });
});
