import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultProfile } from "../public/default-profile.mjs";
import { createMoonProjectsState } from "../public/moon-heart-project.mjs";

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
  first.expedition.worlds.moon.launches = 4;
  first.expedition.worlds.moon.outpost.projects.entries.push({ forged: true });

  assert.equal(first.version, 10);
  assert.equal(second.version, 10);
  assert.deepEqual(second.discovered, ["Earth", "Water", "Fire", "Air"]);
  assert.equal(second.cosmetics.theme, "void");
  assert.equal(second.expedition.worlds.moon.launches, 0);
  assert.deepEqual(second.expedition.worlds.moon.outpost.structures, {
    power: null,
    shelter: null,
    signal: null
  });
  assert.deepEqual(second.expedition.worlds.moon.outpost.projects, createMoonProjectsState());
  assert.equal(second.cloudPending, false);
  assert.equal(second.stardust, 0);
});
