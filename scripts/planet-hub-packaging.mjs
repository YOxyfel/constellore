import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build, transform } from "esbuild";
import { withAssetVersion } from "./release-metadata.mjs";
import { THREE_VENDOR_FILES, THREE_VENDOR_VERSION, syncThreeVendor } from "./sync-planet-hub-vendor.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
export const PLANET_HUB_MANIFEST_PATH = "art/planet-hub/manifest.json";
export const PLANET_HUB_MODEL_NAMES = Object.freeze([
  "earth", "moon", "forge", "rocket", "portal", "earth-landing", "moon-landing"
]);
export const PLANET_HUB_QUALITY_TIERS = Object.freeze(["low", "standard"]);
export const PLANET_HUB_POSTER_PATHS = Object.freeze(
  ["earth", "moon"].flatMap((world) => ["forge", "journey", "arena"]
    .map((destination) => `art/planet-hub/posters/${world}-${destination}.webp`))
);
export const PLANET_HUB_MODEL_PATHS = Object.freeze(
  [
    ...PLANET_HUB_MODEL_NAMES.flatMap((name) => PLANET_HUB_QUALITY_TIERS
      .map((quality) => `art/planet-hub/models/${name}-${quality}.glb`)),
    "art/planet-hub/models/sun-low.glb"
  ]
);
export const PLANET_HUB_MEDIA_PATHS = Object.freeze([
  "art/planet-hub/media/portal-alpha.mp4",
  "art/planet-hub/media/portal-alpha.webm",
  "art/planet-hub/media/portal-alpha.webp"
]);
const PLANET_HUB_AUTHORED_DETAIL_NAMES = Object.freeze([
  "earth-albedo",
  "earth-clouds",
  "earth-night",
  "sun-emissive"
]);
const PLANET_HUB_MATERIAL_SUPPORT_NAMES = Object.freeze([
  "forge-normal",
  "forge-orm",
  "earth-landing-normal",
  "earth-landing-orm",
  "moon-landing-normal",
  "moon-landing-orm",
  "portal-normal",
  "portal-orm",
  "portal-emissive",
  "rocket-normal",
  "rocket-orm"
]);
export const PLANET_HUB_DETAIL_PATHS = Object.freeze(
  PLANET_HUB_QUALITY_TIERS.flatMap((quality) => [
    ...PLANET_HUB_AUTHORED_DETAIL_NAMES,
    ...PLANET_HUB_MATERIAL_SUPPORT_NAMES
  ].map((name) => `art/planet-hub/details/${name}-${quality}.webp`))
);
export const PLANET_HUB_SPACE_LAYER_NAMES = Object.freeze([
  "01-cosmic-horizon",
  "02-deep-stars",
  "03-deep-sky",
  "04-nebula-filaments",
  "05-near-stars"
]);
export const PLANET_HUB_SPACE_LAYER_PATHS = Object.freeze(
  PLANET_HUB_SPACE_LAYER_NAMES.flatMap((name) => PLANET_HUB_QUALITY_TIERS
    .map((quality) => `art/planet-hub/space-layers/${name}-${quality}.webp`))
);
export const PLANET_HUB_GALAXY_PATHS = Object.freeze(
  PLANET_HUB_QUALITY_TIERS.map((quality) => `art/planet-hub/galaxy/milky-way-${quality}.webp`)
);
export const PLANET_HUB_PLACE_THUMBNAIL_PATHS = Object.freeze([
  "art/planet-hub/place-thumbnails/solar-bodies.webp"
]);
export const PLANET_HUB_ASSET_PATHS = Object.freeze([
  PLANET_HUB_MANIFEST_PATH,
  ...PLANET_HUB_MODEL_PATHS,
  ...PLANET_HUB_POSTER_PATHS,
  ...PLANET_HUB_MEDIA_PATHS,
  ...PLANET_HUB_DETAIL_PATHS,
  ...PLANET_HUB_SPACE_LAYER_PATHS,
  ...PLANET_HUB_GALAXY_PATHS,
  ...PLANET_HUB_PLACE_THUMBNAIL_PATHS
]);
export const PLANET_HUB_RELEASE_RUNTIME_FILES = Object.freeze([
  "planet-hub-host.mjs",
  "planet-hub-runtime.mjs"
]);
export const PLANET_HUB_RELEASE_STYLE_FILES = Object.freeze([
  "planet-hub-cinematic.css"
]);
// The atlas, place catalog, progressive space effects, and deep cosmology are
// fetched only when their semantic views need them. Keep them separately
// cached so their authored catalogs never inflate the interaction-critical
// 225 KiB Planet Hub bundle.
export const PLANET_HUB_OPTIONAL_MODULE_FILES = Object.freeze([
  "celestial-atlas-runtime.mjs",
  "celestial-cosmology-runtime.mjs",
  "planet-hub-audio.mjs",
  "planet-hub-places.mjs",
  "planet-hub-space.mjs",
  "planet-hub-sun-effects.mjs"
]);
export const PLANET_HUB_BUNDLED_SOURCE_FILES = Object.freeze([
  "planet-hub-app.mjs",
  "planet-hub-domain.mjs",
  "planet-hub-moods.mjs",
  "planet-hub-renderer.mjs",
  "planet-hub-zoom.mjs"
]);
export const PLANET_HUB_SOURCE_RUNTIME_FILES = Object.freeze([
  ...PLANET_HUB_RELEASE_RUNTIME_FILES,
  ...PLANET_HUB_BUNDLED_SOURCE_FILES
]);
export const PLANET_HUB_RELEASE_LAZY_FILES = Object.freeze([
  ...PLANET_HUB_RELEASE_RUNTIME_FILES,
  ...PLANET_HUB_OPTIONAL_MODULE_FILES,
  ...PLANET_HUB_RELEASE_STYLE_FILES
]);
export const PLANET_HUB_SOURCE_LAZY_FILES = Object.freeze([
  ...PLANET_HUB_SOURCE_RUNTIME_FILES,
  ...PLANET_HUB_OPTIONAL_MODULE_FILES,
  ...PLANET_HUB_RELEASE_STYLE_FILES
]);
export const PLANET_HUB_BUNDLE_MINIMUM_SAVINGS_GZIP_BYTES = 2 * 1024;

const RAW_SOURCE_EXTENSIONS = new Set([".blend", ".blend1", ".fbx", ".mov"]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const RELEASE_MINIFIED_SUPPORT_FILES = new Set([
  ...PLANET_HUB_OPTIONAL_MODULE_FILES,
  "expedition.mjs",
  "frictionless.mjs",
  "moon-worldweaving-controller.mjs",
  "moon-worldweaving-runtime.mjs",
  "moon-result-presentation.mjs"
]);
export const PLANET_HUB_POSTER_VISUAL_CONTRACT = Object.freeze({
  width: 1024,
  height: 1024,
  minimumLumaStdDev: 20,
  minimumVisiblePixelRatio: 0.5,
  maximumVisiblePixelRatio: 0.85,
  minimumOpaquePixelRatio: 0.5,
  maximumOpaquePixelRatio: 0.8
});

async function listRelativeFiles(directory, base = directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listRelativeFiles(path, base));
    else if (entry.isFile()) files.push(relative(base, path).replaceAll("\\", "/"));
  }
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

function normalizeManifestPath(value) {
  return String(value || "")
    .replace(/^[.][/\\]/, "")
    .replaceAll("\\", "/")
    .replace(/^public\//, "");
}

function manifestFileRecords(value, records = []) {
  if (Array.isArray(value)) {
    for (const item of value) manifestFileRecords(item, records);
    return records;
  }
  if (!value || typeof value !== "object") return records;
  const path = normalizeManifestPath(value.path || value.url || value.output || value.file);
  const hash = String(value.sha256 || value.outputHash || value.hash || "").toLowerCase();
  if (path && hash) records.push({ path, hash, bytes: value.bytes ?? value.byteLength ?? value.size });
  for (const child of Object.values(value)) manifestFileRecords(child, records);
  return records;
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

export function isPlanetHubRuntimeFile(path) {
  const normalized = String(path || "").replaceAll("\\", "/");
  if (/(?:^|\/)vendor\//i.test(normalized)) return false;
  const name = basename(normalized).toLowerCase();
  return !PLANET_HUB_OPTIONAL_MODULE_FILES.includes(name)
    && /^planet-hub(?:-[a-z0-9-]+)?[.]mjs$/i.test(name);
}

export function isPlanetHubBundledSourceFile(path) {
  return PLANET_HUB_BUNDLED_SOURCE_FILES.includes(basename(String(path || "")).toLowerCase());
}

export function isPlanetHubReleaseStyleFile(path) {
  return PLANET_HUB_RELEASE_STYLE_FILES.includes(basename(String(path || "")).toLowerCase());
}

export function isPlanetHubOptionalModuleFile(path) {
  return PLANET_HUB_OPTIONAL_MODULE_FILES.includes(basename(String(path || "")).toLowerCase());
}

export function isPlanetHubReleaseLazyFile(path) {
  const name = basename(String(path || "")).toLowerCase();
  return PLANET_HUB_RELEASE_LAZY_FILES.includes(name);
}

export function isPlanetHubSourceLazyFile(path) {
  const name = basename(String(path || "")).toLowerCase();
  return PLANET_HUB_SOURCE_LAZY_FILES.includes(name);
}

export function assertPlanetHubSourceRuntimeInventory(paths, label = "public Planet Hub source") {
  const actual = [...new Set(paths
    .map((path) => basename(String(path || "")).toLowerCase())
    .filter(isPlanetHubRuntimeFile))]
    .sort((left, right) => left.localeCompare(right, "en"));
  const expected = [...PLANET_HUB_SOURCE_RUNTIME_FILES]
    .sort((left, right) => left.localeCompare(right, "en"));
  assert.deepEqual(actual, expected,
    `${label} must contain the exact bridge, audio, bundle entry, and bundled support-module inventory.`);
  return actual;
}

export function isPlanetHubReleaseMinifiedFile(path) {
  const name = basename(String(path || "")).toLowerCase();
  // Expedition is the eager domain behind the Planet Hub Journey destination;
  // Frictionless carries the eager board geometry shared by the cinematic
  // combining surface; the Moon host and weave continue that destination. Keep
  // readable authoring sources, but ship these bounded modules through the same
  // deterministic release transform as the hub instead of spending transfer
  // budget on comments and formatting.
  return isPlanetHubRuntimeFile(name) || RELEASE_MINIFIED_SUPPORT_FILES.has(name);
}

export async function buildPlanetHubRuntimeModule(source, version) {
  const result = await transform(withAssetVersion(source, version), {
    format: "esm",
    legalComments: "none",
    loader: "js",
    minify: true,
    target: "es2022"
  });
  assert.equal(result.warnings.length, 0, "Planet-hub release minification emitted an unexpected warning.");
  return result.code;
}

export async function buildPlanetHubRuntimeBundle(
  entryPath = join(root, "public", "planet-hub-runtime.mjs"),
  version
) {
  const resolvedEntryPath = entryPath instanceof URL ? fileURLToPath(entryPath) : String(entryPath);
  const hostEntry = basename(resolvedEntryPath).toLowerCase() === "planet-hub-host.mjs";
  const result = await build({
    entryPoints: [resolvedEntryPath],
    bundle: true,
    external: [
      "three",
      "./vendor/three/GLTFLoader.js*",
      ...(hostEntry ? [
        "./expedition.mjs?v=*",
        "./moon-project-launch.mjs?v=*",
        "./planet-hub-audio.mjs?v=*",
        "./planet-hub-runtime.mjs?v=*"
      ] : [])
    ],
    format: "esm",
    legalComments: "none",
    minify: true,
    outfile: "planet-hub-runtime.mjs",
    platform: "browser",
    target: "es2022",
    write: false
  });
  assert.equal(result.warnings.length, 0, "Planet-hub release bundling emitted an unexpected warning.");
  assert.equal(result.outputFiles?.length, 1, "Planet-hub release bundling must emit exactly one runtime module.");
  return withAssetVersion(result.outputFiles[0].text, version);
}

export function assertNoRawPlanetHubSources(paths, label = "release") {
  for (const path of paths) {
    const normalized = String(path).replaceAll("\\", "/");
    assert.ok(!normalized.toLowerCase().includes("itch-assets/"), `${label} contains source-only itch-assets content: ${normalized}`);
    assert.ok(!RAW_SOURCE_EXTENSIONS.has(extname(normalized).toLowerCase()), `${label} contains a forbidden raw planet-hub source: ${normalized}`);
    assert.ok(!/(?:^|\/)Constellore[.]blend1?$/i.test(normalized), `${label} contains the non-canonical staging scene: ${normalized}`);
  }
}

export function assertUsablePlanetHubPosterMetadata(details, label = "planet-hub poster") {
  const contract = PLANET_HUB_POSTER_VISUAL_CONTRACT;
  assert.equal(Number(details?.width), contract.width, `${label} must be ${contract.width}px wide.`);
  assert.equal(Number(details?.height), contract.height, `${label} must be ${contract.height}px high.`);
  assert.equal(String(details?.format || "").toUpperCase(), "WEBP", `${label} must be a WebP image.`);
  assert.equal(details?.hasAlpha, true, `${label} must retain its transparent 2D fallback background.`);
  const lumaStdDev = Number(details?.lumaStdDev);
  assert.ok(Number.isFinite(lumaStdDev) && lumaStdDev >= contract.minimumLumaStdDev,
    `${label} is blank or visually degenerate (luma standard deviation ${lumaStdDev}).`);
  const visiblePixelRatio = Number(details?.visiblePixelRatio);
  assert.ok(Number.isFinite(visiblePixelRatio)
    && visiblePixelRatio >= contract.minimumVisiblePixelRatio
    && visiblePixelRatio <= contract.maximumVisiblePixelRatio,
    `${label} has invalid visible-pixel coverage (${visiblePixelRatio}).`);
  const opaquePixelRatio = Number(details?.opaquePixelRatio);
  assert.ok(Number.isFinite(opaquePixelRatio)
    && opaquePixelRatio >= contract.minimumOpaquePixelRatio
    && opaquePixelRatio <= contract.maximumOpaquePixelRatio,
    `${label} has invalid opaque-pixel coverage (${opaquePixelRatio}).`);
}

export function assertPlanetHubReleaseInventory(paths, label = "release") {
  const normalized = new Set(paths.map(normalizeManifestPath));
  assertNoRawPlanetHubSources([...normalized], label);
  for (const path of PLANET_HUB_ASSET_PATHS) {
    assert.ok(normalized.has(path), `${label} is missing generated planet-hub asset ${path}.`);
  }
  for (const path of THREE_VENDOR_FILES) {
    assert.ok(normalized.has(path), `${label} is missing local Three.js vendor file ${path}.`);
  }
}

export async function validatePlanetHubProvenance(projectRoot = root) {
  const provenancePath = join(projectRoot, "PLANET_HUB_ASSET_PROVENANCE.json");
  const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
  assert.equal(provenance.schemaVersion, 1, "Planet-hub provenance schema must be version 1.");
  const records = new Map((provenance.records || []).map((record) => [record.id, record]));
  for (const id of ["earth-globe", "moon-globe", "sun-globe", "tripo-landmarks", "portal-vfx", "solar-places-thumbnails"]) {
    assert.equal(records.get(id)?.commercialUseDocumented, true, `Commercial-use provenance is not documented for ${id}.`);
  }
  for (const id of ["earth-globe", "moon-globe", "sun-globe"]) {
    const record = records.get(id);
    assert.equal(record.kind, "cc-by-4.0", `${id} must retain its CC BY 4.0 attribution.`);
    assert.match(record.author || "", /\S/, `${id} attribution is missing its author.`);
    assert.match(record.sourceUrl || "", /^https:\/\//, `${id} attribution is missing its source URL.`);
  }
  const placeThumbnailRecord = records.get("solar-places-thumbnails");
  assert.equal(placeThumbnailRecord.kind, "project-generated-art",
    "Places thumbnails must retain their project-generated provenance.");
  assert.deepEqual(placeThumbnailRecord.sources, [
    "itch-assets/Models/PlaceThumbnails/solar-bodies-source.png"
  ]);
  assert.match(placeThumbnailRecord.generator || "", /OpenAI built-in image generation/i);
  const placeThumbnailSource = await readFile(join(projectRoot, ...placeThumbnailRecord.sources[0].split("/")));
  assert.equal(placeThumbnailRecord.sourceSha256, sha256(placeThumbnailSource),
    "Places thumbnail provenance hash does not match its durable source image.");
  return provenance;
}

export async function validatePlanetHubAssets(publicRoot = join(root, "public")) {
  await syncThreeVendor({ verifyOnly: true });
  await validatePlanetHubProvenance(dirname(publicRoot));
  const config = JSON.parse(await readFile(join(dirname(publicRoot), "scripts", "planet-hub.config.json"), "utf8"));
  assert.equal(config.tools?.three, THREE_VENDOR_VERSION, "Planet-hub config and local Three.js vendor versions differ.");
  const hubRoot = join(publicRoot, "art", "planet-hub");
  const inventory = await listRelativeFiles(hubRoot);
  const expectedHubInventory = PLANET_HUB_ASSET_PATHS.map((path) => path.replace(/^art\/planet-hub\//, ""));
  assert.deepEqual(inventory, expectedHubInventory.sort((a, b) => a.localeCompare(b, "en")), "The generated planet-hub pack has missing or unexpected files.");

  const manifest = JSON.parse(await readFile(join(publicRoot, PLANET_HUB_MANIFEST_PATH), "utf8"));
  assert.equal(manifest.schemaVersion, 1, "Planet-hub manifest schema must be version 1.");
  assert.ok(manifest.worlds?.earth && manifest.worlds?.moon, "Planet-hub manifest must describe Earth and Moon.");
  for (const world of ["earth", "moon"]) {
    assert.ok(manifest.worlds?.[world]?.tiers?.low && manifest.worlds?.[world]?.tiers?.standard, `Planet-hub manifest must describe low and standard ${world} tiers.`);
  }
  for (const quality of PLANET_HUB_QUALITY_TIERS) {
    const sun = manifest.shared?.tiers?.[quality]?.sun;
    assert.ok(sun, `Planet-hub manifest must describe the shared Sun for ${quality}.`);
    assert.equal(normalizeManifestPath(sun.url), "art/planet-hub/models/sun-low.glb", "Both quality tiers must reuse the optimized Sun derivative.");
  }
  const optionalDetails = manifest.optionalDetails;
  assert.equal(optionalDetails?.schemaVersion, 1, "Planet-hub optional details must use schema version 1.");
  assert.equal(optionalDetails?.initialScene, false, "Focus detail textures must stay outside the initial scene.");
  assert.equal(optionalDetails?.loadPolicy, "focus", "Optional details must load only for a focused destination.");
  assert.deepEqual(optionalDetails?.textureContract, {
    flipY: false,
    uvChannel: 0,
    authoredColorSpace: "srgb",
    supportColorSpace: "none"
  }, "Optional texture orientation and color-space metadata must match the GLB UV contract.");
  const detailRecords = [];
  for (const quality of PLANET_HUB_QUALITY_TIERS) {
    const tier = optionalDetails?.tiers?.[quality];
    assert.ok(tier?.earth?.albedo && tier?.earth?.clouds && tier?.earth?.night && tier?.sun?.emissive,
      `Planet-hub manifest is missing authored ${quality} Earth/Sun details.`);
    for (const record of [tier.earth.albedo, tier.earth.clouds, tier.earth.night, tier.sun.emissive]) {
      assert.equal(record.authored, true, `${record.url} must retain its authored provenance.`);
      assert.equal(record.derived, false, `${record.url} is a resized authored map, not an inferred support map.`);
      detailRecords.push(record);
    }
    for (const role of ["forge", "earth-landing", "moon-landing", "portal", "rocket"]) {
      const maps = tier.materials?.[role];
      assert.ok(maps?.normal && maps?.orm, `Planet-hub manifest is missing ${quality} ${role} material support.`);
      for (const record of Object.values(maps)) {
        assert.equal(record.derived, true, `${record.url} must be explicitly marked as derived.`);
        detailRecords.push(record);
      }
      if (role === "portal") assert.ok(maps.emissive, `${quality} Portal needs its conservative emissive mask.`);
      else assert.equal(maps.emissive, undefined, `${quality} ${role} must not receive an undefended emissive guess.`);
    }
  }
  assert.deepEqual(
    detailRecords.map((record) => normalizeManifestPath(record.url)).sort((a, b) => a.localeCompare(b, "en")),
    [...PLANET_HUB_DETAIL_PATHS].sort((a, b) => a.localeCompare(b, "en")),
    "Planet-hub optional detail inventory and manifest differ."
  );
  const spaceLayers = manifest.spaceLayers;
  assert.equal(spaceLayers?.schemaVersion, 1, "Planet-hub space layers must use schema version 1.");
  assert.equal(spaceLayers?.derivationVersion, 1, "Planet-hub space layers must declare their deterministic derivation version.");
  assert.equal(spaceLayers?.initialScene, false, "Space layers must stay outside the initial scene budget.");
  assert.equal(spaceLayers?.loadPolicy, "progressive-after-ready", "Space layers must load progressively after Home is usable.");
  assert.deepEqual(spaceLayers?.textureContract, {
    projection: "equirectangular",
    colorSpace: "srgb",
    horizontalWrap: "repeat",
    verticalWrap: "clamp",
    mipmaps: false
  }, "Space-layer texture metadata must match the runtime sphere contract.");
  const spaceLayerRecords = [];
  let spaceLayerBytes = 0;
  for (const quality of PLANET_HUB_QUALITY_TIERS) {
    const tier = spaceLayers?.tiers?.[quality];
    const limits = config.budgets?.spaceLayers?.tiers?.[quality];
    assert.ok(tier && limits, `Planet-hub manifest is missing ${quality} space layers or their budget.`);
    assert.equal(tier.width, limits.width, `${quality} space layers have stale width metadata.`);
    assert.equal(tier.height, limits.height, `${quality} space layers have stale height metadata.`);
    assert.equal(tier.quality, limits.quality, `${quality} space layers have stale quality metadata.`);
    assert.deepEqual(
      tier.layers?.map((record) => `${String(record.order).padStart(2, "0")}-${record.id}`),
      PLANET_HUB_SPACE_LAYER_NAMES,
      `${quality} space layers must retain their canonical compositing order.`
    );
    const tierBytes = tier.layers.reduce((sum, record) => {
      assert.equal(record.width, limits.width, `${record.url} has stale width metadata.`);
      assert.equal(record.height, limits.height, `${record.url} has stale height metadata.`);
      assert.equal(record.mimeType, "image/webp", `${record.url} must be declared as WebP.`);
      spaceLayerRecords.push(record);
      return sum + Number(record.bytes);
    }, 0);
    assert.equal(tierBytes, Number(tier.bytes), `${quality} space-layer byte total is stale.`);
    assert.ok(tierBytes <= Number(limits.bytes), `${quality} space layers exceed ${limits.bytes} bytes (${tierBytes} bytes).`);
    spaceLayerBytes += tierBytes;
  }
  assert.equal(spaceLayerBytes, Number(spaceLayers.bytes), "Planet-hub space-layer byte total is stale.");
  assert.ok(spaceLayerBytes <= Number(config.budgets?.spaceLayers?.bytes),
    `Planet-hub space layers exceed ${config.budgets.spaceLayers.bytes} bytes (${spaceLayerBytes} bytes).`);
  assert.deepEqual(
    spaceLayerRecords.map((record) => normalizeManifestPath(record.url)).sort((a, b) => a.localeCompare(b, "en")),
    [...PLANET_HUB_SPACE_LAYER_PATHS].sort((a, b) => a.localeCompare(b, "en")),
    "Planet-hub space-layer inventory and manifest differ."
  );
  const galaxyTexture = manifest.galaxyTexture;
  assert.equal(galaxyTexture?.schemaVersion, 1, "Planet-hub galaxy textures must use schema version 1.");
  assert.equal(galaxyTexture?.derivationVersion, 1, "Planet-hub galaxy textures need a deterministic derivation version.");
  assert.equal(galaxyTexture?.initialScene, false, "Galaxy textures must stay outside the initial scene budget.");
  assert.equal(galaxyTexture?.loadPolicy, "milky-way-tier", "Galaxy textures must load only at the far semantic tier.");
  assert.deepEqual(galaxyTexture?.textureContract, {
    projection: "face-on-disc",
    colorSpace: "srgb",
    background: "black-luminance-alpha",
    mipmaps: true
  }, "Galaxy texture metadata must match the atlas plane contract.");
  const galaxyRecords = [];
  let galaxyTextureBytes = 0;
  for (const quality of PLANET_HUB_QUALITY_TIERS) {
    const record = galaxyTexture?.tiers?.[quality];
    const limits = config.budgets?.galaxyTexture?.tiers?.[quality];
    assert.ok(record && limits, `Planet-hub manifest is missing the ${quality} galaxy texture or its budget.`);
    assert.equal(record.width, limits.width, `${record.url} has stale width metadata.`);
    assert.equal(record.height, limits.width, `${record.url} has stale height metadata.`);
    assert.equal(record.quality, limits.quality, `${record.url} has stale quality metadata.`);
    assert.equal(record.mimeType, "image/webp", `${record.url} must be declared as WebP.`);
    assert.ok(Number(record.bytes) <= Number(limits.bytes), `${record.url} exceeds its tier budget.`);
    galaxyTextureBytes += Number(record.bytes);
    galaxyRecords.push(record);
  }
  assert.equal(galaxyTextureBytes, Number(galaxyTexture.bytes), "Planet-hub galaxy-texture byte total is stale.");
  assert.ok(galaxyTextureBytes <= Number(config.budgets?.galaxyTexture?.bytes),
    `Planet-hub galaxy textures exceed ${config.budgets.galaxyTexture.bytes} bytes (${galaxyTextureBytes} bytes).`);
  assert.deepEqual(
    galaxyRecords.map((record) => normalizeManifestPath(record.url)).sort((a, b) => a.localeCompare(b, "en")),
    [...PLANET_HUB_GALAXY_PATHS].sort((a, b) => a.localeCompare(b, "en")),
    "Planet-hub galaxy-texture inventory and manifest differ."
  );
  const placeThumbnails = manifest.placeThumbnails;
  const placeLimits = config.budgets?.placeThumbnails;
  const placeSprite = placeThumbnails?.sprite;
  assert.equal(placeThumbnails?.schemaVersion, 1, "Planet-hub Places thumbnails must use schema version 1.");
  assert.equal(placeThumbnails?.derivationVersion, 1,
    "Planet-hub Places thumbnails need a deterministic derivation version.");
  assert.equal(placeThumbnails?.initialScene, false,
    "Places thumbnails must stay outside the initial scene budget.");
  assert.equal(placeThumbnails?.loadPolicy, "places-panel",
    "Places thumbnails must load with their optional panel.");
  assert.ok(placeSprite && placeLimits, "Planet-hub manifest is missing its Places thumbnail sprite or budget.");
  assert.equal(normalizeManifestPath(placeSprite.url), PLANET_HUB_PLACE_THUMBNAIL_PATHS[0]);
  assert.equal(placeSprite.width, placeLimits.width, "Places thumbnail sprite has stale width metadata.");
  assert.equal(placeSprite.height, placeLimits.height, "Places thumbnail sprite has stale height metadata.");
  assert.equal(placeSprite.tileSize, placeLimits.tileSize, "Places thumbnail sprite has stale tile metadata.");
  assert.equal(placeSprite.count, 10, "Places thumbnail sprite must contain ten solar bodies.");
  assert.deepEqual(placeSprite.order, [
    "sun", "mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn", "uranus", "neptune"
  ], "Places thumbnail sprite order changed without updating the UI contract.");
  assert.equal(placeSprite.quality, placeLimits.quality, "Places thumbnail sprite has stale quality metadata.");
  assert.equal(placeSprite.mimeType, "image/webp", "Places thumbnail sprite must be declared as WebP.");
  assert.ok(Number(placeSprite.bytes) <= Number(placeLimits.bytes),
    `Places thumbnail sprite exceeds ${placeLimits.bytes} bytes (${placeSprite.bytes} bytes).`);
  for (const path of PLANET_HUB_POSTER_PATHS) {
    const name = basename(path, extname(path));
    const details = manifest.posters?.[name];
    assert.ok(details, `Planet-hub manifest is missing poster metadata for ${path}.`);
    assert.equal(normalizeManifestPath(details.url), path, `Planet-hub poster metadata points to the wrong file for ${path}.`);
    assertUsablePlanetHubPosterMetadata(details, path);
  }
  const records = manifestFileRecords(manifest);
  for (const name of ["mp4", "webm", "poster"]) {
    const details = manifest.portal?.files?.[name];
    if (manifest.portal?.[name] && details?.sha256) records.push({
      path: normalizeManifestPath(manifest.portal[name]),
      hash: String(details.sha256).toLowerCase(),
      bytes: details.bytes
    });
  }
  const recordByPath = new Map(records.map((record) => [normalizeManifestPath(record.path), record]));
  for (const path of PLANET_HUB_ASSET_PATHS.filter((path) => path !== PLANET_HUB_MANIFEST_PATH)) {
    const record = recordByPath.get(path);
    assert.ok(record, `Planet-hub manifest is missing output metadata for ${path}.`);
    assert.match(record.hash, SHA256_PATTERN, `Planet-hub manifest has an invalid SHA-256 for ${path}.`);
    const data = await readFile(join(publicRoot, path));
    assert.equal(record.hash, sha256(data), `Planet-hub output hash does not match ${path}.`);
    if (record.bytes !== undefined) assert.equal(Number(record.bytes), data.length, `Planet-hub byte count does not match ${path}.`);
  }
  const sources = Object.entries(manifest.sources || {}).map(([path, details]) => ({
    path: normalizeManifestPath(path),
    hash: String(details?.sha256 || "").toLowerCase()
  }));
  assert.ok(sources.length >= 7, "Planet-hub manifest must retain hashes for its source models and portal media.");
  for (const source of sources) assert.match(source.hash, SHA256_PATTERN, `Planet-hub manifest has an invalid source hash for ${source.path}.`);
  const sourcePaths = new Set(sources.map((source) => source.path));
  for (const name of PLANET_HUB_SPACE_LAYER_NAMES) {
    assert.ok(sourcePaths.has(`itch-assets/Models/SpaceLayers/${name}-source.png`),
      `Planet-hub manifest is missing durable source metadata for ${name}.`);
  }
  assert.ok(sourcePaths.has("itch-assets/Models/SpaceLayers/milky-way-source.png"),
    "Planet-hub manifest is missing durable source metadata for the Milky Way texture.");
  assert.ok(sourcePaths.has("itch-assets/Models/PlaceThumbnails/solar-bodies-source.png"),
    "Planet-hub manifest is missing durable source metadata for the Places thumbnails.");

  const fileSizes = new Map(await Promise.all(expectedHubInventory.map(async (path) => [path, (await stat(join(hubRoot, path))).size])));
  const modelBytes = (names, quality) => names.reduce((sum, name) => sum + (fileSizes.get(`models/${name}-${quality}.glb`) || 0), 0);
  for (const quality of PLANET_HUB_QUALITY_TIERS) {
    const ceiling = Number(config.budgets?.tiers?.[quality]?.sceneBytes);
    for (const world of ["earth", "moon"]) {
      const landing = `${world}-landing`;
      const sunPath = normalizeManifestPath(manifest.shared.tiers[quality].sun.url).replace(/^art\/planet-hub\//, "");
      const sunBytes = fileSizes.get(sunPath) || 0;
      const orbitingMoonBytes = world === "earth"
        ? fileSizes.get(`models/moon-${quality}.glb`) || 0
        : 0;
      const sceneBytes = modelBytes([world, "forge", "rocket", "portal", landing], quality)
        + sunBytes
        + orbitingMoonBytes;
      assert.ok(sceneBytes <= ceiling, `${quality} ${world} planet-hub scene exceeds ${ceiling} bytes (${sceneBytes} bytes).`);
    }
  }
  const generatedPackBytes = [...fileSizes.values()].reduce((sum, bytes) => sum + bytes, 0);
  assert.ok(generatedPackBytes <= Number(config.budgets?.packBytes), `Generated planet-hub pack exceeds ${config.budgets.packBytes} bytes (${generatedPackBytes} bytes).`);
  return { manifest, generatedPackBytes, inventory: PLANET_HUB_ASSET_PATHS };
}

export async function planetHubRuntimeBudget(publicRoot = join(root, "public"), { version } = {}) {
  const resolvedPublicRoot = publicRoot instanceof URL ? fileURLToPath(publicRoot) : String(publicRoot);
  const rootFiles = await readdir(resolvedPublicRoot, { withFileTypes: true });
  const sourcePaths = new Set(rootFiles.filter((entry) => entry.isFile()).map((entry) => entry.name));
  const sourceRuntimePaths = assertPlanetHubSourceRuntimeInventory([...sourcePaths]);
  const runtimePaths = [...PLANET_HUB_RELEASE_RUNTIME_FILES];
  for (const path of runtimePaths) assert.ok(sourcePaths.has(path), `The planet-hub release entry ${path} is missing.`);
  const allPaths = [...runtimePaths, ...THREE_VENDOR_FILES];
  const records = await Promise.all(allPaths.map(async (path) => {
    let data;
    if (path === "planet-hub-runtime.mjs" || path === "planet-hub-host.mjs") {
      data = Buffer.from(await buildPlanetHubRuntimeBundle(join(resolvedPublicRoot, path), version), "utf8");
    } else {
      const source = await readFile(join(resolvedPublicRoot, path));
      data = isPlanetHubRuntimeFile(path)
        ? Buffer.from(await buildPlanetHubRuntimeModule(source.toString("utf8"), version), "utf8")
        : source;
    }
    return { path, bytes: data.length, gzip: gzipSync(data, { level: 9 }).length };
  }));
  const bytes = records.reduce((sum, record) => sum + record.bytes, 0);
  const gzip = records.filter((record) => /[.]m?js$/i.test(record.path)).reduce((sum, record) => sum + record.gzip, 0);
  const sourceRecords = await Promise.all(PLANET_HUB_SOURCE_RUNTIME_FILES.map(async (path) => {
    const source = await readFile(join(resolvedPublicRoot, path), "utf8");
    const data = Buffer.from(await buildPlanetHubRuntimeModule(source, version), "utf8");
    return { path, bytes: data.length, gzip: gzipSync(data, { level: 9 }).length };
  }));
  const sourceRuntimeGzip = sourceRecords.reduce((sum, record) => sum + record.gzip, 0);
  const releaseRuntimeGzip = records
    .filter((record) => runtimePaths.includes(record.path))
    .reduce((sum, record) => sum + record.gzip, 0);
  const bundleSavingsGzip = sourceRuntimeGzip - releaseRuntimeGzip;
  assert.ok(bundleSavingsGzip >= PLANET_HUB_BUNDLE_MINIMUM_SAVINGS_GZIP_BYTES,
    `Planet-hub runtime bundling must save at least ${PLANET_HUB_BUNDLE_MINIMUM_SAVINGS_GZIP_BYTES} bytes gzip across the complete source inventory (${bundleSavingsGzip} bytes saved).`);
  assert.ok(gzip <= 225 * 1024, `Planet-hub runtime exceeds 225 KiB gzip (${gzip} bytes).`);
  return {
    runtimePaths,
    sourceRuntimePaths,
    records,
    sourceRecords,
    bytes,
    gzip,
    sourceRuntimeGzip,
    releaseRuntimeGzip,
    bundleSavingsGzip
  };
}
