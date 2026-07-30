import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertAdaptiveScenePreloadContract,
  assertScenePreloadSet,
  runCosmeticPreloadBootstrap
} from "./cosmetic-preload-bootstrap-audit.mjs";
import { assertCosmicGateAsset, COSMIC_GATE_ASSETS } from "./cosmic-gate-assets.mjs";
import { assertHomeCosmosAsset, HOME_COSMOS_ASSETS } from "./home-cosmos-assets.mjs";
import { validateAudioPacks } from "./audio-assets.mjs";
import { validateCosmeticPacks } from "./cosmetic-assets.mjs";
import { packageMetadata } from "./release-metadata.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = await packageMetadata();
const read = (path) => readFile(join(root, path), "utf8");
const [gameHtml, cosmeticPreloadBootstrap, cosmeticCanvas, websiteHtml, worker, manifestSource, releaseSource, privacy, terms, support, license, notices, security, cosmicGateStyles, epicHomeStyles] = await Promise.all([
  read("public/index.html"), read("public/cosmetic-preload-bootstrap.js"), read("public/cosmetic-canvas.mjs"),
  read("Website/index.html"), read("public/service-worker.js"), read("public/manifest.webmanifest"),
  read("public/release.json"),
  read("Website/privacy.html"), read("Website/terms.html"), read("Website/support.html"),
  read("LICENSE.md"), read("THIRD_PARTY_NOTICES.md"), read("SECURITY.md"),
  read("public/cosmic-gate.css"), read("public/epic-home.css")
]);
const manifest = JSON.parse(manifestSource);
const release = JSON.parse(releaseSource);
const audioProvenance = await read("AUDIO_ASSET_PROVENANCE.md");
await validateAudioPacks(join(root, "public"));
await validateCosmeticPacks(join(root, "public"));
const celestialAtlasArt = await readFile(join(root, "public", "art", "celestial-atlas-bg-v1.webp"));
const transitionArtDirectory = join(root, "public", "art", "transitions");
const transitionArtFiles = (await readdir(transitionArtDirectory)).sort((left, right) => left.localeCompare(right, "en"));
assert.deepEqual(
  transitionArtFiles,
  COSMIC_GATE_ASSETS.map((asset) => asset.name).sort((left, right) => left.localeCompare(right, "en")),
  "The source release must contain exactly the three responsive Cosmic Gate assets."
);
const cosmicGateArt = await Promise.all(COSMIC_GATE_ASSETS.map(async (asset) => ({
  asset,
  data: await readFile(join(transitionArtDirectory, asset.name))
})));
const homeArtDirectory = join(root, "public", "art", "home");
const homeArtFiles = (await readdir(homeArtDirectory)).sort((left, right) => left.localeCompare(right, "en"));
assert.deepEqual(
  homeArtFiles,
  HOME_COSMOS_ASSETS.map((asset) => asset.name).sort((left, right) => left.localeCompare(right, "en")),
  "The source release must contain exactly the three responsive Home Cosmos assets."
);
const homeCosmosArt = await Promise.all(HOME_COSMOS_ASSETS.map(async (asset) => ({
  asset,
  data: await readFile(join(homeArtDirectory, asset.name))
})));
const rankArtFiles = [
  "tier-01-common",
  "tier-02-dawn",
  "tier-03-nebula",
  "tier-04-aurora",
  "tier-05-rift",
  "tier-06-singularity"
].flatMap((tier) => ["sm", "md", "lg"].map((size) => `${tier}-${size}.webp`));
const rankArt = await Promise.all(
  rankArtFiles.map((name) => readFile(join(root, "public", "art", "ranks", name)))
);
const cosmicInterludeStyles = await read("public/cosmic-interlude.css");

assert.ok(gameHtml.includes(`data-build-version="${pkg.version}"`), "Run npm run release:sync before packaging: game build version is stale.");
assert.ok(gameHtml.includes(`/app.js?v=${pkg.version}`), "The game app asset is not tied to the package release version.");
assert.ok(gameHtml.includes(`/cosmetic-preload-bootstrap.js?v=${pkg.version}`), "The cosmetic preload bootstrap is not tied to the package release version.");
assert.ok(cosmeticCanvas.trim(), "The cosmetic canvas runtime is missing or empty.");
assert.ok(gameHtml.includes(`/styles.css?v=${pkg.version}`), "The game stylesheet is not tied to the package release version.");
assert.ok(gameHtml.includes(`/simple-ui.css?v=${pkg.version}`), "The simplified game stylesheet is not tied to the package release version.");
assert.doesNotMatch(gameHtml, /cosmic-interlude[.]css/, "Cosmic Interlude CSS must not block the game shell.");
assert.ok(cosmicInterludeStyles.trim(), "The lazy Cosmic Interlude stylesheet is missing or empty.");
assert.ok(gameHtml.includes(`/cosmic-gate.css?v=${pkg.version}`), "The cinematic gate stylesheet is not tied to the package release version.");
assert.ok(gameHtml.includes(`/epic-home.css?v=${pkg.version}`), "The home art stylesheet is not tied to the package release version.");
assert.ok(websiteHtml.includes(`data-build-version="${pkg.version}"`), "Run npm run release:sync before packaging: website build version is stale.");
assert.ok(websiteHtml.includes(`website.css?v=${pkg.version}`), "The website stylesheet is not tied to the package release version.");
assert.ok(websiteHtml.includes(`website.js?v=${pkg.version}`), "The website script is not tied to the package release version.");
assert.ok(worker.includes(`\${CACHE_PREFIX}${pkg.version}`), "The service-worker cache does not match the package release version.");
assert.ok(worker.includes(`/simple-ui.css?v=${pkg.version}`), "The service worker does not cache the simplified game stylesheet.");
assert.ok(worker.includes(`/cosmic-gate.css?v=${pkg.version}`), "The service worker does not cache the cinematic gate stylesheet.");
assert.ok(worker.includes(`/epic-home.css?v=${pkg.version}`), "The service worker does not cache the home art stylesheet.");
assert.ok(worker.includes(`/cosmic-gate.mjs?v=${pkg.version}`), "The service worker does not cache the cinematic gate runtime.");
assert.ok(worker.includes(`/account-profile.mjs?v=${pkg.version}`), "The service worker does not cache the account-profile runtime.");
assert.ok(worker.includes(`/first-game-experience.mjs?v=${pkg.version}`), "The service worker does not cache the first-game experience runtime.");
assert.ok(worker.includes(`/run-entry.mjs?v=${pkg.version}`), "The service worker does not cache the deferred level-entry runtime.");
assert.ok(worker.includes(`/cosmic-quotes.mjs?v=${pkg.version}`), "The service worker does not cache the Cosmic Gate quote catalog.");
assert.ok(worker.includes(`/hero-recipes.mjs?v=${pkg.version}`), "The service worker does not cache the rotating start-screen recipes.");
assert.ok(worker.includes(`/home-menu-view.mjs?v=${pkg.version}`), "The service worker does not cache the rank-gated home view.");
assert.ok(worker.includes(`/profile-rank-surface.mjs?v=${pkg.version}`), "The service worker does not cache the on-demand Route Rank profile.");
assert.ok(worker.includes(`/cosmic-interludes.mjs?v=${pkg.version}`), "The service worker does not cache the interlude engine.");
assert.ok(worker.includes(`/cosmic-interlude-runtime.mjs?v=${pkg.version}`), "The service worker does not cache the interlude runtime.");
assert.ok(worker.includes(`/cosmic-interlude.css?v=${pkg.version}`), "The service worker does not expose the lazy interlude stylesheet.");
assert.ok(worker.includes(`/combination-report-delivery.mjs?v=${pkg.version}`), "The service worker does not cache anonymous report delivery.");
assert.ok(worker.includes(`/adaptive-difficulty.mjs?v=${pkg.version}`), "The service worker does not cache the adaptive difficulty engine.");
assert.ok(worker.includes(`/remix-progression.mjs?v=${pkg.version}`), "The service worker does not cache the Route Rank progression engine.");
assert.ok(worker.includes(`/remix-readiness.mjs?v=${pkg.version}`), "The service worker does not cache the Remix readiness engine.");
assert.ok(worker.includes(`/route-remixes.mjs?v=${pkg.version}`), "The service worker does not cache the route-remix rules engine.");
assert.ok(worker.includes(`/shuffled-start.mjs?v=${pkg.version}`), "The service worker does not cache the Shuffled start engine.");
assert.ok(worker.includes(`/rank-board-art.mjs?v=${pkg.version}`), "The service worker does not cache the rank-art mapping engine.");
assert.ok(worker.includes(`/rank-board-art-runtime.mjs?v=${pkg.version}`), "The service worker does not cache the rank-art runtime.");
assert.ok(worker.includes(`/cosmetic-preload-bootstrap.js?v=${pkg.version}`), "The service worker does not cache the cosmetic preload bootstrap.");
assert.ok(worker.includes(`/cosmetic-canvas.mjs?v=${pkg.version}`), "The service worker does not cache the cosmetic canvas runtime.");
assert.ok(worker.includes(`/audio-runtime.mjs?v=${pkg.version}`), "The service worker does not cache the lightweight audio runtime.");
assert.ok(worker.includes(`/cosmos-circuit.css?v=${pkg.version}`), "The service worker does not cache the Cosmos Circuit stylesheet.");
assert.ok(worker.includes(`/cosmos-circuit-runtime.mjs?v=${pkg.version}`), "The service worker does not cache the Cosmos Circuit runtime.");
assert.ok(worker.includes(`/cosmos-circuit.mjs?v=${pkg.version}`), "The service worker does not cache the Cosmos Circuit domain.");
assert.ok(worker.includes(`/cosmos-circuit-copy.mjs?v=${pkg.version}`), "The service worker does not cache the Cosmos Circuit copy catalog.");
assert.ok(worker.includes(`/circuit-live-ops.mjs?v=${pkg.version}`), "The service worker does not cache local Circuit live operations.");
assert.ok(worker.includes(`/star-path.mjs?v=${pkg.version}`), "The service worker does not cache the Star Path domain.");
assert.ok(worker.includes("/art/celestial-atlas-bg-v1.webp"), "The service worker does not cache the celestial atlas artwork.");
assert.ok(worker.includes('"/art/ranks/"'), "Rank artwork is not configured for lazy offline caching.");
assert.ok(worker.includes('"/art/transitions/"'), "Cinematic artwork is not configured for lazy offline caching.");
assert.ok(worker.includes('"/art/home/"'), "Home artwork is not configured for lazy offline caching.");
assert.ok(worker.includes('"/audio/"'), "Audio packs are not configured for lazy offline caching.");
assert.match(worker, /headers[.]has\("range"\)/, "Range media requests must bypass Cache API writes.");
assert.doesNotMatch(worker, /const SHELL = [^;]+tier-0[1-6]-/, "Rank artwork must not inflate the install shell.");
const workerShell = worker.match(/const SHELL = ([^;]+);/)?.[1] || "";
const workerLazyFiles = worker.match(/const LAZY_FILES = new Set\(([^;]+)\);/)?.[1] || "";
assert.match(workerLazyFiles, /cosmic-interlude[.]css/, "Cosmic Interlude CSS is missing from the exact lazy-file cache boundary.");
assert.doesNotMatch(workerShell, /cosmic-interlude[.]css/, "Cosmic Interlude CSS must stay out of the install shell.");
assert.doesNotMatch(workerShell, /art\/transitions\//, "Responsive Cosmic Gate art must stay out of the install shell.");
assert.doesNotMatch(workerShell, /art\/home\//, "Responsive Home Cosmos art must stay out of the install shell.");
assert.doesNotMatch(workerShell, /audio\//, "Soundtracks and SFX banks must stay out of the install shell.");
assert.equal(celestialAtlasArt.subarray(0, 4).toString("ascii"), "RIFF", "The celestial atlas artwork is not a WebP RIFF file.");
assert.equal(celestialAtlasArt.subarray(8, 12).toString("ascii"), "WEBP", "The celestial atlas artwork is not a valid WebP container.");
for (const { asset, data } of cosmicGateArt) assertCosmicGateAsset(data, asset, asset.path);
for (const { asset, data } of homeCosmosArt) assertHomeCosmosAsset(data, asset, asset.path);
const serverGameHref = "https://example.test/play/";
assertAdaptiveScenePreloadContract(gameHtml, { bootstrapSource: cosmeticPreloadBootstrap, pageHref: serverGameHref });
const serverPreloadResult = runCosmeticPreloadBootstrap(gameHtml, { bootstrapSource: cosmeticPreloadBootstrap, pageHref: serverGameHref });
assertScenePreloadSet(serverPreloadResult, "home", "celestial");
assertScenePreloadSet(serverPreloadResult, "gate", "celestial");
const serverHomePreloads = serverPreloadResult.links.filter((link) => link.dataset.scenePreload === "home");
const serverGatePreloads = serverPreloadResult.links.filter((link) => link.dataset.scenePreload === "gate");
for (const asset of COSMIC_GATE_ASSETS) {
  const cssReference = `./${asset.path}`;
  assert.ok(cosmicGateStyles.includes(cssReference), `The cinematic gate stylesheet does not select ${cssReference}.`);
  const preload = serverGatePreloads.find((link) => link.href.endsWith(`/${asset.name}`));
  assert.ok(preload, `${asset.name} is not adaptively preloaded.`);
  assert.equal(preload.fetchPriority, "high", `${asset.name} preload is not prioritized.`);
  assert.ok(preload.media, `${asset.name} preload must be selected by media conditions.`);
  assert.equal(
    preload.href,
    new URL(cssReference, "https://example.test/cosmic-gate.css").href,
    `${asset.name} preload and CSS request must share one server-beta cache key.`
  );
}
assert.equal(
  serverGatePreloads.find((link) => link.href.endsWith("/cosmic-gate-v2-portrait.webp"))?.media,
  "(orientation: portrait)",
  "All portrait screens must preload the portrait Cosmic Gate."
);
assert.match(cosmicGateStyles, /@media\s*\(orientation:\s*portrait\)\s*\{[\s\S]*cosmic-gate-v2-portrait[.]webp/i, "All portrait screens must select the portrait Cosmic Gate.");
for (const asset of HOME_COSMOS_ASSETS) {
  const cssReference = `./${asset.path}`;
  assert.ok(epicHomeStyles.includes(cssReference), `The home stylesheet does not select ${cssReference}.`);
  const preload = serverHomePreloads.find((link) => link.href.endsWith(`/${asset.name}`));
  assert.ok(preload, `${asset.name} is not adaptively preloaded.`);
  assert.equal(preload.fetchPriority, "high", `${asset.name} preload is not prioritized.`);
  assert.ok(preload.media, `${asset.name} preload must be selected by media conditions.`);
  assert.equal(
    preload.href,
    new URL(cssReference, "https://example.test/epic-home.css").href,
    `${asset.name} preload and CSS request must share one server-beta cache key.`
  );
}
assert.equal(
  serverHomePreloads.find((link) => link.href.endsWith("/home-cosmos-v1-portrait.webp"))?.media,
  "(orientation: portrait), (max-aspect-ratio: 6/5)",
  "Portrait and narrow screens must preload the portrait Home Cosmos."
);
assert.match(epicHomeStyles, /@media\s*\(orientation:\s*portrait\),\s*\(max-aspect-ratio:\s*6\/5\)\s*\{[\s\S]*home-cosmos-v1-portrait[.]webp/i, "Portrait and narrow screens must select the portrait Home Cosmos.");
assert.match(epicHomeStyles, /@media\s*\(orientation:\s*landscape\)\s+and\s+\(aspect-ratio\s*>\s*6\/5\)\s+and\s+\(min-width:\s*2200px\)[\s\S]*min-resolution:\s*1[.]5dppx[\s\S]*home-cosmos-v1-lg[.]webp/i, "Wide-screen Home media rules must exclude the inclusive 6:5 portrait boundary.");
assert.match(epicHomeStyles, /var\(--home-cosmos-art\)/, "The home atmosphere must use its own responsive artwork.");
assert.doesNotMatch(epicHomeStyles, /var\(--cosmic-gate-art\)/, "The home atmosphere must remain separate from the Cosmic Gate artwork.");
assert.doesNotMatch(`${gameHtml}\n${cosmicGateStyles}\n${epicHomeStyles}`, /cosmic-gate-v1[.]webp/, "The blurry v1 Cosmic Gate asset is still referenced.");
for (const [index, art] of rankArt.entries()) {
  assert.equal(art.subarray(0, 4).toString("ascii"), "RIFF", `${rankArtFiles[index]} is not a WebP RIFF file.`);
  assert.equal(art.subarray(8, 12).toString("ascii"), "WEBP", `${rankArtFiles[index]} is not a valid WebP container.`);
}
assert.equal(release.version, pkg.version, "public/release.json does not match the package release version.");
assert.equal(release.buildId, `${pkg.version}+source`, "The checked-in release metadata must use the deterministic source build ID.");
assert.equal(release.channel, "server-beta");
assert.equal(release.runtime, "server");
assert.equal(release.commerceEnabled, false);
assert.equal(manifest.id, "/play/");
assert.equal(manifest.start_url, "/play/");
assert.equal(manifest.scope, "/play/");
assert.ok(manifest.screenshots?.some((entry) => entry.form_factor === "wide"), "The PWA requires a wide install screenshot.");
assert.ok(manifest.screenshots?.some((entry) => entry.form_factor === "narrow"), "The PWA requires a narrow install screenshot.");
for (const [name, document] of [["privacy", privacy], ["terms", terms], ["support", support]]) {
  assert.doesNotMatch(document, /\bTODO\b|\bTBD\b/, `Published ${name} page contains an unresolved placeholder.`);
  assert.match(document, /Oxyfel Games/, `Published ${name} page does not identify the studio.`);
  assert.ok(document.includes(`website.css?v=${pkg.version}`), `Published ${name} page is not tied to the package release version.`);
}
assert.match(license, /All rights reserved/i);
assert.match(notices, /Playwright/);
assert.match(audioProvenance, /no third-party samples/i);
assert.match(audioProvenance, /build-audio-assets[.]py/i);
assert.match(security, /private vulnerability report/i);

for (const image of [...manifest.icons.filter((entry) => entry.type === "image/png"), ...manifest.screenshots]) {
  const relativePath = image.src.replace(/^\//, "");
  const data = await readFile(join(root, "public", relativePath));
  assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${relativePath} is declared as PNG but is not a PNG.`);
  if (/^\d+x\d+$/.test(image.sizes || "")) {
    const [expectedWidth, expectedHeight] = image.sizes.split("x").map(Number);
    assert.equal(data.readUInt32BE(16), expectedWidth, `${relativePath} has the wrong width.`);
    assert.equal(data.readUInt32BE(20), expectedHeight, `${relativePath} has the wrong height.`);
  }
}

const runtimeEntries = await readdir(join(root, "public"), { withFileTypes: true });
for (const entry of runtimeEntries.filter((candidate) => candidate.isFile() && /[.](?:js|mjs)$/.test(candidate.name))) {
  const source = await readFile(join(root, "public", entry.name), "utf8");
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\()\s*["'](\.[^"']+[.]mjs(?:[?][^"']*)?)["']/g)) {
    assert.ok(match[1].endsWith(`?v=${pkg.version}`), `${entry.name} has an unversioned local module import: ${match[1]}`);
  }
}

const commercialRequested = process.env.CONSTELLORE_COMMERCIAL_RELEASE === "true";
if (commercialRequested) {
  const required = [
    "CONSTELLORE_TRADER_ADDRESS_CONFIRMED",
    "CONSTELLORE_SUPPORT_CHANNEL_CONFIRMED",
    "CONSTELLORE_PRIVACY_REVIEW_CONFIRMED",
    "CONSTELLORE_BULGARIAN_ACCOUNTING_CONFIRMED",
    "CONSTELLORE_RECEIPT_VERIFICATION_CONFIRMED",
    "CONSTELLORE_DATABASE_RECOVERY_CONFIRMED"
  ];
  const missing = required.filter((name) => process.env[name] !== "true");
  assert.deepEqual(missing, [], `Commercial release remains locked; missing owner/professional gates: ${missing.join(", ")}`);
}

console.log(`${commercialRequested ? "Commercial" : "Free beta"} release boundary verified for Constellore ${pkg.version}.`);
