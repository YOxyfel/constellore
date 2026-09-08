import assert from "node:assert/strict";
import test from "node:test";
import {
  COMBINING_BOARD_CORE_FILES,
  COMBINING_BOARD_LAZY_FILES,
  SECONDARY_SURFACE_FILES,
  VOYAGE_PROJECTION_LAZY_FILES
} from "../public/secondary-surface-loader.mjs";

test("secondary surface inventory is explicit, unique, and excludes the core app", () => {
  assert.equal(new Set(SECONDARY_SURFACE_FILES).size, SECONDARY_SURFACE_FILES.length);
  assert.equal(SECONDARY_SURFACE_FILES.includes("app.js"), false);
  assert.equal(SECONDARY_SURFACE_FILES.includes("cosmos-circuit-runtime.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("moon-heart-project.css"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("moon-heart-project-runtime.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("moon-heart-project-presentation.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("moon-heart-actions.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("cosmetics-observatory.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("cosmetics-observatory-full-page.css"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("profile-rank-frame.css"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("profile-rank-frame.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("profile-frame-catalog.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("arena-duel-card.css"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("arena-duel-card.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("cosmetic-world-preview.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("cosmetic-world-preview.css"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("stardust-store.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("stardust-store-runtime.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("stardust-store.css"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("cosmic-interlude.css"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("scramble-app-bridge.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("scramble-arena.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.includes("forge-clash.mjs"), true);
  assert.equal(SECONDARY_SURFACE_FILES.some((name) => name.startsWith("planet-hub-")), false,
    "Planet Hub audio, runtime, and cinematic CSS use their dedicated lazy release boundary.");
  assert.equal(SECONDARY_SURFACE_FILES.some((name) => name.includes("?")), false);
});

test("Observatory board and Voyage Projection keep distinct release boundaries", () => {
  assert.deepEqual(COMBINING_BOARD_CORE_FILES, [
    "combining-board.css"
  ]);
  assert.deepEqual(COMBINING_BOARD_LAZY_FILES, [
    "combining-board-domain.mjs",
    "combining-board-runtime.mjs",
    "combining-board-scene.mjs"
  ]);
  assert.deepEqual(VOYAGE_PROJECTION_LAZY_FILES, [
    "voyage-projection-domain.mjs",
    "voyage-projection-runtime.mjs",
    "voyage-projection-scene.mjs",
    "cinematic/voyage-projection-experience.css",
    "cinematic/voyage-projection-experience.mjs",
    "cinematic/voyage-projection-media.mjs",
    "cinematic/voyage-projection-media.json"
  ]);
  assert.equal(COMBINING_BOARD_CORE_FILES.some((name) => SECONDARY_SURFACE_FILES.includes(name)), false);
  assert.equal(COMBINING_BOARD_LAZY_FILES.every((name) => SECONDARY_SURFACE_FILES.includes(name)), true);
  assert.equal(VOYAGE_PROJECTION_LAZY_FILES.every((name) => SECONDARY_SURFACE_FILES.includes(name)), true);
});
