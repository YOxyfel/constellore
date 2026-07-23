import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { packageMetadata } from "./release-metadata.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = await packageMetadata();
const read = (path) => readFile(join(root, path), "utf8");
const [gameHtml, websiteHtml, worker, manifestSource, releaseSource, privacy, terms, support, license, notices, security] = await Promise.all([
  read("public/index.html"), read("Website/index.html"), read("public/service-worker.js"), read("public/manifest.webmanifest"),
  read("public/release.json"),
  read("Website/privacy.html"), read("Website/terms.html"), read("Website/support.html"),
  read("LICENSE.md"), read("THIRD_PARTY_NOTICES.md"), read("SECURITY.md")
]);
const manifest = JSON.parse(manifestSource);
const release = JSON.parse(releaseSource);

assert.ok(gameHtml.includes(`data-build-version="${pkg.version}"`), "Run npm run release:sync before packaging: game build version is stale.");
assert.ok(gameHtml.includes(`/app.js?v=${pkg.version}`), "The game app asset is not tied to the package release version.");
assert.ok(gameHtml.includes(`/styles.css?v=${pkg.version}`), "The game stylesheet is not tied to the package release version.");
assert.ok(websiteHtml.includes(`data-build-version="${pkg.version}"`), "Run npm run release:sync before packaging: website build version is stale.");
assert.ok(websiteHtml.includes(`website.css?v=${pkg.version}`), "The website stylesheet is not tied to the package release version.");
assert.ok(websiteHtml.includes(`website.js?v=${pkg.version}`), "The website script is not tied to the package release version.");
assert.ok(worker.includes(`\${CACHE_PREFIX}${pkg.version}`), "The service-worker cache does not match the package release version.");
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
