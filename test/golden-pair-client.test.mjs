import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const version = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;

function sourceBetween(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Missing source boundary ${start} -> ${end}`);
  return app.slice(from, to);
}

test("Golden Pair choreography is a prewarmed lazy enhancement rather than shell-blocking media", () => {
  const prepare = sourceBetween("function prepareGoldenPairAnimations", "function resetGoldenPairAnimations");
  assert.match(prepare, new RegExp(`import\\("\\./story/golden-fusions/golden-pair-runtime[.]mjs[?]v=${version.replaceAll(".", "[.]")}"\\)`));
  assert.match(prepare, /createGoldenPairRuntime\(\{[\s\S]*board:\s*els[.]board/);
  assert.match(prepare, /prefers-reduced-motion:\s*reduce/);
  assert.match(prepare, /cosmeticEffects === "reduced"/);
  assert.doesNotMatch(page, /golden-pair(?:-runtime)?[.](?:mjs|css)/);
  assert.doesNotMatch(app.slice(0, app.indexOf("const starterEmoji")), /golden-pair/);
});

test("normal canonical successes identify authored playback after the result anchor for victory handoff", () => {
  const combine = sourceBetween("async function combineNodes", "function expectedPairKey");
  const anchorAt = combine.indexOf("const resultAnchor = measuredNodeAnchor");
  const playAt = combine.indexOf("await playGoldenPairAnimation(a.item, b.item, known)");
  assert.ok(anchorAt >= 0 && playAt > anchorAt);
  assert.match(
    combine,
    /const authoredGoldenPair = !result[.]twisted\s*\?\s*await playGoldenPairAnimation\(a[.]item, b[.]item, known\)\s*:\s*false/
  );
  assert.ok(
    combine.indexOf("const celebrationStartedAt = won ? performance.now() : 0")
      > playAt,
    "the protected victory hold must begin after the Golden Pair scene has started loading and playing"
  );
  assert.match(combine, /finishGame\(true, "", \{[\s\S]*authoredGoldenPair/);
  assert.ok(playAt < combine.indexOf("await recordEventDiscovery(result)"));
});

test("Golden Pair scenes cancel with orbit lifecycle and respect Effects Off", () => {
  const play = sourceBetween("function playGoldenPairAnimation", "function renderCombinationStory");
  const start = sourceBetween("function startWithGameNow", "function pauseMenuAvailable");
  const home = sourceBetween("function returnHome", "async function beginPrimaryOrbit");
  assert.match(play, /cosmeticEffects === "off"\) return/);
  assert.match(play, /generation !== state[.]orbitGeneration/);
  assert.match(play, /els[.]resultDialog[.]open/);
  assert.match(start, /resetGoldenPairAnimations\(\)/);
  assert.match(start, /void prepareGoldenPairAnimations\(\)/);
  assert.match(home, /resetGoldenPairAnimations\(\)/);
});
