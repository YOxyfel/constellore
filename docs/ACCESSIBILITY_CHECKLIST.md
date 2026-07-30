# Constellore accessibility release checklist

Run this checklist against both a fresh profile and a returning Bronze-or-higher profile. Record the browser, operating system, assistive technology, build ID, and any exception in the release notes.

## Keyboard and focus

- Complete First Orbit, a regular word route, the answer reveal, the memory Star Break, and a Cosmos Circuit Practice Flight without a pointer.
- Confirm every dialog receives meaningful initial focus, traps focus while open, and restores focus to its trigger.
- Confirm Escape never bypasses an all-or-nothing confirmation or dismisses a result before its presentation barrier finishes.
- Confirm the focused element is visible at 200% zoom and at 320 × 568 CSS pixels.
- Confirm Circuit steering works while the flight controller is focused and that Pause/Resume returns focus to the controller.

## Screen reader semantics

- Check the fresh intro, Home, Menu, mission briefing, live board, current hint objective, Pause, result, Observatory, Circuit, and Star Path with NVDA or VoiceOver.
- Confirm every icon-only control has a stable accessible name at every responsive breakpoint.
- Confirm the board announces successful and failed combinations once, in useful order, without reading decorative stars.
- Confirm timers, progress bars, reward quantities, risk warnings, and current Circuit navigation have names and bounded announcement frequency.
- Confirm hidden, inert, and transitioning screens do not remain in the accessibility tree.

## Visual access

- Test browser zoom at 200% and text-only scaling where supported.
- Test Windows High Contrast/forced colors, `prefers-contrast: more`, reduced motion, and reduced data.
- Confirm no horizontal scrolling or clipped labels at 320, 390, 768, 1024, and 1440 CSS pixels.
- Confirm focus, selected, disabled, success, warning, and failure states are not communicated by color alone.
- Confirm story layers, equations, quest guidance, and victory controls never overlap at the shortest supported viewport.

## Audio, motion, and timing

- Confirm persistent Master, Music, and Effects controls are reachable during every level, Pause, and Circuit.
- Confirm mute and channel levels survive navigation and reload without an unexpected loud cue.
- Confirm reduced motion removes travel and camera sweeps while preserving the complete state change.
- Confirm normal-motion celebrations complete before menus or result dialogs become interactive.
- Confirm timed instructions can be paused and that the memory interlude explains its five-second memorization phase before numbers disappear.

## Automated evidence

- Run `npm run check`, `npm run test:coverage`, `npm run build:release`, and `npm run test:e2e`.
- Review axe results on a live board as well as onboarding; do not accept serious or critical violations.
- Review committed screenshot baselines at compact mobile and desktop sizes rather than relying only on DOM geometry assertions.
- Run the offline PWA reload test and a manual update from the previous release.
