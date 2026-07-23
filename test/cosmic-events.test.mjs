import assert from "node:assert/strict";
import test from "node:test";

import {
  COSMIC_EVENTS_VERSION,
  COSMIC_EVENT_ROTATION_WEEKS,
  MAX_COSMIC_EVENT_COLLECTION_WORDS,
  MAX_COSMIC_EVENT_DISCOVERIES,
  MAX_COSMIC_EVENT_TARGETS,
  annotateCosmicEventResult,
  cosmicEvent,
  cosmicEventCatalog,
  cosmicEventCollectionProgress,
  cosmicEventTargets,
  cosmicEventWeek,
  currentCosmicEvent
} from "../public/cosmic-events.mjs";
import { reachableFromStarters, solutionRoute } from "../server.mjs";

test("the weekly catalog contains the five promised event themes", () => {
  const catalog = cosmicEventCatalog();
  assert.equal(catalog.length, COSMIC_EVENT_ROTATION_WEEKS);
  assert.deepEqual(catalog.map((event) => event.theme), ["Ocean", "Machines", "Mythic", "Lost Civilizations", "Deep Space"]);
  assert.ok(catalog.every((event) => event.temporaryTargets.length > 0 && event.temporaryTargets.length <= MAX_COSMIC_EVENT_TARGETS));
  assert.ok(catalog.every((event) => event.collection.words.length > 0 && event.collection.words.length <= MAX_COSMIC_EVENT_COLLECTION_WORDS));
});

test("weekly selection is deterministic, changes on Monday UTC, and repeats after five weeks", () => {
  const sunday = currentCosmicEvent("2026-07-26T23:59:59.999Z");
  const monday = currentCosmicEvent("2026-07-27T00:00:00.000Z");
  assert.deepEqual(currentCosmicEvent("2026-07-22T12:00:00Z"), currentCosmicEvent("2026-07-26T23:00:00Z"));
  assert.notEqual(sunday.weekKey, monday.weekKey);
  assert.equal(monday.rotationIndex, (sunday.rotationIndex + 1) % COSMIC_EVENT_ROTATION_WEEKS);

  const repeated = currentCosmicEvent(new Date(Date.parse("2026-07-27T12:00:00Z") + 5 * 7 * 86_400_000));
  assert.equal(repeated.id, monday.id);
  assert.equal(repeated.rotationIndex, monday.rotationIndex);
  assert.notEqual(repeated.weekKey, monday.weekKey);
});

test("invalid and hostile dates resolve to one bounded deterministic epoch week", () => {
  const fallback = cosmicEventWeek("not a date");
  assert.deepEqual(cosmicEventWeek("\u0000\n".repeat(10_000)), fallback);
  assert.deepEqual(cosmicEventWeek(Number.POSITIVE_INFINITY), fallback);
  assert.deepEqual(cosmicEventWeek(new Date(Number.NaN)), fallback);
  assert.match(fallback.weekKey, /^\d{4}-W\d{2}$/);
  assert.ok(fallback.rotationIndex >= 0 && fallback.rotationIndex < COSMIC_EVENT_ROTATION_WEEKS);
});

test("event targets and collection words stay inside the canonical reachable world", () => {
  const reachable = new Set([...reachableFromStarters().values()].map((word) => word.toLocaleLowerCase("en-US")));
  for (const event of cosmicEventCatalog()) {
    for (const target of event.temporaryTargets) {
      assert.ok(reachable.has(target.word.toLocaleLowerCase("en-US")), `${target.word} must be canonical and reachable`);
      assert.ok(solutionRoute(target.word)?.length >= 1, `${target.word} must retain an authored route`);
    }
    for (const word of event.collection.words) assert.ok(reachable.has(word.toLocaleLowerCase("en-US")), `${word} must be canonical and reachable`);
  }
});

test("catalog copies expose presentation boundaries without recipe or score knobs", () => {
  const first = cosmicEventCatalog();
  first[0].name = "Mutated";
  first[0].temporaryTargets[0].word = "Invented";
  first[0].collection.words.push("Cheat");
  first[0].presentation.accent = "score-double";
  assert.notEqual(cosmicEventCatalog()[0].name, "Mutated");
  assert.notEqual(cosmicEventCatalog()[0].temporaryTargets[0].word, "Invented");

  for (const event of cosmicEventCatalog()) {
    assert.deepEqual(event.boundary, { temporaryContentOnly: true, canonicalRecipes: "unchanged", rankedSemantics: "unchanged" });
    assert.equal(event.law.presentationOnly, true);
    const contentKeys = new Set([
      ...Object.keys(event),
      ...Object.keys(event.law),
      ...Object.keys(event.presentation),
      ...event.temporaryTargets.flatMap(Object.keys),
      ...Object.keys(event.collection)
    ]);
    for (const forbidden of ["recipe", "recipes", "result", "results", "score", "reward", "multiplier", "moveLimit", "timeLimit", "leaderboard"]) {
      assert.equal(contentKeys.has(forbidden), false);
    }
  }
});

test("collection progress is bounded, canonicalized, and retains no hostile words", () => {
  const hostile = Array.from({ length: MAX_COSMIC_EVENT_DISCOVERIES + 200 }, (_, index) => `Injected ${index}`);
  hostile.splice(0, 0, " water ", { word: "OCEAN\n" }, "Water", { word: "River" }, { word: "<script>" });
  const progress = cosmicEventCollectionProgress("OCEAN DEPTHS", hostile);
  assert.equal(progress.eventId, "ocean-depths");
  assert.deepEqual(progress.found, ["Water", "Ocean", "River"]);
  assert.equal(progress.discovered, 3);
  assert.equal(progress.total, 7);
  assert.equal(progress.complete, false);
  assert.doesNotMatch(JSON.stringify(progress), /Injected|script/i);
  assert.equal(progress.found.length + progress.missing.length, progress.total);

  const complete = cosmicEventCollectionProgress("ocean-depths", cosmicEvent("ocean-depths").collection.words);
  assert.equal(complete.complete, true);
  assert.equal(complete.percent, 100);
  assert.deepEqual(cosmicEventCollectionProgress("unknown", ["Water"]), {
    eventId: "", collectionId: "", found: [], missing: [], discovered: 0, total: 0, percent: 0, complete: false
  });
});

test("event annotation never mutates or replaces canonical ranked results", () => {
  const event = currentCosmicEvent("2026-07-22T12:00:00Z");
  const definition = cosmicEvent(event);
  const word = definition.temporaryTargets[0].word;
  const result = Object.freeze({
    word,
    source: "world",
    ranked: true,
    scoreEligible: true,
    leaderboardEligible: true,
    score: 123456,
    recipe: Object.freeze(["Canonical A", "Canonical B"])
  });
  const annotated = annotateCosmicEventResult({ event, result });
  assert.equal(annotated.result, result);
  assert.deepEqual(annotated.result, result);
  assert.equal(annotated.context.eventId, event.id);
  assert.equal(annotated.context.weekKey, event.weekKey);
  assert.equal(annotated.context.featuredTarget, true);
  assert.ok(Object.keys(annotated.context).every((key) => !/score|ranked|reward|recipe|leaderboard|multiplier/i.test(key)));
  assert.deepEqual(annotateCosmicEventResult({ event: { id: "fake", scoreMultiplier: 9 }, result }), { result, context: null });
});

test("lookups are sanitized, bounded, and return defensive target copies", () => {
  assert.equal(COSMIC_EVENTS_VERSION, 1);
  assert.equal(cosmicEvent(" MYTHIC ")?.id, "mythic-constellation");
  assert.equal(cosmicEvent("<script>"), null);
  const targets = cosmicEventTargets({ id: "deep-space-signal", recipes: [{ result: "Cheat" }] });
  assert.ok(targets.length > 0 && targets.length <= MAX_COSMIC_EVENT_TARGETS);
  targets[0].word = "Mutated";
  assert.notEqual(cosmicEventTargets("deep-space-signal")[0].word, "Mutated");
});
