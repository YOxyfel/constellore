# Constellore release runbook

This runbook covers the **free local-practice beta** distributed on GitHub Pages and itch.io. It does not authorize a paid launch or claim that the separate Node service is production-ready.

## Product boundary to publish

The current portable build is a target-based word-route puzzle with:

- a deterministic, prebuilt local word world;
- Signature Route grades and device-local personal bests;
- the visual Living Atlas, Constellation Voyages, and deterministic weekly Cosmic Events;
- recipe explanations and spoiler-safe category direction;
- browser-local progress;
- unranked practice completion;
- no live AI generation;
- no score upload or verified leaderboard;
- no cross-device or recoverable account;
- no checkout, paid entitlement, rewarded ad, or uploaded/network gameplay telemetry. Bounded aggregate diagnostics remain on-device and can be exported or reset.

Do not describe the itch/Pages package as AI-generated on the spot, globally ranked, account-backed, or monetized. Those capabilities require the separately operated online architecture and additional release gates.

## Build and verify

Use Node.js 20 or 22. Install the locked development toolchain before running the gates; the shipped game still has no runtime package dependencies.

```powershell
npm ci
npm run check
npm run build:release
npm run test:e2e
```

`npm run build:release` synchronizes versioned browser assets, enforces the free-beta release boundary, runs the Pages performance budget, and builds and verifies both static artifacts. `npm run test:e2e` exercises the first-session journey in mobile Chromium, mobile WebKit, and desktop Firefox and runs serious/critical axe checks. Core release assets are generated deterministically by `npm run assets:release` and include:

- `public/icon-192.png`;
- `public/icon-512.png`;
- `public/icon-maskable-512.png`;
- `public/social-card.png` at 1200×630 for the game runtime.

The marketing page uses the reviewed, checked-in `public/social-card-v3.jpg` at 1200×630. It depicts the real Water + Fire → Steam → Cloud and Air + Fire → Energy route into Storm rather than an invented combination.

The itch output is:

```text
dist-itch/
  constellore-html5-v<package version>.zip
  constellore-html5-v<package version>.zip.sha256
  site/                              # build workspace; do not upload this folder
```

The repository-root `constellore-html5.zip` and `itch-assets/` are user-managed legacy/release assets. The build deliberately does not delete or overwrite them.

## Verify the outer checksum on Windows

```powershell
$version = (Get-Content .\package.json -Raw | ConvertFrom-Json).version
Get-FileHash ".\dist-itch\constellore-html5-v$version.zip" -Algorithm SHA256
Get-Content ".\dist-itch\constellore-html5-v$version.zip.sha256"
```

The hashes must match. `npm run check:itch` additionally opens the ZIP without extracting it and validates the internal manifest and every file checksum.

## itch.io upload

1. Run the full checks above from a clean revision.
2. Open the existing Constellore itch project.
3. Upload `dist-itch/constellore-html5-v<version>.zip`.
4. Mark the upload as **HTML** and select **This file will be played in the browser**.
5. Keep the project free while the checkout, identity, legal, and support gates remain incomplete.
6. In itch embed settings, start with a responsive viewport and allow fullscreen. Smoke-test the actual embedded page on a phone and desktop before making the update public.
7. Keep the prior known-good upload available for rollback until the new build is verified.
8. Publish a short devlog that names the version, player-visible changes, known beta limitations, and whether local progress may reset.

The ZIP places `index.html` at its root. Do not upload the Node server, repository ZIP, source tree, or `dist-itch/site` directory.

## GitHub Pages variables

The Pages workflow always publishes the marketing site and local-practice game. Optional repository Actions variables are:

| Variable | Purpose | Safe default |
| --- | --- | --- |
| `PUBLIC_ITCH_URL` | Reveals the prominent itch CTA after validating an HTTPS `itch.io` URL. | Empty; CTA remains hidden. |
| `PUBLIC_BETA_URL` | Sends play CTAs to a separately operated online beta. Must be the full HTTPS game URL ending in `/play/`, not the server root. | Empty; Pages local practice is used. |

Do not guess the itch creator URL. Add `PUBLIC_ITCH_URL` only after the exact public game page has been opened and tested while signed out.

## Pre-publish smoke test

Verify the deployed artifact, not only localhost:

- the landing page immediately says a target word is the objective;
- the primary Play CTA opens the playable local build;
- the itch CTA is hidden when unconfigured and opens the exact game page when configured;
- First Orbit, Second Orbit, Explore, and one normal target can be completed with touch and mouse;
- a completed route shows its Signature grade and a populated Living Atlas;
- a Voyage stage and the current Cosmic Event can start and restore after refresh;
- recipe explanations never expose an undiscovered result after a failed pair;
- local practice clearly marks community comparison as unavailable instead of fabricating players or ranks;
- refresh restores local practice progress as expected;
- clearing site data is described as destructive to local progress;
- install metadata offers the 192px, 512px, and maskable icons;
- offline reload works after one successful online load;
- the service worker leaves unrelated origin caches untouched;
- no checkout, ad, leaderboard upload, account recovery, or live-AI claim appears as an available local feature;
- social preview validators receive the 1200×630 image and large-card metadata;
- there are no requests to Google Fonts from the static release;
- the browser console has no uncaught error during a complete route.

## Legal and support status

The public artifact now includes a truthful beta Privacy Notice, Beta Terms, and Support page. They describe the local-practice and optional online-service boundaries and link only to tested public issue forms for non-sensitive reports. They are product disclosures, not a claim of Bulgarian/EU legal review; internal drafts under `legal/` remain excluded from release artifacts.

Do not ask players to put Recovery Kits, tokens, email addresses, tax information, or other private data in a public issue. Before a wider online beta, activate a tested private support/privacy route and name its responsible operator. Before ads or payments, complete the trader, accounting, VAT, consumer-law, privacy, processor, receipt-verification, refund, and support gates in `DEPLOY_BETA.md` and `docs/V3_RELEASE_GATES.md`.

## Versioning and rollback

1. Change the version in `package.json`, then run `npm install --package-lock-only` so the lockfile agrees.
2. Run `npm run release:sync`; commit the generated browser versions, release metadata, and service worker with the source change.
3. Build and verify again; never rename an old ZIP as a new version.
4. Tag only the exact package version (`v3.0.0-beta.1`, for example). The release workflow rejects a mismatched tag or unsynchronized source tree.
5. Record the Git commit and outer SHA-256 in the release notes or private release record.
6. If the release fails, restore the previous itch upload and previous Pages revision. Do not try to repair an already-published ZIP in place.

GitHub CI runs the source tests and then creates a deterministic itch package. A passing artifact check proves package integrity and declared boundaries; it does not replace real mobile, desktop, accessibility, or gameplay smoke testing.
