import type { PeerMedian } from './peer-pe';

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
  /** Shown for reference but left out of the default, with the reason in `detail`. */
  excluded?: boolean;
}

export interface ExitMultipleAnchors {
  anchors: MultipleAnchor[];
  /** Median of the available anchors, used as the default. */
  recommended: number | null;
  recommendedSource: string | null;
  /** Highest anchor divided by lowest. Above 2 means they tell different stories. */
  spread: number | null;
  /** Set where the anchors disagree enough that the default is doing real work. */
  anchorsDisagree: boolean;
  disagreementNote: string | null;
}

/** Above this, an industry P/E is an artifact of its constituents' earnings. */
export const MAX_INDUSTRY_PE = 80;

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
  /**
   * Set when the industry figures are not comparable to the forecast: they are
   * computed on GAAP earnings, so for a company whose adjusted earnings run far
   * above GAAP they overstate the multiple the forecast should carry.
   */
  industryNotComparable?: string | null;
  /** Set when the industry figures describe other companies (another exchange) or a past date. */
  industryExcluded?: string | null;
  /** Set when returns on capital cannot justify a multiple for this kind of business. */
  justifiedExcluded?: string | null;
  /**
   * Median trailing P/E of the company's listed peers. When present it is the
   * sector anchor, in place of FMP's industry figures (see peer-pe.ts).
   */
  peers?: PeerMedian | null;
}

/**
 * Assembles the anchors and picks a default.
 *
 * The default is the median rather than the lowest. Taking the minimum sounds
 * conservative but lets a single stale anchor decide the answer: Celestica has
 * traded at 14x as a low-margin contract manufacturer while its industry, and
 * the multiple its current returns on capital justify, both sit near 33x. Its
 * own history is a different company, and the minimum rule handed that history
 * the entire valuation.
 *
 * The median survives one anchor being wrong in either direction. Where the
 * anchors disagree by more than a factor of two the spread is reported, since
 * that is the signal that the business or its rating has changed and the choice
 * of multiple deserves a human.
 */
export function exitMultipleAnchors(input: AnchorInputs): ExitMultipleAnchors {
  const peerAnchor: MultipleAnchor | null = input.peers
    ? {
        label: 'Peer median',
        value: input.peers.value,
        detail: `Median trailing P/E of ${input.peers.used.length} peers FMP lists: ${input.peers.used
          .map((p) => `${p.symbol} ${p.pe.toFixed(1)}x`)
          .join(', ')}${
          input.peers.dropped.length ? `. Left out, with no earnings or a P/E over 100x: ${input.peers.dropped.join(', ')}` : ''
        }. On GAAP earnings; anchoring here imports the peers' rating as-is.`,
      }
    : null;
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
    ...(peerAnchor
      ? [peerAnchor]
      : [
          {
            label: 'Industry now',
            value: input.industryPe ?? null,
            detail:
              'Current industry multiple, on GAAP earnings. Anchoring here imports the sector rating as-is.',
          },
          {
            label: 'Industry median',
            value: input.industryMedian ?? null,
            detail:
              'The industry over the past year, on GAAP earnings, so a sector trading at an extreme is visible rather than inherited.',
          },
        ]),
    {
      label: 'Justified by ROIC',
      value: input.justified ?? null,
      detail:
        'What the economics support: (1 - g/ROIC) / (r - g). Independent of what anyone is paying today.',
    },
  ];

  /*
   * FMP's industry P/E averages its constituents, so a few near-zero earners
   * can put a whole sector at 97x (aerospace and defense, for BWX Technologies
   * and Lockheed) or a sector with losses at 0x (Nutrien). Neither is a rating
   * anything trades on.
   */
  for (const a of anchors) {
    if (!a.label.startsWith('Industry') || a.value === null) continue;
    if (!(a.value > 0) || a.value > MAX_INDUSTRY_PE) {
      a.excluded = true;
      a.detail = `Excluded: an industry P/E of ${a.value.toFixed(1)}x reflects constituents with near-zero or negative earnings, not a multiple the sector trades on.`;
    }
  }

  for (const a of anchors) {
    if (a.value === null) continue;
    const reason = a.label.startsWith('Industry') ? input.industryExcluded : a.label.startsWith('Justified') ? input.justifiedExcluded : null;
    if (reason) {
      a.excluded = true;
      a.detail = reason;
    }
  }

  if (input.industryNotComparable) {
    for (const a of anchors) {
      if ((a.label.startsWith('Industry') || a.label.startsWith('Peer')) && a.value !== null) {
        a.excluded = true;
        a.detail = input.industryNotComparable;
      }
    }
  }

  const usable = anchors.filter(
    (a): a is MultipleAnchor & { value: number } =>
      !a.excluded && a.value !== null && a.value > 0,
  );
  if (!usable.length) {
    return {
      anchors,
      recommended: null,
      recommendedSource: null,
      spread: null,
      anchorsDisagree: false,
      disagreementNote: null,
    };
  }

  const values = usable.map((a) => a.value);
  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  const spread = lowest > 0 ? highest / lowest : null;
  const anchorsDisagree = spread !== null && spread > 2;

  return {
    anchors,
    recommended: median(values),
    recommendedSource: `Median of ${usable.length} anchors`,
    spread,
    anchorsDisagree,
    disagreementNote: anchorsDisagree
      ? `The anchors range from ${lowest.toFixed(1)}x to ${highest.toFixed(1)}x. That usually means the business has changed and its own history no longer describes it, or the sector is trading at an extreme. Worth setting this by hand.`
      : null,
  };
}
