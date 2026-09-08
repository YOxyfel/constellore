import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const BIRTHDAY_VIDEO_PATH = "cinematic/lion-intro-birthday.mp4";

function declaredPaths(source, name) {
  return source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`))?.[1] || "";
}

test("Birthday Voyage video stays outside the launch cinematic budget", async () => {
  const [budget, itch, video] = await Promise.all([
    readFile(projectFile("scripts/check-performance-budget.mjs"), "utf8"),
    readFile(projectFile("scripts/verify-itch-build.mjs"), "utf8"),
    stat(projectFile(`public/${BIRTHDAY_VIDEO_PATH}`))
  ]);

  assert.ok(video.size > 0 && video.size <= 4_000_000);
  for (const source of [budget, itch]) {
    assert.doesNotMatch(declaredPaths(source, "CINEMATIC_PACK_PATHS"), /lion-intro-birthday/);
    assert.doesNotMatch(declaredPaths(source, "CINEMATIC_VIDEO_PATHS"), /lion-intro-birthday/);
    assert.match(declaredPaths(source, "BIRTHDAY_VOYAGE_VIDEO_PATHS"), /lion-intro-birthday[.]mp4/);
    assert.match(source, /BIRTHDAY_VOYAGE_VIDEO_PACK_MAXIMUM_BYTES = 4_000_000/);
  }
  assert.match(budget, /BIRTHDAY_VOYAGE_PACK_MAXIMUM_BYTES = 10_000_000/);
  assert.match(budget, /\+ BIRTHDAY_VOYAGE_PACK_MAXIMUM_BYTES/);
  assert.doesNotMatch(budget, /\+ BIRTHDAY_VOYAGE_VIDEO_PACK_MAXIMUM_BYTES/);
});
