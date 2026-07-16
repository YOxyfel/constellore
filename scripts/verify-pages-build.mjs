import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "dist-pages");
const rootHtml = await readFile(join(output, "index.html"), "utf8");
const gameHtml = await readFile(join(output, "play", "index.html"), "utf8");

assert.match(rootHtml, /data-beta-url="https:\/\/[^\"]+\/play\/"/);
assert.match(rootHtml, /Your progress stays local/);
assert.match(gameHtml, /data-runtime="local-practice"/);
for (const expected of [
  'href="./manifest.webmanifest"',
  'href="./styles.css?v=1.3.0"',
  'src="./app.js?v=1.3.0"'
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

console.log("GitHub Pages artifact verified: marketing site, local game route, compact world, and subpath-safe assets.");
