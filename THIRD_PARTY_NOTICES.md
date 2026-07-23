# Third-party notices

Constellore's shipped browser runtime is implemented with web-platform and Node.js APIs and does not bundle a third-party runtime framework.

Development and automated testing use:

- `@playwright/test`, Copyright Microsoft Corporation, licensed under the Apache License 2.0. This development dependency and its license are available from the installed npm package and the [Playwright repository](https://github.com/microsoft/playwright).
- `@axe-core/playwright` and `axe-core`, Copyright Deque Systems, Inc., licensed under the Mozilla Public License 2.0. These are development-only accessibility testing dependencies and are not shipped in the game runtime.

The CSS font stacks name common system fonts as optional fallbacks; no remote font file is fetched or redistributed by the release package.

This notice must be re-audited before every commercial release and whenever a new dependency, SDK, font, sound, image, platform wrapper, analytics provider, advertising provider, or payment provider is added.
