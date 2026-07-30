# Constellore free-beta deployment

This scaffold publishes Constellore as a **free-to-players beta** on one paid Render Starter web-service instance in Frankfurt. It does not create any account or cloud resource, and it does not make the current JSON economy safe for real-money purchases.

The v5 hybrid beta keeps every solo mode deterministic, device-local, and playable offline in the Pages and itch packages. Live Scramble duels are the one online gameplay boundary: their three client files load only when the player opens Scramble, and their authenticated requests go to the exact HTTPS `PUBLIC_DUEL_API_URL` base. If that base is absent, unreachable, or disabled, solo play continues normally and Scramble reports that live play is unavailable. Both server kill switches must be enabled before the public duel routes exist, and Cosmos Circuit remains disabled while it receives separate development.

The v4.0.0-beta.4 build replaces the landscape studio ident with the full 24-second “A Production by Oxyfel Games” Kintsugi film, carries its retimed cinematic sound design into the existing spaceship launch, and fades through black between the two acts. It leaves the dedicated portrait phone cut unchanged, starts automatically on page load, falls back to uninterrupted muted playback when a browser refuses first-visit audio autoplay, and retains once-per-session playback, interrupted-run restoration, smooth cinematic-to-home audio handoff, exclusive cosmetic sound previews, responsive home controls, and temporary removal of Cosmos Circuit while that mode receives separate development. Its runtime, cache, static-site, feedback-graph, and itch.io package identities share the same prerelease version.

The v3.5.1-beta.5 build adds the first-open cosmic journey, combination-story scenes, Cosmos Circuit and Crazy Path practice systems, the cosmetic-only Star Path, persistent sound controls, compact victory presentation, and a deployment-ready anonymous report receiver using Cloudflare Workers and an EU-jurisdiction D1 database. Local gameplay progress remains device-only by default. The report receiver preserves local retry, validates submitted words against the released authored graph, rejects combinations that already work, rate-limits both the pseudonymous reporter and its one-way network bucket, stores only bounded structured fields and pair-scoped one-way reporter digests, and exposes a protected aggregate compatible with `operator:feedback`. Follow [DEPLOY_FEEDBACK_BACKEND.md](DEPLOY_FEEDBACK_BACKEND.md) for the one-time Cloudflare authorization and deployment.

The v3.5.0-beta.1 build protects the opening experience and makes every completed route worth sharing. A curated Golden 50 catalog anchors the first thirty personal adaptive completions with familiar destinations, plain contextual clues, verified three-to-seven-combination routes, and at least two authored final recipes per target. Contextual constellation cards now use the destination's realm, palette, motif, clue, universe, Cosmic Law, Daily identity, and the spoiler-safe silhouette of the real route; exact target-and-seed links open today's shared Daily or a replayable friend challenge when that Daily is older or already completed. The first ten real wins progressively reveal sharing, game choices, and Explore while withholding advanced competition, economy, mastery, and progression surfaces. The build retains compact results, reliable **Play next level** actions, the gentle Earth + Water → Mud tutorial, private adaptive difficulty, one-tap Cosmic Gate entry, 50 short thoughts about curiosity and creation, responsive cosmic artwork, short progression-neutral Star Breaks, direct no-points Show path, readable answer constellations, verified Classic and Shuffled openings, twelve permanent Route Ranks, promotion challenges, progressively gated Route Remixes, direct board tools, 3,199 deterministic recipes, and automated browser/release gates. Fixed Daily, Weekly, friend, story, training, and player-chosen targets remain unchanged. These features are ready for beta testing; they do not remove the storage, operations, commerce, legal, or real-user evidence requirements described below.

The configuration follows Render's current [Blueprint YAML reference](https://render.com/docs/blueprint-spec), [Node web-service guidance](https://render.com/docs/web-services), and [persistent-disk documentation](https://render.com/docs/disks).

## What `render.yaml` creates

- One `starter` Node web service named `constellore-beta` in `frankfurt`.
- One manually deployed instance (`numInstances: 1`). Automatic deploys are off so an untested commit cannot replace the public beta.
- `npm install --omit=dev` for the build and `npm start` for the server.
- Liveness at `/livez` and Render readiness checks at `/readyz` (the legacy `/healthz` alias remains available).
- A 1 GB disk mounted at `/var/data`, with the game store at `/var/data/constellore.json`.
- Privacy-reduced safe backups at startup and once per day under `/var/data/backups`, retaining seven files by default.
- Production mode, with checkout fulfillment, the development test store, and rewarded ads explicitly disabled.
- Cross-origin authenticated game writes allowed only from the exact GitHub Pages and release-candidate itch iframe origins; the itch origin must be verified before publishing.
- Live duels protected by independent internal and public kill switches.

## Hybrid solo and live-duel boundary

Pages and itch remain local-practice builds for every solo mode: their World Graph, saves, progression, and interrupted-run restoration do not need the hosted service. Scramble match state and Duel Rating are server-backed and exist only while the player uses that online mode. The release builder adds `data-duel-api` to the game document separately. Set `PUBLIC_DUEL_API_URL` to the exact hosted HTTPS base ending in `/api/duels`, for example `https://constellore-beta.onrender.com/api/duels`. A trailing slash is normalized away. HTTP, credentials, a query, a fragment, or any other path fails the build. Deliberate offline builds may leave the variable empty; the attribute is then empty and live Scramble stays unavailable.

The hosted service exposes public duel routes only while both of these are true:

- `CONSTELLORE_DUELS_ENABLED=true` is the internal service switch.
- `CONSTELLORE_PUBLIC_DUELS_ENABLED=true` is the public release switch.

Turn either one off to stop new public duel traffic without affecting solo play. Keep both false in local environments unless live-duel testing is intentional.

Cross-origin duel requests use authenticated player headers, so `APP_ALLOWED_ORIGINS` must contain exact origins and must never contain `*`, `*.itch.io`, `*.itch.zone`, or a hostname-suffix rule. The Blueprint starts with `https://yoxyfel.github.io,https://html-classic.itch.zone`. After uploading the itch package, inspect the iframe's actual `Origin` request header. If itch serves this game from a different exact origin, replace the itch entry before publishing; do not add a broader fallback. Same-origin `/play/` requests need no allowlist entry.

The static service worker never intercepts cross-origin requests or `/api/` traffic. `scramble.mjs`, `scramble-runtime.mjs`, and `scramble.css` stay outside the install shell and are cached only after the player opens Scramble. A duel outage therefore cannot block installation, startup, refresh restoration, or offline solo play.

Render documents that a disk-backed service cannot run multiple instances, loses zero-downtime deploys, and makes only the mounted path persistent. Those limits are acceptable for a small beta, not for a commercial wallet or entitlement system. See [Persistent Disks](https://render.com/docs/disks) and [Scaling Render Services](https://render.com/docs/scaling).

## Commerce and AI are deliberately off

Do not add either of these variables for the free beta:

- `NEBULA_CHECKOUT_URL`
- `CONSTELLORE_COMMERCE_FULFILLMENT_READY=true`
- `OPENAI_API_KEY`

Keep `REWARDED_ADS_ENABLED=false` and `CONSTELLORE_ENABLE_TEST_STORE=false`. Production also prevents the development-only test entitlement endpoint from acting as a store.

Important: Render preserves environment variables that already exist but are omitted from a later Blueprint sync. If this Blueprint is attached to an existing service, inspect its Environment page and **delete** any old checkout URL or OpenAI key before deploying. Never commit API keys, payment credentials, tax documents, or account recovery codes.

The Exchange UI and Star Credit balances may be tested as gameplay systems, but no player should be charged. Star Credits are earned from verified play and are never a cash product. Do not advertise cash-bought words, cash value, competitive advantages, or a working Supporter Pack checkout during this beta.

`CONSTELLORE_ADMIN_TOKEN` is optional. Leave it unset to make the admin endpoints look absent. If an operator needs the aggregate analytics, aggregate recipe-feedback, or on-demand backup endpoints, create a high-entropy secret of at least 24 bytes in Render's secret environment UI and send it only in an authorization header. Never put it in Pages variables, browser code, screenshots, URLs, or the repository.

## Cost guardrail

Use Render's no-fee Hobby workspace with exactly the one Starter service and 1 GB disk in this Blueprint. At Render's currently published compute and disk rates, this stays comfortably below the working EUR 20 monthly ceiling before unusual bandwidth overages. Confirm the estimated monthly total in Render's **Apply Blueprint** screen before accepting it, because prices, taxes, and exchange rates can change. See [Render pricing](https://render.com/pricing) and [Render billing guidance](https://render.com/docs/faq#billing).

Do not add Postgres, Key Value, preview services, extra instances, a Pro workspace, or paid observability during this beta. Each can add separate charges.

## Deploy safely

1. Put the repository on GitHub or GitLab and run `npm run check` locally. Never commit `.env`, `data/`, logs, internal launch plans, or unfinished legal drafts.
2. In Render, choose **New > Blueprint**, connect that repository, and select its default branch.
3. Review the plan before applying: one web service, Starter, Frankfurt, one instance, one 1 GB disk, and no other resources.
4. Confirm the Environment page has only the non-secret beta variables in `render.yaml`. Remove `OPENAI_API_KEY` and `NEBULA_CHECKOUT_URL` if they were inherited. Also remove or set `CONSTELLORE_COMMERCE_FULFILLMENT_READY=false`; checkout stays fail-closed unless the storage adapter also reports `commerceSafe: true`, and the bundled JSON adapter never does.
5. Confirm `CONSTELLORE_DUELS_ENABLED=true`, `CONSTELLORE_PUBLIC_DUELS_ENABLED=true`, and the exact `APP_ALLOWED_ORIGINS` list before public duel testing. Either duel flag is a safe emergency kill switch.
6. Apply the Blueprint and watch the first deploy. Later releases require a deliberate **Manual Deploy** because automatic deploys are disabled.
7. Open the generated `onrender.com` URL only after the service reports healthy. Keep it private QA-only until the pseudonymous-account privacy notice, terms, and a tested private support route are public.
8. In the GitHub repository, set the Actions variable `PUBLIC_BETA_URL` to the full Render game URL ending in `/play/`, for example `https://constellore-beta.onrender.com/play/`—not the server root.
9. Set the Actions variable `PUBLIC_DUEL_API_URL` to the same service's exact duel base, for example `https://constellore-beta.onrender.com/api/duels`. Pass the same value to both build and verification commands.
10. Confirm Render has `INTEREST_ALLOWED_ORIGINS=https://yoxyfel.github.io`. If a custom website domain is added later, append its exact origin with a comma; do not use `*`.
11. Upload a private itch draft, verify its exact iframe origin, and update `APP_ALLOWED_ORIGINS` if it differs from `https://html-classic.itch.zone`.
12. Rerun **Deploy marketing site to Pages**. The website now sends players to the full server beta and its on-site Launch Wishlist uses the server-backed aggregate. If the interest URL is absent, Pages deliberately falls back to the repository's real GitHub star count instead of inventing a shared counter.

Render assigns a public `onrender.com` address and terminates HTTPS for web services. The app already reads Render's `PORT` variable and exposes `/livez` for liveness and `/readyz` for readiness; `/healthz` remains a compatibility alias for readiness. No port secret or custom `PORT` value is needed. See [Web Services](https://render.com/docs/web-services).

## Verify the beta

Replace the example hostname with the one shown by Render:

```powershell
$base = "https://constellore-beta.onrender.com"
Invoke-RestMethod "$base/livez"
Invoke-RestMethod "$base/readyz"
Invoke-RestMethod "$base/api/config"
```

Expected checks:

- `/livez` returns HTTP 200 with `ok: true` while the process is alive.
- `/readyz` returns HTTP 200 only when the content graph and configured store are ready. `/healthz` returns the same readiness result for compatibility.
- `/api/config` reports production beta behavior: billing disabled, the test store disabled, rewarded ads disabled, and AI disabled.
- `/api/config` also reports an empty credit-pack catalog, `starCreditsSoldForCash: false`, and no ranked advantages in its commerce policy.
- `/api/interest` reports only aggregate launch-interest totals; adding the same browser signal twice does not increase the active count.
- `/` shows the public Constellore marketing site and every Play Beta call-to-action reaches `/play/`.
- `/play/` loads the playable beta directly and survives a browser refresh.
- Pages and itch can start and complete solo games offline; opening Scramble lazily loads its three client files and clearly requires a network connection.
- A configured Pages or itch build sends live duel traffic only to its exact `data-duel-api` base. The service rejects unlisted origins, and disabling either duel feature flag removes public duel availability without breaking solo play.
- A fresh guest receives one Recovery Kit. It is kept only in that browser until acknowledged, can be opened from **Menu → Settings and data → Account** immediately, is prompted after the first real win, cannot be dismissed without acknowledgement, and can then be rotated from that Account section.
- A fresh guest can complete First Orbit, start and finish a game, refresh the page, and still see the progress saved on that device.
- The same seed shows the same authored universe, while its law changes only contextual presentation and never a recipe or score.
- A real, non-revealed, non-user-authored combination can be rated once as Logical, Surprising, or Bad; repeating either the move or recipe in one orbit is rejected.
- A completed route can preview and download a Constellation Card; a zero-score assisted completion is labelled Study and a Reality-Bent completion is labelled Open.
- Free cosmetic loadout choices work, Supporter collections can be previewed and unlocked with earned Star Credits, cash Supporter checkout remains disabled, and Star Credits have no cash purchase control.
- The Supporter Pack control says it is coming after the beta and cannot open a checkout.
- A manual redeploy may cause a short interruption, but guest/server data survives because it is under `/var/data`.

If the admin API is deliberately enabled, verify it from an operator terminal rather than a browser URL:

```powershell
$headers = @{ Authorization = "Bearer $env:CONSTELLORE_ADMIN_TOKEN" }
Invoke-RestMethod "$base/api/analytics/summary?days=30" -Headers $headers
Invoke-RestMethod "$base/api/admin/recipe-feedback?minimumVotes=3&limit=50" -Headers $headers
Invoke-RestMethod "$base/api/admin/rejected-pairs?minimumReports=1&limit=100" -Headers $headers
Invoke-RestMethod "$base/api/admin/backup" -Method Post -Headers $headers -ContentType "application/json" -Body "{}"
```

The recipe-feedback and rejected-pair responses are aggregate-only. A dedicated combination report contains only two bounded input concepts, an optional bounded suggested result, a fixed reason, and the game mode; arbitrary comments and contact details are rejected. Reporter IDs are retained only as one-way keyed digests for deduplication. The backup response names a server-side file; download or copy backups through a separate operator-controlled process, because keeping all rotations on the same attached disk is not disaster recovery.

### Retrieve the player-feedback report

The report is **not emailed**. In the hosted Node beta, a player's deliberate “What should these words make?” submission is sent to `POST /api/combination-reports` and aggregated in the server store at `CONSTELLORE_DATA_PATH`. Logical/Surprising/Bad recipe ratings are stored there separately. The protected endpoints above are how the operator reads those aggregates.

For a combined JSON export, set the server origin and the same admin token in an operator-only PowerShell session:

```powershell
$env:CONSTELLORE_OPERATOR_BASE_URL = "https://constellore-beta.onrender.com"
$headers = @{ Authorization = "Bearer $env:CONSTELLORE_ADMIN_TOKEN" }
Invoke-RestMethod "$env:CONSTELLORE_OPERATOR_BASE_URL/api/admin/rejected-pairs?minimumReports=1&limit=100" -Headers $headers
npm run --silent operator:feedback | Set-Content ".\constellore-feedback.json" -Encoding utf8
Remove-Item Env:\CONSTELLORE_ADMIN_TOKEN
```

Use the exact `onrender.com` origin assigned to the service; do not append `/play/`. The first request is the shortest way to inspect missing-combination requests. The npm command exports both missing-combination requests and recipe ratings. Optional bounds are `CONSTELLORE_REPORT_MINIMUM_REPORTS`, `CONSTELLORE_REPORT_MINIMUM_VOTES`, and `CONSTELLORE_REPORT_LIMIT`. The tool only performs authenticated `GET` requests and never prints the token.

Keep the token in Render's secret environment UI and an operator environment variable only. Do not paste it into a URL, Pages variable, browser console, screenshot, repository file, or support message. If the endpoint returns 404, the server admin token is absent or too short; if it returns 401, the operator token does not match.

GitHub Pages and itch always save a bounded report in that browser's local storage. For zero-cost frictionless delivery, deploy the receiver in [DEPLOY_FEEDBACK_BACKEND.md](DEPLOY_FEEDBACK_BACKEND.md), then set `PUBLIC_FEEDBACK_API_URL` to its exact HTTPS `/api/combination-reports` endpoint before building Pages or the itch ZIP. A one-tap report then goes straight to the protected aggregate without a GitHub account. If the receiver is offline, the local outbox retries automatically; if no endpoint was configured, the game states clearly that the idea remains only on that device. A player can also use **Menu → Settings and data → Privacy and data → Export local report** to download the local copy.

Set `CONSTELLORE_ADMIN_TOKEN` in the hosted service before collecting reports, and keep it out of the public build. Add the Pages origin to `INTEREST_ALLOWED_ORIGINS` or `ANALYTICS_ALLOWED_ORIGINS`; the report endpoint separately accepts HTTPS itch.io and itch.zone game origins. Then use `operator:feedback` to retrieve the aggregate. GitHub issues remain an optional manual support route, not the in-game delivery mechanism.

After every release, also run a mobile-sized browser smoke test and one desktop smoke test. Do not rely on the health endpoint alone to validate drag-and-drop, combining, goal completion, or leaderboard submission.

## Optional Cloudflare domain, after the Render URL works

Choose one layout and keep `PUBLIC_BETA_URL` aligned with it. The preferred single-origin layout is `oxyfel.com` for marketing and `oxyfel.com/play/` for the game. The simpler beta-only layout below uses `play.oxyfel.com` for the Render service, so its game URL is `https://play.oxyfel.com/play/`. Do not configure either layout until the domain is purchased and the Render beta is healthy.

1. Add `play.oxyfel.com` under the Render service's **Custom Domains** settings first.
2. In Cloudflare DNS, create a `CNAME` named `play` targeting the exact `onrender.com` hostname Render gives you.
3. Keep the record **DNS only** while Render verifies the domain and issues TLS. Set Cloudflare SSL/TLS mode to **Full**. After Render shows a valid certificate, proxying is optional.
4. Do not create an `AAAA` record for this Render hostname; remove a conflicting one if Cloudflare imported it.
5. After TLS works, set `PUBLIC_BETA_URL=https://play.oxyfel.com/play/`, add `https://play.oxyfel.com` to the exact API-origin allowlists that need it, rebuild Pages, and test every CTA signed out.

These steps follow Render's [Cloudflare DNS guide](https://render.com/docs/configure-cloudflare-dns) and [custom-domain guide](https://render.com/docs/custom-domains). Cloudflare's own [DNS record instructions](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/) explain the record fields.

For the beta, leave Cloudflare caching at its default and do **not** enable a broad “Cache Everything” rule. If proxying is enabled later, explicitly bypass edge caching for `/api/*`, `/livez`, `/readyz`, and the legacy `/healthz`; these are live, player-specific or operational responses. Also avoid forcing long cache times on `/service-worker.js` or HTML until asset versioning and update behavior have been release-tested. Cloudflare documents rule behavior in [Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/).

## Why this is not money-ready

The disk-backed JSON file is a temporary beta store. It has no production database transaction boundary, durable purchase ledger, receipt/webhook reconciliation, independently verified account linking, fraud controls, or horizontally scalable session model. Recovery Kits protect verified identity access, but possession of the kit is the only recovery proof; gameplay progression remains device-local while cloud-profile saving is disabled. A single malformed write, operational mistake, or disk-level incident can still affect server-backed records. Same-disk safe backups are useful for operator recovery, but they are not an entitlement ledger and restoring one rolls back later state.

Before accepting money, migrate player identity, balances, entitlements, market purchases, leaderboards, any future cross-device progression, recovery rotation, and ranked runs to a transactional database; add verified payment-provider webhooks with idempotency and reconciliation; add support recovery and audit tooling; copy backups off-site and test a restore; publish the required legal/support pages; and complete Bulgarian tax/accounting and payment-provider onboarding. Until all of that is independently verified, keep checkout credentials and fulfillment readiness absent.

If beta traffic or data becomes meaningful, stop new signups before migrating the JSON store. Do not attach another instance to “scale” it: Render explicitly does not allow multi-instance scaling with an attached persistent disk.
