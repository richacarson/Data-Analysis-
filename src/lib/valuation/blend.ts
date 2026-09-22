/**
 * Combining the valuation models.
 *
 * The previous behaviour averaged four of them into one "blended fair value",
 * which treated a 1930s deep-value formula, a deliberate zero-growth floor and
 * two growth models as four equal opinions. On an asset-light compounder the
 * Graham number and earnings power value sit far below the others by
 * construction, so averaging them in dragged the headline down and called the
 * result a valuation.
 *
 * Each model has a role instead: growth models give a range, the floor is
 * labelled a floor, and the deep-value cross-check is reported beside them
 * rather than inside them.
 */

export type ModelRole = 'range' | 'floor' | 'cross-check';

export interface RoledModel {
  label: string;
  value: number;
  role: ModelRole;
  note: string;
}

export interface FairValueRange {
  low: number | null;
  high: number | null;
  /** Midpoint of the growth models only, for a single number when one is needed. */
  midpoint: number | null;
  models: RoledModel[];
  floor: RoledModel | null;
  crossChecks: RoledModel[];
}

export interface ModelCandidate {
  label: string;
  value: number | null;
  applies: boolean;
}

/**
 * Whether the Graham number says anything about this business.
 *
 * It values a company on earnings and book value, which assumes book value
 * approximates what the assets are worth. For a software company whose value
 * is people and code, book value is close to meaningless, and the formula
 * returns a number far below any defensible valuation every time.
 */
export function grahamIsInformative(
  returnOnInvestedCapital: number,
  intangiblesShareOfAssets: number,
): boolean {
  // A business earning far above its cost of capital is not worth its balance
  // sheet, and one whose assets are mostly intangible has no usable book value.
  if (returnOnInvestedCapital > 0.2) return false;
  if (intangiblesShareOfAssets > 0.3) return false;
  return true;
}

export function fairValueRange(input: {
  fcfDcf: ModelCandidate;
  earningsDcf: ModelCandidate;
  earningsPower: ModelCandidate;
  graham: ModelCandidate;
  grahamInformative: boolean;
}): FairValueRange {
  const usable = (c: ModelCandidate): boolean =>
    c.applies && c.value !== null && Number.isFinite(c.value) && c.value > 0;

  const models: RoledModel[] = [];
  for (const [candidate, note] of [
    [input.fcfDcf, 'Discounted free cash flow.'],
    [input.earningsDcf, 'Discounted consensus earnings.'],
  ] as const) {
    if (usable(candidate)) {
      models.push({
        label: candidate.label,
        value: candidate.value as number,
        role: 'range',
        note,
      });
    }
  }

  const floor: RoledModel | null = usable(input.earningsPower)
    ? {
        label: input.earningsPower.label,
        value: input.earningsPower.value as number,
        role: 'floor',
        note: 'Assumes no growth at all, so it is a floor rather than an estimate.',
      }
    : null;

  const crossChecks: RoledModel[] = [];
  if (usable(input.graham) && input.grahamInformative) {
    crossChecks.push({
      label: input.graham.label,
      value: input.graham.value as number,
      role: 'cross-check',
      note: 'Deep-value formula on earnings and book value. A cross-check, not a vote.',
    });
  }

  const values = models.map((m) => m.value);
  return {
    low: values.length ? Math.min(...values) : null,
    high: values.length ? Math.max(...values) : null,
    midpoint: values.length ? values.reduce((s, v) => s + v, 0) / values.length : null,
    models,
    floor,
    crossChecks,
  };
}
