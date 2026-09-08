import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { assertCosmeticPacksAreLazy, COSMETIC_PACKS } from "./cosmetic-assets.mjs";
import { AUDIO_PACKS } from "./audio-assets.mjs";
import { validatePublicDuelApiUrl } from "./public-duel-config.mjs";
import { createDeterministicZip, sha256 } from "./release-archive.mjs";
import { writeReleaseMetadata } from "./release-metadata.mjs";
import { assertPlanetHubReleaseInventory } from "./planet-hub-packaging.mjs";

const execute = promisify(execFile);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pagesOutput = join(root, "dist-pages");
const output = join(root, "dist-itch");
const siteOutput = join(output, "site");
const packageMetadata = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const artifactName = `constellore-html5-v${packageMetadata.version}.zip`;
const duelApiUrl = validatePublicDuelApiUrl(process.env.PUBLIC_DUEL_API_URL);

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort((left, right) => relative(directory, left).localeCompare(relative(directory, right), "en"));
}

function archivePath(path) {
  return relative(siteOutput, path).replaceAll("\\", "/");
}

await execute(process.execPath, [join(root, "scripts", "build-pages.mjs")], {
  cwd: root,
  windowsHide: true,
  env: {
    ...process.env,
    GITHUB_REPOSITORY: "offline-build",
    GITHUB_TOKEN: "",
    PAGES_BASE_URL: "https://yoxyfel.github.io/constellore/",
    PUBLIC_BETA_URL: "",
    PUBLIC_ITCH_URL: "",
    PUBLIC_DUEL_API_URL: duelApiUrl
  }
});

await rm(output, { recursive: true, force: true });
await mkdir(siteOutput, { recursive: true });
await cp(join(pagesOutput, "play"), siteOutput, { recursive: true, force: true });

let gameHtml = await readFile(join(siteOutput, "index.html"), "utf8");
gameHtml = gameHtml
  .replace(/\s*<link rel="canonical"[^>]*>\r?\n/i, "\n")
  .replace(/\s*<meta property="og:url"[^>]*>\r?\n/i, "\n");
await writeFile(join(siteOutput, "index.html"), gameHtml, "utf8");
await writeReleaseMetadata(join(siteOutput, "release.json"), { channel: "itch-html5", runtime: "local-practice" });

const runtimeFiles = await listFiles(siteOutput);
const runtimePaths = new Set(runtimeFiles.map(archivePath));
assertPlanetHubReleaseInventory([...runtimePaths], "itch staging directory");
for (const pack of COSMETIC_PACKS) {
  for (const asset of pack.assets) {
    assert.ok(runtimePaths.has(asset.path), `The itch package is missing on-demand cosmetic asset ${asset.path}.`);
  }
}
for (const pack of AUDIO_PACKS) {
  for (const asset of pack.assets) {
    assert.ok(runtimePaths.has(asset.path), `The itch package is missing on-demand audio asset ${asset.path}.`);
  }
}
assertCosmeticPacksAreLazy(await readFile(join(siteOutput, "service-worker.js"), "utf8"));
const runtimeEntries = await Promise.all(runtimeFiles.map(async (path) => {
  const data = await readFile(path);
  return { path: archivePath(path), data, bytes: data.length, sha256: sha256(data) };
}));
const releaseManifest = {
  schemaVersion: 1,
  package: "constellore-html5",
  gameVersion: packageMetadata.version,
  channel: "public-beta",
  platform: "itch.io-html5",
  runtime: "local-practice",
  entrypoint: "index.html",
  productBoundary: {
    soloPlay: "local-offline",
    soloProgressLocalOnly: true,
    liveDuels: "online-only",
    duelRatingServerBacked: true,
    duelApiConfigured: Boolean(duelApiUrl),
    liveAi: false,
    scoreUpload: false,
    payments: false,
    rewardedAds: false,
    crossDeviceAccount: false
  },
  files: runtimeEntries.map(({ path, bytes, sha256: digest }) => ({ path, bytes, sha256: digest }))
};
const manifestData = Buffer.from(`${JSON.stringify(releaseManifest, null, 2)}\n`, "utf8");
await writeFile(join(siteOutput, "release-manifest.json"), manifestData);

const checksumEntries = [...runtimeEntries.map(({ path, data }) => ({ path, data })), { path: "release-manifest.json", data: manifestData }]
  .sort((left, right) => left.path.localeCompare(right.path, "en"));
const checksumsData = Buffer.from(`${checksumEntries.map((entry) => `${sha256(entry.data)}  ${entry.path}`).join("\n")}\n`, "utf8");
await writeFile(join(siteOutput, "SHA256SUMS.txt"), checksumsData);

const archiveEntries = [...checksumEntries, { path: "SHA256SUMS.txt", data: checksumsData }]
  .sort((left, right) => left.path.localeCompare(right.path, "en"));
const archive = createDeterministicZip(archiveEntries);
const repeatedArchive = createDeterministicZip(archiveEntries);
assert.deepEqual(archive, repeatedArchive, "The itch ZIP writer did not produce deterministic bytes.");

await mkdir(output, { recursive: true });
const artifactPath = join(output, artifactName);
await writeFile(artifactPath, archive);
const artifactDigest = sha256(archive);
await writeFile(`${artifactPath}.sha256`, `${artifactDigest}  ${artifactName}\n`, "utf8");

console.log(`Built deterministic itch HTML5 package: ${artifactPath}`);
console.log(`SHA-256: ${artifactDigest}`);
console.log(duelApiUrl ? `Live Scramble duels: ${duelApiUrl}` : "Live Scramble duels: unavailable; solo play remains local/offline.");
console.log("Upload the versioned ZIP itself; do not upload the dist-itch/site folder.");
