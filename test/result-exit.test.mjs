import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const defaultProfile = await readFile(new URL("../public/default-profile.mjs", import.meta.url), "utf8");
const feedbackUi = await readFile(new URL("../public/feedback-preferences-ui.mjs", import.meta.url), "utf8");
const shareRuntime = await readFile(new URL("../public/share-card-runtime.mjs", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/simple-ui.css", import.meta.url), "utf8");

function functionSource(name, nextName) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const end = nextName ? app.indexOf(`function ${nextName}(`, start + 1) : -1;
  return app.slice(start, end >= 0 ? end : start + 4000);
}

function between(startMarker, endMarker, source = app) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `${startMarker} must exist`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `${endMarker} must follow ${startMarker}`);
  return source.slice(start, end);
}

test("the completed-game close control is explicit, accessible, and pinned while results scroll", () => {
  const dialog = page.match(/<dialog\b(?=[^>]*\bid="resultDialog")[^>]*>[\s\S]*?<\/dialog>/i)?.[0] || "";
  const close = dialog.match(/<button\b(?=[^>]*\bid="resultClose")[^>]*>[\s\S]*?<\/button>/i)?.[0] || "";
  assert.ok(close, "the completed-game dialog needs its own close control");
  assert.match(close, /\bdata-close="resultDialog"/i);
  assert.match(close, /\baria-label="[^"]*(?:leave|main menu)[^"]*"/i);
  assert.match(styles, /[.]simple-ui [.]result-modal > [.]result-close\s*\{[^}]*position:\s*sticky\s*!important[^}]*top:\s*max\(/s);
  assert.match(styles, /[.]result-close\s*\{[^}]*z-index:\s*20/s);
});

test("closing a completed result performs a real return-home action", () => {
  const closeHandlers = app.slice(
    app.indexOf(`$$('[data-close]')`),
    app.indexOf("els.missionBriefingDialog.addEventListener")
  );
  assert.match(closeHandlers, /button[.]dataset[.]close === "resultDialog"[\s\S]*returnHome\(\)[\s\S]*return;/);

  const home = app.slice(
    app.indexOf("function returnHome("),
    app.indexOf("async function beginPrimaryOrbit")
  );
  assert.match(home, /els[.]gameScreen[.]hidden = true/);
  assert.match(home, /els[.]startScreen[.]hidden = false/);
  assert.match(home, /pendingScoreBlocksExit\(\)[\s\S]*showToast\([\s\S]*return;/, "an unsaved score must keep the result visible instead of stranding the player");
});

test("result-owned detail dialogs keep the completed result underneath them", () => {
  const childActions = [
    between(`$("#resultAtlas").addEventListener`, `$("#viewMastery").addEventListener`),
    between(`$("#resultShare").addEventListener`, `\n  }\n\n  return Object.freeze`, shareRuntime),
    between(`$("#resultReveal").addEventListener`, `$("#resultPrimary").addEventListener`),
    between(`$("#resultLeaderboard").addEventListener`, `els.profileDialog.querySelectorAll`)
  ];
  for (const action of childActions) {
    assert.doesNotMatch(action, /resultDialog[.]close\(\)/, "opening a child dialog must not expose the inert finished board");
  }
  assert.match(childActions[0], /openAtlas\("orbit"\)/);
  assert.match(childActions[1], /openShare\(\)/);
  assert.match(childActions[2], /openRevealPath\(\)/);
  assert.match(childActions[3], /openLeaderboard\(/);

  const confirmation = functionSource("confirmRevealPath", "buildRevealLayout");
  const requestAt = confirmation.indexOf('fetchJson("/api/run/reveal"');
  const closeAt = confirmation.indexOf("els.resultDialog.close()");
  const playbackAt = confirmation.indexOf("await playRevealPath(route)");
  assert.ok(requestAt >= 0 && closeAt > requestAt && playbackAt > closeAt, "Results may close only after reveal permission commits and immediately before playback");
});

test("new-game actions leave Results available until the replacement run commits", () => {
  const retry = functionSource("retryGame", "replayFinishedChallenge");
  const replay = functionSource("replayFinishedChallenge", "startTimer");
  const finish = functionSource("finishGame", "submitRankedScore");
  const communityRace = between(`$("#raceCommunityGhost").addEventListener`, `$("#resultLeaderboard").addEventListener`);

  assert.doesNotMatch(retry, /resultDialog[.](?:close|showModal)\(\)/);
  assert.match(retry, /await beginMode\(mode, options\)/);
  assert.doesNotMatch(replay, /resultDialog[.](?:close|showModal)\(\)/);
  assert.match(replay, /await startWithGame\(payload[.]game, payload[.]run,\s*\{\s*enterThroughGate:\s*true\s*\}\)/);
  assert.doesNotMatch(communityRace, /resultDialog[.]close\(\)/);
  assert.match(communityRace, /retryGame\(\)/);

  assert.doesNotMatch(finish, /state[.]resultAction\s*=\s*\(\)\s*=>\s*\{[\s\S]{0,180}resultDialog[.]close\(\)/);
  assert.match(finish, /if \(state[.]mode === "daily"\)[\s\S]{0,120}updateDailyStreak\(\)/);
  assert.doesNotMatch(finish, /if \(state[.]mode === "daily"\)[\s\S]{0,180}state[.]resultAction = \(\) => void beginMode\("reach"\)/);
  assert.match(finish, /profile[.]weekly[.]complete = true[\s\S]{0,260}state[.]resultAction = \(\) => void beginMode\("reach"\)/);
  assert.match(finish, /state[.]resultAction = \(\) => void beginMode\("weekly"\)/);
  assert.match(finish, /won && state[.]mode === "daily" \? "Return home"/);
  assert.match(finish, /won && state[.]mode === "weekly" \? "Play next level"/);
  assert.match(finish, /state[.]resultAction = \(\) => void startSecondOrbit\(\{\s*enterThroughGate:\s*true\s*\}\)/);
  assert.match(finish, /state[.]resultAction = \(\) => void beginMode\("reach"\)/);
});

test("a win commits before async bookkeeping and presents results only after the board settles", () => {
  const combine = functionSource("combineNodes", "expectedPairKey");
  const committedAt = combine.indexOf("commitGameOutcome()");
  const eventAt = combine.indexOf("await recordEventDiscovery(result)");
  const finishAt = combine.indexOf('if (won) finishGame(true, "", {');
  assert.ok(committedAt >= 0 && eventAt > committedAt, "the timer-safe outcome lock must precede async event work");
  assert.ok(finishAt > eventAt, "result preparation follows optional event bookkeeping");
  assert.doesNotMatch(combine, /setTimeout\(\(\) => finishGame\(true/, "a detached timer must not own the winning outcome");

  const commit = functionSource("commitGameOutcome", "combineNodes");
  assert.match(commit, /if \(state[.]finished\) return false/);
  assert.match(commit, /state[.]finished = true[\s\S]*stopTimer\(\)/);

  const presentation = functionSource("presentResultAfterCelebration", "finishGame");
  assert.match(presentation, /await waitForPaints\(2\)/);
  assert.match(presentation, /const fullHold = victoryHandoffHoldMs\(\{[\s\S]*authoredGoldenPair:[\s\S]*reducedMotion:/);
  assert.match(presentation, /performance[.]now\(\) - celebrationStartedAt/);
  assert.match(presentation, /resultPresentationIsCurrent\(snapshot\)[\s\S]*cosmicGate[.]presentDialog/);
  assert.match(presentation, /gameAudio[.]setScene\("result"\)[\s\S]*cosmicGate[.]presentDialog/);

  const finish = functionSource("finishGame", "submitRankedScore");
  assert.doesNotMatch(finish, /gameAudio[.]setScene\("result"\)/, "result audio must not cut off the board celebration");
  assert.match(finish, /presentResultAfterCelebration\(/);
});

test("More details keeps useful actions while removing duplicate and unavailable panels", () => {
  const dialog = page.match(/<dialog\b(?=[^>]*\bid="resultDialog")[^>]*>[\s\S]*?<\/dialog>/i)?.[0] || "";
  const details = dialog.match(/<details\b(?=[^>]*\bid="resultDetails")[^>]*>[\s\S]*?<\/details>/i)?.[0] || "";
  assert.match(details.match(/<details\b[^>]*>/i)?.[0] || "", /\bhidden\b/, "detail panels must be absent until enabled in Settings");
  assert.match(details, /id="resultRouteSummary"/);
  assert.match(details, /id="resultAtlas"/);
  assert.match(details, /id="signatureResultSummary"/);
  assert.match(details, /id="rewardCard"/);
  assert.match(details, /id="resultShare"/);
  assert.doesNotMatch(details, /id="resultRouteTrail"|id="signatureResultMetrics"|id="signaturePersonalBest"/);
  assert.match(styles, /[.]simple-ui [.]result-route-card\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/s);
  assert.match(styles, /[.]simple-ui [.]signature-result-card\s*\{[^}]*min-height:\s*68px/s);
});

test("detailed results are a persisted, default-off Settings preference", () => {
  assert.match(page, /id="resultDetailsPreference"[^>]+aria-pressed="false"[\s\S]*Show “More details”[\s\S]*OFF/);
  assert.match(defaultProfile, /feedbackPreferences:\s*\{[^}]*sound:\s*true[^}]*music:\s*true[^}]*resultDetails:\s*false[^}]*volume:\s*[.]75[^}]*musicVolume:\s*1[^}]*sfxVolume:\s*1/);
  assert.match(app, /feedbackPreferencesUi[.]render\(\)/);
  assert.match(feedbackUi, /\["resultDetails", "resultDetailsPreference", "result_details_toggled"\]/);
  assert.match(feedbackUi, /resultDetails[.]hidden = !preferences[.]resultDetails/);
  assert.match(app, /resultDetails["']\)[.]hidden = !sanitizeFeedbackPreferences\(profile[.]feedbackPreferences\)[.]resultDetails/);
  assert.match(feedbackUi, /addEventListener[?][.]\("click", \(\) => toggle\(field, eventName\)\)/);
  assert.match(app, /save:\s*\(\) => saveProfile\(\{ fields:\s*\["settings"\] \}\)/);
});

test("committed answer playback has a real escape hatch if presentation fails", () => {
  const confirmation = functionSource("confirmRevealPath", "buildRevealLayout");
  const replay = functionSource("replayRevealPathOnce", "toggleRevealPause");

  assert.match(confirmation, /let playbackCommitted = false/);
  assert.match(confirmation, /playbackCommitted = true[\s\S]*resultDialog[.]close\(\)[\s\S]*await playRevealPath\(route\)/);
  assert.match(confirmation, /catch \(error\)[\s\S]*playbackCommitted[\s\S]*returnHome\(\)/);
  assert.match(replay, /catch \(error\)[\s\S]*returnHome\(\)/);
});
