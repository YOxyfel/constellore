import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertCosmeticPacksAreLazy, COSMETIC_PACKS, validateCosmeticPacks } from "./cosmetic-assets.mjs";
import { AUDIO_PACKS, validateAudioPacks } from "./audio-assets.mjs";
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
import { withAssetVersion } from "./release-metadata.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "dist-pages");
const packageMetadata = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const releaseVersion = packageMetadata.version;
const releaseVersionPattern = releaseVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sourceGameHtml = await readFile(join(root, "public", "index.html"), "utf8");
const rootHtml = await readFile(join(output, "index.html"), "utf8");
const websiteApp = await readFile(join(output, "website.js"), "utf8");
const gameHtml = await readFile(join(output, "play", "index.html"), "utf8");
const gameApp = await readFile(join(output, "play", "app.js"), "utf8");
const gameCosmeticPreloadBootstrap = await readFile(join(output, "play", "cosmetic-preload-bootstrap.js"), "utf8");
const gameLocalBeta = await readFile(join(output, "play", "local-beta.mjs"), "utf8");
const gameServiceWorker = await readFile(join(output, "play", "service-worker.js"), "utf8");
const gameCosmicGateStyles = await readFile(join(output, "play", "cosmic-gate.css"), "utf8");
const gameEpicHomeStyles = await readFile(join(output, "play", "epic-home.css"), "utf8");
const gameManifest = JSON.parse(await readFile(join(output, "play", "manifest.webmanifest"), "utf8"));
const rootRelease = JSON.parse(await readFile(join(output, "release.json"), "utf8"));
const gameRelease = JSON.parse(await readFile(join(output, "play", "release.json"), "utf8"));
const expectedDuelApiUrl = validatePublicDuelApiUrl(process.env.PUBLIC_DUEL_API_URL);
const expectedFeedbackApiUrl = validatePublicFeedbackApiUrl(process.env.PUBLIC_FEEDBACK_API_URL);
const STORY_PACK_PATHS = [
  "story/combination-story.mjs",
  "story/combination-story-view.mjs",
  "story/combination-story-runtime.mjs",
  "story/combination-story.css"
];
const GOLDEN_PAIR_PACK_PATHS = [
  "story/golden-fusions/golden-pair-animations.mjs",
  "story/golden-fusions/golden-pair-view.mjs",
  "story/golden-fusions/golden-pair-runtime.mjs",
  "story/golden-fusions/golden-pair.css"
];
const CINEMATIC_RUNTIME_PATHS = [
  "cinematic/first-open-cinematic.mjs",
  "cinematic/first-open-cinematic.css"
];
const CINEMATIC_VIDEO_PATHS = [
  "cinematic/intro-video.mp4",
  "cinematic/intro-video-phone.mp4"
];
const CINEMATIC_PACK_PATHS = [...CINEMATIC_RUNTIME_PATHS, ...CINEMATIC_VIDEO_PATHS];
const SCRAMBLE_LAZY_FILES = [
  "scramble.mjs",
  "scramble-runtime.mjs",
  "scramble-app-bridge.mjs",
  "scramble-arena.mjs",
  "forge-clash.mjs",
  "scramble.css"
];
const COSMIC_INTERLUDE_LAZY_FILE = "cosmic-interlude.css";

function bodyDataAttribute(document, name) {
  const body = document.match(/<body\b[^>]*>/i)?.[0] || "";
  const value = body.match(new RegExp(`${name}="([^"]*)"`))?.[1];
  assert.notEqual(value, undefined, `Missing ${name} from the Pages document.`);
  return value;
}

async function artifactFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await artifactFiles(path));
    else files.push(path);
  }
  return files;
}

function imageDimensions(buffer, file) {
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (pngSignature.every((byte, index) => buffer[index] === byte)) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      if (segmentLength < 2) break;
      offset += segmentLength + 2;
    }
  }
  assert.fail(`${file} is not a supported PNG or JPEG image.`);
}

assert.match(rootHtml, /data-beta-url="https:\/\/[^\"]+\/play\/"/);
assert.match(rootHtml, /Solo progress stays on this device and works offline/i);
assert.match(rootHtml, /Solo progress stays on this device and works offline[\s\S]*Live Scramble duels use the configured online service/i);
assert.match(rootHtml, /free word-combination game/i);
for (const promise of ["Every game gives you one word", "See your target", "Combine ideas", "Reach the word", "Word crafting[\\s\\S]{0,80}with a purpose"]) {
  assert.match(rootHtml, new RegExp(promise, "i"), `The landing page is missing its ${promise} promise.`);
}
assert.equal((rootHtml.match(/class="step reveal"/g) || []).length, 3, "The landing page must explain the loop in exactly three steps.");
assert.match(rootHtml, /class="craft-preview/);
assert.match(rootHtml, /GOAL: STORM/);
for (const recipe of ['"Fire\\|Water"', '"Air\\|Steam"', '"Air\\|Fire"', '"Cloud\\|Energy"']) {
  assert.match(websiteApp, new RegExp(recipe), `The landing preview is missing the verified ${recipe} route.`);
}
assert.ok(rootHtml.includes(`website.css?v=${releaseVersion}`));
assert.ok(rootHtml.includes(`website.js?v=${releaseVersion}`));
assert.equal(bodyDataAttribute(rootHtml, "data-build-version"), releaseVersion);
assert.equal(rootRelease.version, releaseVersion);
assert.equal(gameRelease.version, releaseVersion);
assert.equal(rootRelease.graphVersion, `world-${releaseVersion}`);
for (const policy of ["privacy.html", "terms.html", "support.html"]) {
  const policyHtml = await readFile(join(output, policy), "utf8");
  assert.match(policyHtml, /Oxyfel Games/);
  assert.ok(policyHtml.includes(`website.css?v=${releaseVersion}`));
}
assert.match(rootHtml, /name="twitter:card" content="summary_large_image"/);
assert.match(rootHtml, /property="og:image" content="https:\/\/[^\"]+\/social-card-v3[.]jpg"/);
assert.match(rootHtml, /type="application\/ld[+]json"/);
assert.match(rootHtml, /"@type": \["VideoGame", "SoftwareApplication"\]/);
assert.match(rootHtml, /data-itch-url="[^"]*"/);
assert.doesNotMatch(rootHtml, /fonts[.]googleapis[.]com|fonts[.]gstatic[.]com/);
assert.doesNotMatch(rootHtml, /Live rankings appear inside the beta/i);
assert.doesNotMatch(rootHtml, /wishlist|data-interest-/i, "The consumer landing page must not disguise GitHub interest as a wishlist.");
const itchUrl = bodyDataAttribute(rootHtml, "data-itch-url");
if (itchUrl) {
  const parsedItchUrl = new URL(itchUrl);
  assert.equal(parsedItchUrl.protocol, "https:", "The itch CTA must use HTTPS.");
  assert.ok(parsedItchUrl.hostname === "itch.io" || parsedItchUrl.hostname.endsWith(".itch.io"), "The itch CTA must stay on itch.io.");
}
assert.match(gameHtml, /data-runtime="local-practice"/);
assert.equal(
  bodyDataAttribute(gameHtml, "data-feedback-api"),
  expectedFeedbackApiUrl,
  "The Pages artifact must contain the exact validated PUBLIC_FEEDBACK_API_URL used for this release."
);
assert.equal(
  bodyDataAttribute(gameHtml, "data-duel-api"),
  expectedDuelApiUrl,
  "The Pages artifact must contain the exact validated PUBLIC_DUEL_API_URL used for this release."
);
assert.match(gameHtml, /One visual replay is available\./);
assert.match(gameApp, /async function replayRevealPathOnce\(\)/);
assert.match(gameApp, /await playRevealPath\(route, \{ replay: true \}\)/);
assert.match(gameApp, /state\.reveal\.phase = "exiting"/);
for (const expected of [
  'href="./manifest.webmanifest"',
  'rel="apple-touch-icon" href="./icon-192.png"',
  `href="./styles.css?v=${releaseVersion}"`,
  `href="./simple-ui.css?v=${releaseVersion}"`,
  `href="./cosmic-gate.css?v=${releaseVersion}"`,
  `href="./epic-home.css?v=${releaseVersion}"`,
  `href="./cosmetics.css?v=${releaseVersion}"`,
  `src="./cosmetic-preload-bootstrap.js?v=${releaseVersion}"`,
  `src="./hero-recipes.mjs?v=${releaseVersion}"`,
  `src="./app.js?v=${releaseVersion}"`
]) assert.ok(gameHtml.includes(expected), `Missing ${expected} from the Pages game document.`);
assert.doesNotMatch(gameHtml, /<link[^>]+(?:cosmetics-observatory|cosmos-circuit|cosmic-interlude|scramble)[.]css/i, "Secondary surface CSS must not block the Pages game shell.");
assert.equal(bodyDataAttribute(gameHtml, "data-build-version"), releaseVersion);
for (const forbidden of ['href="/manifest', 'href="/styles', 'href="/simple-ui', 'href="/cosmic-gate', 'href="/epic-home', 'href="/cosmetics', 'href="/cosmos-circuit', 'href="/icon', 'src="/cosmetic-preload-bootstrap', 'src="/hero-recipes', 'src="/app']) {
  assert.ok(!gameHtml.includes(forbidden), `Root-absolute game path remains: ${forbidden}`);
}

const updatesButton = gameHtml.match(/<button\b(?=[^>]*\bid="updatesButton")[^>]*>[\s\S]*?<\/button>/i)?.[0] || "";
assert.ok(updatesButton, "The Pages game is missing the Dev Logs / Updates button.");
assert.match(updatesButton, /\baria-haspopup="dialog"/i);
assert.match(updatesButton, /\baria-controls="updatesDialog"/i);
const updatesDialog = gameHtml.match(/<dialog\b(?=[^>]*\bid="updatesDialog")[^>]*>[\s\S]*?<\/dialog>/i)?.[0] || "";
assert.ok(updatesDialog, "The Pages game is missing the updates dialog.");
const latestUpdateEntry = updatesDialog.match(/<li\b(?=[^>]*\bdata-update-entry)(?=[^>]*\bis-latest)[^>]*>[\s\S]*?<\/li>/i)?.[0] || "";
assert.ok(latestUpdateEntry, "The Pages updates dialog must identify its latest release entry.");
const latestReleaseMajorMinor = latestUpdateEntry.match(/\bVERSION\s+(\d+\.\d+)(?:\.\d+)?(?:-[A-Z0-9.]+)?\b/i)?.[1] || "";
assert.ok(latestReleaseMajorMinor, "The latest Pages update entry must name a semantic release.");
assert.ok(
  updatesButton.includes(`What's new in ${latestReleaseMajorMinor}`),
  "The Pages updates button must name the latest displayed major/minor release."
);
const updateEntryCount = (updatesDialog.match(/\bdata-update-entry(?:=|\s|>)/gi) || []).length;
const sourceUpdatesDialog = sourceGameHtml.match(/<dialog\b(?=[^>]*\bid="updatesDialog")[^>]*>[\s\S]*?<\/dialog>/i)?.[0] || "";
assert.ok(sourceUpdatesDialog, "The source game is missing the updates dialog.");
const sourceUpdateEntryCount = (sourceUpdatesDialog.match(/\bdata-update-entry(?:=|\s|>)/gi) || []).length;
assert.equal(updateEntryCount, sourceUpdateEntryCount, "The Pages updates dialog must retain every source release entry.");
for (const label of ["Release", "Ctrl", "Shift", "Route Signals", "Living Atlas", "Signature Constellations", "Clearer Play, Better Answers", "A Journey That Learns How You Play", "One Play, a Growing Universe", "The Cosmic Gate Opens", "Results Stay With You", "The Cosmos Comes Into Focus", "A New Sky Between Worlds", "Little Games Between Worlds", "A Thought Between Worlds", "One Tap to the Stars", "A Gentle First Light", "A Clearer Finish", "First Paths, Shared Skies", "Your Ideas Can Reach Us", "Shape Your Constellation"]) {
  assert.match(updatesDialog, new RegExp(`\\b${label}\\b`, "i"), `The Pages updates dialog is missing the ${label} entry.`);
}
const declaredUpdateCount = Number(updatesDialog.match(/(\d+)\s+UPDATES/i)?.[1]);
assert.equal(declaredUpdateCount, updateEntryCount, "The Pages updates dialog entry count is stale.");
assert.equal((updatesDialog.match(/\bis-latest\b/gi) || []).length, 1, "The Pages updates dialog must have exactly one latest entry.");
assert.equal((updatesDialog.match(/>LATEST</gi) || []).length, 1, "The Pages updates dialog must have exactly one latest badge.");
const latestUpdate = updatesDialog.match(/<li\b(?=[^>]*\bis-latest\b)[^>]*>[\s\S]*?<\/li>/i)?.[0] || "";
assert.ok(latestUpdate, "The Pages updates dialog must identify its latest entry.");
const sourceLatestUpdate = sourceUpdatesDialog.match(/<li\b(?=[^>]*\bis-latest\b)[^>]*>[\s\S]*?<\/li>/i)?.[0] || "";
assert.ok(sourceLatestUpdate, "The source updates dialog must identify its latest entry.");
const latestReleaseVersion = latestUpdate.match(/\bVERSION\s+([0-9A-Z.-]+)\b/i)?.[1] || "";
const sourceLatestReleaseVersion = sourceLatestUpdate.match(/\bVERSION\s+([0-9A-Z.-]+)\b/i)?.[1] || "";
assert.equal(latestReleaseVersion.toLowerCase(), sourceLatestReleaseVersion.toLowerCase(), "The latest Pages update must preserve the source release version.");
assert.match(updatesDialog, /Shape Your Constellation[\s\S]*eight complete kits[\s\S]*Pixel Frontier[\s\S]*Bubble Reef[\s\S]*Stellar Vanguard/i, "The Pages update history must describe all eight complete cosmetic collections.");
assert.match(updatesDialog, /Locked looks can be previewed[\s\S]*responsive pack art now loads on demand/i, "The Pages update history must describe preview, accessibility, and lazy-loading behavior.");
assert.match(updatesDialog, /Your Ideas Can Reach Us[\s\S]*free, anonymous feedback receiver/i, "The Pages update history must retain anonymous combination feedback.");
assert.match(updatesDialog, /saved locally first[\s\S]*offline retry queue/i, "The Pages update history must retain durable feedback delivery.");
assert.match(updatesDialog, /Golden 50[\s\S]*three-to-seven-combination routes/i, "The Pages update history must describe the curated opening targets.");
assert.match(updatesDialog, /contextual, spoiler-safe constellation card[\s\S]*target and seed/i, "The Pages update history must describe contextual exact-challenge cards.");
assert.match(updatesDialog, /first ten completed games[\s\S]*advanced ranks, competition, mastery, and economy/i, "The Pages update history must describe the protected first-ten flow.");
assert.match(updatesDialog, /behind the scenes/i, "The Pages update history must keep adaptive difficulty private.");
assert.match(updatesDialog, /Pages and itch are deterministic local practice without live rankings, accounts, or AI/i, "The Pages update history must state static-host limitations.");
assert.match(updatesDialog, /Beta progress may reset/i, "The Pages update history must warn that beta progress can reset.");

const rankArtFiles = [
  "tier-01-common",
  "tier-02-dawn",
  "tier-03-nebula",
  "tier-04-aurora",
  "tier-05-rift",
  "tier-06-singularity"
].flatMap((tier) => ["sm", "md", "lg"].map((size) => `art/ranks/${tier}-${size}.webp`));
for (const file of SCRAMBLE_LAZY_FILES) {
  assert.ok((await stat(join(output, "play", file))).size > 0, `${file} is missing or empty.`);
  const source = await readFile(join(root, "public", file), "utf8");
  const built = await readFile(join(output, "play", file), "utf8");
  const expected = file.endsWith(".css")
    ? minifyCss(source)
    : withAssetVersion(source, releaseVersion);
  assert.equal(built, expected, `${file} was not transformed as a versioned lazy Scramble asset.`);
}
{
  const source = await readFile(join(root, "public", COSMIC_INTERLUDE_LAZY_FILE), "utf8");
  const built = await readFile(join(output, "play", COSMIC_INTERLUDE_LAZY_FILE), "utf8");
  assert.equal(built, minifyCss(source), "Cosmic Interlude CSS was not emitted as a minified lazy asset.");
}
for (const file of ["app.js", "default-profile.mjs", "mastery-catalog.mjs", "secondary-surface-loader.mjs", "victory-handoff.mjs", "audio-runtime.mjs", "cosmos-circuit-runtime.mjs", "cosmos-circuit.mjs", "cosmos-circuit-copy.mjs", "circuit-lobby-tabs.mjs", "circuit-live-ops.mjs", "star-path.mjs", "cosmetic-preload-bootstrap.js", "account-profile.mjs", "run-entry.mjs", "hero-recipes.mjs", "cosmic-gate.mjs", "cosmic-quotes.mjs", "cosmic-interludes.mjs", "cosmic-interlude-runtime.mjs", COSMIC_INTERLUDE_LAZY_FILE, "reveal-tree.mjs", "reveal-presentation.mjs", "home-menu.mjs", "home-menu-view.mjs", "profile-rank-surface.mjs", "golden-targets.mjs", "ctrl-hover.mjs", "shift-board.mjs", "frictionless.mjs", "mission-briefing.mjs", "combination-report-delivery.mjs", "route-distance.mjs", "path-guard.mjs", "run-iq.mjs", "adaptive-difficulty.mjs", "remix-progression.mjs", "remix-readiness.mjs", "route-remixes.mjs", "shuffled-start.mjs", "rank-board-art.mjs", "rank-board-art-runtime.mjs", "styles.css", "simple-ui.css", "cosmic-gate.css", "epic-home.css", "cosmos-circuit.css", "cosmetics-observatory.css", "cosmetics-observatory.mjs", "cosmetic-world-preview.css", "cosmetic-world-preview.mjs", "cosmetics.css", "cosmetic-canvas.mjs", "cosmetic-catalog.mjs", "developer-console.css", "developer-console.mjs", "developer-console-runtime.mjs", "share-card-runtime.mjs", "local-beta.mjs", "local-world.mjs", "cosmic-twists.mjs", "recipe-mastery.mjs", "engagement-features.mjs", "first-game-experience.mjs", "first-orbit.mjs", "second-orbit.mjs", "explore-sandbox.mjs", "universe-director.mjs", "constellation-card.mjs", "cosmetic-economy.mjs", "recipe-feedback.mjs", "pending-scores.mjs", "signature-routes.mjs", "living-atlas.mjs", "constellation-voyages.mjs", "recipe-insight.mjs", "community-results.mjs", "cosmic-events.mjs", "manifest.webmanifest", "release.json", "service-worker.js", "icon.svg", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "art/celestial-atlas-bg-v1.webp", ...STORY_PACK_PATHS, ...GOLDEN_PAIR_PACK_PATHS, ...CINEMATIC_PACK_PATHS, ...COSMIC_GATE_ASSETS.map((asset) => asset.path), ...HOME_COSMOS_ASSETS.map((asset) => asset.path), ...COSMETIC_PACKS.flatMap((pack) => pack.assets.map((asset) => asset.path)), ...AUDIO_PACKS.flatMap((pack) => pack.assets.map((asset) => asset.path)), ...rankArtFiles]) {
  assert.ok((await stat(join(output, "play", file))).size > 0, `${file} is missing or empty.`);
}
assert.ok((await stat(join(output, "play", "initial-app-state.mjs"))).size > 0, "initial-app-state.mjs is missing or empty.");
assert.ok((await stat(join(output, "play", "stardust-store.mjs"))).size > 0, "stardust-store.mjs is missing or empty.");
assert.ok((await stat(join(output, "play", "stardust-store.css"))).size > 0, "stardust-store.css is missing or empty.");
for (const file of STORY_PACK_PATHS) {
  const source = await readFile(join(root, "public", file), "utf8");
  const built = await readFile(join(output, "play", file), "utf8");
  const expected = file.endsWith(".css")
    ? minifyCss(source)
    : withAssetVersion(source, releaseVersion);
  assert.equal(built, expected, `${file} was not transformed as a versioned optional story asset.`);
}
for (const file of GOLDEN_PAIR_PACK_PATHS) {
  const source = await readFile(join(root, "public", file), "utf8");
  const built = await readFile(join(output, "play", file), "utf8");
  const expected = file.endsWith(".css")
    ? minifyCss(source)
    : withAssetVersion(source, releaseVersion);
  assert.equal(built, expected, `${file} was not transformed as a versioned Golden Pair asset.`);
}
for (const file of CINEMATIC_RUNTIME_PATHS) {
  const source = await readFile(join(root, "public", file), "utf8");
  const built = await readFile(join(output, "play", file), "utf8");
  const expected = file.endsWith(".css")
    ? minifyCss(source)
    : withAssetVersion(source, releaseVersion);
  assert.equal(built, expected, `${file} was not transformed as a versioned optional cinematic asset.`);
}
for (const file of CINEMATIC_VIDEO_PATHS) {
  assert.deepEqual(
    await readFile(join(output, "play", file)),
    await readFile(join(root, "public", file)),
    `The Pages launch video ${file} does not match the optimized source asset.`
  );
}
await validateCosmeticPacks(join(output, "play"));
await validateAudioPacks(join(output, "play"));
const celestialAtlasArt = await readFile(join(output, "play", "art", "celestial-atlas-bg-v1.webp"));
assert.equal(celestialAtlasArt.subarray(0, 4).toString("ascii"), "RIFF", "The celestial atlas art is not a WebP RIFF file.");
assert.equal(celestialAtlasArt.subarray(8, 12).toString("ascii"), "WEBP", "The celestial atlas art is not a valid WebP container.");
const pagesGameHref = "https://example.test/constellore/play/";
assertAdaptiveScenePreloadContract(gameHtml, { bootstrapSource: gameCosmeticPreloadBootstrap, pageHref: pagesGameHref });
const pagesPreloadResult = runCosmeticPreloadBootstrap(gameHtml, { bootstrapSource: gameCosmeticPreloadBootstrap, pageHref: pagesGameHref });
assertScenePreloadSet(pagesPreloadResult, "home", "celestial");
assertScenePreloadSet(pagesPreloadResult, "gate", "celestial");
const pagesHomePreloads = pagesPreloadResult.links.filter((link) => link.dataset.scenePreload === "home");
const pagesGatePreloads = pagesPreloadResult.links.filter((link) => link.dataset.scenePreload === "gate");
const transitionArtDirectory = join(output, "play", "art", "transitions");
const transitionArtFiles = (await readdir(transitionArtDirectory)).sort((left, right) => left.localeCompare(right, "en"));
assert.deepEqual(
  transitionArtFiles,
  COSMIC_GATE_ASSETS.map((asset) => asset.name).sort((left, right) => left.localeCompare(right, "en")),
  "Pages must ship exactly the three responsive Cosmic Gate assets."
);
for (const asset of COSMIC_GATE_ASSETS) {
  const data = await readFile(join(transitionArtDirectory, asset.name));
  assertCosmicGateAsset(data, asset, asset.path);
  const reference = `./${asset.path}`;
  assert.ok(gameCosmicGateStyles.includes(reference), `Pages cinematic CSS does not select ${reference}.`);
  const preload = pagesGatePreloads.find((link) => link.href.endsWith(`/${asset.name}`));
  assert.ok(preload, `${asset.name} is not adaptively preloaded.`);
  assert.equal(preload.fetchPriority, "high", `${asset.name} preload is not prioritized.`);
  assert.ok(preload.media, `${asset.name} preload must be selected by media conditions.`);
  assert.equal(preload.href, new URL(reference, new URL("cosmic-gate.css", pagesGameHref)).href, `${asset.name} preload and CSS request must share one Pages cache key.`);
}
const homeArtDirectory = join(output, "play", "art", "home");
const homeArtFiles = (await readdir(homeArtDirectory)).sort((left, right) => left.localeCompare(right, "en"));
assert.deepEqual(
  homeArtFiles,
  HOME_COSMOS_ASSETS.map((asset) => asset.name).sort((left, right) => left.localeCompare(right, "en")),
  "Pages must ship exactly the three responsive Home Cosmos assets."
);
for (const asset of HOME_COSMOS_ASSETS) {
  const data = await readFile(join(homeArtDirectory, asset.name));
  assertHomeCosmosAsset(data, asset, asset.path);
  const reference = `./${asset.path}`;
  assert.ok(gameEpicHomeStyles.includes(reference), `Pages home CSS does not select ${reference}.`);
  const preload = pagesHomePreloads.find((link) => link.href.endsWith(`/${asset.name}`));
  assert.ok(preload, `${asset.name} is not adaptively preloaded.`);
  assert.equal(preload.fetchPriority, "high", `${asset.name} preload is not prioritized.`);
  assert.ok(preload.media, `${asset.name} preload must be selected by media conditions.`);
  assert.equal(preload.href, new URL(reference, new URL("epic-home.css", pagesGameHref)).href, `${asset.name} preload and CSS request must share one Pages cache key.`);
}
assert.match(gameEpicHomeStyles, /var\(--home-cosmos-art\)/, "Pages home art must use its own responsive selection.");
assert.doesNotMatch(gameEpicHomeStyles, /var\(--cosmic-gate-art\)/, "Pages home art must remain separate from the Cosmic Gate.");
assert.doesNotMatch(`${gameHtml}\n${gameCosmicGateStyles}\n${gameEpicHomeStyles}`, /cosmic-gate-v1[.]webp/, "Pages still references the blurry v1 Cosmic Gate art.");
for (const file of ["social-card-v3.jpg", "icon.svg"]) assert.ok((await stat(join(output, file))).size > 0, `${file} is missing from the landing artifact.`);
for (const [file, width, height] of [["social-card-v3.jpg", 1200, 630], ["play/icon-192.png", 192, 192], ["play/icon-512.png", 512, 512], ["play/icon-maskable-512.png", 512, 512]]) {
  const dimensions = imageDimensions(await readFile(join(output, file)), file);
  assert.equal(dimensions.width, width, `${file} has the wrong width.`);
  assert.equal(dimensions.height, height, `${file} has the wrong height.`);
}
assert.equal(gameManifest.id, "./");
assert.equal(gameManifest.start_url, "./");
assert.equal(gameManifest.scope, "./");
assert.ok(gameManifest.icons.some((icon) => icon.src === "./icon-192.png" && icon.sizes === "192x192"));
assert.ok(gameManifest.icons.some((icon) => icon.src === "./icon-512.png" && icon.purpose === "any"));
assert.ok(gameManifest.icons.some((icon) => icon.src === "./icon-maskable-512.png" && icon.purpose === "maskable"));
assert.ok(gameManifest.shortcuts.some((shortcut) => shortcut.url === "./?mode=daily"));
assert.ok(gameManifest.shortcuts.some((shortcut) => shortcut.url === "./?mode=explore"));
assert.ok(gameManifest.screenshots.some((screenshot) => screenshot.form_factor === "wide" && screenshot.sizes === "1280x720"));
assert.ok(gameManifest.screenshots.some((screenshot) => screenshot.form_factor === "narrow" && screenshot.sizes === "600x960"));
for (const screenshot of gameManifest.screenshots) assert.ok((await stat(join(output, "play", screenshot.src.replace(/^\.\//, "")))).size > 0);
for (const screenshot of gameManifest.screenshots) {
  const path = join(output, "play", screenshot.src.replace(/^\.\//, ""));
  const png = await readFile(path);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${screenshot.src} is not a PNG.`);
  const [expectedWidth, expectedHeight] = screenshot.sizes.split("x").map(Number);
  assert.equal(png.readUInt32BE(16), expectedWidth, `${screenshot.src} has the wrong width.`);
  assert.equal(png.readUInt32BE(20), expectedHeight, `${screenshot.src} has the wrong height.`);
}
assert.match(gameServiceWorker, /cosmic-twists[.]mjs/);
assert.match(gameServiceWorker, /art\/celestial-atlas-bg-v1[.]webp/);
assert.match(gameServiceWorker, new RegExp(`simple-ui[.]css[?]v=${releaseVersionPattern}`));
assert.match(gameServiceWorker, new RegExp(`cosmic-gate[.]css[?]v=${releaseVersionPattern}`));
assert.match(gameServiceWorker, new RegExp(`epic-home[.]css[?]v=${releaseVersionPattern}`));
assert.match(gameServiceWorker, new RegExp(`home-menu[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(gameApp, new RegExp(`home-menu[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(gameServiceWorker, /ctrl-hover[.]mjs/);
assert.match(gameServiceWorker, /shift-board[.]mjs/);
assert.match(gameServiceWorker, /frictionless[.]mjs/);
assert.match(gameServiceWorker, /mission-briefing[.]mjs/);
assert.match(gameServiceWorker, /combination-report-delivery[.]mjs/);
assert.match(gameServiceWorker, /route-distance[.]mjs/);
assert.match(gameServiceWorker, /run-iq[.]mjs/);
assert.match(gameServiceWorker, /adaptive-difficulty[.]mjs/);
assert.match(gameServiceWorker, /remix-progression[.]mjs/);
assert.match(gameServiceWorker, /remix-readiness[.]mjs/);
assert.match(gameServiceWorker, /route-remixes[.]mjs/);
assert.match(gameServiceWorker, /shuffled-start[.]mjs/);
assert.match(gameServiceWorker, /rank-board-art[.]mjs/);
assert.match(gameServiceWorker, /rank-board-art-runtime[.]mjs/);
assert.match(gameServiceWorker, /cosmic-interludes[.]mjs/);
assert.match(gameServiceWorker, /cosmic-interlude-runtime[.]mjs/);
assert.match(gameServiceWorker, new RegExp(`${COSMIC_INTERLUDE_LAZY_FILE.replaceAll(".", "[.]")}[?]v=${releaseVersionPattern}`));
assert.match(gameServiceWorker, /cosmic-quotes[.]mjs/);
assert.match(gameServiceWorker, /hero-recipes[.]mjs/);
assert.match(gameServiceWorker, new RegExp(`cosmos-circuit-copy[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(gameServiceWorker, new RegExp(`circuit-live-ops[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(gameServiceWorker, new RegExp(`cosmetic-preload-bootstrap[.]js[?]v=${releaseVersionPattern}`));
assert.match(gameServiceWorker, new RegExp(`cosmetic-canvas[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(gameServiceWorker, /cosmetic-catalog[.]mjs/);
assert.match(gameServiceWorker, /cosmetics-observatory[.]mjs/);
assert.match(gameServiceWorker, /cosmetics-observatory[.]css/);
assert.match(gameServiceWorker, /cosmetic-world-preview[.]mjs/);
assert.match(gameServiceWorker, /cosmetic-world-preview[.]css/);
assert.match(gameServiceWorker, /cosmetics[.]css/);
assert.match(gameServiceWorker, /cosmos-circuit-runtime[.]mjs/);
assert.match(gameServiceWorker, /cosmos-circuit[.]mjs/);
assert.match(gameServiceWorker, /cosmos-circuit[.]css/);
assert.match(gameServiceWorker, /star-path[.]mjs/);
for (const file of SCRAMBLE_LAZY_FILES) {
  assert.match(
    gameServiceWorker,
    new RegExp(`${file.replaceAll(".", "[.]")}[?]v=${releaseVersionPattern}`),
    `${file} must be available through the Pages worker's exact lazy-file allowlist.`
  );
}
assertCosmeticPacksAreLazy(gameServiceWorker);
assert.doesNotMatch(gameApp, /\b(?:ensureCosmosCircuit|openCosmosCircuit|COSMOS_CIRCUIT_RELEASE_ENABLED)\b/, "The release shell must not ship staged Cosmos Circuit host glue.");
assert.match(gameApp, /localStorage[.]removeItem\(COSMOS_CIRCUIT_SAVE_KEY\)/, "Legacy Cosmos Circuit state cleanup must remain available.");
assert.match(gameApp, new RegExp(`cosmic-interlude-runtime[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(gameServiceWorker, /[.]\/art\/ranks\//);
assert.match(gameServiceWorker, /[.]\/art\/transitions\//);
assert.match(gameServiceWorker, /[.]\/art\/home\//);
assert.doesNotMatch(gameServiceWorker, /const SHELL = [^;]+tier-0[1-6]-/);
const gameWorkerShell = gameServiceWorker.match(/const SHELL = ([^;]+);/)?.[1] || "";
const gameWorkerLazyFiles = gameServiceWorker.match(/const LAZY_FILES = new Set\(([^;]+)\);/)?.[1] || "";
for (const file of SCRAMBLE_LAZY_FILES) {
  assert.match(gameWorkerLazyFiles, new RegExp(file.replaceAll(".", "[.]")), `${file} is missing from the Pages lazy-file cache boundary.`);
}
assert.match(gameWorkerLazyFiles, /cosmic-interlude[.]css/, "Cosmic Interlude CSS is missing from the Pages lazy-file cache boundary.");
assert.match(gameWorkerLazyFiles, /cosmetic-world-preview[.]mjs/, "The immersive cosmetic preview runtime is missing from the Pages lazy-file cache boundary.");
assert.match(gameWorkerLazyFiles, /cosmetic-world-preview[.]css/, "The immersive cosmetic preview CSS is missing from the Pages lazy-file cache boundary.");
assert.doesNotMatch(gameWorkerShell, /(?:scramble(?:-(?:runtime|arena))?|forge-clash)[.](?:mjs|css)/, "Scramble must not block the Pages install shell.");
assert.doesNotMatch(gameWorkerShell, /cosmic-interlude[.]css/, "Cosmic Interlude CSS must not block the Pages install shell.");
assert.doesNotMatch(gameWorkerShell, /cosmetic-world-preview[.](?:mjs|css)/, "The immersive cosmetic preview must not block the Pages install shell.");
assert.match(gameWorkerShell, /victory-handoff[.]mjs/, "The core victory handoff policy must be available offline with app.js.");
assert.doesNotMatch(gameWorkerShell, /art\/transitions\//, "Responsive Cosmic Gate art must stay out of the Pages install shell.");
assert.doesNotMatch(gameWorkerShell, /art\/home\//, "Responsive Home Cosmos art must stay out of the Pages install shell.");
assert.doesNotMatch(gameWorkerShell, /audio\//, "Soundtracks and SFX banks must stay out of the Pages install shell.");
assert.doesNotMatch(gameWorkerShell, /story\//, "Combination Story must stay out of the Pages install shell.");
assert.doesNotMatch(gameWorkerShell, /cinematic\//, "The first-open cinematic must stay out of the Pages install shell.");
assert.match(gameServiceWorker, /(?:[.]\/|\/)audio\//, "Audio packs must be runtime-cached only after playback is activated.");
assert.match(gameServiceWorker, /const LAZY_PREFIXES = [^;]*[.]\/story\//, "Combination Story must be runtime-cached only after activation.");
assert.match(gameServiceWorker, /const LAZY_PREFIXES = [^;]*[.]\/cinematic\//, "The first-open cinematic must be runtime-cached only after activation.");
assert.match(gameServiceWorker, /headers[.]has\("range"\)/, "Range media requests must bypass Cache API writes.");
assert.match(gameServiceWorker, /recipe-mastery[.]mjs/);
assert.match(gameServiceWorker, /engagement-features[.]mjs/);
assert.match(gameServiceWorker, /account-profile[.]mjs/);
assert.match(gameServiceWorker, /first-game-experience[.]mjs/);
assert.match(gameServiceWorker, /first-orbit[.]mjs/);
assert.match(gameServiceWorker, /universe-director[.]mjs/);
assert.match(gameServiceWorker, /constellation-card[.]mjs/);
assert.match(gameServiceWorker, /cosmetic-economy[.]mjs/);
assert.match(gameServiceWorker, /recipe-feedback[.]mjs/);
assert.match(gameServiceWorker, /pending-scores[.]mjs/);
assert.match(gameServiceWorker, /signature-routes[.]mjs/);
assert.match(gameServiceWorker, /living-atlas[.]mjs/);
assert.match(gameServiceWorker, /constellation-voyages[.]mjs/);
assert.match(gameServiceWorker, /recipe-insight[.]mjs/);
assert.match(gameServiceWorker, /community-results[.]mjs/);
assert.match(gameServiceWorker, /cosmic-events[.]mjs/);
assert.match(gameServiceWorker, /CACHE_PREFIX/);
assert.match(gameServiceWorker, /key[.]startsWith\(CACHE_PREFIX\)/);
assert.match(gameServiceWorker, /constellore-shell-v24/);
assert.match(gameServiceWorker, /LEGACY_CACHES[.]has\(key\)/);
assert.match(gameServiceWorker, new RegExp(`CACHE_PREFIX[}]${releaseVersionPattern}`));
assert.match(gameServiceWorker, /response[.]ok/);
assert.match(gameServiceWorker, /response[.]type !== "opaque"/);
assert.match(gameServiceWorker, /url[.]origin !== self[.]location[.]origin/, "Cross-origin duel requests must bypass the practice worker.");
if (expectedDuelApiUrl) {
  assert.ok(!gameServiceWorker.includes(expectedDuelApiUrl), "The public duel API must be configured in HTML, never cached into the worker.");
}
assert.doesNotMatch(gameServiceWorker, /keys[.]filter\(\(key\) => key !== CACHE\)/, "The practice worker must not delete unrelated origin caches.");
for (const module of ["engagement-features", "recipe-mastery", "cosmetic-economy", "mission-briefing", "shift-board", "second-orbit", "explore-sandbox", "signature-routes", "living-atlas", "constellation-voyages", "recipe-insight", "community-results", "cosmic-events", "adaptive-difficulty", "remix-progression"]) {
  assert.match(gameServiceWorker, new RegExp(`${module}[.]mjs[?]v=${releaseVersionPattern}`));
  assert.match(gameApp, new RegExp(`${module}[.]mjs[?]v=${releaseVersionPattern}`));
}
assert.match(gameServiceWorker, new RegExp(`route-remixes[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(gameLocalBeta, new RegExp(`route-remixes[.]mjs[?]v=${releaseVersionPattern}`));

const playRoot = resolve(output, "play");
const visitedModules = new Set();
async function verifyLocalModuleGraph(modulePath) {
  const resolvedModule = resolve(modulePath);
  if (visitedModules.has(resolvedModule)) return;
  visitedModules.add(resolvedModule);
  const source = await readFile(resolvedModule, "utf8");
  const imports = source.matchAll(/(?:\bfrom\s*|\bimport\s*\()\s*["'](\.[^"']+)["']/g);
  for (const match of imports) {
    const specifier = match[1].split(/[?#]/, 1)[0];
    const dependency = resolve(dirname(resolvedModule), specifier);
    const pathFromPlay = relative(playRoot, dependency);
    assert.ok(pathFromPlay && !pathFromPlay.startsWith("..") && !isAbsolute(pathFromPlay), `Module import escapes the Pages play artifact: ${match[1]}`);
    assert.ok((await stat(dependency)).size > 0, `Imported Pages module is missing or empty: ${pathFromPlay}`);
    if (/\.(?:m?js)$/i.test(dependency)) await verifyLocalModuleGraph(dependency);
  }
}
await verifyLocalModuleGraph(join(playRoot, "app.js"));
await verifyLocalModuleGraph(join(playRoot, "story", "combination-story-runtime.mjs"));
await verifyLocalModuleGraph(join(playRoot, "story", "golden-fusions", "golden-pair-runtime.mjs"));

const world = await import(`${pathToFileURL(join(output, "play", "local-world.mjs")).href}?verify=${Date.now()}`);
const worldSource = await readFile(join(output, "play", "local-world.mjs"), "utf8");
assert.doesNotMatch(worldSource, /\"matrix\":/, "Pages must ship the sparse World Graph rather than a dense recipe matrix.");
assert.match(worldSource, /new Map\(payload[.]recipes[.]map/);
assert.ok(Buffer.byteLength(worldSource) < 450_000, "The sparse local World Graph exceeded 450 KB.");
assert.ok(world.localWorldSize >= 700);
assert.ok(world.localRecipeCount >= 875);
assert.match(world.localGraphVersion, /^3\./);
assert.equal(world.lookupLocalCombination("Earth", "Water").word, "Mud");
assert.equal(world.lookupLocalCombination("Water", "Water").word, "Ocean");
assert.equal(world.lookupLocalCombination("Fire", "Fire").word, "Inferno");
assert.equal(world.lookupLocalCombination("Species", "Air").word, "Bird");
assert.ok(world.lookupLocalCombination("Great Wall", "Earth").word);
assert.equal(world.lookupLocalCombination("Dragon", "Telescope"), null);
assert.equal(world.localContentQuality.officialTargetCount, 500);
assert.equal(world.localContentQuality.dailyRotation.cycleLength, 90);
assert.equal(world.localContentQuality.dailyRotation.distinctChallenges, 90);
assert.ok(world.localContentQuality.dailyRotation.distinctTargets >= 28);
assert.ok(world.localContentQuality.authoredCoverage.authoredPairs >= 875);
assert.ok(world.localContentQuality.intentCoverage.attempts >= 500);
assert.equal(world.localContentQuality.intentCoverage.weightedCoverage, 1);
assert.ok(world.localContentQuality.outputConcentration.distinctOutputs >= 715);
assert.ok(world.localContentQuality.outputConcentration.maximumPairsPerOutput <= 5);
assert.equal(world.localContentQuality.routeValidity.failures.length, 0);
assert.equal(world.localContentQuality.worldGraph.validationIssues.length, 0);
assert.ok(world.localContentQuality.worldGraph.topology.intentionalEndpointCount >= 190);
assert.ok(
  world.localContentQuality.worldGraph.topology.intentionalTerminalDeadEndCount
    <= world.localContentQuality.worldGraph.topology.intentionalEndpointCount
);
assert.ok(
  world.localContentQuality.worldGraph.topology.problematicDeadEndCount
    <= world.localContentQuality.worldGraph.topology.problematicDeadEndLimit
);
assert.ok(world.localContentQuality.worldGraph.targets.withMultipleFinalRecipes >= 250);
assert.equal(world.buildLocalGame("reach", 5, "Telescope").ranked, false);

const localBeta = await import(`${pathToFileURL(join(playRoot, "local-beta.mjs")).href}?verify=${Date.now()}`);
const timedPreview = await localBeta.localRequest("/api/run/preview", {
  method: "POST",
  body: JSON.stringify({
    mode: "quick",
    seed: 734_251,
    routeProgression: {
      version: 2,
      masteryPoints: 200,
      completedChallenges: 8,
      rankId: "gold"
    }
  })
});
const pendingTimedRun = await localBeta.localRequest("/api/run/start", {
  method: "POST",
  body: JSON.stringify({
    previewToken: timedPreview.previewToken,
    deferActivation: true
  })
});
assert.equal(pendingTimedRun.run.activationPending, true);
assert.equal(pendingTimedRun.run.deadlineAt, null);
await assert.rejects(
  localBeta.localRequest("/api/combine", {
    method: "POST",
    body: JSON.stringify({
      a: "Earth",
      b: "Water",
      runId: pendingTimedRun.run.id,
      runToken: pendingTimedRun.run.token
    })
  }),
  (error) => error.code === "run_not_active"
);
const activatedTimedRun = await localBeta.localRequest("/api/run/activate", {
  method: "POST",
  body: JSON.stringify({
    runId: pendingTimedRun.run.id,
    runToken: pendingTimedRun.run.token
  })
});
assert.equal(activatedTimedRun.run.activationPending, false);
assert.equal(
  Date.parse(activatedTimedRun.run.deadlineAt) - Date.parse(activatedTimedRun.run.startedAt),
  timedPreview.game.timeLimit * 1_000
);
const repeatedActivation = await localBeta.localRequest("/api/run/activate", {
  method: "POST",
  body: JSON.stringify({
    runId: pendingTimedRun.run.id,
    runToken: pendingTimedRun.run.token
  })
});
assert.equal(repeatedActivation.run.startedAt, activatedTimedRun.run.startedAt);
assert.equal(repeatedActivation.run.deadlineAt, activatedTimedRun.run.deadlineAt);

const workflowToken = process.env.GITHUB_TOKEN?.trim();
if (workflowToken) {
  for (const file of await artifactFiles(output)) {
    const contents = await readFile(file);
    assert.ok(!contents.includes(Buffer.from(workflowToken)), `Workflow token leaked into ${file}.`);
  }
}

console.log("GitHub Pages artifact verified: plain-language landing page, local game, compact world, and subpath-safe assets.");
