import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

function sourceBetween(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing source marker: ${start}`);
  assert.ok(to > from, `missing source marker after ${start}: ${end}`);
  return app.slice(from, to);
}

test("server-verified Signatures persist for foreground and recovered uploads without mutating another run", () => {
  const recovered = sourceBetween("async function flushPendingScoreUploads", "function retryPendingScoreUploads");
  assert.ok(recovered.includes("result.verifiedSignature || result.placement?.entry?.signature"));
  assert.ok(recovered.includes("runId: pending.runId"));
  assert.ok(recovered.includes("updateCurrent: false"));

  const submit = sourceBetween("async function submitRankedScore", "function updateWishButton");
  const adoption = submit.indexOf("adoptVerifiedSignature(result.verifiedSignature");
  const staleScreenGuard = submit.indexOf("if (state.run?.id !== submission.runId)");
  assert.ok(adoption >= 0 && adoption < staleScreenGuard, "server truth must persist before a late result leaves the current-screen path");
  assert.ok(submit.includes("runId: submission.runId"));
  assert.ok(submit.includes("updateCurrent: state.run?.id === submission.runId"));

  const verified = sourceBetween("function adoptVerifiedSignature", "function communityStat");
  assert.ok(verified.includes("if (!signature) return null"), "persistence must not require a mounted result card");
  assert.doesNotMatch(verified, /!signature\s*\|\|\s*!state[.]signature/);
  assert.ok(verified.indexOf('saveProfile({ fields: ["signatures"] })') < verified.indexOf("const currentRunMatches"));
  assert.ok(verified.includes("state.signature.runId === runId"));
});

test("cloud Signature reconciliation retains the strongest candidate in every scope", () => {
  const merge = sourceBetween("function mergeCloudProfile", "function setCloudStatus");
  assert.ok(merge.includes("comparePersonalBest(signature, previous).best"));
  assert.ok(merge.includes("profile.signatureBests = sanitizeSignatureBests([...byScope.values()])"));
  assert.ok(!merge.includes("...(preferLocalSignatures ? profile.signatureBests : [])"), "a lower pending local value must not be prepended after best-by-scope selection");
});

test("community UI separates uploading, locally pending, failed, and verified-empty states", () => {
  const render = sourceBetween("function renderCommunityResult", "function queueNearbyCommunityRace");
  for (const marker of [
    'phase === "uploading"',
    '["pending", "error"].includes(phase)',
    '"SAVED LOCALLY"',
    '"NOT VERIFIED"',
    '"VERIFIED EMPTY"',
    "No position is claimed until the saved route reaches the server"
  ]) assert.ok(render.includes(marker), `missing honest community state: ${marker}`);
  assert.ok(!render.includes("You are the first verified route in this comparison group"));

  const submit = sourceBetween("async function submitRankedScore", "function updateWishButton");
  assert.ok(submit.includes('renderCommunityResult(null, { status: state.scoreSubmission.pendingSaved ? "pending" : "error" })'));
});

test("result leaderboard actions never cross Practice or stale ranked divisions", () => {
  const finish = sourceBetween("function finishGame", "async function submitRankedScore");
  assert.ok(finish.includes('$("#resultLeaderboard").hidden = isStaticBeta || !won || assisted || !state.run?.ranked'));

  const submit = sourceBetween("async function submitRankedScore", "function updateWishButton");
  const declaredDivision = submit.indexOf('const division = state.assist === "none" ? "pure" : "open"');
  const applyDivision = submit.indexOf("state.leaderboardDivision = division");
  const applyScope = submit.indexOf('state.leaderboardScope = submission.mode === "daily" ? "daily" : submission.mode === "weekly" ? "weekly" : "sprint"');
  const verifyingLabel = submit.indexOf('$("#resultDivision").textContent = `${division.toUpperCase()} - SERVER VERIFIED`');
  assert.ok(declaredDivision >= 0 && applyDivision > declaredDivision && applyScope > applyDivision);
  assert.ok(verifyingLabel > applyScope, "the leaderboard action must target this run before verification UI becomes interactive");
});

test("Race nearby queues the exact returned pace once and scopes fallback lookups", () => {
  const queue = sourceBetween("function queueNearbyCommunityRace", "function continueJourneyFromResult");
  for (const marker of ["nearby.callsign", "nearby.moves", "nearby.seconds", "state.game.target", "ghostLeaderboardScope(state.mode)", "division"]) {
    assert.ok(queue.includes(marker), `nearby race is missing ${marker}`);
  }

  const ghost = sourceBetween("async function startRivalGhost", "function renderRivalGhost");
  assert.ok(ghost.includes("let rival = queuedCommunityRival()"));
  assert.ok(ghost.indexOf("queuedCommunityRival()") < ghost.indexOf("/api/leaderboard?"), "the selected nearby route must bypass the generic lookup");
  assert.ok(ghost.includes("scope=${encodeURIComponent(scope)}&division=${encodeURIComponent(division)}"));

  const actions = sourceBetween('$("#raceCommunityGhost").addEventListener', '$("#resultLeaderboard").addEventListener');
  assert.ok(actions.includes("queueNearbyCommunityRace()"));
  assert.ok(actions.includes("void retryGame()"));
});

test("completed Voyage replays only advertise continuation when progress advanced", () => {
  const finish = sourceBetween("function finishGame", "async function submitRankedScore");
  assert.ok(finish.includes("let voyageProgressAdvanced = false"));
  assert.ok(finish.includes("if (advanced.advanced)"));
  assert.ok(finish.includes("voyageProgressAdvanced = true"));
  assert.ok(finish.includes('state.journeyContext?.kind === "voyage" && voyageProgressAdvanced ? "Continue Voyage"'));
});
