import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertCosmeticAsset, assertCosmeticPacksAreLazy, COSMETIC_PACKS } from "./cosmetic-assets.mjs";
import { assertAudioAsset, AUDIO_PACKS } from "./audio-assets.mjs";
import {
  assertAdaptiveScenePreloadContract,
  assertScenePreloadSet,
  runCosmeticPreloadBootstrap
} from "./cosmetic-preload-bootstrap-audit.mjs";
import { assertCosmicGateAsset, COSMIC_GATE_ASSETS } from "./cosmic-gate-assets.mjs";
import { assertHomeCosmosAsset, HOME_COSMOS_ASSETS } from "./home-cosmos-assets.mjs";
import { minifyCss } from "./minify-css.mjs";
import { validatePublicDuelApiUrl } from "./public-duel-config.mjs";
import { validatePublicFeedbackApiUrl } from "./public-feedback-config.mjs";
import { createDeterministicZip, readZip, sha256 } from "./release-archive.mjs";
import { withAssetVersion } from "./release-metadata.mjs";
import { startupModuleFiles } from "./startup-module-files.mjs";
import { PAGES_MINIFIED_CORE_RUNTIME_FILES } from "./pages-runtime-inventory.mjs";
import {
  assertPlanetHubReleaseInventory,
  buildPlanetHubRuntimeBundle,
  buildPlanetHubRuntimeModule,
  isPlanetHubReleaseMinifiedFile,
  isPlanetHubRuntimeFile,
  PLANET_HUB_ASSET_PATHS,
  PLANET_HUB_BUNDLED_SOURCE_FILES,
  PLANET_HUB_OPTIONAL_MODULE_FILES,
  PLANET_HUB_RELEASE_LAZY_FILES,
  PLANET_HUB_RELEASE_RUNTIME_FILES,
  PLANET_HUB_RELEASE_STYLE_FILES
} from "./planet-hub-packaging.mjs";
import { THREE_VENDOR_FILES } from "./sync-planet-hub-vendor.mjs";
import {
  COMBINING_BOARD_CORE_FILES,
  COMBINING_BOARD_LAZY_FILES,
  PLAY_ON_DEMAND_FILES,
  VOYAGE_PROJECTION_LAZY_FILES
} from "../public/secondary-surface-loader.mjs";
import {
  VOYAGE_MEDIA_CONTRACT_SHA256,
  VOYAGE_MEDIA_CONTRACT_VERSION,
  VOYAGE_MEDIA_SCHEMA_VERSION
} from "../public/cinematic/voyage-projection-media.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageMetadata = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const expectedDuelApiUrl = validatePublicDuelApiUrl(process.env.PUBLIC_DUEL_API_URL);
const expectedFeedbackApiUrl = validatePublicFeedbackApiUrl(process.env.PUBLIC_FEEDBACK_API_URL);
const releaseVersionPattern = packageMetadata.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const artifactName = `constellore-html5-v${packageMetadata.version}.zip`;
const artifactPath = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(root, "dist-itch", artifactName);
const STORY_PACK_PATHS = [
  "story/combination-story.mjs",
  "story/combination-story-view.mjs",
  "story/combination-story-runtime.mjs",
  "story/combination-story.css"
];
const STORY_PACK_MAXIMUM_BYTES = 40_000;
const GOLDEN_PAIR_PACK_PATHS = [
  "story/golden-fusions/golden-pair-animations.mjs",
  "story/golden-fusions/golden-pair-view.mjs",
  "story/golden-fusions/golden-pair-runtime.mjs",
  "story/golden-fusions/golden-pair.css"
];
const GOLDEN_PAIR_PACK_MAXIMUM_BYTES = 56_000;
const CINEMATIC_RUNTIME_PATHS = [
  "cinematic/first-open-cinematic.mjs",
  "cinematic/first-open-cinematic.css"
];
const CINEMATIC_VIDEO_PATHS = [
  "cinematic/intro-video.mp4",
  "cinematic/intro-video-phone.mp4"
];
const CINEMATIC_PACK_PATHS = [...CINEMATIC_RUNTIME_PATHS, ...CINEMATIC_VIDEO_PATHS];
const CINEMATIC_PACK_MAXIMUM_BYTES = 11_000_000;
const BIRTHDAY_VOYAGE_VIDEO_PATHS = [
  "cinematic/lion-intro-birthday.mp4"
];
const BIRTHDAY_VOYAGE_VIDEO_PACK_MAXIMUM_BYTES = 4_000_000;
const PROFILE_FRAME_PREVIEW_VIDEO_PATHS = [
  "cinematic/profile-frame-previews/empyrean-ascension.mp4",
  "cinematic/profile-frame-previews/infernal-dominion.mp4"
];
const PROFILE_FRAME_PREVIEW_VIDEO_PACK_MAXIMUM_BYTES = 13_000_000;
const SCRAMBLE_LAZY_FILES = [
  "scramble.mjs",
  "scramble-runtime.mjs",
  "scramble-app-bridge.mjs",
  "scramble-arena.mjs",
  "forge-clash.mjs",
  "scramble.css"
];
const MOON_WORLDWEAVING_LAZY_FILES = [
  "moon-worldweaving.css",
  "moon-worldweaving-runtime.mjs",
  "moon-result-presentation.mjs"
];
const MOON_OUTPOST_LAZY_FILES = [
  "moon-outpost.css",
  "moon-outpost-runtime.mjs",
  "moon-outpost-presentation.mjs",
  "moon-outpost-actions.mjs"
];
const MOON_PROJECT_FLIGHT_LAZY_FILES = [
  "moon-home-project-entry.mjs",
  "moon-project-launch.mjs"
];
const MOON_PROJECT_FLIGHT_STYLESHEET = "moon-project-flight.css";
const MOON_HEART_LAZY_FILES = [
  "moon-heart-project.css",
  "moon-heart-project-runtime.mjs",
  "moon-heart-project-presentation.mjs",
  "moon-heart-actions.mjs"
];
const MOON_OUTPOST_CORE_FILES = [
  "expedition.mjs",
  "moon-heart-project.mjs",
  "moon-outpost.mjs",
  "salvage-cache.mjs",
  "salvage-cosmetics.mjs"
];
const MOON_OUTPOST_PNG_PATHS = [
  "art/moon-outpost/rocket-core-v1.png"
];
const COSMIC_INTERLUDE_LAZY_FILE = "cosmic-interlude.css";
const archive = await readFile(artifactPath);
assert.ok((await stat(artifactPath)).size > 100_000, "The itch package is unexpectedly small.");

const sidecar = await readFile(`${artifactPath}.sha256`, "utf8");
assert.equal(sidecar, `${sha256(archive)}  ${artifactName}\n`, "The artifact checksum sidecar does not match the ZIP.");

const entries = readZip(archive);
assert.deepEqual(archive, createDeterministicZip(entries), "The itch package is not in canonical deterministic ZIP form.");
const files = new Map(entries.map((entry) => [entry.path, entry.data]));
for (const file of PAGES_MINIFIED_CORE_RUNTIME_FILES) {
  const source = await readFile(join(root, "public", file), "utf8");
  const built = files.get(file)?.toString("utf8");
  assert.equal(built, await buildPlanetHubRuntimeModule(source, packageMetadata.version),
    `${file} must preserve its versioned executable code in the minified itch release.`);
}
assertPlanetHubReleaseInventory([...files.keys()], "itch HTML5 archive");
const planetHubRuntimeFiles = [...files.keys()].filter(isPlanetHubRuntimeFile);
assert.deepEqual(planetHubRuntimeFiles.sort(), [...PLANET_HUB_RELEASE_RUNTIME_FILES].sort(), "The itch archive must contain only the Planet Hub bridge and bundled runtime.");
const planetHubLazyFiles = [...PLANET_HUB_RELEASE_LAZY_FILES];
for (const file of PLANET_HUB_BUNDLED_SOURCE_FILES) {
  assert.ok(!files.has(file), `${file} must be embedded in the itch Planet Hub runtime rather than shipped separately.`);
}
for (const file of planetHubRuntimeFiles) {
  const built = files.get(file).toString("utf8");
  const expected = file === "planet-hub-runtime.mjs" || file === "planet-hub-host.mjs"
    ? await buildPlanetHubRuntimeBundle(join(root, "public", file), packageMetadata.version)
    : await buildPlanetHubRuntimeModule(await readFile(join(root, "public", file), "utf8"), packageMetadata.version);
  assert.equal(
    built,
    expected,
    `${file} was not emitted as a deterministic minified versioned Planet Hub module.`
  );
}
for (const file of PLANET_HUB_OPTIONAL_MODULE_FILES) {
  const built = files.get(file).toString("utf8");
  const expected = file === "planet-hub-space.mjs"
    ? await buildPlanetHubRuntimeBundle(join(root, "public", file), packageMetadata.version)
    : await buildPlanetHubRuntimeModule(await readFile(join(root, "public", file), "utf8"), packageMetadata.version);
  assert.equal(built, expected, `${file} was not emitted as a deterministic minified lazy Planet Hub module.`);
}
const rankArtFiles = [
  "tier-01-common",
  "tier-02-dawn",
  "tier-03-nebula",
  "tier-04-aurora",
  "tier-05-rift",
  "tier-06-singularity"
].flatMap((tier) => ["sm", "md", "lg"].map((size) => `art/ranks/${tier}-${size}.webp`));
for (const required of SCRAMBLE_LAZY_FILES) {
  assert.ok(files.has(required), `The itch package is missing lazy Scramble asset ${required}.`);
  const source = await readFile(join(root, "public", required), "utf8");
  const built = files.get(required).toString("utf8");
  const expected = required.endsWith(".css")
    ? minifyCss(source)
    : PAGES_MINIFIED_CORE_RUNTIME_FILES.includes(required)
      ? await buildPlanetHubRuntimeModule(source, packageMetadata.version)
      : withAssetVersion(source, packageMetadata.version);
  assert.equal(built, expected, `${required} was not transformed as a versioned lazy Scramble asset.`);
}
for (const required of MOON_WORLDWEAVING_LAZY_FILES) {
  assert.ok(files.has(required), `The itch package is missing lazy Moon Worldweaving asset ${required}.`);
  const source = await readFile(join(root, "public", required), "utf8");
  const built = files.get(required).toString("utf8");
  const expected = required.endsWith(".css")
    ? minifyCss(source)
    : isPlanetHubReleaseMinifiedFile(required)
      ? await buildPlanetHubRuntimeModule(source, packageMetadata.version)
      : withAssetVersion(source, packageMetadata.version);
  assert.equal(built, expected, `${required} was not transformed as a versioned lazy Moon Worldweaving asset.`);
}
for (const required of MOON_OUTPOST_LAZY_FILES) {
  assert.ok(files.has(required), `The itch package is missing lazy Moon Outpost asset ${required}.`);
  const source = await readFile(join(root, "public", required), "utf8");
  const built = files.get(required).toString("utf8");
  const expected = required.endsWith(".css")
    ? minifyCss(source)
    : withAssetVersion(source, packageMetadata.version);
  assert.equal(built, expected, `${required} was not transformed as a versioned lazy Moon Outpost asset.`);
}
for (const required of MOON_PROJECT_FLIGHT_LAZY_FILES) {
  assert.ok(files.has(required), `The itch package is missing lazy Moon flight asset ${required}.`);
  const source = await readFile(join(root, "public", required), "utf8");
  const built = files.get(required).toString("utf8");
  assert.equal(built, withAssetVersion(source, packageMetadata.version), `${required} was not transformed as a versioned lazy Moon flight asset.`);
}
{
  const source = await readFile(join(root, "public", MOON_PROJECT_FLIGHT_STYLESHEET), "utf8");
  const built = files.get(MOON_PROJECT_FLIGHT_STYLESHEET)?.toString("utf8");
  assert.ok(built, "The itch package is missing Moon project flight CSS.");
  assert.equal(built, minifyCss(source), "Moon project flight CSS was not emitted as a minified shell asset.");
}
for (const required of MOON_HEART_LAZY_FILES) {
  assert.ok(files.has(required), `The itch package is missing lazy Moon Heart asset ${required}.`);
  const source = await readFile(join(root, "public", required), "utf8");
  const built = files.get(required).toString("utf8");
  const expected = required.endsWith(".css")
    ? minifyCss(source)
    : PAGES_MINIFIED_CORE_RUNTIME_FILES.includes(required)
      ? await buildPlanetHubRuntimeModule(source, packageMetadata.version)
      : withAssetVersion(source, packageMetadata.version);
  assert.equal(built, expected, `${required} was not transformed as a versioned lazy Moon Heart asset.`);
}
for (const required of ["worldweaving.mjs", "moon-worldweaving-controller.mjs", ...MOON_OUTPOST_CORE_FILES]) {
  assert.ok(files.has(required), `The itch package is missing ${required}.`);
  const source = await readFile(join(root, "public", required), "utf8");
  const built = files.get(required).toString("utf8");
  const expected = isPlanetHubReleaseMinifiedFile(required)
    ? await buildPlanetHubRuntimeModule(source, packageMetadata.version)
    : withAssetVersion(source, packageMetadata.version);
  assert.equal(built, expected, `${required} was not transformed as a deterministic versioned core module.`);
}
{
  const source = await readFile(join(root, "public", COSMIC_INTERLUDE_LAZY_FILE), "utf8");
  const built = files.get(COSMIC_INTERLUDE_LAZY_FILE)?.toString("utf8");
  assert.ok(built, "The itch package is missing lazy Cosmic Interlude CSS.");
  assert.equal(built, minifyCss(source), "Cosmic Interlude CSS was not emitted as a minified lazy asset.");
}
for (const required of ["word-orbit.mjs", "word-orbit-runtime.mjs", "word-semantic-facets.mjs", "mobile-play-shell-runtime.mjs", "word-orbit.css"]) {
  assert.ok(files.has(required), `The itch package is missing ${required}.`);
}
for (const file of [...COMBINING_BOARD_CORE_FILES, ...COMBINING_BOARD_LAZY_FILES, ...VOYAGE_PROJECTION_LAZY_FILES]) {
  assert.ok(files.has(file), `The itch package is missing Observatory asset ${file}.`);
  const source = await readFile(join(root, "public", file), "utf8");
  const expected = file.endsWith(".css")
    ? minifyCss(source)
    : file.endsWith(".json")
      ? source
    : COMBINING_BOARD_LAZY_FILES.includes(file) || VOYAGE_PROJECTION_LAZY_FILES.includes(file)
      ? await buildPlanetHubRuntimeModule(source, packageMetadata.version)
    : withAssetVersion(source, packageMetadata.version);
  assert.equal(files.get(file).toString("utf8"), expected, `${file} was not emitted as a deterministic versioned Observatory asset.`);
}
{
  const voyageMediaManifest = JSON.parse(
    files.get("cinematic/voyage-projection-media.json").toString("utf8")
  );
  assert.equal(voyageMediaManifest.schemaVersion, VOYAGE_MEDIA_SCHEMA_VERSION,
    "itch Voyage media manifest does not use the current runtime schema.");
  assert.equal(voyageMediaManifest.contractVersion, VOYAGE_MEDIA_CONTRACT_VERSION,
    "itch Voyage media manifest does not identify the current contract version.");
  assert.equal(voyageMediaManifest.contractSha256, VOYAGE_MEDIA_CONTRACT_SHA256,
    "itch Voyage media manifest does not bind the current contract digest.");
  assert.equal(typeof voyageMediaManifest.approval, "object",
    "itch Voyage media manifest approval must use the auditable object schema.");
  assert.equal(typeof voyageMediaManifest.approval?.approved, "boolean",
    "itch Voyage media manifest approval must declare an explicit approval state.");
  assert.equal(typeof voyageMediaManifest.approval?.humanApproved, "object",
    "itch Voyage media manifest approval must retain human-review metadata.");
}
for (const required of ["ui-foundation.css", "responsive-context.mjs", "fonts/Manrope-Variable.ttf", "fonts/DMMono-Medium.ttf", "fonts/OFL-Manrope.txt", "fonts/OFL-DM-Mono.txt"]) {
  assert.ok(files.has(required), `The itch package is missing ${required}.`);
}
for (const required of ["planet-hub.css", ...planetHubLazyFiles, ...PLANET_HUB_ASSET_PATHS, ...THREE_VENDOR_FILES]) {
  assert.ok(files.has(required), `The itch package is missing Planet Hub file ${required}.`);
}
assert.equal(files.get("planet-hub.css").toString("utf8"), minifyCss(await readFile(join(root, "public", "planet-hub.css"), "utf8")), "Planet Hub CSS was not emitted as a minified presentation asset.");
for (const file of PLANET_HUB_RELEASE_STYLE_FILES) {
  assert.equal(
    files.get(file).toString("utf8"),
    minifyCss(await readFile(join(root, "public", file), "utf8")),
    `${file} was not emitted as a minified lazy Planet Hub stylesheet.`
  );
}
for (const required of [
  "index.html", "app.js", "arena-rank.mjs", "birthday-voyage.mjs", "birthday-voyage.css", "default-profile.mjs", "mastery-catalog.mjs", ...MOON_HEART_LAZY_FILES, "secondary-surface-loader.mjs", "victory-handoff.mjs", "audio-runtime.mjs", "cosmos-circuit-runtime.mjs", "cosmos-circuit.mjs", "cosmos-circuit-copy.mjs", "circuit-lobby-tabs.mjs", "circuit-live-ops.mjs", "star-path.mjs", "account-profile.mjs", "run-entry.mjs", "hero-recipes.mjs", "cosmic-gate.mjs", "cosmic-quotes.mjs", "cosmic-interludes.mjs", "cosmic-interlude-runtime.mjs", COSMIC_INTERLUDE_LAZY_FILE, "reveal-tree.mjs", "reveal-presentation.mjs", "home-menu.mjs", "home-menu-view.mjs", "profile-rank-surface.mjs", "golden-targets.mjs", "first-game-experience.mjs", "first-orbit.mjs", "second-orbit.mjs", "explore-sandbox.mjs", "combination-report-delivery.mjs", "route-distance.mjs", "path-guard.mjs", "run-iq.mjs", "adaptive-difficulty.mjs", "remix-progression.mjs", "remix-readiness.mjs", "route-remixes.mjs", "shuffled-start.mjs", "rank-board-art.mjs", "rank-board-art-runtime.mjs", "styles.css", "simple-ui.css", "mobile-play-shell.css", "concept-chemistry.css", "concept-matter.css", "concept-matter.mjs", "concept-matter-runtime.mjs", "concept-matter-app.mjs", "guided-play-app.mjs", "molecular-memory.css", "word-orbit-motion.css", "cosmic-gate.css", "epic-home.css", "cosmos-circuit.css", "cosmetic-world-preview.css", "cosmetic-world-preview.mjs", "developer-console.css", "developer-console.mjs", "developer-console-runtime.mjs", "share-card-runtime.mjs", "local-beta.mjs", "local-world.mjs", "release.json", "service-worker.js", "manifest.webmanifest",
  "signature-routes.mjs", "living-atlas.mjs", "constellation-voyages.mjs", "recipe-insight.mjs", "community-results.mjs", "cosmic-events.mjs",
  "icon.svg", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "art/celestial-atlas-bg-v1.webp", ...STORY_PACK_PATHS, ...GOLDEN_PAIR_PACK_PATHS, ...CINEMATIC_PACK_PATHS, ...BIRTHDAY_VOYAGE_VIDEO_PATHS, ...PROFILE_FRAME_PREVIEW_VIDEO_PATHS, ...COSMIC_GATE_ASSETS.map((asset) => asset.path), ...HOME_COSMOS_ASSETS.map((asset) => asset.path), ...rankArtFiles, "release-manifest.json", "SHA256SUMS.txt"
]) assert.ok(files.has(required), `The itch package is missing ${required}.`);
assert.ok(files.has("initial-app-state.mjs"), "The itch package is missing initial-app-state.mjs.");
assert.ok(files.has("word-bloom-input-runtime.mjs"), "The itch package is missing word-bloom-input-runtime.mjs.");
assert.ok(files.has("mobile-play-chrome.mjs"), "The itch package is missing mobile-play-chrome.mjs.");
assert.ok(files.has("stardust-store.mjs"), "The itch package is missing stardust-store.mjs.");
assert.ok(files.has("stardust-store.css"), "The itch package is missing stardust-store.css.");
for (const file of STORY_PACK_PATHS) {
  const source = await readFile(join(root, "public", file), "utf8");
  const built = files.get(file).toString("utf8");
  const expected = file.endsWith(".css")
    ? minifyCss(source)
    : withAssetVersion(source, packageMetadata.version);
  assert.equal(built, expected, `${file} was not transformed as a versioned optional story asset.`);
}
const storyPackBytes = [...files.entries()]
  .filter(([path]) => STORY_PACK_PATHS.includes(path))
  .reduce((sum, [, data]) => sum + data.length, 0);
assert.ok(storyPackBytes <= STORY_PACK_MAXIMUM_BYTES, `Combination Story exceeded its 40 KB optional-pack budget (${storyPackBytes} bytes).`);
for (const file of GOLDEN_PAIR_PACK_PATHS) {
  const source = await readFile(join(root, "public", file), "utf8");
  const built = files.get(file).toString("utf8");
  const expected = file.endsWith(".css")
    ? minifyCss(source)
    : withAssetVersion(source, packageMetadata.version);
  assert.equal(built, expected, `${file} was not transformed as a versioned Golden Pair asset.`);
}
const goldenPairPackBytes = GOLDEN_PAIR_PACK_PATHS
  .reduce((sum, path) => sum + files.get(path).length, 0);
assert.ok(goldenPairPackBytes <= GOLDEN_PAIR_PACK_MAXIMUM_BYTES, `Golden Pair animations exceeded their 56 KB optional-pack budget (${goldenPairPackBytes} bytes).`);
for (const file of CINEMATIC_RUNTIME_PATHS) {
  const source = await readFile(join(root, "public", file), "utf8");
  const built = files.get(file).toString("utf8");
  const expected = file.endsWith(".css")
    ? minifyCss(source)
    : withAssetVersion(source, packageMetadata.version);
  assert.equal(built, expected, `${file} was not transformed as a versioned optional cinematic asset.`);
}
for (const file of CINEMATIC_VIDEO_PATHS) {
  assert.deepEqual(
    files.get(file),
    await readFile(join(root, "public", file)),
    `The itch launch video ${file} does not match the optimized source asset.`
  );
}
for (const file of BIRTHDAY_VOYAGE_VIDEO_PATHS) {
  assert.deepEqual(
    files.get(file),
    await readFile(join(root, "public", file)),
    `The itch Birthday Voyage video ${file} does not match the optimized source asset.`
  );
}
for (const file of PROFILE_FRAME_PREVIEW_VIDEO_PATHS) {
  assert.deepEqual(
    files.get(file),
    await readFile(join(root, "public", file)),
    `The itch profile-frame preview ${file} does not match the optimized source asset.`
  );
}
const cinematicPackBytes = CINEMATIC_PACK_PATHS
  .reduce((sum, path) => sum + files.get(path).length, 0);
assert.ok(cinematicPackBytes <= CINEMATIC_PACK_MAXIMUM_BYTES, `Launch cinematic exceeded its 11 MB optional-pack budget (${cinematicPackBytes} bytes).`);
const birthdayVoyageVideoPackBytes = BIRTHDAY_VOYAGE_VIDEO_PATHS
  .reduce((sum, path) => sum + files.get(path).length, 0);
assert.ok(
  birthdayVoyageVideoPackBytes <= BIRTHDAY_VOYAGE_VIDEO_PACK_MAXIMUM_BYTES,
  `Birthday Voyage video exceeded its 4 MB optional-pack budget (${birthdayVoyageVideoPackBytes} bytes).`
);
const profileFramePreviewVideos = [...files.entries()]
  .filter(([path]) => path.startsWith("cinematic/profile-frame-previews/"))
  .sort(([left], [right]) => left.localeCompare(right, "en"));
assert.deepEqual(
  profileFramePreviewVideos.map(([path]) => path),
  [...PROFILE_FRAME_PREVIEW_VIDEO_PATHS].sort((left, right) => left.localeCompare(right, "en")),
  "The itch package has an unexpected profile-frame preview video inventory."
);
const profileFramePreviewVideoPackBytes = profileFramePreviewVideos
  .reduce((sum, [, data]) => sum + data.length, 0);
assert.ok(
  profileFramePreviewVideoPackBytes <= PROFILE_FRAME_PREVIEW_VIDEO_PACK_MAXIMUM_BYTES,
  `Profile-frame preview videos exceeded their 13 MB optional-pack budget (${profileFramePreviewVideoPackBytes} bytes).`
);
const cosmeticRuntimeFiles = [
  "cosmetic-preload-bootstrap.js",
  "cosmetic-canvas.mjs",
  "cosmetic-catalog.mjs",
  "cosmetic-economy.mjs",
  "cosmetics-observatory.css",
  "cosmetics-observatory-full-page.css",
  "profile-rank-frame.css",
  "cosmetics-observatory.mjs",
  "cosmetic-world-preview.css",
  "cosmetic-world-preview.mjs",
  "cosmetics.css",
  ...COSMETIC_PACKS.flatMap((pack) => pack.assets.map((asset) => asset.path))
];
for (const required of cosmeticRuntimeFiles) {
  assert.ok(files.has(required), `The itch package is missing cosmetic runtime asset ${required}.`);
}
for (const file of ["cosmetics-observatory-full-page.css", "profile-rank-frame.css"]) {
  assert.equal(
    files.get(file).toString("utf8"),
    minifyCss(await readFile(join(root, "public", file), "utf8")),
    `${file} was not emitted as a minified lazy Observatory asset.`
  );
}
const celestialAtlasArt = files.get("art/celestial-atlas-bg-v1.webp");
assert.equal(celestialAtlasArt.subarray(0, 4).toString("ascii"), "RIFF", "The itch celestial atlas art is not a WebP RIFF file.");
assert.equal(celestialAtlasArt.subarray(8, 12).toString("ascii"), "WEBP", "The itch celestial atlas art is not a valid WebP container.");
for (const path of MOON_OUTPOST_PNG_PATHS) {
  const png = files.get(path);
  assert.ok(png?.length > 8, `The itch package is missing Moon Outpost PNG ${path}.`);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${path} is not a PNG.`);
}
assert.deepEqual(
  [...files.keys()].filter((path) => path.startsWith("art/transitions/")).sort((left, right) => left.localeCompare(right, "en")),
  COSMIC_GATE_ASSETS.map((asset) => asset.path).sort((left, right) => left.localeCompare(right, "en")),
  "The itch package must contain exactly the three responsive Cosmic Gate assets."
);
for (const asset of COSMIC_GATE_ASSETS) assertCosmicGateAsset(files.get(asset.path), asset, asset.path);
assert.deepEqual(
  [...files.keys()].filter((path) => path.startsWith("art/home/")).sort((left, right) => left.localeCompare(right, "en")),
  HOME_COSMOS_ASSETS.map((asset) => asset.path).sort((left, right) => left.localeCompare(right, "en")),
  "The itch package must contain exactly the three responsive Home Cosmos assets."
);
for (const asset of HOME_COSMOS_ASSETS) assertHomeCosmosAsset(files.get(asset.path), asset, asset.path);
const cosmeticPaths = COSMETIC_PACKS.flatMap((pack) => pack.assets.map((asset) => asset.path));
assert.deepEqual(
  [...files.keys()].filter((path) => path.startsWith("art/cosmetics/")).sort((left, right) => left.localeCompare(right, "en")),
  [...cosmeticPaths].sort((left, right) => left.localeCompare(right, "en")),
  "The itch package must contain exactly the declared responsive cosmetic scene packs."
);
for (const pack of COSMETIC_PACKS) {
  let packBytes = 0;
  for (const asset of pack.assets) {
    const data = files.get(asset.path);
    assertCosmeticAsset(data, asset, asset.path);
    packBytes += data.length;
  }
  assert.ok(packBytes <= pack.maximumBytes, `${pack.slug} exceeded its optional-pack budget (${packBytes} bytes).`);
}
const audioPaths = AUDIO_PACKS.flatMap((pack) => pack.assets.map((asset) => asset.path));
assert.deepEqual(
  [...files.keys()].filter((path) => path.startsWith("audio/")).sort((left, right) => left.localeCompare(right, "en")),
  [...audioPaths].sort((left, right) => left.localeCompare(right, "en")),
  "The itch package must contain exactly the declared soundtrack and SFX packs."
);
for (const pack of AUDIO_PACKS) {
  let packBytes = 0;
  for (const asset of pack.assets) {
    const data = files.get(asset.path);
    assertAudioAsset(data, asset, asset.path);
    packBytes += data.length;
  }
  assert.ok(packBytes <= pack.maximumBytes, `${pack.slug} exceeded its optional audio-pack budget (${packBytes} bytes).`);
}

for (const forbidden of ["server.mjs", "game-services.mjs", ".env", "package.json", "data/constellore.json"]) {
  assert.ok(!files.has(forbidden), `Server or private file leaked into the itch package: ${forbidden}`);
}

const html = files.get("index.html").toString("utf8");
// The minified app was checked against its exact transform above. Inspect
// readable contracts here without depending on minifier-local identifier names.
const gameAppContract = withAssetVersion(await readFile(join(root, "public", "app.js"), "utf8"), packageMetadata.version);
const cosmeticPreloadBootstrap = files.get("cosmetic-preload-bootstrap.js").toString("utf8");
const cosmicGateStyles = files.get("cosmic-gate.css").toString("utf8");
const epicHomeStyles = files.get("epic-home.css").toString("utf8");
const uiFoundationStyles = files.get("ui-foundation.css").toString("utf8");
assert.match(html, /data-runtime="local-practice"/);
assert.doesNotMatch(gameAppContract, /\b(?:ensureCosmosCircuit|openCosmosCircuit|COSMOS_CIRCUIT_RELEASE_ENABLED)\b/, "The itch shell must not ship staged Cosmos Circuit host glue.");
assert.match(gameAppContract, /localStorage[.]removeItem\(COSMOS_CIRCUIT_SAVE_KEY\)/, "Legacy Cosmos Circuit state cleanup must remain available.");
const feedbackApiAttribute = html.match(/<body\b[^>]*\bdata-feedback-api="([^"]*)"/i)?.[1];
assert.notEqual(feedbackApiAttribute, undefined, "The itch package is missing its data-feedback-api configuration.");
assert.equal(
  feedbackApiAttribute,
  expectedFeedbackApiUrl,
  "The itch package must contain the exact validated PUBLIC_FEEDBACK_API_URL used for this release."
);
const duelApiAttribute = html.match(/<body\b[^>]*\bdata-duel-api="([^"]*)"/i)?.[1];
assert.notEqual(duelApiAttribute, undefined, "The itch package is missing its data-duel-api configuration.");
assert.equal(
  duelApiAttribute,
  expectedDuelApiUrl,
  "The itch package must contain the exact validated PUBLIC_DUEL_API_URL used for this release."
);
assert.match(html, /<strong>LOCAL PRACTICE<\/strong>/);
assert.match(html, /class="practice-banner__detail">SAVED ON THIS DEVICE · NO PAYMENTS<\/small>/);
assert.match(html, /class="practice-banner__compact">SAVED HERE · NO PAYMENTS<\/small>/);
assert.match(html, /rel="apple-touch-icon" href="[.]\/icon-192[.]png"/);
assert.match(html, new RegExp(`href="[.]\\/ui-foundation[.]css[?]v=${releaseVersionPattern}"`));
assert.match(html, new RegExp(`href="[.]\\/styles[.]css[?]v=${releaseVersionPattern}"`));
assert.match(html, new RegExp(`href="[.]\\/simple-ui[.]css[?]v=${releaseVersionPattern}"`));
assert.match(html, new RegExp(`href="[.]\\/mobile-play-shell[.]css[?]v=${releaseVersionPattern}"`));
assert.match(html, new RegExp(`href="[.]\\/concept-chemistry[.]css[?]v=${releaseVersionPattern}"`));
assert.match(html, new RegExp(`href="[.]\\/concept-matter[.]css[?]v=${releaseVersionPattern}"`));
assert.match(html, new RegExp(`href="[.]\\/molecular-memory[.]css[?]v=${releaseVersionPattern}"`));
assert.match(html, new RegExp(`href="[.]\\/word-orbit-motion[.]css[?]v=${releaseVersionPattern}"`));
assert.match(html, new RegExp(`href="[.]\\/cosmic-gate[.]css[?]v=${releaseVersionPattern}"`));
assert.match(html, new RegExp(`href="[.]\\/epic-home[.]css[?]v=${releaseVersionPattern}"`));
assert.match(html, new RegExp(`href="[.]\\/cosmetics[.]css[?]v=${releaseVersionPattern}"`));
assert.match(html, new RegExp(`src="[.]\\/cosmetic-preload-bootstrap[.]js[?]v=${releaseVersionPattern}"`));
assert.match(html, new RegExp(`src="[.]\\/hero-recipes[.]mjs[?]v=${releaseVersionPattern}"`));
assert.match(html, new RegExp(`src="[.]\\/app[.]js[?]v=${releaseVersionPattern}"`));
assert.doesNotMatch(html, /<link[^>]+(?:cosmetics-observatory(?:-full-page)?|profile-rank-frame|cosmos-circuit|cosmic-interlude|scramble|moon-worldweaving|moon-outpost)[.]css/i, "Secondary surface CSS must not block the itch game shell.");
const itchGameHref = "https://example.test/portable-game/";
assertAdaptiveScenePreloadContract(html, { bootstrapSource: cosmeticPreloadBootstrap, pageHref: itchGameHref });
const itchPreloadResult = runCosmeticPreloadBootstrap(html, { bootstrapSource: cosmeticPreloadBootstrap, pageHref: itchGameHref });
assertScenePreloadSet(itchPreloadResult, "home", "celestial");
assertScenePreloadSet(itchPreloadResult, "gate", "celestial");
const itchHomePreloads = itchPreloadResult.links.filter((link) => link.dataset.scenePreload === "home");
const itchGatePreloads = itchPreloadResult.links.filter((link) => link.dataset.scenePreload === "gate");
for (const asset of COSMIC_GATE_ASSETS) {
  const reference = `./${asset.path}`;
  assert.ok(cosmicGateStyles.includes(reference), `The itch cinematic CSS does not select ${reference}.`);
  const preload = itchGatePreloads.find((link) => link.href.endsWith(`/${asset.name}`));
  assert.ok(preload, `${asset.name} is not adaptively preloaded.`);
  assert.equal(preload.fetchPriority, "high", `${asset.name} preload is not prioritized.`);
  assert.ok(preload.media, `${asset.name} preload must be selected by media conditions.`);
  assert.equal(preload.href, new URL(reference, new URL("cosmic-gate.css", itchGameHref)).href, `${asset.name} preload and CSS request must share one itch cache key.`);
}
for (const asset of HOME_COSMOS_ASSETS) {
  const reference = `./${asset.path}`;
  assert.ok(epicHomeStyles.includes(reference), `The itch home CSS does not select ${reference}.`);
  const preload = itchHomePreloads.find((link) => link.href.endsWith(`/${asset.name}`));
  assert.ok(preload, `${asset.name} is not adaptively preloaded.`);
  assert.equal(preload.fetchPriority, "high", `${asset.name} preload is not prioritized.`);
  assert.ok(preload.media, `${asset.name} preload must be selected by media conditions.`);
  assert.equal(preload.href, new URL(reference, new URL("epic-home.css", itchGameHref)).href, `${asset.name} preload and CSS request must share one itch cache key.`);
}
assert.match(epicHomeStyles, /var\(--home-cosmos-art\)/, "The itch home art must use its own responsive selection.");
assert.doesNotMatch(epicHomeStyles, /var\(--cosmic-gate-art\)/, "The itch home art must remain separate from the Cosmic Gate.");
assert.doesNotMatch(`${html}\n${cosmicGateStyles}\n${epicHomeStyles}`, /cosmic-gate-v1[.]webp/, "The itch package still references the blurry v1 Cosmic Gate art.");
assert.ok((html.match(/\bdata-update-entry(?:=|\s|>)/gi) || []).length >= 22, "The itch build must ship the complete Dev Log.");
const latestUpdate = html.match(/<li\b(?=[^>]*\bis-latest\b)[^>]*>[\s\S]*?<\/li>/i)?.[0] || "";
assert.match(latestUpdate, new RegExp(`VERSION ${releaseVersionPattern}`, "i"), "The itch build must identify the package version as its latest update.");
assert.match(html, /Shape Your Constellation[\s\S]*eight complete collections[\s\S]*Pixel Frontier[\s\S]*Bubble Reef[\s\S]*Stellar Vanguard/i, "The itch update history must describe all eight complete cosmetic collections.");
assert.match(html, /Locked looks can be previewed[\s\S]*responsive collection art now loads on demand/i, "The itch update history must describe preview, accessibility, and lazy-loading behavior.");
assert.match(html, /Your Ideas Can Reach Us[\s\S]*free, anonymous feedback receiver/i, "The itch build must retain anonymous combination feedback.");
assert.match(html, /saved locally first[\s\S]*offline retry queue/i, "The itch build must retain durable feedback delivery.");
assert.match(html, /Golden 50[\s\S]*three-to-seven-combination routes/i, "The itch build must retain the curated opening targets update.");
assert.match(html, /contextual, spoiler-safe constellation card[\s\S]*target and seed/i, "The itch build must retain contextual exact-challenge cards.");
assert.match(html, /first ten completed games[\s\S]*advanced ranks, competition, mastery, and economy/i, "The itch build must retain the protected first-ten flow.");
assert.match(html, /50 short thoughts/i, "The itch build must retain the complete gate quote collection update.");
assert.match(html, /Pause and Escape stay immediate/i, "The itch build must preserve immediate game controls.");
assert.match(html, /Pages and itch are deterministic local practice without live rankings, accounts, or AI/i);
assert.doesNotMatch(html, /rel="canonical"|property="og:url"/i, "The portable itch package must not claim the Pages URL as canonical.");
assert.doesNotMatch(html, /fonts[.]googleapis[.]com|fonts[.]gstatic[.]com/);
assert.match(uiFoundationStyles, /fonts\/Manrope-Variable[.]ttf/);
assert.match(uiFoundationStyles, /fonts\/DMMono-Medium[.]ttf/);
for (const forbiddenPath of ['href="/manifest', 'href="/ui-foundation', 'href="/styles', 'href="/simple-ui', 'href="/mobile-play-shell', 'href="/concept-chemistry', 'href="/concept-matter', 'href="/molecular-memory', 'href="/word-orbit-motion', 'href="/cosmic-gate', 'href="/epic-home', 'href="/cosmetics', 'href="/cosmos-circuit', 'href="/icon', 'src="/cosmetic-preload-bootstrap', 'src="/hero-recipes', 'src="/app']) {
  assert.ok(!html.includes(forbiddenPath), `Root-absolute asset path remains in itch HTML: ${forbiddenPath}`);
}

const manifest = JSON.parse(files.get("manifest.webmanifest").toString("utf8"));
assert.equal(manifest.name, "Constellore Local Practice");
assert.equal(manifest.id, "./");
assert.equal(manifest.start_url, "./");
assert.equal(manifest.scope, "./");
assert.ok(manifest.icons.some((icon) => icon.src === "./icon-maskable-512.png" && icon.purpose === "maskable"));
assert.ok(manifest.shortcuts.some((shortcut) => shortcut.url === "./?mode=daily"));
assert.ok(manifest.screenshots.some((screenshot) => screenshot.form_factor === "wide"));
assert.ok(manifest.screenshots.some((screenshot) => screenshot.form_factor === "narrow"));
for (const screenshot of manifest.screenshots) {
  const path = screenshot.src.replace(/^\.\//, "");
  const data = files.get(path);
  assert.ok(data, `The itch package is missing its PWA screenshot: ${path}`);
  assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${path} is not a PNG.`);
  const [expectedWidth, expectedHeight] = screenshot.sizes.split("x").map(Number);
  assert.equal(data.readUInt32BE(16), expectedWidth, `${path} has the wrong width.`);
  assert.equal(data.readUInt32BE(20), expectedHeight, `${path} has the wrong height.`);
}

const runtimeRelease = JSON.parse(files.get("release.json").toString("utf8"));
assert.equal(runtimeRelease.version, packageMetadata.version);
assert.equal(runtimeRelease.channel, "itch-html5");
assert.equal(runtimeRelease.runtime, "local-practice");
assert.equal(runtimeRelease.commerceEnabled, false);

const localWorld = files.get("local-world.mjs").toString("utf8");
assert.doesNotMatch(localWorld, /\"matrix\":/, "itch must ship the sparse World Graph rather than a dense recipe matrix.");
assert.match(localWorld, /new Map\(payload[.]recipes[.]map/);
assert.ok(files.get("local-world.mjs").length < 450_000, "The itch World Graph exceeded 450 KB.");
assert.match(localWorld, /\"cycleLength\":90/);
assert.match(localWorld, /\"intentCoverage\":\{\"attempts\":(?:[5-9]\d\d|\d{4,})/);
assert.match(localWorld, /\"weightedCoverage\":1/);
assert.match(localWorld, /\"problematicDeadEndLimit\":140/);

const worker = files.get("service-worker.js").toString("utf8");
assert.match(worker, /CACHE_PREFIX/);
assert.match(worker, /art\/celestial-atlas-bg-v1[.]webp/);
assert.match(worker, new RegExp(`ui-foundation[.]css[?]v=${releaseVersionPattern}`));
assert.match(worker, /fonts\/Manrope-Variable[.]ttf/);
assert.match(worker, /fonts\/DMMono-Medium[.]ttf/);
assert.match(worker, new RegExp(`simple-ui[.]css[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`mobile-play-shell[.]css[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`concept-chemistry[.]css[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`concept-matter[.]css[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`concept-matter[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`concept-matter-runtime[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`concept-matter-app[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`guided-play-app[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`molecular-memory[.]css[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`word-orbit-motion[.]css[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`word-bloom-input-runtime[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`cosmic-gate[.]css[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`epic-home[.]css[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`home-menu[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`route-distance[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`run-iq[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`adaptive-difficulty[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`remix-progression[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`remix-readiness[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`route-remixes[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`shuffled-start[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`rank-board-art[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`rank-board-art-runtime[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`cosmic-interludes[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`cosmic-interlude-runtime[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`cosmic-interlude[.]css[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`cosmic-quotes[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`hero-recipes[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`cosmetic-preload-bootstrap[.]js[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`cosmetic-canvas[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`cosmetic-catalog[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`cosmetics-observatory[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`cosmetics-observatory[.]css[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`cosmetics-observatory-full-page[.]css[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`profile-rank-frame[.]css[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`cosmetic-world-preview[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`cosmetic-world-preview[.]css[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`cosmetics[.]css[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`cosmos-circuit-runtime[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`cosmos-circuit[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`cosmos-circuit-copy[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`circuit-live-ops[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`cosmos-circuit[.]css[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`star-path[.]mjs[?]v=${releaseVersionPattern}`));
for (const file of SCRAMBLE_LAZY_FILES) {
  assert.match(
    worker,
    new RegExp(`${file.replaceAll(".", "[.]")}[?]v=${releaseVersionPattern}`),
    `${file} must be available through the itch worker's exact lazy-file allowlist.`
  );
}
for (const file of MOON_OUTPOST_LAZY_FILES) {
  assert.match(
    worker,
    new RegExp(`${file.replaceAll(".", "[.]")}[?]v=${releaseVersionPattern}`),
    `${file} must be available through the itch worker's exact lazy-file allowlist.`
  );
}
for (const file of MOON_PROJECT_FLIGHT_LAZY_FILES) {
  assert.match(
    worker,
    new RegExp(`${file.replaceAll(".", "[.]")}[?]v=${releaseVersionPattern}`),
    `${file} must be available through the itch worker's exact lazy-file allowlist.`
  );
}
for (const file of MOON_HEART_LAZY_FILES) {
  assert.match(
    worker,
    new RegExp(`${file.replaceAll(".", "[.]")}[?]v=${releaseVersionPattern}`),
    `${file} must be available through the itch worker's exact lazy-file allowlist.`
  );
}
assertCosmeticPacksAreLazy(worker);
assert.match(worker, new RegExp(`account-profile[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, new RegExp(`first-game-experience[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, /[.]\/art\/ranks\//);
assert.match(worker, /[.]\/art\/transitions\//);
assert.match(worker, /[.]\/art\/home\//);
assert.doesNotMatch(worker, /const SHELL = [^;]+tier-0[1-6]-/);
const workerShell = worker.match(/const SHELL = ([^;]+);/)?.[1] || "";
const startupShellFiles = new Set(JSON.parse(workerShell.match(/^(\[.*?\])/)?.[1] || "[]")
  .map((path) => path.split("?", 1)[0].replace(/^\.\//, "").replace(/^\//, "")));
const missingStartupFiles = (await startupModuleFiles(join(root, "public")))
  .filter((file) => !startupShellFiles.has(file));
assert.deepEqual(missingStartupFiles, [], `The itch offline shell must include every static startup dependency: ${missingStartupFiles.join(", ")}`);
assert.match(workerShell, /word-semantic-facets[.]mjs/, "The Bloom semantic facet catalog must be available in the itch offline shell.");
for (const file of COMBINING_BOARD_CORE_FILES) {
  assert.match(workerShell, new RegExp(file.replaceAll(".", "[.]")), `${file} must be available in the itch offline shell.`);
}
const workerLazyFiles = worker.match(/const LAZY_FILES = new Set\(([^;]+)\);/)?.[1] || "";
for (const file of COMBINING_BOARD_LAZY_FILES) {
  assert.match(workerLazyFiles, new RegExp(file.replaceAll(".", "[.]")), `${file} is missing from the itch lazy-file cache boundary.`);
  assert.doesNotMatch(workerShell, new RegExp(file.replaceAll(".", "[.]")), `${file} must not block the itch install shell.`);
}
for (const file of PLAY_ON_DEMAND_FILES) {
  assert.match(workerLazyFiles, new RegExp(file.replaceAll(".", "[.]")), `${file} is missing from the itch play-on-demand cache boundary.`);
  assert.doesNotMatch(workerShell, new RegExp(file.replaceAll(".", "[.]")), `${file} must not block the itch install shell.`);
}
for (const file of VOYAGE_PROJECTION_LAZY_FILES) {
  assert.match(workerLazyFiles, new RegExp(file.replaceAll(".", "[.]")), `${file} is missing from the itch lazy-file cache boundary.`);
  assert.doesNotMatch(workerShell, new RegExp(file.replaceAll(".", "[.]")), `${file} must not block the itch install shell.`);
}
for (const file of SCRAMBLE_LAZY_FILES) {
  assert.match(workerLazyFiles, new RegExp(file.replaceAll(".", "[.]")), `${file} is missing from the itch lazy-file cache boundary.`);
}
for (const file of MOON_OUTPOST_LAZY_FILES) {
  assert.match(workerLazyFiles, new RegExp(file.replaceAll(".", "[.]")), `${file} is missing from the itch lazy-file cache boundary.`);
}
for (const file of MOON_PROJECT_FLIGHT_LAZY_FILES) {
  assert.match(workerLazyFiles, new RegExp(file.replaceAll(".", "[.]")), `${file} is missing from the itch lazy-file cache boundary.`);
}
for (const file of MOON_HEART_LAZY_FILES) {
  assert.match(workerLazyFiles, new RegExp(file.replaceAll(".", "[.]")), `${file} is missing from the itch lazy-file cache boundary.`);
}
assert.match(workerLazyFiles, /cosmic-interlude[.]css/, "Cosmic Interlude CSS is missing from the itch lazy-file cache boundary.");
assert.match(workerLazyFiles, /cosmetics-observatory-full-page[.]css/, "Full-page Observatory CSS is missing from the itch lazy-file cache boundary.");
assert.match(workerLazyFiles, /profile-rank-frame[.]css/, "Arena frame preview CSS is missing from the itch lazy-file cache boundary.");
assert.match(workerLazyFiles, /cosmetic-world-preview[.]mjs/, "The immersive cosmetic preview runtime is missing from the itch lazy-file cache boundary.");
assert.match(workerLazyFiles, /cosmetic-world-preview[.]css/, "The immersive cosmetic preview CSS is missing from the itch lazy-file cache boundary.");
for (const file of planetHubLazyFiles) {
  assert.match(workerLazyFiles, new RegExp(file.replaceAll(".", "[.]")), `${file} is missing from the itch lazy-file cache boundary.`);
}
assert.match(worker, /[.]\/art\/planet-hub\//, "Planet Hub assets are missing from the itch lazy-pack boundary.");
assert.match(worker, /[.]\/vendor\/three\//, "The local Three.js modules are missing from the itch lazy-pack boundary.");
assert.doesNotMatch(workerShell, /planet-hub(?:-[a-z0-9-]+)?[.]mjs|planet-hub-cinematic[.]css|art\/planet-hub|vendor\/three/, "Planet Hub cinematic modules, styles, and assets must not block the itch install shell.");
for (const file of PLANET_HUB_OPTIONAL_MODULE_FILES) {
  assert.doesNotMatch(workerShell, new RegExp(file.replaceAll(".", "[.]")), `${file} must not block the itch install shell.`);
}
assert.doesNotMatch(workerShell, /cosmic-interlude[.]css/, "Cosmic Interlude CSS must not block the itch install shell.");
assert.doesNotMatch(workerShell, /(?:cosmetics-observatory-full-page|profile-rank-frame)[.]css/, "Optional Cosmetic Lab layout and frame CSS must not block the itch install shell.");
assert.doesNotMatch(workerShell, /cosmetic-world-preview[.](?:mjs|css)/, "The immersive cosmetic preview must not block the itch install shell.");
assert.doesNotMatch(workerShell, /(?:scramble(?:-(?:runtime|arena))?|forge-clash)[.](?:mjs|css)/, "Scramble must not block the itch install shell.");
assert.doesNotMatch(workerShell, /moon-outpost-(?:runtime|presentation)[.]mjs|moon-outpost[.]css/, "Moon Outpost presentation must not block the itch install shell.");
assert.doesNotMatch(workerShell, /moon-heart-project-(?:runtime|presentation)[.]mjs|moon-heart-project[.]css/, "Moon Heart presentation must not block the itch install shell.");
for (const file of MOON_OUTPOST_CORE_FILES) {
  assert.match(workerShell, new RegExp(file.replaceAll(".", "[.]")), `${file} must be available offline with app.js.`);
}
assert.match(workerShell, /arena-rank[.]mjs/, "The eager Arena Rank presentation must be available offline with app.js.");
assert.match(workerShell, /victory-handoff[.]mjs/, "The core victory handoff policy must be available offline with app.js.");
assert.match(workerShell, /guided-play-app[.]mjs/, "The guided-play controller must be available offline with app.js.");
assert.doesNotMatch(workerShell, /art\/transitions\//, "Responsive Cosmic Gate art must stay out of the itch install shell.");
assert.doesNotMatch(workerShell, /art\/home\//, "Responsive Home Cosmos art must stay out of the itch install shell.");
assert.doesNotMatch(workerShell, /art\/moon-outpost\//, "Moon Outpost art must stay out of the itch install shell.");
assert.doesNotMatch(workerShell, /audio\//, "Soundtracks and SFX banks must stay out of the itch install shell.");
assert.doesNotMatch(workerShell, /story\/(?:combination-story|golden-fusions\/)/, "Optional story presentation must stay out of the itch install shell.");
assert.doesNotMatch(workerShell, /cinematic\//, "The first-open cinematic must stay out of the itch install shell.");
assert.match(worker, /[.]\/audio\//, "Audio packs must be runtime-cached after playback activation.");
assert.match(worker, /const LAZY_PREFIXES = [^;]*[.]\/story\//, "Combination Story must be runtime-cached only after activation.");
assert.match(worker, /const LAZY_PREFIXES = [^;]*[.]\/cinematic\//, "The first-open cinematic must be runtime-cached only after activation.");
assert.match(worker, /const LAZY_PREFIXES = [^;]*[.]\/art\/moon-outpost\//, "Moon Outpost art must be runtime-cached only after activation.");
assert.match(worker, /headers[.]has\("range"\)/, "Range media requests must bypass Cache API writes.");
assert.match(worker, /key[.]startsWith\(CACHE_PREFIX\)/);
assert.match(worker, /response[.]ok/);
assert.match(worker, /url[.]origin !== self[.]location[.]origin/, "Cross-origin duel requests must bypass the itch worker.");
if (expectedDuelApiUrl) {
  assert.ok(!worker.includes(expectedDuelApiUrl), "The public duel API must be configured in HTML, never cached into the worker.");
}
assert.match(worker, new RegExp(`CACHE_PREFIX[}]${releaseVersionPattern}`));
for (const module of ["audio-runtime", "second-orbit", "explore-sandbox", "signature-routes", "living-atlas", "constellation-voyages", "recipe-insight", "community-results", "cosmic-events", "combination-report-delivery", "adaptive-difficulty", "remix-progression", "remix-readiness", "route-remixes", "shuffled-start", "rank-board-art", "rank-board-art-runtime", "cosmic-interludes", "cosmic-interlude-runtime", "cosmic-quotes", "hero-recipes"]) {
  assert.match(worker, new RegExp(`${module}[.]mjs[?]v=${releaseVersionPattern}`));
}
assert.doesNotMatch(worker, /keys[.]filter\(\(key\) => key !== CACHE\)/);

const releaseManifest = JSON.parse(files.get("release-manifest.json").toString("utf8"));
assert.equal(releaseManifest.schemaVersion, 1);
assert.equal(releaseManifest.package, "constellore-html5");
assert.equal(releaseManifest.gameVersion, packageMetadata.version);
assert.equal(releaseManifest.platform, "itch.io-html5");
assert.equal(releaseManifest.runtime, "local-practice");
assert.equal(releaseManifest.entrypoint, "index.html");
assert.deepEqual(releaseManifest.productBoundary, {
  soloPlay: "local-offline",
  soloProgressLocalOnly: true,
  liveDuels: "online-only",
  duelRatingServerBacked: true,
  duelApiConfigured: Boolean(expectedDuelApiUrl),
  liveAi: false,
  scoreUpload: false,
  payments: false,
  rewardedAds: false,
  crossDeviceAccount: false
});

const expectedRuntimePaths = [...files.keys()]
  .filter((path) => !["release-manifest.json", "SHA256SUMS.txt"].includes(path))
  .sort((left, right) => left.localeCompare(right, "en"));
assert.deepEqual(releaseManifest.files.map((entry) => entry.path), expectedRuntimePaths, "The release manifest inventory is incomplete or unsorted.");
for (const entry of releaseManifest.files) {
  const data = files.get(entry.path);
  assert.ok(data, `Manifest references a missing file: ${entry.path}`);
  assert.equal(entry.bytes, data.length, `Manifest byte count mismatch: ${entry.path}`);
  assert.equal(entry.sha256, sha256(data), `Manifest checksum mismatch: ${entry.path}`);
}

const checksumLines = files.get("SHA256SUMS.txt").toString("utf8").trimEnd().split("\n");
const expectedChecksumPaths = [...files.keys()].filter((path) => path !== "SHA256SUMS.txt").sort((left, right) => left.localeCompare(right, "en"));
assert.equal(checksumLines.length, expectedChecksumPaths.length);
for (const [index, path] of expectedChecksumPaths.entries()) {
  assert.equal(checksumLines[index], `${sha256(files.get(path))}  ${path}`, `SHA256SUMS mismatch: ${path}`);
}

console.log(`itch package verified: ${artifactName}`);
console.log(`${entries.length} files · local/offline solo · online-only live duels · deterministic ZIP · SHA-256 ${sha256(archive)}`);
