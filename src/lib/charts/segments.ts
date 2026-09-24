/**
 * Segment revenue as stacked columns.
 *
 * Only segments reported in the latest year are named — companies re-cut their
 * segments, and a 2014 label with no 2025 counterpart is noise. Past five, the
 * rest fold into "Other": a stack of nine slices is unreadable, and inventing
 * hues past the palette would break the colour rules.
 */

export interface SegmentData {
  rows: Array<{ key: string; label: string; [segment: string]: string | number }>;
  segments: string[];
}

const MAX_NAMED = 5;
export const OTHER = 'Other';

export function foldSegments(
  input: Array<{ fiscalYear: string; data: Record<string, number> }>,
  years = 12,
): SegmentData {
  const chronological = [...input]
    .filter((r) => r.data && Object.keys(r.data).length)
    .sort((a, b) => a.fiscalYear.localeCompare(b.fiscalYear));
  const latest = chronological[chronological.length - 1];
  if (!latest) return { rows: [], segments: [] };

  const ranked = Object.keys(latest.data).sort((a, b) => (latest.data[b] ?? 0) - (latest.data[a] ?? 0));
  const named = ranked.length > MAX_NAMED + 1 ? ranked.slice(0, MAX_NAMED) : ranked;

  const rows = chronological
    .filter((r) => ranked.some((s) => typeof r.data[s] === 'number'))
    .slice(-years)
    .map((r) => {
      const row: SegmentData['rows'][number] = { key: `FY${r.fiscalYear}`, label: r.fiscalYear };
      // Anything not named — smaller segments, or ones since renamed — is
      // kept as Other so each year's stack still sums to its revenue.
      let other = 0;
      for (const [segment, value] of Object.entries(r.data)) {
        if (!Number.isFinite(value)) continue;
        if (named.includes(segment)) row[segment] = value;
        else other += value;
      }
      for (const s of named) if (typeof row[s] !== 'number') row[s] = 0;
      row[OTHER] = other;
      return row;
    });

  const hasOther = rows.some((r) => (r[OTHER] as number) > 0);
  if (!hasOther) for (const r of rows) delete r[OTHER];
  const segments = hasOther ? [...named, OTHER] : named;

  return { rows, segments };
}
