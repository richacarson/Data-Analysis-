import { describe, expect, it } from 'vitest';
import { peerMedian } from '../peer-pe';
import { exitMultipleAnchors } from '../exit-multiple';

describe('peerMedian', () => {
  it('takes the median of usable peers and says who was left out', () => {
    const m = peerMedian([
      { symbol: 'AEE', pe: 21.3 },
      { symbol: 'CNP', pe: 19.8 },
      { symbol: 'DTE', pe: 18.9 },
      { symbol: 'ES', pe: -30 },
      { symbol: 'FE', pe: 150 },
      { symbol: 'PPL', pe: null },
    ])!;
    expect(m.value).toBeCloseTo(19.8, 6);
    expect(m.used.map((p) => p.symbol)).toEqual(['DTE', 'CNP', 'AEE']);
    expect(m.dropped).toEqual(['ES', 'FE', 'PPL']);
  });

  it('averages the middle two of an even set', () => {
    expect(peerMedian([{ symbol: 'A', pe: 10 }, { symbol: 'B', pe: 20 }, { symbol: 'C', pe: 30 }, { symbol: 'D', pe: 40 }])!.value).toBe(25);
  });

  it('needs three usable peers', () => {
    expect(peerMedian([{ symbol: 'A', pe: 10 }, { symbol: 'B', pe: 20 }, { symbol: 'C', pe: null }])).toBeNull();
  });
});

describe('peer anchor', () => {
  it('replaces the industry rows and lists the peers', () => {
    const peers = peerMedian([
      { symbol: 'AEE', pe: 21.3 },
      { symbol: 'CNP', pe: 19.8 },
      { symbol: 'DTE', pe: 18.9 },
    ]);
    const a = exitMultipleAnchors({ ownHistory: [21, 20, 22, 19, 21], industryPe: 8.03, industryMedian: 7.8, justified: 2.6, justifiedExcluded: 'Excluded', peers });
    const labels = a.anchors.map((x) => x.label);
    expect(labels).toContain('Peer median');
    expect(labels).not.toContain('Industry now');
    expect(a.anchors.find((x) => x.label === 'Peer median')!.detail).toMatch(/AEE 21\.3x/);
    // Atmos-like: own history ~21x and peers ~20x, with the broken anchors gone.
    expect(a.recommended!).toBeGreaterThan(19);
  });
});
