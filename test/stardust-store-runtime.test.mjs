import assert from "node:assert/strict";
import test from "node:test";
import { createStardustStoreRuntime } from "../public/stardust-store-runtime.mjs";

function fakeDocument() {
  const elements = new Map([
    "stardustStoreBalance",
    "stardustCompassStock",
    "stardustShieldStock",
    "stardustStoreStatus",
    "buyStarCompass",
    "buyStreakShield",
    "buySense",
    "senseMessage"
  ].map((id) => [id, {
    id,
    textContent: "",
    disabled: false,
    classList: {
      values: new Set(),
      toggle(name, force) {
        if (force) this.values.add(name);
        else this.values.delete(name);
      }
    }
  }]));
  return {
    elements,
    getElementById(id) {
      return elements.get(id) || null;
    }
  };
}

test("the lazy Stardust runtime renders and commits exact reserve purchases", async () => {
  const documentRef = fakeDocument();
  const profile = { stardust: 500, senseWallet: { charges: 2, lastDailyGrant: "2026-07-28" }, streakShields: 1 };
  const events = [];
  const runtime = createStardustStoreRuntime({
    documentRef,
    getProfile: () => profile,
    playFeedback: (cue) => events.push(["audio", cue]),
    showToast: (message) => events.push(["toast", message]),
    track: (name) => events.push(["track", name])
  });

  runtime.render();
  assert.equal(documentRef.elements.get("stardustStoreBalance").textContent, "500");
  assert.equal(documentRef.elements.get("stardustCompassStock").textContent, "2 / 9");
  assert.equal(documentRef.elements.get("stardustShieldStock").textContent, "1 / 3");

  const result = await runtime.purchase("streak-shield");
  assert.equal(result.applied, true);
  assert.deepEqual(profile, {
    stardust: 260,
    senseWallet: { charges: 2, lastDailyGrant: "2026-07-28" },
    streakShields: 2
  });
  assert.equal(documentRef.elements.get("stardustStoreBalance").textContent, "260");
  assert.equal(documentRef.elements.get("stardustShieldStock").textContent, "2 / 3");
  assert.ok(events.some(([kind, value]) => kind === "audio" && value === "uiSelect"));
  assert.ok(events.some(([kind, value]) => kind === "track" && value === "stardust_purchased"));
});

test("the lazy Stardust runtime reports unaffordable purchases without committing", async () => {
  const documentRef = fakeDocument();
  const profile = { stardust: 25, senseWallet: { charges: 0 }, streakShields: 0 };
  let commits = 0;
  const runtime = createStardustStoreRuntime({
    documentRef,
    getProfile: () => profile,
    onProfileChange: () => { commits += 1; }
  });

  const result = await runtime.purchase("star-compass");
  assert.equal(result.applied, false);
  assert.equal(result.reason, "insufficient_stardust");
  assert.equal(commits, 0);
  assert.equal(documentRef.elements.get("senseMessage").textContent, "You need 65 more Stardust.");
  assert.equal(documentRef.elements.get("stardustStoreStatus").classList.values.has("error"), true);
});

test("the lazy Stardust runtime rolls back its profile merge when persistence fails", async () => {
  const documentRef = fakeDocument();
  const profile = { stardust: 100, senseWallet: { charges: 1, lastDailyGrant: "kept" }, streakShields: 0 };
  const runtime = createStardustStoreRuntime({
    documentRef,
    getProfile: () => profile,
    onProfileChange: () => { throw new Error("storage failed"); }
  });

  await assert.rejects(runtime.purchase("star-compass"), /storage failed/);
  assert.deepEqual(profile, {
    stardust: 100,
    senseWallet: { charges: 1, lastDailyGrant: "kept" },
    streakShields: 0
  });
  assert.equal(runtime.busy, false);
});
