import assert from "node:assert/strict";
import test from "node:test";
import { createInitialAppState } from "../public/initial-app-state.mjs";

test("initial app state owns independent runtime collections", () => {
  const first = createInitialAppState({ adaptiveDifficulty: { level: 1 } });
  const second = createInitialAppState({ adaptiveDifficulty: { level: 2 } });
  first.words.push({ word: "Earth" });
  first.busyPairs.add("earth-water");
  first.reveal.route.push("Mud");

  assert.deepEqual(second.words, []);
  assert.equal(second.busyPairs.size, 0);
  assert.deepEqual(second.reveal.route, []);
  assert.equal(second.adaptiveDifficulty.level, 2);
});
