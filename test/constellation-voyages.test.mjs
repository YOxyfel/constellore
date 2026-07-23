import assert from "node:assert/strict";
import test from "node:test";

import {
  CONSTELLATION_VOYAGES_VERSION,
  MAX_CONSTELLATION_VOYAGES,
  MAX_VOYAGE_CHAPTERS,
  advanceVoyageProgress,
  constellationVoyage,
  constellationVoyageCatalog,
  currentVoyageStage,
  sanitizeVoyageProgress,
  voyageProgress
} from "../public/constellation-voyages.mjs";
import { reachableFromStarters, solutionRoute } from "../server.mjs";

test("Voyages contain several curated stories and the required city chain", () => {
  const catalog = constellationVoyageCatalog();
  assert.ok(catalog.length >= 4 && catalog.length <= MAX_CONSTELLATION_VOYAGES);
  const city = constellationVoyage("FIRST CITIES!!");
  assert.ok(city);
  assert.deepEqual(city.chapters.map((chapter) => chapter.target), ["Mud", "Brick", "House", "Village", "City"]);
  assert.ok(catalog.every((voyage) => voyage.chapters.length >= 4 && voyage.chapters.length <= MAX_VOYAGE_CHAPTERS));
  assert.ok(catalog.every((voyage) => voyage.summary && voyage.law?.presentationOnly === true));
  assert.ok(catalog.every((voyage) => voyage.chapters.every((chapter, index) => chapter.chapter === index + 1 && chapter.story)));
});

test("every chapter uses a real starter-reachable authored target", () => {
  const reachable = new Set([...reachableFromStarters().values()].map((word) => word.toLocaleLowerCase("en-US")));
  for (const voyage of constellationVoyageCatalog()) {
    for (const chapter of voyage.chapters) {
      assert.ok(reachable.has(chapter.target.toLocaleLowerCase("en-US")), `${chapter.target} must be reachable`);
      assert.ok(solutionRoute(chapter.target)?.length >= 1, `${chapter.target} must have an authored route`);
    }
  }
});

test("catalog copies are defensive and contain presentation laws rather than mechanics", () => {
  const first = constellationVoyageCatalog();
  first[0].title = "Mutated";
  first[0].chapters[0].target = "Cheat";
  first[0].law.name = "Score Doubler";
  assert.notEqual(constellationVoyageCatalog()[0].title, "Mutated");
  assert.notEqual(constellationVoyageCatalog()[0].chapters[0].target, "Cheat");

  const keys = new Set(first.flatMap((voyage) => [
    ...Object.keys(voyage),
    ...Object.keys(voyage.law),
    ...voyage.chapters.flatMap(Object.keys)
  ]));
  for (const forbidden of ["recipe", "recipes", "score", "reward", "ranked", "multiplier", "moveLimit", "timeLimit", "leaderboard"]) {
    assert.equal(keys.has(forbidden), false);
  }
});

test("hostile persisted progress is reduced to fixed, bounded chapter counters", () => {
  const clean = sanitizeVoyageProgress({
    version: 999,
    voyages: {
      "first-cities": { completed: 1e99, injected: "discard" },
      "living-canopy": -9,
      "storm-circuit": "2.9",
      "ocean-memory": Number.NaN,
      __proto__: { completed: 8 },
      unknown: { completed: 4 }
    },
    score: 999999
  });
  assert.equal(clean.version, CONSTELLATION_VOYAGES_VERSION);
  assert.deepEqual(Object.keys(clean), ["version", "voyages"]);
  assert.deepEqual(Object.keys(clean.voyages).sort(), constellationVoyageCatalog().map((voyage) => voyage.id).sort());
  assert.deepEqual(clean.voyages["first-cities"], { completed: 5 });
  assert.deepEqual(clean.voyages["living-canopy"], { completed: 0 });
  assert.deepEqual(clean.voyages["storm-circuit"], { completed: 2 });
  assert.deepEqual(clean.voyages["ocean-memory"], { completed: 0 });
  assert.equal("unknown" in clean.voyages, false);
});

test("current stages are deterministic and chapters can advance only in order", () => {
  const initial = sanitizeVoyageProgress({});
  const stage = currentVoyageStage("first-cities", initial);
  assert.deepEqual(currentVoyageStage("first-cities", initial), stage);
  assert.equal(stage.target, "Mud");
  assert.equal(stage.number, 1);
  assert.equal(stage.total, 5);

  const skipped = advanceVoyageProgress(initial, { voyageId: "first-cities", target: "City" });
  assert.equal(skipped.advanced, false);
  assert.equal(skipped.reason, "wrong_target");
  assert.equal(skipped.currentStage.target, "Mud");

  const advanced = advanceVoyageProgress(initial, { voyageId: "FIRST CITIES", target: { word: "  mud\n" } });
  assert.equal(advanced.advanced, true);
  assert.equal(advanced.reason, "chapter_complete");
  assert.equal(advanced.currentStage.target, "Brick");
  assert.equal(initial.voyages["first-cities"].completed, 0, "the input is not mutated");
  assert.equal(advanced.progress.voyages["first-cities"].completed, 1);
});

test("complete and unknown Voyages have bounded stable presentations", () => {
  const complete = voyageProgress("first-cities", { voyages: { "first-cities": 500 } });
  assert.deepEqual({ completed: complete.completed, total: complete.total, percent: complete.percent, complete: complete.complete, stage: complete.currentStage }, {
    completed: 5, total: 5, percent: 100, complete: true, stage: null
  });
  const repeated = advanceVoyageProgress({ voyages: { "first-cities": 5 } }, { voyageId: "first-cities", target: "Mud" });
  assert.equal(repeated.reason, "already_complete");
  assert.equal(repeated.advanced, false);

  assert.equal(constellationVoyage("<script>"), null);
  assert.deepEqual(voyageProgress("missing", { voyages: { missing: 999 } }), {
    version: CONSTELLATION_VOYAGES_VERSION,
    voyageId: "",
    found: false,
    completed: 0,
    total: 0,
    percent: 0,
    complete: false,
    currentStage: null
  });
});
