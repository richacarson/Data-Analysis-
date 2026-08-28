import { NextResponse } from 'next/server';
import { buildValuation, type ValuationOverrides } from '@/lib/valuation/build';
import { FmpError } from '@/lib/fmp/client';

/** Reads a numeric override from the query string, ignoring junk values. */
function numeric(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (raw === null) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const search = new URL(request.url).searchParams;

  const overrides: ValuationOverrides = {
    discountRate: numeric(search, 'discountRate'),
    terminalGrowth: numeric(search, 'terminalGrowth'),
    forecastYears: numeric(search, 'forecastYears'),
    equityRiskPremium: numeric(search, 'equityRiskPremium'),
    exitMultiple: numeric(search, 'exitMultiple'),
    fcfConversion: numeric(search, 'fcfConversion'),
  };

  try {
    const report = await buildValuation(symbol, overrides);
    return NextResponse.json(report);
  } catch (error) {
    const status = error instanceof FmpError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Valuation failed', symbol },
      { status },
    );
  }
}
