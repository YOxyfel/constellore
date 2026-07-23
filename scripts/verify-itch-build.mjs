import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDeterministicZip, readZip, sha256 } from "./release-archive.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageMetadata = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const releaseVersionPattern = packageMetadata.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const artifactName = `constellore-html5-v${packageMetadata.version}.zip`;
const artifactPath = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(root, "dist-itch", artifactName);
const archive = await readFile(artifactPath);
assert.ok((await stat(artifactPath)).size > 100_000, "The itch package is unexpectedly small.");

const sidecar = await readFile(`${artifactPath}.sha256`, "utf8");
assert.equal(sidecar, `${sha256(archive)}  ${artifactName}\n`, "The artifact checksum sidecar does not match the ZIP.");

const entries = readZip(archive);
assert.deepEqual(archive, createDeterministicZip(entries), "The itch package is not in canonical deterministic ZIP form.");
const files = new Map(entries.map((entry) => [entry.path, entry.data]));
for (const required of [
  "index.html", "app.js", "home-menu.mjs", "second-orbit.mjs", "explore-sandbox.mjs", "styles.css", "local-beta.mjs", "local-world.mjs", "release.json", "service-worker.js", "manifest.webmanifest",
  "signature-routes.mjs", "living-atlas.mjs", "constellation-voyages.mjs", "recipe-insight.mjs", "community-results.mjs", "cosmic-events.mjs",
  "icon.svg", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "release-manifest.json", "SHA256SUMS.txt"
]) assert.ok(files.has(required), `The itch package is missing ${required}.`);

for (const forbidden of ["server.mjs", "game-services.mjs", ".env", "package.json", "data/constellore.json"]) {
  assert.ok(!files.has(forbidden), `Server or private file leaked into the itch package: ${forbidden}`);
}

const html = files.get("index.html").toString("utf8");
assert.match(html, /data-runtime="local-practice"/);
assert.match(html, /LOCAL PRACTICE · SAVED ON THIS DEVICE · NO PAYMENTS/);
assert.match(html, /rel="apple-touch-icon" href="[.]\/icon-192[.]png"/);
assert.match(html, new RegExp(`href="[.]\\/styles[.]css[?]v=${releaseVersionPattern}"`));
assert.match(html, new RegExp(`src="[.]\\/app[.]js[?]v=${releaseVersionPattern}"`));
assert.ok((html.match(/\bdata-update-entry(?:=|\s|>)/gi) || []).length >= 6, "The itch build must ship the complete Dev Log.");
const latestUpdate = html.match(/<li\b(?=[^>]*\bis-latest\b)[^>]*>[\s\S]*?<\/li>/i)?.[0] || "";
assert.match(latestUpdate, new RegExp(`VERSION ${releaseVersionPattern}`, "i"), "The itch build must identify the package version as its latest update.");
assert.match(latestUpdate, /Pages and itch are deterministic local practice without live rankings, accounts, or AI/i);
assert.doesNotMatch(html, /rel="canonical"|property="og:url"/i, "The portable itch package must not claim the Pages URL as canonical.");
assert.doesNotMatch(html, /fonts[.]googleapis[.]com|fonts[.]gstatic[.]com/);
for (const forbiddenPath of ['href="/manifest', 'href="/styles', 'href="/icon', 'src="/app']) {
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
assert.match(worker, new RegExp(`home-menu[.]mjs[?]v=${releaseVersionPattern}`));
assert.match(worker, /key[.]startsWith\(CACHE_PREFIX\)/);
assert.match(worker, /response[.]ok/);
assert.match(worker, new RegExp(`CACHE_PREFIX[}]${releaseVersionPattern}`));
for (const module of ["second-orbit", "explore-sandbox", "signature-routes", "living-atlas", "constellation-voyages", "recipe-insight", "community-results", "cosmic-events"]) {
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
  liveAi: false,
  scoreUpload: false,
  payments: false,
  rewardedAds: false,
  crossDeviceAccount: false,
  localProgressOnly: true
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
console.log(`${entries.length} files · local practice only · deterministic ZIP · SHA-256 ${sha256(archive)}`);
