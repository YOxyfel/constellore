# Constellore free-beta deployment

This scaffold publishes Constellore as a **free-to-players beta** on one paid Render Starter web-service instance in Frankfurt. It does not create any account or cloud resource, and it does not make the current JSON economy safe for real-money purchases.

The configuration follows Render's current [Blueprint YAML reference](https://render.com/docs/blueprint-spec), [Node web-service guidance](https://render.com/docs/web-services), and [persistent-disk documentation](https://render.com/docs/disks).

## What `render.yaml` creates

- One `starter` Node web service named `constellore-beta` in `frankfurt`.
- One manually deployed instance (`numInstances: 1`). Automatic deploys are off so an untested commit cannot replace the public beta.
- `npm install --omit=dev` for the build and `npm start` for the server.
- HTTP health checks at `/healthz`.
- A 1 GB disk mounted at `/var/data`, with the game store at `/var/data/constellore.json`.
- Production mode, with rewarded ads disabled.
- Cross-origin launch-interest requests allowed only from the exact GitHub Pages origin.

Render documents that a disk-backed service cannot run multiple instances, loses zero-downtime deploys, and makes only the mounted path persistent. Those limits are acceptable for a small beta, not for a commercial wallet or entitlement system. See [Persistent Disks](https://render.com/docs/disks) and [Scaling Render Services](https://render.com/docs/scaling).

## Commerce and AI are deliberately off

Do not add either of these variables for the free beta:

- `NEBULA_CHECKOUT_URL`
- `OPENAI_API_KEY`

Keep `REWARDED_ADS_ENABLED=false`. `NODE_ENV=production` also prevents the development-only test entitlement endpoint from acting as a store.

Important: Render preserves environment variables that already exist but are omitted from a later Blueprint sync. If this Blueprint is attached to an existing service, inspect its Environment page and **delete** any old checkout URL or OpenAI key before deploying. Never commit API keys, payment credentials, tax documents, or account recovery codes.

The Exchange UI and credit balances may be tested as gameplay systems, but no player should be charged. Do not advertise bought words, permanent paid ownership, or cash value during this beta.

## Cost guardrail

Use Render's no-fee Hobby workspace with exactly the one Starter service and 1 GB disk in this Blueprint. At Render's currently published compute and disk rates, this stays comfortably below the working EUR 20 monthly ceiling before unusual bandwidth overages. Confirm the estimated monthly total in Render's **Apply Blueprint** screen before accepting it, because prices, taxes, and exchange rates can change. See [Render pricing](https://render.com/pricing) and [Render billing guidance](https://render.com/docs/faq#billing).

Do not add Postgres, Key Value, preview services, extra instances, a Pro workspace, or paid observability during this beta. Each can add separate charges.

## Deploy safely

1. Put the repository on GitHub or GitLab and run `npm test` locally. Never commit `.env`, `data/`, logs, internal launch plans, or unfinished legal drafts.
2. In Render, choose **New > Blueprint**, connect that repository, and select its default branch.
3. Review the plan before applying: one web service, Starter, Frankfurt, one instance, one 1 GB disk, and no other resources.
4. Confirm the Environment page has only the non-secret beta variables in `render.yaml`. Remove `OPENAI_API_KEY` and `NEBULA_CHECKOUT_URL` if they were inherited.
5. Apply the Blueprint and watch the first deploy. Later releases require a deliberate **Manual Deploy** because automatic deploys are disabled.
6. Open the generated `onrender.com` URL only after the service reports healthy.
7. In the GitHub repository, set the Actions variable `PUBLIC_BETA_URL` to that Render URL. Set `PUBLIC_INTEREST_API_URL` to the same hostname plus `/api/interest`, for example `https://constellore-beta.onrender.com/api/interest`.
8. Confirm Render has `INTEREST_ALLOWED_ORIGINS=https://yoxyfel.github.io`. If a custom website domain is added later, append its exact origin with a comma; do not use `*`.
9. Rerun **Deploy marketing site to Pages**. The website now sends players to the full server beta and its on-site Launch Wishlist uses the server-backed aggregate. If the interest URL is absent, Pages deliberately falls back to the repository's real GitHub star count instead of inventing a shared counter.

Render assigns a public `onrender.com` address and terminates HTTPS for web services. The app already reads Render's `PORT` variable and exposes `/healthz`; no port secret or custom `PORT` value is needed. See [Web Services](https://render.com/docs/web-services).

## Verify the beta

Replace the example hostname with the one shown by Render:

```powershell
$base = "https://constellore-beta.onrender.com"
Invoke-RestMethod "$base/healthz"
Invoke-RestMethod "$base/api/config"
```

Expected checks:

- `/healthz` returns HTTP 200 with `ok: true`.
- `/api/config` reports production beta behavior: billing disabled, the test store disabled, rewarded ads disabled, and AI disabled.
- `/api/interest` reports only aggregate launch-interest totals; adding the same browser signal twice does not increase the active count.
- `/` shows the public Constellore marketing site and every Play Beta call-to-action reaches `/play/`.
- `/play/` loads the playable beta directly and survives a browser refresh.
- A fresh guest can start and finish a game, refresh the page, and still see server-backed progress.
- The Founder's Pass control says it is coming after the beta and cannot open a checkout.
- A manual redeploy may cause a short interruption, but guest/server data survives because it is under `/var/data`.

After every release, also run a mobile-sized browser smoke test and one desktop smoke test. Do not rely on the health endpoint alone to validate drag-and-drop, combining, goal completion, or leaderboard submission.

## Optional Cloudflare domain, after the Render URL works

The preferred single-origin layout is `oxyfel.com` for the marketing site and `oxyfel.com/play/` for the beta. If a temporary Render hostname or `play.oxyfel.com` is used first, the same `/` and `/play/` routes still work. Do not configure a custom hostname until the domain is purchased and the Render beta is healthy.

1. Add `play.oxyfel.com` under the Render service's **Custom Domains** settings first.
2. In Cloudflare DNS, create a `CNAME` named `play` targeting the exact `onrender.com` hostname Render gives you.
3. Keep the record **DNS only** while Render verifies the domain and issues TLS. Set Cloudflare SSL/TLS mode to **Full**. After Render shows a valid certificate, proxying is optional.
4. Do not create an `AAAA` record for this Render hostname; remove a conflicting one if Cloudflare imported it.

These steps follow Render's [Cloudflare DNS guide](https://render.com/docs/configure-cloudflare-dns) and [custom-domain guide](https://render.com/docs/custom-domains). Cloudflare's own [DNS record instructions](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/) explain the record fields.

For the beta, leave Cloudflare caching at its default and do **not** enable a broad “Cache Everything” rule. If proxying is enabled later, explicitly bypass edge caching for `/api/*` and `/healthz`; these are live, player-specific or operational responses. Also avoid forcing long cache times on `/service-worker.js` or HTML until asset versioning and update behavior have been release-tested. Cloudflare documents rule behavior in [Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/).

## Why this is not money-ready

The disk-backed JSON file is a temporary beta store. It has no production database transaction boundary, durable purchase ledger, receipt/webhook reconciliation, account recovery, fraud controls, or horizontally scalable session model. A single malformed write, operational mistake, or disk-level incident can affect the whole beta. Render snapshots help recovery, but they are not a payment ledger and restoring one rolls back later state.

Before accepting money, migrate player identity, balances, entitlements, market purchases, leaderboards, and ranked runs to a transactional database; add verified payment-provider webhooks with idempotency and reconciliation; add account recovery and audit tooling; publish the required legal/support pages; and complete Bulgarian tax/accounting and payment-provider onboarding. Until all of that is independently verified, keep checkout credentials and URLs absent.

If beta traffic or data becomes meaningful, stop new signups before migrating the JSON store. Do not attach another instance to “scale” it: Render explicitly does not allow multi-instance scaling with an attached persistent disk.
