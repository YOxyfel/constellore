import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { startupModuleFiles } from "../scripts/startup-module-files.mjs";

const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));

test("offline startup graph includes transitive imports and reexports while leaving dynamic surfaces lazy", async () => {
  const directory = await mkdtemp(join(tmpdir(), "constellore-startup-"));
  try {
    await writeFile(join(directory, "app.js"), 'import "./bridge.mjs?v=1"; import("./optional.mjs");');
    await writeFile(join(directory, "bridge.mjs"), 'export { value } from "./domain.mjs?v=1";');
    await writeFile(join(directory, "domain.mjs"), 'export const value = 1;');
    // Optional content is deliberately absent: it must not be resolved at startup.
    assert.deepEqual(await startupModuleFiles(directory, ["app.js"]), ["app.js", "bridge.mjs", "domain.mjs"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("generated server install shell covers every actual static game startup dependency", async () => {
  const worker = await readFile(join(publicDirectory, "service-worker.js"), "utf8");
  const match = worker.match(/const SHELL = (\[.*?\])\.map/);
  assert.ok(match, "Generated service worker has an install shell.");
  const shell = new Set(JSON.parse(match[1]).map((path) => path.split("?", 1)[0].replace(/^\//, "")));
  const dependencies = await startupModuleFiles(publicDirectory);
  assert.ok(dependencies.includes("story/target-route-story.mjs"));
  const missing = dependencies.filter((path) => !shell.has(path));
  assert.deepEqual(missing, [], `Offline entry cannot evaluate without these modules: ${missing.join(", ")}`);
});


test("static Home keeps its launch scene when the optional renderer is unavailable", async () => {
  const css = await readFile(join(publicDirectory, "planet-hub.css"), "utf8");
  const inspectionSelectors = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/[^{}]+\.home-orbit__scene\[aria-hidden="false"\]\s*\{/g)
    .filter((selector) => selector.includes(':not([data-home-hub-orbit-body='));
  assert.equal(inspectionSelectors.length, 1, "The body-inspection rule is present.");
  for (const selector of inspectionSelectors[0].slice(0, -1).split(",")) {
    assert.ok(selector.includes("[data-home-hub-orbit-body]:not("),
      "A missing optional renderer must not be interpreted as inspecting another planet.");
  }
});
