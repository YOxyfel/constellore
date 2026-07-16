# Constellore

Constellore is a mobile-first cosmic word-combination puzzle published by **Oxyfel Games**. Players drag concepts together on a freeform board, trace a constellation of discoveries, and try to reach a guaranteed-solvable target.

The former working title, Wordforge, was retired before release because it is already used by public word games.

The repository is a dependency-free Node.js 20+ web app and installable PWA. Its platform hooks are deliberately small so the same game can sit inside an iOS/Android WebView, Electron, or a Steam/Epic shell.

## Run and verify

```powershell
npm start
npm run check
```

Open `http://localhost:4173` for the marketing site and `http://localhost:4173/play/` for the playable beta. The production health check is `GET /healthz`.

The public site is deliberately split into two same-origin experiences:

- `Website/` is the mobile-first marketing site served at `/`.
- `public/` is the tested game client served at `/play/`.
- Game APIs remain under `/api/*`.
- The PWA manifest and service worker are scoped to `/play/`, so installing the game does not replace the marketing homepage.

For the current no-payments public beta, follow [DEPLOY_BETA.md](DEPLOY_BETA.md) and review [render.yaml](render.yaml). GitHub Pages publishes the static marketing site; the playable beta requires the Node server on Render or another compatible host.

The marketing site is deployed at [yoxyfel.github.io/constellore](https://yoxyfel.github.io/constellore/). The Pages workflow builds only `Website/`; when the public Node host is ready, set the repository Actions variable `PUBLIC_BETA_URL` to its HTTPS URL and rerun the Pages workflow. Until then, beta CTAs point to this repository instead of a nonfunctional static `/api` route.

## Player experience

- **Reach** - a reachable random target or a player-entered target.
- **Quick Orbit** - a 90-second sprint with a time reward.
- **Move Limit** - a tactical target with twelve successful combinations.
- **Word of the Day** - one harder daily target, a rotating Cosmic Law, daily streaks, and streak shields.
- **Weekly Expedition** - three deterministic stages shared by all players that week.
- **Friend Challenge** - a shareable URL that preserves the target and seed for asynchronous play.
- **Constellation Atlas** - every successful step is recorded as a readable path.
- **Personal Universe** - unique discoveries, Stardust, ranks, wins, streaks, and themes persist locally.

All built-in targets are verified as reachable from Earth, Water, Fire, and Air. The local semantic system covers the full reachable concept matrix. Nonsense, repeated fragments, and malformed Wishes are rejected.

## Asynchronous leaderboards

Constellore has no live multiplayer. Players solve shared challenges independently, and only completed ranked runs are uploaded. The server issues each ranked challenge and run token, tracks discovered inputs, moves, elapsed time, assists, and completion, then computes the Starscore itself. The browser cannot submit an arbitrary score.

Rankings are deliberately split:

- **Pure** - no injected concept was used.
- **Open** - the run used a personal Wish or an owned Word Exchange concept.

Paid or assisted runs therefore never silently compete with unassisted runs. Practice Reach and Friend Challenge runs are not uploaded. Public identity uses a server-generated, non-editable cosmic callsign; no player-entered display name is published.

The included guest identity is device-local and accountless. A production account-linking or recovery flow is still needed if identities, licenses, and balances must follow players across devices.

## Make a Wish and the Word Exchange

**Make a Wish** introduces one recognizable concept into a run. It is intentionally an uncertain shortcut rather than an answer button. Every guest receives one free personal Wish; the Founder's Pass enables the additional Wish access described by the live product configuration plus its listed cosmetics and streak benefit. The exact paid benefit must be frozen and stated consistently before checkout is enabled.

The **Word Exchange** offers a curated catalog of known, useful concepts:

- Purchases use **Star Credits**, a separate server-held virtual balance.
- Cash-priced credit packs are fixed products; the minute market never changes their cash price.
- Buying a word grants a permanent license in the player's Word Vault. It is not a consumable.
- One owned word may be activated per run, which places that result in the Open division.
- Word prices update once per minute for every player at the same time. The formula combines transparent deterministic waves with bounded aggregate demand, is never personalized, and remains inside the server-configured catalog bounds.
- Every quote shows its expiry and is signed by the server. An expired quote is rejected and refreshed instead of silently charging a different amount.

The server currently grants a starter balance and limited credits earned through ranked play. Star Credits and licenses do not expire in the included data model.

## Commerce boundary

This repository includes market accounting, signed virtual-price quotes, idempotent word-license purchases, and a development-only entitlement unlock. It does **not** include production StoreKit, Google Play, Steam, or Epic receipt verification, nor a production endpoint that grants purchased Star Credits.

Fixed credit packs are exposed in `/api/config` for the host UI. A production wrapper must obtain localized product data from its platform store, complete the purchase, send the signed receipt or transaction to a trusted backend, verify it with that platform, and only then credit the server wallet. A client-side `success: true` response is not proof of purchase and must never mint currency by itself.

`POST /api/player/test-entitlement` is available only when `NODE_ENV` is not `production` and no hosted checkout URL is configured. It is for local QA of the Founder's Pass flow; it does not simulate a real payment. `NEBULA_CHECKOUT_URL` can point to a hosted checkout or store landing page, but the deployment still owns receipt verification and entitlement synchronization.

Rewarded Wishes are similarly disabled unless both the server flag and a host ad adapter are present. Rewards should be granted only after the provider confirms completion.

## Persistence and deployment

By default, the standalone server stores guest players, balances, licenses, demand, and leaderboard best scores in `data/constellore.json`. Writes are serialized, making this suitable for local development, demos, and a **single Node.js process**. Active run state is held in memory and is invalidated by a server restart.

Do not use the JSON store for a horizontally scaled or money-bearing deployment. Production should replace it with PostgreSQL or an equivalent transactional database and an append-only wallet ledger. Credit grants, deductions, license ownership, idempotency keys, and leaderboard submission should be committed atomically under server-side constraints. Multiple app instances must share the same durable run, player, score, quote-demand, and entitlement state.

Set `CONSTELLORE_DATA_PATH` to relocate the MVP JSON file. Keep that file and all production database credentials outside the public web root and out of source control.

## AI configuration and cost control

The curated and semantic world runs without configuration. Add a server-side key to enable novel pair results and guaranteed route planning for unknown custom targets:

```powershell
$env:OPENAI_API_KEY="your-key"
$env:OPENAI_MODEL="gpt-5.4-nano"
npm start
```

AI pair results and route steps are cached in memory for the process lifetime. Official ranked content uses deterministic built-in resolution so every player receives the same adjudication and incurs no AI request cost. Keys never reach the browser.

## Analytics and privacy

The client sends a small allowlisted event vocabulary to `POST /api/analytics`. Events contain a random session ID and gameplay properties; they do not contain email, advertising identifiers, or public free-form player names. The default server writes newline JSON to standard output so a host can route it to its own observability stack.

Before a public release, route or disable this sink as appropriate, publish Oxyfel Games' privacy notice and terms, provide a working support route, and complete the relevant store data-safety forms.

## Production checklist

1. Put the server behind HTTPS and a reverse proxy/CDN.
2. Replace the JSON store and in-memory run registry with shared transactional storage.
3. Integrate platform billing, verify receipts server-side, and maintain an auditable wallet ledger.
4. Add account linking/recovery before paid ownership must follow players across devices.
5. Configure `OPENAI_API_KEY` only if live AI is wanted outside official ranked resolution.
6. Connect the rewarded-ad adapter or keep `REWARDED_ADS_ENABLED=false`.
7. Route analytics output and set a retention policy.
8. Supply the required trader disclosures, support URL, privacy notice, terms, store art, ratings, and signing credentials.
9. Run `npm run check` and the mobile/desktop QA pass before every release.

The planned public publisher is **Oxyfel Games**. Public payments remain disabled until production identity, payment, tax, support, recovery, and legal requirements are independently verified.

See `.env.example` for runtime settings.
