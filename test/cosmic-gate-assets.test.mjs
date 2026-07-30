import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import {
  assertAdaptiveScenePreloadContract,
  assertScenePreloadSet,
  runCosmeticPreloadBootstrap
} from "../scripts/cosmetic-preload-bootstrap-audit.mjs";
import { assertCosmicGateAsset, COSMIC_GATE_ASSETS } from "../scripts/cosmic-gate-assets.mjs";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("Cosmic Gate ships exactly three resolution-checked WebP variants", async () => {
  const directory = projectFile("public/art/transitions/");
  const names = (await readdir(directory)).sort((left, right) => left.localeCompare(right, "en"));
  assert.deepEqual(
    names,
    COSMIC_GATE_ASSETS.map((asset) => asset.name).sort((left, right) => left.localeCompare(right, "en"))
  );

  for (const asset of COSMIC_GATE_ASSETS) {
    const data = await readFile(new URL(asset.name, directory));
    assert.deepEqual(
      assertCosmicGateAsset(data, asset, asset.path),
      { width: asset.width, height: asset.height }
    );
  }
});

test("Cosmic Gate selects and preloads one responsive v2 image without v1 fallbacks", async () => {
  const [html, bootstrapSource, gateStyles, homeStyles] = await Promise.all([
    readFile(projectFile("public/index.html"), "utf8"),
    readFile(projectFile("public/cosmetic-preload-bootstrap.js"), "utf8"),
    readFile(projectFile("public/cosmic-gate.css"), "utf8"),
    readFile(projectFile("public/epic-home.css"), "utf8")
  ]);
  assertAdaptiveScenePreloadContract(html, { bootstrapSource });
  const preloadResult = runCosmeticPreloadBootstrap(html, { bootstrapSource });
  assertScenePreloadSet(preloadResult, "gate", "celestial");
  const preloads = preloadResult.links.filter((link) => link.dataset.scenePreload === "gate");

  for (const asset of COSMIC_GATE_ASSETS) {
    const cssReference = `./${asset.path}`;
    assert.ok(gateStyles.includes(cssReference), `Missing responsive CSS reference: ${cssReference}`);
    const preload = preloads.find((link) => link.href.endsWith(`/${asset.name}`));
    assert.ok(preload, `Missing adaptive preload for ${asset.name}.`);
    assert.equal(preload.rel, "preload");
    assert.equal(preload.as, "image");
    assert.equal(preload.type, "image/webp");
    assert.equal(preload.fetchPriority, "high");
    assert.ok(preload.media);
    assert.equal(
      preload.href,
      new URL(cssReference, "https://example.test/cosmic-gate.css").href,
      `${asset.name} must use the same server-beta cache key from HTML and CSS`
    );
  }

  const portraitPreload = preloads.find((link) => link.href.includes("cosmic-gate-v2-portrait.webp"));
  assert.equal(portraitPreload?.media, "(orientation: portrait)");
  assert.doesNotMatch(portraitPreload?.media || "", /max-width/i);
  assert.match(gateStyles, /@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*cosmic-gate-v2-portrait[.]webp/i);
  assert.match(preloads[1].media, /width < 900px/i);
  assert.match(preloads[1].media, /900px <= width < 2200px/i);
  assert.match(preloads[1].media, /resolution < 1[.]5dppx/i);
  assert.doesNotMatch(homeStyles, /var\(--cosmic-gate-art\)/);
  assert.doesNotMatch(`${html}\n${gateStyles}\n${homeStyles}`, /cosmic-gate-v1[.]webp/);
});

test("Cosmic Gate variants are lazy-cacheable but absent from the install shell", async () => {
  const worker = await readFile(projectFile("public/service-worker.js"), "utf8");
  assert.match(worker, /\/art\/transitions\//);
  const shell = worker.match(/const SHELL = ([^;]+);/)?.[1] || "";
  assert.doesNotMatch(shell, /art\/transitions\//);
  for (const asset of COSMIC_GATE_ASSETS) assert.doesNotMatch(shell, new RegExp(asset.name.replaceAll(".", "[.]")));
});
