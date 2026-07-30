import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const GOLDEN_PAIR_FILES = [
  "story/golden-fusions/golden-pair-animations.mjs",
  "story/golden-fusions/golden-pair-view.mjs",
  "story/golden-fusions/golden-pair-runtime.mjs",
  "story/golden-fusions/golden-pair.css"
];

test("the Golden Pair pack declares only bounded code and CSS assets", async () => {
  const directory = projectFile("public/story/golden-fusions/");
  const entries = await readdir(directory, { withFileTypes: true });
  assert.deepEqual(
    entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort(),
    GOLDEN_PAIR_FILES.map((path) => path.split("/").at(-1)).sort()
  );
  for (const path of GOLDEN_PAIR_FILES) {
    assert.ok((await stat(projectFile(`public/${path}`))).size > 0, `${path} is missing or empty.`);
  }
  assert.equal(entries.some((entry) => /\.(?:mp4|webm|gif|png|jpe?g|avif|webp)$/i.test(entry.name)), false);
});

test("release verification keeps Golden Pair animation files lazy and separately budgeted", async () => {
  const [pages, itch, budget, build] = await Promise.all([
    readFile(projectFile("scripts/verify-pages-build.mjs"), "utf8"),
    readFile(projectFile("scripts/verify-itch-build.mjs"), "utf8"),
    readFile(projectFile("scripts/check-performance-budget.mjs"), "utf8"),
    readFile(projectFile("scripts/build-pages.mjs"), "utf8")
  ]);
  for (const path of GOLDEN_PAIR_FILES) {
    assert.ok(pages.includes(`"${path}"`), `Pages verifier does not require ${path}.`);
    assert.ok(itch.includes(`"${path}"`), `itch verifier does not require ${path}.`);
    assert.ok(budget.includes(`"play/${path}"`), `Performance audit does not require ${path}.`);
  }
  assert.match(build, /!name[.]startsWith\("story\/"\)/);
  assert.match(build, /lazyAssets: \[[^\]]*"[.]\/story\/"/);
  assert.match(budget, /GOLDEN_PAIR_PACK_MAXIMUM_BYTES = 56_000/);
  assert.match(budget, /\+ GOLDEN_PAIR_PACK_MAXIMUM_BYTES/);
  assert.match(itch, /GOLDEN_PAIR_PACK_MAXIMUM_BYTES = 56_000/);
});
