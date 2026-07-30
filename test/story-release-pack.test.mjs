import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const STORY_FILES = [
  "story/combination-story.mjs",
  "story/combination-story-view.mjs",
  "story/combination-story-runtime.mjs",
  "story/combination-story.css"
];

test("the optional story pack declares every required source artifact", async () => {
  for (const path of STORY_FILES) {
    assert.ok((await stat(projectFile(`public/${path}`))).size > 0, `${path} is missing or empty.`);
  }
});

test("Pages recursively transforms story assets without adding them to the shell", async () => {
  const source = await readFile(projectFile("scripts/build-pages.mjs"), "utf8");
  assert.match(source, /for \(const name of await listRelativeFiles\(storySource\)\)/);
  assert.match(source, /mkdir\(dirname\(destination\), \{ recursive: true \}\)/);
  assert.match(source, /withAssetVersion\(await readFile\(source, "utf8"\), release[.]version\)/);
  assert.match(source, /minifyCss\(await readFile\(source, "utf8"\)\)/);
  assert.match(source, /!name[.]startsWith\("story\/"\)/);
  assert.match(source, /lazyAssets: \[[^\]]*"[.]\/story\/"/);
});

test("server release sync versions nested story modules and keeps the pack lazy", async () => {
  const source = await readFile(projectFile("scripts/sync-public-release.mjs"), "utf8");
  assert.match(source, /listRelativeFiles\(storyDirectory\)/);
  assert.match(source, /if \(\/\\[.]\(\?:js\|mjs\)\$\/[.]test\(name\)\)/);
  assert.match(source, /withAssetVersion\(await readFile\(path, "utf8"\), pkg[.]version\)/);
  assert.match(source, /!name[.]startsWith\("story\/"\)/);
  assert.match(source, /lazyAssets: \[[^\]]*"\/story\/"/);
});

test("artifact verifiers and performance accounting declare the optional pack boundary", async () => {
  const [pages, itch, budget] = await Promise.all([
    readFile(projectFile("scripts/verify-pages-build.mjs"), "utf8"),
    readFile(projectFile("scripts/verify-itch-build.mjs"), "utf8"),
    readFile(projectFile("scripts/check-performance-budget.mjs"), "utf8")
  ]);
  for (const path of STORY_FILES) {
    assert.ok(pages.includes(`"${path}"`), `Pages verifier does not require ${path}.`);
    assert.ok(itch.includes(`"${path}"`), `itch verifier does not require ${path}.`);
    assert.ok(budget.includes(`"play/${path}"`), `Performance audit does not require ${path}.`);
  }
  for (const verifier of [pages, itch]) {
    assert.match(verifier, /doesNotMatch\([^,]+, \/story\\\//);
    assert.ok(
      verifier.includes("const LAZY_PREFIXES = [^;]*[.]\\/story\\/"),
      "Artifact verifier does not require the story lazy-runtime prefix."
    );
  }
  assert.match(budget, /STORY_PACK_MAXIMUM_BYTES = 40_000/);
  assert.match(budget, /!record[.]path[.]startsWith\("play\/story\/"\)/);
  assert.match(budget, /\+ STORY_PACK_MAXIMUM_BYTES/);
});
