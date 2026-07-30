import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildRouteProgress } from "../public/living-atlas.mjs";
import { missionDivision } from "../public/mission-briefing.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
const simpleStyles = await readFile(new URL("../public/simple-ui.css", import.meta.url), "utf8");
const reportDelivery = await readFile(new URL("../public/combination-report-delivery.mjs", import.meta.url), "utf8");
const sessionResume = await readFile(new URL("../public/session-resume.mjs", import.meta.url), "utf8");

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

test("the home and board expose one plain core loop and one Help action", () => {
  assert.match(page, /id="primaryOrbitButton"/);
  assert.match(page, /id="modePicker"[\s\S]*Choose a game[\s\S]*Relaxed[\s\S]*Timed[\s\S]*Limited moves/);
  assert.match(page, /id="exploreHub"[\s\S]*Today.s word[\s\S]*FREE PLAY[\s\S]*Choose a word/);
  assert.match(page, /id="senseButton"[\s\S]*<b>Help<\/b>/);
  assert.match(page, /class="run-division-pill practice simple-hidden" id="runDivisionPill"/);
  assert.match(page, /class="run-milestone" id="runMilestone"[\s\S]*id="routeProgressTrail"/);
  assert.match(simpleStyles, /:is\([.]rival-ghost, [.]ghost-preview\)\s*\{[^}]*display:\s*none !important/);
  assert.match(simpleStyles, /[.]simple-ui [.]run-milestone\s*\{[^}]*width:[^}]*padding:/);
  assert.match(page, /id="resultRouteSummary"/);
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

test("launch intents preserve challenge precedence and use gated post-load objectives", () => {
  assert.match(app, /async function handleLaunchIntent\(params\)/);
  assert.match(app, /mode === "daily"[\s\S]*await beginMode\("daily"\)/);
  assert.match(app, /mode === "explore" \|\| mode === "creator"/);
  const startup = app.slice(app.indexOf("const startupParams"), app.indexOf("const ctrlHover"));
  const boot = app.slice(app.indexOf("async function boot()"), app.indexOf("boot().catch"));
  assert.match(app, /import \{[^}]*selectStartupResumeSnapshot[^}]*\} from "[.]\/session-resume[.]mjs[?]v=/);
  assert.match(sessionResume, /export function snapshotMatchesLaunchIntent\([\s\S]*snapshot[.]game[.]target[\s\S]*sharedChallenge[.]target[\s\S]*snapshot[.]game[.]seed[\s\S]*sharedChallenge[.]seed/);
  assert.match(sessionResume, /const expectedMode = modeIntent === "creator" \? "explore" : modeIntent/);
  assert.match(sessionResume, /export function selectStartupResumeSnapshot\([\s\S]*reload[\s\S]*\(!sharedChallenge && !modeIntent\)[\s\S]*snapshotMatchesLaunchIntent\(snapshot, sharedChallenge, modeIntent\)/);
  assert.match(startup, /const startupResumeSnapshot = selectStartupResumeSnapshot\(\{\s*snapshot: readActiveRunSnapshot\(\),\s*sharedChallenge: startupSharedChallenge,\s*modeIntent: startupModeIntent\s*\}\)/);
  assert.ok(
    startup.indexOf("const startupResumeSnapshot")
      < startup.indexOf('await import("./cinematic/first-open-cinematic.mjs?v='),
    "same/matching active-run URLs must be resolved before cinematic playback"
  );
  assert.match(boot, /const sharedChallenge = parseConstelloreChallengeUrl\(params, todayKey\)/);
  assert.match(boot, /const savedRun = startupResumeSnapshot/);
  assert.match(boot, /const restored = firstGameStarted\s*\?\s*false\s*:\s*await restoreInterruptedRun\(savedRun\)/);
  assert.match(boot, /const launchMenuHandoff = launchCinematicOutcome[.]menuHandoff === true/);
  assert.match(boot, /else if \(!restored && !firstGameStarted && sharedChallenge\)[\s\S]*void beginMode\(mode,[\s\S]*const launchHandled = await handleLaunchIntent\(params\)[\s\S]*!launchHandled && !launchMenuHandoff && firstGameRequired\(profile\)/);
  assert.match(app, /function beginMode\([\s\S]*enterPreparedMission/);
  assert.match(app, /function enterPreparedMission\([\s\S]*ready:[\s\S]*openMissionBriefing/);
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
  assert.match(page, /SUPPORTER PACK · LIFETIME[\s\S]*never changes recipes,[\s\S]*score, time, moves, or leaderboard eligibility/);
  assert.match(page, /Custom targets do not go on leaderboards/);
  assert.match(app, /COMMERCE_LAUNCH_READY = document[.]body[.]dataset[.]commerce === "enabled"/);
  assert.match(app, /Purchases stay disabled during the free beta/);
  assert.match(app, /Creator words are available only in unranked Practice or Creator’s Lab/);
  assert.match(app, /Star Credits are earned through verified play and are never sold/);
});

test("missing combinations ask for one bounded result and use the correct delivery path", () => {
  const feedback = page.match(/<section\b(?=[^>]*id="expectedPairFeedback")[\s\S]*?<\/section>/)?.[0] || "";
  assert.match(feedback, /What should[\s\S]*make[?]/);
  assert.match(feedback, /id="expectedPairResult"[^>]*maxlength="28"/);
  assert.doesNotMatch(feedback, /<textarea/i, "the report must not collect an open comment");
  assert.doesNotMatch(feedback, /type="email"|name="(?:name|email|contact)"/i, "the report must not collect identity or contact fields");
  assert.match(feedback, /Do not enter your name or private information/);
  assert.match(app, /state[.]expectedPairReports[.]has\(key\)/);
  assert.match(app, /state[.]expectedPairReports[.]add\(report[.]key\)/);
  assert.match(app, /sanitizeCombinationSuggestion\(els[.]expectedPairResult[.]value\)/);
  assert.match(reportDelivery, /function sanitizeCombinationSuggestion\([\s\S]*normalized[.]length > 28[\s\S]*https[?]:/);
  assert.match(app, /PUBLIC_FEEDBACK_API_URL|FEEDBACK_API_URL/);
  assert.match(app, /validateCombinationReportEndpoint\(document[.]body[.]dataset[.]feedbackApi\)/);
  assert.match(reportDelivery, /function validateCombinationReportEndpoint\([\s\S]*\/api\/combination-reports/);
  const submit = app.slice(app.indexOf("async function submitExpectedPairFeedback"), app.indexOf("function resetRecipeFeedback"));
  assert.match(submit, /expectedPairDelivery[.]saveLocal\([\s\S]*expectedPairDelivery[.]queue[\s\S]*expectedPairDelivery[.]post/);
  assert.match(submit, /fetchJson\("\/api\/combination-reports"[\s\S]*expected: expected \|\| ""[\s\S]*reporterId:/);
  assert.match(submit, /no sign-in was needed/);
  assert.match(app, /window[.]addEventListener\("online", handleOnline\)[\s\S]*function boot\(\)/);
  assert.doesNotMatch(submit, /github[.]com|window[.]open|anchor[.]click/);
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
