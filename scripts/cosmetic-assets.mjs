import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { assertResponsiveWebpAsset } from "./cosmic-gate-assets.mjs";

const RESPONSIVE_ASSETS = Object.freeze([
  Object.freeze({ name: "home-sm.webp", width: 960, height: 1280, maximumBytes: 90_000 }),
  Object.freeze({ name: "home-md.webp", width: 1920, height: 1080, maximumBytes: 230_000 }),
  Object.freeze({ name: "home-lg.webp", width: 2560, height: 1440, maximumBytes: 360_000 }),
  Object.freeze({ name: "gate-sm.webp", width: 1080, height: 1920, maximumBytes: 300_000 }),
  Object.freeze({ name: "gate-md.webp", width: 1920, height: 1080, maximumBytes: 300_000 }),
  Object.freeze({ name: "gate-lg.webp", width: 2560, height: 1440, maximumBytes: 420_000 })
]);

function cosmeticPack(slug, maximumBytes) {
  return Object.freeze({
    slug,
    path: `art/cosmetics/${slug}`,
    maximumBytes,
    assets: Object.freeze(RESPONSIVE_ASSETS.map((asset) => Object.freeze({
      ...asset,
      path: `art/cosmetics/${slug}/${asset.name}`
    })))
  });
}

export const COSMETIC_PACKS = Object.freeze([
  cosmeticPack("aurora-archive", 1_200_000),
  cosmeticPack("solar-foundry", 1_500_000),
  cosmeticPack("lunar-garden", 1_200_000),
  cosmeticPack("eclipse-sovereign", 1_500_000),
  cosmeticPack("pixel-frontier", 1_100_000),
  cosmeticPack("bubble-reef", 1_300_000),
  cosmeticPack("stellar-vanguard", 1_100_000)
]);

export function assertCosmeticAsset(buffer, asset, label = asset.path) {
  return assertResponsiveWebpAsset(buffer, asset, label);
}

export async function validateCosmeticPacks(publicDirectory) {
  const publicPath = publicDirectory instanceof URL ? fileURLToPath(publicDirectory) : publicDirectory;
  const cosmeticsDirectory = join(publicPath, "art", "cosmetics");
  const packNames = (await readdir(cosmeticsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"));
  assert.deepEqual(
    packNames,
    COSMETIC_PACKS.map((pack) => pack.slug).sort((left, right) => left.localeCompare(right, "en")),
    "The cosmetics directory must contain only declared on-demand packs."
  );

  const summary = [];
  for (const pack of COSMETIC_PACKS) {
    const directory = join(cosmeticsDirectory, pack.slug);
    const names = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, "en"));
    assert.deepEqual(
      names,
      pack.assets.map((asset) => asset.name).sort((left, right) => left.localeCompare(right, "en")),
      `${pack.slug} must contain exactly its declared responsive scene files.`
    );

    let bytes = 0;
    for (const asset of pack.assets) {
      const data = await readFile(join(publicPath, asset.path));
      assertCosmeticAsset(data, asset);
      bytes += data.length;
    }
    assert.ok(bytes <= pack.maximumBytes, `${pack.slug} exceeded its ${pack.maximumBytes}-byte pack budget (${bytes} bytes).`);
    summary.push(Object.freeze({ slug: pack.slug, bytes, maximumBytes: pack.maximumBytes }));
  }
  return Object.freeze(summary);
}

export function assertCosmeticPacksAreLazy(workerSource) {
  const source = String(workerSource || "");
  const shell = source.match(/const SHELL = ([^;]+);/)?.[1] || "";
  assert.doesNotMatch(shell, /art\/cosmetics\//, "Cosmetic scene packs must not enter the install shell.");
  assert.match(source, /LAZY_PACK_CACHE_PREFIX/, "The worker must declare a dedicated versioned lazy-pack cache prefix.");
  assert.match(source, /LAZY_PACK_PREFIXES/, "The worker must declare an explicit lazy-pack URL allowlist.");
  assert.match(source, /(?:[.]\/|\/)art\/cosmetics\//, "The worker must runtime-cache requested cosmetic scene assets.");
}
