# Constellore

Constellore is a mobile-first cosmic word-combination puzzle published by **Oxyfel Games**. Players drag concepts together on a freeform board, trace a constellation of discoveries, and try to reach a guaranteed-solvable target.

The former working title, Wordforge, was retired before release because it is already used by public word games.

The repository is a dependency-free Node.js 20+ web app and installable PWA. Its platform hooks are deliberately small so the same game can sit inside an iOS/Android WebView, Electron, or a Steam/Epic shell.

## Version 1.7.0 highlights

- **First Orbit** teaches the real drag, drop, tap, and duplicate-word flow in three guided combinations. Training is unranked, grants no rewards or discoveries, can be skipped, and can be replayed from Profile.
- **Universe Director** gives every seed one of six authored cosmic settings and presentation-only laws. Target routes are validated before play; a universe never changes a recipe, reward, or leaderboard result.
- **Recipe feedback** lets a player mark an actual, non-revealed, non-user-authored combination Logical, Surprising, or Bad once per recipe per orbit. The service keeps bounded aggregate recipe counts only.
- **Recovery Kit and cloud profile** make an anonymous player identity recoverable without collecting an email address. Cloud progression uses versioned writes and explicit conflict handling, while owned entitlements can be restored from the server.
- **Constellation Cards** turn a completed route into a deterministic, downloadable SVG and native share payload. Zero-score assisted completions are labelled Study, while declared Reality Bends are labelled Open rather than presented as Pure challenge wins.
- **Fair commerce boundary** keeps Star Credits earn-only and excludes cash-sale credit packs, cash-sold word licenses, score boosts, extra moves, and extra time. The sole real-money catalog entry is the fixed Founder's Pass for cosmetics and non-competitive creative benefits.

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

For the current no-payments public beta, follow [DEPLOY_BETA.md](DEPLOY_BETA.md) and review [render.yaml](render.yaml). GitHub Pages publishes both the marketing site and a playable local-practice edition. The Node server remains required for verified leaderboards, the shared Exchange/economy, recoverable identity, live AI, and other trusted online features.

The marketing site is deployed at [yoxyfel.github.io/constellore](https://yoxyfel.github.io/constellore/) and local practice at [yoxyfel.github.io/constellore/play](https://yoxyfel.github.io/constellore/play/). The Pages build compiles the server's current combination rules into a compact browser universe, keeps progression in a separate local profile, marks every result unranked, and removes payments. When the public Node host is ready, set the repository Actions variable `PUBLIC_BETA_URL` to its HTTPS URL and rerun the Pages workflow; the website then sends players to the full server beta.

The Launch Wishlist has two honest deployment modes. Static Pages shows the repository's real GitHub star count and sends the visitor to GitHub, because Pages cannot persist a shared wishlist. The Node server exposes a first-party anonymous signal at `GET/POST /api/interest`: one browser can add or remove one signal, while the store keeps only an HMAC digest of its random UUID. To use that counter from Pages, set `PUBLIC_INTEREST_API_URL` to the deployed HTTPS `/api/interest` URL and allow the exact Pages origin with `INTEREST_ALLOWED_ORIGINS=https://yoxyfel.github.io`. Never expose the JSON data file or treat these signals as Steam/App Store wishlists or preorders.

## Player experience

- **Reach** - a reachable random target or a player-entered target.
- **Quick Orbit** - a 90-second sprint with a time reward.
- **Move Limit** - a tactical target with twelve successful combinations.
- **Word of the Day** - one harder daily target, a rotating Cosmic Law, daily streaks, and streak shields.
- **Weekly Expedition** - three deterministic stages shared by all players that week.
- **Friend Challenge** - a shareable URL that preserves the target and seed for asynchronous play.
- **Cosmic Twists** - a 12% contextual alternate discovery after the opening moves, capped at one per casual Reach or Friend Challenge orbit. The target and competitive modes remain luck-free, and repeating the pair restores its canonical result.
- **First Orbit** - a short, replayable tutorial that reaches Wall using the same board interactions as the full game without touching progression or scoring.
- **Universe Director** - deterministic authored universes, seasons, and contextual laws make shared seeds feel distinct while leaving recipes and scores unchanged.
- **Frictionless controls** - drag a tray word directly onto a board word, tap two board words, or hold Ctrl on desktop and skim across words to build a serial fusion chain without clicking.
- **Constellation Atlas** - every successful step is recorded as a readable path.
- **Ask the Cosmos** - reveal a target's complete answer as an animated constellation; the run becomes permanently Assisted with zero score, rewards, streak credit, or saved reveal discoveries.
- **Living constellations** - use non-spoiler Sense glows, race an anonymous Rival Ghost, complete Recipe Mastery collections, and enable optional cosmic sound and haptics.
- **Recipe feedback** - rate a completed recipe Logical, Surprising, or Bad without typing free-form text; one vote is accepted per real recipe per orbit, while revealed and user-directed recipe text is never retained.
- **Constellation Cards** - preview, download, or share an SVG summary of a completed path with its universe, division, time, moves, and milestones.
- **Personal Universe** - unique discoveries, Stardust, ranks, wins, streaks, and cosmetic loadout persist locally and sync to the authenticated cloud profile on the Node beta.

All built-in targets are verified as reachable from Earth, Water, Fire, and Air. The local semantic system covers the full reachable concept matrix. Nonsense, repeated fragments, and malformed Wishes are rejected.

## Asynchronous leaderboards

Constellore has no live multiplayer. Players solve shared challenges independently, and only completed ranked runs are uploaded. The server issues each ranked challenge and run token, tracks discovered inputs, moves, elapsed time, assists, and completion, then computes the Starscore itself. The browser cannot submit an arbitrary score.

Rankings are deliberately split:

- **Pure** - no injected concept was used.
- **Open** - the run used a personal Wish or an owned Word Exchange concept.

Paid or assisted runs therefore never silently compete with unassisted runs. Practice Reach and Friend Challenge runs are not uploaded. Public identity uses a server-generated, non-editable cosmic callsign; no player-entered display name is published.

Reveal Path is a learning tool rather than a scoring shortcut. The server forfeits that deterministic ranked challenge before returning its verified route, and replaying the same challenge remains unranked for that player. The browser animates the returned recipe graph without submitting fake combinations; revealed words are temporary and grant no competitive or progression value.

The included identity remains anonymous and accountless, but it is no longer device-bound. Registration returns a one-time **Recovery Kit** which the player must save before dismissing it. The server stores only a keyed digest, rotates the recovery code and bearer token after a successful recovery, and revokes the lost device's bearer session. The versioned cloud profile synchronizes progression and cosmetic loadout, and the restore endpoint returns authoritative entitlements and owned words. This is not email/social account linking: if the player loses both the device credential and Recovery Kit, there is no identity-proof fallback in this repository.

## Make a Wish and the Word Exchange

**Make a Wish** introduces one recognizable concept into a run. It is intentionally an uncertain shortcut rather than an answer button. Every guest receives one free personal Wish; the Founder's Pass enables the additional Wish access described by the live product configuration plus its listed cosmetics and streak benefit. The exact paid benefit must be frozen and stated consistently before checkout is enabled.

The **Word Exchange** offers a curated catalog of known, useful concepts:

- Purchases use **Star Credits**, an earn-only server-held virtual balance that cannot be bought for cash.
- Buying a word grants a permanent license in the player's Word Vault. It is not a consumable.
- One owned word may be activated per run, which places that result in the Open division.
- Word prices update once per minute for every player at the same time. The formula combines transparent deterministic waves with bounded aggregate demand, is never personalized, and remains inside the server-configured catalog bounds.
- Every quote shows its expiry and is signed by the server. An expired quote is rejected and refreshed instead of silently charging a different amount.

The server grants a starter balance and limited credits earned through verified ranked play. Star Credits and licenses do not expire in the included data model. `/api/config` deliberately returns an empty `creditPacks` array.

## Commerce boundary

This repository includes market accounting, signed Star Credit quotes, idempotent word-license purchases, a fixed Founder's Pass product definition, and a development-only entitlement unlock. It does **not** include production StoreKit, Google Play, Steam, Epic, or web-provider receipt/webhook verification. There is no cash product that grants Star Credits, word licenses, Sense charges, score, extra moves, or extra time.

Billing becomes visible only when both a valid `NEBULA_CHECKOUT_URL` and `CONSTELLORE_COMMERCE_FULFILLMENT_READY=true` are configured. The readiness flag is an operational assertion, not fulfillment logic: do not enable it until a trusted backend verifies provider receipts or signed webhooks, deduplicates transaction IDs, records an audit trail, and writes the Founder's Pass entitlement authoritatively. A client-side `success: true` response is never proof of purchase.

`POST /api/player/test-entitlement` is disabled by default. It is available only when `CONSTELLORE_ENABLE_TEST_STORE=true`, `NODE_ENV` is not `production`, and billing is disabled. It is for deliberate local QA of the Founder's Pass flow; it does not simulate a real payment.

Founder's Pass cosmetics include alternate themes, boards, trails, and sound packs. Its Wish and Sense benefits remain non-competitive: a Wish moves the run to the Open division, while Sense disables score and rewards. Pure leaderboard outcomes cannot be purchased.

Rewarded Wishes are similarly disabled unless both the server flag and a host ad adapter are present. Rewards should be granted only after the provider confirms completion.

## Persistence and deployment

By default, the standalone server stores guest players, cloud profiles, recovery digests, balances, licenses, demand, leaderboard best scores, aggregate analytics, aggregate recipe feedback, and checkpointed active runs in `data/constellore.json`. Writes are serialized, making this suitable for local development, demos, and a **single Node.js process**. Valid checkpointed runs can resume after a restart, but they are not shared across processes.

With a durable store, the server writes a privacy-reduced safe backup at startup and every 24 hours. `CONSTELLORE_BACKUP_DIR` defaults to a `backups` directory beside the store, and `CONSTELLORE_BACKUP_KEEP` retains 1-30 files (default 7). Safe backups omit the store signing secret, active runs, recovery material, per-player word-purchase request keys, wishlist record digests, and analytics session hashes; restoring one therefore requires authentication reset procedures. `POST /api/admin/backup` creates an on-demand backup when the protected admin API is enabled.

Do not use the JSON store for a horizontally scaled or money-bearing deployment. Production should replace it with PostgreSQL or an equivalent transactional database and an append-only entitlement/wallet ledger. Credit grants, deductions, license ownership, idempotency keys, cloud-profile versions, recovery rotation, and leaderboard submission should be committed atomically under server-side constraints. Multiple app instances must share the same durable run, player, score, quote-demand, and entitlement state. Copy safe backups to independently controlled off-site storage and test the restore procedure; same-disk rotation alone is not disaster recovery.

Set `CONSTELLORE_DATA_PATH` to relocate the MVP JSON file. Keep that file and all production database credentials outside the public web root and out of source control.

## AI configuration and cost control

The curated and semantic world runs without configuration. Add a server-side key to enable novel pair results and guaranteed route planning for unknown custom targets:

```powershell
$env:OPENAI_API_KEY="your-key"
$env:OPENAI_MODEL="gpt-5.4-nano"
npm start
```

AI pair results and route steps are cached in memory for the process lifetime. Before any target starts, the server validates that its complete route is reachable from the starter words. The Universe Director derives an opaque universe identity and authored presentation law from the seed; ranked route details stay server-side until earned or explicitly revealed. Official ranked content uses deterministic built-in resolution so every player receives the same adjudication and incurs no AI request cost. Keys never reach the browser.

## Analytics and privacy

The client sends a small allowlisted event vocabulary to `POST /api/analytics`. Events contain a random session ID and bounded gameplay properties; they do not contain email, advertising identifiers, or public free-form player names. The store keeps HMAC-pseudonymized daily session counts and aggregates rather than raw event streams. `GET /api/analytics/summary` is available only through the protected admin API.

`POST /api/recipe-feedback` accepts exactly `runId`, `runToken`, `move`, and one of `logical`, `surprising`, or `bad`. Authentication and the run token prove that the referenced move happened. Revealed combinations, user-directed concepts, and repeated votes for either the move or its canonical recipe in the same orbit are rejected. The store and safe backups retain a bounded recipe-level aggregate without player identifiers. `GET /api/admin/recipe-feedback?minimumVotes=3&limit=50` exposes only thresholded aggregate totals to an authenticated operator.

Set `CONSTELLORE_ADMIN_TOKEN` to a high-entropy secret of at least 24 bytes to enable the admin summary and backup endpoints. Send it as `Authorization: Bearer …` or `X-Constellore-Admin`; keep it out of browser code, URLs, logs, and source control. If it is absent or too short, admin routes intentionally respond as not found.

Before a public release, define aggregate retention, deletion, and operator-access rules; publish Oxyfel Games' privacy notice and terms; provide a working support route; and complete the relevant store data-safety forms.

## Production checklist

1. Put the server behind HTTPS and a reverse proxy/CDN.
2. Replace the JSON store and single-process run registry with shared transactional storage.
3. Integrate platform billing for the fixed Founder's Pass, verify receipts/webhooks server-side, and maintain an auditable entitlement ledger; keep Star Credits earn-only.
4. Decide whether Recovery Kits are sufficient for launch or add independently verified account linking and support recovery before paid ownership must follow players across devices.
5. Configure `OPENAI_API_KEY` only if live AI is wanted outside official ranked resolution.
6. Connect the rewarded-ad adapter or keep `REWARDED_ADS_ENABLED=false`.
7. Set a high-entropy admin token, restrict operator access, define analytics/feedback retention, copy backups off-site, and test a restore.
8. Supply the required trader disclosures, support URL, privacy notice, terms, store art, ratings, and signing credentials.
9. Run `npm run check` and the mobile/desktop QA pass before every release.

The planned public publisher is **Oxyfel Games**. Public payments remain disabled until production identity, payment, tax, support, recovery, and legal requirements are independently verified.

See `.env.example` for runtime settings.
