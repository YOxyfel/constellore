import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [html, foundation, app, manropeLicense, dmMonoLicense, packageSource] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/ui-foundation.css", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/fonts/OFL-Manrope.txt", import.meta.url), "utf8"),
  readFile(new URL("../public/fonts/OFL-DM-Mono.txt", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);
const releaseVersion = JSON.parse(packageSource).version;

test("the game loads one versioned foundation before surface styles", () => {
  const foundationIndex = html.indexOf(`href="/ui-foundation.css?v=${releaseVersion}"`);
  const legacyIndex = html.indexOf(`href="/styles.css?v=${releaseVersion}"`);

  assert.ok(foundationIndex >= 0);
  assert.ok(legacyIndex > foundationIndex);
});

test("the foundation self-hosts licensed interface fonts and canonical tokens", () => {
  assert.match(foundation, /font-family:\s*"Manrope"/);
  assert.match(foundation, /fonts\/Manrope-Variable[.]ttf/);
  assert.match(foundation, /font-family:\s*"DM Mono"/);
  assert.match(foundation, /fonts\/DMMono-Medium[.]ttf/);
  assert.match(foundation, /--hit-default:\s*48px/);
  assert.match(foundation, /--hit-compact:\s*44px/);
  assert.match(foundation, /--safe-top:\s*env\(safe-area-inset-top/);
  assert.match(foundation, /dialog:not\(\[open\]\)[\s\S]*display:\s*none\s*!important/);
  assert.match(manropeLicense, /SIL OPEN FONT LICENSE Version 1[.]1/i);
  assert.match(dmMonoLicense, /SIL OPEN FONT LICENSE Version 1[.]1/i);
});

test("one responsive context owns layout and visual viewport publication", () => {
  assert.match(app, /createResponsiveContext\(/);
  assert.doesNotMatch(app, /matchMedia\([^\n]+max-width:\s*700px[^\n]+\)[\s\S]{0,60}data-ui-layout/);
});

test("migrated menu and dialog actions use the shared control primitives", () => {
  assert.match(html, /class="modal-close ui-close-button"[^>]+data-close="hubMenuDialog"/);
  assert.match(html, /class="primary-action ui-button ui-button--primary" id="resumePausedRun"/);
  assert.match(html, /class="quiet-action pause-exit ui-button ui-button--safe" id="pauseExit"/);
  assert.match(html, /class="primary-action ui-button ui-button--primary" id="confirmReveal"/);
});
