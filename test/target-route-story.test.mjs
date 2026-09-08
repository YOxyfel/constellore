import test from "node:test";
import assert from "node:assert/strict";
import {
  isTargetRouteStoryStep,
  restoreTargetRouteStoryEvidence,
  targetRouteStoryHistory
} from "../public/story/target-route-story.mjs";

const routeStep = (word, extra = {}) => ({
  a: "Earth",
  b: "Water",
  word,
  runIqRelevance: "route",
  routeStepsAdvanced: 1,
  routeCompleted: false,
  ...extra
});

test("only combinations with authoritative target-route evidence become story chapters", () => {
  const offRoute = {
    a: "Fire",
    b: "Air",
    word: "Energy",
    runIqRelevance: "discovery",
    routeStepsAdvanced: 0,
    routeCompleted: false
  };
  const target = routeStep("Factory", {
    a: "Engine",
    b: "Engine",
    runIqRelevance: "target",
    routeCompleted: true
  });
  const history = [
    routeStep("Steam", { a: "Fire", b: "Water" }),
    offRoute,
    routeStep("Engine", { a: "Fire", b: "Steam" }),
    target,
    routeStep("After")
  ];

  assert.equal(isTargetRouteStoryStep(offRoute), false);
  assert.equal(isTargetRouteStoryStep(history[0]), true);
  assert.equal(isTargetRouteStoryStep(target), true);
  assert.deepEqual(
    targetRouteStoryHistory(history, "factory").map((step) => step.word),
    ["Steam", "Engine", "Factory"]
  );
});

test("route filtering is conservative for malformed and legacy-neutral history", () => {
  assert.equal(isTargetRouteStoryStep(null), false);
  assert.equal(isTargetRouteStoryStep([]), false);
  assert.equal(isTargetRouteStoryStep({ word: "Mud" }), false);
  assert.equal(isTargetRouteStoryStep({ routeStepsAdvanced: -1 }), false);
  assert.equal(isTargetRouteStoryStep({ routeStepsAdvanced: "2" }), true);
  assert.equal(isTargetRouteStoryStep({ runIqRelevance: " TARGET " }), true);
  assert.deepEqual(targetRouteStoryHistory("not-an-array", "Mud"), []);
});

test("route evidence survives an exact interrupted-run restore without trusting mismatched history", () => {
  const authoritative = [
    { a: "Fire", b: "Water", word: "Steam", routeStepsAdvanced: 0, runIqRelevance: "" },
    { a: "Steam", b: "Fire", word: "Engine", routeStepsAdvanced: 0, runIqRelevance: "" }
  ];
  const saved = [
    routeStep("Steam", { a: "Fire", b: "Water", routeStepsAdvanced: 1 }),
    routeStep("Engine", { a: "Steam", b: "Fire", routeStepsAdvanced: 1 })
  ];

  const restored = restoreTargetRouteStoryEvidence(authoritative, saved);
  assert.deepEqual(restored.map((step) => step.routeStepsAdvanced), [1, 1]);
  assert.deepEqual(targetRouteStoryHistory(restored, "Factory").map((step) => step.word), ["Steam", "Engine"]);
  assert.deepEqual(restoreTargetRouteStoryEvidence(authoritative, saved.toReversed()), authoritative);
  assert.notEqual(restored, authoritative);
});
