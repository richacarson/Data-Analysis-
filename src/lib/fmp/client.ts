import 'server-only';
import { unstable_cache } from 'next/cache';

// A local stand-in can be pointed at in development; production always hits FMP.
const BASE =
  (process.env.NODE_ENV !== 'production' && process.env.FMP_BASE_URL) ||
  'https://financialmodelingprep.com/stable';

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
  // FMP_KEY is the name used for the repository/deployment secret; FMP_API_KEY
  // is accepted as an alias so a local .env.local using either name works.
  const key = process.env.FMP_KEY || process.env.FMP_API_KEY;
  if (!key) {
    // The right remedy differs by environment, and pointing someone at a local
    // .env file while they are looking at a deployed site is just misleading.
    const remedy =
      process.env.VERCEL === '1'
        ? 'Add FMP_KEY in the Vercel project settings (Settings → Environment Variables), applied to Production, then redeploy.'
        : 'Copy .env.example to .env.local and add your key.';
    throw new FmpError(`FMP_KEY is not set. ${remedy}`, 500, '(config)');
  }
  return key;
}

type Params = Record<string, string | number | boolean | undefined>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/*
 * FMP limits calls per minute across the whole key. A cold screen of every
 * sleeve is ~620 calls, and fired at full speed it spends the minute's
 * allowance in seconds — after which every page, not just the screen, gets a
 * 429 until the window rolls over. A token bucket spreads network calls out:
 * a burst of 40 so a single stock page never waits, then 8 a second.
 *
 * Fluid compute reuses an instance across requests, so concurrent pages on
 * one instance share the bucket. It is a ceiling per instance, not a global
 * one; the 429 retry below covers what gets through anyway.
 */
const BURST = 40;
const PER_SECOND = 8;
const bucket = { tokens: BURST, at: Date.now() };

async function acquire(): Promise<void> {
  for (;;) {
    const now = Date.now();
    bucket.tokens = Math.min(BURST, bucket.tokens + ((now - bucket.at) / 1000) * PER_SECOND);
    bucket.at = now;
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return;
    }
    await sleep(((1 - bucket.tokens) / PER_SECOND) * 1000);
  }
}

/** Waits after a 429 before retrying; the per-minute window is what resets. */
const RETRY_DELAYS_MS = [3000, 8000, 20000];

async function network<T>(endpoint: string, query: string): Promise<T> {
  const url = new URL(`${BASE}/${endpoint}`);
  url.search = query;
  url.searchParams.set('apikey', apiKey());

  for (let attempt = 0; ; attempt++) {
    await acquire();
    // The response is cached by the wrapper below, not by fetch, so only a
    // genuine network call ever spends a token. The signal matters twice:
    // it bounds a hung request, and a fetch with a signal is exempt from
    // Next's per-render memoisation, which would otherwise hand every retry
    // the same 429 without calling FMP again.
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) });

    if (res.status === 429 && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }

    if (!res.ok) {
      if (res.status === 429) {
        throw new FmpError(
          "FMP's per-minute request limit was reached. Wait a minute and reload — nothing is wrong with the data.",
          429,
          endpoint,
        );
      }
      const body = await res.text().catch(() => '');
      // Never let the key leak into an error message or log line.
      const safe = body.slice(0, 300).replaceAll(apiKey(), '***');
      throw new FmpError(`FMP ${endpoint} failed (${res.status}): ${safe}`, res.status, endpoint);
    }

    const json = await res.json();
    // FMP signals some failures with a 200 and an error envelope.
    if (json && typeof json === 'object' && !Array.isArray(json) && 'Error Message' in json) {
      throw new FmpError(String(json['Error Message']), 400, endpoint);
    }
    return json as T;
  }
}

/**
 * Calls an FMP `stable` endpoint. The API key is read server-side and never
 * serialized into anything returned to the client, nor into the cache key.
 * Failures are thrown, so they are never cached.
 */
export async function fmp<T>(
  endpoint: string,
  params: Params = {},
  revalidate: number = TTL.statements,
): Promise<T> {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params).sort(([a], [b]) => a.localeCompare(b))) {
    if (v !== undefined && v !== '') search.set(k, String(v));
  }
  const query = search.toString();
  return unstable_cache(() => network<T>(endpoint, query), ['fmp', endpoint, query], {
    revalidate,
  })();
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
