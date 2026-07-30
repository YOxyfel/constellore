import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CIRCUIT_REMIX_THEMES,
  createCircuitStorage,
  isRetryableCircuitError
} from "../public/cosmos-circuit-runtime.mjs";

const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const persistence = await readFile(new URL("../public/pending-scores.mjs", import.meta.url), "utf8");
const runtime = await readFile(new URL("../public/cosmos-circuit-runtime.mjs", import.meta.url), "utf8");
const loader = await readFile(new URL("../public/secondary-surface-loader.mjs", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/cosmos-circuit.css", import.meta.url), "utf8");

test("Cosmos Circuit and Star Path remain staged but inaccessible in this release", () => {
  for (const id of [
    "cosmosCircuitButton", "starPathButton", "cosmosCircuitDialog", "starPathDialog",
    "cosmosCircuitCanvas", "startCircuitPractice", "startCircuitReward",
    "activateCircuitPower", "abandonCircuitAttempt", "circuitRewardLadder",
    "circuitRewardChoice", "starPathTrack", "circuitGuide", "starPathGuide",
    "showCircuitGuide", "showStarPathGuide", "startGuidedCircuitPractice",
    "dismissCircuitGuide", "dismissStarPathGuide", "circuitTargetCue",
    "circuitRotationCountdown", "circuitWeeklyChallenges", "circuitPersonalRecords",
    "extractCircuitFlight", "circuitNavigationStatus", "starPathFeaturedReward",
    "circuitFeaturedCosmetic", "exportCircuitBackup", "importCircuitBackup",
    "importCircuitBackupFile", "circuitBackupStatus", "circuitPassStatus",
    "cosmosCircuitHomeStatus", "circuitLobbyFlyTab", "circuitLobbyProgressTab",
    "circuitLobbyRewardsTab", "circuitLobbyRulesTab", "claimAllStarPathRewards",
    "startCircuitCrazy", "crazyPathStatus", "crazyPathConfirm",
    "crazyPathConfirmTitle", "crazyPathConfirmWarning", "cancelCrazyPath",
    "confirmCrazyPath", "crazyPowerStatus", "circuitFlightRiskBanner",
    "crazyRewardChoice", "crazyRewardChoiceStatus", "confirmCrazyReward"
  ]) assert.ok(page.includes(`id="${id}"`), `missing #${id}`);
  for (const id of ["cosmosCircuitHomeButton", "cosmosCircuitButton", "starPathButton"]) {
    assert.match(
      page,
      new RegExp(`id="${id}"[^>]*data-development-only="cosmos-suite"[^>]*aria-hidden="true"[^>]*hidden`)
    );
  }
  assert.doesNotMatch(app, /\b(?:ensureCosmosCircuit|openCosmosCircuit|COSMOS_CIRCUIT_RELEASE_ENABLED)\b/);
  assert.match(page, /aria-controls="cosmosCircuitDialog"/);
  assert.match(page, /aria-controls="starPathDialog"/);
  assert.match(page, /Launch Passes are earned and never sold/i);
  assert.match(runtime, /Launch Pass has already been used and will not be refunded/);
  assert.match(page, /Cosmetic only:/i);
});

test("Crazy Path discloses its earned-entry risk and exact permanent reward choice", () => {
  assert.match(page, /<h3[^>]*>Crazy Path<\/h3>/);
  assert.match(page, /Complete a Cosmos-tier standard Reward Flight this UTC week/i);
  assert.match(page, /one attempt per UTC week/i);
  assert.match(page, /Victory starts a 30-day cooldown/i);
  assert.match(page, /id="crazyPathConfirm" role="alertdialog" aria-modal="true"/);
  assert.match(page, /aria-labelledby="crazyPathConfirmTitle"/);
  assert.match(page, /aria-describedby="crazyPathConfirmWarning"/);
  assert.match(page, /Commit 3 Launch Passes/i);
  assert.match(page, /No extraction or partial milestone reward/i);
  assert.match(page, /No powers, Path XP, or weekly-objective progress on failure/i);
  assert.match(page, /Launch Crazy Path · spend 3 passes/i);
  assert.match(page, /name="crazyReward" value="instant"/);
  assert.match(page, /20 Shield, 20 Phase, 20 Magnet, and 20 Time Warp now/i);
  assert.match(page, /name="crazyReward" value="daily"/);
  assert.match(page, /3 of every power per UTC day for 30 days/i);
  assert.match(page, /elapsed days accrue/i);

  const crazySurface = page.match(
    /<article class="crazy-path-card">[\s\S]*?<\/article>[\s\S]*?<section class="crazy-path-confirm"[\s\S]*?<\/section>/
  )?.[0] || "";
  assert.ok(crazySurface, "Crazy Path entry and confirmation copy should share a bounded surface");
  assert.doesNotMatch(crazySurface, /\b(?:buy|purchase|checkout|price|cloud)\b/i);
});

test("the release shell omits staged Circuit wiring while retaining separate source and cleanup", () => {
  assert.doesNotMatch(app, /function ensureCosmosCircuit\(\)/);
  assert.doesNotMatch(app, /createLazyCosmosCircuit\(\{/);
  assert.doesNotMatch(app, /from "[.]\/cosmos-circuit-runtime[.]mjs/);
  assert.match(loader, /import\("[.]\/cosmos-circuit-runtime[.]mjs\?/);
  assert.doesNotMatch(app, /runtime[.]recordWordWin\(circuitWin\)/);
  assert.doesNotMatch(app, /\["#cosmosCircuitButton", "circuit"\]/);
  assert.doesNotMatch(app, /openCosmosCircuit\(view\)/);
  assert.match(app, /cosmosCircuit: null/);
  assert.match(persistence, /prefixes = \["constellore-", "wordforge-"\]/);
  assert.match(app, /clearGameStorage\(safeBrowserStorage\(\)\)/);
  assert.match(app, /localStorage[.]removeItem\(COSMOS_CIRCUIT_SAVE_KEY\)/);
});

test("Circuit remix selection includes every complete cosmetic sound theme", () => {
  assert.deepEqual(CIRCUIT_REMIX_THEMES, [
    "constellore.celestial-atlas.sound-theme.cosmic-chimes",
    "constellore.aurora-archive.sound-theme.glass-orbit",
    "constellore.solar-foundry.sound-theme.analog-stars",
    "constellore.lunar-garden.sound-theme.moon-bells",
    "constellore.eclipse-sovereign.sound-theme.eclipse-choir",
    "constellore.pixel-frontier.sound-theme.pixel-pulse",
    "constellore.bubble-reef.sound-theme.bubble-beat",
    "constellore.stellar-vanguard.sound-theme.void-overture"
  ]);
});

test("the browser runtime keeps Reward Flights authoritative and Practice rewards local-only", () => {
  assert.match(runtime, /export function createCosmosCircuitRuntime/);
  assert.match(runtime, /"\/api\/circuit\/start"/);
  assert.match(runtime, /"\/api\/circuit\/submit"/);
  assert.match(runtime, /"\/api\/circuit\/abandon"/);
  assert.match(runtime, /"\/api\/star-path\/claim"/);
  assert.match(runtime, /mode === "ticketed" && online/);
  assert.match(runtime, /claimCircuitReward\(local[.]claims/);
  assert.match(runtime, /mode === "practice" [?] selectedBoost : ""/);
  assert.match(runtime, /active[.]submitKey/);
  assert.match(runtime, /active[.]abandonKey/);
  assert.match(runtime, /data-circuit-reward-boost/);
  assert.match(runtime, /samples: segmentSamples[.]map/);
  assert.match(runtime, /onboarding:/);
  assert.match(runtime, /cosmos_circuit_tutorial_viewed/);
  assert.match(runtime, /star_path_tutorial_completed/);
  assert.match(runtime, /cosmos_circuit_abandoned/);
  assert.match(runtime, /cosmos-circuit-copy[.]mjs/);
  assert.match(runtime, /circuit-lobby-tabs[.]mjs/);
  assert.match(runtime, /createCircuitLobbyTabs\(\{/);
  assert.match(runtime, /lobbyTabs[.]select\("fly"\)/);
  assert.match(runtime, /cosmosCircuitHomeStatus/);
  assert.match(runtime, /circuitPassEarningStatus/);
  assert.match(runtime, /cosmosCircuitPassCopy/);
  assert.match(runtime, /pendingRankGrants/);
  assert.match(runtime, /circuitRewardPreview\("cosmos"/);
  assert.match(runtime, /data-disclosure-key/);
  assert.match(runtime, /grant[.]disclosureKey/);
  assert.match(runtime, /course[.]archetype/);
  assert.match(runtime, /crazyPathRewardOptions/);
  assert.match(runtime, /claimAllStarPathRewardsDomain/);
  assert.match(runtime, /claimAllStarPathRewards: claimAllPathRewards/);
  assert.match(runtime, /Claim all \$\{claimableCount\} available/);
  assert.match(runtime, /circuit-live-ops[.]mjs/);
  assert.match(runtime, /recordCircuitWeeklyProgress/);
  assert.match(runtime, /recordPersonalCircuitResult/);
  assert.match(runtime, /claimCircuitWeeklyReward/);
  assert.match(runtime, /cosmos_circuit_weekly_reward_claimed/);
  assert.match(runtime, /reason: completed[.]end[?][.]reason \|\| "finish"/);
  assert.match(runtime, /reason: "extract"/);
  assert.match(runtime, /cosmos_circuit_extracted/);
  assert.match(runtime, /constellore-cosmos-circuit-local-backup/);
  assert.match(runtime, /includeActive: false/);
  assert.match(runtime, /featuredRewardId/);
  assert.match(runtime, /renderSeasonLocker/);
  assert.match(runtime, /cloudSync: false/);
  assert.match(runtime, /requiredKeys[\s\S]*"wallet"/);
  assert.match(runtime, /grantDailyLaunchPasses\(sanitizeCircuitWallet\(source[.]wallet\)\)/);
  assert.match(runtime, /run[.]path === "crazy"[\s\S]{0,120}cosmosCircuitCrazyCourse\(run[.]courseDayKey\)[\s\S]{0,120}cosmosCircuitCourse\(run[.]courseDayKey\)/);
  assert.match(runtime, /start\("ticketed", "crazy"\)/);
  assert.match(runtime, /function setCrazyConfirmation/);
  assert.match(runtime, /if \(visible\) byId\("cancelCrazyPath"\)[?][.]focus\(\)/);
  assert.match(runtime, /else if \(restoreFocus\) byId\("startCircuitCrazy"\)[?][.]focus\(\)/);
  assert.match(runtime, /const crazyConfirmation = byId\("crazyPathConfirm"\)/);
  assert.match(runtime, /crazyConfirmation[?][.]hidden === false[\s\S]{0,100}event[.]key === "Escape"/);
  assert.match(runtime, /event[.]key === "Tab"[\s\S]{0,220}button:not\(:disabled\)/);
  assert.match(runtime, /riskBanner[.]hidden = run[.]path !== "crazy"/);
  assert.match(runtime, /button[.]hidden = run[?][.]mode !== "ticketed" \|\| run[?][.]path === "crazy"/);
  assert.match(runtime, /crazyRewardChoice: chosenCrazyReward/);
  assert.match(runtime, /grantCrazyPathDailyPowers/);
  assert.doesNotMatch(runtime, /chosenBoost: \["drift", "orbit"\][.]includes/);
  assert.doesNotMatch(runtime, /1 of each (?:credited|for 30 UTC days)/i);
  assert.doesNotMatch(runtime, /\b(?:price|checkout|purchase|ticketPrice)\b/i);
});

test("flight controls, responsive loadouts, and reduced motion have explicit presentation", () => {
  assert.match(runtime, /requestAnimationFrame\(tick\)/);
  assert.match(runtime, /pointermove/);
  assert.match(runtime, /arrowleft/);
  assert.match(runtime, /visibilitychange/);
  assert.match(runtime, /flightGeneration/);
  assert.match(runtime, /playFeedback[?][.]\("runStart"\)/);
  assert.match(runtime, /canvas[?][.]focus\(\)/);
  assert.match(runtime, /canvas[.]tabIndex = 0/);
  assert.match(runtime, /aria-label[\s\S]*Cosmos Circuit flight controller/);
  assert.match(runtime, /byId\("circuitResultTitle"\)[?][.]focus\(\)/);
  assert.match(runtime, /dprCap = saveData [?] 1 : compact \|\| reducedMotion [?] 1[.]5 : 2/);
  assert.match(runtime, /timestamp - lastPausedDrawAt < 180/);
  assert.match(runtime, /timestamp - lastReducedMotionDrawAt >= 80/);
  assert.match(runtime, /reducedMotion [?] 1/);
  assert.doesNotMatch(runtime, /reducedMotion[\s\S]{0,120}ship[.][xy] = pointer[.][xy]/);
  assert.match(runtime, /now - lastNavigationAnnouncedAt >= 3_000/);
  assert.match(runtime, /now - pendingNavigationSince >= 600/);
  assert.match(runtime, /audio[?][.]setIntensity[?][.]\(next\)/);
  assert.match(page, /id="circuitResultTitle" tabindex="-1"/);
  assert.match(page, /aria-describedby="circuitFlightInstruction circuitTargetCue circuitNavigationStatus"/);
  assert.match(page, /id="circuitNavigationStatus" role="status" aria-live="polite"/);
  assert.match(styles, /[.]circuit-practice-loadout/);
  assert.match(styles, /[.]circuit-guide/);
  assert.match(styles, /[.]crazy-path-confirm/);
  assert.match(styles, /[.]crazy-flight-banner/);
  assert.match(styles, /[.]crazy-reward-choice/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /[.]circuit-reward-choice/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /height: clamp\(190px, 36dvh, 360px\)/);
  assert.match(styles, /position: sticky/);
});

test("Circuit storage falls back to memory when the storage getter is blocked", () => {
  const blocked = {};
  Object.defineProperty(blocked, "localStorage", {
    get() {
      throw new DOMException("blocked", "SecurityError");
    }
  });
  const backend = createCircuitStorage(blocked);
  assert.equal(backend.persistent, false);
  backend.storage.setItem("flight", "saved");
  assert.equal(backend.storage.getItem("flight"), "saved");
  backend.storage.removeItem("flight");
  assert.equal(backend.storage.getItem("flight"), null);
});

test("Circuit submission errors distinguish retryable outages from permanent rejections", () => {
  assert.equal(isRetryableCircuitError(new TypeError("offline")), true);
  assert.equal(isRetryableCircuitError({ status: 429 }), true);
  assert.equal(isRetryableCircuitError({ status: 503 }), true);
  assert.equal(isRetryableCircuitError({ status: 410 }), false);
  assert.equal(isRetryableCircuitError({ status: 422 }), false);
  assert.equal(isRetryableCircuitError({ retryable: false }), false);
});
