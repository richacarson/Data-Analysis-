import { clamp } from './wacc';

/**
 * Price/earnings-to-growth. Below 1.0 is the classic Lynch screen for a stock
 * growing faster than it is priced.
 *
 * Returns null rather than a misleading number when growth is zero or negative —
 * PEG is undefined for a shrinking business.
 */
export function peg(peRatio: number, growthRatePct: number): number | null {
  if (!Number.isFinite(peRatio) || peRatio <= 0) return null;
  if (!Number.isFinite(growthRatePct) || growthRatePct <= 0) return null;
  return peRatio / growthRatePct;
}

/** Forward PEG from consensus: forward P/E over the projected EPS CAGR. */
export function forwardPeg(
  price: number,
  forwardEps: number,
  epsCagrPct: number,
): number | null {
  if (forwardEps <= 0) return null;
  return peg(price / forwardEps, epsCagrPct);
}

/** Compound annual growth rate between two values over `years` periods. */
export function cagr(start: number, end: number, years: number): number | null {
  if (years <= 0) return null;
  // A sign change makes the root meaningless.
  if (start <= 0 || end <= 0) return null;
  return Math.pow(end / start, 1 / years) - 1;
}

/**
 * Benjamin Graham's intrinsic-value formula: √(22.5 × EPS × book value per
 * share). Only meaningful for profitable companies with positive book value.
 */
export function grahamNumber(eps: number, bookValuePerShare: number): number | null {
  if (eps <= 0 || bookValuePerShare <= 0) return null;
  return Math.sqrt(22.5 * eps * bookValuePerShare);
}

export interface OwnerEarningsInput {
  netIncome: number;
  depreciationAndAmortization: number;
  capitalExpenditure: number;
  changeInWorkingCapital: number;
  stockBasedCompensation: number;
}

/**
 * Buffett's owner earnings: reported earnings plus non-cash charges, less the
 * capital spending and working capital the business needs to hold its position.
 *
 * Stock compensation is subtracted — it is a real cost to existing holders even
 * though it never leaves as cash.
 */
export function ownerEarnings(i: OwnerEarningsInput): number {
  // FMP reports capex as a negative number; normalize to a positive outflow.
  const capex = Math.abs(i.capitalExpenditure);
  return (
    i.netIncome +
    i.depreciationAndAmortization -
    capex -
    i.changeInWorkingCapital -
    i.stockBasedCompensation
  );
}

export interface EarningsPowerInput {
  ebit: number;
  taxRate: number;
  investedCapital: number;
  wacc: number;
}

/**
 * Earnings power value: capitalize sustainable after-tax operating profit at
 * the cost of capital, assuming no growth. A floor value that ignores any
 * growth optionality.
 */
export function earningsPowerValue(i: EarningsPowerInput): number {
  const nopat = i.ebit * (1 - clamp(i.taxRate, 0, 0.6));
  if (i.wacc <= 0) return 0;
  return nopat / i.wacc;
}

/** Return on invested capital less the cost of that capital — the value spread. */
export function economicSpread(roic: number, waccRate: number): number {
  return roic - waccRate;
}

export interface YieldSet {
  earningsYield: number;
  freeCashFlowYield: number;
  dividendYield: number;
  buybackYield: number;
  shareholderYield: number;
}

/**
 * Yields to shareholders. Buyback yield uses cash actually spent on repurchases
 * rather than the change in share count, so it is not distorted by issuance.
 */
export function shareholderYields(input: {
  netIncome: number;
  freeCashFlow: number;
  dividendsPaid: number;
  buybacks: number;
  marketCap: number;
}): YieldSet {
  const mc = input.marketCap;
  if (mc <= 0) {
    return {
      earningsYield: 0,
      freeCashFlowYield: 0,
      dividendYield: 0,
      buybackYield: 0,
      shareholderYield: 0,
    };
  }
  const dividendYield = Math.abs(input.dividendsPaid) / mc;
  const buybackYield = Math.abs(input.buybacks) / mc;
  return {
    earningsYield: input.netIncome / mc,
    freeCashFlowYield: input.freeCashFlow / mc,
    dividendYield,
    buybackYield,
    shareholderYield: dividendYield + buybackYield,
  };
}

export interface MultipleValuation {
  label: string;
  multiple: number;
  metricPerShare: number;
  impliedPrice: number;
  upside: number;
}

/** Implied price from applying a target multiple to a per-share metric. */
export function valueOnMultiple(
  label: string,
  multiple: number,
  metricPerShare: number,
  currentPrice: number,
): MultipleValuation {
  const impliedPrice = multiple * metricPerShare;
  return {
    label,
    multiple,
    metricPerShare,
    impliedPrice,
    upside: currentPrice > 0 ? impliedPrice / currentPrice - 1 : 0,
  };
}
