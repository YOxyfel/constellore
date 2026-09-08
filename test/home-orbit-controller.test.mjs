import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  HOME_ORBIT_SCENES,
  HOME_ORBIT_SWIPE_MAX_DURATION_MS,
  createHomeOrbitController,
  deriveHomeLayout,
  homeCatalogItemMatches,
  nextHomeOrbitScene,
  normalizeHomeCatalogSearch,
  normalizeHomeOrbitScene
} from "../public/home-menu-view.mjs";

class FakeElement {
  constructor({ dataset = {}, hidden = false } = {}) {
    this.dataset = { ...dataset };
    this.hidden = hidden;
    this.disabled = false;
    this.tabIndex = -1;
    this.attributes = new Map();
    this.queries = new Map();
    this.listeners = new Map();
    this.styleValues = new Map();
    this.style = { setProperty: (name, value) => this.styleValues.set(name, value) };
    this.classList = {
      values: new Set(),
      contains: (name) => this.classList.values.has(name),
      add: (name) => this.classList.values.add(name),
      remove: (name) => this.classList.values.delete(name)
    };
    this.isConnected = true;
  }

  querySelector(selector) { return this.queries.get(selector) || null; }
  querySelectorAll(selector) { return this.queries.get(selector) || []; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener() {}
  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) listener({ target: this, ...event });
  }
  contains() { return true; }
  focus() { this.focused = true; }
  dispatchEvent() { return true; }
  closest(selector) {
    if (selector.includes("data-home-orbit-tab") && this.dataset.homeOrbitTab) return this;
    if (selector.includes("data-home-orbit-go") && this.dataset.homeOrbitGo) return this;
    return null;
  }
}

function controllerFixture({ windowOverrides = {}, sharedLayout = "", sharedDensity = "" } = {}) {
  const root = new FakeElement({ dataset: { homeOrbitActive: "forge" } });
  const track = new FakeElement();
  const viewport = new FakeElement();
  const tablist = new FakeElement();
  const previous = new FakeElement();
  const next = new FakeElement();
  const status = new FakeElement();
  const rocket = new FakeElement({ hidden: true });
  const tabs = Object.fromEntries(HOME_ORBIT_SCENES.map((scene) => [scene, new FakeElement({ dataset: { homeOrbitTab: scene } })]));
  const panels = Object.fromEntries(HOME_ORBIT_SCENES.map((scene) => [scene, new FakeElement({ dataset: { homeOrbitScene: scene } })]));
  root.queries.set("[data-home-orbit-track]", track);
  root.queries.set("[data-home-orbit-viewport]", viewport);
  root.queries.set("[role=tablist]", tablist);
  root.queries.set("[data-home-orbit-previous]", previous);
  root.queries.set("[data-home-orbit-next]", next);
  for (const scene of HOME_ORBIT_SCENES) {
    root.queries.set(`[data-home-orbit-tab="${scene}"]`, tabs[scene]);
    root.queries.set(`[data-home-orbit-scene="${scene}"]`, panels[scene]);
  }
  const elements = new Map([
    ["homeOrbitStatus", status],
    ["moonHomeRocket", rocket]
  ]);
  const documentRef = {
    body: new FakeElement(),
    documentElement: new FakeElement({ dataset: { uiLayout: sharedLayout, uiDensity: sharedDensity } }),
    defaultView: null,
    querySelector: (selector) => selector === "[data-home-orbit]" ? root : null,
    getElementById: (id) => elements.get(id) || null,
    addEventListener() {},
    removeEventListener() {}
  };
  const storageValues = new Map();
  const storage = {
    getItem: (key) => storageValues.get(key) || null,
    setItem: (key, value) => storageValues.set(key, value)
  };
  const controller = createHomeOrbitController({ documentRef, windowRef: windowOverrides, storage });
  return { controller, root, track, viewport, tabs, panels, rocket, status, storageValues };
}

test("Home layout derives stacked, compact, and observatory presentations from the shared viewport contract", () => {
  assert.deepEqual(
    deriveHomeLayout({ sharedLayout: "stacked", width: 768, height: 1024 }),
    { layout: "stacked", density: "regular", width: 768, height: 1024 }
  );
  assert.equal(deriveHomeLayout({ sharedLayout: "short-landscape", width: 568, height: 320 }).layout, "compact");
  assert.equal(deriveHomeLayout({ sharedLayout: "wide", width: 1024, height: 768 }).layout, "observatory");
  assert.equal(deriveHomeLayout({ sharedLayout: "wide", width: 1280, height: 720 }).layout, "observatory");
  assert.equal(deriveHomeLayout({ width: 390, height: 844 }).layout, "stacked");
  assert.equal(deriveHomeLayout({ width: 901, height: 600 }).density, "compact-height");
});

test("Home controller publishes its derived layout and density", () => {
  const fixture = controllerFixture({
    sharedLayout: "short-landscape",
    windowOverrides: { innerWidth: 568, innerHeight: 320 }
  });
  assert.equal(fixture.root.dataset.homeLayout, "compact");
  assert.equal(fixture.root.dataset.homeDensity, "compact-height");
  assert.equal(fixture.controller.snapshot().layout, "compact");
});

test("Home orbit navigation normalizes, wraps, and skips unavailable destinations", () => {
  assert.equal(normalizeHomeOrbitScene(" ARENA "), "arena");
  assert.equal(normalizeHomeOrbitScene("unknown"), "forge");
  assert.equal(nextHomeOrbitScene("forge", 1, { forge: true, journey: false, arena: true }), "arena");
  assert.equal(nextHomeOrbitScene("forge", -1, { forge: true, journey: true, arena: true }), "arena");
  assert.equal(nextHomeOrbitScene("arena", 1, ["forge", "arena"]), "forge");
});

test("Forge catalog search is normalized and matches every query term", () => {
  assert.equal(normalizeHomeCatalogSearch("  Today’s   WÓRD "), "today’s word");
  assert.equal(homeCatalogItemMatches("Weekly Route · The Three-Star Rift", "weekly rift"), true);
  assert.equal(homeCatalogItemMatches("Play without a target · Free play", "free target"), true);
  assert.equal(homeCatalogItemMatches("Limited moves", "timed"), false);
});

test("Home orbit keeps only the active scene interactive and every reload begins on Forge", () => {
  const first = controllerFixture();
  first.controller.syncAvailability({ forge: true, journey: true, arena: true });
  assert.equal(first.controller.select("journey"), true);
  assert.equal(first.controller.snapshot().activeScene, "journey");
  assert.equal(first.track.styleValues.get("--home-orbit-index"), "1");
  assert.equal(first.panels.journey.getAttribute("aria-hidden"), "false");
  assert.equal(first.panels.journey.getAttribute("inert"), null);
  assert.equal(first.panels.forge.getAttribute("aria-hidden"), "true");
  assert.equal(first.panels.forge.getAttribute("inert"), "");
  assert.equal(first.storageValues.has("constellore-home-orbit-v1"), false);
  assert.equal(first.storageValues.get("constellore-home-orbit-reveal-v1"), "1");

  const reload = controllerFixture();
  reload.storageValues.set("constellore-home-orbit-reveal-v1", "1");
  reload.controller.syncAvailability({ forge: true, journey: true, arena: true });
  assert.equal(reload.controller.snapshot().activeScene, "forge");
});

test("silent planet-centre selection never leaves a stale destination announcement", () => {
  const fixture = controllerFixture();
  fixture.controller.syncAvailability({ forge: true, journey: true, arena: true });
  fixture.status.textContent = "Forge selected.";
  assert.equal(fixture.controller.select("journey", {
    source: "planet-center",
    announce: false,
    focusTab: false
  }), true);
  assert.equal(fixture.controller.snapshot().activeScene, "journey");
  assert.equal(fixture.tabs.journey.getAttribute("aria-selected"), "true");
  assert.equal(fixture.status.textContent, "");
});

test("Home orbit swipe does not begin on interactive descendants", () => {
  const fixture = controllerFixture();
  fixture.controller.syncAvailability({ forge: true, journey: true, arena: true });
  const interactive = { closest: () => ({ tagName: "BUTTON" }) };
  fixture.viewport.dispatch("pointerdown", { target: interactive, isPrimary: true, button: 0, pointerId: 1, clientX: 220, clientY: 100 });
  fixture.viewport.dispatch("pointerup", { target: interactive, pointerId: 1, clientX: 80, clientY: 102 });
  assert.equal(fixture.controller.snapshot().activeScene, "forge");

  const canvas = { closest: () => null, parentElement: fixture.viewport };
  fixture.viewport.dispatch("pointerdown", { target: canvas, isPrimary: true, button: 0, pointerId: 2, clientX: 220, clientY: 100 });
  fixture.viewport.dispatch("pointerup", { target: canvas, pointerId: 2, clientX: 80, clientY: 102 });
  assert.equal(fixture.controller.snapshot().activeScene, "journey");
});

test("the legacy Home recognizer leaves Living Planet gestures to the planet controller", () => {
  const fixture = controllerFixture();
  fixture.controller.syncAvailability({ forge: true, journey: true, arena: true });
  const canvas = { closest: () => null, parentElement: null };
  const planetStage = new FakeElement();
  planetStage.contains = (element) => element === canvas;
  canvas.parentElement = planetStage;
  fixture.root.queries.set("[data-planet-hub]", planetStage);
  fixture.viewport.dispatch("pointerdown", { target: canvas, isPrimary: true, button: 0, pointerId: 12, clientX: 240, clientY: 100, timeStamp: 0 });
  fixture.viewport.dispatch("pointermove", { target: canvas, pointerId: 12, clientX: 130, clientY: 103, timeStamp: 100, preventDefault() {} });
  fixture.viewport.dispatch("pointerup", { target: canvas, pointerId: 12, clientX: 80, clientY: 103, timeStamp: 150 });
  assert.equal(fixture.controller.snapshot().activeScene, "forge");
});

test("Home orbit permits horizontal intent from vertical scrollers and the Journey scene control", () => {
  const fixture = controllerFixture({
    windowOverrides: {
      getComputedStyle: (element) => element.fakeStyle || { overflowX: "visible", overflowY: "visible" }
    }
  });
  fixture.controller.syncAvailability({ forge: true, journey: true, arena: true });
  const verticalScroller = {
    closest: () => null,
    parentElement: fixture.viewport,
    scrollHeight: 800,
    clientHeight: 200,
    scrollWidth: 200,
    clientWidth: 200,
    fakeStyle: { overflowX: "hidden", overflowY: "auto" }
  };
  fixture.viewport.dispatch("pointerdown", { target: verticalScroller, isPrimary: true, button: 0, pointerId: 8, clientX: 250, clientY: 100, timeStamp: 0 });
  fixture.viewport.dispatch("pointermove", { target: verticalScroller, pointerId: 8, clientX: 150, clientY: 103, timeStamp: 100, preventDefault() {} });
  fixture.viewport.dispatch("pointerup", { target: verticalScroller, pointerId: 8, clientX: 90, clientY: 103, timeStamp: 140 });
  assert.equal(fixture.controller.snapshot().activeScene, "journey");

  fixture.controller.reset();
  const journeyControl = {
    closest: () => ({ id: "moonHomeRocket" }),
    parentElement: fixture.viewport,
    scrollHeight: 200,
    clientHeight: 200,
    scrollWidth: 200,
    clientWidth: 200,
    fakeStyle: { overflowX: "visible", overflowY: "visible" }
  };
  fixture.viewport.dispatch("pointerdown", { target: journeyControl, isPrimary: true, button: 0, pointerId: 9, clientX: 250, clientY: 100, timeStamp: 0 });
  fixture.viewport.dispatch("pointermove", { target: journeyControl, pointerId: 9, clientX: 150, clientY: 102, timeStamp: 100, preventDefault() {} });
  fixture.viewport.dispatch("pointerup", { target: journeyControl, pointerId: 9, clientX: 90, clientY: 102, timeStamp: 140 });
  assert.equal(fixture.controller.snapshot().activeScene, "journey");
});

test("Home destination tabs reserve only horizontal arrows plus Home and End", () => {
  const fixture = controllerFixture();
  fixture.controller.syncAvailability({ forge: true, journey: true, arena: true });
  const tablist = fixture.root.querySelector("[role=tablist]");
  tablist.dispatch("keydown", {
    target: fixture.tabs.forge,
    key: "ArrowDown",
    preventDefault() { throw new Error("vertical arrows must remain native"); }
  });
  assert.equal(fixture.controller.snapshot().activeScene, "forge");
  let prevented = false;
  tablist.dispatch("keydown", {
    target: fixture.tabs.forge,
    key: "ArrowRight",
    preventDefault() { prevented = true; }
  });
  assert.equal(prevented, true);
  assert.equal(fixture.controller.snapshot().activeScene, "journey");
});

test("short-landscape destination rail publishes vertical semantics and uses Up and Down", () => {
  const fixture = controllerFixture({
    windowOverrides: { innerWidth: 667, innerHeight: 375 }
  });
  fixture.controller.syncAvailability({ forge: true, journey: true, arena: true });
  const tablist = fixture.root.querySelector("[role=tablist]");
  assert.equal(tablist.getAttribute("aria-orientation"), "vertical");
  let prevented = false;
  tablist.dispatch("keydown", {
    target: fixture.tabs.forge,
    key: "ArrowDown",
    preventDefault() { prevented = true; }
  });
  assert.equal(prevented, true);
  assert.equal(fixture.controller.snapshot().activeScene, "journey");
  tablist.dispatch("keydown", {
    target: fixture.tabs.journey,
    key: "ArrowLeft",
    preventDefault() { throw new Error("horizontal arrows must remain native for a vertical tablist"); }
  });
  assert.equal(fixture.controller.snapshot().activeScene, "journey");
});

test("Home orbit gives mobile swipes live feedback but rejects a slow hold-drag", () => {
  const fixture = controllerFixture();
  fixture.controller.syncAvailability({ forge: true, journey: true, arena: true });
  const canvas = { closest: () => null, parentElement: fixture.viewport };

  fixture.viewport.dispatch("pointerdown", { target: canvas, isPrimary: true, button: 0, pointerId: 3, clientX: 250, clientY: 100, timeStamp: 0 });
  fixture.viewport.dispatch("pointermove", { target: canvas, pointerId: 3, clientX: 170, clientY: 103, timeStamp: 120, preventDefault() {} });
  assert.equal(fixture.root.dataset.homeOrbitDragging, "true");
  assert.notEqual(fixture.track.styleValues.get("--home-orbit-drag"), "0px");
  fixture.viewport.dispatch("pointerup", { target: canvas, pointerId: 3, clientX: 120, clientY: 103, timeStamp: 170 });
  assert.equal(fixture.controller.snapshot().activeScene, "journey");
  assert.equal(fixture.track.styleValues.get("--home-orbit-drag"), "0px");

  fixture.controller.reset();
  fixture.viewport.dispatch("pointerdown", { target: canvas, isPrimary: true, button: 0, pointerId: 4, clientX: 250, clientY: 100, timeStamp: 10 });
  fixture.viewport.dispatch("pointerup", { target: canvas, pointerId: 4, clientX: 90, clientY: 102, timeStamp: 10 + HOME_ORBIT_SWIPE_MAX_DURATION_MS + 1 });
  assert.equal(fixture.controller.snapshot().activeScene, "forge");
});

test("Home orbit controller exposes approved destination and restoration aliases", () => {
  const fixture = controllerFixture();
  fixture.controller.syncAvailability({ forge: true, journey: true, arena: true });
  assert.equal(fixture.controller.setActive("journey"), true);
  assert.equal(fixture.controller.restoreFrom("arena"), true);
  assert.equal(fixture.controller.snapshot().activeScene, "arena");
  assert.equal(fixture.controller.restoreFrom("project"), true);
  assert.equal(fixture.controller.snapshot().activeScene, "journey");
  assert.equal(fixture.controller.restoreFrom("gameplay"), true);
  assert.equal(fixture.controller.snapshot().activeScene, "forge");
  fixture.controller.step(1);
  assert.equal(fixture.controller.snapshot().activeScene, "journey");
  fixture.controller.reset();
  assert.equal(fixture.controller.snapshot().activeScene, "forge");
  assert.equal(fixture.controller.openForgeCatalog(), false);
  assert.equal(fixture.controller.closeSurface(), false);
});

test("Home markup keeps all long catalogs in the Forge sheet and exposes dedicated scene controls", async () => {
  const [page, styles, view] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/epic-home.css", import.meta.url), "utf8"),
    readFile(new URL("../public/home-menu-view.mjs", import.meta.url), "utf8")
  ]);
  const sheetStart = page.indexOf('id="homeForgeCatalog"');
  const sheetEnd = page.indexOf("</main>", sheetStart);
  const sheet = page.slice(sheetStart, sheetEnd);
  assert.ok(sheetStart >= 0 && sheetEnd > sheetStart);
  for (const id of ["modePicker", "exploreHub", "cosmosCircuitHomeButton", "adventuresHub"]) {
    assert.match(sheet, new RegExp(`id="${id}"`));
  }
  for (const scene of HOME_ORBIT_SCENES) {
    assert.match(page, new RegExp(`data-home-orbit-tab="${scene}"`));
    assert.match(page, new RegExp(`data-home-orbit-scene="${scene}"`));
  }
  assert.doesNotMatch(page, /data-home-orbit-previous/);
  assert.doesNotMatch(page, /data-home-orbit-next/);
  assert.match(page, /id="moonHomeOriginPrefix">LAUNCHING FROM/);
  assert.match(page, /<dialog class="home-forge-sheet"[^>]+role="dialog"[^>]+aria-modal="true"/);
  assert.match(page, /id="homeForgeCatalogSearch"[^>]+aria-controls="homeForgeCatalogResults"/);
  assert.match(page, /id="scramblePortalModes" hidden/);
  assert.match(page, /id="scramblePortalStakes"[^>]+hidden/);
  assert.match(styles, /[.]home-orbit__scene\[aria-hidden="false"\]/);
  assert.match(styles, /[.]home-orbit__rail/);
  assert.match(styles, /max-width:\s*900px[^}]+orientation:\s*portrait/);
  assert.match(view, /button, a, input, select, textarea, summary/);
  assert.match(view, /HOME_ORBIT_SWIPE_MAX_DURATION_MS/);
  assert.match(view, /isolateCatalogBackground\(\)/);
  assert.match(view, /catalogAvailable:\s*menu[.]choicesReady\s*[|][|]\s*menu[.]exploreReady\s*[|][|]\s*menu[.]adventuresReady/);
  assert.doesNotMatch(view, /constellore-home-orbit-v1/);
});
