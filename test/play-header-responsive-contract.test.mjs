import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const styles = [
  await readFile(new URL("../public/simple-ui.css", import.meta.url), "utf8"),
  await readFile(new URL("../public/mobile-play-shell.css", import.meta.url), "utf8")
].join("\n");
const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");

function mediaSlice(pattern) {
  const match = pattern.exec(styles);
  assert.ok(match, `missing responsive contract ${pattern}`);
  const nextMedia = styles.indexOf("\n@media ", match.index + match[0].length);
  return styles.slice(match.index, nextMedia < 0 ? styles.length : nextMedia);
}

test("the play header gives Menu, objective, and HUD explicit grid ownership", () => {
  assert.match(
    page,
    /<header class="game-nav">[\s\S]*?id="pauseRunButton"[\s\S]*?<div class="game-target">[\s\S]*?<div class="game-hud">[\s\S]*?<\/header>/
  );
  assert.match(styles, /[.]simple-ui (?:[.]game-nav\s*>\s*)?[.]game-target\s*\{[^}]*grid-column:\s*2\b/s);
  assert.match(
    styles,
    /[.]simple-ui (?:[.]game-nav\s*>\s*)?[.]game-hud\s*\{[^}]*grid-column:\s*3\b[^}]*justify-self:\s*end/s
  );
});

test("medium screens compact the objective before it can collide with sound", () => {
  const medium = mediaSlice(
    /@media\s*\(min-width:\s*701px\)\s*and\s*\(max-width:\s*1000px\)\s*\{/
  );
  assert.match(medium, /[.]game-target/);
  assert.match(medium, /(?:max-width|overflow|text-overflow|font-size|display):/);
  assert.match(medium, /(?:#lawPill|[.]path-guard-status)/);
});

test("short tablet landscape bounds the stacked objective and Path Guard copy", () => {
  const medium = mediaSlice(
    /@media\s*\(min-width:\s*701px\)\s*and\s*\(max-width:\s*1000px\)\s*\{/
  );
  assert.match(medium, /[.]game-target\s*>\s*div\s*\{[^}]*overflow:\s*hidden[^}]*flex-direction:\s*column/s);
  assert.match(
    medium,
    /(?:#lawPill|[.]path-guard-status)[^{]*\{[^}]*max-width:\s*100%[^}]*font-size:/s
  );
});

test("local stylesheets revalidate so responsive fixes are not hidden by a stale cache", () => {
  assert.match(server, /locallyMutableStylesheet\s*=\s*process[.]env[.]NODE_ENV\s*!==\s*"production"\s*&&\s*extension\s*===\s*"[.]css"/);
  assert.match(server, /isPlayServiceWorker\s*\|\|\s*locallyMutableStylesheet[\s\S]*?\?\s*"no-cache"/);
});

test("ultra-short landscape overrides the stacked phone shell with one header row and a side shelf", () => {
  const stackedPhone = styles.search(/@media\s*\(max-width:\s*599px\)/);
  const ultraPattern = /@media\s*\(max-width:\s*700px\)\s*and\s*\(max-height:\s*500px\)\s*and\s*\(orientation:\s*landscape\)\s*\{/;
  const ultraMatch = ultraPattern.exec(styles);
  assert.ok(ultraMatch, "missing ultra-short landscape contract");
  assert.ok(ultraMatch.index > stackedPhone, "the one-row override must follow the stacked phone rule in the cascade");

  const ultra = mediaSlice(ultraPattern);
  assert.match(
    ultra,
    /[.]game-nav:has\(#playVolumeControl\)\s*\{[^}]*height:[^;}]+;[^}]*grid-template-rows:\s*(?:1fr|auto|58px)\b/s
  );
  assert.match(ultra, /[.]vplay\s*\{[^}]*position:\s*relative[^}]*inset:\s*auto/s);
  assert.match(
    ultra,
    /[.]game-layout\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\([^}]+\)/s
  );
  assert.match(ultra, /[.]inventory\s*\{[^}]*max-height:\s*none[^}]*border-left:/s);
  assert.match(ultra, /[.]word-list\s*\{[^}]*display:\s*block[^}]*overflow-y:\s*auto/s);
});

test("board tools and route progress share one ordered board-HUD lane", () => {
  assert.match(
    page,
    /<div class="board-top-hud"[^>]*>[\s\S]*?<nav class="board-quick-tools"[^>]*>[\s\S]*?<section class="run-milestone"[^>]*>/
  );
  assert.match(styles, /[.]simple-ui [.]board-quick-tools\s*\{[^}]*position:\s*relative[^}]*width:\s*min\(356px,\s*100%\)/s);
  assert.match(styles, /[.]simple-ui [.]run-milestone\s*\{[^}]*position:\s*relative[^}]*width:\s*min\(580px,\s*100%\)/s);
});
