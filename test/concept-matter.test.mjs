import assert from "node:assert/strict";
import test from "node:test";

import { createConceptReactionHistory } from "../public/concept-chemistry.mjs";
import {
  AUTHORED_FRACTURE_TWISTS,
  CONCEPT_MATTER_ACTIONS,
  CONCEPT_MATTER_HOLD_MS,
  CONCEPT_MATTER_REPRESENTATIONS,
  conceptMatterActionAllowed,
  conceptMatterCapabilities,
  conceptMatterContinuityInputIndex,
  createConceptMatterOperation,
  findConceptMatterReassembly,
  listConceptMatterCuts,
  normalizeConceptMatterRepresentation,
  planConceptMatterCut,
  projectConceptMatterCompound,
  sanitizeConceptMatterState,
  settleConceptMatterOperation
} from "../public/concept-matter.mjs";

const brickHistory = [
  {
    id: "mud-reaction",
    a: "Earth",
    b: "Water",
    word: "Mud",
    role: "backbone",
    continuityInputIndex: 0,
    outputInstanceId: "mud-instance"
  },
  {
    id: "brick-reaction",
    a: "Mud",
    b: "Fire",
    word: "Brick",
    role: "backbone",
    continuityInputIndex: 0,
    aInstanceId: "mud-instance",
    outputInstanceId: "brick-instance"
  }
];

const laboratory = conceptMatterCapabilities({
  mode: "explore",
  sandbox: true,
  scoreEligible: false,
  rewardEligible: false
});

test("capabilities expose one deny-by-default editing matrix for every board mode", () => {
  const solo = conceptMatterCapabilities({ mode: "ranked", ranked: false });
  const tutorial = conceptMatterCapabilities({ mode: "tutorial", tutorial: true });
  const scriptedTutorial = conceptMatterCapabilities({ mode: "tutorial", tutorial: true, scriptedTutorialEdit: true });
  const project = conceptMatterCapabilities({
    mode: "project",
    project: true,
    projectRules: { split: true, fracture: true, twist: false }
  });
  const daily = conceptMatterCapabilities({ mode: "daily", gameplayMode: "daily" });
  const arena = conceptMatterCapabilities({ mode: "scramble", multiplayer: true });
  const reveal = conceptMatterCapabilities({ mode: "reveal", reveal: true });

  assert.deepEqual(CONCEPT_MATTER_REPRESENTATIONS, ["compound", "compact"]);
  assert.deepEqual(CONCEPT_MATTER_ACTIONS, ["inspect", "peel", "split", "fracture", "twist"]);
  assert.equal(CONCEPT_MATTER_HOLD_MS, 480);
  assert.equal(normalizeConceptMatterRepresentation("compact"), "compact");
  assert.equal(normalizeConceptMatterRepresentation("compound"), "compound");
  assert.equal(normalizeConceptMatterRepresentation(undefined), "compact");
  assert.equal(normalizeConceptMatterRepresentation("unknown"), "compact");

  assert.deepEqual(
    [solo.profile, solo.inspect, solo.peel, solo.split, solo.fracture, solo.twist],
    ["solo", true, true, false, false, false]
  );
  assert.deepEqual(
    [laboratory.profile, laboratory.peel, laboratory.split, laboratory.fracture, laboratory.twist],
    ["laboratory", true, true, true, true]
  );
  assert.deepEqual(
    [tutorial.profile, tutorial.inspect, tutorial.peel, scriptedTutorial.peel],
    ["tutorial", true, false, true]
  );
  assert.deepEqual(
    [project.profile, project.peel, project.split, project.fracture, project.twist],
    ["authored-project", true, true, true, false]
  );
  assert.deepEqual([daily.profile, daily.inspect, daily.peel], ["competitive", true, false]);
  assert.deepEqual([arena.profile, arena.inspect, arena.merge], ["arena", false, true]);
  assert.deepEqual([reveal.inspect, reveal.merge, reveal.destructive], [false, false, false]);
  assert.equal(conceptMatterActionAllowed(project, "fracture"), true);
  assert.equal(conceptMatterActionAllowed(project, "twist"), false);
  assert.equal(conceptMatterActionAllowed(project, "invented"), false);
  assert.ok(Object.isFrozen(laboratory));
});

test("compound projection is bounded, instance-specific, accessible, and leaves reaction history immutable", () => {
  const original = structuredClone(brickHistory);
  const ledger = createConceptReactionHistory(brickHistory);
  const compound = projectConceptMatterCompound({
    history: ledger,
    concept: { word: "Brick", instanceId: "brick-instance" },
    maxVisibleGroups: 2
  });

  assert.equal(compound.word, "Brick");
  assert.equal(compound.instanceId, "brick-instance");
  assert.equal(compound.derived, true);
  assert.equal(compound.reactionId, "brick-reaction");
  assert.deepEqual(compound.immediateInputs.map(({ word, instanceId }) => [word, instanceId]), [
    ["Mud", "mud-instance"],
    ["Fire", "origin:fire"]
  ]);
  assert.equal(compound.ancestryCount, 2);
  assert.equal(compound.componentCount, 3);
  assert.equal(compound.hiddenGroupCount, 1);
  assert.match(compound.accessibleLabel, /Brick, compound made from Mud and Fire/);
  assert.ok(Object.isFrozen(compound));
  assert.ok(Object.isFrozen(compound.immediateInputs));
  assert.ok(Object.isFrozen(ledger));
  assert.ok(ledger.events.every(Object.isFrozen));
  assert.deepEqual(brickHistory, original, "projection must never rewrite performed reactions");
});

test("continuity drives distinct root peel and root split plans", () => {
  const ledger = createConceptReactionHistory(brickHistory);
  const brick = ledger.events.at(-1);
  assert.equal(conceptMatterContinuityInputIndex(brick, ledger), 0);

  const cuts = listConceptMatterCuts({
    history: ledger,
    concept: { word: "Brick", instanceId: "brick-instance" },
    capabilities: laboratory,
    twistRules: []
  });
  const split = cuts.find(({ id }) => id === "brick-reaction:input:0");
  const peel = cuts.find(({ id }) => id === "brick-reaction:input:1");

  assert.deepEqual([split.kind, split.enabled, split.input.word], ["split", true, "Mud"]);
  assert.deepEqual([peel.kind, peel.enabled, peel.input.word], ["peel", true, "Fire"]);

  const splitPlan = planConceptMatterCut({
    history: ledger,
    concept: { word: "Brick", instanceId: "brick-instance" },
    cutId: split.id,
    capabilities: laboratory,
    twistRules: []
  });
  const peelPlan = planConceptMatterCut({
    history: ledger,
    concept: { word: "Brick", instanceId: "brick-instance" },
    cutId: peel.id,
    capabilities: laboratory,
    twistRules: []
  });

  assert.equal(splitPlan.code, "split");
  assert.equal(peelPlan.code, "peel");
  assert.deepEqual(splitPlan.fragments.map(({ word }) => word), ["Mud", "Fire"]);
  assert.deepEqual(peelPlan.fragments.map(({ word }) => word), ["Mud", "Fire"]);
  assert.match(peelPlan.summary, /Brick peels into Mud \+ Fire/);
});

test("an internal cut fractures into the maximum stable boundary compounds", () => {
  const first = planConceptMatterCut({
    history: brickHistory,
    concept: { word: "Brick", instanceId: "brick-instance" },
    cutId: "mud-reaction:input:0",
    capabilities: laboratory,
    twistRules: []
  });
  const second = planConceptMatterCut({
    history: structuredClone(brickHistory),
    concept: { word: "Brick", instanceId: "brick-instance" },
    cutId: "mud-reaction:input:0",
    capabilities: laboratory,
    twistRules: []
  });

  assert.equal(first.allowed, true);
  assert.equal(first.kind, "fracture");
  assert.deepEqual(first.fragments.map(({ word }) => word), ["Earth", "Water", "Fire"]);
  assert.deepEqual(second, first, "the same structural cut must always produce the same fragments");
  assert.ok(Object.isFrozen(first));
});

test("authored twists override only their exact internal cut and remain deterministic", () => {
  assert.ok(Object.isFrozen(AUTHORED_FRACTURE_TWISTS));
  const earthCut = {
    history: brickHistory,
    concept: { word: "Brick", instanceId: "brick-instance" },
    cutId: "mud-reaction:input:0",
    capabilities: laboratory
  };
  const first = planConceptMatterCut(earthCut);
  const second = planConceptMatterCut(earthCut);
  const water = planConceptMatterCut({ ...earthCut, cutId: "mud-reaction:input:1" });

  assert.equal(first.kind, "twist");
  assert.equal(first.twist.authoredOutcomeId, "brick-mud-earth-to-steam");
  assert.deepEqual(first.fragments.map(({ word }) => word), ["Earth", "Steam"]);
  assert.deepEqual(first, second);
  assert.equal(water.twist.authoredOutcomeId, "brick-mud-water-to-lava");
  assert.deepEqual(water.fragments.map(({ word }) => word), ["Water", "Lava"]);

  const noRule = planConceptMatterCut({ ...earthCut, twistRules: [] });
  assert.equal(noRule.kind, "fracture");
  assert.deepEqual(noRule.fragments.map(({ word }) => word), ["Earth", "Water", "Fire"]);
});

test("an active strict route stabilizes the protected compound without consuming history", () => {
  const routeGuide = {
    strict: true,
    complete: false,
    activeWord: "Brick",
    backboneWord: "Brick",
    expectedProduct: "House"
  };
  const before = structuredClone(brickHistory);
  const cuts = listConceptMatterCuts({
    history: brickHistory,
    concept: { word: "Brick", instanceId: "brick-instance" },
    capabilities: laboratory,
    routeGuide
  });
  const plan = planConceptMatterCut({
    history: brickHistory,
    concept: { word: "Brick", instanceId: "brick-instance" },
    cutId: "brick-reaction:input:1",
    capabilities: laboratory,
    routeGuide
  });

  assert.ok(cuts.length > 0);
  assert.ok(cuts.every(({ enabled, reason }) => !enabled && /stabilized by the active Concept Bond/.test(reason)));
  assert.deepEqual({ allowed: plan.allowed, code: plan.code }, { allowed: false, code: "blocked" });
  assert.deepEqual(brickHistory, before);
});

test("fragment tokens permit only exact open-operation reassembly and settlement closes it", () => {
  const plan = planConceptMatterCut({
    history: brickHistory,
    concept: { word: "Brick", instanceId: "brick-instance" },
    cutId: "brick-reaction:input:1",
    capabilities: laboratory,
    twistRules: []
  });
  const operation = createConceptMatterOperation({
    plan,
    sourceNode: { id: 42 },
    operationId: "peel-brick-fire",
    now: 1_725_000_000_000
  });
  const [leftToken, rightToken] = operation.fragmentTokens;

  assert.equal(operation.type, "peel");
  assert.equal(operation.status, "open");
  assert.equal(operation.sourceNodeId, "42");
  assert.equal(new Set(operation.fragmentTokens).size, 2);
  assert.equal(findConceptMatterReassembly({
    operations: [operation],
    leftNode: { conceptMatterFragmentToken: rightToken },
    rightNode: { conceptMatterFragmentToken: leftToken }
  }), operation);
  assert.equal(findConceptMatterReassembly({
    operations: [operation],
    leftNode: { conceptMatterFragmentToken: leftToken },
    rightNode: { conceptMatterFragmentToken: "lookalike-word-without-the-exact-token" }
  }), null);

  const settled = settleConceptMatterOperation([operation], operation.id, "reassembled", 1_725_000_000_500);
  assert.equal(settled[0].status, "reassembled");
  assert.equal(settled[0].settledAt, 1_725_000_000_500);
  assert.equal(findConceptMatterReassembly({
    operations: settled,
    leftNode: { conceptMatterFragmentToken: leftToken },
    rightNode: { conceptMatterFragmentToken: rightToken }
  }), null);
  assert.equal(operation.status, "open", "settlement must not mutate the original operation");
});

test("saved matter state is bounded, sanitized, representation-safe, and deeply frozen", () => {
  const valid = Array.from({ length: 70 }, (_, index) => ({
    id: `operation-${index}`,
    type: index % 2 ? "peel" : "fracture",
    status: index % 3 ? "open" : "undone",
    sourceInstanceId: `instance-${index}`,
    sourceWord: `Word ${index}`,
    sourceNodeId: index,
    cutId: `reaction-${index}:input:0`,
    fragmentTokens: [`fragment-${index}-a`, `fragment-${index}-b`],
    fragments: [
      { word: "Earth", instanceId: "origin:earth", origin: "cut" },
      { word: "Water", instanceId: "origin:water", origin: "cut" }
    ],
    createdAt: index + 1
  }));
  const state = sanitizeConceptMatterState({
    representation: "not-a-real-view",
    operations: [{ id: "invalid", type: "delete-everything" }, ...valid]
  });

  assert.equal(state.representation, "compact");
  assert.equal(state.operations.length, 64);
  assert.equal(state.operations[0].id, "operation-6");
  assert.equal(state.operations.at(-1).id, "operation-69");
  assert.ok(state.operations.every(({ type }) => ["peel", "fracture"].includes(type)));
  assert.ok(Object.isFrozen(state));
  assert.ok(Object.isFrozen(state.operations));
  assert.ok(state.operations.every(Object.isFrozen));
});
