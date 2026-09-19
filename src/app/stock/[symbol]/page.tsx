import Link from 'next/link';
import { buildValuation } from '@/lib/valuation/build';
import { Badge, Panel, RangeBar, Row, Stat } from '@/components/ui';
import { CashFlowChart, EpsProjectionChart, HistoryChart, ModelSpreadChart } from '@/components/Charts';
import { SensitivityTable } from '@/components/SensitivityTable';
import { bigMoney, fiscalYear, money, num, pct, signedPct } from '@/lib/format';

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
          label="Blended fair value"
          value={money(report.blendedFairValue, currency)}
          sub={`${report.modelSpread.length} models averaged`}
        />
        <Stat
          label="Upside to fair value"
          value={signedPct(report.upside)}
          tone={report.upside}
          sub={undervalued ? 'Trading below models' : 'Trading above models'}
        />
        <Stat
          label="Market-implied growth"
          value={pct(models.reverseDcf.impliedCagr)}
          sub="What today's price already pays for"
        />
        <Stat
          label="Discount rate (WACC)"
          value={pct(costOfCapital.discountRateUsed)}
          sub={`Beta ${num(profile.beta)} · Rf ${pct(costOfCapital.riskFreeRate)}`}
        />
        <Stat
          label="ROIC less WACC"
          value={pct(quality.economicSpread)}
          tone={quality.economicSpread}
          sub="Value created per dollar invested"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---- Model spread ---- */}
        <Panel
          eyebrow="Valuation"
          title="Fair value by model"
          subtitle={`Current price ${money(report.price, currency)}`}
          className="lg:col-span-2"
        >
          <ModelSpreadChart data={report.modelSpread} price={report.price} />
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
            <p className="pullquote">
              To justify {money(report.price, currency)} today, free cash flow must compound at
              roughly{' '}
              <span className="not-italic font-semibold text-gold">
                {pct(models.reverseDcf.impliedCagr)}
              </span>{' '}
              a year for {models.fcfDcf.assumptions.years} years.
            </p>
          </div>
          <Row
            label="Implied year-1 growth"
            value={pct(models.reverseDcf.impliedInitialGrowth)}
          />
          <Row label="Implied CAGR" value={pct(models.reverseDcf.impliedCagr)} />
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
            {growth.forwardEpsCagr !== null && (
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
          <CashFlowChart data={models.fcfDcf.years} />
          <div className="border-t border-line">
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
            value={num(growthAdjusted.pegTrailing)}
            hint="Below 1.0 suggests growth is cheap relative to price"
          />
          <Row label="PEG (forward consensus)" value={num(growthAdjusted.pegForward)} />
          <Row label="PEG — FMP trailing" value={num(growthAdjusted.pegFromApi)} />
          <Row label="PEG — FMP forward" value={num(growthAdjusted.forwardPegFromApi)} />
          <Row label="P/E (TTM)" value={num(report.ratios?.priceToEarningsRatioTTM)} />
          <Row label="EV / EBITDA" value={num(report.metrics?.evToEBITDATTM)} />
          <Row label="EV / free cash flow" value={num(report.metrics?.evToFreeCashFlowTTM)} />
          <Row label="EV / sales" value={num(report.metrics?.evToSalesTTM)} />
          <Row label="Price / free cash flow" value={num(report.ratios?.priceToFreeCashFlowRatioTTM)} />
          <Row label="Price / book" value={num(report.ratios?.priceToBookRatioTTM)} />
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
          <Row label="Debt / equity" value={num(report.ratios?.debtToEquityRatioTTM)} />
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
