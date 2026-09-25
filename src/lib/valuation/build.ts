import {
  getAnnualRatios,
  getBalanceSheets,
  getCashFlowStatements,
  getEnterpriseValues,
  getEstimates,
  getFinancialScores,
  getEarningsHistory,
  getDividends,
  getFxRate,
  getIncomeStatements,
  getIndustryPe,
  getRevenueSegments,
  getKeyMetricsTTM,
  getPriceTargetConsensus,
  getProfile,
  getRatiosTTM,
  getRiskFreeRate,
} from '../fmp/endpoints';
import { discountedCashFlow, sensitivityGrid, type DcfAssumptions } from './dcf';
import { adjustedFcfConversion, earningsDcf, fcfConversionRatio } from './earnings-dcf';
import {
  cagr,
  earningsPowerValue,
  economicSpread,
  forwardPeg,
  grahamNumber,
  ownerEarnings,
  peg,
  shareholderYields,
  usablePeg,
  valueOnMultiple,
  type MultipleValuation,
} from './multiples';
import { reverseDcf } from './reverse-dcf';
import {
  expectedReturn,
  justifiedPriceEarnings,
  requiredDiscount,
  requiredExitMultiple,
  scenarioGrid,
} from './expected-return';
import { exitMultipleAnchors, median } from './exit-multiple';
import { fairValueRange, grahamIsInformative } from './blend';
import { latestCapexSplit } from './capex';
import { fiscalYearLabeler, forwardEstimates, pickCoveredHorizon } from './fiscal';
import { forwardDividend } from './dividends';
import { houseReturn } from './house';
import {
  adjustedPeHistory,
  annualAdjustedEps,
  compareBases,
} from './earnings-basis';
import {
  epsActualVsEstimate,
  indexedToStart,
  revenueBySegment,
  trailingTwelveMonths,
} from './series';
import {
  cashFlowModelsApply,
  isFinancialSector,
  isRealEstateTrust,
  perShareModelsApply,
} from './applicability';
import { clamp, impliedCostOfDebt, wacc } from './wacc';

/** Long-run US equity risk premium. Overridable per valuation. */
export const DEFAULT_ERP = 0.05;

/** House expected-return settings: a three-year horizon against a 15% hurdle. */
export const DEFAULT_HORIZON_YEARS = 3;
export const DEFAULT_HURDLE = 0.15;

export interface ValuationOverrides {
  /** Exit P/E for the expected-return model, distinct from the DCF's terminal multiple. */
  exitPe?: number;
  horizonYears?: number;
  hurdle?: number;
  targetNetMargin?: number;
  discountRate?: number;
  terminalGrowth?: number;
  forecastYears?: number;
  equityRiskPremium?: number;
  exitMultiple?: number;
  fcfConversion?: number;
}

export type ValuationReport = Awaited<ReturnType<typeof buildValuation>>;

/**
 * Assembles every valuation view for a symbol from FMP fundamentals.
 *
 * Each model is reported alongside the assumptions that drove it — a fair value
 * without its inputs is not a usable number.
 */
export async function buildValuation(symbol: string, overrides: ValuationOverrides = {}) {
  const ticker = symbol.toUpperCase().trim();

  // Each feed is fetched independently so one unavailable endpoint degrades a
  // single panel instead of taking down the whole valuation. Whatever failed is
  // reported back in `dataIssues` rather than silently rendering as a zero.
  const dataIssues: string[] = [];

  async function optional<T>(label: string, promise: Promise<T>, fallback: T): Promise<T> {
    try {
      return await promise;
    } catch (error) {
      dataIssues.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      return fallback;
    }
  }

  const [
    profile,
    income,
    cashflow,
    balance,
    enterprise,
    estimates,
    metrics,
    ratios,
    scores,
    priceTarget,
    annualRatios,
    quarterlyIncome,
    segments,
    earningsHistory,
    dividends,
    riskFreeRate,
  ] = await Promise.all([
    // The profile carries the price and share count, so it is the one hard requirement.
    getProfile(ticker),
    optional('income statement', getIncomeStatements(ticker, 'annual', 12), []),
    optional('cash flow statement', getCashFlowStatements(ticker, 'annual', 12), []),
    optional('balance sheet', getBalanceSheets(ticker, 'annual', 12), []),
    optional('enterprise values', getEnterpriseValues(ticker, 12), []),
    optional('analyst estimates', getEstimates(ticker, 'annual', 10), []),
    optional('key metrics', getKeyMetricsTTM(ticker), null),
    optional('ratios', getRatiosTTM(ticker), null),
    optional('financial scores', getFinancialScores(ticker), null),
    optional('price target consensus', getPriceTargetConsensus(ticker), null),
    optional('annual ratios', getAnnualRatios(ticker, 10), []),
    optional('quarterly income', getIncomeStatements(ticker, 'quarter', 44), []),
    optional('revenue segments', getRevenueSegments(ticker), []),
    optional('earnings history', getEarningsHistory(ticker, 44), []),
    optional('dividends', getDividends(ticker), []),
    getRiskFreeRate(),
  ]);

  if (!profile) throw new Error(`No profile found for ${ticker}`);

  const latestIncome = income[0];
  const latestCash = cashflow[0];
  const latestBalance = balance[0];
  const latestEv = enterprise[0];

  const price = profile.price;
  const shares = latestIncome?.weightedAverageShsOutDil || latestEv?.numberOfShares || 0;
  const netDebt = latestBalance?.netDebt ?? (latestEv ? latestEv.addTotalDebt - latestEv.minusCashAndCashEquivalents : 0);
  const totalDebt = latestBalance?.totalDebt ?? latestEv?.addTotalDebt ?? 0;
  const marketCap = profile.marketCap || latestEv?.marketCapitalization || 0;

  const taxRate = clamp(
    ratios?.effectiveTaxRateTTM ??
      (latestIncome && latestIncome.incomeBeforeTax > 0
        ? latestIncome.incomeTaxExpense / latestIncome.incomeBeforeTax
        : 0.21),
    0,
    0.5,
  );

  // ---- Cost of capital -----------------------------------------------------
  const equityRiskPremium = overrides.equityRiskPremium ?? DEFAULT_ERP;
  const costOfDebt = impliedCostOfDebt(latestIncome?.interestExpense ?? 0, totalDebt, riskFreeRate);
  const capital = wacc({
    riskFreeRate,
    equityRiskPremium,
    beta: profile.beta || 1,
    marketCap,
    totalDebt,
    costOfDebt,
    taxRate,
  });

  const discountRate = overrides.discountRate ?? capital.wacc;
  const terminalGrowth = overrides.terminalGrowth ?? 0.025;
  const forecastYears = overrides.forecastYears ?? 10;

  // ---- Historical growth, used to seed the FCF forecast --------------------
  const fcfHistory = cashflow.map((c) => ({
    date: c.date,
    freeCashFlow: c.freeCashFlow,
    netIncome: c.netIncome,
    operatingCashFlow: c.operatingCashFlow,
    capex: c.capitalExpenditure,
  }));

  const oldestFcf = fcfHistory[Math.min(fcfHistory.length - 1, 4)];
  const latestFcf = fcfHistory[0];
  const historicalFcfCagr =
    oldestFcf && latestFcf
      ? cagr(oldestFcf.freeCashFlow, latestFcf.freeCashFlow, Math.min(fcfHistory.length - 1, 4))
      : null;

  const revenueCagr5y =
    income.length > 5 ? cagr(income[5].revenue, income[0].revenue, 5) : null;
  const epsCagr5y =
    income.length > 5 ? cagr(income[5].epsDiluted, income[0].epsDiluted, 5) : null;

  // Every annual record is labelled with the company's own fiscal year, never
  // the calendar year of its period end.
  const fiscalYearOf = fiscalYearLabeler(
    income.map((i) => ({ date: i.date, fiscalYear: i.fiscalYear })),
  );

  // Analyst-implied forward growth takes precedence over extrapolated history.
  // The estimates feed includes years already reported; only the rest are forecasts.
  const sortedEstimates = forwardEstimates(estimates, latestIncome?.date ?? null);
  const firstEstimate = sortedEstimates[0];
  const lastEstimate = sortedEstimates[sortedEstimates.length - 1];
  const forwardEpsCagr =
    firstEstimate && lastEstimate && sortedEstimates.length > 1
      ? cagr(firstEstimate.epsAvg, lastEstimate.epsAvg, sortedEstimates.length - 1)
      : null;

  const seedGrowth = clamp(forwardEpsCagr ?? historicalFcfCagr ?? 0.05, -0.1, 0.35);

  // ---- Which models this business can actually support --------------------
  /*
   * A discounted cash flow is meaningless for a lender. Banks and insurers
   * report no meaningful capital expenditure, and their operating cash flow is
   * dominated by changes in the loan book and deposit base — JPMorgan's swings
   * between +$107bn and -$148bn on a stable, profitable business. Running a DCF
   * on that produces a confident number with no relationship to the company.
   */
  const isFinancial = isFinancialSector(profile.sector, profile.industry);

  const baseFcf = latestFcf?.freeCashFlow ?? 0;
  /*
   * Reported free cash flow subtracts growth spending as well as maintenance,
   * so a company mid-build looks like it generates far less than its existing
   * operations actually do.
   */
  const capexSplit = latestCapexSplit(
    cashflow
      .map((c) => {
        const inc = income.find((i) => i.date === c.date);
        const bal = balance.find((b) => b.date === c.date);
        return {
          date: c.date,
          revenue: inc?.revenue ?? 0,
          capitalExpenditure: c.capitalExpenditure,
          depreciationAndAmortization: c.depreciationAndAmortization,
          operatingCashFlow: c.operatingCashFlow,
          propertyPlantEquipmentNet: bal?.propertyPlantEquipmentNet ?? 0,
        };
      })
      .filter((y) => y.revenue > 0),
  );

  const fcfVerdict = cashFlowModelsApply(profile.sector, profile.industry, baseFcf);

  // If the statements are denominated differently from the quote, no per-share
  // model can be compared to the price at all — including the cash flow ones.
  const currencyVerdict = perShareModelsApply(latestIncome?.reportedCurrency, profile.currency);
  const unitsComparable = currencyVerdict.applies;
  const fcfModelApplies = fcfVerdict.applies && unitsComparable;

  const modelNotes: Array<{ label: string; reason: string }> = [];
  if (!currencyVerdict.applies && currencyVerdict.reason) {
    modelNotes.push({ label: 'All fair-value models', reason: currencyVerdict.reason });
  }
  if (fcfVerdict.reason && currencyVerdict.applies) {
    modelNotes.push({ label: 'Cash flow models', reason: fcfVerdict.reason });
  }
  if (isRealEstateTrust(profile.sector, profile.industry) && currencyVerdict.applies) {
    modelNotes.push({
      label: 'Earnings-based models',
      reason:
        'Read with care for a REIT: property depreciation is a large non-cash charge, so reported earnings sit well below distributable cash and earnings-based fair values understate the business. Funds from operations is the sector standard.',
    });
  }

  // ---- Model 1: FCF discounted cash flow ----------------------------------
  const dcfAssumptions: DcfAssumptions = {
    years: forecastYears,
    discountRate,
    initialGrowth: seedGrowth,
    terminalGrowth,
    terminalMethod: 'perpetuity',
    midYear: true,
  };
  const bridge = { netDebt, sharesOutstanding: shares };
  const fcfDcf = discountedCashFlow(baseFcf, dcfAssumptions, bridge);

  // ---- Model 3: reverse DCF ------------------------------------------------
  const reverse = reverseDcf(baseFcf, dcfAssumptions, bridge, price);
  // Bisection reports non-convergence by returning the bound it gave up at.
  // Presenting that as "the market expects 150% growth" would be a fabrication.
  const reverseUsable = fcfModelApplies && reverse.converged;

  // ---- Model 4: earnings power value (no-growth floor) --------------------
  const epv = earningsPowerValue({
    ebit: latestIncome?.ebit ?? 0,
    taxRate,
    investedCapital: metrics?.investedCapitalTTM ?? 0,
    wacc: discountRate,
  });
  const epvPerShare = shares > 0 ? (epv - netDebt) / shares : 0;

  // ---- Model 5: relative multiples ----------------------------------------
  const eps = ratios?.netIncomePerShareTTM ?? latestIncome?.epsDiluted ?? 0;
  const fcfPerShare = ratios?.freeCashFlowPerShareTTM ?? (shares > 0 ? baseFcf / shares : 0);
  const bookPerShare = ratios?.bookValuePerShareTTM ?? 0;
  const forwardEps = firstEstimate?.epsAvg ?? 0;

  const multiples: MultipleValuation[] = [];
  // Implied prices are per-share too, so they inherit the currency constraint.
  if (unitsComparable) {
  if (eps > 0) multiples.push(valueOnMultiple('Historical P/E', ratios?.priceToEarningsRatioTTM ?? 0, eps, price));
  if (forwardEps > 0) multiples.push(valueOnMultiple('Forward P/E (consensus)', price / forwardEps, forwardEps, price));
  if (fcfPerShare > 0) multiples.push(valueOnMultiple('P/FCF', ratios?.priceToFreeCashFlowRatioTTM ?? 0, fcfPerShare, price));
  if (bookPerShare > 0) multiples.push(valueOnMultiple('P/B', ratios?.priceToBookRatioTTM ?? 0, bookPerShare, price));
  }

  // ---- Growth-adjusted valuation ------------------------------------------
  const trailingPeg = peg(ratios?.priceToEarningsRatioTTM ?? 0, (epsCagr5y ?? 0) * 100);
  const fwdPeg = forwardPeg(price, forwardEps, (forwardEpsCagr ?? 0) * 100);

  // ---- Quality -------------------------------------------------------------
  const roic = metrics?.returnOnInvestedCapitalTTM ?? 0;
  const spread = economicSpread(roic, discountRate);

  const oe = latestCash && latestIncome
    ? ownerEarnings({
        netIncome: latestCash.netIncome,
        depreciationAndAmortization: latestCash.depreciationAndAmortization,
        capitalExpenditure: latestCash.capitalExpenditure,
        changeInWorkingCapital: latestCash.changeInWorkingCapital,
        stockBasedCompensation: latestCash.stockBasedCompensation,
      })
    : 0;

  const yields = shareholderYields({
    netIncome: latestIncome?.netIncome ?? 0,
    freeCashFlow: baseFcf,
    dividendsPaid: latestCash?.commonDividendsPaid ?? 0,
    buybacks: latestCash?.commonStockRepurchased ?? 0,
    marketCap,
  });

  // ---- Expected return: the house method ----------------------------------
  /*
   * Project consensus earnings to a horizon, apply an exit multiple, and read
   * off the annualised return from today's price. Two assumptions instead of a
   * DCF's five, and the output is the decision variable rather than an
   * abstract fair value.
   */
  const horizonYears = overrides.horizonYears ?? DEFAULT_HORIZON_YEARS;
  const hurdle = overrides.hurdle ?? DEFAULT_HURDLE;
  // Forward yield from declared payments, exactly as the screen computes it.
  const dividend = forwardDividend(dividends, price);
  const dividendYield = dividend.yield;

  /*
   * Consensus is quoted on an adjusted basis, so the historical multiple has to
   * be too. The ratios endpoint computes P/E from GAAP earnings, which for a
   * company with large recurring add-backs is a different number entirely:
   * Stanley Black & Decker's FY2024 GAAP EPS was $1.95 against $4.15 of
   * consensus, so a GAAP-anchored multiple applied to a consensus forecast
   * roughly doubles the target price.
   */
  const adjustedEpsYears = annualAdjustedEps(
    earningsHistory,
    income.map((i) => ({ date: i.date, fiscalYear: i.fiscalYear })),
  );
  const basis = compareBases(
    income.map((i) => ({ fiscalYear: i.fiscalYear, epsDiluted: i.epsDiluted })),
    adjustedEpsYears,
  );

  const adjustedPes = adjustedPeHistory(
    enterprise.map((ev) => ({ year: fiscalYearOf(ev.date), price: ev.stockPrice })),
    adjustedEpsYears,
  );

  // Fall back to the GAAP series only where no adjusted history exists.
  const ownPeHistory =
    adjustedPes.length >= 3 ? adjustedPes : annualRatios.map((r) => r.priceToEarningsRatio);
  const peBasis: 'adjusted' | 'gaap' = adjustedPes.length >= 3 ? 'adjusted' : 'gaap';
  const latestAdjustedEps =
    peBasis === 'adjusted' ? adjustedEpsYears[adjustedEpsYears.length - 1]?.adjustedEps ?? null : null;

  // ---- Model 2: earnings-projection DCF -----------------------------------
  /*
   * Consensus is adjusted EPS, so the cash conversion applied to it has to be
   * measured against adjusted earnings too. Stanley Black & Decker converts
   * roughly all of its adjusted earnings to cash but nearly twice its GAAP
   * earnings; the GAAP ratio, clamped, applied to adjusted forecasts is simply
   * the wrong number.
   */
  const adjustedByYear = new Map(adjustedEpsYears.map((a) => [a.year, a.adjustedEps]));
  const adjustedConversion =
    peBasis === 'adjusted'
      ? adjustedFcfConversion(
          cashflow.map((c) => {
            const inc = income.find((i) => i.date === c.date);
            const dilutedShares = inc?.weightedAverageShsOutDil ?? 0;
            return {
              fcfPerShare: dilutedShares > 0 ? c.freeCashFlow / dilutedShares : Number.NaN,
              adjustedEps: adjustedByYear.get(fiscalYearOf(c.date)) ?? Number.NaN,
            };
          }),
        )
      : null;
  const conversion =
    overrides.fcfConversion ?? adjustedConversion ?? fcfConversionRatio(fcfHistory);
  const conversionBasis: 'adjusted' | 'gaap' =
    overrides.fcfConversion === undefined && adjustedConversion !== null ? 'adjusted' : 'gaap';
  const epsDcf = earningsDcf(
    sortedEstimates.map((e) => ({
      date: e.date,
      label: fiscalYearOf(e.date),
      epsAvg: e.epsAvg,
      epsLow: e.epsLow,
      epsHigh: e.epsHigh,
      netIncomeAvg: e.netIncomeAvg,
      revenueAvg: e.revenueAvg,
      numAnalystsEps: e.numAnalystsEps,
    })),
    {
      discountRate: capital.costOfEquity,
      fcfConversion: conversion,
      fadeYears: 5,
      postEstimateGrowth: clamp(seedGrowth * 0.6, 0.01, 0.12),
      terminalGrowth,
    },
    latestAdjustedEps ?? latestIncome?.epsDiluted ?? 0,
  );


  // Industry P/E over the past year; the shared calculation reduces it.
  const industryRows = profile.industry
    ? await optional(
        'industry P/E',
        getIndustryPe(
          profile.industry,
          new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10),
          new Date().toISOString().slice(0, 10),
        ),
        [],
      )
    : [];

  /*
   * ADRs report in their home currency and are quoted in dollars. Rather than
   * withhold the expected return, consensus is converted at FMP's rate; the
   * cash-flow models, which need whole statements converted, stay withheld.
   */
  const reportingCurrency = (latestIncome?.reportedCurrency ?? profile.currency ?? 'USD').toUpperCase();
  const quoteCurrency = (profile.currency || 'USD').toUpperCase();
  const fxRate =
    reportingCurrency === quoteCurrency
      ? 1
      : await optional('exchange rate', getFxRate(reportingCurrency, quoteCurrency), null);

  // The house method, shared with the screen so the two always agree.
  const house = houseReturn({
    price,
    forward: sortedEstimates,
    annual: annualRatios,
    earnings: earningsHistory,
    industryPe: industryRows,
    roic,
    beta: profile.beta || 1,
    riskFreeRate,
    equityRiskPremium,
    dividendYield,
    horizonYears,
    hurdle,
    fxRate: fxRate ?? 1,
    foreign: reportingCurrency !== quoteCurrency,
    exitPeOverride: overrides.exitPe,
  });
  const houseUsable = fxRate !== null;
  const expected = houseUsable ? house.expected : null;
  const yearsToHorizon = house.horizon?.years ?? horizonYears;

  // ---- Chart series --------------------------------------------------------
  const ttm = trailingTwelveMonths(
    quarterlyIncome.map((q) => ({
      date: q.date,
      fiscalYear: q.fiscalYear,
      period: q.period,
      revenue: q.revenue,
      netIncome: q.netIncome,
    })),
  );

  // Bars on one basis: adjusted actuals beside adjusted consensus where the
  // adjusted history exists, or a GAAP-to-adjusted jump reads as growth.
  const epsSeries = epsActualVsEstimate(
    peBasis === 'adjusted'
      ? adjustedEpsYears.map((a) => ({ fiscalYear: a.year, epsDiluted: a.adjustedEps }))
      : income.map((i) => ({ fiscalYear: i.fiscalYear, epsDiluted: i.epsDiluted })),
    sortedEstimates,
    fiscalYearOf,
  );

  const segmentSeries = revenueBySegment(
    segments.map((r) => ({ fiscalYear: r.fiscalYear, data: r.data })),
  );

  // Enterprise values carry the price at each fiscal year end, which lines up
  // with the statements without needing a separate price history.
  const indexed = indexedToStart(
    [...enterprise]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((ev) => ({
        year: fiscalYearOf(ev.date),
        price: ev.stockPrice,
        fundamental:
          cashflow.find((c) => c.date === ev.date)?.freeCashFlow ?? 0,
      })),
  );

  // ---- Consensus of models -------------------------------------------------
  const allCandidates = [
    { label: 'FCF DCF', value: fcfDcf.fairValuePerShare, applies: fcfModelApplies },
    { label: 'Earnings DCF', value: epsDcf.fairValuePerShare, applies: unitsComparable },
    { label: 'Earnings power', value: epvPerShare, applies: unitsComparable },
    {
      label: 'Graham number',
      value: grahamNumber(eps, bookPerShare) ?? 0,
      applies: unitsComparable,
    },
  ];

  for (const c of allCandidates) {
    if (c.applies && !(Number.isFinite(c.value) && c.value > 0)) {
      modelNotes.push({
        label: c.label,
        reason: 'Excluded: the model returns a negative or undefined value for this company.',
      });
    }
  }

  const candidates = allCandidates
    .filter((c) => c.applies && Number.isFinite(c.value) && c.value > 0)
    .map(({ label, value }) => ({ label, value }));

  const intangiblesShare = metrics?.intangiblesToTotalAssetsTTM ?? 0;
  const valueRange = fairValueRange({
    fcfDcf: { label: 'FCF DCF', value: fcfDcf.fairValuePerShare, applies: fcfModelApplies },
    earningsDcf: {
      label: 'Earnings DCF',
      value: epsDcf.fairValuePerShare,
      applies: unitsComparable,
    },
    earningsPower: { label: 'Earnings power', value: epvPerShare, applies: unitsComparable },
    graham: {
      label: 'Graham number',
      value: grahamNumber(eps, bookPerShare),
      applies: unitsComparable,
    },
    grahamInformative: grahamIsInformative(roic, intangiblesShare),
  });

  // Kept for the model-spread chart; the headline is the range, not an average.
  const blendedFairValue = valueRange.midpoint ?? 0;

  const grid = sensitivityGrid(
    baseFcf,
    dcfAssumptions,
    bridge,
    price,
    [discountRate - 0.02, discountRate - 0.01, discountRate, discountRate + 0.01, discountRate + 0.02],
    [terminalGrowth - 0.01, terminalGrowth - 0.005, terminalGrowth, terminalGrowth + 0.005, terminalGrowth + 0.01],
  );

  return {
    symbol: ticker,
    asOf: new Date().toISOString(),
    dataIssues,
    profile,
    price,
    marketCap,
    shares,
    netDebt,

    costOfCapital: {
      ...capital,
      riskFreeRate,
      equityRiskPremium,
      costOfDebtPreTax: costOfDebt,
      taxRate,
      discountRateUsed: discountRate,
    },

    growth: {
      revenueCagr5y,
      epsCagr5y,
      historicalFcfCagr,
      forwardEpsCagr,
      seedGrowth,
    },

    models: {
      fcfDcf: { ...fcfDcf, assumptions: dcfAssumptions, baseCashFlow: baseFcf },
      earningsDcf: {
        ...epsDcf,
        fcfConversion: conversion,
        conversionBasis,
        discountRate: capital.costOfEquity,
      },
      reverseDcf: reverse,
      earningsPower: { total: epv, perShare: epvPerShare },
      grahamNumber: grahamNumber(eps, bookPerShare),
      multiples,
    },

    expectedReturn: {
      horizonYears,
      yearsToHorizon,
      horizonNote: house.horizonNote,
      dividendMethod: dividend.method,
      hurdle,
      dividendYield,
      epsAtHorizon: houseUsable ? house.epsAtHorizon : null,
      convertedFrom: reportingCurrency !== quoteCurrency && houseUsable ? reportingCurrency : null,
      horizonFiscalYear: house.horizon?.fiscalYear ?? null,
      analystCount: house.horizon?.estimate.numAnalystsEps ?? 0,
      exitPe: house.exitPe,
      exitPeSource: house.exitPeSource,
      anchors: house.anchors.anchors,
      peBasis: house.peBasis,
      basis: house.basis,
      anchorsDisagree: house.anchors.anchorsDisagree,
      anchorSpread: house.anchors.spread,
      disagreementNote: house.anchors.disagreementNote,
      sustainableGrowth: house.sustainableGrowth,
      review: house.review,
      result: house.review ? null : expected,
      requiredExitMultiple: houseUsable ? house.requiredExitMultiple : null,
      requiredDiscount: requiredDiscount(hurdle, dividendYield, yearsToHorizon),
      scenarios: houseUsable && !house.review ? house.scenarios : null,
      clearsHurdle: expected && !house.review ? expected.totalCagr >= hurdle : null,
    },

    valueRange,
    capexSplit,
    blendedFairValue,
    upside: price > 0 && valueRange.midpoint ? valueRange.midpoint / price - 1 : 0,
    modelSpread: candidates,
    modelNotes,
    applicability: {
      isFinancial,
      fcfModelApplies,
      reverseUsable: reverseUsable && currencyVerdict.applies,
      unitsComparable,
      reportingCurrency: latestIncome?.reportedCurrency ?? null,
    },
    sensitivity: grid,

    growthAdjusted: {
      pegTrailing: trailingPeg,
      pegForward: fwdPeg,
      pegFromApi: usablePeg(ratios?.priceToEarningsGrowthRatioTTM),
      forwardPegFromApi: usablePeg(ratios?.forwardPriceToEarningsGrowthRatioTTM),
    },

    quality: {
      roic,
      wacc: discountRate,
      economicSpread: spread,
      ownerEarnings: oe,
      ownerEarningsYield: marketCap > 0 ? oe / marketCap : 0,
      altmanZScore: scores?.altmanZScore ?? null,
      piotroskiScore: scores?.piotroskiScore ?? null,
      yields,
    },

    consensus: {
      priceTarget,
      estimates: sortedEstimates.map((e) => ({ ...e, fiscalYear: fiscalYearOf(e.date) })),
    },

    series: {
      marginTtm: ttm.slice(-20),
      eps: epsSeries,
      epsBasis: peBasis,
      segments: segmentSeries,
      indexedPriceVsFcf: indexed,
    },

    history: {
      income: income.slice(0, 10),
      cashflow: cashflow.slice(0, 10),
      balance: balance.slice(0, 10),
    },

    hasInterestExpense: (latestIncome?.interestExpense ?? 0) > 0,
    ratios,
    metrics,
  };
}
