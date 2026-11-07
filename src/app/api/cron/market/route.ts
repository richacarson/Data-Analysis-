import { after, NextResponse, type NextRequest } from 'next/server';
import { buildSp500Expected, buildSp500PeSnapshot } from '@/lib/market/sp500';
import { recordMarketSnapshot } from '@/lib/market/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_PASSES = 100;
// One invocation's budget. The Hobby plan kills a function after ~10s, so a
// pass must finish and return (chaining the next one via after()) well
// inside that — a pass that is killed by the platform timeout never chains,
// and no snapshot is ever recorded. 4s of work leaves room for the cold
// start, the response, and the in-flight fetches to land. The pool is kept
// small on purpose: each chained invocation starts a fresh instance with a
// burst of 40 FMP tokens, and a pass that spends more than the burst waits
// on the 8-a-second refill — in-flight fetches then overrun the budget and
// the platform kills the function before it can return and chain.
const PASS_BUDGET_MS = 4_000;

/**
 * Records the day's S&P 500 snapshot after the close, in two phases.
 *
 * Phase 1, the P/E snapshot, is built across chained passes (each pass
 * fetches what it can inside its short budget; fetched members are cached)
 * and recorded as soon as a pass finishes it — the Market page must not wait
 * on phase 2. Phase 2, the house expected return, runs the full model on
 * every member (several thousand requests, more than one invocation's time
 * allows): finished rows are cached, and the next pass (chained, up to a
 * hundred) finishes from there. A pass that runs out of time in either phase
 * chains the next one.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const started = Date.now();
  const pass = Number(request.nextUrl.searchParams.get('pass') ?? '1') || 1;
  const dry = request.nextUrl.searchParams.get('dry') === '1';
  const deadline = started + PASS_BUDGET_MS;
  const seconds = () => Math.round((Date.now() - started) / 1000);
  const chainNext = () => {
    if (pass >= MAX_PASSES) return;
    const next = new URL(request.nextUrl);
    next.searchParams.set('pass', String(pass + 1));
    after(() =>
      fetch(next, { headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(10_000) }).catch(
        () => undefined,
      ),
    );
  };

  // Phase 1 — the P/E snapshot. Record it the moment it exists, so the page
  // updates even if the expected return below needs more passes.
  const pe = await buildSp500PeSnapshot(deadline);
  if (!pe) {
    console.log(`[cron/market] pass ${pass}: P/E build ran out of time after ${seconds()}s; chaining`);
    chainNext();
    return NextResponse.json({ pass, recorded: false, phase: 'pe', seconds: seconds() });
  }
  const snapshot = pe.snapshot;
  // ?dry=1 returns the snapshot without saving it, for checking the figures.
  // In dry mode the P/E snapshot is returned even when the expected return
  // below is still pending, so the figures can be checked after one pass.
  if (!dry) {
    await recordMarketSnapshot(snapshot);
    console.log(`[cron/market] pass ${pass}: P/E snapshot recorded for ${snapshot.asOf} (${snapshot.used}/${snapshot.members} members)`);
  }

  // Phase 2 — the house expected return across the same members.
  const expected = await buildSp500Expected(pe.members, deadline);
  if (!expected) {
    console.log(`[cron/market] pass ${pass}: expected return ran out of time after ${seconds()}s; chaining`);
    chainNext();
    if (dry) return NextResponse.json(snapshot);
    return NextResponse.json({ pass, recorded: snapshot.asOf, phase: 'expected-pending', seconds: seconds() });
  }
  const full = { ...snapshot, expected };
  if (dry) return NextResponse.json(full);
  await recordMarketSnapshot(full);
  console.log(`[cron/market] pass ${pass}: full snapshot recorded for ${full.asOf}`);
  return NextResponse.json({
    pass,
    recorded: full.asOf,
    members: full.members,
    used: full.used,
    years: full.years.map((y) => ({ year: y.year, pe: y.pe && Number(y.pe.toFixed(2)), growth: y.growth })),
    trailing: full.trailing,
    expected: full.expected,
    seconds: seconds(),
  });
}
