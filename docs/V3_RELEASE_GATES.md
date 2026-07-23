# Constellore 3.0 release gates

Constellore 3.0 is the release where the destination route becomes the product: a player sees one target, discovers several logical paths toward it, receives progressive guidance only when needed, and keeps the completed path as a constellation.

This document is a go/no-go contract. A feature existing in source is not enough; the corresponding automated, human, or external gate must pass.

## Product shape

- The first screen has one recommended action and one tutorial alternative.
- Reach is the base rule set. Time and move pressure are modifiers rather than separate concepts the player must learn immediately.
- Daily, Journeys, and Explore/Creator's Lab are progressively disclosed.
- Pure, Open, Practice, and Study are visibly distinct from briefing through result.
- Guidance escalates from a score-safe direction, to a scored clue, to zero-score Study.
- A completed path is shown as a constellation and can be shared without exposing credentials.
- Legacy beta data can be sanitized or migrated without inventing paid ownership.

## Automated gates

Run from a clean checkout with Node.js 20 or 22:

```powershell
npm ci
npm run check
npm run build:release
npm run test:e2e
```

The gates cover:

- syntax and deterministic unit/integration tests;
- graph reachability, expected-attempt coverage, same-word logic, dead ends, bottlenecks, and route diversity;
- server-computed ranked outcomes and exact challenge identity;
- recovery, session expiry/revocation, replay defense, AI quarantine, rate limits, and secret-safe logging;
- Pages and itch.io packaging, internal hashes, cache/version consistency, and runtime boundaries;
- mobile Chromium, mobile WebKit, desktop Firefox, keyboard pause/recovery, a real starter fusion, horizontal overflow, 15 px text, and axe WCAG scans;
- PWA screenshots, shortcuts, offline cache boundaries, and performance budgets.

Tags must exactly match `package.json` (`v3.0.0-beta.1`, for example). The tag workflow rejects unsynchronized release metadata and publishes the deterministic itch.io ZIP plus its SHA-256 sidecar.

## World Graph acceptance

- Maintain a reviewed corpus of at least 500 high-intent player attempts and continuously grow it toward 1,000.
- At least 90% of the reviewed corpus must return the intended result or a deliberately approved near-result.
- Same-word expectations must be intentional rather than accidental.
- Core playable concepts should have several useful continuations or be marked as intentional endpoints.
- The automated beta build currently requires 100% coverage of its reviewed corpus and no more than 275 reachable, unmarked dead ends. Intentional endpoints are reported separately and must be explicitly curated; the 275 ceiling is a beta regression bound, not the long-term goal of fewer than 20% dead ends among core concepts.
- Every ranked target must be reachable, satisfy its limit, and have multiple materially different routes where the graph permits.
- No single opening recipe should dominate more than 25% of the ranked target catalog.
- AI-proposed recipes remain provisional and unranked until reviewed and published in a versioned graph.

## Moderated novice test

Recruit at least 30 people who have not been taught the game by its developer. Do not explain the interface before the attempt. Record only consented, non-sensitive observations.

For every session capture:

1. Can the person explain the target and win condition before acting?
2. Time to first valid fusion.
3. Tutorial completion or abandonment.
4. First target completion or abandonment.
5. Every expected combination that failed.
6. Every mistaken tap, drag, mode, Guidance, and pause action.
7. Whether the completed constellation and next action are understood.

Initial release gates:

- 80% explain the win condition before acting.
- 75% complete First Orbit.
- Median first fusion is below 30 seconds.
- Median first mission completion is below five minutes.
- At least 50% complete the first real mission.
- No critical control misunderstanding repeats unresolved across the final test round.

## Open-beta evidence

Do not present analytics from a static local-practice build as shared player evidence. The online beta must use privacy-safe cohorts and aggregate funnels.

Before declaring 3.0 generally available:

- at least 200 non-team players have opened the measured beta;
- at least 50 verified core challenges have been completed;
- D1 retention is tested against an initial 25% hypothesis;
- D7 retention is tested against an initial 10% hypothesis;
- onboarding, first fusion, target completion, Guidance, replay, and rejected-pair funnels are reviewable;
- suspicious leaderboard results can be made provisional, reviewed, and removed;
- each regression or graph complaint has an owner and outcome.

These percentages are internal hypotheses, not promises or universal market benchmarks. If the funnel misses them, diagnose the failing step before adding another mode.

## Operations gate

- Production and staging have separate secrets and data.
- The service exposes liveness and readiness, structured request IDs, bounded logs, and actionable error metrics.
- Database migrations are reversible or have a tested forward repair.
- Backups exclude bearer and recovery secrets; restore is rehearsed on staging.
- Session, signing, AI, and provider keys can rotate without deleting legitimate profiles.
- A previous immutable build can be restored within 15 minutes.
- Rate limits and idempotency work across all production instances, not only one process.
- A support owner can inspect the build ID, challenge identity, and non-secret audit trail for a report.

## Free-beta legal and safety gate

- The published Privacy, Beta Terms, Support, Security, license, and third-party notices match the deployed build.
- No published page contains a TODO/TBD placeholder.
- Profile export and deletion work.
- Experimental AI and provisional results are labelled.
- Players are warned never to share Recovery Kits or bearer tokens.
- Checkout, paid currency, rewarded advertising, and commercial fulfillment remain disabled.

## External commercial gate

Source code cannot complete these items. Before setting `CONSTELLORE_COMMERCIAL_RELEASE=true`, the owner must confirm all of them with real evidence:

- Bulgarian accountant advice for the chosen seller form, tax/social-insurance position, VAT/Article 97a questions, platform payouts, and invoicing.
- Final trader address and required contact information.
- An activated and tested private support/privacy route with a responsible person.
- Appropriate Bulgarian/EU privacy and consumer-law review.
- Selected processors, contracts, data locations, retention, and transfer safeguards.
- Provider receipt or signed-webhook verification, transaction idempotency, reconciliation, refund reversal, and entitlement recovery.
- Production database restore, incident, moderation, appeal, and data-request procedures.
- Final age audience and store rating.

The release-readiness script refuses commercial mode unless the corresponding explicit confirmations are present. Those switches are operational attestations, not substitutes for the underlying work.

## Distribution order

1. GitHub Pages and itch.io HTML5 free beta.
2. Hardened same-origin online web beta after the operations gate.
3. Wider web launch after the novice and retention gates.
4. Steam, Epic, Google Play, and Apple only after demand justifies their fees, wrappers, billing, cloud-save, certification, and support burden.
