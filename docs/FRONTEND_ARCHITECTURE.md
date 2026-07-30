# Frontend surface boundaries

Constellore keeps its initial word-game shell small and loads feature-heavy destinations only when the player opens them. New work should follow these ownership boundaries rather than adding another broad import or selector to `app.js`.

## Core shell

- `app.js` coordinates navigation, the active word run, results, and shared services.
- `default-profile.mjs`, `initial-app-state.mjs`, and `mastery-catalog.mjs` own large declarative boot data.
- `styles.css` owns legacy geometry and shared game primitives.
- `simple-ui.css` owns the current player-facing word-board and dialog component layer.
- `cosmic-gate.css` and `epic-home.css` own only the transition and Home surfaces.

Core modules may not import Cosmos Circuit, Star Path, or the Cosmetics Observatory statically. `scripts/check-performance-budget.mjs` measures the core shell independently from optional packs.

## Secondary surfaces

`secondary-surface-loader.mjs` is the only core entry point for:

- Cosmos Circuit, Crazy Path, Star Path, their domain/live-ops modules, and `cosmos-circuit.css`;
- the Cosmetics Observatory and `cosmetics-observatory.css`;
- the small earned-only Stardust store domain and stylesheet when Help is first opened.

Those files are absent from the service-worker install shell, cached on first use, and versioned like core assets. When a secondary feature is unavailable, its trigger must recover with an actionable message rather than leaving an empty modal.

## CSS ownership

- Put Circuit selectors only in `cosmos-circuit.css`.
- Put Observatory layout only in `cosmetics-observatory.css`; reusable equipped-cosmetic effects belong in `cosmetics.css`.
- Put story-layer presentation only in `story/combination-story.css`.
- Do not override a surface from a later global file. Add a surface variable or a local responsive rule instead.
- Compact support starts at 320 × 568 CSS pixels. Sticky action areas must leave a useful scrollable content region.

## State ownership

- Gameplay progress is local by default.
- Profile and Circuit saves use revisioned writes plus cross-tab reconciliation.
- Circuit keeps a separate manual backup because it is an optional local system.
- Server identity, recovery, verified runs, and leaderboards must not silently enable cloud gameplay synchronization.
- Real-money or valuable random-entry rewards remain disabled while the JSON store or client-reconstructable flight telemetry is in use.

## Required evidence

Before merging a surface change:

1. Run its focused unit tests.
2. Run `npm run check` and `npm run check:pages`.
3. Exercise normal and reduced motion.
4. Capture or update the compact and desktop screenshot baselines when layout changes.
5. Complete the relevant items in `ACCESSIBILITY_CHECKLIST.md`.
