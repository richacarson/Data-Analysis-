# Deploying Equity Lens

**Live:** <https://data-analysis-beta-three.vercel.app>

The app is a Next.js server application: it needs a Node runtime, not a static
host, because the FMP key is read server-side and must never reach the browser.

## Current deployment

Hosted on Vercel, project `data-analysis`, git-linked to this repository so every
push to the production branch deploys automatically.

| Setting | Value |
| --- | --- |
| Production branch | `claude/stock-analysis-web-app-u12rr8` |
| Production domain | `data-analysis-beta-three.vercel.app` |
| Node version | 24.x |

### Environment variables

| Name | Type | Why |
| --- | --- | --- |
| `FMP_KEY` | Sensitive | A real secret, read only in server code at request time. |
| `NEXT_PUBLIC_SUPABASE_URL` | Encrypted (not Sensitive) | Must be readable at build time. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Encrypted (not Sensitive) | Same. Public by design and protected by row level security. |

**Do not mark the `NEXT_PUBLIC_*` variables as Sensitive.** Vercel withholds
sensitive values at build time, and `NEXT_PUBLIC_*` values must be inlined into
the bundle during the build. Marking them sensitive makes the app return
`503 Authentication is not configured` on every route, because the middleware
cannot see them. This bit us once — the symptom looks like missing variables even
though they are present in the dashboard.

## Remaining manual steps

These two cannot be done through the API and need the dashboard:

1. **Supabase redirect URL — required for sign-in to work.**
   Supabase → Authentication → URL Configuration → add
   `https://data-analysis-beta-three.vercel.app/**` to Redirect URLs, and set
   Site URL to the same origin. Until this is done, magic-link emails will send
   users to `localhost` and sign-in will fail.

2. **Production branch (optional).** Vercel → Settings → Git → Production Branch
   → change to `main`. The API silently ignores this field. Both branches
   currently point at the same commit, so nothing is broken either way.

## Access control

The whole app is behind Supabase sign-in — middleware requires a session on
every route, API routes included, because each valuation page spends paid FMP
API calls. Signup is further limited by this Supabase project's `allowed_users`
allowlist.

If Supabase is not configured, the gate fails closed in production (503) rather
than serving the API to the open internet. Local development runs ungated.

## Verifying a deployment

Sign in, then open `/api/health`. It pings all 13 FMP endpoints and should report
`"healthy": true, "passed": 13, "total": 13`. It is behind the auth gate because
it spends quota.

## Other hosts

Anything running a Node server works — Netlify, Render, Fly.io, Railway, or a
container. Build with `npm run build`, serve with `npm start`, set the same three
variables. Static hosts (GitHub Pages, S3) will not work: the app renders on the
server so the FMP key stays out of the client bundle.

## Cost and quota

Every page view spends FMP API calls. Responses are cached server-side
(fundamentals 12h, ratios and estimates 6h, quotes 30s), so repeat views of the
same ticker are cheap.
