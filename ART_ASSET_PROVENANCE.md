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

## Aurora Archive and Solar Foundry cosmetic scenes

Reproduction toolchain for all optional cosmetic scene packs: Pillow `12.1.0` or `12.2.0`, WebP `1.6.0`. Verify all 42 derivatives with `npm run cosmetics:verify-art`.

Source masters:

- `itch-assets/cosmetics/aurora-archive-home-source.png`
- `itch-assets/cosmetics/aurora-archive-home-portrait-source.png`
- `itch-assets/cosmetics/aurora-archive-gate-source.png`
- `itch-assets/cosmetics/aurora-archive-gate-landscape-source.png`
- `itch-assets/cosmetics/solar-foundry-home-source.png`
- `itch-assets/cosmetics/solar-foundry-home-portrait-source.png`
- `itch-assets/cosmetics/solar-foundry-gate-source.png`
- `itch-assets/cosmetics/solar-foundry-gate-landscape-source.png`

Runtime files:

- `public/art/cosmetics/aurora-archive/{home,gate}-{sm,md,lg}.webp`
- `public/art/cosmetics/solar-foundry/{home,gate}-{sm,md,lg}.webp`

- Created: 2026-07-27
- Updated: 2026-07-29 with dedicated portrait Home and landscape Gate companion masters
- Method: OpenAI built-in image generation for the original masters, followed by reference-guided orientation recomposition for the companion masters and deterministic quality-controlled WebP export with `scripts/build-cosmetic-art.py`
- Reference image: each 2026-07-29 companion master used its matching original Home or Gate master as the visual-identity reference
- Named artist or living-artist imitation: none
- Embedded text, logo, or third-party mark: none
- Intended use: optional Home Scene and opening Gate Style cosmetics; no gameplay information or competitive advantage is encoded in the artwork

Final prompt set:

> Aurora Archive — Home Scene: Create a production-ready wide background master for a premium indie word game's home/menu scene. Collection: “Aurora Archive.” A majestic celestial observatory-library built from frostglass and dark carved stone, with crystalline archive shelves and subtle engraved constellation maps along the outer edges. Emerald, cyan, and violet aurora ribbons arc across a deep navy starfield; tiny warm gold wayfinding lights add life. Preserve a calm, dark, low-detail central safe area for game title and menu UI, and keep important motifs toward the sides. Painterly cinematic concept art with refined handcrafted texture, quiet wonder, elegant not busy, readable under translucent UI. No people, no creatures, no readable text, no letters, no icons, no logo, no watermark, no UI mockup. Wide 16:9 composition, crop-safe for desktop and mobile derivatives, edge-to-edge environment art.

> Aurora Archive — Gate Style: Create a production-ready tall opening-door background master for a premium indie word game. Collection: “Aurora Archive.” A symmetrical pair of monumental frostglass observatory archive doors, viewed straight on, designed to split precisely at the vertical center and slide apart. Dark carved celestial stone and translucent crystalline panels, engraved abstract constellation lines and star-map geometry without letters. Emerald, cyan, and soft violet aurora light glows through the glass; restrained warm gold hinges and tiny lamps. Strong center seam, mirrored left/right visual weight, deep navy, elegant, mysterious, handcrafted painterly cinematic concept art. Keep the central seam and upper center relatively dark for a logo overlay; key detail sits toward both halves. No people, no creatures, no readable text, no letters, no logo, no watermark, no UI mockup. Tall 9:16 composition, crop-safe enough to derive landscape door variants.

> Solar Foundry — Home Scene: Create a production-ready wide background master for a premium indie word game's home/menu scene. Collection: “Solar Foundry.” A grand celestial orrery foundry at the edge of space: antique brass astrolabes, precise blueprint-like constellation grids, rotating-looking rings frozen in a serene composition, and ember-gold star rivers over deep ink navy. Refined astronomical craft, warm copper and amber light at the outer edges, dark cool stone and lacquered metal, a few glowing glass instruments. Preserve a calm, dark, low-detail central safe area for title and menu UI; place strong machinery and motifs toward the sides and lower corners. Premium handcrafted painterly cinematic concept art, elegant scientific fantasy, not industrial grime, not cluttered steampunk. No people, no creatures, no readable text, no letters, no icons, no logo, no watermark, no UI mockup. Wide 16:9 composition, crop-safe for desktop and mobile derivatives, edge-to-edge environment art.

> Solar Foundry — Gate Style: Create a production-ready tall opening-door background master for a premium indie word game. Collection: “Solar Foundry.” A symmetrical pair of monumental celestial foundry doors, viewed straight on, designed to split precisely at the vertical center and slide apart. Deep ink-black lacquered metal and antique brass, elegant astrolabe rings, engraved abstract blueprint grids, sunburst geometry, tiny ember-gold star points, and restrained amber glass channels. Refined astronomical instrument craft, stately and luxurious, not dirty industrial, not cluttered steampunk. Strong center seam and balanced left/right halves; keep upper center relatively dark for a logo overlay. No people, no creatures, no readable text, no letters, no logo, no watermark, no UI mockup. Handcrafted painterly cinematic concept art. Tall 9:16 composition, crop-safe enough to derive landscape door variants.

The responsive derivatives use fixed crop targets: Home `960×1280`, `1920×1080`, and `2560×1440`; Gate `1080×1920`, `1920×1080`, and `2560×1440`. No generative fill or additional synthetic content was introduced after generation.

Reproduction commands:

```powershell
python scripts/build-cosmetic-art.py --home-source itch-assets/cosmetics/aurora-archive-home-source.png --home-portrait-source itch-assets/cosmetics/aurora-archive-home-portrait-source.png --gate-source itch-assets/cosmetics/aurora-archive-gate-landscape-source.png --gate-portrait-source itch-assets/cosmetics/aurora-archive-gate-source.png --gate-landscape-quality-offset -5 --output public/art/cosmetics/aurora-archive
python scripts/build-cosmetic-art.py --home-source itch-assets/cosmetics/solar-foundry-home-source.png --home-portrait-source itch-assets/cosmetics/solar-foundry-home-portrait-source.png --home-portrait-quality-offset -10 --gate-source itch-assets/cosmetics/solar-foundry-gate-landscape-source.png --gate-portrait-source itch-assets/cosmetics/solar-foundry-gate-source.png --output public/art/cosmetics/solar-foundry
```

## Lunar Garden and Eclipse Sovereign cosmetic scenes

Source masters:

- `itch-assets/cosmetics/lunar-garden-home-source.png`
- `itch-assets/cosmetics/lunar-garden-home-portrait-source.png`
- `itch-assets/cosmetics/lunar-garden-gate-source.png`
- `itch-assets/cosmetics/lunar-garden-gate-landscape-source.png`
- `itch-assets/cosmetics/eclipse-sovereign-home-source.png`
- `itch-assets/cosmetics/eclipse-sovereign-home-portrait-source.png`
- `itch-assets/cosmetics/eclipse-sovereign-gate-source.png`
- `itch-assets/cosmetics/eclipse-sovereign-gate-landscape-source.png`

Approved source dimensions:

- Lunar Garden: Home `1672×941`, portrait Home `1086×1448`, Gate `941×1672`.
- Eclipse Sovereign: Home `1672×941`, portrait Home `864×1821`, Gate `941×1672`.

Runtime files:

- `public/art/cosmetics/lunar-garden/{home,gate}-{sm,md,lg}.webp`
- `public/art/cosmetics/eclipse-sovereign/{home,gate}-{sm,md,lg}.webp`

- Created: 2026-07-27
- Updated: 2026-07-29 with dedicated landscape Gate companion masters
- Method: OpenAI built-in image generation, followed by reference-guided Gate orientation recomposition and deterministic crop-safe, quality-controlled WebP export with `scripts/build-cosmetic-art.py`; mobile Home and desktop Gate variants use dedicated orientation masters
- Reference image: each 2026-07-29 landscape Gate master used its matching portrait Gate and Home master as visual-identity references
- Named artist or living-artist imitation: none
- Embedded text, logo, or third-party mark: none
- Intended use: optional responsive Home Scene and opening Gate Style cosmetics; no gameplay information or competitive advantage is encoded in the artwork

Final prompt set:

> Lunar Garden — Home Scene: Create a production-ready wide background master for a premium indie word game's home/menu scene. Collection: “Lunar Garden.” A moonlit celestial conservatory floating in deep space, built from moonstone terraces and graceful silverleaf arches. Jade fireflies and tiny star motes drift around lilac and teal night blooms; pale lunar pools, delicate vines, and restrained constellation tracery enrich the outer edges. Preserve a calm, dark, low-detail central safe area for the existing title, menu copy, and primary action. Refined handcrafted painterly cinematic concept art, serene and luxurious, never cute or cluttered. No people, creatures, readable text, letters, icons, logo, watermark, frame, or UI mockup. Wide 16:9 composition, crop-safe for desktop derivatives, edge-to-edge environment art.

> Lunar Garden — Portrait Home Scene: Recompose the same Lunar Garden environment as a tall mobile background. Keep a generous dark reading corridor through the center and upper middle, with silverleaf arches, moonstone terraces, jade fireflies, and lilac night blooms framing the sides and lower edge. Match the wide master's moonlit palette and handcrafted cinematic finish. No people, creatures, readable text, letters, icons, logo, watermark, frame, or UI mockup. Tall 3:4 composition designed for a `960×1280` crop.

> Lunar Garden — Gate Style: Create a production-ready tall opening-door background master for a premium indie word game. Collection: “Lunar Garden.” A symmetrical pair of moon-garden arbor doors viewed straight on and designed to split precisely at the vertical center. Moonstone, silverleaf filigree, jade-lit glass channels, lilac night blooms, and subtle celestial vine engravings create a serene enchanted conservatory. Give the doors a strong center seam, balanced left/right visual weight, and a relatively dark upper center for the Constellore mark. Handcrafted painterly cinematic concept art. No people, creatures, readable text, letters, logo, watermark, or UI mockup. Tall 9:16 composition, crop-safe enough to derive landscape door variants.

> Eclipse Sovereign — Home Scene: Create a production-ready wide background master for the most prestigious cosmetic kit in a premium indie word game. Collection: “Eclipse Sovereign.” A black-opal sovereign observatory at the edge of an event horizon, framed by a champagne-gold corona, restrained violet gravitational arcs, dark faceted celestial architecture, and a few luminous orbit jewels. Design the edges as a dramatic full-shell frame while preserving a calm, near-black central safe area for readable menu content and one primary action. Monumental, refined, rare, and cinematic rather than noisy or horror-themed. No people, creatures, throne figure, readable text, letters, icons, logo, watermark, or UI mockup. Wide 16:9 composition, crop-safe for desktop derivatives, edge-to-edge environment art.

> Eclipse Sovereign — Portrait Home Scene: Portrait mobile companion to Eclipse Sovereign: the same obsidian, gold, and violet court, with the eclipse high in the center, ornate detail concentrated at the edges and lower corners, and a broad dark center safe area. No text, UI, people, logos, or watermark.

> Eclipse Sovereign — Gate Style: Create a production-ready tall opening-door background master for a premium indie word game. Collection: “Eclipse Sovereign.” A symmetrical pair of monumental black-opal doors viewed straight on and designed to split precisely at the vertical center. A champagne-gold event-horizon crown, violet gravitational lensing, faceted sovereign borders, and restrained orbit-jewel accents converge on a clear central seam. Keep the upper center dark enough for a logo overlay while making both halves feel like the entrance to the game's rarest observatory. Handcrafted painterly cinematic concept art. No people, creatures, readable text, letters, logo, watermark, or UI mockup. Tall 9:16 composition, crop-safe enough to derive landscape door variants.

The responsive derivatives use fixed crop targets: Home `960×1280`, `1920×1080`, and `2560×1440`; Gate `1080×1920`, `1920×1080`, and `2560×1440`. Dedicated portrait masters are used only for `home-sm.webp`; the taller Eclipse portrait uses a deterministic `0.15` vertical crop focus to preserve its high eclipse. No generative fill or additional synthetic content was introduced after generation.

Reproduction commands:

```powershell
python scripts/build-cosmetic-art.py --home-source itch-assets/cosmetics/lunar-garden-home-source.png --home-portrait-source itch-assets/cosmetics/lunar-garden-home-portrait-source.png --gate-source itch-assets/cosmetics/lunar-garden-gate-landscape-source.png --gate-portrait-source itch-assets/cosmetics/lunar-garden-gate-source.png --gate-landscape-quality-offset -5 --output public/art/cosmetics/lunar-garden
python scripts/build-cosmetic-art.py --home-source itch-assets/cosmetics/eclipse-sovereign-home-source.png --home-portrait-source itch-assets/cosmetics/eclipse-sovereign-home-portrait-source.png --home-portrait-center-y 0.15 --gate-source itch-assets/cosmetics/eclipse-sovereign-gate-landscape-source.png --gate-portrait-source itch-assets/cosmetics/eclipse-sovereign-gate-source.png --gate-landscape-quality-offset -26 --output public/art/cosmetics/eclipse-sovereign
```

## Pixel Frontier, Bubble Reef, and Stellar Vanguard cosmetic scenes

Source masters:

- `itch-assets/cosmetics/pixel-frontier-home-source.png`
- `itch-assets/cosmetics/pixel-frontier-home-portrait-source.png`
- `itch-assets/cosmetics/pixel-frontier-gate-source.png`
- `itch-assets/cosmetics/pixel-frontier-gate-portrait-source.png`
- `itch-assets/cosmetics/bubble-reef-home-source.png`
- `itch-assets/cosmetics/bubble-reef-home-portrait-source.png`
- `itch-assets/cosmetics/bubble-reef-gate-source.png`
- `itch-assets/cosmetics/bubble-reef-gate-portrait-source.png`
- `itch-assets/cosmetics/stellar-vanguard-home-source.png`
- `itch-assets/cosmetics/stellar-vanguard-home-portrait-source.png`
- `itch-assets/cosmetics/stellar-vanguard-gate-source.png`
- `itch-assets/cosmetics/stellar-vanguard-gate-portrait-source.png`

Approved source dimensions:

- Pixel Frontier: Home and Gate `1672×941`.
- Bubble Reef: Home and landscape Gate `1672×941`; dedicated portrait Gate `941×1672`.
- Stellar Vanguard: Home and Gate `1672×941`.

Runtime files:

- `public/art/cosmetics/pixel-frontier/{home,gate}-{sm,md,lg}.webp`
- `public/art/cosmetics/bubble-reef/{home,gate}-{sm,md,lg}.webp`
- `public/art/cosmetics/stellar-vanguard/{home,gate}-{sm,md,lg}.webp`

- Created: 2026-07-28
- Mode: OpenAI built-in image generation
- Updated: 2026-07-29 with dedicated portrait Home masters and portrait Gate masters for Pixel Frontier and Stellar Vanguard
- Method: original bitmap generation followed by reference-guided orientation recomposition and deterministic crop-safe, quality-controlled WebP export with `scripts/build-cosmetic-art.py`; Pixel Frontier uses nearest-neighbor resampling to retain hard pixel edges, and every mobile Home/Gate output now uses a dedicated portrait master
- Reference image: each 2026-07-29 portrait companion used its matching landscape master as the visual-identity reference; Bubble Reef Home also used its portrait Gate for mobile composition guidance
- Named artist or living-artist imitation: none
- Embedded text, logo, character, franchise symbol, or third-party mark: none
- Intended use: optional responsive Home Scene and opening Gate Style cosmetics; no gameplay information or competitive advantage is encoded in the artwork

Final prompt set:

> Pixel Frontier — Home Scene: Create a polished original game cosmetic background for a word-combination game, kit name “Pixel Frontier”. Wide 16:9 landscape scene, exact crisp 16-bit-era pixel art aesthetic with deliberately clustered pixels, limited jewel-tone palette, no anti-aliased painterly edges. A cozy cosmic observatory built from chunky pixel tiles sits on a tiny floating asteroid; deep navy space, blocky nebula clouds, small pixel planets, a cyan-and-gold orbital gate at the center distance, readable silhouettes, warm amber windows. Premium modern composition while unmistakably retro. Keep the central 45% visually calm and high-contrast enough for overlaid game menus; important architecture and focal planet must remain inside the central third so portrait crops still work. No text, no letters, no logos, no existing game/franchise characters, no copyrighted iconography, no UI, no border, no watermark.

> Pixel Frontier — Gate Style: Create a second polished original background for the same “Pixel Frontier” cosmetic kit in a word-combination game. Wide 16:9 landscape, authentic crisp 16-bit pixel art with deliberate pixel clusters and a limited navy, cyan, violet, and amber palette. A monumental round cosmic gate fills the central third, built from chunky pixel-stone and brass tiles, opening onto a scrolling star tunnel; stepped asteroid causeway leads toward it, tiny blocky comets and pixel sparks provide motion. Symmetrical, dramatic level-entry composition, premium retro RPG atmosphere, readable silhouettes. Keep the complete gate and causeway safely centered so both landscape and tall portrait crops work. No text, letters, logos, copyrighted characters, recognizable franchise symbols, UI, border, or watermark.

> Bubble Reef — Home Scene: Create a polished original game cosmetic background for a word-combination game, kit name “Bubble Reef”. Wide 16:9 underwater cartoon world with a joyful hand-painted storybook look: rounded coral cottages shaped like shells and seedpods, smiling visual energy but absolutely no characters, turquoise water, lavender coral fans, mango-orange anemones, pearly bubbles, shafts of sunlight, tiny schools of abstract fish silhouettes, a whimsical bubble-powered observatory. Premium colorful children-and-family animation mood, clean shapes and rich texture, original design language. Keep the central 45% relatively calm and readable for overlaid menus; keep major architecture within the central third for portrait crops. No sponge characters, no pineapple house, no recognizable franchise objects, no text, letters, logos, UI, border, or watermark.

> Bubble Reef — Portrait Gate Style: Create a second polished original background for the “Bubble Reef” cosmetic kit in a word-combination game. Wide 16:9 underwater cartoon level-entry scene, joyful high-end storybook animation style. A giant perfectly round portal made from layered pearly shells, coral branches, and translucent bubbles fills the central third; inside is a luminous spiraling current in aqua and violet. A sandy reef path leads directly to it, flanked by orange anemones and lavender fan coral, with floating bubbles and soft sunbeams suggesting motion. Symmetrical, celebratory, readable, and composed so the full portal remains visible in a tall portrait crop. Original design only. No sponge character, pineapple, tiki franchise motifs, recognizable copyrighted objects, text, letters, logos, UI, border, or watermark.

> Bubble Reef — Landscape Gate Style: HORIZONTAL PANORAMIC 16:9 IMAGE, width much greater than height. Create a polished original “Bubble Reef” game gate background in a joyful high-end underwater storybook animation style. A giant perfectly round portal made from layered pearly shells, coral branches, and translucent bubbles fills the CENTER of the horizontal frame; inside is a luminous spiraling current in aqua and violet. A sandy reef path leads toward it from the bottom center, with orange anemones and lavender fan coral framing the left and right edges, floating bubbles and soft sunbeams. Symmetrical, celebratory, readable. Original design only. No sponge character, pineapple, tiki franchise motifs, recognizable copyrighted objects, text, letters, logos, UI, border, or watermark.

> Stellar Vanguard — Home Scene: Create a polished original game cosmetic background for a word-combination game, kit name “Stellar Vanguard”. Wide 16:9 cinematic space-opera landscape with grand scale and entirely original design language. View from an angular obsidian-and-bronze orbital sanctuary above a luminous blue-gold gas giant; distant ring habitats, elegant abstract crescent spacecraft with no resemblance to any known franchise, violet ion trails, warm beacon lights, vast star clouds. Heroic, mysterious, premium, high contrast, painterly photoreal concept-art finish. Keep the central 45% relatively calm for overlaid game menus and keep major architecture inside the central third for portrait crops. No people or characters, no laser swords, no familiar helmets, no famous ships, no franchise insignia, no text, letters, logos, UI, border, or watermark.

> Stellar Vanguard — Gate Style: Create a second polished original background for the “Stellar Vanguard” cosmetic kit in a word-combination game. Wide 16:9 cinematic space-opera level-entry scene with entirely original architecture. A colossal circular star gate of obsidian, bronze, and floating geometric segments fills the central third, suspended over a dark alien moon; its center opens into a radiant blue-white singularity with restrained violet energy, while a broad ceremonial causeway leads toward it. Distant gas giant and minimal crescent craft silhouettes provide scale. Epic, solemn, premium, painterly photoreal concept-art finish, strong centered symmetry, complete gate safe for a tall portrait crop. No people, no laser swords, no familiar helmets, no famous ships, no franchise emblems, no recognizable copyrighted design, no text, letters, logos, UI, border, or watermark.

The responsive derivatives use fixed crop targets: Home `960×1280`, `1920×1080`, and `2560×1440`; Gate `1080×1920`, `1920×1080`, and `2560×1440`. Bubble Reef's portrait master is used only for `gate-sm.webp`. Detailed Bubble Reef and Stellar Vanguard masters use deterministic quality offsets of `-12` and `-10`; Pixel Frontier uses the default quality values with explicit nearest-neighbor resampling. No generative fill or additional synthetic content was introduced after generation.

Reproduction commands:

```powershell
python scripts/build-cosmetic-art.py --home-source itch-assets/cosmetics/pixel-frontier-home-source.png --home-portrait-source itch-assets/cosmetics/pixel-frontier-home-portrait-source.png --home-portrait-quality-offset -2 --gate-source itch-assets/cosmetics/pixel-frontier-gate-source.png --gate-portrait-source itch-assets/cosmetics/pixel-frontier-gate-portrait-source.png --pixelated --output public/art/cosmetics/pixel-frontier
python scripts/build-cosmetic-art.py --home-source itch-assets/cosmetics/bubble-reef-home-source.png --home-portrait-source itch-assets/cosmetics/bubble-reef-home-portrait-source.png --home-portrait-quality-offset -21 --gate-source itch-assets/cosmetics/bubble-reef-gate-source.png --gate-portrait-source itch-assets/cosmetics/bubble-reef-gate-portrait-source.png --quality-offset -12 --output public/art/cosmetics/bubble-reef
python scripts/build-cosmetic-art.py --home-source itch-assets/cosmetics/stellar-vanguard-home-source.png --home-portrait-source itch-assets/cosmetics/stellar-vanguard-home-portrait-source.png --gate-source itch-assets/cosmetics/stellar-vanguard-gate-source.png --gate-portrait-source itch-assets/cosmetics/stellar-vanguard-gate-portrait-source.png --quality-offset -10 --output public/art/cosmetics/stellar-vanguard
```

## Dedicated responsive companion generation pass

- Created: 2026-07-29
- Mode: OpenAI built-in image generation, one reference-guided recomposition per new master
- Output dimensions: portrait masters `941×1672`; landscape masters `1672×941`
- Post-generation processing: deterministic crop-safe resize and WebP encoding only; no generative fill was applied after master creation
- Reference policy: each companion used the existing scene from the same kit as its primary visual-identity reference
- Content constraints for every prompt: original background art only; no readable text, letters, numbers, logos, watermark, UI, people, characters, or recognizable franchise motifs

Final prompt summaries:

- Aurora Archive portrait Home: recompose the frostglass observatory-library as a native 9:16 mobile scene, with tall crystal shelves and aurora ribbons framing a broad dark central reading corridor.
- Aurora Archive landscape Gate: recompose the crystalline archive doors as a straight-on 16:9 closed double gate with exact center seam, mirrored visual weight, complete side architecture, and a dark upper-center logo-safe area.
- Solar Foundry portrait Home: recompose the brass orrery foundry as a native 9:16 mobile scene, keeping celestial instruments at the edges and lower quarter around a calm ink-dark menu corridor.
- Solar Foundry landscape Gate: recompose the lacquered brass foundry doors as a native 16:9 closed double gate, with the solar orrery split precisely by the center seam and restrained amber channels.
- Lunar Garden landscape Gate: recompose the moonstone conservatory doors as a native 16:9 closed gate, with bilateral silverleaf arches, lunar medallions, lotus light, and a quiet dark center.
- Eclipse Sovereign landscape Gate: recompose the obsidian-and-amethyst sovereign doors as a native 16:9 closed gate, with a centered crowned eclipse bisected by the opening seam and crop-safe violet crystal architecture.
- Pixel Frontier portrait Home: recompose the crisp pixel-art observatory and its secondary orbital gate as a native 9:16 scene, preserving deliberate pixel clusters and a calm dark central column.
- Pixel Frontier portrait Gate: recompose the complete pixel-stone warp ring and long stepped asteroid causeway as a native 9:16, centered and symmetrical mobile entrance.
- Bubble Reef portrait Home: recompose the shell observatory village as a native 9:16 underwater scene, placing observatories and coral at the lower sides around an uninterrupted aqua menu corridor.
- Stellar Vanguard portrait Home: recompose the obsidian-and-bronze orbital sanctuary as a native 9:16 scene, with the gas-giant horizon low, tall structural ribs at the sides, and open starfield through the center.
- Stellar Vanguard portrait Gate: recompose the complete segmented meridian ring and ceremonial causeway as a native 9:16 scene, centered above an alien moon with restrained blue-violet singularity light.
