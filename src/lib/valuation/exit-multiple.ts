/**
 * Choosing the exit multiple.
 *
 * Over a three-year horizon the exit multiple does most of the work: for a
 * company compounding earnings at 10%, three years of growth is worth +33%
 * while moving from 25x to 30x is worth +20%. Since it is also the most
 * judgement-laden input, it deserves several independent anchors rather than
 * one guess.
 */

export interface MultipleAnchor {
  label: string;
  value: number | null;
  detail: string;
}

export interface ExitMultipleAnchors {
  anchors: MultipleAnchor[];
  /** The most conservative anchor available, used as the default. */
  recommended: number | null;
  recommendedSource: string | null;
}

/** Median of a list, ignoring values that cannot be a multiple. */
export function median(values: Array<number | null | undefined>): number | null {
  const usable = values
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (!usable.length) return null;
  const mid = Math.floor(usable.length / 2);
  return usable.length % 2 === 0 ? (usable[mid - 1] + usable[mid]) / 2 : usable[mid];
}

export function percentile(values: number[], p: number): number | null {
  const usable = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!usable.length) return null;
  const idx = Math.min(usable.length - 1, Math.max(0, Math.round((usable.length - 1) * p)));
  return usable[idx];
}

export interface AnchorInputs {
  /** Trailing P/E at each fiscal year end, newest first. */
  ownHistory: Array<number | null | undefined>;
  /** Current industry P/E, if the industry is covered. */
  industryPe?: number | null;
  /** Median industry P/E over the period fetched, to spot a stretched sector. */
  industryMedian?: number | null;
  /** P/E justified by returns on capital and growth. */
  justified?: number | null;
}

/**
 * Assembles the anchors and picks a default.
 *
 * The default is deliberately the lowest available. An exit multiple is the
 * assumption most likely to flatter a thesis, so the tool should not be the
 * one arguing for a higher number.
 */
export function exitMultipleAnchors(input: AnchorInputs): ExitMultipleAnchors {
  const tenYear = median(input.ownHistory.slice(0, 10));
  const fiveYear = median(input.ownHistory.slice(0, 5));

  const anchors: MultipleAnchor[] = [
    {
      label: 'Own 10-year median',
      value: tenYear,
      detail: 'What the market has actually paid for this company across a cycle.',
    },
    {
      label: 'Own 5-year median',
      value: fiveYear,
      detail:
        'Closer to the business as it trades today. Where it diverges from the 10-year figure, the company or its rating has changed.',
    },
    {
      label: 'Industry now',
      value: input.industryPe ?? null,
      detail: 'Current industry multiple. Anchoring here imports the sector rating as-is.',
    },
    {
      label: 'Industry median',
      value: input.industryMedian ?? null,
      detail:
        'The industry against its own recent history, so a sector trading at an extreme is visible rather than inherited.',
    },
    {
      label: 'Justified by ROIC',
      value: input.justified ?? null,
      detail:
        'What the economics support: (1 - g/ROIC) / (r - g). Independent of what anyone is paying today.',
    },
  ];

  const usable = anchors.filter(
    (a): a is MultipleAnchor & { value: number } => a.value !== null && a.value > 0,
  );
  if (!usable.length) {
    return { anchors, recommended: null, recommendedSource: null };
  }

  const lowest = usable.reduce((min, a) => (a.value < min.value ? a : min));
  return { anchors, recommended: lowest.value, recommendedSource: lowest.label };
}
