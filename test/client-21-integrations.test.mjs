import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
const releaseVersion = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;

function expectIds(...ids) {
  for (const id of ids) assert.ok(page.includes(`id="${id}"`), `missing #${id}`);
}

function sourceBetween(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing source marker: ${start}`);
  assert.ok(to > from, `missing source marker after ${start}: ${end}`);
  return app.slice(from, to);
}

function expectAll(source, markers) {
  for (const marker of markers) assert.ok(source.includes(marker), `missing integration marker: ${marker}`);
}

test("the client loads every release feature module through its versioned browser entrypoint", () => {
  const modules = {
    "signature-routes": ["createRouteSignature", "gradeSignatureRoute", "comparePersonalBest", "sanitizeRouteSignature"],
    "living-atlas": ["buildLivingAtlas"],
    "constellation-voyages": ["advanceVoyageProgress", "currentVoyageStage", "voyageProgress"],
    "recipe-insight": ["explainSuccessfulRecipe", "explainRecipeNearMiss"],
    "community-results": ["buildCommunityResults"],
    "cosmic-events": ["currentCosmicEvent", "cosmicEventCollectionProgress", "annotateCosmicEventResult"]
  };

  for (const [module, names] of Object.entries(modules)) {
    const line = app.split("\n").find((candidate) => candidate.includes(`from "./${module}.mjs?v=${releaseVersion}"`)) || "";
    assert.ok(line, `${module} must be loaded with the ${releaseVersion} cache key`);
    for (const name of names) assert.ok(line.includes(name), `${module} must import ${name}`);
  }
});

test("Signature Routes grade completed play, persist comparable bests, and adopt server truth", () => {
  expectIds(
    "signatureResultCard",
    "signatureResultGrade",
    "signatureResultTitle",
    "signatureResultScore",
    "signatureResultMetrics",
    "signaturePersonalBest"
  );

  const build = sourceBetween("function buildSignatureResult", "function renderSignatureResult");
  expectAll(build, [
    "gradeSignatureRoute(input)",
    "createRouteSignature(input)",
    "signature.scoreEligible && state.run?.ranked && !isStaticBeta",
    "comparePersonalBest(signature, previous)",
    'saveProfile({ fields: ["signatures"] })'
  ]);

  const verified = sourceBetween("function adoptVerifiedSignature", "function communityStat");
  expectAll(verified, [
    "sanitizeRouteSignature(raw)",
    "comparePersonalBest(signature, previous)",
    "awaitingVerification: false",
    'saveProfile({ fields: ["signatures"] })'
  ]);

  const adoption = app.indexOf("adoptVerifiedSignature(result.placement.entry.signature)");
  const community = app.indexOf("renderCommunityResult(result.placement.community || null)", adoption);
  assert.ok(adoption >= 0 && community > adoption, "verified Signature data must be adopted before community results render");
  assert.match(styles, /[.]signature-result-card\s*\{/);
});

test("the Living Atlas renders performed recipes without exposing locked answers", () => {
  expectIds(
    "atlasMap",
    "atlasGraph",
    "atlasGraphTitle",
    "atlasGraphDescription",
    "atlasGraphEdges",
    "atlasGraphNodes",
    "atlasGraphSummary",
    "atlasPath"
  );
  assert.match(page, /destination appears as a separate beacon until reached/i);

  const render = sourceBetween("function renderAtlas", "function openAtlas");
  expectAll(render, [
    "buildLivingAtlas({",
    "history: state.history",
    'target: state.game?.target || ""',
    "lockedCount:",
    "graph.edges.map",
    "graph.nodes.map",
    'label.textContent = node.locked ? ""',
    "step.insight",
    "the destination beacon reveals no hidden route"
  ]);
  assert.match(styles, /[.]atlas-node[.]target circle\s*\{/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?[.]atlas-node text\s*\{\s*font-size:\s*22px/);
});

test("Constellation Voyages launch ordered stages with mission context and durable progress", () => {
  expectIds(
    "voyageHubButton",
    "journeyDialog",
    "voyageJourneyTab",
    "voyageJourneyPanel",
    "voyageStageList",
    "startVoyageStage",
    "missionJourneyContext",
    "missionJourneyTitle",
    "journeyPill"
  );

  const hub = sourceBetween("function renderJourneyHub", "function openJourneyHub");
  expectAll(hub, [
    "voyage.chapters.map",
    'current ? escapeHtml(chapter.target) : "LOCKED"',
    "every recipe remains canonical",
    'selectJourneyTab(view)'
  ]);
  const start = sourceBetween("async function beginVoyageStage", "async function beginEventTarget");
  expectAll(start, [
    "currentVoyageStage(voyage.id, profile.voyageProgress)",
    'beginMode("reach"',
    "context: voyageContext(voyage, stage)"
  ]);

  const finish = sourceBetween("function finishGame", "async function submitRankedScore");
  expectAll(finish, [
    "advanceVoyageProgress(profile.voyageProgress",
    "profile.voyageProgress = advanced.progress",
    "reward.reward += VOYAGE_REWARD",
    'continueJourneyFromResult("voyage")',
    '["journeys"]'
  ]);
  const continuation = sourceBetween("function continueJourneyFromResult", "function finishGame");
  assert.ok(continuation.includes('recoveryDialog.addEventListener("close", () => openJourneyHub(view), { once: true })'), "the Voyage hub must wait for the one-time recovery dialog");
  assert.match(styles, /[.]journey-stage[.]current\s*\{/);
});

test("recipe insights explain successes while missing pairs receive spoiler-safe direction only", () => {
  const combine = sourceBetween("async function combineNodes", "function resetRecipeFeedback");
  expectAll(combine, [
    "explainSuccessfulRecipe({",
    "insight: insight?.text || \"\"",
    "explainRecipeNearMiss({",
    'error.code === "combination_missing"',
    "discovered: state.words",
    "recipes: authoredInsightCatalog()",
    "showAlchemy(nearMiss?.text || error.message, true)"
  ]);
  assert.ok(combine.indexOf('error.code === "combination_missing"') < combine.indexOf("explainRecipeNearMiss({"), "near-miss guidance must be limited to a known missing-recipe response");
  assert.doesNotMatch(combine, /nearMiss[?]?[.](?:answer|recipe|route|solution|word)/, "the client must display only the safe near-miss text");

  const atlas = sourceBetween("function renderAtlas", "function openAtlas");
  assert.ok(atlas.includes('step.insight ? `<small class="recipe-insight">'), "successful explanations must remain visible in Atlas history");
  assert.match(styles, /[.]atlas-path li > [.]recipe-insight\s*\{/);
});

test("Community results stay asynchronous, eligibility-gated, and driven by verified responses", () => {
  expectIds(
    "communityResultCard",
    "communityResultTitle",
    "communityResultStats",
    "communityResultNote",
    "raceCommunityGhost"
  );
  assert.match(page, /asynchronous routes, never live multiplayer/i);

  const render = sourceBetween("function renderCommunityResult", "function continueJourneyFromResult");
  expectAll(render, [
    "buildCommunityResults(community, { playerId: profile.playerId })",
    "state.finished && state.game",
    "isStaticBeta || state.run?.ranked",
    'isStaticBeta ? "LOCAL" : "1"',
    "community.completedRoutes",
    "community.signatureVarietyPercent",
    "race.hidden = !community.nearby"
  ]);
  assert.ok(app.includes("renderCommunityResult(result.placement.community || null)"), "ranked results must use the server-provided community aggregate");
  assert.ok(app.includes('track("community_viewed", { source: "community", action: "race" })'), "nearby-route racing must be measured as an explicit action");
  assert.match(styles, /[.]community-result-card\s*\{/);
});

test("Cosmic Events rotate collections, hide undiscovered words, and reward Pure discoveries once", () => {
  expectIds(
    "eventHubButton",
    "eventJourneyTab",
    "eventJourneyPanel",
    "eventModifierTitle",
    "eventCollectionProgress",
    "eventCollectionList",
    "startEventTarget"
  );

  const sanitize = sourceBetween("function sanitizeEventProgress", "function sanitizeSelectedVoyage");
  expectAll(sanitize, [
    "currentCosmicEvent(date)",
    "source.weekKey === event.weekKey && source.eventId === event.id",
    "cosmicEventCollectionProgress(event"
  ]);
  const hub = sourceBetween("function renderJourneyHub", "function openJourneyHub");
  expectAll(hub, [
    "event.collection.words.map",
    'collected ? escapeHtml(word) : "Unknown"',
    "Recipes, score rules, and ranked results remain unchanged",
    "eventTargetFor(event, collection)"
  ]);
  const discovery = sourceBetween("function recordEventDiscovery", "function refillDailySense");
  expectAll(discovery, [
    "annotateCosmicEventResult({ event, result })",
    'state.assist !== "none"',
    "!profile.eventProgress.rewarded",
    "profile.eventProgress.rewarded = true",
    "EVENT_COLLECTION_REWARD",
    'saveProfile({ fields: ["journeys"'
  ]);
  const start = sourceBetween("async function beginEventTarget", "function recordEventDiscovery");
  expectAll(start, ['beginMode("reach"', "context: eventContext(event, target)"]);
  assert.match(styles, /[.]event-collectible[.]collected\s*\{/);
});
