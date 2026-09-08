import assert from "node:assert/strict";
import test from "node:test";

import {
  SOLAR_PLANET_ORDER,
  VOYAGE_DURATION_SECONDS,
  VOYAGE_FINAL_TEXT,
  VOYAGE_NARRATION,
  VOYAGE_REDUCED_MOTION_NARRATION,
  VOYAGE_REPLAY_MILESTONES,
  VOYAGE_VARIANTS,
  VOYAGE_WORLD_ORDER,
  createVoyageTimeline,
  createVoyageWorldPresentation,
  narrationAtTime,
  reducedMotionNarrationAtTime,
  nextVoyageWorld,
  normalizeVoyageVariant,
  normalizeVoyageWorld,
  resolveVoyageReplayMilestone,
  resolveVoyageSkipOutcome,
  selectVoyageQuality,
  shotAtTime
} from "../public/voyage-projection-domain.mjs";

test("solar order is authoritative and the scene inserts Earth's Moon without calling it a planet", () => {
  assert.deepEqual(SOLAR_PLANET_ORDER, [
    "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"
  ]);
  assert.deepEqual(VOYAGE_WORLD_ORDER, [
    "mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn", "uranus", "neptune"
  ]);
  assert.equal(nextVoyageWorld("earth"), "moon");
  assert.equal(nextVoyageWorld("moon"), "mars");
  assert.equal(nextVoyageWorld("neptune"), null);
  assert.equal(normalizeVoyageWorld(" MOON "), "moon");
  assert.equal(normalizeVoyageWorld("unknown"), "earth");
});

test("all variants use the approved deterministic 57-second shot boundaries", () => {
  const expectedBoundaries = [
    ["earth", 0, 7],
    ["solar", 7, 20],
    ["heliopause", 20, 27],
    ["warp", 27, 38],
    ["black-hole", 38, 48],
    ["singularity", 48, 53]
  ];
  assert.equal(VOYAGE_DURATION_SECONDS, 57);
  assert.deepEqual(VOYAGE_VARIANTS, ["promise", "progress", "completion"]);
  for (const variant of VOYAGE_VARIANTS) {
    const timeline = createVoyageTimeline(variant);
    assert.ok(Object.isFrozen(timeline));
    assert.ok(timeline.every(Object.isFrozen));
    assert.deepEqual(
      timeline.slice(0, 6).map(({ id, startSeconds, endSeconds }) => [id, startSeconds, endSeconds]),
      expectedBoundaries
    );
    assert.equal(timeline.at(-1).startSeconds, 53);
    assert.equal(timeline.at(-1).endSeconds, 57);
  }
  assert.equal(createVoyageTimeline("promise").at(-1).id, "return");
  assert.equal(createVoyageTimeline("progress").at(-1).id, "return");
  assert.equal(createVoyageTimeline("completion").at(-1).id, "beyond");
  assert.equal(createVoyageTimeline("promise")[5].outcome, "unresolved");
  assert.equal(createVoyageTimeline("completion")[5].outcome, "crossed");
  assert.equal(normalizeVoyageVariant("COMPLETION"), "completion");
  assert.equal(normalizeVoyageVariant("bad"), "promise");
});

test("shotAtTime resolves exact boundaries and safely clamps out-of-range clocks", () => {
  assert.equal(shotAtTime(-20).id, "earth");
  assert.equal(shotAtTime(6.999).id, "earth");
  assert.equal(shotAtTime(7).id, "solar");
  assert.equal(shotAtTime(20).id, "heliopause");
  assert.equal(shotAtTime(27).id, "warp");
  assert.equal(shotAtTime(38).id, "black-hole");
  assert.equal(shotAtTime(48).id, "singularity");
  assert.equal(shotAtTime(53).id, "return");
  assert.equal(shotAtTime(53, { variant: "completion" }).id, "beyond");
  const ended = shotAtTime(99);
  assert.equal(ended.timelineTimeSeconds, 57);
  assert.equal(ended.progress, 1);
  assert.equal(ended.ended, true);
  assert.ok(Object.isFrozen(ended));
});

test("approved narration cues are timed, immutable, and the promise-only closing line stays contextual", () => {
  assert.equal(VOYAGE_NARRATION.length, 4);
  assert.deepEqual(VOYAGE_NARRATION.map(({ text }) => text), [
    "Every world we understand becomes somewhere we can reach.",
    "Every discovery gives the voyage another coordinate.",
    "Beyond the last light, the map has no word for what comes next.",
    "So we will make one."
  ]);
  assert.equal(narrationAtTime(1.5).id, "understanding-makes-reachable");
  assert.equal(narrationAtTime(9).id, "discovery-makes-coordinate");
  assert.equal(narrationAtTime(42).id, "map-has-no-word");
  assert.equal(narrationAtTime(55).id, "make-one");
  assert.equal(narrationAtTime(55, { variant: "completion" }), null);
  assert.equal(narrationAtTime(30), null);
  assert.ok(Object.isFrozen(VOYAGE_NARRATION));
  assert.ok(Object.isFrozen(VOYAGE_NARRATION[0].variants));
});

test("reduced-motion narration uses authored non-overlapping playback windows", () => {
  assert.equal(VOYAGE_REDUCED_MOTION_NARRATION.length, 4);
  for (const [index, cue] of VOYAGE_REDUCED_MOTION_NARRATION.entries()) {
    if (index) assert.ok(cue.startSeconds >= VOYAGE_REDUCED_MOTION_NARRATION[index - 1].endSeconds);
    const wordCount = cue.text.trim().split(/\s+/).length;
    const minimumSecondsAt105Wpm = (wordCount / 105) * 60;
    assert.ok(cue.endSeconds - cue.startSeconds >= minimumSecondsAt105Wpm);
  }
  assert.equal(reducedMotionNarrationAtTime(0.5).id, "understanding-makes-reachable");
  assert.equal(reducedMotionNarrationAtTime(6.5).id, "discovery-makes-coordinate");
  assert.equal(reducedMotionNarrationAtTime(14).id, "map-has-no-word");
  assert.equal(reducedMotionNarrationAtTime(22).id, "make-one");
  assert.equal(reducedMotionNarrationAtTime(22, { variant: "completion" }), null);
});

test("Earth facts materialize Earth and make the available Moon the sole launch destination", () => {
  const result = createVoyageWorldPresentation({
    activeWorldId: "earth",
    completedWorldIds: [],
    availableWorldIds: ["earth", "moon", "mars"]
  });
  const byId = Object.fromEntries(result.worlds.map((world) => [world.worldId, world]));
  assert.equal(result.currentWorldId, "earth");
  assert.equal(result.nextWorldId, "moon");
  assert.deepEqual(result.actionableWorldIds, ["earth", "moon"]);
  assert.equal(byId.earth.presentation, "materialized");
  assert.equal(byId.earth.action, "continue");
  assert.equal(byId.moon.presentation, "distant");
  assert.equal(byId.moon.action, "launch");
  assert.equal(byId.moon.locked, false);
  assert.equal(byId.mars.actionable, false, "a later available world cannot leapfrog the next world");
  assert.equal(byId.mars.locked, true);
  assert.equal(byId.moon.kind, "satellite");
  assert.ok(byId.moon.solarIndex < 0, "the Moon is not assigned a planetary orbit index");
});

test("Moon facts keep completed Earth and current Moon materialized while unavailable Mars remains locked", () => {
  const result = createVoyageWorldPresentation({
    currentWorldId: "MOON",
    completedWorldIds: new Set(["earth"]),
    actionableWorldIds: ["earth", "moon"]
  });
  const byId = Object.fromEntries(result.worlds.map((world) => [world.worldId, world]));
  assert.equal(result.currentWorldId, "moon");
  assert.equal(result.nextWorldId, "mars");
  assert.deepEqual(result.completedWorldIds, ["earth"]);
  assert.deepEqual(result.actionableWorldIds, ["moon"]);
  assert.equal(byId.earth.status, "completed");
  assert.equal(byId.earth.materialized, true);
  assert.equal(byId.earth.actionable, false);
  assert.equal(byId.moon.status, "current");
  assert.equal(byId.moon.materialized, true);
  assert.equal(byId.mars.status, "locked");
  assert.equal(byId.mars.distant, true);
  assert.equal(byId.mars.action, null);
});

test("world presentation is deeply immutable and never changes authoritative input facts", () => {
  const facts = {
    activeWorldId: "earth",
    completedWorldIds: ["earth"],
    availableWorldIds: ["earth", "moon"]
  };
  const before = structuredClone(facts);
  const result = createVoyageWorldPresentation(facts);
  assert.deepEqual(facts, before);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.worlds));
  assert.ok(Object.isFrozen(result.worlds[0]));
  assert.throws(() => result.worlds.push({}), TypeError);
  assert.deepEqual(facts, before);
});

test("quality selection honors data, motion, video, WebGL, viewport, and hardware capabilities", () => {
  assert.equal(selectVoyageQuality({ saveData: true }), "fallback");
  assert.equal(selectVoyageQuality({ reducedMotion: true }), "fallback");
  assert.equal(selectVoyageQuality({ forceFallback: true }), "fallback");
  assert.equal(selectVoyageQuality({ webgl2: false }), "fallback");
  assert.equal(selectVoyageQuality({
    variant: "promise",
    webgl2: false,
    masterVideoAvailable: true,
    videoSupported: true
  }), "master-video", "a master does not require WebGL");
  assert.equal(selectVoyageQuality({
    variant: "completion",
    masterVideoAvailable: true,
    videoSupported: true
  }), "master-video");
  assert.equal(selectVoyageQuality({
    variant: "progress",
    masterVideoAvailable: true,
    videoSupported: true,
    width: 1440,
    height: 900,
    deviceMemory: 8,
    hardwareConcurrency: 8
  }), "standard", "progress projections stay state-aware and real-time");
  assert.equal(selectVoyageQuality({
    width: 390,
    height: 844,
    coarsePointer: true,
    deviceMemory: 8,
    hardwareConcurrency: 8
  }), "low");
  assert.equal(selectVoyageQuality({
    width: 1440,
    height: 900,
    deviceMemory: 8,
    hardwareConcurrency: 8
  }), "standard");
  assert.equal(selectVoyageQuality({ width: 1440, height: 900 }), "low", "unknown hardware is conservative");
});

test("Skip resolves the correct ending without a progression mutation", () => {
  const promise = resolveVoyageSkipOutcome({ variant: "promise", timeSeconds: 12 });
  assert.equal(promise.terminalShotId, "return");
  assert.equal(promise.outcome, "destination-unresolved");
  assert.deepEqual(promise.finalText, VOYAGE_FINAL_TEXT);
  assert.equal(promise.progressionEffect, null);
  assert.equal(promise.cinematicAcknowledgement, true);
  assert.ok(Object.isFrozen(promise.finalText));

  const progress = resolveVoyageSkipOutcome({ variant: "progress", timeSeconds: -1 });
  assert.equal(progress.terminalShotId, "return");
  assert.equal(progress.skippedAtSeconds, 0);
  assert.equal(progress.progressionEffect, null);

  const completion = resolveVoyageSkipOutcome({ variant: "completion", timeSeconds: 999 });
  assert.equal(completion.terminalShotId, "beyond");
  assert.equal(completion.outcome, "continued-beyond");
  assert.deepEqual(completion.finalText, []);
  assert.equal(completion.skippedAtSeconds, 57);
  assert.equal(completion.progressionEffect, null);
});

test("replay milestones provide stable seek points for every world and preserve Earth/Moon facts", () => {
  assert.deepEqual(Object.keys(VOYAGE_REPLAY_MILESTONES).sort(), [...VOYAGE_WORLD_ORDER].sort());
  const earth = resolveVoyageReplayMilestone("earth");
  assert.equal(earth.timeSeconds, 0);
  assert.equal(earth.shot.id, "earth");
  assert.equal(earth.variant, "progress");
  const moon = resolveVoyageReplayMilestone("MOON", { variant: "promise" });
  assert.equal(moon.timeSeconds, 7);
  assert.equal(moon.shot.id, "solar");
  assert.equal(moon.variant, "promise");
  assert.equal(moon.progressionEffect, null);
  for (const worldId of VOYAGE_WORLD_ORDER) {
    const milestone = resolveVoyageReplayMilestone(worldId);
    assert.equal(milestone.worldId, worldId);
    assert.equal(milestone.shotId, milestone.shot.id);
    assert.ok(milestone.timeSeconds >= 0 && milestone.timeSeconds < VOYAGE_DURATION_SECONDS);
    assert.ok(Object.isFrozen(milestone));
    assert.ok(Object.isFrozen(milestone.shot));
  }
});
