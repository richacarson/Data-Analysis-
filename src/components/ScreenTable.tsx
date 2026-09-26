'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ScreenRow } from '@/lib/screen/run';
import { sleevesHolding } from '@/data/sleeves';
import { money, multiple, num, pct, signedPct } from '@/lib/format';

type SortKey = 'expectedCagr' | 'stretch' | 'symbol' | 'requiredExitPe' | 'dividendYield';

const COLUMNS: Array<{ key: SortKey | null; label: string; numeric?: boolean }> = [
  { key: 'symbol', label: 'Ticker' },
  { key: null, label: 'Sleeves' },
  { key: null, label: 'Price', numeric: true },
  { key: null, label: 'EPS at horizon', numeric: true },
  { key: null, label: 'Exit P/E', numeric: true },
  { key: 'requiredExitPe', label: 'Must believe', numeric: true },
  { key: 'stretch', label: 'Stretch', numeric: true },
  { key: 'dividendYield', label: 'Yield', numeric: true },
  { key: 'expectedCagr', label: 'Expected CAGR', numeric: true },
];

export function ScreenTable({ rows, hurdle }: { rows: ScreenRow[]; hurdle: number }) {
  const [sort, setSort] = useState<SortKey>('expectedCagr');
  const [descending, setDescending] = useState(true);
  const [onlyClearing, setOnlyClearing] = useState(false);

  const sorted = useMemo(() => {
    const filtered = onlyClearing ? rows.filter((r) => r.clearsHurdle) : rows;
    return [...filtered].sort((a, b) => {
      if (sort === 'symbol') {
        return descending ? b.symbol.localeCompare(a.symbol) : a.symbol.localeCompare(b.symbol);
      }
      const av = a[sort];
      const bv = b[sort];
      // Rows without a value sort last regardless of direction — they are not
      // "the worst", they are unknown.
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return descending ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });
  }, [rows, sort, descending, onlyClearing]);

  function toggle(key: SortKey) {
    if (key === sort) setDescending((d) => !d);
    else {
      setSort(key);
      setDescending(true);
    }
  }

  const sortOptions: Array<{ key: SortKey; label: string }> = [
    { key: 'expectedCagr', label: 'Expected CAGR' },
    { key: 'stretch', label: 'Stretch' },
    { key: 'requiredExitPe', label: 'Must believe' },
    { key: 'dividendYield', label: 'Yield' },
    { key: 'symbol', label: 'Ticker' },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-2.5">
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-t3">
          <input
            type="checkbox"
            checked={onlyClearing}
            onChange={(e) => setOnlyClearing(e.target.checked)}
            className="accent-gold"
          />
          Only show holdings clearing {pct(hurdle, 0)}
        </label>
        <div className="flex items-center gap-3">
          {/* Phones have no column headers to tap, so sorting gets its own control. */}
          <label className="flex items-center gap-2 text-[11px] text-t4 md:hidden">
            Sort
            <select
              value={`${sort}:${descending ? 'desc' : 'asc'}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(':');
                setSort(key as SortKey);
                setDescending(dir === 'desc');
              }}
              className="border border-line bg-card px-2 py-1.5 text-[16px] text-t1 outline-none sm:text-[12px]"
            >
              {sortOptions.flatMap((o) => [
                <option key={`${o.key}:desc`} value={`${o.key}:desc`}>
                  {o.label} {o.key === 'symbol' ? 'Z–A' : 'high–low'}
                </option>,
                <option key={`${o.key}:asc`} value={`${o.key}:asc`}>
                  {o.label} {o.key === 'symbol' ? 'A–Z' : 'low–high'}
                </option>,
              ])}
            </select>
          </label>
          <span className="text-[11px] text-t4">{sorted.length} rows</span>
        </div>
      </div>

      {/* Phones: one line per holding, the return first and the working beneath. */}
      <ul className="md:hidden">
        {sorted.map((r) => {
          const sleeves = sleevesHolding(r.symbol);
          return (
            <li key={r.symbol} className="border-b border-hairline last:border-0">
              <Link href={`/stock/${r.symbol}`} className="block px-4 py-3 active:bg-card">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="text-[14px] font-semibold text-t1">{r.symbol}</span>
                    <span className="tabular text-[12px] text-t3">
                      {r.price !== null ? money(r.price) : '—'}
                    </span>
                  </div>
                  <span
                    className={`tabular shrink-0 text-[15px] font-semibold ${
                      r.expectedCagr === null
                        ? 'text-t4'
                        : r.clearsHurdle
                          ? 'text-up'
                          : 'text-dn'
                    }`}
                  >
                    {r.expectedCagr !== null ? signedPct(r.expectedCagr) : '—'}
                  </span>
                </div>
                {r.horizonNote && <p className="mt-1 text-[11px] text-warn">{r.horizonNote}</p>}
                {r.expectedCagr !== null ? (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-t4">
                    <span>
                      {num(r.epsAtHorizon)} EPS FY{r.horizonFiscalYear}
                      {r.analystCount > 0 && r.analystCount < 3 && (
                        <span className="text-dn"> ({r.analystCount})</span>
                      )}
                    </span>
                    <span>
                      × {multiple(r.exitPe)}
                      {r.exitCapNote && <span className="text-warn"> (capped)</span>}
                    </span>
                    <span>needs {multiple(r.requiredExitPe)}</span>
                    {r.dividendYield > 0 && <span>{pct(r.dividendYield)} yield</span>}
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-t4">{r.note ?? 'Not scored'}</p>
                )}
                <p className="mt-1 truncate text-[10px] uppercase tracking-label text-t4/80">
                  {sleeves.map((s) => s.name).join(' · ')}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] text-[12px]">
          <thead>
            <tr className="border-b border-line">
              {COLUMNS.map((c) => (
                <th
                  key={c.label}
                  scope="col"
                  className={`px-3 py-2 ${c.numeric ? 'text-right' : 'text-left'}`}
                >
                  {c.key ? (
                    <button
                      onClick={() => toggle(c.key as SortKey)}
                      className={`eyebrow-muted hover:text-gold ${
                        sort === c.key ? 'text-gold' : ''
                      }`}
                    >
                      {c.label}
                      {sort === c.key ? (descending ? ' ↓' : ' ↑') : ''}
                    </button>
                  ) : (
                    <span className="eyebrow-muted">{c.label}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const sleeves = sleevesHolding(r.symbol);
              return (
                <tr key={r.symbol} className="border-b border-hairline hover:bg-card">
                  <td className="px-3 py-2">
                    <Link href={`/stock/${r.symbol}`} className="font-semibold text-t1 hover:text-gold">
                      {r.symbol}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-[10px] uppercase tracking-label text-t4">
                    {sleeves.map((s) => s.name).join(' · ')}
                  </td>
                  <td className="tabular px-3 py-2 text-right text-t2">
                    {r.price !== null ? money(r.price) : '—'}
                  </td>
                  <td className="tabular px-3 py-2 text-right text-t2">
                    {r.epsAtHorizon !== null ? (
                      <>
                        {num(r.epsAtHorizon)}
                        <span className="ml-1 text-[10px] text-t4">FY{r.horizonFiscalYear}</span>
                        {r.horizonNote && (
                          <span className="ml-1 text-[10px] text-warn" title={r.horizonNote}>
                            ↓
                          </span>
                        )}
                        {r.convertedFrom && (
                          <span className="ml-1 text-[10px] text-t4" title={`Consensus in ${r.convertedFrom}, converted to USD`}>
                            {r.convertedFrom}→$
                          </span>
                        )}
                        {/* Thin coverage undermines everything downstream of it,
                            and is invisible once a row is just a number. */}
                        {r.analystCount > 0 && r.analystCount < 3 && (
                          <span
                            className="ml-1.5 text-[10px] text-dn"
                            title={`Only ${r.analystCount} analyst${
                              r.analystCount === 1 ? '' : 's'
                            } covers this year`}
                          >
                            ({r.analystCount})
                          </span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="tabular px-3 py-2 text-right text-t2">
                    {multiple(r.exitPe)}
                    {r.exitCapNote && (
                      <span className="ml-1 text-[10px] text-warn" title={r.exitCapNote}>
                        cap
                      </span>
                    )}
                  </td>
                  <td className="tabular px-3 py-2 text-right text-t2">
                    {multiple(r.requiredExitPe)}
                  </td>
                  <td
                    className={`tabular px-3 py-2 text-right ${
                      r.stretch === null ? 'text-t4' : r.stretch > 0 ? 'text-dn' : 'text-up'
                    }`}
                    title="How far above the anchor multiple the price needs to re-rate"
                  >
                    {r.stretch !== null ? signedPct(r.stretch, 0) : '—'}
                  </td>
                  <td className="tabular px-3 py-2 text-right text-t3">
                    {r.dividendYield > 0 ? pct(r.dividendYield) : '—'}
                  </td>
                  <td
                    className={`tabular px-3 py-2 text-right font-semibold ${
                      r.expectedCagr === null
                        ? 'text-t4'
                        : r.clearsHurdle
                          ? 'text-up'
                          : 'text-dn'
                    }`}
                  >
                    {r.expectedCagr !== null ? signedPct(r.expectedCagr) : (
                      <span className="text-[10px] font-normal" title={r.note}>
                        {r.note ?? '—'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
