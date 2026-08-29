# Deploying Equity Lens

The app is a standard Next.js server application: it needs a Node runtime, not a
static host, because the FMP key is read server-side and must never reach the
browser. Vercel is the path of least resistance — it detects the framework, and
no config file is required.

## Vercel (recommended, ~2 minutes)

1. Go to <https://vercel.com/new> and import `richacarson/Data-Analysis-`.
2. Framework preset will auto-detect as **Next.js**. Leave build settings alone.
3. Add three environment variables (Settings → Environment Variables), each
   applied to **Production, Preview and Development**:

   | Name | Value |
   | --- | --- |
   | `FMP_KEY` | your Financial Modeling Prep key |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://ocovjbvrtbxptqtucyqw.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the project's publishable key |

   `NEXT_PUBLIC_*` values are inlined at build time, so if you add them after the
   first deploy you must redeploy for them to take effect.

4. **Set the production branch.** This repository has no `main` yet — the code
   lives on `claude/stock-analysis-web-app-u12rr8`. Either merge that branch to
   `main` first, or set Settings → Git → Production Branch to it.
5. Deploy, then open `/api/health` on the live URL. It should report
   `"healthy": true, "passed": 13, "total": 13`. If it doesn't, the response
   names the endpoint that failed.

### Supabase auth redirect

Magic-link sign-in sends users back to the origin they signed in from. Add the
deployed URL to Supabase → Authentication → URL Configuration → Redirect URLs,
otherwise the emailed link will bounce to localhost.

Note that this Supabase project gates signup with an `allowed_users` allowlist,
so only allowlisted emails can create an account.

## Other hosts

Anything that runs a Node server works — Netlify, Render, Fly.io, Railway, or a
container. Build with `npm run build`, serve with `npm start`, and set the same
three environment variables.

Static hosts (GitHub Pages, S3) will **not** work. The app renders on the server
specifically so the FMP key stays out of the client bundle; exporting it
statically would either break the data layer or leak the key.

## Cost and quota

Every page view spends FMP API calls against your account. Responses are cached
server-side (fundamentals 12h, ratios and estimates 6h, quotes 30s), so repeat
views of the same ticker are cheap — but a publicly reachable deployment means
anyone who finds the URL is spending your quota. See the access-control note in
the README before sharing the link widely.
