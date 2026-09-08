import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, styles, runtime, observatory, catalog] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/cosmic-gate.css", import.meta.url), "utf8"),
  readFile(new URL("../public/cosmic-gate.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/cosmetics-observatory.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/cosmetic-catalog.mjs", import.meta.url), "utf8")
]);

test("the global transition is a Constellation Fold with no physical door halves", () => {
  const fold = html.match(/<div id="cosmicGate"[\s\S]*?<\/div>\s*<noscript>/)?.[0] || "";
  assert.match(fold, /cosmic-gate__fold/);
  assert.match(fold, /cosmic-gate__world-threads/);
  assert.match(fold, /cosmic-gate__constellation-lines/);
  assert.match(fold, /cosmic-gate__lens/);
  assert.doesNotMatch(fold, /cosmic-gate__door|cosmic-door/);
  assert.doesNotMatch(styles, /cosmic-gate__door|cosmic-door/);
});

test("the Fold owns synchronized cover and reveal timing with accessible fallbacks", () => {
  assert.match(styles, /#cosmicGate\[data-kind="enter"\][\s\S]*--gate-close-time:\s*560ms/);
  assert.match(styles, /#cosmicGate\[data-kind="enter"\][\s\S]*--gate-open-time:\s*520ms/);
  assert.match(runtime, /enterClose:\s*560/);
  assert.match(runtime, /enterOpen:\s*520/);
  assert.match(runtime, /waitForFoldTransition/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /@media \(forced-colors:\s*active\)/);
});

test("existing transition cosmetics still influence the procedural Fold", () => {
  assert.match(styles, /background:\s*var\(--cosmic-gate-art\)/);
  assert.match(styles, /#cosmicGate\[data-destination="forge"\]/);
  assert.match(styles, /#cosmicGate\[data-destination="journey"\]/);
  assert.match(styles, /#cosmicGate\[data-destination="arena"\]/);
  assert.match(observatory, /gateStyle:\s*"Worldweave transitions"/);
  assert.match(catalog, /label:\s*"Atlas Starfold"/);
  assert.match(catalog, /tags:\s*\["Supporter", "Worldweave"/);
  assert.match(catalog, /id:\s*"constellore[.]celestial-atlas[.]gate-style[.]atlas-doors"/);
});

test("Home responds to the gathering phase without moving gameplay authority", () => {
  assert.match(runtime, /constellore:worldweave/);
  assert.match(runtime, /semantic:\s*"foldGather"/);
  assert.match(runtime, /semantic:\s*"foldResolve"/);
  assert.match(runtime, /querySelector[?]?[.]\("\[data-planet-hub\]"\)/);
  assert.match(runtime, /dataset[.]worldweavePhase/);
});
