import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const powerupRuntime = await readFile(new URL("../public/powerup-view-runtime.mjs", import.meta.url), "utf8");
const styles = [
  await readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  await readFile(new URL("../public/simple-ui.css", import.meta.url), "utf8"),
  await readFile(new URL("../public/stardust-store.css", import.meta.url), "utf8")
].join("\n");

function sourceBetween(source, startMarker, endMarker) {
  source = source.replace(/\r\n?/g, "\n");
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `expected ${startMarker} before ${endMarker}`);
  return source.slice(start, end);
}

test("the workspace owns one ordered Help disclosure with distinct shortcut and stock affordances", () => {
  const board = sourceBetween(page, '<div class="board-workspace-bar"', '<section class="cosmos-board" id="board"');
  const rail = sourceBetween(board, '<nav class="board-assistance-rail" id="boardAssistanceRail"', "</nav>");
  const controls = [
    ["quickTipShortcut", "1", "route-signal", "quickTipShortcutCount"],
    ["senseShortcut", "2", "star-compass", "senseShortcutCount"],
    ["wordGiftShortcut", "3", "word-gift", "wordGiftShortcutCount"],
    ["revealShortcut", "4", "reveal", "revealShortcutCount"]
  ];

  let priorIndex = -1;
  for (const [id, key, kind, stockId] of controls) {
    const index = rail.indexOf(`id="${id}"`);
    assert.ok(index > priorIndex, `${id} should follow the preceding assistance action`);
    priorIndex = index;
    assert.match(rail, new RegExp(`id="${id}"[^>]+aria-keyshortcuts="${key}"[^>]+data-assistance-kind="${kind}"`));
    assert.match(rail, new RegExp(`<kbd[^>]*>${key}</kbd>`));
    assert.match(rail, new RegExp(`<em id="${stockId}"`));
  }

  assert.ok(rail.indexOf('id="senseButton"') > rail.indexOf('id="revealShortcut"'), "the informational Help action belongs beneath the four usable tools");
  assert.match(rail, /id="senseButton"[^>]+aria-controls="senseDialog"[^>]+aria-label="Open Need help information"/);
});

test("Help and Stardust Supplies are separate, contextual dialogs", () => {
  const help = sourceBetween(page, '<dialog id="senseDialog"', '<dialog id="stardustDialog"');
  const supplies = sourceBetween(page, '<dialog id="stardustDialog"', '<dialog id="revealDialog"');

  assert.match(help, /<h2 id="senseTitle">Need help[?]<\/h2>/);
  assert.match(help, /id="powerupShopShortcut"[^>]+aria-controls="stardustDialog"[^>]+aria-label="Open Stardust supplies"/);
  assert.doesNotMatch(help, /class="stardust-store"/);

  assert.match(supplies, /<h2 id="stardustDialogTitle">Stardust supplies<\/h2>/);
  assert.match(supplies, /id="stardustDialogContext"[^>]+role="status"[^>]+aria-live="polite"/);
  for (const id of ["routeSignalSupply", "starCompassSupply", "wordGiftSupply", "revealSupply"]) {
    assert.match(supplies, new RegExp(`id="${id}"`));
  }
  for (const id of ["routeSignalRefillStatus", "wordGiftRefillStatus", "revealRefillStatus"]) {
    assert.match(supplies, new RegExp(`id="${id}"`));
  }
  assert.match(supplies, /Route Signal[\s\S]*return when you begin a new orbit/);
  assert.match(supplies, /Word Gift[\s\S]*available when the route can offer a new bridge/);
  assert.match(supplies, /Reveal[\s\S]*Always available[.] Revealing changes the orbit to Study with no score/);
  assert.match(supplies, /id="buyStarCompass"/);
});

test("rail state, empty routing, and 1-4 keyboard dispatch share the visible controls", () => {
  const render = powerupRuntime;
  const railActions = sourceBetween(app, "function useRouteSignalShortcut()", "function activateOpenPowerupShortcut");
  const keyboard = sourceBetween(
    app,
    'document.addEventListener("keydown", (event) => {\n  if (event.defaultPrevented || event.repeat || event.altKey',
    'els.rivalGhost.addEventListener("click", toggleRivalGhost)'
  );

  for (const id of ["quickTipShortcut", "senseShortcut", "wordGiftShortcut", "revealShortcut", "revealShortcutCount", "stardustDialog"]) {
    assert.match(app, new RegExp(`${id}: [$][(]"#${id}"[)]`), `${id} should be cached once with the other UI elements`);
  }
  assert.match(render, /quickTipShortcutCount[.]textContent\s*=\s*tipsRemaining\s*>\s*0\s*[?]\s*String\(tipsRemaining\)\s*:\s*"[+]"/);
  assert.match(render, /senseShortcutCount[.]textContent\s*=\s*senseCount\s*>\s*0\s*[?]\s*String\(senseCount\)\s*:\s*"[+]"/);
  assert.match(render, /wordGiftShortcutCount[.]textContent\s*=\s*[^;]*"[+]"/s);
  assert.match(render, /revealShortcutCount[.]textContent\s*=\s*[^;]+/);
  assert.match(render, /quickTipShortcut[.]disabled\s*=\s*!activeRun\s*\|\|\s*state[.]powerups[.]busy/);
  assert.match(render, /senseShortcut[.]disabled\s*=\s*!compassRunEligible\s*\|\|\s*state[.]powerups[.]busy/);
  assert.match(render, /wordGiftShortcut[.]disabled\s*=\s*!activeRun\s*\|\|\s*state[.]powerups[.]busy/);

  const returnTrigger = sourceBetween(app, "function assistanceReturnTrigger(fallback)", "function useRouteSignalShortcut()");
  assert.match(returnTrigger, /return els[.]mobileAssistToggle[?][.]offsetParent !== null && els[.]mobileAssistToggle \? els[.]mobileAssistToggle : fallback;/, "dialogs return to the visible Help toggle at every viewport width");
  assert.match(railActions, /!tipsRemaining[\s\S]*openPowerupShop\(\{ focusItem: "route-signal", trigger: assistanceReturnTrigger\(els[.]quickTipShortcut\) \}\)[\s\S]*return "shop"/);
  assert.match(railActions, /!giftReady[\s\S]*openPowerupShop\(\{ focusItem: "word-gift", trigger: assistanceReturnTrigger\(els[.]wordGiftShortcut\) \}\)[\s\S]*return "shop"/);
  assert.match(railActions, /!charges[\s\S]*openPowerupShop\(\{ focusItem: "star-compass", trigger: assistanceReturnTrigger\(els[.]senseShortcut\) \}\)[\s\S]*return "shop"/);
  const routeSignal = sourceBetween(app, "function useRouteSignalShortcut()", "function useWordGiftRailShortcut()");
  const wordGift = sourceBetween(app, "function useWordGiftRailShortcut()", "function useSenseRailShortcut()");
  const compass = sourceBetween(app, "function useSenseRailShortcut()", "function useRevealRailShortcut()");
  const reveal = sourceBetween(app, "function useRevealRailShortcut()", "function activateOpenPowerupShortcut");
  assert.match(routeSignal, /return "blocked"[\s\S]*return "shop"[\s\S]*return "committed"/);
  assert.match(wordGift, /return "blocked"[\s\S]*return "shop"[\s\S]*return outcome/);
  assert.match(compass, /return "blocked"[\s\S]*return "shop"[\s\S]*return outcome/);
  assert.match(reveal, /return "blocked"[\s\S]*openRevealPath\(\{ trigger: assistanceReturnTrigger\(els[.]revealShortcut\) \}\)[\s\S]*return "dialog"/);
  assert.match(railActions, /if \(outcome === "committed"\) mobilePlayChrome[?][.]closeSurface\(\{ restoreFocus: false \}\)/);

  assert.match(app, /quickTipShortcut[.]addEventListener\("click",\s*useRouteSignalShortcut\)/);
  assert.match(app, /senseShortcut[.]addEventListener\("click",\s*useSenseRailShortcut\)/);
  assert.match(app, /wordGiftShortcut[.]addEventListener\("click",\s*useWordGiftRailShortcut\)/);
  assert.match(app, /revealShortcut[.]addEventListener\("click",\s*useRevealRailShortcut\)/);
  assert.match(app, /powerupShopShortcut[.]addEventListener\("click", \(\) => openPowerupShop\(\{ trigger: els[.]powerupShopShortcut \}\)\)/);
  assert.match(keyboard, /Digit1:\s*els[.]quickTipShortcut[\s\S]*Digit2:\s*els[.]senseShortcut[\s\S]*Digit3:\s*els[.]wordGiftShortcut[\s\S]*Digit4:\s*els[.]revealShortcut/);
  assert.match(keyboard, /event[.]defaultPrevented\s*\|\|\s*event[.]repeat[\s\S]*event[.]ctrlKey[\s\S]*event[.]metaKey/);
  assert.match(keyboard, /active[?][.]matches[?][.]\("input, textarea, select, \[contenteditable='true'\]"\)/, "shortcuts must not steal typing from editable controls");
  assert.match(keyboard, /document[.]querySelector\("dialog\[open\]"\)/, "shortcuts stay inactive while a modal owns interaction");
  assert.match(app, /stardustDialog[.]showModal\(\)/);
});

test("the rail is vertically stacked, contained by the board, animated, and reduced-motion safe", () => {
  assert.match(styles, /[.]board-assistance-rail\s*\{[^}]*position:\s*absolute[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*\}/s);
  assert.match(styles, /[.]board-assistance-rail\s*\{[^}]*(?:left|inset-inline-start):\s*[^;]+;[^}]*(?:top|inset-block-start):\s*[^;]+;/s);
  assert.match(styles, /[.]assist-rail-action[^}]*min-(?:inline-size|width):\s*(?:44px|var\([^)]*\))/s);
  assert.match(styles, /[.]assist-rail-action[^}]*min-(?:block-size|height):\s*(?:44px|var\([^)]*\))/s);
  assert.match(styles, /[.]assist-rail-action\s*(?:>|\s)\s*em[^}]*border-radius:\s*(?:50%|999px)/s);
  assert.match(styles, /@keyframes\s+assist(?:Rail|[-]rail)[A-Za-z0-9_-]*/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*[.]board-assistance-rail|@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*[.]assist-rail/s);
});
