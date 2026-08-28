import { money, pct, signedPct } from '@/lib/format';
import type { SensitivityCell } from '@/lib/valuation/dcf';

/**
 * Colours each cell by upside so the shape of the valuation is readable at a
 * glance: where the green stops is where the thesis stops working.
 */
function cellTone(upside: number): string {
  if (upside >= 0.4) return 'bg-pos/30 text-ink';
  if (upside >= 0.15) return 'bg-pos/18 text-ink';
  if (upside >= 0) return 'bg-pos/8 text-ink';
  if (upside >= -0.15) return 'bg-neg/10 text-ink';
  if (upside >= -0.4) return 'bg-neg/20 text-ink';
  return 'bg-neg/30 text-ink';
}

export function SensitivityTable({
  grid,
  price,
  currency,
}: {
  grid: SensitivityCell[][];
  price: number;
  currency: string;
}) {
  if (!grid.length) return null;
  const columns = grid[0];

  return (
    <div className="overflow-x-auto p-4">
      <table className="w-full min-w-[640px] border-separate border-spacing-0.5 text-[12px]">
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted">
              WACC ＼ g
            </th>
            {columns.map((c) => (
              <th
                key={c.terminalGrowth}
                className="px-2 py-1.5 text-right text-[11px] font-medium text-muted"
              >
                {pct(c.terminalGrowth, 2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row) => (
            <tr key={row[0].discountRate}>
              <th className="px-2 py-1.5 text-left text-[11px] font-medium text-muted">
                {pct(row[0].discountRate, 2)}
              </th>
              {row.map((cell) => (
                <td
                  key={`${cell.discountRate}-${cell.terminalGrowth}`}
                  className={`tabular rounded px-2 py-1.5 text-right ${cellTone(cell.upside)}`}
                  title={`${signedPct(cell.upside)} vs ${money(price, currency)}`}
                >
                  {money(cell.fairValuePerShare, currency)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-muted">
        Green cells sit above today&apos;s price of {money(price, currency)}; hover any cell for
        the implied upside.
      </p>
    </div>
  );
}
