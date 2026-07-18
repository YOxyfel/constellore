import assert from "node:assert/strict";
import test from "node:test";

import { buildConstellationCard, constellationCardFilename, constellationCardShareText, renderConstellationCardSvg } from "../public/constellation-card.mjs";

const input = {
  target: "Telescope", emoji: "🔭", moves: 8, seconds: 73, discoveries: 5, seed: 42,
  universe: { name: "Clockwork Nebula", id: "clockwork-42" },
  history: [
    { a: "Earth", b: "Water", word: "Mud" }, { a: "Mud", b: "Fire", word: "Brick" },
    { a: "Fire", b: "Water", word: "Steam" }, { a: "Air", b: "Steam", word: "Cloud" },
    { a: "Cloud", b: "Energy", word: "Storm" }, { a: "Glass", b: "Sky", word: "Telescope" }
  ]
};

test("constellation cards are deterministic, bounded, and carry fair-play context", () => {
  const first = buildConstellationCard(input);
  const again = buildConstellationCard(input);
  assert.deepEqual(again, first);
  assert.equal(first.target, "Telescope");
  assert.equal(first.division, "PURE");
  assert.equal(first.points.length, 8);
  assert.ok(first.points.every((point) => point.x >= 0 && point.x <= 1080 && point.y >= 0 && point.y <= 1350));
  assert.deepEqual(first.milestones, ["Mud", "Brick", "Steam", "Cloud"]);
  assert.equal(buildConstellationCard({ ...input, wished: true }).division, "OPEN");
  assert.equal(buildConstellationCard({ ...input, training: true }).division, "TRAINING");
  assert.equal(buildConstellationCard({ ...input, scoringDisabled: true }).division, "STUDY");
});

test("SVG cards are standalone, escaped images with no executable markup", () => {
  const model = buildConstellationCard({ ...input, target: '<script>alert("x")</script>', universe: { name: "Bad & Bright", id: "x" } });
  const svg = renderConstellationCardSvg(model);
  assert.match(svg, /^<svg xmlns=/);
  assert.match(svg, /width="1080" height="1350"/);
  assert.match(svg, /&lt;script&gt;alert/);
  assert.doesNotMatch(svg, /<script|onload=|javascript:/i);
  assert.match(svg, /BAD &amp; BRIGHT/);
});

test("card filenames and share text are safe and useful", () => {
  const model = buildConstellationCard(input);
  assert.match(constellationCardFilename(model), /^constellore-telescope-[a-z0-9]+[.]svg$/);
  assert.equal(constellationCardShareText(model), "I traced Telescope in 8 moves · PURE orbit · Constellore");
  assert.match(constellationCardShareText({ ...model, division: "STUDY" }), /STUDY orbit/);
});
