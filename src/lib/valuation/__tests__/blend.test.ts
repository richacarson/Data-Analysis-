import { describe, expect, it } from 'vitest';
import { fairValueRange, grahamIsInformative } from '../blend';

const candidate = (label: string, value: number | null, applies = true) => ({
  label, value, applies,
});

describe('grahamIsInformative', () => {
  it('rejects it for a high-return business', () => {
    // Earning far above the cost of capital means the company is not worth its
    // balance sheet, which is all the formula measures.
    expect(grahamIsInformative(0.52, 0.05)).toBe(false);
  });

  it('rejects it where the assets are mostly intangible', () => {
    expect(grahamIsInformative(0.1, 0.45)).toBe(false);
  });

  it('keeps it for an asset-heavy, ordinary-return business', () => {
    expect(grahamIsInformative(0.09, 0.05)).toBe(true);
  });
});

describe('fairValueRange', () => {
  const base = {
    fcfDcf: candidate('FCF DCF', 245),
    earningsDcf: candidate('Earnings DCF', 279),
    earningsPower: candidate('Earnings power', 162),
    graham: candidate('Graham number', 147),
    grahamInformative: true,
  };

  it('builds the range from the growth models only', () => {
    const r = fairValueRange(base);
    expect(r.low).toBe(245);
    expect(r.high).toBe(279);
    expect(r.midpoint).toBe(262);
    expect(r.models.map((m) => m.label)).toEqual(['FCF DCF', 'Earnings DCF']);
  });

  it('keeps the floor and the cross-check out of the range', () => {
    const r = fairValueRange(base);
    expect(r.floor?.label).toBe('Earnings power');
    expect(r.crossChecks.map((c) => c.label)).toEqual(['Graham number']);
    // The old behaviour averaged all four to 208, below every growth model.
    expect(r.midpoint!).toBeGreaterThan(208);
  });

  it('drops the Graham cross-check where it says nothing', () => {
    const r = fairValueRange({ ...base, grahamInformative: false });
    expect(r.crossChecks).toHaveLength(0);
  });

  it('narrows to a point when only one growth model applies', () => {
    const r = fairValueRange({ ...base, fcfDcf: candidate('FCF DCF', 245, false) });
    expect(r.low).toBe(279);
    expect(r.high).toBe(279);
    expect(r.midpoint).toBe(279);
  });

  it('reports no range when no growth model applies', () => {
    const r = fairValueRange({
      ...base,
      fcfDcf: candidate('FCF DCF', null, false),
      earningsDcf: candidate('Earnings DCF', null, false),
    });
    expect(r.low).toBeNull();
    expect(r.midpoint).toBeNull();
    // The floor survives, because it is computed differently.
    expect(r.floor).not.toBeNull();
  });

  it('ignores negative and non-finite values', () => {
    const r = fairValueRange({
      ...base,
      fcfDcf: candidate('FCF DCF', -1969),
      earningsPower: candidate('Earnings power', Number.NaN),
    });
    expect(r.models.map((m) => m.label)).toEqual(['Earnings DCF']);
    expect(r.floor).toBeNull();
  });
});
