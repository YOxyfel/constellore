# Third-party notices

Constellore's shipped browser runtime is implemented with web-platform and Node.js APIs and does not bundle a third-party runtime framework.

Development and automated testing use:

- `@playwright/test`, Copyright Microsoft Corporation, licensed under the Apache License 2.0. This development dependency and its license are available from the installed npm package and the [Playwright repository](https://github.com/microsoft/playwright).
- `@axe-core/playwright` and `axe-core`, Copyright Deque Systems, Inc., licensed under the Mozilla Public License 2.0. These are development-only accessibility testing dependencies and are not shipped in the game runtime.

The CSS font stacks name common system fonts as optional fallbacks; no remote font file is fetched or redistributed by the release package.

The shipped soundtrack and sound effects are original, sample-free procedural synthesis. NumPy and ffmpeg/libmp3lame are used only as offline asset-generation tools and are not redistributed in the browser runtime. Reproduction details and measured delivery formats are recorded in `AUDIO_ASSET_PROVENANCE.md`.

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
