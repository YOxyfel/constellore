# Constellore cosmetics system

Status: implemented for `4.0.0-beta.4`

The system treats cosmetics as a presentation layer. A cosmetic may change visual material, motion, ambient audio, or framing, but never recipes, score, timers, moves, progression, matchmaking, leaderboard eligibility, or result verification.

## Product model

A complete collection contains one item in each canonical slot:

| Slot | Player-facing purpose | Runtime surface |
| --- | --- | --- |
| `wordPlaque` | The material and frame around words | Board words, inventory words, ghost words, badges, focus/drag states |
| `trailSet` | The path a word leaves while moving and the fusion accent | Pointer trail, permanent recipe links, fusion burst |
| `boardFinish` | A material treatment above the earned rank sky | Board overlays only; rank art remains visible |
| `homeScene` | The menu/home environment | Responsive Home artwork and palette |
| `gateStyle` | The opening-door sequence | Responsive split-door artwork and gate material |
| `uiFinish` | Menus, cards, controls, and chrome | Interface variables and component finish |
| `soundTheme` | Ambient score and presentation cues | Lazy soundtrack, synchronized run pulse, word/fusion feedback, transitions, rewards, and origin timbre |

The source of truth is `public/cosmetic-catalog.mjs`. IDs are namespaced, slots are versioned, and old four-slot profiles migrate deterministically.

## Launch collections

| Collection | Access | Design language | Home presentation | Full-kit status |
| --- | --- | --- | --- | --- |
| Celestial Atlas | Free/default | Woven charts, ink-blue skies, quiet cosmic chimes | Familiar foundation | 7/7 |
| Aurora Archive | Supporter | Frostglass, crystalline archives, teal/violet aurora | Familiar shell with coordinated accents | 7/7 |
| Solar Foundry | Supporter | Engraved brass, orreries, ember-gold star rivers | Familiar shell with coordinated accents | 7/7 |
| Lunar Garden | Supporter / Deluxe | Moonstone, silverleaf arches, jade fireflies, lilac night blooms | Familiar shell with a moonlit garden treatment | 7/7 |
| Eclipse Sovereign | Supporter / Sovereign | Black opal, champagne-gold corona, violet gravitational arcs | Prestige full-shell transformation | 7/7 |
| Pixel Frontier | Supporter / Arcade | Crisp 16-bit tiles, cartridge frames, scanline sparks, chip-synth constellations | Familiar shell with a true pixel-art treatment | 7/7 |
| Bubble Reef | Supporter / Playful | Original shell architecture, pearl bubbles, coral currents, buoyant plucks | Familiar shell with a whimsical undersea-cartoon treatment | 7/7 |
| Stellar Vanguard | Supporter / Epic | Original command alloy, ion crescents, ceremonial meridians, broad synthetic brass | Familiar shell with a cinematic space-opera treatment | 7/7 |

Every complete kit includes responsive Home and opening Gate backgrounds. All kits keep the established information architecture and change only their owned presentation surfaces. Eclipse Sovereign remains the sole full-shell treatment: its coordinated `homeScene` and `uiFinish` transform the surrounding shell, borders, effects, and interface finish while leaving the same controls and content understandable.

Earned pieces can be mixed into any collection:

- Cartographer word plaque: 25 non-origin discoveries.
- First Light trail: first verified win.
- Weekly Sigil gate: completed weekly expedition.

Server responses are authoritative for online ownership. Static/offline practice evaluates the same thresholds locally. The Supporter Pack grants creative options only and never competitive power.
Owning all seven preset pieces individually rolls up to collection ownership, so a complete set cannot be sold or charged a second time.

## Player experience

The Cosmetics Observatory supports:

- Collections, Pieces, and Owned views.
- Locked previews without accidental equip.
- One-action full-kit equip and independent piece equip.
- Mixed-kit summaries and collection-aware share cards.
- Real Home/Gate preview artwork, piece-specific thumbnails, and sound samples.
- Independent music, word/fusion, and haptic switches plus master, music, and SFX volume controls.
- Apply/cancel semantics with the equipped loadout restored on cancel.
- Full, Reduced, and Off effect modes.
- Keyboard-contained native modal behavior, stable focus after apply, live announcements, tabs, and roving radio controls.

The modal and radio behavior follow the W3C WAI-ARIA Authoring Practices for [modal dialogs](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) and [radio groups](https://www.w3.org/WAI/ARIA/apg/patterns/radio/). Motion can be disabled both through the in-game Effects setting and `prefers-reduced-motion`, consistent with [WCAG animation guidance](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions).

## Rendering rules

- Each slot owns only its surface. A Solar UI finish cannot replace an Aurora Home or Gate scene.
- Standard collections preserve the familiar Home composition. Eclipse Sovereign's explicitly declared full-shell presentation coordinates its own Home scene and UI finish, but each item still affects only its canonical slot when mixed.
- Rank board artwork remains the foundation; board finishes add material layers instead of replacing progression art.
- Category color, semantic state, visible focus, and readable labels survive every word-plaque material.
- Trails use bounded coalesced-pointer samples and a maximum device-pixel ratio of 2.
- Full mode enables trails and bursts; Reduced removes nonessential movement; Off removes cosmetic animation while preserving static connections.
- `forced-colors`, higher-contrast, reduced-motion, and reduced-data modes have explicit fallbacks.
- Cosmetics are applied before the opening gate is constructed to prevent a default-theme flash.

## Asset and delivery contract

Home and Gate scenes ship in responsive `sm`, `md`, and `lg` WebP variants. Generated masters and prompt provenance are recorded in `ART_ASSET_PROVENANCE.md`. Original soundtrack loops, synchronized gameplay-pulse stems, and themed SFX banks are recorded in `AUDIO_ASSET_PROVENANCE.md` and remain outside the install shell.
Run `npm run cosmetics:verify-art` to rebuild all seven optional art packs in a temporary directory and compare all 42 derivatives byte-for-byte with the shipped files.

Premium packs:

- Are excluded from the install precache, base shell, and first-view base-art budget.
- Load on demand into a dedicated versioned lazy cache.
- Have exact filename, dimension, per-file, and per-pack validation.
- Use an early saved-loadout preload selector so returning players fetch one Home set and one Gate set instead of downloading default and equipped art.
- Are required and revalidated in server, Pages, and itch release pipelines.

Current pack ceilings:

- Aurora Archive: 1.2 MB.
- Solar Foundry: 1.5 MB.
- Lunar Garden: 1.2 MB.
- Eclipse Sovereign: 1.5 MB.
- Pixel Frontier: 1.1 MB.
- Bubble Reef: 1.3 MB.
- Stellar Vanguard: 1.1 MB.

Every sound theme ships one 64-second stereo soundtrack, one synchronized
64-second gameplay-pulse stem, and one 33.6-second mono bank containing 24 cue
slots under `public/audio/<collection>/`. Audio packs are synthesized without
samples, excluded from the install shell, lazy-cached after playback
activation, and independently capped at 1.2 MB.

## Analytics contract

Track intent and outcome separately:

- `cosmetics_observatory_opened`: discovery/entry.
- `cosmetic_changed`: successful equip only, with slot/collection-safe presentation metadata.

Never include entitlements or cosmetic state in challenge signatures, gameplay payloads, filenames, score records, or leaderboard verification.

## Release acceptance

A cosmetics release is ready only when:

1. Every collection has exactly one valid item per canonical slot.
2. Ownership, migration, cloud replacement, and server-earned thresholds pass.
3. Collection and mixed-kit CSS remain slot-independent.
4. Locked, unknown, and wrong-slot IDs fail closed.
5. Desktop and mobile Observatory flows pass keyboard, focus, and visual review.
6. Pointer trails, fusion bursts, permanent links, Reduced, Off, high contrast, and forced colors pass.
7. All responsive art reproduces from its approved masters, matches declared dimensions, and remains within pack budgets.
8. Pages and itch builds use portable paths and contain the complete manifest.
9. The service-worker cache version changes whenever presentation code or art changes.
10. Challenge/share fairness tests prove cosmetics cannot alter gameplay identity.

## Next collection checklist

For each future collection:

1. Define the collection and seven items in the canonical manifest.
2. Author a material/palette brief with central gameplay-safe contrast.
3. Produce Home/Gate source masters and responsive derivatives.
4. Add word, board, UI, trail, soundtrack, and sound recipes without cross-slot selectors.
5. Define access as free, supporter, earned, or time-bounded event; never infer ownership from client claims.
6. Add Observatory art and locked-preview copy.
7. Add share-card presentation if the complete collection should have one.
8. Register assets and budgets, regenerate the worker, and run the full release acceptance suite.
