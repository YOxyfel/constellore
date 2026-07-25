# Constellore

Constellore is a cosmic word-combination puzzle developed by **Oxyfel Games**. Every game gives players a clear target: drag concepts together on a freeform board, discover new words, and build a reachable path to the destination. Challenges adjust to the player while permanent ranks unlock deeper rules and increasingly spectacular skies.

The former working title, Wordforge, was retired before release because it is already used by public word games.

The repository is a dependency-free Node.js 20+ web app and installable PWA. It does not yet contain native mobile, Electron, Steam, or Epic wrappers; those are separate future distribution projects.

## Version 3.3.0-beta.1 highlights

- **Challenges follow the player:** auto-selected Relaxed, Timed, and Limited Moves games now use a private 1–10 difficulty level. Every three completed challenges raise the normal level by one, while each ordinary timeout, loss, quit, or answer reveal lowers it by one. Every tenth completion arms one major difficulty Surge; failing that special challenge returns safely to the pre-Surge level, while an unassisted, errorless 200-IQ clear permanently promotes the Surge level into the new normal. Individual failed word combinations and ordinary hints never affect difficulty.
- **One Play button, two kinds of opening:** Auto starts every Bronze route with Earth, Water, Fire, and Air, introduces occasional Shuffled starts at Silver, and makes them the main higher-rank format while periodically returning to Classic. Shuffled words are temporary, useful loans taken from a verified suffix of the real answer route. Players who want control can still choose Classic or Shuffled under **Choose game**.
- **Twelve permanent Route Ranks add replayable rules:** Bronze and Silver keep the classic game, Gold introduces one Waypoint, and later ranks combine Blocked Shortcuts, Master Routes, special graph rules, and Orbit Chains. Diamond uses one or two rules, the middle ranks steadily add more, and Legend/Cosmic can require all five together. Clean and flawless play earns mastery faster; each threshold opens a best-of-three promotion, while adaptive difficulty can move down without taking an earned rank away.
- **The sky becomes the trophy:** every pair of Route Ranks unlocks a richer board scene, evolving from a restrained common night sky through living nebulae and astral rifts to the Legend/Cosmic crowned singularity. Mobile, balanced, and cinematic WebP variants are selected responsively; only the current rank scene is lazy-cached.
- **Fair by construction:** adaptive games choose only verified, reachable authored targets, consider route length and alternate paths, avoid recently played targets, and scale the completion reward to the actual challenge. Shuffled games sign and verify their exact starter kit and route suffix, and never introduce a new Remix family in the same game. They are clearly marked personal and never enter shared leaderboards; Daily, Weekly, friend, story, training, and player-chosen challenges remain fixed.
- **Clearer from first tap to final answer:** one-action menus, larger language, direct board tools, a warmer illustrated identity, and a staged `A + B = result` answer reveal remove the main comprehension and presentation problems found in beta testing.
- **The path is the product:** First Orbit teaches the board, Second Orbit teaches a real three-fusion route without blocking experimentation, and then the hub progressively reveals Daily play, modifiers, Journeys, Creator's Lab, collections, and community surfaces.
- **World Graph 3** packages 1,458 playable word records and 3,199 deterministic recipes in a compact runtime. The graph audit catalogs 1,443 concepts, with 1,385 reachable from the four starters. All 759 reviewed high-intent attempts work, including same-word recipes; exactly 500 official targets are route-verified, more than 250 retain alternate final recipes for advanced Route Rank rules, and 90 deterministic Daily variants are quality-gated.
- **Find-the-word play has momentum:** Run IQ starts at 0 and reserves its largest gains for discoveries that measurably shorten the authored route to the target. Unrelated valid discoveries add only a point, repeated pairs cannot farm it, and a flawless target route lands at the satisfying 200 cap. It remains a playful run score rather than a real intelligence test or competitive score.
- **One Guidance ladder** moves from a score-safe Route Signal through disclosed Open assists to a complete zero-score Study reveal. Pure, Open, Practice, and Study remain visible from briefing to result.
- **Constellation progress is concrete:** a spoiler-free authored route meter shows real steps remaining instead of guessing from move count, while the live route trail, milestone feedback, visual Living Atlas, honest Rival Ghost projection, and result route card show what the player has actually built.
- **Ranked trust is server-owned:** exact challenge identity, server-computed attempt/rejection accounting, expiring revocable sessions, provisional anomaly handling, append-only beta ledgers, and quarantined AI proposals protect shared results.
- **Feedback is privacy-bounded:** a missing combination report can include one short suggested result, but never an open comment, contact detail, or player name; optional diagnostics remain off by default.
- **The release pipeline is repeatable:** deterministic Pages and itch artifacts, synchronized build/cache metadata, PWA shortcuts and screenshots, performance budgets, multi-browser journeys, accessibility scans, and explicit free-beta/commercial gates are checked automatically.

## Run and verify

```powershell
npm start
npm run check
npm run build:release
```

Open `http://localhost:4173` for the marketing site and `http://localhost:4173/play/` for the playable beta. Operations use `GET /livez` for liveness and `GET /readyz` for content/storage readiness; `GET /healthz` remains a compatibility alias for readiness.

The public site is deliberately split into two same-origin experiences:

- `Website/` is the mobile-first marketing site served at `/`.
- `public/` is the tested game client served at `/play/`.
- Game APIs remain under `/api/*`.
- The PWA manifest and service worker are scoped to `/play/`, so installing the game does not replace the marketing homepage.

For the current no-payments public beta, follow [DEPLOY_BETA.md](DEPLOY_BETA.md) and review [render.yaml](render.yaml). GitHub Pages publishes both the marketing site and a playable local-practice edition. The Node server remains required for verified leaderboards, the shared Exchange/economy, recoverable identity, live AI, and other trusted online features.

The marketing site is deployed at [yoxyfel.github.io/constellore](https://yoxyfel.github.io/constellore/) and local practice at [yoxyfel.github.io/constellore/play](https://yoxyfel.github.io/constellore/play/). The Pages build compiles the current combination rules into a compact browser universe, keeps progression in a separate local profile, marks every result unranked, and removes payments, rewarded ads, uploaded gameplay telemetry, and live AI. Bounded aggregate diagnostics remain on-device and can be exported or reset. A deliberate missing-combination idea is always saved locally. When `PUBLIC_FEEDBACK_API_URL` is set to the hosted service's exact HTTPS `/api/combination-reports` endpoint, the game sends that bounded idea anonymously in one tap and queues it for automatic retry when offline—without opening GitHub or requiring an account. When a hardened public Node host exists, set `PUBLIC_BETA_URL` to its full HTTPS game URL ending in `/play/`—for example `https://constellore-beta.onrender.com/play/`—and rerun the Pages workflow.

The itch call-to-action is intentionally hidden until its exact public page exists. Set the repository Actions variable `PUBLIC_ITCH_URL` to the full HTTPS game-page URL on an `itch.io` domain, then rerun the Pages workflow. The build rejects non-itch hosts instead of guessing a creator URL.

The consumer landing page uses an honest **Follow** action rather than calling a GitHub star or local counter a wishlist. When `PUBLIC_ITCH_URL` is configured it sends players to the itch.io project, where following actually delivers release and devlog updates; otherwise it links to the public GitHub repository. The Node service still exposes the privacy-bounded `GET/POST /api/interest` experiment for controlled research, but Pages does not present it as a store wishlist or preorder.

## Release artifacts

Create and verify the portable itch HTML5 package on Windows, macOS, or Linux with the same Node commands:

```powershell
npm run build:itch
npm run check:itch
```

This writes `dist-itch/constellore-html5-v<version>.zip` and a matching `.zip.sha256` sidecar without overwriting the older untracked `constellore-html5.zip`. The ZIP has `index.html` at its root, contains only the local-practice runtime, uses normalized timestamps and stable ordering, and includes both `release-manifest.json` and `SHA256SUMS.txt`. The verifier checks every internal hash, the outer checksum, the runtime boundary, portable asset paths, safe archive paths, and canonical deterministic ZIP bytes.

Upload the versioned ZIP itself as an itch **HTML** project and select “This file will be played in the browser.” Do not upload the Node server or the `dist-itch/site` working folder. GitHub CI creates the same verified ZIP as a short-lived workflow artifact for each passing revision. See [RELEASE.md](RELEASE.md) for the exact release and rollback checklist.

## Player experience

- **Reach** - a reachable random target or a player-entered target.
- **Quick Orbit** - a 90-second sprint with a time reward.
- **Move Limit** - a tactical target with twelve successful combinations.
- **Word of the Day** - one harder daily target, a rotating Cosmic Law, daily streaks, and streak shields.
- **Weekly Expedition** - three deterministic stages shared by all players that week.
- **Constellation Voyages** - authored chapters of connected targets with persistent stage progress and completion rewards.
- **Cosmic Events** - one deterministic weekly theme, a curated target set, and a rare-word collection layer that never changes canonical recipe results.
- **Friend Challenge** - a shareable URL that preserves the target and seed for asynchronous play.
- **Cosmic Twists** - a 12% contextual alternate discovery after the opening moves, capped at one per casual Reach or Friend Challenge orbit. The target and competitive modes remain luck-free, and repeating the pair restores its canonical result.
- **First Orbit** - a short, replayable tutorial that reaches Wall using the same board interactions as the full game without touching progression or scoring.
- **Second Orbit** - a short bridge from tutorial to real play: reach Mountain in three route fusions while unrelated logical combinations remain available.
- **Explore** - an explicitly unranked, target-free sandbox that carries the player's discovered-word inventory between sessions; target missions begin from the exact verified words shown in their briefing.
- **Universe Director** - deterministic authored universes, seasons, and contextual laws make shared seeds feel distinct while leaving recipes and scores unchanged.
- **Frictionless controls** - drag a tray word directly onto a board word, tap two board words, or hold Ctrl on desktop and skim across words to build a serial fusion chain without clicking.
- **Quick board controls** - Undo, Redo, Tidy, and Clear stay visible on the board; the pause menu is reserved for Continue, Restart, and Quit.
- **Living Atlas** - every successful recipe is drawn as a visual node-and-edge constellation with a destination beacon and a readable fallback path.
- **Signature Routes** - each completion receives an explainable route grade and can set a privacy-safe personal best for the same challenge.
- **Recipe insight** - successful pairs explain their connection; failed pairs can offer category-level near-miss direction without revealing an undiscovered answer.
- **Ask the Cosmos** - reveal a target's complete answer as an animated constellation; the run permanently becomes zero-score Study with no rewards, streak credit, or saved reveal discoveries.
- **Living constellations** - use non-spoiler Star Compass glows, unlock an anonymous Rival Ghost after three real wins, complete Recipe Mastery collections, and enable optional cosmic sound and haptics.
- **Recipe feedback** - rate a completed recipe Logical, Surprising, or Bad without typing free-form text; one vote is accepted per real recipe per orbit, while revealed and user-directed recipe text is never retained.
- **Constellation Cards** - preview, download, or share an SVG summary of a completed path with its universe, division, time, moves, and milestones.
- **Community results** - verified online completions receive anonymous cohort context and can opt into a Rival Ghost rematch; static practice explicitly reports that online comparison is unavailable.
- **Personal Universe** - unique discoveries, Stardust, ranks, wins, streaks, and cosmetic loadout persist locally and sync to the authenticated cloud profile on the Node beta.

Included targets are selected from routes reachable from Earth, Water, Fire, and Air. The local build uses the hand-reviewed authored world and fails an unknown pair cleanly instead of inventing category roulette. The online service may use its separately labelled experimental AI tier for casual, authenticated play when configured; official competitive resolution never depends on it.

## Asynchronous leaderboards

Constellore has no live multiplayer. Players solve shared challenges independently, and only completed ranked runs are uploaded. The server issues each ranked challenge and run token, tracks discovered inputs, moves, elapsed time, assists, and completion, then computes the Starscore itself. The browser cannot submit an arbitrary score.

Alongside the ordered ladder, a verified result can receive privacy-safe community context such as its cohort placement and pace distribution. Route Signatures summarize the shape and grade of a run without publishing the private ordered recipe history. Rival Ghost rematches remain asynchronous and opt-in.

Rankings are deliberately split:

- **Pure** - no score-reducing concept or powerup was used; Route Signals remain safe.
- **Open** - the run used a Wish, Vault word, Star Compass, Word Gift, or labelled experimental AI assistance, with the applicable multiplier shown throughout the run.

Assisted Open runs therefore never silently compete with unassisted runs. Real-money products are cosmetic-only and do not change division eligibility. Practice Reach and Friend Challenge runs are not uploaded. Public identity uses a server-generated, non-editable cosmic callsign; no player-entered display name is published.

Reveal Path is a learning tool rather than a scoring shortcut. The server forfeits that deterministic ranked challenge before returning its verified route, and replaying the same challenge remains unranked for that player. The browser animates the returned recipe graph without submitting fake combinations; revealed words are temporary and grant no competitive or progression value.

The online beta uses a persistent pseudonymous guest account with no email or player-chosen public name. Registration returns a one-time **Recovery Kit**. The browser retains the unacknowledged kit locally, lets the player open it from Profile immediately, and prompts for it after the first real win; acknowledging the prompt removes the local secret. The server stores only a keyed digest, rotates both the recovery code and bearer token after recovery, and revokes the lost device's bearer session. If the player loses both the device credential and Recovery Kit, there is no identity-proof fallback in this repository.

## Make a Wish and the Word Exchange

**Make a Wish** introduces one recognizable concept into a run. It is intentionally an uncertain shortcut rather than an answer button. Every guest receives one free personal Wish. Wishes and other gameplay assistance are earned or granted through play; they are not included in a cash product. The disabled Supporter Pack prototype contains only the listed cosmetic themes, boards, trails, and sound packs. Do not enable checkout until the store description, terms, fulfillment, and recovery behavior match that cosmetic-only offer.

The **Word Exchange** offers a curated catalog of known, useful concepts:

- Exchange word licenses cost **Star Credits**, an earn-only server-held virtual balance that cannot be bought for cash.
- Redeeming earned credits for a word grants a persistent beta license in the player's Word Vault. It is not a consumable under current rules, but beta resets or backup restoration can roll ownership back before the production database migration.
- One owned word may be activated per run, which places that result in the Open division.
- Word prices update once every six hours for every player at the same time. The slower shared rotation is legible and non-urgent; the formula combines transparent deterministic waves with bounded aggregate demand, is never personalized, and remains inside the server-configured catalog bounds.
- Every quote shows its expiry and is signed by the server. An expired quote is rejected and refreshed instead of silently charging a different amount.

The server grants a starter balance and limited credits earned through verified ranked play. Star Credits and licenses do not expire in the included data model. `/api/config` deliberately returns an empty `creditPacks` array.

## Commerce boundary

This repository includes market accounting, signed Star Credit quotes, idempotent word-license redemptions, a fixed cosmetic Supporter Pack product definition, and a development-only entitlement unlock. It does **not** include production StoreKit, Google Play, Steam, Epic, or web-provider receipt/webhook verification. Star Credits and Word Vault licenses remain earn-only and cannot be bought for cash. The disabled Supporter Pack changes presentation only; it grants no Wish, powerup, shield, word, score, moves, time, rewards, or leaderboard access.

Billing becomes visible only when both a valid `NEBULA_CHECKOUT_URL` and `CONSTELLORE_COMMERCE_FULFILLMENT_READY=true` are configured. The readiness flag is an operational assertion, not fulfillment logic: do not enable it until a trusted backend verifies provider receipts or signed webhooks, deduplicates transaction IDs, records an audit trail, and writes the cosmetic Supporter Pack entitlement authoritatively. A client-side `success: true` response is never proof of purchase.

`POST /api/player/test-entitlement` is disabled by default. It is available only when `CONSTELLORE_ENABLE_TEST_STORE=true`, `NODE_ENV` is not `production`, and billing is disabled. It is for deliberate local QA of the cosmetic Supporter Pack flow; it does not simulate a real payment.

The real-money catalog is cosmetic-only. Wish or earn-only Vault activation keeps at most 80% score, Star Compass at most 75%, Word Gift at most 50%, and Reveal Path becomes zero-score Study. These gameplay systems are separate from the Supporter Pack, and Pure leaderboard outcomes cannot be purchased.

Rewarded Wishes are similarly disabled unless both the server flag and a host ad adapter are present. Rewards should be granted only after the provider confirms completion.

## Persistence and deployment

By default, the standalone server stores guest players, cloud profiles, recovery digests, balances, licenses, demand, leaderboard best scores, aggregate analytics, aggregate recipe feedback, and checkpointed active runs in `data/constellore.json`. Writes are serialized, making this suitable for local development, demos, and a **single Node.js process**. Valid checkpointed runs can resume after a restart, but they are not shared across processes.

With a durable store, the server writes a privacy-reduced safe backup at startup and every 24 hours. `CONSTELLORE_BACKUP_DIR` defaults to a `backups` directory beside the store, and `CONSTELLORE_BACKUP_KEEP` retains 1-30 files (default 7). Safe backups omit the store signing secret, active runs, recovery material, per-player word-redemption request keys, wishlist record digests, and analytics session hashes; restoring one therefore requires authentication reset procedures. `POST /api/admin/backup` creates an on-demand backup when the protected admin API is enabled.

Do not use the JSON store for a horizontally scaled or money-bearing deployment. Production should replace it with PostgreSQL or an equivalent transactional database and an append-only entitlement/wallet ledger. Credit grants, deductions, license ownership, idempotency keys, cloud-profile versions, recovery rotation, and leaderboard submission should be committed atomically under server-side constraints. Multiple app instances must share the same durable run, player, score, quote-demand, and entitlement state. Copy safe backups to independently controlled off-site storage and test the restore procedure; same-disk rotation alone is not disaster recovery.

Set `CONSTELLORE_DATA_PATH` to relocate the MVP JSON file. Keep that file and all production database credentials outside the public web root and out of source control.

## AI configuration and cost control

The curated and semantic world runs without configuration. Add a server-side key to enable novel pair results and guaranteed route planning for unknown custom targets:

```powershell
$env:OPENAI_API_KEY="your-key"
$env:OPENAI_MODEL="gpt-5.4-nano"
npm start
```

AI pair results and route steps are bounded, validated, cached, and persisted for reviewable consistency in the single-instance beta store. Concurrency, daily request budget, input length, context size, and request time are capped. Before any target starts, the server validates that its complete route is reachable from the starter words. The Universe Director derives an opaque universe identity and authored presentation law from the seed; ranked route details stay server-side until earned or explicitly revealed. Official ranked content uses deterministic built-in resolution so every player receives the same adjudication and incurs no AI request cost. Keys never reach the browser.

## Analytics and privacy

The client sends a small allowlisted event vocabulary to `POST /api/analytics`. Events contain a random session ID and bounded gameplay properties; they do not contain email, advertising identifiers, or public free-form player names. The store keeps HMAC-pseudonymized daily session counts and aggregates rather than raw event streams. `GET /api/analytics/summary` is available only through the protected admin API.

`POST /api/recipe-feedback` accepts exactly `runId`, `runToken`, `move`, and one of `logical`, `surprising`, or `bad`. Authentication and the run token prove that the referenced move happened. Revealed combinations, user-directed concepts, and repeated votes for either the move or its canonical recipe in the same orbit are rejected. The store and safe backups retain a bounded recipe-level aggregate without player identifiers. `GET /api/admin/recipe-feedback?minimumVotes=3&limit=50` exposes only thresholded aggregate totals to an authenticated operator.

`POST /api/combination-reports` accepts an exact bounded contract: the two input concepts, an optional suggested result of at most 28 characters, one optional fixed reason, the game mode, and a random privacy-safe reporter ID. It rejects extra fields, links, email-like text, line breaks, unsupported reasons, and unsupported modes; there is no open comment field. Accepted reports are deduplicated through a keyed reporter digest and exposed to the operator through `GET /api/admin/rejected-pairs?minimumReports=1&limit=100`. Set `CONSTELLORE_ADMIN_TOKEN` to a high-entropy secret of at least 24 bytes to enable the admin summary and backup endpoints. Send it as `Authorization: Bearer …` or `X-Constellore-Admin`; keep it out of browser code, URLs, logs, and source control. If it is absent or too short, admin routes intentionally respond as not found.

Nothing is emailed automatically. Hosted feedback remains in the configured server store until an operator retrieves its protected aggregate. Run `npm run --silent operator:feedback` with `CONSTELLORE_OPERATOR_BASE_URL` and `CONSTELLORE_ADMIN_TOKEN` set to export missing-combination requests and recipe ratings as JSON; [DEPLOY_BETA.md](DEPLOY_BETA.md#retrieve-the-player-feedback-report) has the safe PowerShell procedure. Pages and itch always retain a bounded local copy. If `PUBLIC_FEEDBACK_API_URL` was present when the package was built, they also send it directly to the anonymous report endpoint and retry queued reports after reconnecting. If the receiver is not configured, the interface says that the idea was saved locally rather than pretending it reached Oxyfel Games. Players can export the local copy from **Profile → Privacy and data → Export local report**.

Before publicly sharing the Node beta, define aggregate retention, deletion, and operator-access rules; publish Oxyfel Games' privacy notice and terms; and provide a working private support route for pseudonymous-account and recovery issues. Complete the relevant store data-safety forms before a store release.

## Production checklist

1. Put the server behind HTTPS and a reverse proxy/CDN.
2. Replace the JSON store and single-process run registry with shared transactional storage.
3. Integrate platform billing only for the fixed cosmetic Supporter Pack, verify receipts/webhooks server-side, and maintain an auditable entitlement ledger; keep Star Credits, Exchange words, Wishes, and powerups earn-only or free.
4. Decide whether Recovery Kits are sufficient for launch or add independently verified account linking and support recovery before paid ownership must follow players across devices.
5. Configure `OPENAI_API_KEY` only if live AI is wanted outside official ranked resolution.
6. Connect the rewarded-ad adapter or keep `REWARDED_ADS_ENABLED=false`.
7. Set a high-entropy admin token, restrict operator access, define analytics/feedback retention, copy backups off-site, and test a restore.
8. Supply the required trader disclosures, support URL, privacy notice, terms, store art, ratings, and signing credentials.
9. Run `npm run check`, `npm run build:release`, and the mobile/desktop QA pass before every release.

The planned public publisher is **Oxyfel Games**. Public payments remain disabled until production identity, payment, tax, support, recovery, and legal requirements are independently verified.

See `.env.example` for runtime settings.
