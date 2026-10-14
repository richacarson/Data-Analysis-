import { describe, expect, it } from 'vitest';
import { csvLine, parseHoldings, tickerCandidates } from '../ishares';

const SAMPLE = `﻿iShares Select Dividend ETF
Fund Holdings as of,"Oct 10, 2026"
Inception Date,"Nov 03, 2003"
Shares Outstanding,"60,150,000.00"
Stock,"-"
Bond,"-"
Cash,"-"
Other,"-"
 
Ticker,Name,Sector,Asset Class,Market Value,Weight (%),Notional Value,Quantity,Price,Location,Exchange,Currency,FX Rate,Market Currency,Accrual Date
"MO","ALTRIA GROUP INC","Consumer Staples","Equity","412,345,678.00","2.31","412,345,678.00","7,000,000.00","58.91","United States","New York Stock Exchange Inc.","USD","1.00","USD","-"
"BRKB","BERKSHIRE HATHAWAY INC CLASS B","Financials","Equity","10,000.00","1.05","10,000.00","20.00","500.00","United States","New York Stock Exchange Inc.","USD","1.00","USD","-"
"USD","USD CASH","Cash and/or Derivatives","Cash","1,000.00","0.12","1,000.00","1,000.00","100.00","United States","-","USD","1.00","USD","-"
 
"The content contained herein is owned or licensed by BlackRock"
`;

describe('iShares holdings', () => {
  it('reads the date and the equity rows, dropping cash', () => {
    const { asOf, holdings } = parseHoldings(SAMPLE);
    expect(asOf).toBe('2026-10-10');
    expect(holdings.map((h) => h.ticker)).toEqual(['MO', 'BRKB']);
    expect(holdings[0].weight).toBeCloseTo(0.0231, 6);
  });

  it('keeps commas inside quoted fields', () => {
    expect(csvLine('"A","1,234.5","x ""y"""')).toEqual(['A', '1,234.5', 'x "y"']);
  });

  it('maps share classes to the app’s tickers', () => {
    expect(tickerCandidates('BRKB')).toEqual(['BRKB', 'BRK-B']);
    expect(tickerCandidates('MO')).toEqual(['MO']);
  });

  it('refuses a file without a holdings table', () => {
    expect(() => parseHoldings('<!DOCTYPE html><html>')).toThrow();
  });
});
