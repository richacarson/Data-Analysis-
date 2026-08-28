// Types mirror the Financial Modeling Prep "stable" API response shapes.
// Field names were verified against live premium responses — do not rename them.

export interface Profile {
  symbol: string;
  price: number;
  marketCap: number;
  beta: number;
  lastDividend: number;
  range: string;
  change: number;
  changePercentage: number;
  volume: number;
  averageVolume: number;
  companyName: string;
  currency: string;
  cik: string;
  exchangeFullName: string;
  exchange: string;
  industry: string;
  website: string;
  description: string;
  ceo: string;
  sector: string;
  country: string;
  fullTimeEmployees: string;
  ipoDate: string;
  image: string;
  isEtf: boolean;
  isActivelyTrading: boolean;
  isFund: boolean;
}

export interface IncomeStatement {
  date: string;
  symbol: string;
  reportedCurrency: string;
  fiscalYear: string;
  period: string;
  revenue: number;
  costOfRevenue: number;
  grossProfit: number;
  researchAndDevelopmentExpenses: number;
  sellingGeneralAndAdministrativeExpenses: number;
  operatingExpenses: number;
  interestExpense: number;
  interestIncome: number;
  netInterestIncome: number;
  depreciationAndAmortization: number;
  ebitda: number;
  ebit: number;
  operatingIncome: number;
  incomeBeforeTax: number;
  incomeTaxExpense: number;
  netIncome: number;
  eps: number;
  epsDiluted: number;
  weightedAverageShsOut: number;
  weightedAverageShsOutDil: number;
}

export interface CashFlowStatement {
  date: string;
  symbol: string;
  fiscalYear: string;
  period: string;
  netIncome: number;
  depreciationAndAmortization: number;
  stockBasedCompensation: number;
  changeInWorkingCapital: number;
  netCashProvidedByOperatingActivities: number;
  capitalExpenditure: number;
  operatingCashFlow: number;
  freeCashFlow: number;
  commonStockRepurchased: number;
  commonDividendsPaid: number;
  netDebtIssuance: number;
}

export interface BalanceSheetStatement {
  date: string;
  symbol: string;
  fiscalYear: string;
  period: string;
  cashAndCashEquivalents: number;
  shortTermInvestments: number;
  cashAndShortTermInvestments: number;
  totalCurrentAssets: number;
  totalNonCurrentAssets: number;
  totalAssets: number;
  totalCurrentLiabilities: number;
  totalLiabilities: number;
  shortTermDebt: number;
  longTermDebt: number;
  totalDebt: number;
  netDebt: number;
  totalStockholdersEquity: number;
  totalEquity: number;
  goodwill: number;
  intangibleAssets: number;
}

export interface EnterpriseValue {
  symbol: string;
  date: string;
  stockPrice: number;
  numberOfShares: number;
  marketCapitalization: number;
  minusCashAndCashEquivalents: number;
  addTotalDebt: number;
  enterpriseValue: number;
}

/** Forward analyst consensus. `date` is the fiscal period end, so it is in the future. */
export interface FinancialEstimate {
  symbol: string;
  date: string;
  revenueLow: number;
  revenueHigh: number;
  revenueAvg: number;
  ebitdaAvg: number;
  ebitAvg: number;
  netIncomeAvg: number;
  epsAvg: number;
  epsHigh: number;
  epsLow: number;
  numAnalystsRevenue: number;
  numAnalystsEps: number;
}

export interface KeyMetricsTTM {
  symbol: string;
  marketCap: number;
  enterpriseValueTTM: number;
  evToSalesTTM: number;
  evToOperatingCashFlowTTM: number;
  evToFreeCashFlowTTM: number;
  evToEBITDATTM: number;
  netDebtToEBITDATTM: number;
  currentRatioTTM: number;
  incomeQualityTTM: number;
  grahamNumberTTM: number;
  grahamNetNetTTM: number;
  returnOnEquityTTM: number;
  returnOnInvestedCapitalTTM: number;
  returnOnCapitalEmployedTTM: number;
  returnOnAssetsTTM: number;
  earningsYieldTTM: number;
  freeCashFlowYieldTTM: number;
  workingCapitalTTM: number;
  investedCapitalTTM: number;
  cashConversionCycleTTM: number;
  freeCashFlowToEquityTTM: number;
  freeCashFlowToFirmTTM: number;
  capexToRevenueTTM: number;
  researchAndDevelopementToRevenueTTM: number;
  stockBasedCompensationToRevenueTTM: number;
}

export interface RatiosTTM {
  symbol: string;
  grossProfitMarginTTM: number;
  ebitMarginTTM: number;
  ebitdaMarginTTM: number;
  operatingProfitMarginTTM: number;
  netProfitMarginTTM: number;
  priceToEarningsRatioTTM: number;
  priceToEarningsGrowthRatioTTM: number;
  forwardPriceToEarningsGrowthRatioTTM: number;
  priceToBookRatioTTM: number;
  priceToSalesRatioTTM: number;
  priceToFreeCashFlowRatioTTM: number;
  priceToOperatingCashFlowRatioTTM: number;
  debtToEquityRatioTTM: number;
  debtToAssetsRatioTTM: number;
  interestCoverageRatioTTM: number;
  dividendYieldTTM: number;
  dividendPayoutRatioTTM: number;
  effectiveTaxRateTTM: number;
  netIncomePerShareTTM: number;
  bookValuePerShareTTM: number;
  freeCashFlowPerShareTTM: number;
  revenuePerShareTTM: number;
  operatingCashFlowPerShareTTM: number;
  enterpriseValueMultipleTTM: number;
}

export interface FinancialScores {
  symbol: string;
  altmanZScore: number;
  piotroskiScore: number;
  workingCapital: number;
  totalAssets: number;
  retainedEarnings: number;
  ebit: number;
  marketCap: number;
  totalLiabilities: number;
  revenue: number;
}

export interface PriceTargetConsensus {
  symbol: string;
  targetHigh: number;
  targetLow: number;
  targetConsensus: number;
  targetMedian: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  currency?: string;
  exchangeFullName?: string;
  exchange?: string;
}

export type Period = 'annual' | 'quarter';
