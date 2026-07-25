import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "dist-pages");

async function filesIn(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

const files = await filesIn(output);
const records = await Promise.all(files.map(async (path) => {
  const data = await readFile(path);
  return { path: relative(output, path).replaceAll("\\", "/"), bytes: data.length, gzip: gzipSync(data, { level: 9 }).length };
}));
const byPath = new Map(records.map((record) => [record.path, record]));
const required = (path) => {
  const record = byPath.get(path);
  assert.ok(record, `${path} is missing from the Pages performance audit.`);
  return record;
};

const app = required("play/app.js");
const styles = required("play/styles.css");
const simpleStyles = required("play/simple-ui.css");
const world = required("play/local-world.mjs");
const initialCoreGzip = app.gzip + styles.gzip + simpleStyles.gzip + world.gzip;
const totalBytes = records.reduce((sum, record) => sum + record.bytes, 0);
const runtimeArt = records.filter((record) => record.path.startsWith("play/art/"));
const runtimeArtBytes = runtimeArt.reduce((sum, record) => sum + record.bytes, 0);
const rankArt = runtimeArt.filter((record) => record.path.startsWith("play/art/ranks/"));
const shellArt = runtimeArt.filter((record) => !record.path.startsWith("play/art/ranks/"));
const shellArtBytes = shellArt.reduce((sum, record) => sum + record.bytes, 0);
const maximumRankArtBytes = Math.max(0, ...rankArt.map((record) => record.bytes));
const initialArtCeiling = shellArtBytes + maximumRankArtBytes;

assert.ok(app.bytes <= 410_000, `app.js exceeded 410 KB (${app.bytes} bytes). Split new systems into focused modules.`);
assert.ok(styles.bytes + simpleStyles.bytes <= 250_000, `Game CSS exceeded 250 KB (${styles.bytes + simpleStyles.bytes} bytes).`);
assert.ok(world.bytes <= 450_000, `local-world.mjs exceeded 450 KB (${world.bytes} bytes). Use the sparse graph payload.`);
assert.ok(
  rankArt.every((record) => (
    record.path.endsWith("-sm.webp") ? record.bytes <= 50_000
      : record.path.endsWith("-md.webp") ? record.bytes <= 140_000
        : record.path.endsWith("-lg.webp") ? record.bytes <= 320_000
          : false
  )),
  "A responsive rank-art asset exceeded its device-class budget."
);
assert.ok(rankArt.length === 18, `Expected 18 responsive rank-art assets; found ${rankArt.length}.`);
assert.ok(runtimeArtBytes <= 2_400_000, `Packaged runtime art exceeded 2.4 MB (${runtimeArtBytes} bytes).`);
assert.ok(initialArtCeiling <= 500_000, `Worst-case first-view art exceeded 500 KB (${initialArtCeiling} bytes).`);
assert.ok(initialCoreGzip <= 300_000, `Core game transfer exceeded the 300 KB gzip budget (${initialCoreGzip} bytes).`);
assert.ok(totalBytes <= 4_500_000, `Pages artifact exceeded 4.5 MB (${totalBytes} bytes).`);

console.log(`Performance budget passed: app ${app.bytes} B, CSS ${styles.bytes + simpleStyles.bytes} B, world ${world.bytes} B, core gzip ${initialCoreGzip} B, first-view art <= ${initialArtCeiling} B, artifact ${totalBytes} B.`);
