import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "dist-pages");
const rootHtml = await readFile(join(output, "index.html"), "utf8");
const gameHtml = await readFile(join(output, "play", "index.html"), "utf8");

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

assert.match(rootHtml, /data-beta-url="https:\/\/[^\"]+\/play\/"/);
assert.match(rootHtml, /Your progress stays local/);
const interestProvider = bodyDataAttribute(rootHtml, "data-interest-provider");
const interestApiUrl = bodyDataAttribute(rootHtml, "data-interest-api-url");
const interestCount = bodyDataAttribute(rootHtml, "data-interest-count");
assert.match(interestCount, /^\d+$/, "The Pages interest count must be a non-negative integer.");
assert.ok(Number.isSafeInteger(Number(interestCount)), "The Pages interest count exceeds the safe integer range.");
if (interestProvider === "first-party") {
  assert.equal(new URL(interestApiUrl).protocol, "https:", "The first-party interest endpoint must use HTTPS.");
} else {
  assert.equal(interestProvider, "github", "Unknown Pages interest provider.");
  assert.equal(interestApiUrl, "", "GitHub fallback must not retain the server-only interest endpoint.");
}
assert.match(gameHtml, /data-runtime="local-practice"/);
for (const expected of [
  'href="./manifest.webmanifest"',
  'href="./styles.css?v=1.6.0"',
  'src="./app.js?v=1.4.2"'
]) assert.ok(gameHtml.includes(expected), `Missing ${expected} from the Pages game document.`);
for (const forbidden of ['href="/manifest', 'href="/styles', 'href="/icon', 'src="/app']) {
  assert.ok(!gameHtml.includes(forbidden), `Root-absolute game path remains: ${forbidden}`);
}

for (const file of ["app.js", "styles.css", "local-beta.mjs", "local-world.mjs", "manifest.webmanifest", "service-worker.js", "icon.svg"]) {
  assert.ok((await stat(join(output, "play", file))).size > 0, `${file} is missing or empty.`);
}

const world = await import(`${pathToFileURL(join(output, "play", "local-world.mjs")).href}?verify=${Date.now()}`);
assert.equal(world.localWorldSize, 423);
assert.equal(world.lookupLocalCombination("Earth", "Water").word, "Mud");
assert.equal(world.lookupLocalCombination("Water", "Water").word, "Ocean");
assert.equal(world.lookupLocalCombination("Fire", "Fire").word, "Inferno");
assert.equal(world.lookupLocalCombination("Species", "Air").word, "Bird");
assert.equal(world.buildLocalGame("reach", 5, "Telescope").ranked, false);

const workflowToken = process.env.GITHUB_TOKEN?.trim();
if (workflowToken) {
  for (const file of await artifactFiles(output)) {
    const contents = await readFile(file);
    assert.ok(!contents.includes(Buffer.from(workflowToken)), `Workflow token leaked into ${file}.`);
  }
}

console.log(`GitHub Pages artifact verified: ${interestProvider} interest signal, local game route, compact world, and subpath-safe assets.`);
