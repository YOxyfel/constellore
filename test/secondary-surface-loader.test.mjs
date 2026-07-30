import assert from "node:assert/strict";
import test from "node:test";
import { SECONDARY_SURFACE_FILES } from "../public/secondary-surface-loader.mjs";

test("secondary surface inventory is explicit, unique, and excludes the core app", () => {
  assert.equal(new Set(SECONDARY_SURFACE_FILES).size, SECONDARY_SURFACE_FILES.length);
  assert.equal(SECONDARY_SURFACE_FILES.includes("app.js"), false);
  assert.equal(SECONDARY_SURFACE_FILES.includes("cosmos-circuit-runtime.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("cosmetics-observatory.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("cosmetic-world-preview.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("cosmetic-world-preview.css"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("stardust-store.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("stardust-store-runtime.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("stardust-store.css"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("cosmic-interlude.css"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("scramble-app-bridge.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("scramble-arena.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("forge-clash.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.some((name) => name.includes("?")), false);
});
