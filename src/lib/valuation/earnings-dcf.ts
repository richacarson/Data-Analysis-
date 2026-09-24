import { clamp } from './wacc';

export interface EstimateYear {
  /** Fiscal period end. */
  date: string;
  /** Fiscal year label; the period end's calendar year is often not it. */
  label?: string;
  epsAvg: number;
  epsLow: number;
  epsHigh: number;
  netIncomeAvg: number;
  revenueAvg: number;
  numAnalystsEps: number;
}

export interface EarningsDcfAssumptions {
  /** Discount rate — cost of equity, since these are equity-level flows. */
  discountRate: number;
  /**
   * Free cash flow generated per dollar of reported net income, measured from
   * history. Earnings are an accounting figure; cash is what gets discounted.
   */
  fcfConversion: number;
  /** Growth applied after the analyst horizon runs out, fading to terminal. */
  fadeYears: number;
  /** Growth in the first fade year, decaying to `terminalGrowth`. */
  postEstimateGrowth: number;
  terminalGrowth: number;
  midYear?: boolean;
}

export interface EarningsDcfYear {
  label: string;
  year: number;
  eps: number;
  /** Cash flow per share after applying the FCF conversion factor. */
  cashFlowPerShare: number;
  source: 'analyst' | 'faded';
  analystCount: number;
  discountFactor: number;
  presentValue: number;
}

export interface EarningsDcfResult {
  years: EarningsDcfYear[];
  pvOfForecast: number;
  pvOfTerminalValue: number;
  fairValuePerShare: number;
  terminalValueShare: number;
  /** Fair value using the low and high ends of the analyst EPS range. */
  bearFairValue: number;
  bullFairValue: number;
  impliedCagr: number;
}

/**
 * DCF driven by published analyst earnings projections.
 *
 * The explicit forecast uses consensus EPS for as far out as analysts publish,
 * then fades to a terminal growth rate. Earnings are converted to cash using a
 * historically observed conversion factor rather than being discounted directly.
 */
export function earningsDcf(
  estimates: EstimateYear[],
  assumptions: EarningsDcfAssumptions,
  currentEps: number,
): EarningsDcfResult {
  const { discountRate, fcfConversion, midYear = true } = assumptions;
  const terminalGrowth = clamp(assumptions.terminalGrowth, -0.02, discountRate - 0.005);

  // Analyst estimates arrive newest-first; the forecast needs them chronologically.
  const sorted = [...estimates]
    .filter((e) => Number.isFinite(e.epsAvg) && e.epsAvg !== 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  const years: EarningsDcfYear[] = [];
  let pvOfForecast = 0;
  let pvBear = 0;
  let pvBull = 0;
  let period = 0;

  for (const est of sorted) {
    period++;
    const exponent = midYear ? period - 0.5 : period;
    const discountFactor = 1 / Math.pow(1 + discountRate, exponent);
    const cashFlowPerShare = est.epsAvg * fcfConversion;
    const presentValue = cashFlowPerShare * discountFactor;

    years.push({
      label: est.label ?? est.date.slice(0, 4),
      year: period,
      eps: est.epsAvg,
      cashFlowPerShare,
      source: 'analyst',
      analystCount: est.numAnalystsEps,
      discountFactor,
      presentValue,
    });

    pvOfForecast += presentValue;
    pvBear += est.epsLow * fcfConversion * discountFactor;
    pvBull += est.epsHigh * fcfConversion * discountFactor;
  }

  // Fade beyond the analyst horizon.
  let lastEps = sorted.length ? sorted[sorted.length - 1].epsAvg : currentEps;
  let lastEpsLow = sorted.length ? sorted[sorted.length - 1].epsLow : currentEps;
  let lastEpsHigh = sorted.length ? sorted[sorted.length - 1].epsHigh : currentEps;
  const finalEstimate = sorted[sorted.length - 1];
  const finalYearLabel = finalEstimate
    ? Number(finalEstimate.label ?? finalEstimate.date.slice(0, 4))
    : new Date().getFullYear();

  for (let i = 0; i < assumptions.fadeYears; i++) {
    const t = assumptions.fadeYears === 1 ? 1 : i / (assumptions.fadeYears - 1);
    const growth =
      assumptions.postEstimateGrowth + (terminalGrowth - assumptions.postEstimateGrowth) * t;

    period++;
    lastEps *= 1 + growth;
    lastEpsLow *= 1 + growth;
    lastEpsHigh *= 1 + growth;

    const exponent = midYear ? period - 0.5 : period;
    const discountFactor = 1 / Math.pow(1 + discountRate, exponent);
    const cashFlowPerShare = lastEps * fcfConversion;
    const presentValue = cashFlowPerShare * discountFactor;

    years.push({
      label: String(finalYearLabel + i + 1),
      year: period,
      eps: lastEps,
      cashFlowPerShare,
      source: 'faded',
      analystCount: 0,
      discountFactor,
      presentValue,
    });

    pvOfForecast += presentValue;
    pvBear += lastEpsLow * fcfConversion * discountFactor;
    pvBull += lastEpsHigh * fcfConversion * discountFactor;
  }

  const terminalDiscount = 1 / Math.pow(1 + discountRate, period);
  const terminal = (eps: number) =>
    ((eps * fcfConversion * (1 + terminalGrowth)) / (discountRate - terminalGrowth)) *
    terminalDiscount;

  const pvOfTerminalValue = terminal(lastEps);
  const fairValuePerShare = pvOfForecast + pvOfTerminalValue;

  const totalPeriods = period;
  const impliedCagr =
    currentEps > 0 && totalPeriods > 0 && lastEps > 0
      ? Math.pow(lastEps / currentEps, 1 / totalPeriods) - 1
      : 0;

  return {
    years,
    pvOfForecast,
    pvOfTerminalValue,
    fairValuePerShare,
    terminalValueShare: fairValuePerShare !== 0 ? pvOfTerminalValue / fairValuePerShare : 0,
    bearFairValue: pvBear + terminal(lastEpsLow),
    bullFairValue: pvBull + terminal(lastEpsHigh),
    impliedCagr,
  };
}

/**
 * Free cash flow generated per dollar of net income, averaged over history.
 * Clamped because one-off working-capital swings can produce absurd ratios.
 */
export function fcfConversionRatio(
  history: Array<{ netIncome: number; freeCashFlow: number }>,
  lookback = 5,
): number {
  const usable = history.slice(0, lookback).filter((h) => h.netIncome > 0);
  if (!usable.length) return 1;
  const totalNetIncome = usable.reduce((sum, h) => sum + h.netIncome, 0);
  const totalFcf = usable.reduce((sum, h) => sum + h.freeCashFlow, 0);
  if (totalNetIncome <= 0) return 1;
  return clamp(totalFcf / totalNetIncome, 0.3, 2);
}

/**
 * Free cash flow per dollar of adjusted earnings, for applying to consensus.
 *
 * Measured per share so buybacks do not distort it, over the most recent years
 * where both figures exist. Same clamp as the GAAP ratio.
 */
export function adjustedFcfConversion(
  history: Array<{ fcfPerShare: number; adjustedEps: number }>,
  lookback = 5,
): number | null {
  const usable = history
    .filter((h) => Number.isFinite(h.fcfPerShare) && Number.isFinite(h.adjustedEps) && h.adjustedEps > 0)
    .slice(0, lookback);
  if (usable.length < 3) return null;
  const totalEps = usable.reduce((sum, h) => sum + h.adjustedEps, 0);
  const totalFcf = usable.reduce((sum, h) => sum + h.fcfPerShare, 0);
  return clamp(totalFcf / totalEps, 0.3, 2);
}
