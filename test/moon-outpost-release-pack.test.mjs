import assert from "node:assert/strict";
import test from "node:test";
import { readFile, stat } from "node:fs/promises";

import { renderServiceWorker } from "../scripts/service-worker-source.mjs";
import { SECONDARY_SURFACE_FILES } from "../public/secondary-surface-loader.mjs";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const LAZY_FILES = [
  "moon-outpost.css",
  "moon-outpost-runtime.mjs",
  "moon-outpost-presentation.mjs"
];
const CORE_FILES = [
  "expedition.mjs",
  "moon-heart-project.mjs",
  "moon-outpost.mjs",
  "salvage-cache.mjs",
  "salvage-cosmetics.mjs"
];
const PNG_PATH = "art/moon-outpost/rocket-core-v1.png";

test("Moon Outpost declares its lazy presentation, eager domains, and valid PNG source", async () => {
  for (const path of [...LAZY_FILES, ...CORE_FILES]) {
    assert.ok((await stat(projectFile(`public/${path}`))).size > 0, `${path} is missing or empty.`);
  }
  const png = await readFile(projectFile(`public/${PNG_PATH}`));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test("Pages and server release manifests keep Outpost presentation and art out of the eager shell", async () => {
  const [pages, server, loader] = await Promise.all([
    readFile(projectFile("scripts/build-pages.mjs"), "utf8"),
    readFile(projectFile("scripts/sync-public-release.mjs"), "utf8"),
    readFile(projectFile("public/secondary-surface-loader.mjs"), "utf8")
  ]);
  for (const file of LAZY_FILES) {
    assert.ok(loader.includes(`"${file}`), `${file} is absent from the canonical lazy loader inventory.`);
  }
  for (const file of LAZY_FILES) {
    assert.equal(SECONDARY_SURFACE_FILES.includes(file), true, `${file} is not declared lazy.`);
  }
  for (const source of [pages, server]) {
    assert.match(source, /!name[.]startsWith\("art\/moon-outpost\/"\)/);
    assert.match(source, /lazyAssets: \[[^\]]*(?:[.]\/|\/)art\/moon-outpost\//);
    assert.match(source, /lazyFiles: SECONDARY_SURFACE_FILES[.]concat\(PLAY_ON_DEMAND_FILES\)[.]map/);
  }
});

test("Pages, itch, and performance verification enforce the complete Outpost boundary", async () => {
  const [pages, itch, budget] = await Promise.all([
    readFile(projectFile("scripts/verify-pages-build.mjs"), "utf8"),
    readFile(projectFile("scripts/verify-itch-build.mjs"), "utf8"),
    readFile(projectFile("scripts/check-performance-budget.mjs"), "utf8")
  ]);
  for (const source of [pages, itch]) {
    for (const file of [...LAZY_FILES, ...CORE_FILES, PNG_PATH]) {
      assert.ok(source.includes(`"${file}"`), `${file} is absent from an artifact verifier.`);
    }
    assert.match(source, /137, 80, 78, 71, 13, 10, 26, 10/);
    assert.match(source, /art\\?\/moon-outpost\\?\//);
  }
  for (const file of CORE_FILES) {
    assert.ok(budget.includes(`required("play/${file}")`), `${file} is absent from core transfer accounting.`);
  }
  for (const file of LAZY_FILES) assert.ok(budget.includes(`"${file}"`));
  assert.ok(budget.includes(`"play/${PNG_PATH}"`));
  assert.match(budget, /MOON_OUTPOST_PACK_MAXIMUM_BYTES = 520_000/);
  assert.match(budget, /INITIAL_CORE_GZIP_BASE_MAXIMUM_BYTES = 363_000/);
  assert.match(budget, /CONCEPT_CHEMISTRY_CORE_GZIP_ALLOWANCE_BYTES = 45_000/);
  assert.match(budget, /INITIAL_CORE_GZIP_MAXIMUM_BYTES = INITIAL_CORE_GZIP_BASE_MAXIMUM_BYTES\s*[+] CONCEPT_CHEMISTRY_CORE_GZIP_ALLOWANCE_BYTES/);
  assert.match(budget, /initialCoreGzip <= INITIAL_CORE_GZIP_MAXIMUM_BYTES/);
  assert.match(budget, /initialCoreGzip[\s\S]*expeditionDomain[.]gzip[\s\S]*moonHeartProjectDomain[.]gzip[\s\S]*moonOutpostDomain[.]gzip[\s\S]*salvageCacheDomain[.]gzip[\s\S]*salvageCosmeticsDomain[.]gzip/);
});

test("service-worker rendering supports the exact Outpost lazy boundary", () => {
  const worker = renderServiceWorker({
    cachePrefix: "moon-release-test-",
    version: "1.0.0",
    assets: ["./app.js", ...CORE_FILES.map((file) => `./${file}`)],
    lazyFiles: LAZY_FILES.map((file) => `./${file}?v=1.0.0`),
    lazyAssets: ["./art/moon-outpost/"]
  });
  const shell = worker.match(/const SHELL = ([^;]+);/)?.[1] || "";
  const lazyFiles = worker.match(/const LAZY_FILES = new Set\(([^;]+)\);/)?.[1] || "";
  for (const file of CORE_FILES) assert.match(shell, new RegExp(file.replaceAll(".", "[.]")));
  for (const file of LAZY_FILES) {
    assert.doesNotMatch(shell, new RegExp(file.replaceAll(".", "[.]")));
    assert.match(lazyFiles, new RegExp(file.replaceAll(".", "[.]")));
  }
  assert.doesNotMatch(shell, /art\/moon-outpost\//);
  assert.match(worker, /const LAZY_PREFIXES = [^;]*[.]\/art\/moon-outpost\//);
});
