# Constellore art asset provenance

## `public/art/celestial-atlas-bg-v1.webp`

- Created: 2026-07-23
- Method: OpenAI built-in image generation, followed by a lossless-content WebP format conversion for runtime delivery
- Project reference: `public/social-card-v3.jpg`, used only to communicate Constellore's existing celestial-map visual language
- Named artist or living-artist imitation: none
- Embedded text, logo, or third-party mark: none
- Intended use: atmospheric background for the game home screen, public website, and supporting release surfaces

Prompt:

> Use case: style-transfer
>
> Asset type: responsive game and landing-page atmospheric background texture
>
> Primary request: Create a completely new abstract celestial-atlas background inspired only by the visual language of the reference image. No interface, no word tiles, no logo, no lettering. It should feel like a living hand-engraved map of an unknown word-cosmos: deep ink-blue space, subtle paper/grain texture, faint blue nebula haze at the outer edges, delicate silver constellation lines, a few restrained pale-gold star nodes, barely visible orbital arcs and cartographic markings.
>
> Composition/framing: wide landscape composition, dark calm negative space across the center and lower middle for readable UI, richer detail near the upper corners and far edges, no hard seams or rectangular frames.
>
> Lighting/mood: moonlit, mysterious, premium, contemplative rather than neon or sci-fi arcade.
>
> Color palette: midnight navy, slate blue, moon silver, tiny restrained antique-gold highlights; avoid saturated purple and pure black.
>
> Materials/textures: engraved celestial chart, frosted glass dust, fine paper grain, subtle star bloom.
>
> Constraints: background-only art; no text, no letters, no numbers, no logos, no icons, no UI panels, no watermark; keep contrast low enough for white interface text; must work when cropped on mobile and desktop; do not reproduce the reference composition.

The interface art surrounding this asset—word plaques, constellation rings, focus states, icons, surfaces, and responsive crops—is original project-native HTML/CSS/SVG/canvas work.

## Rank-evolving board skies

Runtime files:

- `public/art/ranks/tier-01-common-{sm,md,lg}.webp`
- `public/art/ranks/tier-02-dawn-{sm,md,lg}.webp`
- `public/art/ranks/tier-03-nebula-{sm,md,lg}.webp`
- `public/art/ranks/tier-04-aurora-{sm,md,lg}.webp`
- `public/art/ranks/tier-05-rift-{sm,md,lg}.webp`
- `public/art/ranks/tier-06-singularity-{sm,md,lg}.webp`

- Created: 2026-07-25
- Method: OpenAI built-in image generation, followed by deterministic WebP resizing and compression for mobile (`512px`), balanced (`896px`), and cinematic (`1254px`) delivery
- Project reference: `itch-assets/constellore-pfp-v4-black-hole.png`, supplied by the project owner as the intended high-rank visual endpoint
- Named artist or living-artist imitation: none
- Embedded text, logo, or third-party mark: none
- Intended use: progressively richer word-board backgrounds paired across Constellore's twelve mastery ranks

Final prompt set:

> Tier 1 — Common Sky (Bronze and Silver): Create a square, restrained deep-navy night sky for a word-combination game board. It should feel familiar and attainable: sparse tiny stars, faint dusty Milky Way haze, very subtle hand-drawn constellation points near the outer edges, modest depth, low saturation, and generous dark calm space through the center for draggable words. No black hole, dramatic portal, lettering, logo, interface, borders, or watermark.

> Tier 2 — Stellar Dawn (Gold and Diamond): Create the next evolutionary stage of the same square board sky. Add a graceful cobalt-blue nebula ribbon, more deliberate constellation networks and fine orbital traces near the edges, small silver and pale-gold star accents, and a sense that the ordinary sky is opening into a mapped universe. Preserve a dark, quiet central play area. No lettering, logo, interface, frame, or watermark.

> Tier 3 — Living Nebula (Emerald and Sapphire): Create a premium square celestial board background with layered teal, emerald, and deep-blue aurora clouds forming a broad subtle ring around a calm dark center. Add delicate hand-etched constellations, luminous dust, small celestial nodes, and organic currents that suggest a living word cosmos. Keep the center readable and avoid a single dominant object. No text, logo, UI, border, or watermark.

> Tier 4 — Celestial Aurora (Ruby and Master): Create an increasingly spectacular square cosmic board background: rich ruby, magenta, indigo, and restrained molten-gold stellar clouds curl around the outer frame like a celestial forge. Weave in fine constellation geometry, planetary specks, and flowing gravitational lines. Preserve a dark central basin for gameplay while making the edges luxurious and energetic. No text, logo, interface, hard frame, or watermark.

> Tier 5 — Astral Rift (Grandmaster and Mythic): Create a breathtaking square deep-space scene with violet and electric-blue gravitational arches rising like a cosmic cathedral around a calm central void. Include luminous star rivers, intricate constellation maps, distant planets, pearlescent dust, and restrained warm highlights. It should feel rare, ancient, dimensional, and earned, with edge detail framing readable gameplay. No text, logo, UI, border, or watermark.

> Tier 6 — Crowned Singularity (Legend and Cosmic): Reinterpret the supplied black-hole reference as a new square masterpiece for the highest mastery ranks. Place a deep, readable singularity near the center, surrounded by a luminous accretion crown that transitions from icy cobalt and ultraviolet on the left to molten amber and ember-orange on the right. Integrate elegant constellation networks, distant planets, orbital diagrams, flowing cosmic filaments, and immense depth. Keep the center calm enough for word chips while making the full scene eye-watering, prestigious, and unmistakably climactic. Do not copy the reference composition exactly. No text, logo, UI, border, or watermark.

All responsive variants come from their matching generated tier master; no generative fill or synthetic content was added during resizing.
