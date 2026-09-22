import type { ValuationReport } from '@/lib/valuation/build';
import { Badge, Panel, Row, Stat } from './ui';
import { money, multiple, num, pct, signedPct } from '@/lib/format';

type Expected = ValuationReport['expectedReturn'];

/**
 * The house valuation: consensus earnings at a horizon, an exit multiple, and
 * the annualised return that implies. The reverse of it — the multiple today's
 * price requires to clear the hurdle — is shown beside it, because "what must
 * I believe" is the more answerable question.
 */
export function ExpectedReturnPanel({
  expected,
  price,
  currency,
}: {
  expected: Expected;
  price: number;
  currency: string;
}) {
  const { result, anchors, scenarios } = expected;

  if (!result) {
    return (
      <Panel eyebrow="Expected return" title={`${expected.horizonYears}-year total return`}>
        <p className="px-4 py-6 text-[12px] leading-relaxed text-t3">
          Not available. This needs consensus earnings at the horizon and an exit multiple that
          can be compared to the quoted price.
        </p>
      </Panel>
    );
  }

  const clears = result.totalCagr >= expected.hurdle;

  return (
    <Panel
      eyebrow="Expected return"
      title={`${expected.horizonYears}-year total return`}
      subtitle={`FY${expected.horizonFiscalYear} consensus · ${expected.analystCount} ${
        expected.analystCount === 1 ? 'analyst' : 'analysts'
      }`}
    >
      {expected.analystCount > 0 && expected.analystCount < 3 && (
        <div className="border-b border-line bg-dn/[0.08] px-4 py-3">
          <Badge tone="neg">
            {expected.analystCount === 1 ? 'One analyst' : `${expected.analystCount} analysts`}{' '}
            covers FY{expected.horizonFiscalYear}
          </Badge>
          <p className="mt-2 text-[12px] leading-relaxed text-t3">
            Every figure in this panel rests on that estimate. Coverage thins sharply a few years
            out, and a single forecast is one person&apos;s model, not a consensus.
          </p>
        </div>
      )}
      {expected.anchorsDisagree && (
        <div className="border-b border-line bg-warn/[0.08] px-4 py-3">
          <Badge tone="flat">
            Exit multiple anchors disagree by {expected.anchorSpread?.toFixed(1)}×
          </Badge>
          <p className="mt-2 text-[12px] leading-relaxed text-t3">{expected.disagreementNote}</p>
        </div>
      )}
      <div className="grid grid-cols-2 divide-x divide-line border-b border-line md:grid-cols-4">
        <Stat
          label="Expected CAGR"
          value={pct(result.totalCagr)}
          tone={result.totalCagr - expected.hurdle}
          sub={`${pct(result.priceCagr)} price + ${pct(expected.dividendYield)} yield`}
        />
        <Stat
          label={`Target price ${expected.horizonFiscalYear ?? ''}`}
          value={money(result.targetPrice, currency)}
          sub={`${num(expected.epsAtHorizon)} EPS × ${num(expected.exitPe)}`}
        />
        <Stat
          label="Discount to target"
          value={pct(result.discountToTarget)}
          tone={result.discountToTarget - (expected.requiredDiscount ?? 0)}
          sub={`${pct(expected.requiredDiscount)} needed for ${pct(expected.hurdle, 0)}`}
        />
        <Stat
          label="Must believe"
          value={multiple(expected.requiredExitMultiple)}
          sub={`Exit multiple to clear ${pct(expected.hurdle, 0)}`}
        />
      </div>

      <div className="border-b border-line px-4 py-3">
        <Badge tone={clears ? 'pos' : 'neg'}>
          {clears
            ? `Clears the ${pct(expected.hurdle, 0)} hurdle at ${num(expected.exitPe)}×`
            : `Falls short of ${pct(expected.hurdle, 0)} — needs ${multiple(
                expected.requiredExitMultiple,
              )}× versus ${num(expected.exitPe)}× assumed`}
        </Badge>
      </div>

      <div className="px-4 py-3">
        <p className="eyebrow-muted">Exit multiple anchors</p>
        <p className="mt-1.5 text-[11px] text-t4">
          Using {expected.exitPeSource ?? 'none'}. The median survives one anchor being wrong in
          either direction; the minimum would let a stale one decide the answer.
        </p>
      </div>
      {anchors.map((a) => (
        <Row key={a.label} label={a.label} value={multiple(a.value)} hint={a.detail} />
      ))}

      {scenarios && (
        <>
          <div className="border-t border-line px-4 py-3">
            <p className="eyebrow-muted">
              Scenario range · {scenarios.cells.length} outcomes
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-t3">
              Analyst earnings range against an exit multiple 20% either side of the anchor.
            </p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-line border-t border-line md:grid-cols-4">
            <Stat
              label="Clears hurdle"
              value={pct(scenarios.hitRate, 0)}
              tone={scenarios.hitRate - 0.5}
              sub="Share of outcomes"
            />
            <Stat label="Worst case" value={signedPct(scenarios.worstCagr)} tone={scenarios.worstCagr} />
            <Stat label="Median" value={signedPct(scenarios.medianCagr)} tone={scenarios.medianCagr} />
            <Stat label="Best case" value={signedPct(scenarios.bestCagr)} tone={scenarios.bestCagr} />
          </div>
        </>
      )}
      <div className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-t4">
        Today&apos;s price {money(price, currency)}. Dividends are added to the price return rather
        than reinvested.
      </div>
    </Panel>
  );
}
