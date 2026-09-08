import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import {
  COMBINING_BOARD_CORE_FILES,
  COMBINING_BOARD_LAZY_FILES,
  VOYAGE_PROJECTION_LAZY_FILES
} from "../public/secondary-surface-loader.mjs";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("Observatory release inventories point to nonempty source assets", async () => {
  for (const file of [...COMBINING_BOARD_CORE_FILES, ...COMBINING_BOARD_LAZY_FILES, ...VOYAGE_PROJECTION_LAZY_FILES]) {
    assert.ok((await stat(projectFile(`public/${file}`))).size > 0, `${file} is missing or empty.`);
  }
});

test("Pages and server release builders preserve the board core and lazy projection split", async () => {
  const [pages, sync] = await Promise.all([
    readFile(projectFile("scripts/build-pages.mjs"), "utf8"),
    readFile(projectFile("scripts/sync-public-release.mjs"), "utf8")
  ]);

  assert.match(pages, /href="\/combining-board\[\.\]css/);
  assert.match(pages, /word-orbit\|word-orbit-motion\|combining-board\|cosmic-gate/);
  for (const source of [pages, sync]) {
    assert.match(source, /COMBINING_BOARD_CORE_FILES/);
    assert.match(source, /COMBINING_BOARD_LAZY_FILES/);
    assert.match(source, /VOYAGE_PROJECTION_LAZY_FILES/);
  }
  assert.match(pages, /COMBINING_BOARD_LAZY_FILES[.]includes\(name\)/);
  assert.match(pages, /VOYAGE_PROJECTION_LAZY_FILES[.]includes\(name\)/);
  assert.match(pages, /VOYAGE_PROJECTION_LAZY_FILES[.]includes\(releasePath\)/);
  assert.match(pages, /buildPlanetHubRuntimeModule\(contents, release[.]version\)/);
});

test("release verification gives both Observatory packs explicit budgets and transforms", async () => {
  const [budget, pages, itch] = await Promise.all([
    readFile(projectFile("scripts/check-performance-budget.mjs"), "utf8"),
    readFile(projectFile("scripts/verify-pages-build.mjs"), "utf8"),
    readFile(projectFile("scripts/verify-itch-build.mjs"), "utf8")
  ]);

  assert.match(budget, /COMBINING_BOARD_PACK_MAXIMUM_BYTES = 75_000/);
  assert.match(budget, /VOYAGE_PROJECTION_PACK_MAXIMUM_BYTES = 110_000/);
  assert.match(budget, /CORE_APP_MAXIMUM_BYTES = 508_000/);
  assert.match(budget, /INITIAL_CORE_GZIP_BASE_MAXIMUM_BYTES = 363_000/);
  assert.match(budget, /CONCEPT_CHEMISTRY_CORE_GZIP_ALLOWANCE_BYTES = 45_000/);
  assert.match(budget, /INITIAL_CORE_GZIP_MAXIMUM_BYTES = INITIAL_CORE_GZIP_BASE_MAXIMUM_BYTES\s*[+] CONCEPT_CHEMISTRY_CORE_GZIP_ALLOWANCE_BYTES/);
  assert.match(budget, /CONCEPT_CHEMISTRY_CORE_PACK_MAXIMUM_BYTES = 158_000/);
  assert.match(budget, /CONCEPT_CHEMISTRY_CORE_PACK_GZIP_MAXIMUM_BYTES = 42_000/);
  assert.match(budget, /BASE_ARTIFACT_PRE_CHEMISTRY_MAXIMUM_BYTES = 9_410_000/);
  assert.match(budget, /CONCEPT_CHEMISTRY_BASE_ARTIFACT_ALLOWANCE_BYTES = 150_000/);
  assert.match(budget, /BASE_ARTIFACT_MAXIMUM_BYTES = BASE_ARTIFACT_PRE_CHEMISTRY_MAXIMUM_BYTES\s*[+] CONCEPT_CHEMISTRY_BASE_ARTIFACT_ALLOWANCE_BYTES/);
  assert.match(budget, /!COMBINING_BOARD_LAZY_FILES[.]includes\(path\)/);
  assert.match(budget, /!VOYAGE_PROJECTION_LAZY_FILES[.]includes\(path\)/);
  assert.match(budget, /[+] VOYAGE_PROJECTION_PACK_MAXIMUM_BYTES/);
  for (const verifier of [pages, itch]) {
    assert.match(verifier, /COMBINING_BOARD_CORE_FILES/);
    assert.match(verifier, /COMBINING_BOARD_LAZY_FILES/);
    assert.match(verifier, /VOYAGE_PROJECTION_LAZY_FILES/);
    assert.match(verifier, /VOYAGE_MEDIA_SCHEMA_VERSION/);
    assert.match(verifier, /VOYAGE_MEDIA_CONTRACT_VERSION/);
    assert.match(verifier, /VOYAGE_MEDIA_CONTRACT_SHA256/);
    assert.match(verifier, /typeof voyageMediaManifest[.]approval, "object"/);
    assert.match(verifier, /typeof voyageMediaManifest[.]approval[?][.]approved, "boolean"/);
    assert.match(verifier, /typeof voyageMediaManifest[.]approval[?][.]humanApproved, "object"/);
    assert.match(verifier, /was not emitted as a deterministic versioned Observatory asset/);
  }
});

test("local server and Pages preview serve Observatory modules and styles with browser-safe MIME types", async () => {
  const [server, preview] = await Promise.all([
    readFile(projectFile("server.mjs"), "utf8"),
    readFile(projectFile("scripts/serve-pages-preview.mjs"), "utf8")
  ]);

  for (const source of [server, preview]) {
    assert.match(source, /"[.]css": "text\/css; charset=utf-8"/);
    assert.match(source, /"[.]mjs": "text\/javascript; charset=utf-8"/);
  }
});

test("generated server worker keeps board CSS in shell and board JS plus projection in exact lazy files", async () => {
  const worker = await readFile(projectFile("public/service-worker.js"), "utf8");
  const shell = worker.match(/const SHELL = ([^;]+);/)?.[1] || "";
  const lazyFiles = worker.match(/const LAZY_FILES = new Set\(([^;]+)\);/)?.[1] || "";

  for (const file of COMBINING_BOARD_CORE_FILES) {
    assert.match(shell, new RegExp(file.replaceAll(".", "[.]")), `${file} is missing from the server install shell.`);
    assert.doesNotMatch(lazyFiles, new RegExp(file.replaceAll(".", "[.]")), `${file} was incorrectly made lazy.`);
  }
  for (const file of COMBINING_BOARD_LAZY_FILES) {
    assert.match(lazyFiles, new RegExp(file.replaceAll(".", "[.]")), `${file} is missing from the server lazy-file boundary.`);
    assert.doesNotMatch(shell, new RegExp(file.replaceAll(".", "[.]")), `${file} leaked into the server install shell.`);
  }
  for (const file of VOYAGE_PROJECTION_LAZY_FILES) {
    assert.match(lazyFiles, new RegExp(file.replaceAll(".", "[.]")), `${file} is missing from the server lazy-file boundary.`);
    assert.doesNotMatch(shell, new RegExp(file.replaceAll(".", "[.]")), `${file} leaked into the server install shell.`);
  }
});
