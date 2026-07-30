import assert from "node:assert/strict";
import test from "node:test";
import { MASTERY_CATALOG } from "../public/mastery-catalog.mjs";

test("the focused mastery catalog is immutable and uniquely keyed by result", () => {
  assert.equal(MASTERY_CATALOG.length, 42);
  assert.equal(new Set(MASTERY_CATALOG.map((entry) => entry.word.toLocaleLowerCase("en"))).size, MASTERY_CATALOG.length);
  assert.equal(Object.isFrozen(MASTERY_CATALOG), true);
  assert.equal(MASTERY_CATALOG.every(Object.isFrozen), true);
});
