# Equity Lens

**Live:** <https://data-analysis-beta-three.vercel.app> (sign-in required)

Deep fundamental stock analysis in the browser — discounted cash flow driven by
analyst earnings projections, reverse DCF, growth-adjusted multiples, quality
scoring, and sensitivity analysis. Built on the Financial Modeling Prep premium API.

## What it does

Search any listed company and get a full valuation workup on one page.

### Valuation models

| Model | What it answers |
| --- | --- |
| **Earnings-projection DCF** | Discounts consensus EPS for every year analysts publish, converted to cash at a historically observed rate, then fades to a terminal growth rate. Reports bear/base/bull using the analyst low, average and high. |
| **Free cash flow DCF** | Ten-year forecast from trailing FCF with growth fading linearly to terminal, mid-year discounting, and a full enterprise-to-equity bridge. |
| **Reverse DCF** | Solves (by bisection) for the growth rate that makes fair value equal today's price — what the market is already paying for. |
| **Earnings power value** | Capitalizes sustainable after-tax operating profit at the cost of capital assuming zero growth. A floor value. |
| **Graham number** | √(22.5 × EPS × book value per share), for profitable companies with positive book value. |

The five are blended into a single fair value, and each is charted against the
current price so you can see where they disagree.

### Everything else on the page

- **Cost of capital, fully built up** — CAPM cost of equity from a live 10-year
  Treasury, implied cost of debt from interest expense, capital-structure
  weighted WACC. Every input is shown, not just the answer.
- **Growth-adjusted multiples** — trailing and forward PEG (computed locally and
  cross-checked against FMP's own), EV/EBITDA, EV/FCF, EV/Sales, P/FCF, P/B, P/E.
- **Quality and returns** — ROIC against WACC (the economic spread), ROE,
  margins, Piotroski F-score, Altman Z-score.
- **Owner earnings** — Buffett's definition: earnings plus non-cash charges less
  maintenance capex, working capital, and stock compensation.
- **Shareholder yield** — dividends plus buybacks, measured from cash actually
  spent rather than share-count change, so issuance doesn't flatter it.
- **Sensitivity grid** — fair value across a 5×5 matrix of discount and terminal
  growth rates, colour-coded by upside. The range matters more than the point.
- **Watchlist** — synced to Supabase when signed in, localStorage when not.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

### Environment variables

| Variable | Where it comes from |
| --- | --- |
| `FMP_KEY` | Your Financial Modeling Prep account. **Server-side only** — it is never sent to the browser. Stored as a repository secret for CI; `FMP_API_KEY` is accepted as an alias locally. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key (safe to expose; every table is behind row level security) |

Supabase is required for a deployed instance: the whole app sits behind
sign-in, because every valuation page spends paid FMP API calls. Locally the
gate is disabled so you can develop without it. See DEPLOY.md.

### Verifying the data layer

FMP's documentation page slugs do not always match its REST paths, and endpoints
move between plan tiers, so the app does not assume its endpoint list is correct
— it proves it, two ways.

**In CI**, on every push:

```bash
npm run verify:endpoints     # FMP_KEY=... node scripts/verify-endpoints.mjs
```

This calls all twelve endpoints and asserts each returns real rows *and* still
contains the specific fields the valuation engine reads, so a renamed path or a
schema change fails the build loudly instead of silently rendering zeros. The
key is redacted from all output.

**At runtime**, visit **`/api/health`**:

```json
{ "keyConfigured": true, "healthy": true, "passed": 12, "total": 12, "results": [...] }
```

If an endpoint does fail, it degrades only its own panel — a banner on the stock
page names exactly what didn't load.

## Database

Three tables in the `public` schema, prefixed `eq_` to keep them clearly separate
from anything else in the project:

- `eq_watchlists` — a user's watchlists
- `eq_watchlist_items` — tickers on a watchlist
- `eq_valuation_assumptions` — saved per-symbol DCF assumptions

All three have row level security enabled with owner-only policies keyed on
`auth.uid()`, so a user can only ever read or write their own rows.

## Overriding assumptions

Every model runs on defaults derived from the company's own financials, but you
can override them per request:

```
/stock/AAPL?discountRate=0.09&terminalGrowth=0.025&forecastYears=10
```

The same overrides work on the JSON API, which returns the entire report:

```
/api/valuation/AAPL?discountRate=0.09
```

## Architecture

```
src/
  lib/fmp/          Typed FMP client — key handling, caching, error envelopes
  lib/valuation/    The engine: pure functions, no I/O, fully unit-tested
    wacc.ts           CAPM, WACC, implied cost of debt
    dcf.ts            Multi-stage DCF, growth fading, sensitivity grid
    reverse-dcf.ts    Bisection solver for market-implied growth
    earnings-dcf.ts   Analyst-projection DCF, FCF conversion
    multiples.ts      PEG, CAGR, Graham, owner earnings, yields
    build.ts          Orchestrator: FMP data in, full report out
  app/              Next.js App Router pages and API routes
  components/       UI primitives, charts, search, watchlist
```

The valuation engine takes no dependency on FMP or on React — it is plain
functions over numbers, which is what makes it testable.

```bash
npm test        # 29 tests covering the engine
npm run build   # production build
npm run typecheck
```

Tests include a textbook check that a flat perpetuity discounted at 10% values
at exactly CF ÷ r, that reverse DCF recovers a growth rate the forward model
produced, and that terminal growth can never reach the discount rate and produce
infinite value.

## Notes and limits

- Valuation output is a research tool, not investment advice. Every figure is
  shown next to the assumptions that produced it for exactly this reason.
- The terminal value share is reported on each DCF. When it is above ~75%, the
  valuation is mostly an assumption about the far future rather than analysis of
  the business.
- PEG, CAGR and the Graham number return null rather than a misleading number
  when the inputs make them undefined (negative growth, negative book value).
