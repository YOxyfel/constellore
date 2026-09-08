# Third-party notices

Constellore's shipped browser runtime is implemented with web-platform and Node.js APIs and does not bundle a third-party runtime framework.

Development and automated testing use:

- `@playwright/test`, Copyright Microsoft Corporation, licensed under the Apache License 2.0. This development dependency and its license are available from the installed npm package and the [Playwright repository](https://github.com/microsoft/playwright).
- `@axe-core/playwright` and `axe-core`, Copyright Deque Systems, Inc., licensed under the Mozilla Public License 2.0. These are development-only accessibility testing dependencies and are not shipped in the game runtime.

The release self-hosts these interface fonts so the game remains consistent and fully offline:

- Manrope, Copyright 2018 The Manrope Project Authors, licensed under the SIL Open Font License 1.1. The full license ships at `public/fonts/OFL-Manrope.txt`.
- DM Mono, Copyright 2020 The DM Mono Project Authors, licensed under the SIL Open Font License 1.1. The full license ships at `public/fonts/OFL-DM-Mono.txt`.

No remote font service is contacted at runtime. Common system fonts remain available as fallbacks.

The shipped soundtrack and sound effects are original, sample-free procedural synthesis. NumPy and ffmpeg/libmp3lame are used only as offline asset-generation tools and are not redistributed in the browser runtime. Reproduction details and measured delivery formats are recorded in `AUDIO_ASSET_PROVENANCE.md`.

The optional Living Planet Home Hub includes these Creative Commons Attribution 4.0 globe models:

- **Earth** by [AirStudios](https://sketchfab.com/sebbe613), from the [Sketchfab source model](https://sketchfab.com/3d-models/earth-5f9c35be31a047928eace8b415a8ee3a), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The release modifies geometry, textures, scale, orientation, and materials for browser delivery.
- **Moon** by [matousekfoto](https://sketchfab.com/matousekfoto), from the [Sketchfab source model](https://sketchfab.com/3d-models/moon-5a917c638c1344d7af7e34e5d4122f72), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The release modifies geometry, textures, scale, orientation, and materials for browser delivery.
- **Sun** by [SebastianSosnowski](https://sketchfab.com/SebastianSosnowski), from the [Sketchfab source model](https://sketchfab.com/3d-models/sun-9ef1c68fbb944147bcfcc891d3912645), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The release selects the authored core and modifies geometry, textures, scale, orientation, and materials for browser delivery.

Three.js 0.185.1 and GLTFLoader are shipped locally in the optional planet-hub runtime under the MIT License, Copyright © 2010-2026 three.js authors. The vendored files are reproduced from the pinned `three` npm package; no CDN is contacted.

The planet-hub build also uses glTF Transform 4.4.2, Meshoptimizer 1.2.0, Pillow 12.1.0, FFmpeg, and esbuild 0.25.8 as pinned offline preparation tools. They are not redistributed as executable browser dependencies. Commercial-use provenance for the project-owner-supplied Tripo landmarks and Portal VFX sources is recorded in `PLANET_HUB_ASSET_PROVENANCE.json`; public packaging verifies this gate before release.

The Cosmic Gate quote collection includes short excerpts from public-domain historical texts, shown with author attribution in the game. Source details are stored with each line in `public/cosmic-quotes.mjs`:

- William Shakespeare, *Hamlet* (Project Gutenberg).
- William Blake, *Auguries of Innocence* (Poetry Foundation text).
- Oscar Wilde, *The Picture of Dorian Gray* (Project Gutenberg).
- Isaac Newton, letter to Robert Hooke dated 5 February 1676 (Linda Hall Library transcription).
- Walt Whitman, *Leaves of Grass* (Project Gutenberg).
- John Muir, *John of the Mountains* (U.S. National Park Service archive).
- Ralph Waldo Emerson, *Nature* (Project Gutenberg).
- Marcus Aurelius, *Meditations*, George Long translation (Project Gutenberg).

This notice must be re-audited before every commercial release and whenever a new dependency, SDK, font, sound, image, platform wrapper, analytics provider, advertising provider, or payment provider is added.
