import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const PROFILE_FRAME_PREVIEW_VIDEO_PATHS = [
  "cinematic/profile-frame-previews/empyrean-ascension.mp4",
  "cinematic/profile-frame-previews/infernal-dominion.mp4"
];

test("profile-frame preview videos stay inside their dedicated 13 MB pack", async () => {
  const [budget, ...metadata] = await Promise.all([
    readFile(projectFile("scripts/check-performance-budget.mjs"), "utf8"),
    ...PROFILE_FRAME_PREVIEW_VIDEO_PATHS.map((path) => stat(projectFile(`public/${path}`)))
  ]);

  assert.ok(metadata.every(({ size }) => size > 0), "Every profile-frame preview video must be non-empty.");
  assert.ok(
    metadata.reduce((sum, { size }) => sum + size, 0) <= 13_000_000,
    "Profile-frame preview videos exceeded their 13 MB source-pack budget."
  );
  for (const path of PROFILE_FRAME_PREVIEW_VIDEO_PATHS) {
    assert.ok(
      budget.includes(`"play/${path}"`),
      `Performance audit does not require ${path}.`
    );
  }
  assert.match(
    budget,
    /const cinematicPack = CINEMATIC_PACK_PATHS[.]map\(required\)/,
    "The launch cinematic budget must only sum its explicit launch-file allowlist."
  );
  assert.doesNotMatch(
    budget,
    /const cinematicPack = records[.]filter\([^;]+play\/cinematic\//,
    "Nested cinematic assets must not silently enter the launch cinematic budget."
  );
  assert.match(budget, /PROFILE_FRAME_PREVIEW_VIDEO_PACK_MAXIMUM_BYTES = 13_000_000/);
  assert.match(
    budget,
    /record[.]path[.]startsWith\("play\/cinematic\/profile-frame-previews\/"\)/
  );
  assert.match(
    budget,
    /profileFramePreviewVideos[.]map\(\(record\) => record[.]path\)/
  );
  assert.match(budget, /\+ PROFILE_FRAME_PREVIEW_VIDEO_PACK_MAXIMUM_BYTES/);
});

test("the Pages preview server serves profile-frame MP4s as video", async () => {
  const source = await readFile(projectFile("scripts/serve-pages-preview.mjs"), "utf8");
  assert.match(source, /"[.]mp4": "video\/mp4"/);
});
