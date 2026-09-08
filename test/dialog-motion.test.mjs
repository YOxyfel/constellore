import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const simpleUi = readFileSync(new URL("../public/simple-ui.css", import.meta.url), "utf8");
const cosmicGate = readFileSync(new URL("../public/cosmic-gate.css", import.meta.url), "utf8");
const birthdayVoyage = readFileSync(new URL("../public/birthday-voyage.css", import.meta.url), "utf8");

function sourceBetween(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `Missing ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `Missing ${end}`);
  return source.slice(from, to);
}

test("ordinary popup windows share one transform-safe scale-in motion", () => {
  assert.match(
    simpleUi,
    /dialog\[open\]:not\(\.cosmetics-observatory\):not\(\.cosmetic-world-preview\):not\(\.cosmic-dialog-transition\[data-phase\]\)/
  );
  assert.match(simpleUi, /\[role="alertdialog"\]:not\(\[hidden\]\)/);

  const enter = sourceBetween(simpleUi, "@keyframes ui-window-enter", "@keyframes ui-preview-window-enter");
  assert.match(enter, /opacity:\s*0/);
  assert.match(enter, /scale:\s*\.84/);
  assert.match(enter, /scale:\s*1/);
  assert.doesNotMatch(enter, /transform\s*:/, "root motion must preserve each dialog's positioning transform");
  assert.doesNotMatch(enter, /filter\s*:/, "text must remain crisp while the window grows");

  const centered = sourceBetween(simpleUi, "@keyframes ui-centered-window-enter", "@keyframes ui-subwindow-enter");
  assert.match(centered, /transform:\s*translate\(-50%, -50%\) scale\(\.84\)/);
  assert.match(centered, /transform:\s*translate\(-50%, -50%\) scale\(1\)/);
  assert.doesNotMatch(centered, /filter\s*:/);
});

test("docked and full-screen windows use motion suited to their geometry", () => {
  assert.match(
    simpleUi,
    /\.cosmetic-world-preview\[open\] \.cosmetic-world-preview__bar[\s\S]*animation:\s*ui-preview-window-enter/
  );
  assert.match(
    simpleUi,
    /@media \(max-width:\s*700px\)[\s\S]*ui-full-window-enter/
  );
  for (const modal of [
    "hub-menu-modal",
    "sense-modal",
    "profile-modal",
    "atlas-modal",
    "exchange-modal",
    "leaderboard-modal",
    "journey-modal",
    "result-modal",
  ]) {
    assert.match(simpleUi, new RegExp(`\\.${modal}`), `${modal} must use mobile-safe window motion`);
  }
  assert.match(simpleUi, /dialog\[open\]:not\(\.cosmetics-observatory\)/);
  assert.doesNotMatch(
    simpleUi,
    /dialog\[open\](?![^\n]*not\(\.cosmetics-observatory\))[^\{]*\{[^\}]*ui-window-enter/,
    "the full-page Cosmetic Lab must not shrink like a popup"
  );
});

test("bespoke cinematic windows retain their existing entry motion", () => {
  assert.match(simpleUi, /not\(\.cosmic-dialog-transition\[data-phase\]\)/);
  assert.match(cosmicGate, /cosmic-dialog-transition\[data-phase="opening"\][\s\S]*cosmic-dialog-arrive/);
  assert.match(birthdayVoyage, /birthday-voyage__route-preview\[open\][\s\S]*birthday-route-preview-in/);
  assert.match(birthdayVoyage, /birthday-voyage__message\[open\][\s\S]*birthday-message-in/);
});

test("window motion honors reduced and disabled effects", () => {
  assert.match(simpleUi, /data-cosmetic-effects="reduced"[\s\S]*ui-window-enter-reduced 180ms/);
  assert.match(simpleUi, /data-cosmetic-effects="off"[\s\S]*animation:\s*none !important/);
  assert.match(
    simpleUi,
    /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*dialog\[open\][\s\S]*animation:\s*none !important/
  );
});
