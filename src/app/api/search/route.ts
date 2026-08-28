import { NextResponse } from 'next/server';
import { searchSymbols } from '@/lib/fmp/endpoints';
import { FmpError } from '@/lib/fmp/client';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim();
  if (!query) return NextResponse.json([]);

  try {
    const results = await searchSymbols(query, 12);
    return NextResponse.json(results);
  } catch (error) {
    const status = error instanceof FmpError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status },
    );
  }
}
