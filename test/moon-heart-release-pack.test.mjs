import assert from "node:assert/strict";
import test from "node:test";
import { readFile, stat } from "node:fs/promises";

import { SECONDARY_SURFACE_FILES } from "../public/secondary-surface-loader.mjs";
import { renderServiceWorker } from "../scripts/service-worker-source.mjs";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const HEART_LAZY_FILES = [
  "moon-heart-project.css",
  "moon-heart-project-runtime.mjs",
  "moon-heart-project-presentation.mjs",
  "moon-heart-actions.mjs"
];

test("Moon Heart ships as one explicit lazy presentation pack", async () => {
  for (const file of HEART_LAZY_FILES) {
    assert.ok((await stat(projectFile(`public/${file}`))).size > 0, `${file} is missing or empty.`);
    assert.equal(SECONDARY_SURFACE_FILES.includes(file), true, `${file} is absent from the canonical lazy inventory.`);
  }

  const [build, pages, itch] = await Promise.all([
    readFile(projectFile("scripts/build-pages.mjs"), "utf8"),
    readFile(projectFile("scripts/verify-pages-build.mjs"), "utf8"),
    readFile(projectFile("scripts/verify-itch-build.mjs"), "utf8")
  ]);
  assert.match(build, /moon-heart-project/);
  for (const verifier of [pages, itch]) {
    for (const file of HEART_LAZY_FILES) assert.ok(verifier.includes(`"${file}"`));
    assert.match(verifier, /Moon Heart presentation must not block/);
  }
});

test("Moon Heart has an independent 90 KB optional-pack budget", async () => {
  const budget = await readFile(projectFile("scripts/check-performance-budget.mjs"), "utf8");
  assert.match(budget, /MOON_HEART_SURFACE_MAXIMUM_BYTES = 90_000/);
  for (const file of HEART_LAZY_FILES) assert.ok(budget.includes(`"${file}"`));
  assert.match(budget, /!MOON_HEART_SURFACE_FILES[.]has\(path\)/);
  assert.match(budget, /moonHeartSurfaceBytes <= MOON_HEART_SURFACE_MAXIMUM_BYTES/);
  assert.match(budget, /INITIAL_CORE_GZIP_BASE_MAXIMUM_BYTES = 363_000/);
  assert.match(budget, /CONCEPT_CHEMISTRY_CORE_GZIP_ALLOWANCE_BYTES = 45_000/);
  assert.match(budget, /INITIAL_CORE_GZIP_MAXIMUM_BYTES = INITIAL_CORE_GZIP_BASE_MAXIMUM_BYTES\s*[+] CONCEPT_CHEMISTRY_CORE_GZIP_ALLOWANCE_BYTES/);
  assert.match(budget, /initialCoreGzip <= INITIAL_CORE_GZIP_MAXIMUM_BYTES/);
});

test("service worker caches Heart presentation only after first use", () => {
  const worker = renderServiceWorker({
    cachePrefix: "moon-heart-release-test-",
    version: "1.0.0",
    assets: ["./app.js", "./moon-heart-project.mjs"],
    lazyFiles: HEART_LAZY_FILES.map((file) => `./${file}?v=1.0.0`)
  });
  const shell = worker.match(/const SHELL = ([^;]+);/)?.[1] || "";
  const lazyFiles = worker.match(/const LAZY_FILES = new Set\(([^;]+)\);/)?.[1] || "";

  assert.match(shell, /moon-heart-project[.]mjs/);
  for (const file of HEART_LAZY_FILES) {
    assert.doesNotMatch(shell, new RegExp(file.replaceAll(".", "[.]")));
    assert.match(lazyFiles, new RegExp(file.replaceAll(".", "[.]")));
  }
});
