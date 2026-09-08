import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [styles, runtime] = await Promise.all([
  readFile(new URL("../public/scramble.css", import.meta.url), "utf8"),
  readFile(new URL("../public/scramble-runtime.mjs", import.meta.url), "utf8")
]);

const modes = ["target-race", "wordstorm", "forge-clash", "riddle-saga"];

test("every live Arena mode owns a distinct background and VFX recipe", () => {
  const recipes = modes.map((mode) => {
    const start = styles.indexOf(`[data-scramble-format="${mode}"]`);
    const end = styles.indexOf("}", start);
    assert.ok(start >= 0 && end > start, `${mode} needs an environment recipe`);
    const recipe = styles.slice(styles.indexOf("{", start) + 1, end);
    assert.match(recipe, /--ab:/, `${mode} needs a background composition`);
    assert.match(recipe, /--afx:/, `${mode} needs an ambient VFX composition`);
    return recipe.replace(/--scramble-(?:cyan|violet|amber):[^;]+;?/g, "");
  });

  assert.equal(new Set(recipes).size, modes.length);
  assert.match(styles, /body[.]scramble-active [.]cosmos-board,[.]scramble-rival-board,[.]scramble-countdown\{background:var\(--ab\)\}/);
  assert.match(styles, /body[.]scramble-active [.]cosmos-board::after\{[^}]*background-image:var\(--afx\)[^}]*animation:sae/);
  assert.match(styles, /@keyframes sae\s*\{/);
});

test("Arena environment state reaches every match surface and motion can be reduced", () => {
  const setter = runtime.slice(
    runtime.indexOf("function setFormatData"),
    runtime.indexOf("function syncFormatPresentation")
  );
  for (const surface of [
    "documentRef.body",
    "root",
    'byId("scrambleScorebar")',
    'byId("scrambleRivalBoard")',
    'byId("scrambleCountdown")'
  ]) assert.ok(setter.includes(surface), `${surface} must receive the Arena mode`);

  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*body[.]scramble-active [.]cosmos-board::after\s*\{\s*animation:\s*none/
  );
  assert.match(styles, /body\[data-cosmetic-effects="reduced"\][.]scramble-active [.]cosmos-board::after\{animation:none\}/);
  assert.match(styles, /body\[data-cosmetic-effects="off"\][.]scramble-active [.]cosmos-board::after\{display:none\}/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*body[.]scramble-active [.]cosmos-board::after\s*\{\s*display:\s*none/);
});
