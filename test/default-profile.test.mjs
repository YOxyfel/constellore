import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultProfile } from "../public/default-profile.mjs";

function profile() {
  return createDefaultProfile({
    cosmeticLoadout: { theme: "void" },
    voyageProgress: { stage: 0 },
    routeProgression: { mastery: 0 },
    remixReadiness: { attempts: 0 }
  });
}

test("default profiles start device-local with independent mutable collections", () => {
  const first = profile();
  const second = profile();
  first.discovered.push("Mud");
  first.cosmetics.theme = "aurora";

  assert.deepEqual(second.discovered, ["Earth", "Water", "Fire", "Air"]);
  assert.equal(second.cosmetics.theme, "void");
  assert.equal(second.cloudPending, false);
  assert.equal(second.stardust, 0);
});
