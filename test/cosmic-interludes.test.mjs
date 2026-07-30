import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  COSMIC_INTERLUDES_VERSION,
  COSMIC_INTERLUDE_FIRST_OFFER,
  COSMIC_INTERLUDE_MAX_GAP,
  COSMIC_INTERLUDE_MEMORY_PREVIEW_MS,
  COSMIC_INTERLUDE_MIN_GAP,
  COSMIC_INTERLUDE_POLICY,
  COSMIC_INTERLUDE_TRAIL_MAX_STARS,
  COSMIC_INTERLUDE_TRAIL_MIN_STARS,
  COSMIC_INTERLUDE_TYPES,
  cosmicInterludeAction,
  cosmicInterludeOffer,
  cosmicInterludeTrailStarCount,
  cosmicInterludeView,
  cosmicSegmentsIntersect,
  createCosmicInterlude,
  sanitizeCosmicInterludeState
} from "../public/cosmic-interludes.mjs";

const source = await readFile(new URL("../public/cosmic-interludes.mjs", import.meta.url), "utf8");

function node(state, id) {
  return state.puzzle.nodes.find((candidate) => candidate.id === id);
}

function finishLinks(value) {
  let state = value;
  for (const pair of state.puzzle.pairs) {
    state = cosmicInterludeAction(state, { type: "activate-node", nodeId: pair.nodeIds[0] });
    state = cosmicInterludeAction(state, { type: "activate-node", nodeId: pair.nodeIds[1] });
  }
  return state;
}

function finishTrail(value) {
  let state = cosmicInterludeAction(value, { type: "begin-recall" });
  for (const nodeId of state.puzzle.sequence) {
    state = cosmicInterludeAction(state, { type: "activate-node", nodeId });
  }
  return state;
}

function assertUnrankedPolicy(value) {
  assert.deepEqual(value.policy, {
    ranked: false,
    scoreEligible: false,
    leaderboardEligible: false,
    rewardEligible: false,
    affectsRank: false,
    affectsDifficulty: false,
    canSkip: true
  });
}

test("the interlude contract exposes exactly two short, unranked activity types", () => {
  assert.equal(COSMIC_INTERLUDES_VERSION, 2);
  assert.equal(COSMIC_INTERLUDE_MEMORY_PREVIEW_MS, 5_000);
  assert.equal(COSMIC_INTERLUDE_TRAIL_MIN_STARS, 3);
  assert.equal(COSMIC_INTERLUDE_TRAIL_MAX_STARS, 5);
  assert.deepEqual(COSMIC_INTERLUDE_TYPES, ["constellation-links", "star-trail"]);
  assertUnrankedPolicy({ policy: COSMIC_INTERLUDE_POLICY });

  for (const type of COSMIC_INTERLUDE_TYPES) {
    const state = createCosmicInterlude({ seed: "contract", type });
    assert.equal(state.type, type);
    assert.equal(state.status, "playing");
    assert.equal(state.progress.completed, 0);
    assert.ok(state.progress.total >= 3 && state.progress.total <= 4);
    assertUnrankedPolicy(state);
    assert.equal(state.policy.affectsRank, false);
    assert.equal(state.policy.affectsDifficulty, false);
  }
});

test("seeded generation is reproducible while different seeds vary the boards", () => {
  for (const type of COSMIC_INTERLUDE_TYPES) {
    const first = createCosmicInterlude({ seed: "same seed", type });
    const repeated = createCosmicInterlude({ seed: "same seed", type });
    const different = createCosmicInterlude({ seed: "different seed", type });
    assert.deepEqual(first, repeated);
    assert.notDeepEqual(first.puzzle.nodes, different.puzzle.nodes);
    assert.equal(first.id, repeated.id);
    assert.notEqual(first.id, different.id);
  }

  const selected = createCosmicInterlude({ seed: "automatic-kind" });
  assert.ok(COSMIC_INTERLUDE_TYPES.includes(selected.type));
  assert.equal(createCosmicInterlude({ seed: "automatic-kind" }).type, selected.type);
});

test("link boards contain four accessible matching pairs and normalized, non-crossing solutions", () => {
  for (let seed = 0; seed < 100; seed += 1) {
    const state = createCosmicInterlude({ seed, type: "constellation-links" });
    assert.equal(state.puzzle.pairs.length, 4);
    assert.equal(state.puzzle.nodes.length, 8);
    assert.equal(new Set(state.puzzle.nodes.map((entry) => entry.id)).size, 8);

    for (const entry of state.puzzle.nodes) {
      assert.ok(entry.x >= 0 && entry.x <= 1);
      assert.ok(entry.y >= 0 && entry.y <= 1);
      assert.match(entry.color, /^#[0-9a-f]{6}$/i);
      assert.ok(entry.symbol);
      assert.ok(entry.label);
    }
    for (const pair of state.puzzle.pairs) {
      assert.equal(pair.nodeIds.length, 2);
      assert.equal(new Set(pair.nodeIds).size, 2);
      assert.ok(pair.nodeIds.every((id) => node(state, id)?.pairId === pair.id));
      assert.deepEqual(pair.route[0], {
        x: node(state, pair.nodeIds[0]).x,
        y: node(state, pair.nodeIds[0]).y
      });
      assert.deepEqual(pair.route.at(-1), {
        x: node(state, pair.nodeIds[1]).x,
        y: node(state, pair.nodeIds[1]).y
      });
    }

    const complete = finishLinks(state);
    assert.equal(complete.status, "complete");
    assert.deepEqual(complete.progress, { completed: 4, total: 4, percent: 100 });
  }
});

test("matching stars work by click or keyboard and wrong pairs never advance", () => {
  let state = createCosmicInterlude({ seed: "keyboard", type: "constellation-links" });
  const [firstPair, secondPair] = state.puzzle.pairs;

  state = cosmicInterludeAction(state, { type: "activate-node", nodeId: firstPair.nodeIds[0] });
  assert.equal(state.input.selectedNodeId, firstPair.nodeIds[0]);
  assert.equal(state.feedback, "choose-its-twin");

  state = cosmicInterludeAction(state, { type: "activate-node", nodeId: secondPair.nodeIds[0] });
  assert.equal(state.progress.completed, 0);
  assert.equal(state.feedback, "wrong-pair");
  assert.equal(state.input.selectedNodeId, secondPair.nodeIds[0]);

  state = cosmicInterludeAction(state, { type: "activate-node", nodeId: secondPair.nodeIds[1] });
  assert.equal(state.progress.completed, 1);
  assert.equal(state.feedback, "connected");

  const beforeFocus = state.input.focusIndex;
  state = cosmicInterludeAction(state, { type: "focus-next" });
  assert.notEqual(state.input.focusIndex, beforeFocus);
  state = cosmicInterludeAction(state, { type: "focus-previous" });
  assert.equal(state.input.focusIndex, beforeFocus);

  const focusedNode = state.puzzle.nodes[state.input.focusIndex];
  assert.equal(cosmicInterludeView(state).currentNodeId, focusedNode.id);
  state = cosmicInterludeAction(state, { type: "activate-focused" });
  assert.equal(state.input.selectedNodeId, focusedNode.id);
});

test("clicking a link pair in reverse also reverses its safe canonical route", () => {
  let state = createCosmicInterlude({ seed: "reverse-route", type: "constellation-links" });
  const pair = state.puzzle.pairs[2];
  state = cosmicInterludeAction(state, { type: "activate-node", nodeId: pair.nodeIds[1] });
  state = cosmicInterludeAction(state, { type: "activate-node", nodeId: pair.nodeIds[0] });
  const connection = state.connections[0];
  assert.deepEqual(connection.points, [...pair.route].reverse());
  assert.equal(connection.fromNodeId, pair.nodeIds[1]);
  assert.equal(connection.toNodeId, pair.nodeIds[0]);
});

test("pointer paths support normalized touch input, reject crossings, and remain bounded", () => {
  let state = createCosmicInterlude({ seed: "pointer-path", type: "constellation-links" });
  const [firstPair, secondPair, thirdPair] = state.puzzle.pairs;

  state = cosmicInterludeAction(state, { type: "pointer-start", nodeId: firstPair.nodeIds[0] });
  assert.equal(state.input.activePath.fromNodeId, firstPair.nodeIds[0]);
  state = cosmicInterludeAction(state, { type: "pointer-end", nodeId: firstPair.nodeIds[1] });
  assert.equal(state.progress.completed, 1);

  state = cosmicInterludeAction(state, { type: "pointer-start", nodeId: secondPair.nodeIds[0] });
  state = cosmicInterludeAction(state, { type: "pointer-end", nodeId: thirdPair.nodeIds[0] });
  assert.equal(state.progress.completed, 1);
  assert.equal(state.feedback, "wrong-pair");

  state = cosmicInterludeAction(state, { type: "pointer-start", nodeId: secondPair.nodeIds[0] });
  for (let index = 0; index < 200; index += 1) {
    state = cosmicInterludeAction(state, {
      type: "pointer-move",
      x: index % 2 ? -100 : 100,
      y: index / 199
    });
  }
  assert.ok(state.input.activePath.points.length <= 96);
  assert.ok(state.input.activePath.points.every((entry) => entry.x >= 0 && entry.x <= 1 && entry.y >= 0 && entry.y <= 1));
  state = cosmicInterludeAction(state, { type: "cancel-path" });
  assert.equal(state.input.activePath, null);

  const completedPath = state.connections[0].points;
  const midpoint = {
    x: (completedPath[0].x + completedPath.at(-1).x) / 2,
    y: (completedPath[0].y + completedPath.at(-1).y) / 2
  };
  state = cosmicInterludeAction(state, { type: "pointer-start", nodeId: secondPair.nodeIds[0] });
  state = cosmicInterludeAction(state, { type: "pointer-move", ...midpoint });
  state = cosmicInterludeAction(state, { type: "pointer-end", nodeId: secondPair.nodeIds[1] });
  assert.equal(state.progress.completed, 1);
  assert.equal(state.feedback, "crossed-path");
});

test("segment intersection catches crossings, contacts, and collinear overlap", () => {
  assert.equal(cosmicSegmentsIntersect(
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 1, y: 0 }
  ), true);
  assert.equal(cosmicSegmentsIntersect(
    { x: 0, y: 0 },
    { x: 0.5, y: 0 },
    { x: 0.5, y: 0 },
    { x: 1, y: 0 }
  ), true);
  assert.equal(cosmicSegmentsIntersect(
    { x: 0, y: 0 },
    { x: 0.75, y: 0 },
    { x: 0.25, y: 0 },
    { x: 1, y: 0 }
  ), true);
  assert.equal(cosmicSegmentsIntersect(
    { x: 0, y: 0 },
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.75 },
    { x: 1, y: 1 }
  ), false);
});

test("Star Trail locks the numbered preview, then tests memory without revealing the answer", () => {
  let state = createCosmicInterlude({ seed: "gentle-trail", type: "star-trail" });
  assert.equal(state.puzzle.sequence.length, 3);
  assert.equal(state.memory.phase, "preview");
  assert.equal(cosmicInterludeView(state).currentNodeId, null);
  assert.deepEqual(cosmicInterludeView(state).interactiveNodeIds, []);

  const wrongId = state.puzzle.sequence[1];
  const locked = cosmicInterludeAction(state, { type: "activate-node", nodeId: state.puzzle.sequence[0] });
  assert.deepEqual(locked, state, "pointer and keyboard actions cannot bypass the preview lock");

  state = cosmicInterludeAction(state, { type: "begin-recall" });
  assert.equal(state.memory.phase, "recall");
  assert.equal(state.feedback, "memory-ready");
  assert.equal(cosmicInterludeView(state).interactiveNodeIds.length, 3);
  assert.ok(cosmicInterludeView(state).currentNodeId);

  state = cosmicInterludeAction(state, { type: "activate-node", nodeId: wrongId });
  assert.equal(state.progress.completed, 0);
  assert.equal(state.status, "playing");
  assert.equal(state.feedback, "not-yet");

  state = cosmicInterludeAction(state, { type: "activate-node", nodeId: state.puzzle.sequence[0] });
  assert.equal(state.progress.completed, 1);
  assert.equal(state.feedback, "star-found");
  assert.equal(cosmicInterludeView(state).interactiveNodeIds.length, 2);

  state = finishTrail(state);
  assert.equal(state.status, "complete");
  assert.deepEqual(state.progress, { completed: 3, total: 3, percent: 100 });
  assert.equal(cosmicInterludeView(state).currentNodeId, null);
  assert.deepEqual(cosmicInterludeView(state).interactiveNodeIds, []);
});

test("early memory rounds deterministically scale from three to five stars", () => {
  assert.equal(cosmicInterludeTrailStarCount(1), 3);
  assert.equal(cosmicInterludeTrailStarCount(2), 4);
  assert.equal(cosmicInterludeTrailStarCount(3), 5);
  assert.equal(cosmicInterludeTrailStarCount(999), 5);
  assert.equal(cosmicInterludeTrailStarCount(Number.NaN), 3);

  for (const [completedStarTrails, expected] of [[0, 3], [1, 4], [2, 5], [99, 5]]) {
    const offer = cosmicInterludeOffer({
      seed: `memory-round-${completedStarTrails}`,
      completedChallenges: 3,
      lastType: "constellation-links",
      completedStarTrails
    });
    assert.equal(offer.type, "star-trail");
    assert.equal(offer.starTrailRound, completedStarTrails + 1);
    assert.equal(offer.starCount, expected);
    const state = createCosmicInterlude(offer);
    assert.equal(state.starCount, expected);
    assert.equal(state.puzzle.sequence.length, expected);
    assert.equal(state.memory.phase, "preview");
    assertUnrankedPolicy(state);
  }
});

test("both activities are always skippable and restart without hidden progression effects", () => {
  for (const type of COSMIC_INTERLUDE_TYPES) {
    const initial = createCosmicInterlude({ seed: `skip-${type}`, type });
    const skipped = cosmicInterludeAction(initial, { type: "skip" });
    assert.equal(skipped.status, "skipped");
    assert.equal(skipped.progress.completed, 0);
    assertUnrankedPolicy(skipped);

    const ignored = cosmicInterludeAction(skipped, {
      type: "activate-node",
      nodeId: skipped.puzzle.nodes[0].id
    });
    assert.equal(ignored.status, "skipped");
    assert.equal(ignored.progress.completed, 0);

    const restarted = cosmicInterludeAction(skipped, { type: "restart" });
    assert.deepEqual(restarted, initial);
  }

  const complete = finishTrail(createCosmicInterlude({ seed: "completed", type: "star-trail" }));
  assert.equal(cosmicInterludeAction(complete, { type: "skip" }).status, "complete");
});

test("Undo removes the newest link and can reopen a completed path puzzle", () => {
  const initial = createCosmicInterlude({ seed: "undo-links", type: "constellation-links" });
  const complete = finishLinks(initial);
  const newest = complete.connections.at(-1);
  const undone = cosmicInterludeAction(complete, { type: "undo" });

  assert.equal(undone.status, "playing");
  assert.equal(undone.feedback, "undone");
  assert.deepEqual(undone.progress, { completed: 3, total: 4, percent: 75 });
  assert.equal(undone.connections.length, 3);
  assert.ok(!undone.connections.some((connection) => connection.pairId === newest.pairId));
  assert.equal(undone.input.selectedNodeId, null);
  assert.equal(undone.input.activePath, null);
  assert.ok(cosmicInterludeView(undone).interactiveNodeIds.includes(newest.fromNodeId));
  assertUnrankedPolicy(undone);

  let reconnected = cosmicInterludeAction(undone, { type: "activate-node", nodeId: newest.fromNodeId });
  reconnected = cosmicInterludeAction(reconnected, { type: "activate-node", nodeId: newest.toNodeId });
  assert.equal(reconnected.status, "complete");
  assert.equal(reconnected.progress.completed, 4);
});

test("Undo removes the newest trail star without creating failures or negative progress", () => {
  const initial = createCosmicInterlude({ seed: "undo-trail", type: "star-trail", starCount: 5 });
  const complete = finishTrail(initial);
  const removedId = complete.trail.at(-1);
  const undone = cosmicInterludeAction(complete, { type: "undo" });

  assert.equal(undone.status, "playing");
  assert.equal(undone.feedback, "undone");
  assert.deepEqual(undone.progress, { completed: 4, total: 5, percent: 80 });
  assert.equal(undone.trail.length, 4);
  assert.equal(cosmicInterludeView(undone).currentNodeId, removedId);
  assertUnrankedPolicy(undone);

  const empty = createCosmicInterlude({ seed: "undo-empty", type: "star-trail" });
  assert.deepEqual(cosmicInterludeAction(empty, { type: "undo" }), empty);
});

test("the scheduler offers the first breather at three wins, then spaces them four to six wins apart", () => {
  assert.equal(COSMIC_INTERLUDE_FIRST_OFFER, 3);
  assert.equal(COSMIC_INTERLUDE_MIN_GAP, 4);
  assert.equal(COSMIC_INTERLUDE_MAX_GAP, 6);
  assert.equal(cosmicInterludeOffer({ seed: "cadence", completedChallenges: 0 }), null);
  assert.equal(cosmicInterludeOffer({ seed: "cadence", completedChallenges: 2 }), null);

  const first = cosmicInterludeOffer({ seed: "cadence", completedChallenges: 3 });
  assert.equal(first.dueChallenge, 3);
  assert.equal(first.gap, 3);
  assertUnrankedPolicy(first);
  assert.deepEqual(first, cosmicInterludeOffer({ seed: "cadence", completedChallenges: 3 }));

  const lastSettledChallenge = 3;
  let next = null;
  for (let completedChallenges = 3; completedChallenges <= 9; completedChallenges += 1) {
    const offer = cosmicInterludeOffer({ seed: "cadence", completedChallenges, lastSettledChallenge });
    if (!next && offer) next = offer;
  }
  assert.ok(next);
  assert.ok(next.gap >= 4 && next.gap <= 6);
  assert.equal(next.dueChallenge, lastSettledChallenge + next.gap);
  assert.equal(cosmicInterludeOffer({
    seed: "cadence",
    completedChallenges: next.atChallenge,
    lastSettledChallenge: next.atChallenge
  }), null, "recording completion or skip advances the cadence immediately");
});

test("the scheduler can alternate activities and sanitizes hostile counters and seeds", () => {
  const first = cosmicInterludeOffer({
    seed: "alternate",
    completedChallenges: 3,
    lastType: "constellation-links"
  });
  assert.equal(first.type, "star-trail");

  const second = cosmicInterludeOffer({
    seed: "alternate",
    completedChallenges: 9,
    lastSettledChallenge: 3,
    lastType: "star-trail"
  });
  assert.equal(second.type, "constellation-links");
  assert.ok(second.seed.length <= 96);

  assert.equal(cosmicInterludeOffer({
    seed: { toString() { throw new Error("no"); } },
    completedChallenges: -Infinity,
    lastSettledChallenge: 99
  }), null);
});

test("state restoration drops forged completion and clamps all retained local input", () => {
  const original = createCosmicInterlude({ seed: "safe\u0000seed", type: "constellation-links" });
  const pair = original.puzzle.pairs[0];
  const activePair = original.puzzle.pairs[1];
  const hostile = {
    ...original,
    seed: `${"x".repeat(500)}\u0000`,
    status: "complete",
    policy: {
      ranked: true,
      scoreEligible: true,
      rewardEligible: true,
      affectsRank: true,
      affectsDifficulty: true
    },
    connections: [
      { pairId: "not-real", points: Array.from({ length: 1_000 }, () => ({ x: Infinity, y: -Infinity })) },
      {
        pairId: pair.id,
        fromNodeId: pair.nodeIds[0],
        toNodeId: pair.nodeIds[1],
        points: pair.route
      }
    ],
    input: {
      focusIndex: 999_999,
      selectedNodeId: "<script>",
      activePath: {
        fromNodeId: activePair.nodeIds[0],
        points: Array.from({ length: 1_000 }, (_, index) => ({
          x: index % 2 ? -100 : 100,
          y: index / 999
        }))
      }
    },
    feedback: "<img onerror=alert(1)>"
  };
  const restored = sanitizeCosmicInterludeState(hostile);
  assert.ok(restored.seed.length <= 96);
  assert.equal(restored.status, "playing");
  assert.ok(restored.connections.length <= 1);
  assert.equal(restored.progress.completed, restored.connections.length);
  assert.ok(restored.progress.completed < restored.progress.total, "forged complete status is always discarded");
  assert.equal(restored.input.focusIndex, restored.puzzle.nodes.length - 1);
  assert.ok(restored.input.activePath.points.length <= 96);
  assert.ok(restored.input.activePath.points.every((entry) => entry.x >= 0 && entry.x <= 1 && entry.y >= 0 && entry.y <= 1));
  assert.equal(restored.feedback, "");
  assertUnrankedPolicy(restored);

  const serialized = JSON.stringify(restored);
  assert.ok(serialized.length < 40_000);
  assert.doesNotThrow(() => sanitizeCosmicInterludeState(JSON.parse(serialized)));
});

test("trail restoration accepts only a canonical prefix and reducers ignore malformed actions", () => {
  const original = createCosmicInterlude({ seed: "restore-trail", type: "star-trail" });
  const [first, second, third] = original.puzzle.sequence;
  const restored = sanitizeCosmicInterludeState({
    ...original,
    trail: [first, third, second, "<script>"],
    status: "complete"
  });
  assert.deepEqual(restored.trail, [first]);
  assert.equal(restored.status, "playing");
  assert.equal(restored.progress.completed, 1);
  assert.equal(restored.memory.phase, "recall", "saved progress resumes recall without replaying the answer");

  const clamped = sanitizeCosmicInterludeState({
    seed: "hostile-trail",
    type: "star-trail",
    starCount: 999,
    memory: { phase: "<script>" }
  });
  assert.equal(clamped.starCount, 5);
  assert.equal(clamped.puzzle.sequence.length, 5);
  assert.equal(clamped.memory.phase, "preview");

  assert.deepEqual(cosmicInterludeAction(restored, null), restored);
  assert.deepEqual(cosmicInterludeAction(restored, { type: "<script>", nodeId: third }), restored);
  assert.deepEqual(cosmicInterludeAction(restored, { type: "activate-node", nodeId: "__proto__" }), {
    ...restored,
    feedback: "not-yet"
  });
});

test("the engine is platform-neutral and has no DOM, storage, network, score, or rank side effects", () => {
  assert.doesNotMatch(source, /\b(?:document|window|localStorage|sessionStorage|fetch|XMLHttpRequest)\b/);
  assert.doesNotMatch(source, /\b(?:award|upload|leaderboardScore|rankPoints|difficultyDelta)\b/);

  for (const type of COSMIC_INTERLUDE_TYPES) {
    const initial = createCosmicInterlude({ seed: `json-${type}`, type });
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(initial)));
    assertUnrankedPolicy(cosmicInterludeView(initial));
  }
});
