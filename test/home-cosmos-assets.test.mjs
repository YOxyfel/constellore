import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import {
  assertAdaptiveScenePreloadContract,
  assertScenePreloadSet,
  runCosmeticPreloadBootstrap
} from "../scripts/cosmetic-preload-bootstrap-audit.mjs";
import { assertHomeCosmosAsset, HOME_COSMOS_ASSETS } from "../scripts/home-cosmos-assets.mjs";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("Home Cosmos ships exactly three resolution-checked WebP variants", async () => {
  const directory = projectFile("public/art/home/");
  const names = (await readdir(directory)).sort((left, right) => left.localeCompare(right, "en"));
  assert.deepEqual(
    names,
    HOME_COSMOS_ASSETS.map((asset) => asset.name).sort((left, right) => left.localeCompare(right, "en"))
  );

  for (const asset of HOME_COSMOS_ASSETS) {
    const data = await readFile(new URL(asset.name, directory));
    assert.deepEqual(
      assertHomeCosmosAsset(data, asset, asset.path),
      { width: asset.width, height: asset.height }
    );
  }
});

test("Home Cosmos selects and preloads one separate responsive menu image", async () => {
  const [html, bootstrapSource, gateStyles, homeStyles] = await Promise.all([
    readFile(projectFile("public/index.html"), "utf8"),
    readFile(projectFile("public/cosmetic-preload-bootstrap.js"), "utf8"),
    readFile(projectFile("public/cosmic-gate.css"), "utf8"),
    readFile(projectFile("public/epic-home.css"), "utf8")
  ]);
  assertAdaptiveScenePreloadContract(html, { bootstrapSource });
  const preloadResult = runCosmeticPreloadBootstrap(html, { bootstrapSource });
  assertScenePreloadSet(preloadResult, "home", "celestial");
  const preloads = preloadResult.links.filter((link) => link.dataset.scenePreload === "home");

  for (const asset of HOME_COSMOS_ASSETS) {
    const cssReference = `./${asset.path}`;
    assert.ok(homeStyles.includes(cssReference), `Missing responsive menu CSS reference: ${cssReference}`);
    assert.ok(!gateStyles.includes(cssReference), `Cosmic Gate must not use menu-only art: ${cssReference}`);
    const preload = preloads.find((link) => link.href.endsWith(`/${asset.name}`));
    assert.ok(preload, `Missing adaptive preload for ${asset.name}.`);
    assert.equal(preload.rel, "preload");
    assert.equal(preload.as, "image");
    assert.equal(preload.type, "image/webp");
    assert.equal(preload.fetchPriority, "high");
    assert.ok(preload.media);
    assert.equal(
      preload.href,
      new URL(cssReference, "https://example.test/epic-home.css").href,
      `${asset.name} must use the same server-beta cache key from HTML and CSS`
    );
  }

  const portraitPreload = preloads.find((link) => link.href.includes("home-cosmos-v1-portrait.webp"));
  assert.equal(portraitPreload?.media, "(orientation: portrait), (max-aspect-ratio: 6/5)");
  assert.doesNotMatch(portraitPreload?.media || "", /max-width/i);
  assert.match(homeStyles, /@media\s*\(orientation:\s*portrait\),\s*\(max-aspect-ratio:\s*6\/5\)\s*\{[\s\S]*home-cosmos-v1-portrait[.]webp/i);
  assert.match(homeStyles, /@media\s*\(orientation:\s*landscape\)\s+and\s+\(aspect-ratio\s*>\s*6\/5\)\s+and\s+\(min-width:\s*2200px\)[\s\S]*min-resolution:\s*1[.]5dppx[\s\S]*home-cosmos-v1-lg[.]webp/i);
  assert.match(homeStyles, /var\(--home-cosmos-art\)/);
  assert.doesNotMatch(homeStyles, /var\(--cosmic-gate-art\)/);
});

test("Home Cosmos variants are lazy-cacheable but absent from the install shell", async () => {
  const worker = await readFile(projectFile("public/service-worker.js"), "utf8");
  assert.match(worker, /\/art\/home\//);
  const shell = worker.match(/const SHELL = ([^;]+);/)?.[1] || "";
  assert.doesNotMatch(shell, /art\/home\//);
  for (const asset of HOME_COSMOS_ASSETS) assert.doesNotMatch(shell, new RegExp(asset.name.replaceAll(".", "[.]")));
});
