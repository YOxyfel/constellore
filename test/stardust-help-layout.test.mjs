import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../public/stardust-store.css", import.meta.url), "utf8");

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] || "";
}

test("the assistance ladder and cards cannot grow beyond the Help dialog", () => {
  const ladder = rule(".simple-ui .assistance-ladder");
  const card = rule(".simple-ui .assistance-step");

  assert.match(ladder, /min-width:\s*0/);
  assert.match(ladder, /max-width:\s*100%/);
  assert.match(card, /box-sizing:\s*border-box/);
  assert.match(card, /min-width:\s*0/);
  assert.match(card, /max-width:\s*100%/);
});

test("Compass confirmation and charge copy wrap inside their button", () => {
  const action = rule(".simple-ui .assistance-step .powerup-action");
  const actionCopy = rule(".simple-ui .assistance-step .powerup-action > span");
  const stock = rule(".simple-ui .assistance-step .powerup-action-stock");

  assert.match(action, /box-sizing:\s*border-box/);
  assert.match(action, /max-width:\s*100%/);
  assert.match(actionCopy, /overflow-wrap:\s*anywhere/);
  assert.match(stock, /width:\s*100%/);
  assert.match(stock, /max-width:\s*100%/);
  assert.match(stock, /white-space:\s*normal/);
  assert.match(stock, /overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(stock, /white-space:\s*nowrap/);
});

test("the assistance cards switch to one column at the shared tablet breakpoint", () => {
  assert.match(
    styles,
    /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*?\.simple-ui \.assistance-step\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)[\s\S]*?\.simple-ui \.assistance-step \.powerup-action\s*\{[\s\S]*?grid-column:\s*1[\s\S]*?grid-row:\s*auto/
  );
});
