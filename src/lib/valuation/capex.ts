/**
 * Splitting capital spending into maintenance and growth.
 *
 * Reported free cash flow subtracts every dollar of capital spending, which
 * treats building new capacity the same as replacing worn-out capacity. For a
 * company mid-investment that understates the cash the existing business
 * throws off, and a valuation built on it punishes the company for investing:
 * Microsoft's capex went from $24bn to $116bn over four years for AI capacity,
 * leaving reported free cash flow flat at ~$67bn on earnings of $134bn.
 *
 * Bruce Greenwald's method: the capital needed to support a dollar of sales is
 * roughly the ratio of fixed assets to sales, so the spending attributable to
 * growth is that ratio applied to the increase in sales. What is left is
 * maintenance.
 */

export interface CapexYear {
  date: string;
  revenue: number;
  /** Reported as a negative outflow by the API; sign is normalised here. */
  capitalExpenditure: number;
  depreciationAndAmortization: number;
  operatingCashFlow: number;
  propertyPlantEquipmentNet: number;
}

export interface CapexSplit {
  date: string;
  totalCapex: number;
  /** Greenwald: spending not explained by the sales increase already achieved. */
  maintenanceCapex: number;
  growthCapex: number;
  /** Depreciation as the older proxy for capacity consumed. */
  maintenanceCapexFromDepreciation: number;
  /** Operating cash flow less Greenwald maintenance spending. */
  ownerFreeCashFlow: number;
  /** Operating cash flow less depreciation. */
  ownerFreeCashFlowFromDepreciation: number;
  /**
   * The lower of the two owner figures. The methods disagree most where a
   * company builds ahead of demand, and the conservative one is the default.
   */
  conservativeOwnerFreeCashFlow: number;
  reportedFreeCashFlow: number;
  method: 'greenwald' | 'depreciation';
  /** True where the two estimates are more than a quarter apart. */
  methodsDisagree: boolean;
  /** Which method produced the lower, and therefore used, owner cash flow. */
  conservativeMethod: 'greenwald' | 'depreciation';
}

/** Fixed assets required per dollar of sales, averaged to smooth one-off years. */
export function fixedAssetIntensity(years: CapexYear[]): number | null {
  const ratios = years
    .filter((y) => y.revenue > 0 && y.propertyPlantEquipmentNet > 0)
    .map((y) => y.propertyPlantEquipmentNet / y.revenue);
  if (!ratios.length) return null;
  return ratios.reduce((s, r) => s + r, 0) / ratios.length;
}

/**
 * Splits each year's capital spending, by both methods.
 *
 * Greenwald attributes to growth only the capital supporting sales already
 * booked, so a company building capacity ahead of demand has that spending
 * counted as maintenance. Microsoft in FY2026 is the case: $116bn spent
 * against a $50bn sales increase leaves $82bn classed as maintenance, more
 * than twice its $38bn depreciation charge, which is not credible as the cost
 * of standing still.
 *
 * Neither estimate is reliable alone, so both are reported and the lower owner
 * cash flow is the default.
 */
export function splitCapex(years: CapexYear[]): CapexSplit[] {
  const chronological = [...years].sort((a, b) => a.date.localeCompare(b.date));
  const intensity = fixedAssetIntensity(chronological);

  return chronological.map((year, i) => {
    const totalCapex = Math.abs(year.capitalExpenditure);
    const previous = i > 0 ? chronological[i - 1] : null;

    const fromDepreciation = Math.min(totalCapex, Math.abs(year.depreciationAndAmortization));

    let maintenanceCapex = fromDepreciation;
    let method: CapexSplit['method'] = 'depreciation';

    if (intensity !== null && previous && previous.revenue > 0) {
      const revenueGrowth = year.revenue - previous.revenue;
      // Only growing sales consume growth capital. A shrinking year does not
      // release cash, so its entire spend is treated as maintenance.
      const growthCapex = revenueGrowth > 0 ? revenueGrowth * intensity : 0;
      maintenanceCapex = Math.max(0, Math.min(totalCapex, totalCapex - growthCapex));
      method = 'greenwald';
    }

    const ownerFreeCashFlow = year.operatingCashFlow - maintenanceCapex;
    const ownerFreeCashFlowFromDepreciation = year.operatingCashFlow - fromDepreciation;
    const spread = Math.abs(ownerFreeCashFlow - ownerFreeCashFlowFromDepreciation);
    const scale = Math.max(Math.abs(ownerFreeCashFlowFromDepreciation), 1);

    return {
      date: year.date,
      totalCapex,
      maintenanceCapex,
      growthCapex: totalCapex - maintenanceCapex,
      maintenanceCapexFromDepreciation: fromDepreciation,
      ownerFreeCashFlow,
      ownerFreeCashFlowFromDepreciation,
      conservativeOwnerFreeCashFlow: Math.min(
        ownerFreeCashFlow,
        ownerFreeCashFlowFromDepreciation,
      ),
      reportedFreeCashFlow: year.operatingCashFlow - totalCapex,
      method,
      methodsDisagree: spread / scale > 0.25,
      conservativeMethod:
        ownerFreeCashFlow <= ownerFreeCashFlowFromDepreciation ? 'greenwald' : 'depreciation',
    };
  });
}

/**
 * The most recent year's split, which is what a forward valuation grows from.
 */
export function latestCapexSplit(years: CapexYear[]): CapexSplit | null {
  const split = splitCapex(years);
  return split.length ? split[split.length - 1] : null;
}
