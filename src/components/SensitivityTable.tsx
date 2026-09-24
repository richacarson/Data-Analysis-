import { money, pct, roundMoney, signedPct } from '@/lib/format';
import type { SensitivityCell } from '@/lib/valuation/dcf';

/**
 * Diverging scale around the current price: oxblood below, neutral at parity,
 * forest above. Two hues either side of a neutral midpoint, never a rainbow.
 */
function cellTone(upside: number): string {
  if (upside >= 0.4) return 'bg-up/30 text-t1';
  if (upside >= 0.15) return 'bg-up/[0.18] text-t1';
  if (upside >= 0) return 'bg-up/[0.08] text-t2';
  if (upside >= -0.15) return 'bg-dn/10 text-t2';
  if (upside >= -0.4) return 'bg-dn/20 text-t1';
  return 'bg-dn/[0.32] text-t1';
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
    <div className="overflow-x-auto p-3 sm:p-4">
      <table className="w-full border-separate border-spacing-0.5 text-[11px] sm:text-[12px]">
        <caption className="sr-only">
          Fair value per share across discount rate and terminal growth assumptions
        </caption>
        <thead>
          <tr>
            <th scope="col" className="px-1 py-1.5 text-left sm:px-2">
              <span className="eyebrow-muted">WACC ╲ g</span>
            </th>
            {columns.map((c) => (
              <th
                key={c.terminalGrowth}
                scope="col"
                className="tabular px-1 py-1.5 text-right text-[10px] font-medium text-t3 sm:px-2 sm:text-[11px]"
              >
                {pct(c.terminalGrowth, 1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row) => (
            <tr key={row[0].discountRate}>
              <th
                scope="row"
                className="tabular px-1 py-1.5 text-left text-[10px] font-medium text-t3 sm:px-2 sm:text-[11px]"
              >
                {pct(row[0].discountRate, 1)}
              </th>
              {row.map((cell) => (
                <td
                  key={`${cell.discountRate}-${cell.terminalGrowth}`}
                  className={`tabular px-1 py-2 text-right sm:px-2 sm:py-1.5 ${cellTone(cell.upside)}`}
                  title={`${signedPct(cell.upside)} vs ${money(price, currency)}`}
                >
                  {roundMoney(cell.fairValuePerShare, currency)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-t4">
        Green cells sit above today&apos;s price of {money(price, currency)}; red cells below.
      </p>
    </div>
  );
}
