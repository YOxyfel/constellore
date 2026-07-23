import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "dist-pages");
const packageMetadata = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const releaseVersion = packageMetadata.version;
const releaseVersionPattern = releaseVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rootHtml = await readFile(join(output, "index.html"), "utf8");
const websiteApp = await readFile(join(output, "website.js"), "utf8");
const gameHtml = await readFile(join(output, "play", "index.html"), "utf8");
const gameApp = await readFile(join(output, "play", "app.js"), "utf8");
const gameServiceWorker = await readFile(join(output, "play", "service-worker.js"), "utf8");
const gameManifest = JSON.parse(await readFile(join(output, "play", "manifest.webmanifest"), "utf8"));
const rootRelease = JSON.parse(await readFile(join(output, "release.json"), "utf8"));
const gameRelease = JSON.parse(await readFile(join(output, "play", "release.json"), "utf8"));

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
assert.match(rootHtml, /Practice progress stays on this device/i);
assert.match(rootHtml, /destination-based word puzzle/i);
for (const promise of ["You know the word", "See your target", "Combine ideas", "Reach the word", "Word crafting[\\s\\S]{0,80}with a purpose"]) {
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
assert.match(gameHtml, /One visual replay is available\./);
assert.match(gameApp, /async function replayRevealPathOnce\(\)/);
assert.match(gameApp, /await playRevealPath\(route, \{ replay: true \}\)/);
assert.match(gameApp, /state\.reveal\.phase = "exiting"/);
for (const expected of [
  'href="./manifest.webmanifest"',
  'rel="apple-touch-icon" href="./icon-192.png"',
  `href="./styles.css?v=${releaseVersion}"`,
  `src="./app.js?v=${releaseVersion}"`
]) assert.ok(gameHtml.includes(expected), `Missing ${expected} from the Pages game document.`);
assert.equal(bodyDataAttribute(gameHtml, "data-build-version"), releaseVersion);
for (const forbidden of ['href="/manifest', 'href="/styles', 'href="/icon', 'src="/app']) {
  assert.ok(!gameHtml.includes(forbidden), `Root-absolute game path remains: ${forbidden}`);
}

const updatesButton = gameHtml.match(/<button\b(?=[^>]*\bid="updatesButton")[^>]*>/i)?.[0] || "";
assert.ok(updatesButton, "The Pages game is missing the Dev Logs / Updates button.");
assert.match(updatesButton, /\baria-haspopup="dialog"/i);
assert.match(updatesButton, /\baria-controls="updatesDialog"/i);
const updatesDialog = gameHtml.match(/<dialog\b(?=[^>]*\bid="updatesDialog")[^>]*>[\s\S]*?<\/dialog>/i)?.[0] || "";
assert.ok(updatesDialog, "The Pages game is missing the updates dialog.");
const updateEntryCount = (updatesDialog.match(/\bdata-update-entry(?:=|\s|>)/gi) || []).length;
assert.ok(updateEntryCount >= 6, "The Pages updates dialog must retain the complete release history.");
for (const label of ["Release", "Ctrl", "Shift", "Route Signals", "Living Atlas", "Signature Constellations"]) {
  assert.match(updatesDialog, new RegExp(`\\b${label}\\b`, "i"), `The Pages updates dialog is missing the ${label} entry.`);
}
const declaredUpdateCount = Number(updatesDialog.match(/TRANSMISSION ARCHIVE\s*\u00b7\s*(\d+) ENTRIES/i)?.[1]);
assert.equal(declaredUpdateCount, updateEntryCount, "The Pages updates dialog entry count is stale.");
assert.equal((updatesDialog.match(/\bis-latest\b/gi) || []).length, 1, "The Pages updates dialog must have exactly one latest entry.");
assert.equal((updatesDialog.match(/>LATEST</gi) || []).length, 1, "The Pages updates dialog must have exactly one latest badge.");
const latestUpdate = updatesDialog.match(/<li\b(?=[^>]*\bis-latest\b)[^>]*>[\s\S]*?<\/li>/i)?.[0] || "";
assert.ok(latestUpdate, "The Pages updates dialog must identify its latest entry.");
assert.match(latestUpdate, new RegExp(`VERSION ${releaseVersionPattern}`, "i"), "The latest Pages update must name the exact package version.");
assert.match(latestUpdate, /Pages and itch are deterministic local practice without live rankings, accounts, or AI/i, "The latest Pages update must state static-host limitations.");
assert.match(latestUpdate, /Beta progress may reset/i, "The latest Pages update must warn that beta progress can reset.");

for (const file of ["app.js", "home-menu.mjs", "ctrl-hover.mjs", "shift-board.mjs", "frictionless.mjs", "mission-briefing.mjs", "styles.css", "local-beta.mjs", "local-world.mjs", "cosmic-twists.mjs", "recipe-mastery.mjs", "engagement-features.mjs", "first-orbit.mjs", "second-orbit.mjs", "explore-sandbox.mjs", "universe-director.mjs", "constellation-card.mjs", "cosmetic-economy.mjs", "recipe-feedback.mjs", "pending-scores.mjs", "signature-routes.mjs", "living-atlas.mjs", "constellation-voyages.mjs", "recipe-insight.mjs", "community-results.mjs", "cosmic-events.mjs", "manifest.webmanifest", "release.json", "service-worker.js", "icon.svg", "icon-192.png", "icon-512.png", "icon-maskable-512.png"]) {
  assert.ok((await stat(join(output, "play", file))).size > 0, `${file} is missing or empty.`);
}
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
assert.match(gameServiceWorker, new RegExp(`home-menu[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(gameApp, new RegExp(`home-menu[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(gameServiceWorker, /ctrl-hover[.]mjs/);
assert.match(gameServiceWorker, /shift-board[.]mjs/);
assert.match(gameServiceWorker, /frictionless[.]mjs/);
assert.match(gameServiceWorker, /mission-briefing[.]mjs/);
assert.match(gameServiceWorker, /recipe-mastery[.]mjs/);
assert.match(gameServiceWorker, /engagement-features[.]mjs/);
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
assert.doesNotMatch(gameServiceWorker, /keys[.]filter\(\(key\) => key !== CACHE\)/, "The practice worker must not delete unrelated origin caches.");
for (const module of ["engagement-features", "recipe-mastery", "cosmetic-economy", "mission-briefing", "shift-board", "second-orbit", "explore-sandbox", "signature-routes", "living-atlas", "constellation-voyages", "recipe-insight", "community-results", "cosmic-events"]) {
  assert.match(gameServiceWorker, new RegExp(`${module}[.]mjs[?]v=${releaseVersionPattern}`));
  assert.match(gameApp, new RegExp(`${module}[.]mjs[?]v=${releaseVersionPattern}`));
}

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
assert.ok(world.localContentQuality.officialTargetCount >= 30);
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
assert.ok(world.localContentQuality.worldGraph.topology.intentionalTerminalDeadEndCount >= 190);
assert.ok(
  world.localContentQuality.worldGraph.topology.problematicDeadEndCount
    <= world.localContentQuality.worldGraph.topology.problematicDeadEndLimit
);
assert.ok(world.localContentQuality.worldGraph.targets.withMultipleFinalRecipes >= 20);
assert.equal(world.buildLocalGame("reach", 5, "Telescope").ranked, false);

const workflowToken = process.env.GITHUB_TOKEN?.trim();
if (workflowToken) {
  for (const file of await artifactFiles(output)) {
    const contents = await readFile(file);
    assert.ok(!contents.includes(Buffer.from(workflowToken)), `Workflow token leaked into ${file}.`);
  }
}

console.log("GitHub Pages artifact verified: destination-first landing page, local game route, compact world, and subpath-safe assets.");
