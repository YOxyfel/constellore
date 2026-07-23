import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("Guidance presents one score-safe action before stronger help", () => {
  const guidance = page.slice(page.indexOf('id="senseDialog"'), page.indexOf('id="revealDialog"'));
  const signal = guidance.indexOf('id="useQuickTip"');
  const disclosure = guidance.indexOf('class="guidance-stronger"');
  const compass = guidance.indexOf('id="useSense"');
  const gift = guidance.indexOf('id="useWordGift"');
  const reveal = guidance.indexOf('id="revealPathButton"');
  assert.ok(signal >= 0 && disclosure > signal);
  assert.ok(compass > disclosure && gift > disclosure && reveal > disclosure);
  assert.match(guidance, /SCORE SAFE/);
  assert.match(guidance, /Need stronger help/);
});

test("each mission resets both desktop and mobile inventory scroll positions", () => {
  const start = app.slice(app.indexOf("function startWithGame"), app.indexOf("function pauseMenuAvailable"));
  assert.match(start, /els\.wordList\.scrollTop = 0/);
  assert.match(start, /els\.wordList\.scrollLeft = 0/);
});

test("Rival Ghost waits for three real wins and uses verified route length when available", () => {
  const eligibility = app.slice(app.indexOf("function competitiveGhostEligible"), app.indexOf("function renderGhostPreview"));
  assert.match(eligibility, /profile\.wins >= 3/);
  const estimate = app.slice(app.indexOf("function ghostStepEstimate"), app.indexOf("function ghostTimeline"));
  assert.match(estimate, /routeLength/);
  assert.match(estimate, /minimumMoves/);
  assert.match(estimate, /verifiedRouteLength/);
  assert.doesNotMatch(estimate, /rivalMoves|rival\?\.moves/);
});
