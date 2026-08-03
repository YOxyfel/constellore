import assert from "node:assert/strict";
import test from "node:test";
import {
  FUSION_RECIPES,
  WORD_CATALOG,
  addWord,
  connectNodes,
  createBloomSnapshot,
  createBloomState,
  declarePurposes,
  evaluateBloom,
  featureVector,
  fuseWords,
  inferPurposes,
  removeNode,
  rewireBond,
  runMoonStress
} from "../public/concept-bloom-domain.mjs";

function expectOk(result) {
  assert.equal(result.ok, true, result.message || result.code);
  return result.state;
}

function fuse(state, left, right) {
  return expectOk(fuseWords(state, { left, right }));
}

function plant(state, word) {
  return expectOk(addWord(state, { word }));
}

function node(state, word, occurrence = 0) {
  const matches = state.nodes.filter((item) => item.word === word);
  assert.ok(matches[occurrence], `${word} occurrence ${occurrence} must exist`);
  return matches[occurrence];
}

test("the lab starts clean, unlocked, in memory, and without progression dependencies", () => {
  const state = createBloomState();
  assert.deepEqual(state, {
    version: 1,
    scenarioId: "moon-shelter",
    coreNodeId: null,
    nodes: [],
    bonds: [],
    declaredPurposeIds: [],
    stressResults: [],
    nextNodeId: 1,
    nextBondId: 1
  });
  assert.equal(Object.isFrozen(state), true);
  for (const forbidden of ["rank", "gate", "profile", "player", "unlock", "storage"]) {
    assert.equal(forbidden in state, false);
  }
});

test("all three commutative House routes preserve the recipe as a distinct Aspect", () => {
  const expected = new Map([
    ["bastion-house", "Bastion"],
    ["hive-house", "Hive"],
    ["haven-house", "Haven"]
  ]);

  for (const recipe of FUSION_RECIPES) {
    for (const inputs of [recipe.inputs, [...recipe.inputs].reverse()]) {
      const result = fuseWords(createBloomState(), { left: inputs[0], right: inputs[1] });
      assert.equal(result.ok, true);
      assert.equal(result.state.nodes[0].word, "House");
      assert.equal(result.state.nodes[0].aspect, expected.get(recipe.id));
      assert.equal(result.state.nodes[0].routeId, recipe.id);
      assert.equal(result.state.nodes[0].kind, "core");
    }
  }
});

test("an unsupported fusion explains the failure without mutating the bloom", () => {
  const state = createBloomState();
  const result = fuseWords(state, { left: "Energy", right: "Life" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "no_stable_reaction");
  assert.equal(result.state, state);
  assert.deepEqual(state.nodes, []);
});

test("Flow and Shell direction changes semantic fit while weak claims remain playable", () => {
  let state = fuse(createBloomState(), "Wall", "Wall");
  state = plant(state, "Energy");
  state = plant(state, "Atmosphere");
  const house = node(state, "House");
  const energy = node(state, "Energy");
  const atmosphere = node(state, "Atmosphere");

  const supportedFlow = connectNodes(state, { from: energy.id, to: house.id, type: "flow" });
  assert.equal(supportedFlow.ok, true);
  assert.equal(supportedFlow.state.bonds[0].quality, "supported");

  const assertedFlow = connectNodes(state, { from: house.id, to: energy.id, type: "flow" });
  assert.equal(assertedFlow.ok, true);
  assert.equal(assertedFlow.state.bonds[0].quality, "asserted");

  const supportedShell = connectNodes(state, { from: house.id, to: atmosphere.id, type: "shell" });
  assert.equal(supportedShell.ok, true);
  assert.equal(supportedShell.state.bonds[0].quality, "supported");

  const assertedShell = connectNodes(state, { from: atmosphere.id, to: house.id, type: "shell" });
  assert.equal(assertedShell.ok, true);
  assert.equal(assertedShell.state.bonds[0].quality, "asserted");
});

test("Bridge endpoint order is canonical and duplicate reverse bridges are rejected", () => {
  let state = fuse(createBloomState(), "Room", "Room");
  state = plant(state, "Life");
  state = plant(state, "Community");
  const life = node(state, "Life");
  const community = node(state, "Community");
  state = expectOk(connectNodes(state, { from: community.id, to: life.id, type: "bridge" }));
  assert.ok(state.bonds[0].from.localeCompare(state.bonds[0].to) < 0);
  assert.equal(state.bonds[0].quality, "supported");

  const duplicate = connectNodes(state, { from: life.id, to: community.id, type: "bridge" });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, "duplicate_bond");
  assert.equal(duplicate.state, state);
});

test("rewiring atomically replaces a poor direction with a supported contribution", () => {
  let state = fuse(createBloomState(), "Wall", "Wall");
  state = plant(state, "Energy");
  const house = node(state, "House");
  const energy = node(state, "Energy");
  state = expectOk(connectNodes(state, { from: house.id, to: energy.id, type: "flow" }));
  const bondId = state.bonds[0].id;
  assert.equal(state.bonds[0].quality, "asserted");
  assert.equal(featureVector(state).energy, 0);

  state = expectOk(rewireBond(state, { bondId, from: energy.id, to: house.id, type: "flow" }));
  assert.equal(state.bonds.length, 1);
  assert.equal(state.bonds[0].id, bondId);
  assert.equal(state.bonds[0].quality, "supported");
  assert.equal(featureVector(state).energy, 2);
});

test("a distinct second House route becomes redundancy only when bridged to the core", () => {
  let state = fuse(createBloomState(), "Wall", "Wall");
  state = fuse(state, "Room", "Room");
  assert.equal(state.nodes[0].kind, "core");
  assert.equal(state.nodes[1].kind, "proof");
  assert.equal(featureVector(state).redundancy, 0);
  state = expectOk(connectNodes(state, {
    from: state.nodes[1].id,
    to: state.nodes[0].id,
    type: "bridge"
  }));
  assert.equal(state.bonds[0].quality, "supported");
  assert.equal(featureVector(state).redundancy, 2);
  assert.equal(featureVector(state).barrier, 4);

  let repeated = fuse(createBloomState(), "Wall", "Wall");
  repeated = fuse(repeated, "Wall", "Wall");
  repeated = expectOk(connectNodes(repeated, {
    from: repeated.nodes[1].id,
    to: repeated.nodes[0].id,
    type: "bridge"
  }));
  assert.equal(repeated.bonds[0].quality, "strained");
  assert.equal(featureVector(repeated).redundancy, 0);
});

test("typed bonds infer Habitat and player declaration can confirm several purposes", () => {
  let state = fuse(createBloomState(), "Adobe", "Construction");
  for (const word of ["Energy", "Life", "Atmosphere", "Community"]) state = plant(state, word);
  const house = node(state, "House");
  const energy = node(state, "Energy");
  const life = node(state, "Life");
  const atmosphere = node(state, "Atmosphere");
  const community = node(state, "Community");
  for (const bond of [
    { from: energy.id, to: house.id, type: "flow" },
    { from: energy.id, to: life.id, type: "flow" },
    { from: atmosphere.id, to: life.id, type: "flow" },
    { from: house.id, to: atmosphere.id, type: "shell" },
    { from: life.id, to: community.id, type: "bridge" }
  ]) state = expectOk(connectNodes(state, bond));

  assert.deepEqual(inferPurposes(state).map((purpose) => purpose.id), ["shelter", "habitat", "community"]);
  state = expectOk(declarePurposes(state, ["shelter", "habitat", "community"]));
  const evaluation = evaluateBloom(state);
  assert.equal(evaluation.coverage.habitat, 1);
  assert.equal(evaluation.coverage.community, 1);
  assert.ok(evaluation.coherence >= 80);
});

test("capacity overload never blocks construction and lowers evaluation", () => {
  let state = fuse(createBloomState(), "Wall", "Wall");
  for (const entry of WORD_CATALOG) state = plant(state, entry.word);
  state = expectOk(declarePurposes(state, ["shelter", "habitat", "community"]));
  const evaluation = evaluateBloom(state);
  assert.equal(evaluation.capacity.status, "overloaded");
  assert.ok(evaluation.capacity.used > evaluation.capacity.limit);
  assert.equal(state.nodes.length, WORD_CATALOG.length + 1);
  assert.ok(evaluation.issues.some((issue) => /overload/i.test(issue.text)));
});

test("Moon stress is deterministic and returns specific strengths and gaps", () => {
  let state = fuse(createBloomState(), "Wall", "Wall");
  state = plant(state, "Energy");
  state = plant(state, "Atmosphere");
  const house = node(state, "House");
  const energy = node(state, "Energy");
  const atmosphere = node(state, "Atmosphere");
  state = expectOk(connectNodes(state, { from: energy.id, to: house.id, type: "flow" }));
  state = expectOk(connectNodes(state, { from: house.id, to: atmosphere.id, type: "shell" }));

  const first = runMoonStress(state, "vacuum");
  const second = runMoonStress(state, "vacuum");
  assert.equal(first.ok, true);
  assert.deepEqual(first.event.result, second.event.result);
  assert.equal(first.state.stressResults.length, 1);
  assert.ok(first.event.result.strengths.length + first.event.result.gaps.length > 0);
});

test("node deletion removes incident bonds and promotes another House proof to core", () => {
  let state = fuse(createBloomState(), "Wall", "Wall");
  state = fuse(state, "Room", "Room");
  state = plant(state, "Energy");
  const oldCore = state.coreNodeId;
  state = expectOk(connectNodes(state, { from: node(state, "Energy").id, to: oldCore, type: "flow" }));
  state = expectOk(removeNode(state, oldCore));
  assert.notEqual(state.coreNodeId, oldCore);
  assert.equal(state.nodes.find((item) => item.id === state.coreNodeId).aspect, "Hive");
  assert.equal(state.nodes.find((item) => item.id === state.coreNodeId).kind, "core");
  assert.equal(state.bonds.length, 0);
});

test("self-bonds and unknown endpoints are rejected without mutation", () => {
  const state = fuse(createBloomState(), "Wall", "Wall");
  const coreId = state.coreNodeId;
  const self = connectNodes(state, { from: coreId, to: coreId, type: "bridge" });
  assert.equal(self.ok, false);
  assert.equal(self.code, "self_bond");
  assert.equal(self.state, state);

  const unknown = connectNodes(state, { from: coreId, to: "node-999", type: "flow" });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.code, "unknown_node");
  assert.equal(unknown.state, state);
});

test("snapshot communicates its local-only nature and permits fragile previews", () => {
  let state = fuse(createBloomState(), "Room", "Room");
  state = expectOk(declarePurposes(state, ["community"]));
  const snapshot = createBloomSnapshot(state);
  assert.equal(snapshot.ready, true);
  assert.equal(snapshot.aspect, "Hive");
  assert.match(snapshot.title, /Community Hive/);
  assert.match(snapshot.note, /not written/i);
  assert.equal(snapshot.state, "fragile");
});
