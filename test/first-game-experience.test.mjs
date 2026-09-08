import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { resetAccountProfile } from "../public/account-profile.mjs";
import {
  FIRST_DISCOVERY_HOLD_MS,
  FIRST_DISCOVERY_PARTICLE_COUNT,
  firstDiscoveryBurstPlan,
  firstGameLaunchIntent,
  preserveAnonymousFirstGameProgress,
  firstGameRequired
} from "../public/first-game-experience.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const gate = await readFile(new URL("../public/cosmic-gate.mjs", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/cosmic-gate.css", import.meta.url), "utf8");

test("completion is the only first-game latch for a zero-win player", () => {
  assert.equal(firstGameRequired({ firstOrbit: { seen: false, completed: false }, wins: 0 }), true);
  assert.equal(firstGameRequired({ firstOrbit: { seen: true, completed: false }, wins: 0 }), true);
  assert.equal(firstGameRequired({ firstOrbit: { seen: true, completed: true }, wins: 0 }), false);
  assert.equal(firstGameRequired({ firstOrbit: { completed: false }, wins: 1 }), false);
  assert.equal(firstGameRequired({ firstOrbit: null, wins: "invalid" }), true);
  assert.equal(firstGameRequired({ firstOrbit: { completed: "yes" }, wins: -4 }), true);
});

test("only actionable URL modes defer the mandatory first game", () => {
  assert.equal(firstGameLaunchIntent("daily"), "daily");
  assert.equal(firstGameLaunchIntent("EXPLORE"), "explore");
  assert.equal(firstGameLaunchIntent(" creator "), "creator");
  assert.equal(firstGameLaunchIntent("bogus"), "");
  assert.equal(firstGameLaunchIntent(""), "");
});

test("first account creation retains anonymous first-game progress", () => {
  assert.deepEqual(
    preserveAnonymousFirstGameProgress({ seen: true, completed: false }, { anonymous: true }),
    { seen: true, completed: false }
  );
  assert.deepEqual(
    preserveAnonymousFirstGameProgress({ seen: false, completed: true }, { anonymous: true }),
    { seen: true, completed: true }
  );
  assert.equal(
    preserveAnonymousFirstGameProgress({ seen: true, completed: true }, { anonymous: false }),
    null
  );
  const reset = resetAccountProfile(
    { firstOrbit: { seen: false, completed: false }, playerId: "", playerToken: "" },
    { firstOrbit: { seen: true, completed: true }, playerId: "", playerToken: "" },
    { playerId: "new-player", playerToken: "new-token", preserveFirstOrbit: true }
  );
  assert.deepEqual(reset.firstOrbit, { seen: true, completed: true });
  assert.equal(reset.playerId, "new-player");
});

test("first identity creation attaches credentials without erasing local solo progress", () => {
  const ownership = {
    supporter: true,
    collections: ["constellore.collection.local-preview"],
    items: ["constellore.cosmetic.local-preview"],
    earned: []
  };
  const reset = resetAccountProfile(
    {
      playerId: "",
      playerToken: "",
      cloudProfileVersion: 0,
      cloudPending: false,
      cloudPendingFields: [],
      callsign: "",
      credits: 0,
      vault: [],
      premium: false,
      cosmeticOwnership: { supporter: false, collections: [], items: [], earned: [] },
      freeWishUsed: false,
      wishAvailable: true,
      dailyWishUsedDate: "",
      wins: 0,
      firstOrbit: { seen: false, completed: false },
      secondOrbit: { seen: false, completed: false },
      discovered: ["Earth", "Water", "Fire", "Air"]
    },
    {
      playerId: "",
      playerToken: "",
      cloudProfileVersion: 42,
      cloudPending: true,
      cloudPendingFields: ["all"],
      callsign: "Spoofed",
      credits: 999,
      vault: ["Spoofed"],
      premium: true,
      cosmeticOwnership: ownership,
      freeWishUsed: true,
      wishAvailable: false,
      dailyWishUsedDate: "2026-07-29",
      wins: 7,
      firstOrbit: { seen: true, completed: true },
      secondOrbit: { seen: true, completed: true },
      discovered: ["Earth", "Water", "Fire", "Air", "Mud"],
      routeOutcomeHashes: ["local-outcome"]
    },
    {
      playerId: "new-player",
      playerToken: "new-token",
      preserveFirstOrbit: true,
      preserveLocalProgress: true
    }
  );

  assert.equal(reset.playerId, "new-player");
  assert.equal(reset.playerToken, "new-token");
  assert.equal(reset.wins, 7);
  assert.deepEqual(reset.firstOrbit, { seen: true, completed: true });
  assert.deepEqual(reset.secondOrbit, { seen: true, completed: true });
  assert.deepEqual(reset.discovered, ["Earth", "Water", "Fire", "Air", "Mud"]);
  assert.deepEqual(reset.routeOutcomeHashes, ["local-outcome"]);
  assert.equal(reset.callsign, "");
  assert.equal(reset.credits, 0);
  assert.deepEqual(reset.vault, []);
  assert.equal(reset.premium, false);
  assert.deepEqual(reset.cosmeticOwnership, {
    supporter: false,
    collections: [],
    items: [],
    earned: []
  });
  assert.equal(reset.cloudProfileVersion, 0);
  assert.equal(reset.cloudPending, false);
  assert.deepEqual(reset.cloudPendingFields, []);
});

test("server-authoritative cosmetic ownership survives an account profile reset", () => {
  const ownership = {
    supporter: false,
    collections: ["constellore.collection.private-grant"],
    items: ["constellore.cosmetic.private-plaque"],
    earned: ["constellore.cosmetic.cartographer-plaque"]
  };
  const reset = resetAccountProfile(
    { playerId: "", playerToken: "", vault: [], cosmeticOwnership: {} },
    {
      playerId: "player",
      playerToken: "token",
      vault: [],
      cosmeticOwnership: ownership,
      senseWallet: {}
    },
    { preserveServer: true }
  );
  assert.deepEqual(reset.cosmeticOwnership, ownership);
  assert.notEqual(reset.cosmeticOwnership, ownership);
});

test("the first-discovery star burst is deterministic, bounded, and visually varied", () => {
  const first = firstDiscoveryBurstPlan();
  const repeated = firstDiscoveryBurstPlan();
  assert.deepEqual(repeated, first);
  assert.equal(first.length, FIRST_DISCOVERY_PARTICLE_COUNT);
  assert.equal(Object.isFrozen(first), true);
  assert.deepEqual(new Set(first.map((particle) => particle.kind)), new Set(["star", "dust", "comet"]));
  assert.deepEqual(new Set(first.map((particle) => particle.tone)), new Set(["gold", "cyan", "violet", "white"]));
  for (const particle of first) {
    assert.ok(Number.isFinite(particle.x) && Math.abs(particle.x) <= 56);
    assert.ok(Number.isFinite(particle.y) && Math.abs(particle.y) <= 56);
    assert.ok(particle.delay >= 0 && particle.delay < 400);
    assert.ok(particle.duration >= 600 && particle.duration <= 1200);
    assert.ok(particle.delay + particle.duration <= FIRST_DISCOVERY_HOLD_MS);
    assert.ok(particle.size >= 5 && particle.size <= 13);
    assert.equal(Object.isFrozen(particle), true);
  }
});

test("new players reach the menu while an interrupted game restores behind the launch blackout", () => {
  const startup = app.slice(app.indexOf("const startupParams"), app.indexOf("const ctrlHover"));
  const boot = app.slice(app.indexOf("async function boot()"), app.indexOf("boot().catch"));
  assert.match(startup, /const startupResumeSnapshot = selectStartupResumeSnapshot\(\{\s*snapshot: readActiveRunSnapshot\(\),\s*sharedChallenge: startupSharedChallenge,\s*modeIntent: startupModeIntent\s*\}\)/);
  assert.ok(
    startup.indexOf("snapshot: readActiveRunSnapshot()")
      < startup.indexOf("if (startupOpensHome) void handoffLaunchMenu()"),
    "an interrupted game must be discovered before home is revealed"
  );
  assert.match(boot, /const launchIntent = Boolean\(sharedChallenge \|\| firstGameLaunchIntent\(params[.]get\("mode"\)\)\)/);
  assert.match(boot, /const launchMenuHandoff = startupOpensHome/);
  assert.match(boot, /const savedRun = startupResumeSnapshot/);
  assert.match(boot, /firstGameRequired\(profile\) && !launchMenuHandoff && !savedRun && !launchIntent && \(!profile[.]playerId \|\| !profile[.]playerToken \|\| isStaticBeta\)/);
  assert.match(boot, /startFirstOrbit\(\{\s*enterThroughGate:\s*false\s*\}\)/);
  assert.ok(boot.indexOf("startFirstOrbit({ enterThroughGate: false })") < boot.indexOf("await loadConfig()"));
  assert.match(boot, /const restored = firstGameStarted\s*\?\s*false\s*:\s*await restoreInterruptedRun\(savedRun\)/);
  assert.match(boot, /if \(startupResumeSnapshot\) \{\s*if \(restored\) releaseLaunchBlackout\(\);\s*else handoffLaunchMenu\(\);\s*\}/);
  assert.ok(
    boot.indexOf("await restoreInterruptedRun(savedRun)")
      < boot.indexOf("else if (!restored && !firstGameStarted && sharedChallenge)"),
    "restoration must win before matching challenge and mode launch branches"
  );
  assert.match(
    boot,
    /else if \(!restored && !firstGameStarted && sharedChallenge\) \{\s*if \(!homeMenuState\(\)[.]onboardingComplete\) \{\s*firstGameStarted = await startRequiredOpeningLesson\(\{ enterThroughGate: false \}\)/,
    "shared links must keep a new player inside the guided opening lessons"
  );
  assert.match(boot, /const launchHandled = await handleLaunchIntent\(params\)[\s\S]*!launchHandled && !launchMenuHandoff && firstGameRequired\(profile\)/);
  const release = app.slice(app.indexOf("function releaseLaunchBlackout()"), app.indexOf("function handoffLaunchMenu()"));
  assert.match(release, /cosmicGate[.]skipIntro\(\)/);
  assert.doesNotMatch(release, /gameAudio[.](?:setScene|prime)/, "successful restoration must not start menu audio");
});

test("first-game completion is durable before its animation-gated result and survives first registration", () => {
  const ensurePlayer = app.slice(app.indexOf("async function ensurePlayer()"), app.indexOf("function cloudProfileSnapshot"));
  const resetProfile = app.slice(app.indexOf("function resetProfileForAccount"), app.indexOf("function mergeCloudProfile"));
  const combine = app.slice(app.indexOf("async function combineNodes"), app.indexOf("function expectedPairKey"));
  assert.match(ensurePlayer, /const anonymous = !profile[.]playerId && !profile[.]playerToken/);
  assert.match(ensurePlayer, /if \(playerIdentityPromise\) return playerIdentityPromise/);
  assert.match(ensurePlayer, /preserveFirstOrbit:\s*anonymous/);
  assert.match(ensurePlayer, /preserveLocalProgress:\s*anonymous/);
  assert.match(resetProfile, /resetAccountProfile\(defaultProfile, profile, options\)/);
  assert.match(combine, /const firstCompletion = Boolean\([\s\S]*profile[.]firstOrbit = \{ seen: true, completed: true \}[\s\S]*saveProfile\(\{ fields: \["firstOrbit"\] \}\)/);
  assert.ok(
    combine.indexOf("const outcomeCommitted = won ? commitGameOutcome() : false")
      < combine.indexOf('saveProfile({ fields: ["firstOrbit"] })'),
    "The confirmed win must be locked before first-orbit completion is persisted."
  );
  assert.ok(
    combine.indexOf('saveProfile({ fields: ["firstOrbit"] })')
      < combine.indexOf('if (won) finishGame(true, "", {'),
    "The confirmed first win must be persisted before animation-gated result presentation begins."
  );
  assert.doesNotMatch(combine, /setTimeout\(\(\) => finishGame\(true/);
  assert.match(app, /void presentResultAfterCelebration\(\{[\s\S]*celebrationStartedAt/);
});

test("first completion runs a decorative celebration before the focused next-game result", () => {
  assert.match(page, /class="cosmic-gate__first-discovery" aria-hidden="true" hidden/);
  assert.match(page, /class="cosmic-gate__confetti"/);
  assert.match(gate, /firstDiscoveryHold:\s*FIRST_DISCOVERY_HOLD_MS/);
  assert.match(gate, /firstDiscoveryReducedHold:\s*280/);
  assert.match(gate, /prepareFirstDiscovery\(celebration\)/);
  assert.match(gate, /clearFirstDiscovery\(\)[\s\S]*dialog[.]showModal\(\)/);
  assert.match(app, /firstEverCompletion[\s\S]*First constellation complete[.][\s\S]*celebration:/);
  assert.match(app, /firstTraining[\s\S]*"Next game"/);
  assert.match(styles, /[.]cosmic-gate__first-discovery\s*\{[^}]*pointer-events:\s*none/);
  assert.match(styles, /cosmic-first-discovery-(?:nova|particle|title)/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*[.]cosmic-gate__confetti[\s\S]*display:\s*none/);
  assert.match(styles, /@media \(forced-colors:\s*active\)[\s\S]*[.]cosmic-gate__confetti/);
});
