import { describe, expect, it } from 'vitest';
import { fixedAssetIntensity, latestCapexSplit, splitCapex, type CapexYear } from '../capex';

/** Microsoft's actual figures, the case that motivated the split. */
const msft: CapexYear[] = [
  { date: '2022-06-30', revenue: 198270e6, capitalExpenditure: -23886e6, depreciationAndAmortization: 14460e6, operatingCashFlow: 89035e6, propertyPlantEquipmentNet: 87546e6 },
  { date: '2023-06-30', revenue: 211915e6, capitalExpenditure: -28107e6, depreciationAndAmortization: 13861e6, operatingCashFlow: 87582e6, propertyPlantEquipmentNet: 109987e6 },
  { date: '2024-06-30', revenue: 245122e6, capitalExpenditure: -44477e6, depreciationAndAmortization: 22287e6, operatingCashFlow: 118548e6, propertyPlantEquipmentNet: 154552e6 },
  { date: '2025-06-30', revenue: 281724e6, capitalExpenditure: -64551e6, depreciationAndAmortization: 34153e6, operatingCashFlow: 136162e6, propertyPlantEquipmentNet: 229761e6 },
  { date: '2026-06-30', revenue: 331838e6, capitalExpenditure: -115948e6, depreciationAndAmortization: 38534e6, operatingCashFlow: 182935e6, propertyPlantEquipmentNet: 337253e6 },
];

describe('fixedAssetIntensity', () => {
  it('measures the fixed assets carried per dollar of sales', () => {
    const intensity = fixedAssetIntensity(msft)!;
    expect(intensity).toBeGreaterThan(0.4);
    expect(intensity).toBeLessThan(1.0);
  });

  it('returns null when no year can be measured', () => {
    expect(fixedAssetIntensity([])).toBeNull();
    expect(
      fixedAssetIntensity([{ ...msft[0], revenue: 0, propertyPlantEquipmentNet: 0 }]),
    ).toBeNull();
  });
});

describe('splitCapex', () => {
  it('flags the two methods disagreeing when a company builds ahead of demand', () => {
    const latest = latestCapexSplit(msft)!;
    expect(latest.method).toBe('greenwald');
    // Greenwald sees only the $50bn sales increase, so it books $82bn of the
    // $116bn as maintenance -- more than twice the $38bn depreciation charge,
    // which is not a credible cost of standing still. The disagreement is the
    // signal, and it is surfaced rather than resolved silently.
    expect(latest.maintenanceCapex).toBeGreaterThan(latest.maintenanceCapexFromDepreciation * 2);
    expect(latest.methodsDisagree).toBe(true);
  });

  it('defaults to the more conservative of the two owner figures', () => {
    const latest = latestCapexSplit(msft)!;
    expect(latest.conservativeOwnerFreeCashFlow).toBe(
      Math.min(latest.ownerFreeCashFlow, latest.ownerFreeCashFlowFromDepreciation),
    );
    expect(latest.ownerFreeCashFlowFromDepreciation).toBeGreaterThan(latest.ownerFreeCashFlow);
  });

  it('lifts owner cash flow well above the reported figure mid-investment', () => {
    const latest = latestCapexSplit(msft)!;
    // Reported free cash flow is ~$67bn on $183bn of operating cash flow.
    expect(latest.reportedFreeCashFlow).toBeCloseTo(66987e6, -9);
    expect(latest.ownerFreeCashFlow).toBeGreaterThan(latest.reportedFreeCashFlow);
    // The whole point: the existing business throws off far more than reported.
    expect(latest.ownerFreeCashFlow).toBeGreaterThan(100e9);
  });

  it('never reports negative maintenance or more than was actually spent', () => {
    for (const s of splitCapex(msft)) {
      expect(s.maintenanceCapex).toBeGreaterThanOrEqual(0);
      expect(s.maintenanceCapex).toBeLessThanOrEqual(s.totalCapex);
      expect(s.growthCapex).toBeGreaterThanOrEqual(0);
    }
  });

  it('treats a shrinking year as entirely maintenance', () => {
    const shrinking: CapexYear[] = [
      { ...msft[0], date: '2024-01-01', revenue: 200e9 },
      { ...msft[0], date: '2025-01-01', revenue: 180e9, capitalExpenditure: -10e9 },
    ];
    const last = latestCapexSplit(shrinking)!;
    expect(last.growthCapex).toBe(0);
    expect(last.maintenanceCapex).toBe(10e9);
  });

  it('falls back to depreciation for the first year, with no prior to compare', () => {
    expect(splitCapex(msft)[0].method).toBe('depreciation');
  });

  it('falls back to depreciation when fixed assets are not reported', () => {
    const assetLight = msft.map((y) => ({ ...y, propertyPlantEquipmentNet: 0 }));
    const last = latestCapexSplit(assetLight)!;
    expect(last.method).toBe('depreciation');
    expect(last.maintenanceCapex).toBe(38534e6);
    expect(last.methodsDisagree).toBe(false);
  });

  it('handles an empty history', () => {
    expect(latestCapexSplit([])).toBeNull();
  });
});
