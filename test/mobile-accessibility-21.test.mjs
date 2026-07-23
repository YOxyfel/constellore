import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

test("fullscreen mobile chrome and new dialogs respect device safe areas", () => {
  assert.match(page, /viewport-fit=cover/);
  assert.match(styles, /[.]start-nav\s*\{[^}]*env\(safe-area-inset-top\)/);
  assert.match(styles, /[.]game-nav\s*\{[^}]*env\(safe-area-inset-top\)/);
  assert.match(styles, /[.]atlas-modal\s*\{[^}]*calc\(54px \+ env\(safe-area-inset-top\)\)/);
  assert.match(styles, /[.]journey-modal\s*\{[^}]*calc\(54px \+ env\(safe-area-inset-top\)\)/);
  assert.match(styles, /[.]journey-modal [.]modal-close\s*\{[^}]*env\(safe-area-inset-top\)/);
});

test("Journey and Atlas use selected styling and roving tab focus", () => {
  assert.match(page, /id="voyageJourneyTab"[^>]*aria-selected="true"[^>]*tabindex="0"/);
  assert.match(page, /id="eventJourneyTab"[^>]*aria-selected="false"[^>]*tabindex="-1"/);
  assert.match(page, /id="orbitAtlasTab"[^>]*aria-selected="true"[^>]*tabindex="0"/);
  assert.match(page, /id="masteryAtlasTab"[^>]*aria-selected="false"[^>]*tabindex="-1"/);
  assert.match(styles, /[.]segment-control button\[aria-selected="true"\]/);
  assert.match(app, /voyageJourneyTab"\)\.tabIndex = eventView \? -1 : 0/);
  assert.match(app, /masteryAtlasTab"\)\.tabIndex = mastery \? 0 : -1/);
});

test("small mobile controls meet the 44px touch target floor", () => {
  assert.match(styles, /[.]profile-chip, [.]premium-link\s*\{\s*min-height: 44px/);
  assert.match(styles, /[.]target-input-row\s*\{[^}]*44px/);
  assert.match(styles, /[.]target-input-row button\s*\{[^}]*min-width: 44px; min-height: 44px/);
  assert.match(styles, /[.]board-word\s*\{[^}]*min-height: 44px/);
  assert.match(styles, /[.]inventory-search\s*\{[^}]*min-height: 44px/);
  assert.match(styles, /[.]wish-button\s*\{[^}]*width: 44px; min-height: 44px/);
});

test("keyboard focus, locked-copy contrast, and reduced motion remain accessible", () => {
  assert.match(styles, /:where\(button, input, a, select, summary, \[tabindex\]\):focus-visible/);
  assert.doesNotMatch(styles, /[.]journey-stage[.]locked\s*\{[^}]*opacity/);
  assert.match(styles, /prefers-reduced-motion:[\s\S]*?[.]quick-power-button[.]is-armed[\s\S]*?[.]ghost-orb[\s\S]*?[.]board-word[.]sense-hot/);
});
