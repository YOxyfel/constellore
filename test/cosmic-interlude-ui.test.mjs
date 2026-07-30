import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const coreStyles = await readFile(new URL("../public/simple-ui.css", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/cosmic-interlude.css", import.meta.url), "utf8");
const runtime = await readFile(new URL("../public/cosmic-interlude-runtime.mjs", import.meta.url), "utf8");

const dialog = page.match(/<dialog\b(?=[^>]*\bid="cosmicInterludeDialog")[^>]*>[\s\S]*?<\/dialog>/i)?.[0] || "";

test("the Cosmic Interlude stylesheet stays outside the first-load CSS boundary", () => {
  assert.doesNotMatch(coreStyles, /[.]cosmic-interlude-modal/);
  assert.match(runtime, /loadOptionalStylesheet\(COSMIC_INTERLUDE_STYLESHEET,\s*document\)/);
  assert.match(runtime, /const stylesheet = await stylesReady;[\s\S]*if \(!stylesheet\)[\s\S]*begin\(offer,\s*completedChallenges\)/);
});

test("the Cosmic Interlude shell has a short accessible explanation and one clear action", () => {
  assert.ok(dialog, "the Cosmic Interlude dialog must exist");
  assert.match(dialog.match(/<dialog\b[^>]*>/i)?.[0] || "", /\baria-labelledby="cosmicInterludeTitle"/);
  assert.match(dialog, /\baria-describedby="cosmicInterludeDescription cosmicInterludeStatus"/);
  assert.match(dialog, /id="cosmicInterludeTitle"/);
  assert.match(dialog, /id="cosmicInterludeDescription"/);
  assert.match(dialog, /id="cosmicInterludeStatus"/);
  assert.match(dialog, /JUST FOR FUN/);
  assert.match(dialog, /id="cosmicInterludePrimary"[^>]*hidden disabled/);
  assert.match(dialog, /id="cosmicInterludeUndo"[^>]*hidden disabled/);
  assert.match(dialog, /id="cosmicInterludeSkip"/);
  assert.match(dialog, /Draw a line between each matching pair[.] The lines cannot cross[.]/);
});

test("the interlude provides canvas and endpoint hooks without making the canvas the accessible interface", () => {
  assert.match(dialog, /id="cosmicInterludeStage"[^>]*role="group"[^>]*tabindex="0"/);
  assert.match(dialog, /<canvas\b(?=[^>]*\bid="cosmicInterludeCanvas")(?=[^>]*\bwidth="960")(?=[^>]*\bheight="540")(?=[^>]*\baria-hidden="true")/);
  assert.match(dialog, /id="cosmicInterludeEndpoints"[^>]*role="group"[^>]*aria-label="Stars to connect"/);
  assert.match(dialog, /id="cosmicInterludeStageHelp"/);
  assert.match(dialog, /aria-describedby="cosmicInterludeDescription cosmicInterludeMemory cosmicInterludeStageHelp"/);
  assert.match(dialog, /id="cosmicInterludeMemory"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"[^>]*hidden/);
  assert.match(dialog, /id="cosmicInterludeAnnouncement"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.match(styles, /[.]simple-ui [.]cosmic-interlude-endpoint\s*\{[^}]*position:\s*absolute[^}]*min-width:\s*48px[^}]*min-height:\s*48px/s);
});

test("the memory round visibly counts down, then removes every answer cue before input unlocks", () => {
  assert.match(runtime, /Memorize the numbered stars[.] Input unlocks when the countdown ends[.]/);
  assert.match(runtime, /memoryPreview && trailNumber > 0[\s\S]*String\(trailNumber\)[\s\S]*symbolGlyph\(node[.]symbol\)/);
  assert.match(runtime, /button[.]setAttribute\("aria-disabled", String\(memoryPreview \|\| button[.]disabled\)\)/);
  assert.match(runtime, /button[.]tabIndex = memoryPreview \? 0/);
  assert.match(runtime, /button[.]classList[.]remove\("is-current"\)/);
  assert.doesNotMatch(runtime, /tap this one next/i);
  assert.match(styles, /[.]cosmic-interlude-memory\s*\{[^}]*position:\s*absolute[^}]*font-size:\s*16px/s);
  assert.match(styles, /[.]memory-preview [.]cosmic-interlude-endpoint\[aria-disabled="true"\]\s*\{[^}]*opacity:\s*1/s);
});

test("the interlude stays readable, touchable, responsive, and calm when motion is reduced", () => {
  assert.match(styles, /[.]simple-ui [.]cosmic-interlude-kicker\s*\{[^}]*font-size:\s*15px/s);
  assert.match(styles, /[.]simple-ui [.]cosmic-interlude-stage-help\s*\{[^}]*font-size:\s*15px/s);
  assert.match(styles, /[.]simple-ui [.]cosmic-interlude-actions > button\s*\{[^}]*min-height:\s*52px[^}]*font-size:\s*17px/s);
  assert.match(styles, /@media \(max-width:\s*640px\)[\s\S]*env\(safe-area-inset-top\)[\s\S]*[.]cosmic-interlude-actions\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*[.]cosmic-interlude-stage::after\s*\{[^}]*animation:\s*none\s*!important/s);
  assert.match(styles, /@media \(forced-colors:\s*active\)[\s\S]*[.]cosmic-interlude-modal/s);
});
