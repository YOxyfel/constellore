import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const [appCore, page, experience, wordOrbitRuntime, inventoryRuntime] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/cinematic/voyage-projection-experience.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/word-orbit-runtime.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/inventory-view-runtime.mjs", import.meta.url), "utf8")
]);
const app = `${appCore}\n${inventoryRuntime}`;

function sourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing source boundary: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing source boundary: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("ordinary entry opens home directly and only explicit birthday links launch personal replay", () => {
  const startup = sourceBetween(app, "const startupParams", "const ctrlHover");
  for (const scenario of [
    { search: "", expected: ["world", "home"] },
    { search: "?birthday=off", expected: ["world", "home"] },
    { search: "?voyage=realtime", expected: ["world", "home"] },
    { search: "?voyage=video", expected: ["world", "home"] },
    { search: "?birthday=guest", expected: ["world", "home", "birthday"] },
    { search: "?birthday=replay", expected: ["world", "home", "birthday"] },
    { search: "?birthday=special", expected: ["world", "home", "birthday"] },
    { search: "", resume: {}, expected: ["world"] },
    { search: "", resume: {}, scramble: "invite123", expected: ["world", "home"] }
  ]) {
    const calls = [];
    runInNewContext(startup, {
      URLSearchParams,
      location: { search: scenario.search },
      todayKey: "2026-09-06",
      parseConstelloreChallengeUrl: () => null,
      firstGameLaunchIntent: () => null,
      startupScrambleInvite: () => scenario.scramble || "",
      hasRememberedScrambleMatch: () => false,
      readActiveRunSnapshot: () => scenario.resume || null,
      selectStartupResumeSnapshot: ({ snapshot }) => snapshot,
      ensureHomePlanetHub: () => calls.push("world"),
      handoffLaunchMenu: () => calls.push("home"),
      handoffBirthdayVoyage: () => calls.push("birthday")
    });
    assert.deepEqual(calls, scenario.expected, JSON.stringify(scenario));
  }
  assert.doesNotMatch(appCore, /createVoyageProjectionExperience|createFirstOpenCinematic|playLegacyLaunchCinematic|playStartupVoyageProjection/);
});

test("archived Voyage Projection cannot record authoritative world arrival", () => {
  assert.match(experience, /arrivalWorldId:\s*null/);
  assert.doesNotMatch(experience, /recordExpeditionArrival|setActiveWorld|activeWorldId\s*=|onArrivalIntent/);
});

test("Settings retains learning replays without the removed launch movie", () => {
  assert.doesNotMatch(page, /replayVoyageProjection|voyageProjectionReplayTitle/);
  assert.doesNotMatch(appCore, /replayVoyageProjection/);
  assert.match(page, /id="replayFirstOrbit"/);
  assert.match(page, /id="replaySecondOrbit"/);
});

test("Reveal and the observatory have one mutually exclusive canvas owner", () => {
  const startCosmos = sourceBetween(app, "function startCosmos()", "let boardNoticeTimer");
  const observatoryBranch = sourceBetween(
    startCosmos,
    "if (observatory && !revealOwnsCanvas",
    "observatory?.suspend"
  );

  assert.match(startCosmos, /const revealOwnsCanvas = Boolean\(state[.]reveal[?][.]active \|\| state[.]reveal[?][.]pending\)/);
  assert.match(observatoryBranch, /observatory[.]sync\(combiningBoardView\(\)\);\s*return;/);
  assert.doesNotMatch(observatoryBranch, /startCosmosCanvas/);
  assert.match(startCosmos, /observatory[?][.]suspend\(revealOwnsCanvas \? "reveal-canvas" : "legacy-canvas"\)[\s\S]*startCosmosCanvas\(/);
});

test("authored Golden Pair playback and generic observatory fusion are never layered", () => {
  const fusion = sourceBetween(app, "const goldenPairPlayback", "const celebrationStartedAt");

  assert.match(fusion, /if \(goldenPairPlayed\)\s*\{[\s\S]*?combiningBoardRuntime[?][.]cancelFusion\(\);[\s\S]*?\}\s*else if \(fusionPresentation\)\s*\{\s*combiningBoardRuntime[?][.]beginFusion\(fusionPresentation\);\s*const fusionRelease = combiningBoardRuntime[?][.]commitFusion\(/);
  assert.equal((fusion.match(/commitFusion\(/g) || []).length, 1);
  assert.equal((fusion.match(/beginFusion\(/g) || []).length, 1);
});

test("the Constellation Bloom is native on mobile and an explicit desktop observatory preference", () => {
  assert.match(page, /<link rel="stylesheet" href="\/combining-board[.]css[?]v=/);
  assert.match(page, /id="gameScreen"[^>]*data-board-presentation="observatory"/);
  assert.match(app, /function spatialBloomSelectorActive\(\)[\s\S]*if \(mobilePlayShellActive\(\)\) return true;[\s\S]*desktopWordSelectorPreference\(\) === "bloom"[\s\S]*boardPresentation === "observatory"[\s\S]*state[.]mode !== "scramble"/);
  assert.match(app, /observatory:\s*spatialBloomSelectorActive\(\)/);
  assert.match(app, /if \(spatialBloomSelectorActive\(\)\)/);
  assert.match(wordOrbitRuntime, /view[.]mobile !== false \|\| view[.]observatory === true/);
});

test("Bloom semantics reach the Observatory while legacy fallback restores classic presentation", () => {
  const boardView = sourceBetween(app, "function combiningBoardView()", "function activateLegacyCombiningBoard()");
  assert.match(boardView, /activeFacet:\s*wordOrbitRuntime[?][.]state[.]category \|\| ""/);
  assert.match(app, /onActivity:\s*\(\{ type \}\)\s*=>\s*\{[\s\S]*?if \(type === "category"\) combiningBoardRuntime[?][.]sync\(combiningBoardView\(\)\);[\s\S]*?conceptBondRuntime[?][.]schedule\(\);[\s\S]*?\}/);
  assert.match(app, /document[.]querySelector\("#constellationBloomTrigger"\)/);

  const fallback = sourceBetween(app, "function activateLegacyCombiningBoard()", "function loadCombiningBoardModules()");
  assert.match(fallback, /dataset[.]boardRenderer = els[.]gameScreen[.]dataset[.]boardPresentation = document[.]body[.]dataset[.]boardPresentation = "legacy"/);
  assert.match(fallback, /if \(state[.]game\) renderInventory\(\)/);
  assert.equal((app.match(/activateLegacyCombiningBoard\(\);/g) || []).length, 2);
  assert.doesNotMatch(app, /if \(BOARD_PRESENTATION !== "observatory"\)/);
});
