import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createFeedbackPreferencesUi } from "../public/feedback-preferences-ui.mjs";

const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
const simpleStyles = await readFile(new URL("../public/simple-ui.css", import.meta.url), "utf8");
const circuitStyles = await readFile(new URL("../public/cosmos-circuit.css", import.meta.url), "utf8");
const soundStyles = `${styles}\n${simpleStyles}\n${circuitStyles}`;
const circuitRuntime = await readFile(new URL("../public/cosmos-circuit-runtime.mjs", import.meta.url), "utf8");

class FakeElement {
  constructor(children = {}) {
    this.attributes = new Map();
    this.children = children;
    this.listeners = new Map();
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.value = "";
  }

  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) || [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }

  dispatch(name) {
    for (const listener of this.listeners.get(name) || []) listener({ currentTarget: this });
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  querySelector(selector) {
    return this.children[selector] || null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
}

function feedbackDocument() {
  const nodes = new Map();
  for (const id of ["soundPreference", "musicPreference", "hapticPreference", "resultDetailsPreference"]) {
    nodes.set(id, new FakeElement({ small: new FakeElement() }));
  }
  nodes.set("feedbackToggle", new FakeElement({ span: new FakeElement() }));
  nodes.set("resultDetails", new FakeElement());
  for (const stem of ["master", "music", "sfx"]) {
    nodes.set(`${stem}VolumePreference`, new FakeElement());
    nodes.set(`${stem}VolumeValue`, new FakeElement());
  }
  for (const surface of ["play", "pause", "circuit"]) {
    nodes.set(`${surface}VolumeDown`, new FakeElement());
    nodes.set(`${surface}VolumeUp`, new FakeElement());
    nodes.set(`${surface}MasterVolumeQuickValue`, new FakeElement());
    for (const stem of ["Master", "Music", "Sfx"]) {
      nodes.set(`${surface}${stem}VolumePreference`, new FakeElement());
      nodes.set(`${surface}${stem}VolumeValue`, new FakeElement());
    }
  }
  return {
    nodes,
    root: { getElementById: (id) => nodes.get(id) || null }
  };
}

test("feedback preference UI mirrors persistent mixers, previews live, and commits once per change", () => {
  const { nodes, root } = feedbackDocument();
  let preferences = { masterVolume: .4, soundVolume: .25 };
  let saves = 0;
  const tracked = [];
  const audio = {
    preferences: 0,
    primes: 0,
    cues: 0,
    setPreferences() { this.preferences += 1; },
    prime() { this.primes += 1; },
    playFeedback() { this.cues += 1; }
  };
  const ui = createFeedbackPreferencesUi({
    root,
    get: () => preferences,
    set: (value) => { preferences = value; },
    save: () => { saves += 1; },
    audio,
    track: (...entry) => tracked.push(entry)
  });

  ui.render();
  assert.equal(nodes.get("masterVolumePreference").value, "0.4");
  assert.equal(nodes.get("masterVolumeValue").textContent, "40%");
  assert.equal(nodes.get("sfxVolumePreference").value, "0.25");
  assert.equal(nodes.get("sfxVolumeValue").textContent, "25%");
  assert.equal(nodes.get("musicVolumePreference").value, "1");
  assert.equal(nodes.get("playMasterVolumePreference").value, "0.4");
  assert.equal(nodes.get("playMasterVolumeQuickValue").textContent, "40%");
  assert.equal(nodes.get("pauseMasterVolumeQuickValue").textContent, "40%");
  assert.equal(nodes.get("circuitMasterVolumeQuickValue").textContent, "40%");
  assert.equal(nodes.get("pauseSfxVolumeValue").textContent, "25%");
  assert.equal(nodes.get("circuitMusicVolumeValue").textContent, "100%");
  assert.equal(nodes.get("resultDetails").hidden, true);

  const master = nodes.get("playMasterVolumePreference");
  master.value = ".55";
  master.dispatch("input");
  assert.equal(preferences.volume, .55);
  assert.equal(nodes.get("masterVolumeValue").textContent, "55%");
  assert.equal(nodes.get("pauseMasterVolumePreference").value, "0.55");
  assert.equal(nodes.get("circuitMasterVolumeValue").textContent, "55%");
  assert.equal(saves, 0, "input previews without persisting each slider step");
  assert.equal(audio.primes, 1);
  assert.ok(audio.preferences >= 2);
  assert.equal(audio.cues, 1);

  master.dispatch("change");
  master.dispatch("change");
  assert.equal(saves, 1, "one changed slider gesture creates one durable save");

  nodes.get("pauseVolumeDown").dispatch("click");
  assert.equal(preferences.volume, .5);
  assert.equal(nodes.get("masterVolumePreference").value, "0.5");
  assert.equal(nodes.get("playMasterVolumeQuickValue").textContent, "50%");
  assert.equal(nodes.get("pauseMasterVolumeQuickValue").textContent, "50%");
  assert.equal(nodes.get("circuitMasterVolumeQuickValue").textContent, "50%");
  assert.equal(saves, 2, "each visible stepper click persists one master-volume change");

  nodes.get("soundPreference").dispatch("click");
  assert.equal(preferences.sound, false);
  assert.equal(saves, 3);
  assert.deepEqual(tracked, [["audio_toggled", { enabled: false }]]);
});

test("master steppers clamp at their bounds and keep all playable surfaces synchronized", () => {
  const { nodes, root } = feedbackDocument();
  let preferences = { volume: 0 };
  let saves = 0;
  const ui = createFeedbackPreferencesUi({
    root,
    get: () => preferences,
    set: (value) => { preferences = value; },
    save: () => { saves += 1; }
  });

  ui.render();
  assert.equal(nodes.get("playVolumeDown").disabled, true);
  assert.equal(nodes.get("pauseVolumeDown").disabled, true);
  assert.equal(nodes.get("circuitVolumeDown").disabled, true);
  nodes.get("playVolumeDown").dispatch("click");
  assert.equal(preferences.volume, 0);
  assert.equal(saves, 0);

  nodes.get("circuitVolumeUp").dispatch("click");
  assert.equal(preferences.volume, .05);
  assert.equal(nodes.get("playMasterVolumePreference").value, "0.05");
  assert.equal(nodes.get("pauseMasterVolumeQuickValue").textContent, "5%");
  assert.equal(nodes.get("playVolumeDown").disabled, false);
  assert.equal(saves, 1);
});

test("every playable surface exposes visible master controls and the same three-channel mixer", () => {
  for (const id of [
    "playVolumeControl", "playVolumeDown", "playMasterVolumeQuickValue", "playVolumeUp", "playMasterVolumePreference", "playMusicVolumePreference", "playSfxVolumePreference",
    "pauseVolumeControl", "pauseVolumeDown", "pauseMasterVolumeQuickValue", "pauseVolumeUp", "pauseMasterVolumePreference", "pauseMusicVolumePreference", "pauseSfxVolumePreference",
    "circuitVolumeControl", "circuitVolumeDown", "circuitMasterVolumeQuickValue", "circuitVolumeUp", "circuitMasterVolumePreference", "circuitMusicVolumePreference", "circuitSfxVolumePreference"
  ]) {
    assert.ok(page.includes(`id="${id}"`), `missing #${id}`);
  }
  for (const surface of ["play", "pause", "circuit"]) {
    assert.match(
      page,
      new RegExp(`id="${surface}VolumeControl"[\\s\\S]*?<button[^>]*id="${surface}VolumeDown"[\\s\\S]*?<output id="${surface}MasterVolumeQuickValue"[\\s\\S]*?<button[^>]*id="${surface}VolumeUp"[\\s\\S]*?<details class="vdet"`),
      `${surface} must expose decrement, percentage, and increment before its optional mixer`
    );
  }
  assert.match(page, /class="game-hud"[\s\S]*id="playVolumeControl"/);
  assert.match(page, /id="pauseDialog"[\s\S]*id="pauseVolumeControl"/);
  assert.match(page, /id="cosmosCircuitDialog"[\s\S]*id="circuitVolumeControl"/);
  assert.match(soundStyles, /[.]vstep\s*\{[^}]*min-height:\s*44px/);
  assert.match(soundStyles, /[.]vpanel/);
  assert.match(soundStyles, /[.]feedback-volume input\s*\{[^}]*min-height:\s*44px/);
  assert.match(soundStyles, /[.]vpause/);
  assert.match(soundStyles, /[.]vcircuit/);
  assert.match(
    simpleStyles,
    /@media \(max-width:\s*760px\)[\s\S]*?[.]vplay\s*\{[^}]*position:\s*relative[^}]*inset:\s*auto/,
    "wider mobile layouts must keep the play dock inside the top navigation"
  );
  assert.match(
    simpleStyles,
    /@media \(max-width:\s*599px\)[\s\S]*?[.]simple-ui [.]game-nav:has\(#playVolumeControl\)\s*\{[^}]*height:\s*calc\(134px\s*\+\s*env\(safe-area-inset-top\)\)[^}]*flex-basis:\s*calc\(134px\s*\+\s*env\(safe-area-inset-top\)\)[^}]*grid-template-rows:\s*72px 62px[^}]*\}[\s\S]*?[.]vplay\s*\{[^}]*position:\s*fixed[^}]*top:\s*calc\(76px\s*\+\s*env\(safe-area-inset-top\)\)/,
    "small phones must reserve a real navigation lane for the persistent play dock"
  );
  assert.doesNotMatch(simpleStyles, /[.]vplay\s*\{[^}]*top:\s*calc\(74px/);
  assert.doesNotMatch(circuitStyles, /[.]vctl\s*\{/, "core sound controls must not depend on the lazy Circuit stylesheet");
  assert.match(circuitRuntime, /event[.]target[?][.]closest[?][.]\("button, input, select, textarea, summary/);
});
