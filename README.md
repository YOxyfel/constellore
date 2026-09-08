# Constellore

Constellore is a cosmic word-combination puzzle developed by **Oxyfel Games**. Every game gives players a clear target: drag concepts together on a freeform board, discover new words, and build a reachable path to the destination. Challenges adjust to the player while permanent ranks unlock deeper rules and increasingly spectacular skies.

The former working title, Wordforge, was retired before release because it is already used by public word games.

The repository is a dependency-free Node.js 20+ web app and installable PWA. It does not yet contain native mobile, Electron, Steam, or Epic wrappers; those are separate future distribution projects.

## Version 5.0.0-beta.1 highlights

- **The board is now a cinematic observatory:** the same direct drag-and-combine rules drive a Deep-Space Observatory, Constellation Loom, Expedition Star Chart, and Black-Hole Foundry as one responsive scene. Discoveries become stars, successful routes become earned threads, and consumed ingredients remain as faint noninteractive memory constellations instead of vanishing without context.
- **Large inventories organize themselves without taking control:** the Bloom derives useful semantic beacons such as Liquids, Forces, or Architecture only when matching words exist. Search and manual placement remain authoritative; the optional Align command is explicit, undoable, and never rearranges the board on its own.
- **Fusions have readable cinematic weight:** ingredient comets now travel from their real board positions, collide, and release the new concept upward. Known, route, new, and hero discoveries use distinct pacing while the existing Cinematic, Faster, and Off preferences remain respected.
- **First launch is a real-time Voyage Projection:** a narrated, skippable 3D mission map travels from Earth through the solar system, distant systems, and the singularity boundary without changing expedition progress. Direct challenges and restored runs bypass it, Settings can replay it, and video/poster delivery remains an atomic fallback for constrained devices.
- **The projection grows with the player:** all solar-system destinations can exist as distant coordinates while confirmed arrivals, completed worlds, current projects, and unavailable voyages receive distinct visual states. Replays can reflect the furthest confirmed expedition without unlocking or launching nonexistent content.
- **The cinematic production path is deterministic:** authored 3D camera, rocket, planet, typography, timing, and narration remain the source of truth. Optional AI work is limited to isolated masked VFX passes, and release validation blocks undocumented voice, score, provider, or media provenance instead of baking an unrepeatable generated film into the game.
- **The new presentation stays portable:** the board and Voyage scene are lazy, event-driven, reduced-motion aware, keyboard accessible, and guarded by responsive contracts. Pages, itch, service-worker, offline, MIME, and performance verification treat their modules as optional packs rather than inflating first interaction.
- **Scramble Arena is live:** two players race to make the same target on separate server-authoritative boards. Every attempted, successful, and rejected pairing is visible to both competitors, so reading and manually reusing a rival's route is part of the game.
- **Private and public play have different stakes:** single-use friend invitations are unranked. Public matchmaking unlocks after one scored solo win and changes a separate seasonal 1v1 Rating; it never changes solo Route Rank, Stardust, mastery, events, or rewards.
- **The race resolves fairly:** both players receive the same authored target and starters, begin after a shared three-second countdown, and have five minutes. The first target wins; at time, the closer verified route wins and an exact tie is a draw.
- **Live play survives real devices and weak connections:** desktop and tablet show both boards, while phones keep the player's board primary with a permanent rival ticker and a full rival-board toggle. Authenticated event streaming, replay, heartbeats, a reconnect grace period, and refresh rejoin protect active matches.
- **The portable game remains hybrid and offline-safe:** every solo mode, save, and first-session flow remains local in the Pages and itch packages. Only Scramble requires the configured HTTPS Duel service, and its client files stay out of the install shell until the player opens the mode.
- **Competitive integrity stays server-owned:** Duel recipes, private run state, deadlines, results, repeat-pair limits, and rating settlement are authoritative and idempotent. Public snapshots expose open gameplay knowledge without exposing bearer credentials, internal player IDs, private run IDs, or hidden solution routes.
- **The former studio-and-rocket film remains a fallback:** the real-time Voyage Projection is the default first-launch experience, while the existing landscape and portrait films stay available when explicitly requested or when live rendering cannot complete safely.
- **The unfinished Cosmos Circuit remains staged:** it stays disabled in this release while it receives separate development.

## Version 4.0.0-beta.4 highlights

- **A new desktop studio opening:** landscape launches now begin with the full 24-second “A Production by Oxyfel Games” Kintsugi ident, carry its cinematic sound design into the existing spaceship film, and use a fade-through-black transition instead of a hard cut. The dedicated portrait phone cut is intentionally unchanged.
- **The film never waits for a click:** launch playback starts as soon as the page loads. Browsers that refuse first-visit audio autoplay immediately continue the full-screen film muted, with sound still available from the on-screen control.
- **The opening respects the play session:** Oxyfel Games and the launch film play once per browser session. Refreshing Home skips straight back to Home; refreshing an active game restores its saved target, moves, words, board positions, hints, and audio scene without replaying the intro or flashing the menu.
- **A real portrait cinematic:** narrow portrait phones receive a dedicated 720×1280 Oxyfel/launch composite, while landscape devices keep the original 1920×1080 film. Both remain full-bleed and retain the same timed brand hold, launch cue, sound, and menu transition.

- **Quit means quit immediately:** the in-game Quit action returns to Home in the same click, without a second confirmation or a Cosmic Gate delay. Required ranked-forfeit bookkeeping continues safely in the background; Restart keeps its deliberate confirmation.
- **Sound controls stay within reach:** every word level, the Pause panel, and Cosmos Circuit expose synchronized master-volume decrease, percentage, and increase controls with 44px targets. An optional channel mixer keeps separate Master, Music, and Effects sliders available without hiding the quick controls.

- **Every discovery builds a scene:** successful combinations now form an on-board story diorama, beginning with the first result as its foundation and layering later landscape, life, structure, energy, and sky discoveries into the route. A wrong pair visibly crumbles and rebuilds the valid story without erasing progress.
- **Hints behave like objectives:** the latest used hint remains visible as a compact Current Hint quest throughout the active run, survives an interrupted local run, and clears when a new challenge begins.
- **The memory interlude now tests memory:** Star Trail starts with three stars, scales to four and five, displays the numbered order for exactly five seconds with input locked, then hides every answer cue before recall.
- **Cleaner decisions and hierarchy:** completed games keep automatic starting-word selection without exposing Auto / Same 4 / New mix controls, while the Silver home catalog is a compact secondary section beneath the primary orbit.
- **Cosmos Circuit is a playable daily flight:** steer through one deterministic 75–90 second course of planetary gates, asteroid fields, black-hole tunnels, Stardust, and equal checkpoint powers. Unlimited Practice Flights are reward-free; Reward Flights spend one earn-only Launch Pass.
- **Crazy Path is the all-or-nothing endgame route:** a same-week Cosmos completion unlocks one 22-segment attempt for 3 earned Launch Passes. Its gates are tighter, sectors are faster, extraction is disabled, and one required miss, crash, timeout, expiry, or abandonment ends the attempt with no powers, Path XP, milestone reward, weekly progress, or refund. A verified victory starts a 30-day cooldown and offers one permanent choice: 20 of every Practice power immediately, or 3 of every Practice power per UTC day for 30 days (90 of each total), with elapsed days delivered idempotently on return.
- **Rewards are exact and fair:** daily grants, verified Pure-win stamps, and rank-ups provide Launch Passes up to a visible cap. Drift through Cosmos milestones disclose fixed race-only Practice boosts before launch; there are no paid entries, random rewards, or word-game advantages.
- **Every reward tier is reachable:** Reward pilots can safely extract after an eligible checkpoint to bank Drift, Orbit, or Nebula; finishing reaches Galaxy, while a perfect objective sweep reaches Cosmos. The server recomputes every online result and makes repeat submissions idempotent.
- **Star Path is cosmetic-only:** an eight-week, 12-tier free and Supporter track advances from eligible word wins and Circuit milestones. Base Path XP is capped at 125 per UTC day, the first eligible event each UTC week adds 200 catch-up XP, and a versioned migration preserves prior-season-curve progress. Every exact reward can be featured through the Season Locker, including deterministic Circuit colors and original in-game OST arrangements.
- **The mode teaches itself:** first-open Circuit and Star Path guides explain controls, progression, and fairness, can be replayed at any time, and keep keyboard focus inside the active task. Visible direction cues, 44px controls, forced-colors styling, reduced rendering under data-saving/reduced-motion preferences, and responsive phone layouts cover non-canvas access needs.
- **Local live operations add reasons to return:** UTC daily course rotation, three cumulative deterministic weekly cosmetic objectives, and separate Launch/Practice personal bests are stored only on the device. A schema-checked manual JSON export/import moves this local Circuit data without cloud sync; active or signed flights and online ownership are never imported.
- **Seven independent cosmetic surfaces:** Word plaques, Trails, Board backgrounds & finishes, Home backgrounds, Worldweave transitions, Interface styles, and Sound themes with original looping scores, synchronized gameplay pulses, and themed cue banks can be equipped as complete collections or mixed without changing gameplay.
- **Eight complete collections:** Celestial Atlas is the free foundation; Aurora Archive, Solar Foundry, Lunar Garden, and Eclipse Sovereign retain their coordinated Supporter identities; Pixel Frontier adds authentic 16-bit adventure styling, Bubble Reef is an original whimsical undersea-cartoon world, and Stellar Vanguard is an original cinematic space-opera sanctuary. Eclipse Sovereign remains the sole prestige full-shell transformation. Every collection includes responsive Home scenes and Constellation Fold signatures, and Cartographer, First Light, and Weekly Sigil pieces are earned from verified play.
- **A real Cosmetic Lab:** the live equipped look links directly into each slot's inventory, Collections and Pieces stay separate from the Owned-only filter, and locked previews, one-action collection equip, responsive Home/Worldweave art, sound samples, apply/cancel, and Full/Reduced/Off effects remain supported.
- **Fair, accessible, and server-owned:** cosmetics never enter scoring or challenge signatures, online entitlements remain authoritative through verified identity recovery, rank skies stay visible, and modal focus, keyboard radios, reduced motion/data, high contrast, and forced colors have explicit handling.
- **Release-safe art delivery:** responsive packs load on demand into their own cache, returning players preload only the equipped Home/Worldweave set, and server, Pages, and itch builds enforce portable paths, exact dimensions, and pack budgets.

See [COSMETICS_SYSTEM.md](COSMETICS_SYSTEM.md) for the product and release contract and [ART_ASSET_PROVENANCE.md](ART_ASSET_PROVENANCE.md) for generated-asset provenance.

## Version 3.5.1-beta.1 highlights

- **Reports now have a real free receiver:** a deployable Cloudflare Worker and EU-jurisdiction D1 database accept the existing one-tap missing-combination report without GitHub, an account, a name, or an email address.
- **Private by construction:** only bounded structured fields reach the receiver; raw duplicate-check IDs and IP addresses are never stored, identifiers become pair-scoped one-way HMACs, and inactive rows expire after 180 days.
- **Operator retrieval is ready:** the existing `operator:feedback` export works against the Worker, while offline saves and automatic retry remain intact for players.

- **The opening universe is hand-tuned:** a Golden 50 catalog now anchors early personal play. Every destination is familiar, has a verified authored route of three to seven combinations, includes a plain contextual clue, and keeps at least two logical final recipes. The first thirty adaptive completions prefer this catalog on the server, Pages, and itch builds without changing fixed Daily, Weekly, shared, or custom challenges.
- **Completed paths become contextual invitations:** constellation cards now inherit the target's realm, palette, motif, clue, universe, Cosmic Law, Daily identity, and the silhouette of the route actually taken. Intermediate recipe words stay hidden, so the card looks personal without spoiling the answer. Sharing uses the native share sheet when possible and otherwise copies an invitation with an exact target-and-seed link. Today's link enters the shared Daily; older or completed Daily links remain replayable friend challenges.
- **The first ten games protect the core loop:** Daily follows the two short lessons, sharing opens after the first real win, game choices after two, and Explore after three. Weekly adventures, leaderboards, mastery, the Word Exchange, supporter systems, Run IQ, Rival Ghosts, recipe surveys, and progression-heavy results wait until ten completed games. Settings, privacy, help consequences, path viewing, and sharing remain available throughout.

- **A clearer finish:** More details is roughly half its former height. The result keeps a compact path link, route grade, earned reward, scoring consequences, and sharing while removing duplicate metric boxes, the repeated mini-route, and the unavailable Community Sky explanation from local practice.
- **The journey always continues:** completed Daily games and the final Weekly stage now offer **Play next level** and open a fresh relaxed Reach challenge. Normal adaptive wins, Weekly stages, stories, training, Study playback, and score-safety flows retain their purpose-built actions.
- **A gentle first light:** a new player's first target is Mud—one obvious, satisfying Earth + Water fusion with no clock or move cap. Bronze and Silver remain relaxed, while timed and limited-move personal challenges wait until Gold.
- **Failure always moves forward:** finishing without the target now leads to a different, gentler challenge instead of silently repeating the level that just caused frustration. Exact replay remains a deliberate secondary choice, not the default.
- **Difficulty stays behind the curtain:** challenge selection uses authoritative rank and recent outcomes without exposing level numbers or adjustment formulas. Only exceptional challenges keep the plain **Difficult** label.
- **Play now means play:** the main Play action immediately gathers a Constellation Fold and prepares the next real challenge while reality is fully veiled. When the Fold resolves, one small objective card gives the target, one plain instruction, any challenge-ending limit, and one Start action. Timers, moves, and scoring wait until Start.
- **Every challenge uses the same arrival:** normal word journeys and optional Star Break activities use the same Worldweave grammar instead of appearing from an unrelated menu or result-screen jump.
- **The old pre-level wall is gone:** rewards, scoring explanations, route terminology, starter widgets, expandable rules, and the second Back action no longer block the main path. Alternate modes remain available away from the primary Play action.
- **Milestones retain reflective writing:** the opening and major discoveries can still present concise thoughts about curiosity, creation, and discovery, while routine level entry stays fast. Pause and Escape remain immediate.
- **The first promise is clearer and alive:** the opening screen now explains the goal in plain language and cycles through several logical example recipes instead of leaving one pair on screen forever.
- **Short Star Breaks add variety without pressure:** after some completed personal challenges, an optional break asks players to connect four matching stars without crossing their constellation paths or tap a numbered star trail in order. The generated puzzles are checked, untimed, skippable, and completely separate from points, rewards, ranks, leaderboards, Run IQ, and adaptive difficulty.
- **The main menu has its own universe:** a new constellation-world panorama replaces the door artwork behind the menu. Separate portrait, 1080p, and 4K-sized sources keep the celestial islands, star rivers, and quiet center crisp without making phones download desktop art.
- **Play now travels through the Constellation Fold:** world threads and orbit lines converge over Home, the board is prepared behind a fully opaque gravitational veil, and the constellation resolves onto the words. Timed challenges do not begin counting down until the board is visible.
- **The Worldweave stays sharp at every size:** procedural threads and a responsive gravitational lens adapt to the viewport. Existing portrait, 1080p, and 4K cosmetic art now becomes a subtle fold material instead of being stretched into literal doors.
- **Completed games now close safely:** the result panel has a persistent top close control that stays available while the panel scrolls. Closing it follows the same full return-home flow as the main result action instead of merely hiding the dialog, while a verified score that is still waiting to be saved keeps the result visible until it is safe to leave.
- **The Constellation Fold gives every new orbit an arrival:** luminous world threads form a constellation, space contracts into a gravitational veil, and the destination unfolds around the player. Pause and completed-game results use their own bounded dialog motion rather than replaying a full-screen transition. Reduced-motion and forced-colors alternatives remain first-class.
- **The home screen is epic without becoming busy:** one gold Play action owns the visual hierarchy, while alternate games stay in quieter disclosures. The generated gate panorama, constellation recipe, restrained atlas ornament, mobile crop, 15px text floor, and 44px control floor restore character without returning to widget overload.
- **Challenges follow the player without exposing a formula:** auto-selected Relaxed, Timed, and Limited Moves games are matched privately to recent performance. The board shows one plain **Difficult** tag only for an exceptional challenge; hidden levels, thresholds, streak math, and future adjustments are never presented to the player. Experimenting with word pairs and using ordinary hints do not secretly change the challenge in progress.
- **One Play button, two kinds of opening:** Auto starts every Bronze route with Earth, Water, Fire, and Air, introduces occasional Shuffled starts at Silver, and makes them the main higher-rank format while periodically returning to Classic. Shuffled words are temporary, useful loans taken from a verified suffix of the real answer route. Players who want control can still choose Classic or Shuffled under **Choose game**.
- **Twelve permanent Route Ranks add replayable rules:** Bronze and Silver keep the classic game, Gold introduces one Waypoint, and later ranks combine Blocked Shortcuts, Master Routes, special graph rules, and Orbit Chains. Diamond uses one or two rules, the middle ranks steadily add more, and Legend/Cosmic can require all five together. Clean and flawless play earns mastery faster; each threshold opens a best-of-three promotion, while adaptive difficulty can move down without taking an earned rank away.
- **The sky becomes the trophy:** every pair of Route Ranks unlocks a richer board scene, evolving from a restrained common night sky through living nebulae and astral rifts to the Legend/Cosmic crowned singularity. Mobile, balanced, and cinematic WebP variants are selected responsively; only the current rank scene is lazy-cached.
- **Fair by construction:** adaptive games choose only verified, reachable authored targets, consider route length and alternate paths, avoid recently played targets, and scale the completion reward to the actual challenge. Shuffled games sign and verify their exact starter kit and route suffix, and never introduce a new Remix family in the same game. They are clearly marked personal and never enter shared leaderboards; Daily, Weekly, friend, story, training, and player-chosen challenges remain fixed.
- **Answers grow into readable constellations:** Show Answer now develops every reachable branch in parallel from the bottom of the board, carries each result into the next combination, and leaves completed words and links gently dimmed behind the bright active wave. Pause, speed, finish, and one replay remain available, while Study still awards no score or progression.
- **The path is the product:** First Orbit teaches the board, Second Orbit teaches a real three-fusion route without blocking experimentation, and then the hub progressively reveals Daily play, modifiers, Journeys, Creator's Lab, collections, and community surfaces.
- **World Graph 3** packages 1,458 playable word records and 3,199 deterministic recipes in a compact runtime. The graph audit catalogs 1,443 concepts, with 1,385 reachable from the four starters. All 759 reviewed high-intent attempts work, including same-word recipes; exactly 500 official targets are route-verified, more than 250 retain alternate final recipes for advanced Route Rank rules, and 90 deterministic Daily variants are quality-gated.
- **Find-the-word play has momentum:** Run IQ starts at 0 and reserves its largest gains for discoveries that measurably shorten the authored route to the target. Unrelated valid discoveries add only a point, repeated pairs cannot farm it, and a flawless target route lands at the satisfying 200 cap. It remains a playful run score rather than a real intelligence test or competitive score.
- **One Guidance ladder** moves from a score-safe Route Signal through disclosed Open assists to a complete zero-score Study reveal. Pure, Open, Practice, and Study remain visible from briefing to result.
- **Constellation progress is concrete:** a spoiler-free authored route meter shows real steps remaining instead of guessing from move count, while the live route trail, milestone feedback, visual Living Atlas, honest Rival Ghost projection, and result route card show what the player has actually built.
- **Ranked trust is server-owned:** exact challenge identity, server-computed attempt/rejection accounting, expiring revocable sessions, provisional anomaly handling, append-only beta ledgers, and quarantined AI proposals protect shared results.
- **Feedback is privacy-bounded:** a missing combination report can include one short suggested result, but never an open comment, contact detail, or player name; optional diagnostics remain off by default.
- **The release pipeline is repeatable:** deterministic Pages and itch artifacts, synchronized build/cache metadata, PWA shortcuts and screenshots, performance budgets, multi-browser journeys, accessibility scans, and explicit free-beta/commercial gates are checked automatically.

### Browser support

Release gates exercise current Chromium on compact mobile and desktop viewports, current mobile WebKit, and current desktop Firefox. Keyboard-only play, reduced-motion behavior, normal-motion victory presentation, touch/pointer play, offline reload, and 320 px compact layouts are treated as supported paths. Older embedded webviews and browsers without native ES modules, canvas, dialog, or service-worker support are outside the beta support boundary.

Frontend module, optional-pack, CSS, state, and validation ownership is documented in [docs/FRONTEND_ARCHITECTURE.md](docs/FRONTEND_ARCHITECTURE.md).

## Run and verify

```powershell
npm start
npm run check
npm run balance:cosmos
npm run build:release
```

`npm run balance:cosmos` runs a deterministic eight-week cohort simulation against the shipped Circuit and Star Path domain rules. It fails closed if reward tiers become unreachable, pass accounting stops balancing, skill outcomes invert, or season pacing leaves its declared guardrails.

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
- **Cosmos Circuit** - a daily seeded ship course with unlimited reward-free Practice, earn-only Reward Flight entries, fixed milestone payouts, voluntary extraction, checkpoint powers, replayable onboarding, cosmetic weekly objectives, and interruption-safe resume. The Node service recomputes online outcomes and Stardust from bounded trajectory samples, retains idempotent launch/submission receipts, and never trusts a client-supplied payout; Pages and itch keep a clearly local-only wallet, challenges, personal records, and season.
- **Star Path** - an eight-week, 12-tier exact reward track whose free and Supporter lanes contain presentation rewards only. Its 5,600-XP curve, 125 daily base-XP cap, weekly 200-XP participation catch-up, deterministic balance guardrails, and Season Locker keep progression paced and every claim usable without changing gameplay or Circuit payouts.
- **Friend Challenge** - a shareable URL that preserves the target and seed for asynchronous play.
- **Cosmic Twists** - a 12% contextual alternate discovery after the opening moves, capped at one per casual Reach or Friend Challenge orbit. The target and competitive modes remain luck-free, and repeating the pair restores its canonical result.
- **First Orbit** - a one-fusion Earth + Water tutorial that reaches Mud using the same board interactions as the full game without touching progression or scoring.
- **Second Orbit** - a short bridge from tutorial to real play: reach Mountain in three route fusions while unrelated logical combinations remain available.
- **Explore** - an explicitly unranked, target-free sandbox that carries the player's discovered-word inventory between sessions; target missions begin from the exact verified words shown in their briefing.
- **Universe Director** - deterministic authored universes, seasons, and contextual laws make shared seeds feel distinct while leaving recipes and scores unchanged.
- **Frictionless controls** - drag a tray word directly onto a board word, tap two board words, or hold Ctrl on desktop and skim across words to build a serial fusion chain without clicking.
- **Quick board controls** - Undo remains immediately available; Redo, Tidy, Clear, and the optional semantic Align command live in one Tools disclosure on compact layouts. Sound opens one synchronized mixer, Quit returns Home in one click, and Restart keeps its confirmation.
- **Observatory route memory** - correct performed combinations become subtle stars and threads behind the freely positioned words. Failed guesses never redraw a fictional story, and the target remains disconnected until the player actually earns its route.
- **Living Atlas** - every successful recipe is drawn as a visual node-and-edge constellation with a destination beacon and a readable fallback path.
- **Signature Routes** - each completion receives an explainable route grade and can set a privacy-safe personal best for the same challenge.
- **Recipe insight** - successful pairs explain their connection; failed pairs can offer category-level near-miss direction without revealing an undiscovered answer.
- **Ask the Cosmos** - reveal a target's complete answer as an animated constellation; the run permanently becomes zero-score Study with no rewards, streak credit, or saved reveal discoveries.
- **Living constellations** - use non-spoiler Star Compass glows, unlock an anonymous Rival Ghost after three real wins, complete Recipe Mastery collections, and enable optional cosmic sound and haptics.
- **Recipe feedback** - rate a completed recipe Logical, Surprising, or Bad without typing free-form text; one vote is accepted per real recipe per orbit, while revealed and user-directed recipe text is never retained.
- **Constellation Cards** - preview, download, or share an SVG summary of a completed path with its universe, division, time, moves, and milestones.
- **Community results** - verified online completions receive anonymous cohort context and can opt into a Rival Ghost rematch; static practice explicitly reports that online comparison is unavailable.
- **Personal Universe** - unique discoveries, Stardust, ranks, wins, streaks, and your cosmetic look persist on this device. The beta does not connect gameplay progress to cloud saving.

Included targets are selected from routes reachable from Earth, Water, Fire, and Air. The local build uses the hand-reviewed authored world and fails an unknown pair cleanly instead of inventing category roulette. The online service may use its separately labelled experimental AI tier for casual, authenticated play when configured; official competitive resolution never depends on it.

## Competitive play

Scramble Arena is live two-player competition. Private links create one unranked open-board race; public matchmaking creates a rated race after the player has one scored solo win. The server owns both boards, accepts only authored combinations, broadcasts every attempt and result, enforces the shared countdown and deadline, and settles a separate 1v1 rating. The browser cannot submit an arbitrary result or rating change.

Solo leaderboards remain asynchronous. Players solve shared challenges independently, and only completed ranked runs are uploaded. The server issues each ranked challenge and run token, tracks discovered inputs, moves, elapsed time, assists, and completion, then computes the Starscore itself. Live Scramble never grants solo score, Route Rank, Stardust, mastery, events, or rewards.

Alongside the ordered ladder, a verified result can receive privacy-safe community context such as its cohort placement and pace distribution. Route Signatures summarize the shape and grade of a run without publishing the private ordered recipe history. Rival Ghost rematches remain asynchronous and opt-in.

Rankings are deliberately split:

- **Pure** - no score-reducing concept or powerup was used; Route Signals remain safe.
- **Open** - the run used a Wish, Vault word, Star Compass, Word Gift, or labelled experimental AI assistance, with the applicable multiplier shown throughout the run.

Assisted Open runs therefore never silently compete with unassisted runs. Real-money products are cosmetic-only and do not change division eligibility. Practice Reach and Friend Challenge runs are not uploaded. Public identity uses a server-generated, non-editable cosmic callsign; no player-entered display name is published.

Reveal Path is a learning tool rather than a scoring shortcut. The server forfeits that deterministic ranked challenge before returning its verified route, and replaying the same challenge remains unranked for that player. The browser animates the returned recipe graph without submitting fake combinations; revealed words are temporary and grant no competitive or progression value.

The online beta uses a persistent pseudonymous guest account with no email or player-chosen public name. Registration returns a one-time **Recovery Kit**. The browser retains the unacknowledged kit locally, lets the player open it from **Menu → Settings and data → Account**, and prompts for it after the first real win; acknowledging the prompt removes the local secret. The server stores only a keyed digest, rotates both the recovery code and bearer token after recovery, and revokes the lost device's bearer session. If the player loses both the device credential and Recovery Kit, there is no identity-proof fallback in this repository.

## Make a Wish and the Word Exchange

**Make a Wish** introduces one recognizable concept into a run. It is intentionally an uncertain shortcut rather than an answer button. Every guest receives one free personal Wish. Wishes and other gameplay assistance are earned or granted through play; they are not included in a cash product. The disabled Supporter Pack prototype contains only complete cosmetic collections: Word plaques, Trails, Board backgrounds & finishes, Home backgrounds, Starfold transitions, Interface styles, and Sound themes. Do not enable checkout until the store description, terms, fulfillment, and recovery behavior match that cosmetic-only offer.

The **Word Exchange** offers a curated catalog of known, useful concepts:

- Exchange word licenses cost **Star Credits**, an earn-only server-held virtual balance that cannot be bought for cash.
- Redeeming earned credits for a word grants a persistent beta license in the player's Word Vault. It is not a consumable under current rules, but beta resets or backup restoration can roll ownership back before the production database migration.
- One owned word may be activated per run, which places that result in the Open division.
- Word prices update once every six hours for every player at the same time. The slower shared rotation is legible and non-urgent; the formula combines transparent deterministic waves with bounded aggregate demand, is never personalized, and remains inside the server-configured catalog bounds.
- Every quote shows its expiry and is signed by the server. An expired quote is rejected and refreshed instead of silently charging a different amount.

The server grants a starter balance and limited credits earned through verified ranked play. Star Credits and licenses do not expire in the included data model. `/api/config` deliberately returns an empty `creditPacks` array.

## Commerce boundary

This repository includes market accounting, signed Star Credit quotes, idempotent word-license redemptions, a fixed cosmetic Supporter Pack product definition, and a development-only entitlement unlock. It does **not** include production StoreKit, Google Play, Steam, Epic, or web-provider receipt/webhook verification. Star Credits and Word Vault licenses remain earn-only and cannot be bought for cash. The disabled Supporter Pack changes presentation only; it grants no Wish, powerup, shield, word, score, moves, time, rewards, or leaderboard access.

Billing becomes visible only when a valid `NEBULA_CHECKOUT_URL` and `CONSTELLORE_COMMERCE_FULFILLMENT_READY=true` are configured **and** the active storage adapter reports `commerceSafe: true`. The bundled JSON and in-memory adapters deliberately report false, so they cannot collect money even after an environment-variable mistake. The readiness flag is an operational assertion, not fulfillment logic: do not enable it until a trusted backend verifies provider receipts or signed webhooks, deduplicates transaction IDs, records an audit trail, and writes the cosmetic Supporter Pack entitlement authoritatively. A client-side `success: true` response is never proof of purchase.

`POST /api/player/test-entitlement` is disabled by default. It is available only when `CONSTELLORE_ENABLE_TEST_STORE=true`, `NODE_ENV` is not `production`, and billing is disabled. It is for deliberate local QA of the cosmetic Supporter Pack flow; it does not simulate a real payment.

The real-money catalog is cosmetic-only. Wish or earn-only Vault activation keeps at most 80% score, Star Compass at most 75%, Word Gift at most 50%, and Reveal Path becomes zero-score Study. These gameplay systems are separate from the Supporter Pack, and Pure leaderboard outcomes cannot be purchased.

Rewarded Wishes are similarly disabled unless both the server flag and a host ad adapter are present. Rewards should be granted only after the provider confirms completion.

## Persistence and deployment

By default, the standalone server stores guest identity, recovery digests, balances, licenses, demand, leaderboard best scores, aggregate analytics, aggregate recipe feedback, and checkpointed active runs in `data/constellore.json`. Gameplay cloud-profile endpoints are disabled unless an operator deliberately sets `CONSTELLORE_CLOUD_PROFILE_ENABLED=true`; the shipped beta keeps player progression device-local. Writes are serialized, making this suitable for local development, demos, and a **single Node.js process**. Valid checkpointed runs can resume after a restart, but they are not shared across processes.

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

`POST /api/combination-reports` accepts an exact bounded contract: the two input concepts, an optional suggested result of at most 28 characters, one optional fixed reason, the game mode, and a random privacy-safe reporter ID. It rejects extra fields, links, email-like text, line breaks, unsupported reasons, and unsupported modes; there is no open comment field. Accepted reports are deduplicated through a keyed reporter digest. Abuse limits use independent keyed reporter and network buckets, so changing the browser identifier does not reset the network allowance; neither raw identifier nor IP address is stored in the report table. Aggregate results are exposed to the operator through `GET /api/admin/rejected-pairs?minimumReports=1&limit=100`. Set `CONSTELLORE_ADMIN_TOKEN` to a high-entropy secret of at least 24 bytes to enable the admin summary and backup endpoints. Send it as `Authorization: Bearer …` or `X-Constellore-Admin`; keep it out of browser code, URLs, logs, and source control. If it is absent or too short, admin routes intentionally respond as not found.

Nothing is emailed automatically. Hosted feedback remains in the configured service until an operator retrieves its protected aggregate. The zero-cost Worker setup is documented in [DEPLOY_FEEDBACK_BACKEND.md](DEPLOY_FEEDBACK_BACKEND.md). Run `npm run --silent operator:feedback` with `CONSTELLORE_OPERATOR_BASE_URL` and `CONSTELLORE_ADMIN_TOKEN` set to export missing-combination requests and recipe ratings as JSON; [DEPLOY_BETA.md](DEPLOY_BETA.md#retrieve-the-player-feedback-report) has the equivalent Node-host procedure. Pages and itch always retain a bounded local copy. If `PUBLIC_FEEDBACK_API_URL` was present when the package was built, they also send it directly to the anonymous report endpoint and retry queued reports after reconnecting. If the receiver is not configured, the interface says that the idea was saved locally rather than pretending it reached Oxyfel Games. Players can export the local copy from **Menu → Settings and data → Privacy and data → Export local report**.

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
