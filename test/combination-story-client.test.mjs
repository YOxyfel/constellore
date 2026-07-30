import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../public/story/combination-story-runtime.mjs", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/story/combination-story.css", import.meta.url), "utf8");

test("the board owns one lazy cumulative-story host", () => {
  assert.match(html, /<section class="combination-story" id="combinationStory" data-combination-story hidden><\/section>/);
  assert.doesNotMatch(html, /<link[^>]+combination-story[.]css/);
  assert.match(app, /import\("\.\/story\/combination-story-runtime[.]mjs\?v=[^"]+"\)/);
  assert.match(runtime, /new URL\("\.\/combination-story[.]css(?:[?]v=[^"]+)?", moduleUrl\)/);
  assert.match(runtime, /styleUrl[.]search = moduleUrl[.]search/);
  assert.match(styles, /pointer-events:\s*none/);
});

test("success, restore, failure, and run reset drive the same non-destructive story", () => {
  assert.match(app, /state[.]history[.]push\(historyStep\);\s*if \(!scrambleActive\) \{\s*renderCombinationStory\(\);/);
  assert.match(app, /updateMilestone\(Boolean\(progress[.]completed\)\);\s*renderCombinationStory\(\);/);
  assert.match(app, /error[.]code === "combination_missing"[\s\S]{0,180}renderCombinationStory\(\{ a: a[.]item[.]word, b: b[.]item[.]word \}\)/);
  assert.ok((app.match(/resetCombinationStory\(\);/g) || []).length >= 2);
  assert.doesNotMatch(runtime, /\b(?:fetch|localStorage|sessionStorage|indexedDB)\b/);
});
