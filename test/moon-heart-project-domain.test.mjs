import assert from "node:assert/strict";
import test from "node:test";

import {
  MOON_HEART_REWARD,
  chooseMoonHeartSettlement,
  claimMoonHeartProjectReward,
  createMoonProjectsState,
  mergeMoonProjectsState,
  moonHeartProjectCatalog,
  moonHeartProjectContext,
  moonHeartProjectView,
  recordMoonHeartProjectRoute,
  sanitizeMoonProjectsState
} from "../public/moon-heart-project.mjs";
import { recipeKey } from "../public/recipe-mastery.mjs";

const AT = "2026-08-01T12:00:00.000Z";
const step = (a, b, word, extras = {}) => ({ a, b, word, source: "world", ...extras });

const ROUTES = {
  "living-spark": [step("Air", "Fire", "Energy"), step("Earth", "Energy", "Life")],
  "held-sky": [step("Earth", "Earth", "Land"), step("Air", "Land", "Sky"), step("Sky", "Sky", "Space"), step("Space", "Earth", "Planet"), step("Planet", "Air", "Atmosphere")],
  "first-meal": [step("Air", "Water", "Mist"), step("Earth", "Mist", "Plant"), step("Air", "Fire", "Energy"), step("Earth", "Energy", "Life"), step("Life", "Life", "Species"), step("Earth", "Species", "Animal"), step("Plant", "Animal", "Food")],
  "living-habitat": [step("Air", "Fire", "Energy"), step("Earth", "Energy", "Life"), step("Life", "Water", "Fish"), step("Fish", "Water", "Aquarium"), step("Aquarium", "Fish", "Habitat")]
};

function recordFinding(state, id, options = {}) {
  return recordMoonHeartProjectRoute(state, {
    context: moonHeartProjectContext(id),
    history: options.history || ROUTES[id],
    completedAt: AT,
    ...options
  });
}

function completeProjectState({ choiceId = "garden", reward = false } = {}) {
  const catalog = moonHeartProjectCatalog();
  const evidence = [...catalog.chapters.flatMap((chapter) => chapter.findings), catalog.finale]
    .map((finding, index) => ({
      milestoneId: `finding:${finding.id}`,
      recipeKey: recipeKey(`Project source ${index}`, `Project proof ${index}`, finding.target),
      routeKey: `route:${index.toString(36).padStart(7, "0")}`,
      completedAt: AT
    }));
  return sanitizeMoonProjectsState({
    version: 1,
    entries: [{
      id: "heart",
      contentVersion: 1,
      evidence,
      decisions: [{ decisionId: "settlement-character", choiceId, decidedAt: AT }],
      rewards: reward ? [{ rewardId: MOON_HEART_REWARD.id, claimedAt: AT }] : [],
      completedAt: AT
    }]
  });
}

test("Heart domain defines four sequential chapters, a decision gate, and sixteen reachable experiments", () => {
  const catalog = moonHeartProjectCatalog();
  assert.equal(catalog.chapters.length, 4);
  assert.equal(catalog.chapters.flatMap((chapter) => chapter.findings).length + 1, 16);
  assert.equal(catalog.finale.target, "Settlement");
  assert.deepEqual(catalog.decision.choices.map(({ id }) => id), ["garden", "workshop", "commons"]);
  const fresh = moonHeartProjectView(createMoonProjectsState({ shelterStage: 5 }), { shelterStage: 5 });
  assert.equal(fresh.findingProgress.current, 0, "legacy shelter stage never manufactures research evidence");
  assert.equal(fresh.projectedShelterStage, 5, "the old building is never visually downgraded");
});

test("Findings unlock sequentially and eligible routes create optional Connections", () => {
  let state = createMoonProjectsState();
  const locked = recordMoonHeartProjectRoute(state, {
    context: moonHeartProjectContext("first-brick"),
    history: [step("Earth", "Water", "Mud"), step("Mud", "Fire", "Brick")],
    completedAt: AT
  });
  assert.equal(locked.reason, "milestone_locked");

  for (const id of ["living-spark", "held-sky", "first-meal", "living-habitat"]) {
    const result = recordFinding(state, id);
    assert.equal(result.recorded, true);
    state = result.state;
    if (id === "first-meal") assert.equal(result.connections.includes("life-feeds-food"), true);
  }
  const view = moonHeartProjectView(state);
  assert.equal(view.chapters[0].complete, true);
  assert.equal(view.chapters[1].status, "current");
});

test("duplicates do not advance while alternate ancestry and final recipes remain useful", () => {
  let state = recordFinding(createMoonProjectsState(), "living-spark").state;
  assert.equal(recordFinding(state, "living-spark").reason, "duplicate_route");

  const perspective = recordFinding(state, "living-spark", {
    history: [step("Earth", "Water", "Mud"), ...ROUTES["living-spark"]]
  });
  assert.equal(perspective.perspective, true);
  assert.equal(perspective.advanced, false);
  state = perspective.state;

  const alternate = [
    step("Air", "Fire", "Energy"), step("Fire", "Water", "Steam"), step("Air", "Steam", "Cloud"),
    step("Cloud", "Cloud", "Storm"), step("Energy", "Storm", "Lightning"), step("Earth", "Water", "Mud"),
    step("Lightning", "Mud", "Life")
  ];
  const corroborated = recordFinding(state, "living-spark", { history: alternate });
  assert.equal(corroborated.corroborated, true);
  assert.equal(moonHeartProjectView(corroborated.state).chapters[0].findings[0].proofCount, 2);
});

test("Reveal, Study, disabled scoring, and unfinished routes cannot create evidence", () => {
  const state = createMoonProjectsState();
  for (const extra of [{ revealed: true }, { division: "study" }, { scoringDisabled: true }, { scoreEligible: false }]) {
    const result = recordFinding(state, "living-spark", extra);
    assert.equal(result.recorded, false);
    assert.equal(result.reason, "ineligible_run");
  }
  assert.equal(recordFinding(state, "living-spark", { history: [step("Air", "Fire", "Energy")] }).reason, "target_not_completed");
});

test("settlement decision is immutable and the deterministic reward is claimed exactly once", () => {
  const chapterThreeReady = completeProjectState();
  const existing = chooseMoonHeartSettlement(chapterThreeReady, { choiceId: "workshop", decidedAt: AT });
  assert.equal(existing.reason, "immutable_decision");

  const complete = completeProjectState();
  const first = claimMoonHeartProjectReward(complete, { claimedAt: AT });
  assert.equal(first.claimed, true);
  assert.deepEqual(first.grant, {
    stardust: 300,
    capability: { id: "moonhaven-stewardship", name: "Moonhaven Stewardship" }
  });
  const second = claimMoonHeartProjectReward(first.state, { claimedAt: "2026-08-02T00:00:00.000Z" });
  assert.equal(second.reason, "already_claimed");
  assert.equal(second.grant, null);
});

test("merge unions evidence but keeps winner-owned decisions and reward receipts", () => {
  const winner = completeProjectState({ choiceId: "garden", reward: true });
  const loser = completeProjectState({ choiceId: "workshop", reward: true });
  loser.entries[0].decisions[0].decidedAt = "2026-07-01T00:00:00.000Z";
  loser.entries[0].rewards[0].claimedAt = "2026-07-01T00:00:00.000Z";
  loser.entries[0].evidence.push({
    milestoneId: "finding:living-spark",
    recipeKey: recipeKey("Lightning", "Mud", "Life"),
    routeKey: "route:zzzzzzz",
    completedAt: "2026-07-01T00:00:00.000Z"
  });

  const merged = mergeMoonProjectsState(winner, loser, { includeRewards: false, preferLocal: true });
  const heart = merged.entries[0];
  assert.equal(heart.decisions[0].choiceId, "garden");
  assert.equal(heart.rewards[0].claimedAt, AT);
  assert.equal(heart.evidence.filter(({ milestoneId }) => milestoneId === "finding:living-spark").length, 2);

  const noWinnerDecision = structuredClone(winner);
  noWinnerDecision.entries[0].decisions = [];
  const filled = mergeMoonProjectsState(noWinnerDecision, loser, { includeRewards: false });
  assert.equal(filled.entries[0].decisions[0].choiceId, "workshop", "loser fills a missing winner decision");

  const noWinnerReward = structuredClone(winner);
  noWinnerReward.entries[0].rewards = [];
  assert.equal(mergeMoonProjectsState(noWinnerReward, loser, { includeRewards: false }).entries[0].rewards.length, 0);
  assert.equal(mergeMoonProjectsState(noWinnerReward, loser, { includeRewards: true }).entries[0].rewards.length, 1);
});
