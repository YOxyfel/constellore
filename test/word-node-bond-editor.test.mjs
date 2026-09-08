import test from "node:test";
import assert from "node:assert/strict";
import {
  BOND_FRACTURE_THRESHOLD,
  addEditableBond,
  adjustBondIntegrity,
  bondGraphEffects,
  bondStability,
  canonicalBreakGoals,
  connectedBondFragments,
  createEditableBondGraph,
  deriveWordFragments,
  evaluateBreakGoal,
  removeEditableBond,
  weakenEditableBond
} from "../public/word-node-bond-editor.mjs";
import { createWordChemistryGraph, lineageFromComponents } from "../public/word-node-chemistry.mjs";

function graph(edges) {
  return createEditableBondGraph({
    word: "Test",
    nodes: ["a", "b", "c"].map((id) => ({ id, word: id, label: id.toUpperCase() })),
    edges: edges.map(([from, to], index) => ({ from, to, order: index === 0 ? 2 : 1, kind: "reaction" }))
  });
}

test("editable bonds receive deterministic identity and readable stability", () => {
  const editable = graph([["a", "b"], ["b", "c"]]);
  assert.deepEqual(editable.edges.map((edge) => edge.id), ["bond-1", "bond-2"]);
  assert.equal(editable.bondCount, 2);
  assert.equal(bondStability(82).key, "stable");
  assert.equal(bondStability(55).key, "strained");
  assert.equal(bondStability(18).key, "unstable");
});

test("strengthening and weakening preserve the graph and clamp integrity", () => {
  const editable = graph([["a", "b"]]);
  const weakened = adjustBondIntegrity(editable, "bond-1", -200);
  assert.equal(weakened.changed, true);
  assert.equal(weakened.bond.integrity, 0);
  assert.equal(bondStability(weakened.bond.integrity).key, "unstable");
  assert.equal(adjustBondIntegrity(weakened.graph, "missing", 20).changed, false);
});

test("breaking distinguishes an opened ring from a true molecular split", () => {
  const ring = graph([["a", "b"], ["b", "c"], ["c", "a"]]);
  const opened = removeEditableBond(ring, "bond-1");
  assert.equal(opened.didSplit, false);
  assert.equal(opened.fragments.length, 1);

  const chain = graph([["a", "b"], ["b", "c"]]);
  const split = removeEditableBond(chain, "bond-2");
  assert.equal(split.didSplit, true);
  assert.deepEqual(split.fragments.map((fragment) => fragment.sort()), [["a", "b"], ["c"]]);
});

test("connecting atoms rejects invalid pairs and rejoins split fragments", () => {
  const chain = graph([["a", "b"]]);
  assert.equal(connectedBondFragments(chain).length, 2);
  assert.equal(addEditableBond(chain, "a", "a").changed, false);
  assert.equal(addEditableBond(chain, "a", "b").reason, "Those atoms are already bonded.");

  const connected = addEditableBond(chain, "b", "c");
  assert.equal(connected.changed, true);
  assert.equal(connected.bond.integrity, 48);
  assert.equal(bondStability(connected.bond.integrity).key, "strained");
  assert.equal(connectedBondFragments(connected.graph).length, 1);
});

test("edited topology produces gameplay-facing cohesion and reactivity", () => {
  const chain = graph([["a", "b"], ["b", "c"]]);
  const baseline = bondGraphEffects(chain);
  assert.equal(baseline.fragmentCount, 1);
  assert.equal(baseline.state.key, "strained");

  const unstable = adjustBondIntegrity(chain, "bond-1", -100).graph;
  const unstableEffects = bondGraphEffects(unstable);
  assert.equal(unstableEffects.state.key, "unstable");
  assert.ok(unstableEffects.cohesion < baseline.cohesion);
  assert.ok(unstableEffects.reactivity > baseline.reactivity);

  const split = removeEditableBond(chain, "bond-2").graph;
  const splitEffects = bondGraphEffects(split);
  assert.equal(splitEffects.fragmentCount, 2);
  assert.equal(splitEffects.state.key, "fragmented");
  assert.ok(splitEffects.reactivity > baseline.reactivity);
});

test("a critically weakened bond snaps instead of remaining a zero-strength line", () => {
  const editable = graph([["a", "b"], ["b", "c"]]);
  const firstWeaken = weakenEditableBond(editable, "bond-2", 20);
  assert.equal(firstWeaken.snapped, false);
  assert.ok(firstWeaken.bond.integrity > BOND_FRACTURE_THRESHOLD);

  const fracture = weakenEditableBond(firstWeaken.graph, "bond-2", 40);
  assert.equal(fracture.snapped, true);
  assert.equal(fracture.didSplit, true);
  assert.equal(fracture.graph.edges.some((edge) => edge.id === "bond-2"), false);
  assert.equal(fracture.fragments.length, 2);
});

test("broken recipe structures resolve into surviving words", () => {
  const mud = createEditableBondGraph(createWordChemistryGraph(lineageFromComponents({
    word: "Mud",
    components: ["Earth", "Water"]
  })));
  const splitMud = removeEditableBond(mud, mud.reactionRules[0].bondIds[0]).graph;
  assert.deepEqual(deriveWordFragments(splitMud).map(({ word }) => word).sort(), ["Earth", "Water"]);

  const life = createEditableBondGraph(createWordChemistryGraph(lineageFromComponents({
    word: "Life",
    components: ["Earth", "Water", "Air", "Fire"],
    intermediates: ["Mud", "Energy"]
  })));
  const rootRule = life.reactionRules.find((rule) => rule.output === "Life");
  const partiallySplitLife = removeEditableBond(life, rootRule.bondIds[0]).graph;
  assert.deepEqual(
    deriveWordFragments(partiallySplitLife).map(({ word }) => word).sort(),
    ["Energy", "Mud"]
  );
  const energyRule = life.reactionRules.find((rule) => rule.output === "Energy");
  const energySplitLife = removeEditableBond(life, energyRule.bondIds[0]).graph;
  assert.deepEqual(
    deriveWordFragments(energySplitLife).map(({ word }) => word).sort(),
    ["Air", "Fire", "Mud"]
  );
  const recipeBondIds = new Set(life.reactionRules.flatMap((rule) => rule.bondIds));
  const disintegratedLife = { ...life, edges: life.edges.filter((edge) => !recipeBondIds.has(edge.id)), bondCount: 1 };
  assert.deepEqual(
    deriveWordFragments(disintegratedLife).map(({ word }) => word).sort(),
    ["Air", "Earth", "Fire", "Water"]
  );
});

test("support bonds never change word identity and canonical goals are reproducible", () => {
  const life = createEditableBondGraph(createWordChemistryGraph(lineageFromComponents({
    word: "Life",
    components: ["Earth", "Water", "Air", "Fire"],
    intermediates: ["Mud", "Energy"]
  })));
  const support = life.edges.find((edge) => edge.bondType === "support");
  assert.ok(support, "complex molecules should expose a non-semantic support bond");
  const openedSupport = removeEditableBond(life, support.id).graph;
  assert.deepEqual(deriveWordFragments(openedSupport).map(({ word }) => word), ["Life"]);

  const goals = canonicalBreakGoals(life);
  const rootGoal = goals.find((goal) => goal.label === "Life → Mud + Energy");
  assert.ok(rootGoal);
  const rootRule = life.reactionRules.find((rule) => rule.output === "Life");
  const firstRun = removeEditableBond(life, rootRule.bondIds[0]).graph;
  const secondRun = removeEditableBond(life, rootRule.bondIds[0]).graph;
  assert.deepEqual(deriveWordFragments(firstRun), deriveWordFragments(secondRun));
  assert.equal(evaluateBreakGoal(firstRun, rootGoal).achieved, true);
  assert.equal(evaluateBreakGoal(openedSupport, rootGoal).achieved, false);
});

test("restoring a canonical recipe bond reforms its word", () => {
  const mud = createEditableBondGraph(createWordChemistryGraph(lineageFromComponents({
    word: "Mud",
    components: ["Earth", "Water"]
  })));
  const recipeBond = mud.edges.find((edge) => edge.bondType === "recipe");
  const broken = removeEditableBond(mud, recipeBond.id).graph;
  const restored = addEditableBond(broken, recipeBond.from, recipeBond.to);
  assert.equal(restored.changed, true);
  assert.equal(restored.bond.id, recipeBond.id);
  assert.equal(restored.bond.bondType, "recipe");
  assert.deepEqual(deriveWordFragments(restored.graph).map(({ word }) => word), ["Mud"]);
});
