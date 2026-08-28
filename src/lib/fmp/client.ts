import 'server-only';

const BASE = 'https://financialmodelingprep.com/stable';

/** Per-endpoint cache lifetimes, in seconds. Fundamentals move quarterly; quotes move constantly. */
export const TTL = {
  quote: 30,
  profile: 60 * 60,
  statements: 60 * 60 * 12,
  estimates: 60 * 60 * 6,
  ratios: 60 * 60 * 6,
  search: 60 * 60 * 24,
} as const;

export class FmpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly endpoint: string,
  ) {
    super(message);
    this.name = 'FmpError';
  }
}

function apiKey(): string {
  const key = process.env.FMP_API_KEY;
  if (!key) {
    throw new FmpError(
      'FMP_API_KEY is not set. Copy .env.example to .env.local and add your key.',
      500,
      '(config)',
    );
  }
  return key;
}

type Params = Record<string, string | number | boolean | undefined>;

/**
 * Calls an FMP `stable` endpoint. The API key is read server-side and never
 * serialized into anything returned to the client.
 */
export async function fmp<T>(
  endpoint: string,
  params: Params = {},
  revalidate: number = TTL.statements,
): Promise<T> {
  const url = new URL(`${BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }
  url.searchParams.set('apikey', apiKey());

  const res = await fetch(url, { next: { revalidate } });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // Never let the key leak into an error message or log line.
    const safe = body.slice(0, 300).replaceAll(apiKey(), '***');
    throw new FmpError(
      `FMP ${endpoint} failed (${res.status}): ${safe}`,
      res.status,
      endpoint,
    );
  }

  const json = await res.json();

  // FMP signals some failures with a 200 and an error envelope.
  if (json && typeof json === 'object' && !Array.isArray(json) && 'Error Message' in json) {
    throw new FmpError(String(json['Error Message']), 400, endpoint);
  }
  return json as T;
}

/** Same as `fmp`, but returns [] instead of throwing when a symbol has no data. */
export async function fmpList<T>(
  endpoint: string,
  params: Params = {},
  revalidate: number = TTL.statements,
): Promise<T[]> {
  const data = await fmp<T[]>(endpoint, params, revalidate);
  return Array.isArray(data) ? data : [];
}
