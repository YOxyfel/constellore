import assert from "node:assert/strict";
import test from "node:test";

import {
  CONCEPT_CHEMISTRY_PAIR_KINDS,
  CONCEPT_CHEMISTRY_VERSION,
  appendConceptReaction,
  conceptChemistryPairKey,
  createConceptChemistryGuide,
  createConceptReactionHistory,
  createMolecularMemory,
  evaluateConceptChemistryPair
} from "../public/concept-chemistry.mjs";

const route = [
  { a: "Earth", b: "Water", word: "Mud", emoji: "🟤", source: "world" },
  { a: "Fire", b: "Air", word: "Energy", emoji: "⚡", source: "world" },
  { a: "Mud", b: "Energy", word: "Life", emoji: "🌱", source: "world" },
  { a: "Water", b: "Air", word: "Rain", emoji: "🌧️", source: "world" }
];
const starters = ["Earth", "Water", "Fire", "Air"];

test("the guide starts one deterministic backbone and ignores unrelated route steps", () => {
  const guide = createConceptChemistryGuide({
    route,
    target: "Life",
    available: starters,
    strict: true
  });

  assert.equal(guide.version, CONCEPT_CHEMISTRY_VERSION);
  assert.equal(guide.valid, true);
  assert.equal(guide.complete, false);
  assert.equal(guide.reason, "backbone-ready");
  assert.equal(guide.activeWord, "Earth");
  assert.equal(guide.requiredPartner, "Water");
  assert.equal(guide.expectedProduct, "Mud");
  assert.equal(guide.backboneWord, "Earth");
  assert.equal(guide.detour.active, false);
  assert.equal(guide.allowedPair.classification, "backbone");
  assert.equal(guide.allowedPair.key, conceptChemistryPairKey("Water", "Earth"));
  assert.equal(guide.allowedPair.continuationWord, "Earth");
  assert.equal(guide.allowedPair.additionWord, "Water");
  assert.equal(guide.remainingReactions, 3, "Rain is outside the target dependency closure");
  assert.ok(Object.isFrozen(guide));
  assert.ok(Object.isFrozen(guide.allowedPair));
  assert.deepEqual(JSON.parse(JSON.stringify(guide)), structuredClone(guide));
});

test("the active backbone waits while one exact missing-reagent detour is authorized", () => {
  const history = [{
    a: "Water",
    b: "Earth",
    word: "Mud",
    role: "backbone",
    routeStepId: "opening-mud"
  }];
  const guide = createConceptChemistryGuide({
    route,
    history,
    target: "Life",
    available: starters,
    strict: true
  });

  assert.equal(guide.reason, "reagent-detour");
  assert.equal(guide.backboneWord, "Mud");
  assert.equal(guide.backboneRequiredPartner, "Energy");
  assert.equal(guide.backboneProduct, "Life");
  assert.deepEqual(
    {
      active: guide.detour.active,
      target: guide.detour.target,
      activeWord: guide.activeWord,
      requiredPartner: guide.requiredPartner,
      expectedProduct: guide.expectedProduct
    },
    {
      active: true,
      target: "Energy",
      activeWord: "Fire",
      requiredPartner: "Air",
      expectedProduct: "Energy"
    }
  );
  assert.equal(guide.allowedPair.classification, "reagent");
  assert.equal(guide.allowedPair.continuationWord, "Fire");
  assert.equal(guide.allowedPair.additionWord, "Air");

  const reagent = evaluateConceptChemistryPair(guide, { a: "Air", b: "Fire" });
  assert.deepEqual(
    { classification: reagent.classification, allowed: reagent.allowed, reason: reagent.reason },
    { classification: "reagent", allowed: true, reason: "authorized-reagent-detour" }
  );
  assert.equal(reagent.continuationWord, "Fire");
  assert.equal(reagent.additionWord, "Air");

  const prematureBackbone = evaluateConceptChemistryPair(guide, { a: "Mud", b: "Energy" });
  assert.equal(prematureBackbone.classification, "blocked");
  assert.equal(prematureBackbone.allowed, false);
  assert.equal(prematureBackbone.reason, "finish-reagent-detour");
  assert.match(prematureBackbone.message, /Energy/);
});

test("forming the reagent reconnects the same backbone before any other route can start", () => {
  const history = [
    { a: "Earth", b: "Water", word: "Mud", role: "backbone" },
    { a: "Fire", b: "Air", word: "Energy", role: "reagent" }
  ];
  const guide = createConceptChemistryGuide({ route, history, target: "Life", available: starters });

  assert.equal(guide.reason, "backbone-ready");
  assert.equal(guide.activeWord, "Mud");
  assert.equal(guide.requiredPartner, "Energy");
  assert.equal(guide.expectedProduct, "Life");
  assert.equal(guide.backboneWord, "Mud");
  assert.equal(guide.detour.active, false);
  assert.equal(guide.allowedPair.continuationWord, "Mud");
  assert.equal(guide.allowedPair.additionWord, "Energy");
  const backbone = evaluateConceptChemistryPair(guide, ["Energy", "Mud"]);
  assert.equal(backbone.classification, "backbone");
  assert.equal(backbone.continuationWord, "Mud");
  assert.equal(backbone.additionWord, "Energy");

  const restarted = evaluateConceptChemistryPair(guide, { a: "Earth", b: "Water" });
  assert.equal(restarted.classification, "blocked");
  assert.equal(restarted.reason, "finish-active-reaction");
});

test("nested reagent synthesis advances in authored order and only as required", () => {
  const nestedRoute = [
    { a: "Earth", b: "Water", word: "Anchor" },
    { a: "Spark", b: "Metal", word: "Charge" },
    { a: "Air", b: "Water", word: "Mist" },
    { a: "Charge", b: "Mist", word: "Catalyst" },
    { a: "Anchor", b: "Catalyst", word: "Goal" }
  ];
  const roots = ["Earth", "Water", "Spark", "Metal", "Air"];
  const expected = [
    { history: [{ a: "Earth", b: "Water", word: "Anchor" }], pair: ["Spark", "Metal"], product: "Charge" },
    {
      history: [
        { a: "Earth", b: "Water", word: "Anchor" },
        { a: "Spark", b: "Metal", word: "Charge" }
      ],
      pair: ["Air", "Water"],
      product: "Mist"
    },
    {
      history: [
        { a: "Earth", b: "Water", word: "Anchor" },
        { a: "Spark", b: "Metal", word: "Charge" },
        { a: "Air", b: "Water", word: "Mist" }
      ],
      pair: ["Charge", "Mist"],
      product: "Catalyst"
    }
  ];

  for (const scenario of expected) {
    const guide = createConceptChemistryGuide({
      route: nestedRoute,
      target: "Goal",
      available: roots,
      history: scenario.history
    });
    assert.equal(guide.backboneWord, "Anchor");
    assert.equal(guide.detour.active, true);
    assert.equal(guide.detour.target, "Catalyst");
    assert.equal(guide.expectedProduct, scenario.product);
    assert.equal(guide.allowedPair.key, conceptChemistryPairKey(...scenario.pair));
    assert.equal(evaluateConceptChemistryPair(guide, scenario.pair).classification, "reagent");
  }

  const finishedDetour = createConceptChemistryGuide({
    route: nestedRoute,
    target: "Goal",
    available: roots,
    history: [
      { a: "Earth", b: "Water", word: "Anchor" },
      { a: "Spark", b: "Metal", word: "Charge" },
      { a: "Air", b: "Water", word: "Mist" },
      { a: "Charge", b: "Mist", word: "Catalyst" }
    ]
  });
  assert.equal(finishedDetour.detour.active, false);
  assert.equal(finishedDetour.activeWord, "Anchor");
  assert.equal(finishedDetour.requiredPartner, "Catalyst");
  assert.equal(finishedDetour.expectedProduct, "Goal");
});

test("complete, non-strict, and invalid routes are free while strict active routes block", () => {
  const complete = createConceptChemistryGuide({
    route,
    target: "Life",
    available: [...starters, "Life"]
  });
  assert.equal(complete.complete, true);
  assert.equal(evaluateConceptChemistryPair(complete, { a: "Earth", b: "Fire" }).classification, "free");

  const explore = createConceptChemistryGuide({ route, target: "Life", available: starters, strict: false });
  assert.equal(explore.reason, "free-play");
  assert.equal(evaluateConceptChemistryPair(explore, { a: "Earth", b: "Fire" }).classification, "free");

  const invalid = createConceptChemistryGuide({
    route: [{ a: "Unknown", b: "Earth", word: "Life" }],
    target: "Life",
    available: starters
  });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.reason, "missing-route-origin");
  assert.equal(evaluateConceptChemistryPair(invalid, { a: "Earth", b: "Fire" }).classification, "free");

  const active = createConceptChemistryGuide({ route, target: "Life", available: starters });
  assert.equal(evaluateConceptChemistryPair(active, { a: "Earth", b: "Fire" }).classification, "blocked");
  assert.deepEqual(CONCEPT_CHEMISTRY_PAIR_KINDS, ["backbone", "reagent", "blocked", "free"]);
});

test("reaction history preserves duplicate events, exact input order, roles, and instance lineage", () => {
  let history = createConceptReactionHistory();
  history = appendConceptReaction(history, {
    id: "mud-event",
    a: "Water",
    b: "Earth",
    word: "Mud",
    role: "backbone",
    continuityInputIndex: 1,
    createdAt: "2026-08-07T12:00:00.000Z"
  });
  history = appendConceptReaction(history, {
    a: "Fire",
    b: "Air",
    word: "Energy",
    role: "reagent",
    continuationWord: "Air"
  });
  history = appendConceptReaction(history, {
    a: "Mud",
    b: "Energy",
    word: "Life",
    role: "backbone"
  });
  history = appendConceptReaction(history, {
    a: "Mud",
    b: "Energy",
    word: "Life",
    role: "free"
  });

  assert.equal(history.events.length, 4);
  assert.deepEqual(history.events.map((event) => event.sequence), [1, 2, 3, 4]);
  assert.deepEqual(history.events[0].inputs.map((input) => input.word), ["Water", "Earth"]);
  assert.equal(history.events[0].id, "mud-event");
  assert.equal(history.events[0].createdAt, "2026-08-07T12:00:00.000Z");
  assert.equal(history.events[0].continuityInputIndex, 1);
  assert.deepEqual(history.events[0].inputs.map((input) => input.bondRole), ["addition", "continuation"]);
  assert.equal(history.events[1].continuityInputIndex, 1, "continuationWord selects the matching performed input");
  assert.deepEqual(history.events[1].inputs.map((input) => input.bondRole), ["addition", "continuation"]);
  assert.equal(history.events[2].continuityInputIndex, 0, "legacy events retain a deterministic first-input continuity fallback");
  assert.deepEqual(history.events[2].inputs.map((input) => input.bondRole), ["continuation", "addition"]);
  assert.deepEqual(history.events.map((event) => event.role), ["backbone", "reagent", "backbone", "free"]);
  assert.notEqual(history.events[2].id, history.events[3].id);
  assert.notEqual(history.events[2].output.instanceId, history.events[3].output.instanceId);
  assert.equal(history.events[2].inputs[0].instanceId, history.events[0].output.instanceId);
  assert.equal(history.events[2].inputs[1].instanceId, history.events[1].output.instanceId);
  assert.ok(Object.isFrozen(history));
  assert.ok(history.events.every(Object.isFrozen));
});

test("alternate derivations become isomers while a selected recipe remains an exact provenance DAG", () => {
  let history = appendConceptReaction([], {
    a: "Earth", b: "Water", word: "Mud", role: "backbone"
  });
  history = appendConceptReaction(history, {
    a: "Fire", b: "Air", word: "Energy", role: "reagent"
  });
  history = appendConceptReaction(history, {
    a: "Mud", b: "Energy", word: "Life", role: "backbone"
  });
  const canonicalLife = history.events.at(-1);
  history = appendConceptReaction(history, {
    a: "Spark", b: "Seed", word: "Life", role: "free"
  });

  const latest = createMolecularMemory(history, "Life");
  assert.equal(latest.isomers.length, 2);
  assert.deepEqual(latest.isomers.map((isomer) => isomer.ingredients), [
    ["Mud", "Energy"],
    ["Spark", "Seed"]
  ]);
  assert.equal(latest.selectedIsomerId, history.events.at(-1).isomerId);

  const canonical = createMolecularMemory(history, {
    word: "Life",
    instanceId: canonicalLife.output.instanceId
  });
  assert.equal(canonical.selectedIsomerId, canonicalLife.isomerId);
  assert.deepEqual(canonical.structure.events.map((event) => event.word), ["Mud", "Energy", "Life"]);
  assert.equal(canonical.structure.nodes.filter((node) => node.type === "reaction").length, 3);
  assert.equal(canonical.structure.bonds.length, 9);
  assert.equal(new Set(canonical.structure.nodes.map((node) => node.id)).size, canonical.structure.nodes.length);
  assert.ok(Object.isFrozen(canonical));
  assert.ok(Object.isFrozen(canonical.structure));
  assert.doesNotThrow(() => JSON.stringify(canonical));
});

test("a starter concept has one origin node and no invented reaction or isomer", () => {
  const memory = createMolecularMemory([], "Water");
  assert.equal(memory.word, "Water");
  assert.equal(memory.selectedInstanceId, "origin:water");
  assert.deepEqual(memory.isomers, []);
  assert.deepEqual(memory.structure.nodes, [{
    id: "origin:water",
    type: "concept",
    word: "Water",
    origin: true,
    eventId: null
  }]);
  assert.deepEqual(memory.structure.bonds, []);
  assert.deepEqual(memory.structure.events, []);
});
