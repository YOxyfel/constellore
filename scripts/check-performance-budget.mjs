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
const world = required("play/local-world.mjs");
const initialCoreGzip = app.gzip + styles.gzip + world.gzip;
const totalBytes = records.reduce((sum, record) => sum + record.bytes, 0);

assert.ok(app.bytes <= 400_000, `app.js exceeded 400 KB (${app.bytes} bytes). Split new systems into lazy modules.`);
assert.ok(styles.bytes <= 220_000, `styles.css exceeded 220 KB (${styles.bytes} bytes).`);
assert.ok(world.bytes <= 450_000, `local-world.mjs exceeded 450 KB (${world.bytes} bytes). Use the sparse graph payload.`);
assert.ok(initialCoreGzip <= 300_000, `Core game transfer exceeded the 300 KB gzip budget (${initialCoreGzip} bytes).`);
assert.ok(totalBytes <= 2_500_000, `Pages artifact exceeded 2.5 MB (${totalBytes} bytes).`);

console.log(`Performance budget passed: app ${app.bytes} B, styles ${styles.bytes} B, world ${world.bytes} B, core gzip ${initialCoreGzip} B, artifact ${totalBytes} B.`);
