import assert from "node:assert/strict";
import test from "node:test";

import { createRecipeFeedbackRequest, emptyRecipeFeedback, MAX_RECIPE_FEEDBACK_ENTRIES, normalizeRecipeFeedback, recipeFeedbackSummary, recipeFingerprint, recordRecipeFeedback, sanitizeRecipeRating } from "../public/recipe-feedback.mjs";

const step = { a: "Earth", b: "Water", word: "Mud", source: "world" };

test("recipe feedback accepts only the three low-friction ratings", () => {
  assert.equal(sanitizeRecipeRating(" Logical "), "logical");
  assert.equal(sanitizeRecipeRating("surprising"), "surprising");
  assert.equal(sanitizeRecipeRating("BAD"), "bad");
  assert.equal(sanitizeRecipeRating("offensive free text"), null);
  assert.equal(recipeFingerprint(step), recipeFingerprint({ ...step, a: "Water", b: "Earth" }));
  assert.equal(recipeFingerprint(step).length, 14);
});

test("feedback requests contain only run proof, move number, and an enum", () => {
  assert.deepEqual(createRecipeFeedbackRequest({ runId: "run-1", runToken: "token-1", move: 2, rating: "bad", comment: "raw text" }), {
    runId: "run-1", runToken: "token-1", move: 2, rating: "bad"
  });
  assert.equal(createRecipeFeedbackRequest({ runId: "run-1", runToken: "token-1", move: 0, rating: "bad" }), null);
  assert.equal(createRecipeFeedbackRequest({ runId: "run-1", runToken: "token-1", move: 1, rating: "other" }), null);
});

test("aggregates stay bounded and rank weak recipes without player identifiers", () => {
  let state = emptyRecipeFeedback();
  for (const rating of ["logical", "bad", "bad", "surprising"]) state = recordRecipeFeedback(state, { step, rating, date: new Date("2026-07-18T12:00:00Z") }).state;
  state = recordRecipeFeedback(state, { step: { a: "Air", b: "Life", word: "Bird" }, rating: "logical" }).state;
  const normalized = normalizeRecipeFeedback({ ...state, playerId: "must-disappear", injected: true });
  assert.equal(normalized.totalVotes, 5);
  assert.equal("playerId" in normalized, false);
  const summary = recipeFeedbackSummary(normalized, { minimumVotes: 3 });
  assert.equal(summary.length, 1);
  assert.equal(summary[0].word, "Mud");
  assert.equal(summary[0].badPercent, 50);
});

test("feedback capacity is explicit and hostile counters stay finite", () => {
  const recipes = {};
  for (let index = 0; index < MAX_RECIPE_FEEDBACK_ENTRIES; index += 1) {
    recipes[index.toString(36).padStart(14, "0")] = {
      a: `A${index}`, b: `B${index}`, word: `W${index}`, source: "world",
      ratings: { logical: 1, surprising: 0, bad: 0 }, votes: 1
    };
  }
  const full = { version: 1, recipes, totalVotes: MAX_RECIPE_FEEDBACK_ENTRIES, updatedAt: null };
  const rejected = recordRecipeFeedback(full, { step: { a: "Novel A", b: "Novel B", word: "Novel Result" }, rating: "logical" });
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reason, "capacity");
  assert.equal(rejected.state.totalVotes, MAX_RECIPE_FEEDBACK_ENTRIES);

  const hostile = normalizeRecipeFeedback({ recipes: {
    abcdefg: { a: "A", b: "B", word: "C", ratings: { logical: Infinity, surprising: "nope", bad: -5 } }
  } });
  assert.equal(hostile.totalVotes, 0);
  assert.equal(Number.isFinite(hostile.totalVotes), true);
});
