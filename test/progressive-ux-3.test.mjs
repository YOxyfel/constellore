import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("Help orders its four assistance choices from least to most consequential", () => {
  const guidance = page.slice(page.indexOf('id="senseDialog"'), page.indexOf('id="stardustDialog"'));
  const hint = guidance.indexOf('id="useQuickTip"');
  const compass = guidance.indexOf('id="useSense"');
  const gift = guidance.indexOf('id="useWordGift"');
  const reveal = guidance.indexOf('id="revealPathButton"');
  assert.ok(hint >= 0 && compass > hint && gift > compass && reveal > gift);
  assert.match(guidance, /Next signal keeps 90% of max score and Stardust; Star Credits are reduced too[.]/);
  assert.match(guidance, /OPEN &middot; 75% SCORE/);
  assert.match(guidance, /OPEN &middot; 50% SCORE/);
  assert.match(guidance, /Study run with no score/);
  assert.doesNotMatch(guidance, /class="simple-hidden"[^>]*aria-hidden="true"[\s\S]*id="useSense"/);
});

test("each mission resets both desktop and mobile inventory scroll positions", () => {
  const start = app.slice(app.indexOf("function startWithGame"), app.indexOf("function pauseMenuAvailable"));
  assert.match(start, /els\.wordList\.scrollTop = 0/);
  assert.match(start, /els\.wordList\.scrollLeft = 0/);
});

test("Rival Ghost waits until the ten-game focus window is complete and uses verified route length when available", () => {
  const eligibility = app.slice(app.indexOf("function competitiveGhostEligible"), app.indexOf("function renderGhostPreview"));
  assert.match(eligibility, /profile\.wins >= HOME_MENU_ADVANCED_WINS/);
  assert.match(eligibility, /!state\.focusMode/);
  const estimate = app.slice(app.indexOf("function ghostStepEstimate"), app.indexOf("function ghostTimeline"));
  assert.match(estimate, /routeLength/);
  assert.match(estimate, /minimumMoves/);
  assert.match(estimate, /verifiedRouteLength/);
  assert.doesNotMatch(estimate, /rivalMoves|rival\?\.moves/);
});
