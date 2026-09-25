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
          {expected.review
            ? `${expected.review}. Output this far outside the plausible range points to a data problem — a currency mix-up or a broken multiple history — so it is not shown as a result.`
            : 'Not available. This needs consensus earnings at the horizon and an exit multiple that can be compared to the quoted price.'}
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
      } · year ends in ${num(expected.yearsToHorizon, 1)} years${
        expected.convertedFrom ? ` · converted from ${expected.convertedFrom}` : ''
      }`}
    >
      {expected.horizonNote && (
        <div className="border-b border-line bg-warn/[0.08] px-4 py-3">
          <Badge tone="flat">Horizon shortened for coverage</Badge>
          <p className="mt-2 text-[12px] leading-relaxed text-t3">{expected.horizonNote}</p>
        </div>
      )}
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
      {expected.basis.materialGap && (
        <div className="border-b border-line bg-warn/[0.08] px-4 py-3">
          <Badge tone="flat">
            Adjusted earnings run {expected.basis.medianRatio?.toFixed(2)}× GAAP
          </Badge>
          <p className="mt-2 text-[12px] leading-relaxed text-t3">{expected.basis.note}</p>
          {expected.basis.years.length > 0 && (
            <table className="tabular mt-3 w-full text-[11px]">
              <thead>
                <tr className="text-t4">
                  <th className="pb-1 text-left font-medium">Year</th>
                  <th className="pb-1 text-right font-medium">GAAP</th>
                  <th className="pb-1 text-right font-medium">Adjusted</th>
                  <th className="pb-1 text-right font-medium">Ratio</th>
                </tr>
              </thead>
              <tbody>
                {expected.basis.years.slice(0, 5).map((y) => (
                  <tr key={y.year} className="text-t2">
                    <td className="py-0.5">{y.year}</td>
                    <td className="py-0.5 text-right">{num(y.gaapEps)}</td>
                    <td className="py-0.5 text-right">{num(y.adjustedEps)}</td>
                    <td className="py-0.5 text-right text-t3">{num(y.ratio)}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
      <div className="stat-grid border-b border-line md:grid-cols-4">
        <Stat
          label="Expected CAGR"
          value={pct(result.totalCagr)}
          tone={result.totalCagr - expected.hurdle}
          sub={`${pct(result.priceCagr)} price + ${pct(expected.dividendYield)} ${
            expected.dividendMethod === 'trailing' ? 'trailing' : 'forward'
          } yield`}
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
          Using {expected.exitPeSource ?? 'none'}, computed on{' '}
          {expected.peBasis === 'adjusted' ? 'adjusted' : 'GAAP'} earnings to match the basis the
          forecast is quoted on. The median survives one anchor being wrong in either direction;
          the minimum would let a stale one decide the answer.
        </p>
      </div>
      {anchors.map((a) => (
        <Row
          key={a.label}
          label={a.excluded ? `${a.label} (excluded)` : a.label}
          value={multiple(a.value)}
          hint={a.detail}
        />
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
          <div className="stat-grid border-t border-line md:grid-cols-4">
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
