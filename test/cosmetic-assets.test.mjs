import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertCosmeticPacksAreLazy,
  COSMETIC_PACKS,
  validateCosmeticPacks
} from "../scripts/cosmetic-assets.mjs";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("cosmetic scene packs ship exact responsive WebP sets within independent budgets", async () => {
  const summary = await validateCosmeticPacks(projectFile("public/"));

  assert.deepEqual(
    COSMETIC_PACKS.map((pack) => [pack.slug, pack.maximumBytes]),
    [
      ["aurora-archive", 1_200_000],
      ["solar-foundry", 1_500_000],
      ["lunar-garden", 1_200_000],
      ["eclipse-sovereign", 1_500_000],
      ["pixel-frontier", 1_100_000],
      ["bubble-reef", 1_300_000],
      ["stellar-vanguard", 1_100_000]
    ]
  );
  assert.equal(summary.length, 7);
  assert.deepEqual(
    summary.map((pack) => pack.slug),
    COSMETIC_PACKS.map((pack) => pack.slug)
  );
  for (const pack of summary) assert.ok(pack.bytes <= pack.maximumBytes);
});

test("optional cosmetic scenes use dedicated orientation masters reproducibly", async () => {
  const [builder, provenance, verifier] = await Promise.all([
    readFile(projectFile("scripts/build-cosmetic-art.py"), "utf8"),
    readFile(projectFile("ART_ASSET_PROVENANCE.md"), "utf8"),
    readFile(projectFile("scripts/verify-cosmetic-art-repro.mjs"), "utf8")
  ]);

  assert.match(builder, /--home-portrait-source/);
  assert.match(builder, /--home-portrait-center-y/);
  assert.match(builder, /--gate-portrait-source/);
  assert.equal(
    [...verifier.matchAll(/"--home-portrait-source"/g)].length,
    7,
    "Every optional Home scene must use a dedicated portrait master."
  );
  assert.equal(
    [...verifier.matchAll(/"--gate-portrait-source"/g)].length,
    7,
    "Every optional Gate scene must use a dedicated portrait master."
  );
  for (const source of [
    "aurora-archive-home-portrait-source.png",
    "aurora-archive-gate-landscape-source.png",
    "solar-foundry-home-portrait-source.png",
    "solar-foundry-gate-landscape-source.png",
    "lunar-garden-home-portrait-source.png",
    "lunar-garden-gate-landscape-source.png",
    "eclipse-sovereign-home-portrait-source.png",
    "eclipse-sovereign-gate-landscape-source.png",
    "pixel-frontier-home-portrait-source.png",
    "pixel-frontier-gate-portrait-source.png",
    "bubble-reef-home-portrait-source.png",
    "stellar-vanguard-home-portrait-source.png",
    "stellar-vanguard-gate-portrait-source.png"
  ]) {
    const sourcePattern = new RegExp(source.replaceAll(".", "[.]"));
    assert.match(provenance, sourcePattern);
    assert.match(verifier, sourcePattern);
  }
  assert.match(provenance, /home-portrait-center-y 0[.]15/);
});

test("saved-loadout preload bootstrap stays compact while registering every optional pack", async () => {
  const source = await readFile(projectFile("public/cosmetic-preload-bootstrap.js"));
  const text = source.toString("utf8");

  assert.ok(source.length <= 8_000, `cosmetic-preload-bootstrap.js exceeded 8 KB (${source.length} bytes).`);
  for (const slug of COSMETIC_PACKS.map((pack) => pack.slug)) {
    assert.ok(text.includes(slug), `preload bootstrap is missing ${slug}`);
  }
  for (const contract of [
    "constellore.collection.pixel-frontier",
    "constellore.pixel-frontier.home-scene.bit-observatory",
    "constellore.pixel-frontier.gate-style.warp-gate",
    "constellore.collection.bubble-reef",
    "constellore.bubble-reef.home-scene.reef-observatory",
    "constellore.bubble-reef.gate-style.pearl-current",
    "constellore.collection.stellar-vanguard",
    "constellore.stellar-vanguard.home-scene.orbital-sanctuary",
    "constellore.stellar-vanguard.gate-style.meridian-gate"
  ]) {
    assert.ok(text.includes(contract), `preload bootstrap is missing ${contract}`);
  }
});

test("Home art media contracts partition the inclusive 6:5 boundary without duplicate downloads", async () => {
  const [bootstrap, baseStyles, cosmeticStyles] = await Promise.all([
    readFile(projectFile("public/cosmetic-preload-bootstrap.js"), "utf8"),
    readFile(projectFile("public/epic-home.css"), "utf8"),
    readFile(projectFile("public/cosmetics.css"), "utf8")
  ]);

  for (const source of [bootstrap, baseStyles, cosmeticStyles]) {
    assert.match(source, /max-aspect-ratio:\s*6\/5/);
    assert.match(source, /aspect-ratio\s*>\s*6\/5/);
    assert.doesNotMatch(source, /min-aspect-ratio:\s*6\/5/);
  }
});

test("server worker keeps cosmetic packs out of install and runtime-caches them separately", async () => {
  const worker = await readFile(projectFile("public/service-worker.js"), "utf8");
  assertCosmeticPacksAreLazy(worker);
});

test("portable builds rewrite and verify every cosmetics runtime URL", async () => {
  const [build, pagesVerifier, itchVerifier] = await Promise.all([
    readFile(projectFile("scripts/build-pages.mjs"), "utf8"),
    readFile(projectFile("scripts/verify-pages-build.mjs"), "utf8"),
    readFile(projectFile("scripts/verify-itch-build.mjs"), "utf8")
  ]);

  for (const path of ["cosmetics.css"]) {
    assert.ok(build.includes(`href="./${path}?v=`), `Pages build does not rewrite ${path} relative to the portable game.`);
    assert.ok(pagesVerifier.includes(`href="./${path}?v=`), `Pages verifier does not require ${path}.`);
    assert.ok(
      itchVerifier.includes(`href="[.]\\\\/${path.replaceAll(".", "[.]")}`),
      `itch verifier does not require relative ${path}.`
    );
  }
  assert.match(pagesVerifier, /"cosmetics-observatory[.]css"/, "Pages verifier does not require the lazy Observatory stylesheet.");
  assert.match(itchVerifier, /"cosmetics-observatory[.]css"/, "itch verifier does not require the lazy Observatory stylesheet.");
  for (const stylesheet of ["cosmetics-observatory-full-page.css", "profile-rank-frame.css"]) {
    const pattern = new RegExp(`"${stylesheet.replaceAll(".", "[.]")}"`);
    assert.match(pagesVerifier, pattern, `Pages verifier does not require ${stylesheet}.`);
    assert.match(itchVerifier, pattern, `itch verifier does not require ${stylesheet}.`);
  }
  assert.ok(build.includes('src="./cosmetic-preload-bootstrap.js?v='), "Pages build does not rewrite the cosmetic preload bootstrap.");
  assert.ok(pagesVerifier.includes('src="./cosmetic-preload-bootstrap.js?v='), "Pages verifier does not require the relative cosmetic preload bootstrap.");
  assert.ok(itchVerifier.includes('src="[.]\\\\/cosmetic-preload-bootstrap[.]js'), "itch verifier does not require the relative cosmetic preload bootstrap.");
  assert.ok(build.includes('src="./hero-recipes.mjs?v='), "Pages build does not rewrite the hero recipe module.");
  assert.ok(pagesVerifier.includes('src="./hero-recipes.mjs?v='), "Pages verifier does not require the relative hero recipe module.");
  assert.ok(itchVerifier.includes('src="[.]\\\\/hero-recipes[.]mjs'), "itch verifier does not require the relative hero recipe module.");
  assert.match(pagesVerifier, /href="\/cosmetics/);
  assert.match(itchVerifier, /href="\/cosmetics/);
  assert.match(pagesVerifier, /COSMETIC_PACKS[.]flatMap/);
  assert.match(itchVerifier, /COSMETIC_PACKS[.]flatMap/);
});

test("release sync validates cosmetic packs before mutating release sources", async () => {
  const sync = await readFile(projectFile("scripts/sync-public-release.mjs"), "utf8");
  const validation = sync.indexOf("await validateCosmeticPacks(publicDirectory);");
  const firstSourceWrite = sync.indexOf("for (const name of");
  assert.ok(validation >= 0, "Release sync does not validate cosmetic packs.");
  assert.ok(validation < firstSourceWrite, "Release sync must fail before rewriting release sources.");
});

test("the Observatory composes with equipped board and word cosmetics", async () => {
  const styles = await readFile(projectFile("public/combining-board.css"), "utf8");
  const boardRule = styles.match(/\[data-board-presentation="observatory"\] \.cosmos-board \{([\s\S]*?)\n\}/)?.[1] || "";
  const wordRule = styles.match(/\[data-board-presentation="observatory"\] \.board-word \{([\s\S]*?)\n\}/)?.[1] || "";

  assert.match(boardRule, /background-color:\s*var\(--observatory-space\)/);
  assert.doesNotMatch(boardRule, /(?:^|\s)background\s*:/, "Observatory must not erase the equipped universe background image.");
  for (const variable of [
    "--cosmetic-word-highlight",
    "--cosmetic-word-pattern",
    "--cosmetic-word-surface-a",
    "--cosmetic-word-surface-b",
    "--cosmetic-word-shadow"
  ]) {
    assert.ok(wordRule.includes(variable), `Observatory word plaques do not preserve ${variable}.`);
  }
});
