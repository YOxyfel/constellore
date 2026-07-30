import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [app, page, loader, bridge, runtime, model, arena, styles] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/secondary-surface-loader.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/scramble-app-bridge.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/scramble-runtime.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/scramble.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/scramble-arena.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/scramble.css", import.meta.url), "utf8")
]);

function between(source, start, end) {
  return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
}

test("Constellation Scramble is a lazy secondary surface with explicit home entry points", () => {
  assert.match(page, /data-duel-api="\/api\/duels"/);
  assert.match(page, /id="scrambleHomeButton"[\s\S]*CONSTELLATION SCRAMBLE/);
  assert.match(page, /id="scrambleMenuButton"[\s\S]*Constellation Scramble/);
  assert.match(page, /id="scrambleHomeButton"[^>]+data-progressive="secondary"/);
  assert.match(loader, /export async function createLazyScramble/);
  assert.match(loader, /loadOptionalStylesheet\("scramble[.]css[?]v=/);
  assert.match(loader, /import\("[.]\/scramble-runtime[.]mjs[?]v=/);
  assert.match(loader, /import\("[.]\/scramble-app-bridge[.]mjs[?]v=/);
  assert.match(loader, /const projection = bridge[.]projectScrambleHostMatch\(match\)/);
  assert.match(loader, /return projection [?] callback\(projection, metadata\) : false/);
  assert.match(loader, /onChapterChange:\s*typeof onChapterChange[\s\S]*projectForHost\(onChapterChange\)/);
  for (const filename of ["scramble.css", "scramble-runtime.mjs", "scramble-app-bridge.mjs", "scramble.mjs", "scramble-arena.mjs", "forge-clash.mjs"]) {
    assert.match(loader, new RegExp(`"${filename.replace(".", "[.]")}[?]v=`));
  }
  assert.doesNotMatch(app.slice(0, app.indexOf("const starterEmoji")), /from "[.]\/scramble(?:-runtime)?[.]mjs/);
  assert.doesNotMatch(app, /from "[.]\/scramble-app-bridge[.]mjs/);
});

test("the host adapter uses the configured API and native authenticated streaming fetch", () => {
  assert.match(app, /DUEL_API_BASE = configuredDuelApiBase\(document[.]body[.]dataset[.]duelApi\)/);
  assert.match(app, /request: requestDuelApi/);
  assert.match(app, /"X-Constellore-Player": identity[.]playerId/);
  assert.match(app, /"X-Constellore-Token": identity[.]playerToken/);
  assert.match(app, /playerToken = String\([\s\S]*[.]slice\(0, 1_024\)/);
  assert.match(app, /!isStaticBeta && \(!profile[.]playerId \|\| !profile[.]playerToken \|\| playerIdentityPromise\)[\s\S]*await ensurePlayer\(\)/);
  assert.match(app, /if \(options[.]stream\) return response/);
  assert.match(app, /duelPlayerUrl\("\/register"\)/);
  const ensure = between(app, "function ensureScramble()", "async function openScramble");
  assert.doesNotMatch(ensure, /fetchJson/);
  assert.match(runtime, /events[?]after=\$\{model[.]lastSequence\}/);
  assert.match(runtime, /response[.]body[.]getReader/);
  assert.match(runtime, /line[.]startsWith\("data:"\)/);
  for (const eventType of [
    "player_joined",
    "ready",
    "countdown_started",
    "match_started",
    "match_finished",
    "rematch_ready"
  ]) assert.match(runtime, new RegExp(`"${eventType}"`));
  assert.match(runtime, /scheduleSnapshotResync\(model[.]id\)/);
  assert.match(runtime, /switchToRematch\(nextDuelId \|\| model[.]nextDuelId \|\| model[.]rematch[?][.]nextDuelId\)/);
  assert.match(runtime, /awaitingRematch/);
});

test("runtime follows the canonical lobby, matchmaking, action, heartbeat, forfeit, and rematch routes", () => {
  for (const marker of [
    'request("/invites"',
    'request("/join"',
    'request("/matchmaking/join"',
    'request("/matchmaking"',
    "/ready`",
    "/actions`",
    "/heartbeat`",
    "/forfeit`",
    "/rematch`"
  ]) assert.ok(runtime.includes(marker), `missing ${marker}`);
  assert.match(runtime, /request\(`\/rating[?]format=\$\{encodeURIComponent\(format\)\}`\)/);
  assert.match(runtime, /body: \{ actionId: actionId\("invite"\), format \}/);
  assert.match(runtime, /body: \{ inviteCode: code, actionId: actionId\("join"\) \}/);
  assert.match(app, /soloWins: \(\) => profile[.]wins/);
  assert.match(runtime, /actionId: actionId\("queue"\),[\s\S]*format,[\s\S]*soloWins: Math[.]max\(0, Math[.]min\(100_000, Math[.]floor\(Number\(options[.]soloWins[?][.]\(\)\) \|\| 0\)\)\)/);
  assert.match(runtime, /expectedRevision: model[.]revision,[\s\S]*a: String\(a[\s\S]*b: String\(b/);
  assert.match(runtime, /lastEventSequence: model[.]lastSequence/);
});

test("duel play has an authoritative app path and cannot grant solo rewards", () => {
  assert.match(app, /function hydrateScrambleMatch\(projection\)/);
  assert.match(app, /onChapterChange: hydrateScrambleMatch/);
  assert.match(app, /projection[.]epochKey === scrambleHostEpochKey/);
  assert.match(loader, /projectScrambleHostMatch\(match\)/);
  assert.match(bridge, /mode: "scramble"/);
  assert.match(bridge, /scoreEligible: false/);
  assert.match(bridge, /const authoritativeBoard = selfBoard\(source\)/);
  assert.doesNotMatch(bridge, /source[.]events|match[.]events/);
  assert.match(app, /function finishScrambleMatch\(\)/);
  const combine = between(app, "async function combineNodes(a, b)", "function expectedPairKey");
  assert.match(combine, /scrambleRuntime[.]submitAction/);
  assert.match(combine, /const won = Boolean\(!scrambleActive/);
  assert.match(combine, /const mastery = scrambleActive [?] null : recordMasteryStep/);
  assert.match(combine, /if \(!scrambleActive && !learningOrbitActive\(\) && state[.]mode !== "explore"\)/);
  assert.match(combine, /if \(!scrambleActive && !won[\s\S]*offerRecipeFeedback/);
  assert.match(app, /state[.]mode === "scramble"[\s\S]*requestForfeitConfirmation/);
  assert.match(app, /state[.]mode === "scramble" \|\| !activeRunPersistence/);
  assert.doesNotMatch(between(app, "function finishScrambleMatch()", "function startWithGameNow"), /finishGame\(/);
});

test("the live surface exposes every rival outcome without an automated steal control", () => {
  assert.match(runtime, /id="scrambleRivalTicker"[\s\S]*id="scrambleAnnouncer" aria-live="polite"/);
  assert.match(runtime, /id="scrambleRivalEvents"/);
  assert.match(runtime, /RIVAL_EVENT_TYPES = new Set\(\["attempt", "success", "failure"/);
  assert.match(model, /fusion_attempted/);
  assert.match(model, /fusion_succeeded/);
  assert.match(model, /fusion_rejected/);
  assert.match(model, /actorSlot/);
  assert.match(model, /selfSlot/);
  assert.doesNotMatch(`${runtime}\n${page}`, /Copy pair/i);
});

test("desktop, tablet, and phone layouts remain distinct and accessible", () => {
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\) minmax\(310px, [.]82fr\) 260px/);
  assert.match(styles, /@media \(min-width: 701px\) and \(max-width: 1179px\)/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /scramble-rival-ticker,[\s\S]*scramble-view-toggle[\s\S]*display: grid/);
  assert.match(styles, /scramble-view-rival :is\(#board, [.]inventory\)/);
  assert.match(styles, /min-height: 44px/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(runtime, /aria-live="assertive"/);
  assert.match(runtime, /requestForfeitConfirmation/);
});

test("Scramble Arena exposes mode-safe selection, presentation, and action locking", () => {
  for (const mode of ["target-race", "wordstorm", "forge-clash", "riddle-saga", "claim-war"]) {
    assert.match(arena, new RegExp(`id: "${mode}"`));
  }
  assert.match(runtime, /SCRAMBLE_MODES[.]map\(formatOptionMarkup\)/);
  assert.match(runtime, /<fieldset class="scramble-format-picker"/);
  assert.match(runtime, /definition[.]enabled [^\\n]* "" : " disabled"/);
  assert.match(runtime, /picker[.]disabled = locked/);
  assert.match(runtime, /model[.]id[\s\S]*scrambleFormat\(model[.]format\)/);
  assert.match(runtime, /dataset[.]scrambleFormat = value/);
  assert.match(runtime, /delete element[.]dataset[.]scrambleFormat/);
  assert.match(runtime, /authoritativeFormat\(\) !== "forge-clash"/);
  assert.match(runtime, /assertForgeActionAvailable\(\)[\s\S]*actionQueue[.]catch/);
  assert.match(runtime, /then\(\(\) => submitActionNow\(input\)\)/);
  assert.match(styles, /[.]scramble-format-picker > div[\s\S]*grid-template-columns: repeat\(5/);
  assert.match(styles, /[.]scramble-format-option[\s\S]*min-height: 108px/);
});

test("Riddle Saga renders authoritative story state, locks chapter gaps, and exposes a same-match rollover callback", () => {
  assert.match(runtime, /id="scrambleSagaTrack"[\s\S]*id="scrambleSagaChapters"/);
  assert.match(runtime, /id="scrambleSagaTitle"[\s\S]*id="scrambleSagaStory"[\s\S]*id="scrambleSagaTarget"/);
  assert.match(runtime, /id="scrambleSagaSelfScore"[\s\S]*id="scrambleSagaRivalScore"/);
  assert.match(runtime, /id="scrambleSagaMoment"[^>]+aria-live="assertive"/);
  assert.match(runtime, /id="scrambleSagaLedgerList"/);
  assert.match(runtime, /options[.]onChapterChange[?][.]\(snapshot, metadata\)/);
  assert.match(runtime, /previousChapterNumber:[\s\S]*chapterVersion:[\s\S]*chapterStartsAt:[\s\S]*chapterDeadlineAt:/);
  assert.match(runtime, /saga && saga[.]status !== "playing"[\s\S]*scramble_chapter_locked/);
  assert.match(runtime, /Date[.]parse\(saga[?][.]chapterStartsAt \|\| model[.]startsAt/);
  assert.match(runtime, /scramble_chapter_countdown/);
  assert.match(runtime, /chapterNumber && formatNumber\(model[.]saga[?][.]chapterNumber\) !== chapterNumber/);
  assert.match(runtime, /sagaBoundary <= Date[.]now\(\)[\s\S]*sagaBoundaryResyncKey[\s\S]*scheduleSnapshotResync\(model[.]id\)/);
  assert.match(model, /settledChapters[\s\S]*scores/);
  assert.match(model, /future chapter material[\s\S]*discarded/i);
  assert.match(styles, /[.]scramble-saga-track[\s\S]*grid-template-columns: repeat\(5/);
  assert.match(styles, /[.]scramble-saga-moment[\s\S]*position: fixed/);
  assert.match(styles, /[.]scramble-saga-ledger/);
});

test("the host handoff waits before ending the winning board presentation", () => {
  const finish = between(runtime, "function finishHostMatch()", "function startClock()");
  const waitAt = finish.indexOf("await wait(holdMs)");
  const guardAt = finish.indexOf("lifecycleGeneration !== finishGeneration");
  const finishCallbackAt = finish.indexOf("options.onFinished?.(model)");
  const dialogAt = finish.indexOf("dialog?.showModal()");
  assert.ok(waitAt >= 0 && waitAt < guardAt);
  assert.ok(guardAt < finishCallbackAt);
  assert.ok(finishCallbackAt < dialogAt);
});
