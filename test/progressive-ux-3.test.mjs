import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("Help orders its three plain choices from least to most assistance", () => {
  const guidance = page.slice(page.indexOf('id="senseDialog"'), page.indexOf('id="revealDialog"'));
  const hint = guidance.indexOf('id="useQuickTip"');
  const gift = guidance.indexOf('id="useWordGift"');
  const reveal = guidance.indexOf('id="revealPathButton"');
  const legacyExtra = guidance.indexOf('id="useSense"');
  assert.ok(hint >= 0 && gift > hint && reveal > gift);
  assert.ok(legacyExtra > reveal, "advanced legacy help must stay outside the primary choice order");
  assert.match(guidance, /Your points stay the same/);
  assert.match(guidance, /You keep half your points/);
  assert.match(guidance, /You get no points/);
  assert.match(guidance, /class="simple-hidden"[^>]*aria-hidden="true"[\s\S]*id="useSense"/);
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
