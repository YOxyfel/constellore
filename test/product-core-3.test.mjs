import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildRouteProgress } from "../public/living-atlas.mjs";
import { missionDivision } from "../public/mission-briefing.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

test("3.0 uses explicit Pure, Open, Practice, and Study mission divisions", () => {
  assert.equal(missionDivision({ mode: "quick", ranked: true }).id, "pure");
  assert.equal(missionDivision({ mode: "quick", ranked: true, assist: "sense" }).id, "open");
  assert.equal(missionDivision({ mode: "reach", ranked: false }).id, "practice");
  assert.equal(missionDivision({ mode: "reach", scoreEligible: false }).id, "study");
  assert.equal(missionDivision({ mode: "quick", ranked: true }, { localOnly: true }).id, "practice");
});

test("route progress is bounded, non-spoiling, and recognizes the destination", () => {
  const history = Array.from({ length: 14 }, (_, index) => ({
    a: `A${index}`,
    b: `B${index}`,
    word: index === 13 ? "Telescope" : `Word ${index}`,
    emoji: "*",
    newDiscovery: index % 2 === 0
  }));
  const route = buildRouteProgress({ history, target: "Telescope", limit: 5 });
  assert.equal(route.combinations, 14);
  assert.equal(route.steps.length, 5);
  assert.equal(route.omitted, 9);
  assert.equal(route.targetReached, true);
  assert.ok(route.lineFill > 0 && route.lineFill <= 92);
});

test("the home and board expose one core loop with progressive destinations and Guidance", () => {
  assert.match(page, /id="primaryOrbitButton"/);
  assert.match(page, /id="modePicker"[\s\S]*MISSION RULES[\s\S]*Relaxed[\s\S]*Sprint[\s\S]*Precision/);
  assert.match(page, /id="exploreHub"[\s\S]*DAILY WORD[\s\S]*EXPLORE · PRACTICE[\s\S]*Creator’s Lab/);
  assert.match(page, /id="senseButton"[\s\S]*<b>Guidance<\/b>/);
  assert.match(page, /id="runDivisionPill"/);
  assert.match(page, /id="routeProgressTrail"/);
  assert.match(page, /id="resultRouteTrail"/);
  assert.match(page, /id="resultDetails"/);
});

test("drag rendering reuses board nodes and caches collision geometry", () => {
  const renderBoard = app.slice(app.indexOf("function renderBoard("), app.indexOf("function syncSelectedNodeState", app.indexOf("function renderBoard(")));
  assert.match(renderBoard, /const existing = new Map/);
  assert.match(renderBoard, /syncBoardNodeElement/);
  assert.match(renderBoard, /els[.]boardItems[.]append\([.][.][.]ordered\)/);
  assert.doesNotMatch(renderBoard, /replaceChildren/);
  assert.match(app, /function captureDropGeometry\(/);
  assert.match(app, /geometry[?][.]version === boardGeometryVersion/);
  assert.match(app, /geometry[?][.]candidates \|\| eligibleDropCandidates/);
  assert.match(app, /MAX_TRANSIENT_TRAILS = 120/);
  assert.match(app, /state[.]trails[.]splice\(0, state[.]trails[.]length - MAX_TRANSIENT_TRAILS\)/);
});

test("launch intents preserve challenge precedence and always use the mission briefing", () => {
  assert.match(app, /async function handleLaunchIntent\(params\)/);
  assert.match(app, /mode === "daily"[\s\S]*await beginMode\("daily"\)/);
  assert.match(app, /mode === "explore" \|\| mode === "creator"/);
  assert.match(app, /if \(!restored && challengeRequested\)[\s\S]*else if \(!restored\) await handleLaunchIntent\(params\)/);
  assert.match(app, /function beginMode\([\s\S]*requestMissionPreview\(request\)[\s\S]*openMissionBriefing/);
});

test("diagnostics are opt-in, bounded, resettable, and same-origin", () => {
  assert.match(page, /id="diagnosticsPreference"[^>]+aria-pressed="false"/);
  assert.match(page, /id="exportDiagnostics"/);
  assert.match(page, /id="resetAnalyticsIdentity"/);
  assert.match(app, /let analyticsPreference = readAnalyticsPreference\(\)/);
  assert.match(app, /if \(!analyticsPreference\) return/);
  assert.match(app, /ANALYTICS_DIMENSIONS/);
  assert.match(app, /new URL\("\/api\/analytics", location[.]origin\)/);
  assert.match(app, /analyticsUrl[.]origin !== location[.]origin/);
  assert.match(app, /credentials: "same-origin"/);
  assert.match(app, /track\("sense_opened"/);
  assert.doesNotMatch(app, /track\("powerups_opened"/);
});

test("monetization stays cosmetic or earn-only while competitive play stays clean", () => {
  assert.match(page, /SUPPORTER PACK · LIFETIME[\s\S]*never changes recipes, Guidance, score, time, moves, or leaderboard eligibility/);
  assert.match(page, /Creator’s Lab[\s\S]*always unranked/);
  assert.match(app, /COMMERCE_LAUNCH_READY = document[.]body[.]dataset[.]commerce === "enabled"/);
  assert.match(app, /Purchases stay disabled during the free beta/);
  assert.match(app, /Creator words are available only in unranked Practice or Creator’s Lab/);
  assert.match(app, /Star Credits are earned through verified play and are never sold/);
});

test("missing combinations offer one bounded, no-free-text expectation report", () => {
  const feedback = page.match(/<section\b(?=[^>]*id="expectedPairFeedback")[\s\S]*?<\/section>/)?.[0] || "";
  assert.match(feedback, /Expected this to work/);
  assert.match(feedback, /No free text or identity is sent/);
  assert.match(app, /state[.]expectedPairReports[.]has\(key\)/);
  assert.match(app, /state[.]expectedPairReports[.]add\(report[.]key\)/);
  assert.match(app, /name: "combination_expected"/);
  assert.match(app, /String\(a\)[.]slice\(0, 48\)/);
});

test("new 3.0 surfaces retain the 15px text and 44px touch floors", () => {
  for (const selector of [".explore-card small", ".expected-pair-feedback em", ".mission-division small", ".diagnostics-preference small", ".result-route-card > div:first-child small"]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rule = styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] || "";
    assert.match(rule, /font(?:-size)?:[^;]*15px/, `${selector} must keep the readable text floor`);
  }
  assert.match(styles, /[.]expected-pair-feedback button\s*\{[^}]*min-height:\s*44px/);
  assert.match(styles, /[.]result-route-card > button\s*\{[^}]*min-height:\s*44px/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*[.]sense-modal\s*\{[^}]*height:\s*100dvh/);
});
