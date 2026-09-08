import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [app, page, loader, bridge, runtime, model, arena, styles, arenaRanks] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/secondary-surface-loader.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/scramble-app-bridge.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/scramble-runtime.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/scramble.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/scramble-arena.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/scramble.css", import.meta.url), "utf8"),
  readFile(new URL("../public/arena-rank.mjs", import.meta.url), "utf8")
]);

function between(source, start, end) {
  return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
}

test("Scramble Arena is a lazy secondary surface with explicit home entry points", () => {
  assert.match(page, /data-duel-api="\/api\/duels"/);
  assert.match(page, /CONSTELLATION 1V1[\s\S]*id="scrambleHomeButton"/);
  assert.match(page, /id="scrambleMenuButton"[\s\S]*Scramble Arena/);
  assert.match(page, /id="scrambleHomeButton"[^>]+data-progressive="secondary"/);
  assert.match(loader, /export async function createLazyScramble/);
  assert.match(loader, /loadOptionalStylesheet\("scramble[.]css[?]v=/);
  assert.match(loader, /import\("[.]\/scramble-runtime[.]mjs[?]v=/);
  assert.match(loader, /import\("[.]\/scramble-app-bridge[.]mjs[?]v=/);
  assert.match(loader, /const projection = bridge[.]projectScrambleHostMatch\(match\)/);
  assert.match(loader, /return projection [?] callback\(projection, metadata\) : false/);
  assert.match(loader, /onChapterChange:\s*typeof onChapterChange[\s\S]*projectForHost\(onChapterChange\)/);
  for (const filename of [
    "arena-duel-card.css",
    "arena-duel-card.mjs",
    "scramble.css",
    "scramble-runtime.mjs",
    "scramble-app-bridge.mjs",
    "scramble.mjs",
    "scramble-arena.mjs",
    "forge-clash.mjs"
  ]) {
    assert.match(loader, new RegExp(`"${filename.replace(".", "[.]")}[?]v=`));
  }
  assert.doesNotMatch(app.slice(0, app.indexOf("const starterEmoji")), /from "[.]\/scramble(?:-runtime)?[.]mjs/);
  assert.doesNotMatch(app, /from "[.]\/scramble-app-bridge[.]mjs/);
});

test("Orbit Home presents Forge and Arena as ordered, exclusive destinations", () => {
  const splitStart = page.indexOf('id="homePlaySplit"');
  const splitEnd = page.indexOf('<section class="home-catalog mode-picker"', splitStart);
  const split = page.slice(splitStart, splitEnd);
  const soloAt = split.indexOf('data-play-path="solo"');
  const arenaAt = split.indexOf('data-play-path="arena"');

  assert.ok(splitStart >= 0 && splitEnd > splitStart, "the home play split must be present");
  assert.match(
    page,
    /<div\b(?=[^>]*id="homePlaySplit")(?=[^>]*role="group")(?=[^>]*aria-label="Choose how to play")[^>]*>/
  );
  assert.match(
    split,
    /<button\b(?=[^>]*id="homeOrbitTabArena")(?=[^>]*role="tab")(?=[^>]*aria-controls="homeOrbitArena")[^>]*>/
  );
  assert.match(
    split,
    /<section\b(?=[^>]*id="homeOrbitArena")(?=[^>]*role="tabpanel")(?=[^>]*aria-labelledby="homeOrbitTabArena")(?=[^>]*aria-hidden="true")(?=[^>]*inert)[^>]*>/
  );
  assert.ok(soloAt >= 0 && arenaAt > soloAt, "Solo must precede Arena in source and reading order");
  assert.equal((split.match(/data-play-path="solo"/g) || []).length, 1);
  assert.equal((split.match(/data-play-path="arena"/g) || []).length, 1);

  for (const id of [
    "primaryOrbitButton",
    "primaryOrbitSecondary",
    "scramblePortal",
    "scramblePortalTitle",
    "scrambleHomeStatus",
    "scramblePortalStakes",
    "scrambleHomeButton"
  ]) {
    assert.equal((split.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, `${id} must stay unique`);
  }

  assert.match(
    split,
    /<section\b(?=[^>]*class="primary-orbit-panel")(?=[^>]*aria-labelledby="primaryOrbitTitle")[^>]*>/
  );
  assert.match(split, /<button\b(?=[^>]*id="primaryOrbitButton")(?=[^>]*type="button")[^>]*>/);
  assert.match(split, /<button\b(?=[^>]*id="primaryOrbitSecondary")(?=[^>]*type="button")[^>]*>/);
  assert.match(
    split,
    /<section\b(?=[^>]*id="scramblePortal")(?=[^>]*data-progressive="secondary")(?=[^>]*data-play-path="arena")(?=[^>]*data-arena-state="locked")(?=[^>]*aria-labelledby="scramblePortalTitle")[^>]*>/
  );
  assert.match(split, /id="scramblePortalTitle">Scramble Arena<\/h2>/);
  assert.match(split, /class="arena-portal__visual" aria-hidden="true"/);
  assert.match(
    split,
    /<span\b(?=[^>]*id="scrambleHomeStatus")(?=[^>]*aria-live="polite")(?=[^>]*aria-atomic="true")[^>]*>/
  );
  assert.match(
    split,
    /<button\b(?=[^>]*id="scrambleHomeButton")(?=[^>]*type="button")(?=[^>]*data-progressive="secondary")(?=[^>]*data-arena-state="locked")(?=[^>]*aria-haspopup="dialog")(?=[^>]*aria-labelledby="scramblePortalAction scramblePortalTitle")(?=[^>]*aria-describedby="scrambleHomeStatus")(?=[^>]*disabled)[^>]*>/
  );
});

test("the compact Arena destination keeps full mode metadata hidden for its owned surface", () => {
  const modesStart = page.indexOf('id="scramblePortalModes"');
  const modesEnd = page.indexOf("</div>", modesStart);
  const modes = page.slice(modesStart, modesEnd);

  assert.ok(modesStart >= 0 && modesEnd > modesStart);
  assert.equal((modes.match(/<span>/g) || []).length, 4);
  assert.match(modes, /<b>Target Race<\/b><small>Reach it first<\/small>/);
  assert.match(modes, /<b>Wordstorm<\/b><small>Build for score<\/small>/);
  assert.match(modes, /<b>Forge Clash<\/b><small>Craft a champion<\/small>/);
  assert.match(modes, /<b>Riddle Saga<\/b><small>Race five chapters<\/small>/);
  assert.match(
    page,
    /id="scramblePortalStakes" data-arena-rank="bronze" hidden>[\s\S]*id="scrambleHomeArenaRankMark"[\s\S]*id="scrambleHomeArenaRank">Bronze Arena Rank[\s\S]*id="scrambleHomeArenaMode">Target Race[\s\S]*solo Route Rank unchanged[.]<\/p>/
  );
});

test("Arena entry sync locks every entry until Silver, then preserves service and ranked states", () => {
  const sync = between(app, "function syncScrambleEntryState()", "function duelFeatureAvailable()");
  const disabledAssignments = [...sync.matchAll(/\b(homeButton|menuButton)[.]disabled\s*=\s*([^;]+);/g)]
    .map(([, target, expression]) => [target, expression.trim()]);

  assert.deepEqual(disabledAssignments, [
    ["homeButton", "!available || !unlocked"],
    ["menuButton", "!available || !unlocked"]
  ]);
  assert.doesNotMatch(sync, /disabled\s*=\s*[^;]*ranked/);
  assert.match(sync, /const state = !unlocked [^;]* "locked" : !available [^;]* "unavailable" : ranked [^;]* "ranked" : "private-only";/);
  assert.match(sync, /homeButton[.]dataset[.]arenaState = state/);
  assert.match(sync, /portal[.]dataset[.]arenaState = state/);
  assert.match(sync, /state === "unavailable"[\s\S]*?"OFFLINE"/);
  assert.match(sync, /state === "locked"[\s\S]*?"SILVER REQUIRED"/);
  assert.match(sync, /state === "ranked"[\s\S]*?"RANKED \+ PRIVATE"[\s\S]*?"PRIVATE 1V1"/);
  assert.match(sync, /"Live 1v1 is unavailable in this build"/);
  assert.match(sync, /"Reach Silver Route Rank to unlock Scramble Arena"/);
  assert.match(sync, /"Private invites and public ranked matchmaking"/);
  assert.match(sync, /"Private invites \\u00b7 ranked unlocks after one scored solo win"/);
  assert.match(sync, /scrambleHomeStatus"[\s\S]*textContent = status/);
  assert.match(sync, /scrambleMenuStatus"[\s\S]*textContent = status/);
  assert.match(sync, /scrambleRuntime[?][.]setRankedUnlocked\(ranked\)/);

  const open = between(app, "async function openScramble", "function showSecondarySurfaceFailure");
  assert.match(open, /!scrambleArenaUnlocked\(\)[\s\S]*Scramble Arena unlocks at Silver Route Rank/);

  const unlock = between(app, "function scrambleRankedUnlocked()", "function applyServerPlayer");
  assert.match(unlock, /profile[.]wins > 0/);
  assert.match(unlock, /config[.]duels[?][.]publicMatchmakingEnabled !== false/);
});

test("the lobby keeps one shared Bronze/Silver/Gold Arena league beside separate mode ratings", () => {
  assert.match(arenaRanks, /minimumXp: 0/);
  assert.match(arenaRanks, /minimumXp: 500/);
  assert.match(arenaRanks, /minimumXp: 1_500/);
  assert.match(runtime, /id="scrambleArenaRank" data-arena-rank="bronze"/);
  assert.match(runtime, /scrambleArenaLeaguePresentation\(arena[.]progression\)/);
  assert.match(runtime, /id="scrambleArenaRankProgress">500 XP TO SILVER/);
  assert.match(runtime, /league[.]xpRemaining[\s\S]*league[.]next[.]name[.]toUpperCase\(\)[\s\S]*"TOP LEAGUE"/);
  assert.match(runtime, /options[.]onRatingChange[?][.]\(\{[\s\S]*progression: arena[.]progression[\s\S]*league/);
  assert.match(styles, /[.]scramble-arena-rank\[data-arena-rank="silver"\]/);
  assert.match(styles, /[.]scramble-arena-rank\[data-arena-rank="gold"\]/);
  assert.match(runtime, /refreshRating\(\{ allowDuringFinishedMatch: true \}\)/);
  const homeRankSync = between(app, "function syncScrambleArenaRank()", "function duelFeatureAvailable()");
  assert.match(homeRankSync, /scrambleHomeArenaRankMark/);
  assert.match(homeRankSync, /mark[.]textContent = rank[.]mark/);
});

test("new Arena entry stays Silver-gated while an existing match can always reconnect", () => {
  const boot = between(app, "async function boot()", "boot().catch");
  assert.doesNotMatch(boot, /\(scrambleInvite \|\| scrambleResume\)[^\{]*scrambleArenaUnlocked/);
  assert.match(boot, /if \(scrambleInvite\)[\s\S]*openScramble\([\s\S]*invite: scrambleInvite[\s\S]*else[\s\S]*runtime[.]resume\(\)/);
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
  assert.match(runtime, /actionId: actionId\("invite"\),[\s\S]*format,[\s\S]*frameSlug: localFrameSlug\(\)/);
  assert.match(runtime, /inviteCode: code,[\s\S]*actionId: actionId\("join"\),[\s\S]*frameSlug: localFrameSlug\(\)/);
  assert.match(app, /soloWins: \(\) => profile[.]wins/);
  assert.match(runtime, /actionId: actionId\("queue"\),[\s\S]*format,[\s\S]*frameSlug: localFrameSlug\(\),[\s\S]*soloWins: Math[.]max\(0, Math[.]min\(100_000, Math[.]floor\(Number\(options[.]soloWins[?][.]\(\)\) \|\| 0\)\)\)/);
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

test("Arena frames render intact on fixed-ratio Duel Cards instead of the live boards", async () => {
  const [cardRuntime, cardStyles] = await Promise.all([
    readFile(new URL("../public/arena-duel-card.mjs", import.meta.url), "utf8"),
    readFile(new URL("../public/arena-duel-card.css", import.meta.url), "utf8")
  ]);

  assert.match(runtime, /createArenaDuelCard/);
  assert.match(runtime, /id="scrambleLobbySelfCard"[\s\S]*id="scrambleLobbyRivalCard"/);
  assert.match(runtime, /id="scrambleCountdownSelfCard"[\s\S]*id="scrambleCountdownRivalCard"/);
  assert.match(runtime, /id="scrambleResultFeaturedCard"/);
  assert.match(runtime, /applyArenaFrameAccents/);
  assert.match(cardStyles, /[.]arena-duel-card__artboard\s*\{[^}]*aspect-ratio:\s*3\s*\/\s*4/);
  assert.match(cardStyles, /[.]arena-duel-card__art\s*\{[^}]*width:\s*100%[^}]*height:\s*auto/);
  assert.doesNotMatch(cardStyles, /object-fit:\s*fill|border-image|mask-image:\s*[^;]*url/);
  assert.match(cardRuntime, /ARENA_DUEL_CARD_ART_WIDTH = 1086/);
  assert.match(cardRuntime, /ARENA_DUEL_CARD_ART_HEIGHT = 1448/);
  assert.doesNotMatch(runtime, /profile-window-frame|data-profile-frame-overlay/);
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

test("compact Arena setup exposes a selected mode carousel and one contextual match type", () => {
  assert.match(runtime, /class="scramble-format-track"/);
  assert.match(runtime, /id="scrambleQueuePicker" role="tablist" aria-label="Choose match type"/);
  assert.match(runtime, /data-arena-queue="private"[\s\S]*data-arena-queue="ranked"/);
  assert.match(runtime, /data-arena-queue-panel="private"[\s\S]*data-arena-queue-panel="ranked"/);
  assert.match(runtime, /function syncLobbyQueuePresentation\(\)/);
  assert.match(runtime, /const hidden = compact && panel[.]dataset[.]arenaQueuePanel !== selectedQueue/);
  assert.match(runtime, /panel[.]inert = hidden/);
  assert.match(styles, /[.]scramble-queue-picker button\s*\{[^}]*min-height:\s*48px/s);
  assert.match(styles, /[.]scramble-format-picker > div\s*\{[^}]*display:\s*flex[^}]*scroll-snap-type:\s*x mandatory/s);
  assert.match(styles, /@media \(orientation: landscape\) and \(max-height: 520px\) and \(max-width: 900px\)/);
  assert.match(styles, /[.]scramble-dialog\[data-arena-phase="modes"\]\s*\{[^}]*grid-template-areas:[^}]*"formats queue"[^}]*"formats choices"/s);
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
