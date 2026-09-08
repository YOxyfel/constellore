import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [html, app, css, scrambleCss, shellRuntime, orbitRuntime, orbitCss] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  Promise.all([
    readFile(new URL("../public/simple-ui.css", import.meta.url), "utf8"),
    readFile(new URL("../public/mobile-play-shell.css", import.meta.url), "utf8")
  ]).then((parts) => parts.join("\n")),
  readFile(new URL("../public/scramble.css", import.meta.url), "utf8"),
  readFile(new URL("../public/mobile-play-shell-runtime.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/word-orbit-runtime.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/word-orbit.css", import.meta.url), "utf8")
]);

function occurrences(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function cssBlock(source, selector) {
  const escaped = selector.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
  return source.match(new RegExp(escaped + "\\s*\\{([^}]*)\\}", "s"))?.[1] || "";
}

test("the mobile shell exposes one stable hook for every disclosure", () => {
  const ids = [
    "gameScreen",
    "mobileToolsToggle",
    "mobileToolsPanel",
    "mobileAssistToggle",
    "boardAssistanceRail",
    "playSoundDisclosure",
    "playSoundToggle",
    "playSoundPanel",
    "inventoryDrawerToggle",
    "inventoryDrawerBody",
    "wordList"
  ];
  for (const id of ids) {
    assert.equal(
      occurrences(html, new RegExp('id="' + id + '"', "g")),
      1,
      "#" + id + " must remain unique"
    );
  }

  const root = html.match(/<section class="game-screen" id="gameScreen"[^>]*>/)?.[0] || "";
  assert.match(root, /data-play-layout="wide"/);
  assert.match(root, /data-play-phase="normal"/);
  assert.match(root, /data-mobile-surface="none"/);
  assert.match(root, /data-inventory-expanded="false"/);
  assert.match(html, /id="mobileToolsToggle"[^>]*aria-expanded="false"[^>]*aria-controls="mobileToolsPanel"/);
  assert.match(html, /id="mobileAssistToggle"[^>]*aria-expanded="false"[^>]*aria-controls="boardAssistanceRail"/);
  assert.match(html, /<details[^>]*id="playSoundDisclosure"[\s\S]*?<summary[^>]*id="playSoundToggle"[^>]*aria-controls="playSoundPanel"/);
  assert.match(html, /id="inventoryDrawerToggle"[^>]*aria-expanded="false"[^>]*aria-controls="inventoryDrawerBody"/);
});

test("the app maps game modes to phases and wires one exclusive mobile controller", () => {
  assert.match(app, /import\s*\{[^}]*bindMobilePlayShell[^}]*\}\s*from\s*"\.\/mobile-play-shell-runtime\.mjs/);
  assert.match(app, /state\.mode\s*===\s*"scramble"\)\s*return\s*"scramble"/);
  assert.match(app, /\["training",\s*"second-orbit"\]\.includes\(state\.mode\)\)\s*return\s*"tutorial"/);
  assert.match(app, /state\.reveal\?\.(?:active|pending)[\s\S]*return\s*"reveal"/);
  assert.match(shellRuntime, /surfaces:\s*\{[\s\S]*tools:\s*\{[\s\S]*assistance:\s*\{[\s\S]*sound:\s*\{/);
  assert.match(shellRuntime, /controller\.toggleSurface\("tools"/);
  assert.match(shellRuntime, /controller\.toggleSurface\("assistance"/);
  assert.match(shellRuntime, /controller\.toggleSurface\("sound"/);
  assert.match(orbitRuntime, /view\.lensOpen\) onCloseLens\?\.\(\{ reason: "bloom"/);
  assert.match(orbitRuntime, /let stage = "closed"/);
  assert.match(app, /mobilePlayChrome\.closeSurface\(\{\s*restoreFocus:\s*true,\s*reason:\s*"escape"\s*\}\)/);
  assert.match(app, /schedulePlayableBoardRefresh\(\{\s*cancelGestures:\s*true/);
});

test("tutorial, Explore, Reveal, cinematic, and Scramble have explicit compact visibility rules", () => {
  assert.match(css, /\[data-play-phase="tutorial"\]/);
  assert.match(css, /\.explore-orbit/);
  assert.match(css, /\[data-play-phase="reveal"\]/);
  assert.match(css, /\[data-play-phase="cinematic"\]/);
  assert.match(css, /\.scramble-orbit/);
  assert.match(css, /#firstOrbitGuide/);
  assert.match(css, /#revealController/);
  assert.match(scrambleCss, /data-play-layout="short-landscape"/);
  assert.match(scrambleCss, /#playVolumeControl/);
  assert.match(scrambleCss, /#pauseRunButton/);
});

test("compact shell controls retain a 44px target and reduced motion removes drawer travel", () => {
  assert.match(css, /--play-shell-hit:\s*44px/);
  const pause = cssBlock(
    css,
    'body.simple-ui #gameScreen[data-play-layout="short-landscape"] .game-nav > .pause-run-button'
  );
  assert.ok(pause, "short-landscape Menu rule must exist");
  assert.doesNotMatch(pause, /(?:min-)?height:\s*(?:3\d|4[0-3])px/);
  assert.match(pause, /(?:min-)?height:\s*(?:var\(--play-shell-hit\)|4[4-9]px|[5-9]\dpx)/);

  const reducedMotion = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/g)?.at(-1) || "";
  assert.match(reducedMotion, /\.inventory/);
  assert.match(reducedMotion, /\.game-layout/);
  assert.match(reducedMotion, /#inventoryDrawerToggle/);
  assert.match(reducedMotion, /transition:\s*none/);
});

test("compact pause metadata cannot squeeze the mission target", () => {
  assert.match(app, /filter\(Boolean\)\.join\(" \\u00b7 "\)/);
  assert.match(css, /:has\(#gameScreen:is\(\[data-play-layout="stacked"\], \[data-play-layout="short-landscape"\]\):not\(\[hidden\]\)\) \.pause-target\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\)/s);
  assert.match(css, /#pauseTarget\s*\{[^}]*grid-column:\s*2[^}]*overflow-wrap:\s*anywhere[^}]*white-space:\s*normal/s);
  assert.match(css, /#pauseMode\s*\{[^}]*grid-column:\s*1 \/ -1[^}]*grid-row:\s*2/s);
});

test("the phone tutorial coachmark stays compact without shrinking its Exit target", () => {
  assert.match(css, /\[data-play-layout="stacked"\] #firstOrbitGuide\s*\{[^}]*width:\s*min\(296px[^}]*max-height:\s*min\(160px[^}]*padding:\s*8px 10px 9px/s);
  assert.match(css, /#firstOrbitStep\s*\{\s*display:\s*none !important/s);
  assert.match(css, /#firstOrbitInstruction\s*\{[^}]*font-size:\s*15px[^}]*white-space:\s*nowrap/s);
  assert.match(css, /#skipFirstOrbit\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s);
});

test("the Constellation Bloom removes the permanent phone shelf", () => {
  assert.match(orbitCss, /data-play-layout="stacked"[\s\S]*\.game-layout[\s\S]*grid-template:\s*minmax\(0, 1fr\) \/ minmax\(0, 1fr\) !important/);
  assert.match(orbitCss, /data-play-layout="short-landscape"[\s\S]*\.inventory\s*\{\s*display:\s*none !important/);
  assert.match(orbitCss, /\.constellation-bloom__start\s*\{[\s\S]*pointer-events:\s*auto[\s\S]*touch-action:\s*none/);
  assert.match(orbitRuntime, /boundedWordBloomWindow/);
});

test("desktop Shift and Control notices keep announcements but lose their phone banner", () => {
  assert.match(app, /els\.alchemyNote\.dataset\.noticeKind\s*=\s*notice\.key/);
  assert.match(app, /delete els\.alchemyNote\.dataset\.noticeKind/);
  assert.match(css, /#alchemyNote\[data-notice-kind="gesture"\]\s*\{\s*display:\s*none !important/s);
});
