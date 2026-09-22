import Link from 'next/link';
import { buildValuation } from '@/lib/valuation/build';
import { Badge, Panel, RangeBar, Row, Stat } from '@/components/ui';
import { CashFlowChart, EpsProjectionChart, HistoryChart, ModelSpreadChart } from '@/components/Charts';
import { SensitivityTable } from '@/components/SensitivityTable';
import { ExpectedReturnPanel } from '@/components/ExpectedReturn';
import {
  EpsHistoryChart,
  IndexedChart,
  MarginTtmChart,
  SegmentChart,
} from '@/components/FundamentalCharts';
import {
  bigMoney,
  coverage,
  fiscalYear,
  money,
  multiple,
  nonNegativeRatio,
  num,
  pct,
  signedPct,
} from '@/lib/format';

export const revalidate = 3600;

export default async function StockPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { symbol } = await params;
  const query = await searchParams;

  const overrides = {
    discountRate: query.discountRate ? Number(query.discountRate) : undefined,
    terminalGrowth: query.terminalGrowth ? Number(query.terminalGrowth) : undefined,
    forecastYears: query.forecastYears ? Number(query.forecastYears) : undefined,
  };

  let report;
  try {
    report = await buildValuation(symbol, overrides);
  } catch (error) {
    return (
      <div className="panel p-8">
        <h1 className="text-lg font-semibold">Could not load {symbol.toUpperCase()}</h1>
        <p className="mt-2 text-[13px] text-t3">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <p className="mt-4 text-[13px] text-t3">
          Visit{' '}
          <Link href="/api/health" className="text-gold underline">
            /api/health
          </Link>{' '}
          to see which data feeds are responding.
        </p>
      </div>
    );
  }

  const { profile, models, quality, growth, costOfCapital, growthAdjusted, consensus } = report;
  const { fcfModelApplies, reverseUsable } = report.applicability;
  const currency = profile.currency || 'USD';
  const undervalued = report.upside > 0;

  const epsChartData = models.earningsDcf.years.map((y) => ({
    label: y.label,
    eps: Number(y.eps.toFixed(2)),
    source: y.source,
    presentValue: Number(y.presentValue.toFixed(2)),
  }));

  const historyData = [...report.history.income]
    .reverse()
    .map((inc) => {
      const cf = report.history.cashflow.find((c) => c.date === inc.date);
      return {
        year: fiscalYear(inc.date),
        revenue: inc.revenue,
        netIncome: inc.netIncome,
        freeCashFlow: cf?.freeCashFlow ?? 0,
      };
    });

  return (
    <div className="space-y-4">
      {/* Silently averaging whatever survived would misrepresent the result. */}
      {report.modelNotes.length > 0 && (
        <div className="border border-line bg-surface px-4 py-3">
          <p className="eyebrow-muted">Models not included</p>
          <ul className="mt-2 space-y-1">
            {report.modelNotes.map((n) => (
              <li key={n.label} className="text-[12px] leading-relaxed text-t3">
                <span className="font-medium text-t2">{n.label}</span> — {n.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* A feed that failed is called out rather than being rendered as a zero. */}
      {report.dataIssues.length > 0 && (
        <div className="border border-dn/40 bg-dn/10 px-4 py-3 text-[12px]">
          <p className="font-medium text-t1">
            Some data feeds did not respond — the panels below them may be incomplete.
          </p>
          <ul className="mt-1.5 list-inside list-disc text-t3">
            {report.dataIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          <p className="mt-1.5 text-t3">
            Run{' '}
            <Link href="/api/health" className="text-gold underline">
              /api/health
            </Link>{' '}
            to check every endpoint against your key.
          </p>
        </div>
      )}

      {/* ---- Company header ---- */}
      <div className="panel">
        <div className="flex flex-wrap items-start justify-between gap-5 px-5 py-4">
          <div className="flex items-start gap-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={profile.image}
              alt=""
              className="h-12 w-12 border border-line bg-card object-contain p-1.5"
            />
            <div>
              <p className="eyebrow">
                {profile.exchange} · {report.symbol}
              </p>
              <h1 className="mt-1 font-serif text-[24px] leading-tight tracking-tight text-t1">
                {profile.companyName}
              </h1>
              <p className="mt-1 text-[12px] text-t4">
                {profile.sector} · {profile.industry} · {profile.country}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="eyebrow-muted">Last price</p>
            <div className="tabular mt-1 text-[28px] font-semibold leading-none text-t1">
              {money(report.price, currency)}
            </div>
            <div
              className={`tabular mt-1.5 text-[13px] ${profile.change >= 0 ? 'text-up' : 'text-dn'}`}
            >
              {profile.change >= 0 ? '+' : ''}
              {num(profile.change)} ({signedPct(profile.changePercentage / 100)})
            </div>
          </div>
        </div>
        {/* The gold rule is the brand's one accent per view. */}
        <div className="h-px bg-gold/40" />
      </div>

      {/* ---- Verdict strip ---- */}
      <div className="panel grid grid-cols-2 divide-x divide-line md:grid-cols-5">
        <Stat
          label={`Expected ${report.expectedReturn.horizonYears}y CAGR`}
          value={report.expectedReturn.result ? pct(report.expectedReturn.result.totalCagr) : '—'}
          tone={
            report.expectedReturn.result
              ? report.expectedReturn.result.totalCagr - report.expectedReturn.hurdle
              : undefined
          }
          sub={`Against a ${pct(report.expectedReturn.hurdle, 0)} hurdle`}
        />
        <Stat
          label="Must believe"
          value={multiple(report.expectedReturn.requiredExitMultiple)}
          sub={`Exit multiple for ${pct(report.expectedReturn.hurdle, 0)}`}
        />
        <Stat
          label="Fair value range"
          value={
            report.valueRange.low !== null
              ? `${money(report.valueRange.low, currency)} – ${money(report.valueRange.high!, currency)}`
              : '—'
          }
          sub={
            report.valueRange.models.length
              ? report.valueRange.models.map((m) => m.label).join(' · ')
              : 'No growth model applies here'
          }
        />
        <Stat
          label="Upside to fair value"
          value={signedPct(report.upside)}
          tone={report.upside}
          sub={undervalued ? 'Trading below models' : 'Trading above models'}
        />
        <Stat
          label="ROIC less WACC"
          value={pct(quality.economicSpread)}
          tone={quality.economicSpread}
          sub="Value created per dollar invested"
        />
      </div>

      <ExpectedReturnPanel
        expected={report.expectedReturn}
        price={report.price}
        currency={currency}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---- Model spread ---- */}
        <Panel
          eyebrow="Valuation"
          title="Fair value by model"
          subtitle={`Current price ${money(report.price, currency)}`}
          className="lg:col-span-2"
        >
          <ModelSpreadChart data={report.modelSpread} price={report.price} />
          <div className="border-t border-line">
            {report.valueRange.models.map((m) => (
              <Row key={m.label} label={m.label} value={money(m.value, currency)} hint={m.note} />
            ))}
            {report.valueRange.floor && (
              <Row
                label={`${report.valueRange.floor.label} (floor)`}
                value={money(report.valueRange.floor.value, currency)}
                hint={report.valueRange.floor.note}
              />
            )}
            {report.valueRange.crossChecks.map((c) => (
              <Row
                key={c.label}
                label={`${c.label} (cross-check)`}
                value={money(c.value, currency)}
                hint={c.note}
              />
            ))}
          </div>
          <RangeBar
            low={models.earningsDcf.bearFairValue}
            high={models.earningsDcf.bullFairValue}
            marker={report.price}
            markerLabel={`Price ${money(report.price, currency)}`}
          />
          <div className="border-t border-line">
            <Row
              label="Analyst low / consensus / high"
              value={
                consensus.priceTarget
                  ? `${money(consensus.priceTarget.targetLow, currency)} · ${money(
                      consensus.priceTarget.targetConsensus,
                      currency,
                    )} · ${money(consensus.priceTarget.targetHigh, currency)}`
                  : '—'
              }
            />
          </div>
        </Panel>

        {/* ---- Reverse DCF ---- */}
        <Panel eyebrow="What is priced in"
          title="Reverse DCF" subtitle="What is priced in?">
          <div className="border-b border-line px-4 py-4">
            {reverseUsable ? (
              <p className="pullquote">
                To justify {money(report.price, currency)} today, free cash flow must compound at
                roughly{' '}
                <span className="not-italic font-semibold text-gold">
                  {pct(models.reverseDcf.impliedCagr)}
                </span>{' '}
                a year for {models.fcfDcf.assumptions.years} years.
              </p>
            ) : (
              <p className="text-[12px] leading-relaxed text-t3">
                Not meaningful for this company. A reverse DCF solves for the growth rate implied
                by today&apos;s price, which requires a positive, representative free cash flow to
                grow from.
              </p>
            )}
          </div>
          <Row
            label="Implied year-1 growth"
            value={reverseUsable ? pct(models.reverseDcf.impliedInitialGrowth) : '—'}
          />
          <Row
            label="Implied CAGR"
            value={reverseUsable ? pct(models.reverseDcf.impliedCagr) : '—'}
          />
          <Row
            label="Analyst forward EPS CAGR"
            value={pct(growth.forwardEpsCagr)}
            hint="Consensus growth over the published estimate horizon"
          />
          <Row
            label="Historical FCF CAGR (5y)"
            value={pct(growth.historicalFcfCagr)}
          />
          <div className="px-4 py-3">
            {reverseUsable && growth.forwardEpsCagr !== null && (
              <Badge tone={growth.forwardEpsCagr >= models.reverseDcf.impliedCagr ? 'pos' : 'neg'}>
                {growth.forwardEpsCagr >= models.reverseDcf.impliedCagr
                  ? 'Analysts expect more growth than the price requires'
                  : 'Price requires more growth than analysts expect'}
              </Badge>
            )}
          </div>
        </Panel>
      </div>

      {/* ---- Earnings-projection DCF ---- */}
      <Panel
        eyebrow="Earnings model"
          title="DCF on analyst earnings projections"
        subtitle={`Discounted at cost of equity ${pct(models.earningsDcf.discountRate)} · ${pct(
          models.earningsDcf.fcfConversion,
          0,
        )} cash conversion`}
      >
        <EpsProjectionChart data={epsChartData} />
        <div className="grid grid-cols-2 divide-x divide-line border-t border-line md:grid-cols-4">
          <Stat label="Bear (analyst low)" value={money(models.earningsDcf.bearFairValue, currency)} />
          <Stat
            label="Base (consensus)"
            value={money(models.earningsDcf.fairValuePerShare, currency)}
            tone={models.earningsDcf.fairValuePerShare - report.price}
          />
          <Stat label="Bull (analyst high)" value={money(models.earningsDcf.bullFairValue, currency)} />
          <Stat
            label="Terminal value share"
            value={pct(models.earningsDcf.terminalValueShare)}
            sub="Lower is more defensible"
          />
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---- FCF DCF ---- */}
        <Panel
          eyebrow="Cash flow model"
          title="Free cash flow DCF"
          subtitle={`${models.fcfDcf.assumptions.years}y forecast · fade to ${pct(
            models.fcfDcf.assumptions.terminalGrowth,
          )}`}
        >
          {fcfModelApplies ? (
            <CashFlowChart data={models.fcfDcf.years} />
          ) : (
            <p className="border-b border-line px-4 py-6 text-[12px] leading-relaxed text-t3">
              Not shown for this company. {report.applicability.isFinancial
                ? 'For lenders and insurers, reported free cash flow tracks the loan book and deposit base rather than the economics of the business.'
                : 'Trailing free cash flow is negative, so compounding it forward only produces a larger negative number.'}
            </p>
          )}
          <div className={fcfModelApplies ? 'border-t border-line' : ''}>
            <Row label="Base free cash flow" value={bigMoney(models.fcfDcf.baseCashFlow, currency)} />
            <Row label="PV of forecast" value={bigMoney(models.fcfDcf.pvOfForecast, currency)} />
            <Row label="PV of terminal value" value={bigMoney(models.fcfDcf.pvOfTerminalValue, currency)} />
            <Row label="Enterprise value" value={bigMoney(models.fcfDcf.enterpriseValue, currency)} />
            <Row label="Less net debt" value={bigMoney(report.netDebt, currency)} />
            <Row label="Equity value" value={bigMoney(models.fcfDcf.equityValue, currency)} />
            <Row
              label="Fair value per share"
              value={money(models.fcfDcf.fairValuePerShare, currency)}
              tone={models.fcfDcf.fairValuePerShare - report.price}
            />
          </div>
        </Panel>

        {/* ---- Growth-adjusted multiples ---- */}
        <Panel eyebrow="Multiples"
          title="Growth-adjusted valuation" subtitle="Price relative to earnings growth">
          <Row
            label="PEG (trailing P/E ÷ 5y EPS growth)"
            value={multiple(growthAdjusted.pegTrailing)}
            hint="Below 1.0 suggests growth is cheap relative to price"
          />
          <Row label="PEG (forward consensus)" value={multiple(growthAdjusted.pegForward)} />
          <Row label="PEG — FMP trailing" value={multiple(growthAdjusted.pegFromApi)} />
          <Row label="PEG — FMP forward" value={multiple(growthAdjusted.forwardPegFromApi)} />
          <Row label="P/E (TTM)" value={multiple(report.ratios?.priceToEarningsRatioTTM)} />
          <Row label="EV / EBITDA" value={multiple(report.metrics?.evToEBITDATTM)} />
          <Row label="EV / free cash flow" value={multiple(report.metrics?.evToFreeCashFlowTTM)} />
          <Row label="EV / sales" value={multiple(report.metrics?.evToSalesTTM)} />
          <Row label="Price / free cash flow" value={multiple(report.ratios?.priceToFreeCashFlowRatioTTM)} />
          <Row label="Price / book" value={multiple(report.ratios?.priceToBookRatioTTM)} />
          <Row
            label="Graham number"
            value={models.grahamNumber ? money(models.grahamNumber, currency) : '—'}
            tone={models.grahamNumber ? models.grahamNumber - report.price : undefined}
          />
          <Row
            label="Earnings power value / share"
            value={money(models.earningsPower.perShare, currency)}
            hint="Value assuming zero growth — a floor"
            tone={models.earningsPower.perShare - report.price}
          />
        </Panel>
      </div>

      {report.capexSplit && report.capexSplit.methodsDisagree && (
        <Panel
          eyebrow="Capital spending"
          title="Maintenance versus growth"
          subtitle="Reported free cash flow charges both"
        >
          <p className="px-4 py-3 text-[12px] leading-relaxed text-t3">
            Reported free cash flow subtracts every dollar of capital spending, including the part
            building new capacity. Separating the two changes what the existing business appears to
            generate — and the two standard methods disagree here, so both are shown.
          </p>
          <Row
            label="Operating cash flow"
            value={bigMoney(
              report.capexSplit.reportedFreeCashFlow + report.capexSplit.totalCapex,
              currency,
            )}
          />
          <Row label="Total capital spending" value={bigMoney(report.capexSplit.totalCapex, currency)} />
          <Row
            label="Reported free cash flow"
            value={bigMoney(report.capexSplit.reportedFreeCashFlow, currency)}
            hint="After all capital spending"
          />
          <Row
            label="Owner cash flow — sales-based"
            value={bigMoney(report.capexSplit.ownerFreeCashFlow, currency)}
            hint="Greenwald: growth capital is the fixed-asset intensity applied to the sales increase already achieved"
          />
          <Row
            label="Owner cash flow — depreciation"
            value={bigMoney(report.capexSplit.ownerFreeCashFlowFromDepreciation, currency)}
            hint="Depreciation as the proxy for capacity consumed"
          />
          <div className="px-4 py-3">
            <Badge tone="flat">
              {report.capexSplit.conservativeMethod === 'greenwald'
                ? 'The sales-based split gives the lower figure here, and that is the one used elsewhere.'
                : 'Depreciation gives the lower figure here, and that is the one used elsewhere. The sales-based method reads higher because capital spending is running close to the sales it has already supported.'}
            </Badge>
          </div>
        </Panel>
      )}

      {/* ---- Chart pack ---- */}
      {report.series.eps.length > 0 && (
        <Panel
          eyebrow="Earnings"
          title="EPS — reported and consensus"
          subtitle="Hatched bars are analyst estimates"
        >
          <EpsHistoryChart data={report.series.eps} />
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {report.series.marginTtm.length > 0 && (
          <Panel eyebrow="Profitability" title="Net margin (TTM)" subtitle="Rolling four quarters">
            <MarginTtmChart data={report.series.marginTtm} />
          </Panel>
        )}

        {report.series.indexedPriceVsFcf.length > 1 && (
          <Panel
            eyebrow="Price vs business"
            title="Share price and free cash flow, rebased"
            subtitle="Both start at 100"
          >
            <IndexedChart data={report.series.indexedPriceVsFcf} fundamentalLabel="Free cash flow" />
            <p className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-t4">
              Rebased rather than drawn on two axes, where the apparent relationship depends on
              whichever ranges were chosen. The gap between the lines is the re-rating.
            </p>
          </Panel>
        )}
      </div>

      {report.series.segments.points.length > 1 && (
        <Panel
          eyebrow="Mix"
          title="Revenue by segment"
          subtitle={`${report.series.segments.segments.length} segments as currently reported`}
        >
          <SegmentChart
            points={report.series.segments.points}
            segments={report.series.segments.segments}
          />
        </Panel>
      )}

      {/* ---- Sensitivity ---- */}
      <Panel
        eyebrow="Assumption range"
          title="Sensitivity — fair value per share"
        subtitle="Discount rate (rows) against terminal growth (columns)"
      >
        <SensitivityTable grid={report.sensitivity} price={report.price} currency={currency} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---- Quality ---- */}
        <Panel eyebrow="Business quality"
          title="Quality & returns">
          <Row label="Return on invested capital" value={pct(quality.roic)} tone={quality.roic} />
          <Row label="Cost of capital" value={pct(quality.wacc)} />
          <Row
            label="Economic spread"
            value={pct(quality.economicSpread)}
            tone={quality.economicSpread}
            hint="ROIC minus WACC — positive means the business creates value by growing"
          />
          <Row label="Return on equity" value={pct(report.metrics?.returnOnEquityTTM)} />
          <Row label="Gross margin" value={pct(report.ratios?.grossProfitMarginTTM)} />
          <Row label="Operating margin" value={pct(report.ratios?.operatingProfitMarginTTM)} />
          <Row label="Net margin" value={pct(report.ratios?.netProfitMarginTTM)} />
          <Row
            label="Piotroski F-score"
            value={quality.piotroskiScore !== null ? `${quality.piotroskiScore} / 9` : '—'}
            tone={quality.piotroskiScore !== null ? quality.piotroskiScore - 5 : undefined}
          />
          <Row
            label="Interest coverage"
            value={coverage(report.ratios?.interestCoverageRatioTTM, report.hasInterestExpense)}
            hint="Operating profit over interest expense"
          />
          <Row
            label="Altman Z-score"
            value={num(quality.altmanZScore)}
            tone={quality.altmanZScore !== null ? quality.altmanZScore - 3 : undefined}
            hint="Above 3 is considered financially safe"
          />
        </Panel>

        {/* ---- Owner earnings & yields ---- */}
        <Panel eyebrow="Cash returns"
          title="Owner earnings & shareholder yield">
          <Row label="Owner earnings" value={bigMoney(quality.ownerEarnings, currency)} />
          <Row
            label="Owner earnings yield"
            value={pct(quality.ownerEarningsYield)}
            tone={quality.ownerEarningsYield}
            hint="Buffett's owner earnings over market cap"
          />
          <Row label="Earnings yield" value={pct(quality.yields.earningsYield)} />
          <Row label="Free cash flow yield" value={pct(quality.yields.freeCashFlowYield)} />
          <Row label="Dividend yield" value={pct(quality.yields.dividendYield)} />
          <Row label="Buyback yield" value={pct(quality.yields.buybackYield)} />
          <Row
            label="Total shareholder yield"
            value={pct(quality.yields.shareholderYield)}
            tone={quality.yields.shareholderYield}
          />
          <Row label="Net debt / EBITDA" value={num(report.metrics?.netDebtToEBITDATTM)} />
          <Row label="Debt / equity" value={nonNegativeRatio(report.ratios?.debtToEquityRatioTTM)} hint="Negative when buybacks have taken book equity below zero" />
        </Panel>

        {/* ---- Cost of capital detail ---- */}
        <Panel eyebrow="Discount rate"
          title="Cost of capital">
          <Row label="Risk-free rate (10y)" value={pct(costOfCapital.riskFreeRate)} />
          <Row label="Equity risk premium" value={pct(costOfCapital.equityRiskPremium)} />
          <Row label="Beta" value={num(profile.beta)} />
          <Row label="Cost of equity (CAPM)" value={pct(costOfCapital.costOfEquity)} />
          <Row label="Pre-tax cost of debt" value={pct(costOfCapital.costOfDebtPreTax)} />
          <Row label="After-tax cost of debt" value={pct(costOfCapital.afterTaxCostOfDebt)} />
          <Row label="Effective tax rate" value={pct(costOfCapital.taxRate)} />
          <Row label="Equity weight" value={pct(costOfCapital.equityWeight)} />
          <Row label="Debt weight" value={pct(costOfCapital.debtWeight)} />
          <Row label="WACC" value={pct(costOfCapital.wacc)} />
        </Panel>
      </div>

      {/* ---- History ---- */}
      <Panel eyebrow="Track record"
          title="Reported history" subtitle="Revenue, net income and free cash flow">
        <HistoryChart data={historyData} />
        <div className="grid grid-cols-2 divide-x divide-line border-t border-line md:grid-cols-4">
          <Stat label="Revenue CAGR (5y)" value={pct(growth.revenueCagr5y)} tone={growth.revenueCagr5y} />
          <Stat label="EPS CAGR (5y)" value={pct(growth.epsCagr5y)} tone={growth.epsCagr5y} />
          <Stat label="FCF CAGR (5y)" value={pct(growth.historicalFcfCagr)} tone={growth.historicalFcfCagr} />
          <Stat label="Forward EPS CAGR" value={pct(growth.forwardEpsCagr)} tone={growth.forwardEpsCagr} />
        </div>
      </Panel>
    </div>
  );
}
