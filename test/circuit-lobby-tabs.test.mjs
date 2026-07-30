import assert from "node:assert/strict";
import test from "node:test";
import { CIRCUIT_LOBBY_TABS, nextCircuitLobbyTab } from "../public/circuit-lobby-tabs.mjs";

test("Circuit lobby tabs wrap and support Home and End keyboard movement", () => {
  assert.equal(nextCircuitLobbyTab("fly", "ArrowLeft"), "rules");
  assert.equal(nextCircuitLobbyTab("rules", "ArrowRight"), "fly");
  assert.equal(nextCircuitLobbyTab("progress", "Home"), "fly");
  assert.equal(nextCircuitLobbyTab("progress", "End"), "rules");
  assert.equal(nextCircuitLobbyTab("rewards", "Enter"), "rewards");
  assert.deepEqual(CIRCUIT_LOBBY_TABS, ["fly", "progress", "rewards", "rules"]);
});
