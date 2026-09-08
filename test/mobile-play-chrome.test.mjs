import assert from "node:assert/strict";
import test from "node:test";
import {
  MOBILE_PLAY_LAYOUT,
  calculatePlayableBounds,
  classifyMobilePlayLayout,
  createMobilePlayChrome
} from "../public/mobile-play-chrome.mjs";
import { bindMobilePlayShell } from "../public/mobile-play-shell-runtime.mjs";

class FakeStyle {
  values = new Map();
  setProperty(name, value) { this.values.set(name, String(value)); }
  removeProperty(name) { this.values.delete(name); }
  getPropertyValue(name) { return this.values.get(name) || ""; }
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.attributes = new Map();
    this.style = new FakeStyle();
    this.hidden = false;
    this.inert = false;
    this.open = false;
    this.focusCount = 0;
    this.listeners = new Map();
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  toggleAttribute(name, enabled) {
    if (enabled) this.setAttribute(name, "");
    else this.removeAttribute(name);
  }
  focus() { this.focusCount += 1; }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  emit(type, details = {}) {
    const event = { type, target: this, currentTarget: this, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...details };
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }
  contains(target) { return target === this; }
}

class FakeEventTarget {
  constructor(values = {}) { Object.assign(this, values); this.listeners = new Map(); }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  emit(type, details = {}) {
    const event = { type, target: this, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...details };
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }
  count(type) { return this.listeners.get(type)?.size || 0; }
}

function createFixture({ width = 390, height = 844, phase = "tutorial", expanded = false, preservePeekContent = false, events = [] } = {}) {
  const visualViewport = new FakeEventTarget({ width, height, offsetLeft: 0, offsetTop: 0 });
  const windowRef = new FakeEventTarget({ innerWidth: width, innerHeight: height, visualViewport });
  windowRef.matchMedia = (query) => ({
    matches: query.includes("portrait") ? windowRef.innerHeight >= windowRef.innerWidth : windowRef.innerWidth > windowRef.innerHeight
  });
  const root = new FakeElement("gameScreen");
  if (phase) root.setAttribute("data-play-phase", phase);
  const tools = { toggle: new FakeElement("mobileToolsToggle"), panel: new FakeElement("mobileToolsPanel") };
  const assistance = { toggle: new FakeElement("mobileAssistToggle"), panel: new FakeElement("boardAssistanceRail") };
  const sound = {
    toggle: new FakeElement("playSoundToggle"),
    panel: new FakeElement("playSoundPanel"),
    disclosure: new FakeElement("playSoundDisclosure")
  };
  const inventory = {
    toggle: new FakeElement("inventoryDrawerToggle"),
    panel: new FakeElement("inventoryDrawerBody"),
    preservePeekContent
  };
  const record = (kind) => (value) => events.push(`${kind}:${value.previous ?? ""}->${value.current ?? ""}:${value.reason ?? ""}`);
  const controller = createMobilePlayChrome({
    root,
    windowRef,
    visualViewport,
    surfaces: { tools, assistance, sound },
    inventory,
    inventoryExpanded: expanded,
    onSurfaceChange: record("surface"),
    onInventoryChange: record("inventory"),
    onLayoutChange: record("layout")
  });
  return { controller, root, windowRef, visualViewport, tools, assistance, sound, inventory, events };
}

test("play layout classification gives short landscape precedence over stacked", () => {
  assert.equal(classifyMobilePlayLayout({ width: 390, height: 844 }), MOBILE_PLAY_LAYOUT.STACKED);
  assert.equal(classifyMobilePlayLayout({ width: 820, height: 1180 }), MOBILE_PLAY_LAYOUT.STACKED);
  assert.equal(classifyMobilePlayLayout({ width: 449, height: 221 }), MOBILE_PLAY_LAYOUT.SHORT_LANDSCAPE);
  assert.equal(classifyMobilePlayLayout({ width: 887, height: 427 }), MOBILE_PLAY_LAYOUT.SHORT_LANDSCAPE);
  assert.equal(classifyMobilePlayLayout({ width: 650, height: 540 }), MOBILE_PLAY_LAYOUT.STACKED);
  assert.equal(classifyMobilePlayLayout({ width: 1000, height: 600 }), MOBILE_PLAY_LAYOUT.WIDE);
});

test("playable bounds clamp real insets, clip blockers, and keep minimum diagnostic", () => {
  const result = calculatePlayableBounds({
    boardWidth: 100,
    boardHeight: 80,
    persistentInsets: { left: 10, right: 20, top: -5, bottom: 15 },
    blockers: [
      { id: "left", x: -12, y: 10, width: 30, height: 20 },
      { id: "bottom", left: 60, top: 60, right: 120, bottom: 100 },
      { id: "outside", left: 0, top: 70, right: 5, bottom: 75 }
    ],
    minimum: { width: 75, height: 50 }
  });
  assert.deepEqual(
    { left: result.left, top: result.top, right: result.right, bottom: result.bottom, width: result.width, height: result.height },
    { left: 10, top: 0, right: 80, bottom: 65, width: 70, height: 65 }
  );
  assert.deepEqual(result.insets, { left: 10, top: 0, right: 20, bottom: 15 });
  assert.deepEqual(result.blockers, [
    { id: "left", left: 10, top: 10, right: 18, bottom: 30, width: 8, height: 20 },
    { id: "bottom", left: 60, top: 60, right: 80, bottom: 65, width: 20, height: 5 }
  ]);
  assert.equal(result.meetsMinimum, false);

  const exhausted = calculatePlayableBounds({
    boardWidth: 90,
    boardHeight: 40,
    persistentInsets: { left: 80, right: 80, top: 50, bottom: 8 },
    minimum: { width: 1, height: 1 }
  });
  assert.deepEqual(
    { left: exhausted.left, right: exhausted.right, top: exhausted.top, bottom: exhausted.bottom, width: exhausted.width, height: exhausted.height },
    { left: 80, right: 80, top: 40, bottom: 40, width: 0, height: 0 }
  );
  assert.deepEqual(exhausted.insets, { left: 80, right: 10, top: 40, bottom: 0 });
  assert.equal(exhausted.meetsMinimum, false);
});

test("mobile surfaces are exclusive and expansion closes in a deterministic order", () => {
  const fixture = createFixture({ expanded: true });
  const { controller, root, tools, assistance, inventory, events } = fixture;
  assert.equal(controller.state.layout, MOBILE_PLAY_LAYOUT.STACKED);
  assert.equal(root.getAttribute("data-play-phase"), "tutorial", "gameplay phase must be preserved");
  assert.equal(inventory.panel.hidden, false);

  controller.toggleSurface("tools");
  assert.equal(controller.state.activeSurface, "tools");
  assert.equal(controller.state.inventoryExpanded, false);
  assert.equal(root.getAttribute("data-mobile-surface"), "tools");
  assert.equal(tools.toggle.getAttribute("aria-expanded"), "true");
  assert.equal(tools.panel.hidden, false);
  assert.equal(tools.panel.inert, false);
  assert.equal(inventory.panel.hidden, true);
  assert.deepEqual(events.slice(0, 2), ["inventory:true->false:surface", "surface:->tools:toggle"]);

  controller.toggleSurface("assistance");
  assert.equal(tools.panel.hidden, true);
  assert.equal(tools.panel.inert, true);
  assert.equal(assistance.panel.hidden, false);
  assert.equal(controller.state.activeSurface, "assistance");
  assert.equal(tools.toggle.focusCount, 0, "switching surfaces must not restore focus to the old opener");

  controller.closeSurface();
  assert.equal(controller.state.activeSurface, null);
  assert.equal(assistance.toggle.focusCount, 1);
  assert.equal(root.getAttribute("data-mobile-surface"), "none");

  controller.toggleSurface("sound");
  controller.setInventoryExpanded(true);
  assert.equal(controller.state.activeSurface, null, "expanding inventory closes the active surface first");
  assert.equal(controller.state.inventoryExpanded, true);
  assert.deepEqual(events.slice(-2), ["surface:sound->:inventory", "inventory:false->true:api"]);
});

test("dialog and reset deterministically clear whichever exclusive layer is active", () => {
  const events = [];
  const fixture = createFixture({ expanded: true, events });
  fixture.controller.toggleSurface("tools");
  events.length = 0;
  fixture.controller.beforeDialog();
  assert.equal(fixture.controller.state.activeSurface, null);
  assert.equal(fixture.controller.state.inventoryExpanded, false);
  assert.deepEqual(events, ["surface:tools->:dialog"]);

  fixture.controller.setInventoryExpanded(true);
  events.length = 0;
  fixture.controller.reset();
  assert.equal(fixture.controller.state.activeSurface, null);
  assert.equal(fixture.controller.state.inventoryExpanded, false);
  assert.deepEqual(events, ["inventory:true->false:reset"]);
});

test("layout changes preserve inventory preference and keep desktop disclosures closed until requested", () => {
  const fixture = createFixture({ expanded: true });
  fixture.windowRef.innerWidth = 1200;
  fixture.windowRef.innerHeight = 700;
  fixture.visualViewport.width = 1200;
  fixture.visualViewport.height = 700;
  fixture.windowRef.emit("resize");
  assert.equal(fixture.controller.state.layout, MOBILE_PLAY_LAYOUT.WIDE);
  assert.equal(fixture.controller.state.inventoryExpanded, true);
  for (const entry of [fixture.tools, fixture.assistance, fixture.sound]) {
    assert.equal(entry.panel.hidden, true);
    assert.equal(entry.panel.inert, true);
    assert.equal(entry.panel.getAttribute("aria-hidden"), "true");
  }

  fixture.windowRef.innerWidth = 390;
  fixture.windowRef.innerHeight = 844;
  fixture.visualViewport.width = 390;
  fixture.visualViewport.height = 844;
  fixture.windowRef.emit("resize");
  assert.equal(fixture.controller.state.layout, MOBILE_PLAY_LAYOUT.STACKED);
  assert.equal(fixture.controller.state.inventoryExpanded, true);
  assert.equal(fixture.inventory.panel.hidden, false);
  assert.equal(fixture.tools.panel.hidden, true);

  fixture.controller.setInventoryExpanded(false);
  fixture.controller.toggleSurface("tools");
  fixture.windowRef.innerWidth = 1200;
  fixture.windowRef.innerHeight = 700;
  fixture.visualViewport.width = 1200;
  fixture.visualViewport.height = 700;
  fixture.windowRef.emit("resize");
  assert.equal(fixture.controller.state.activeSurface, null);
  assert.equal(fixture.tools.panel.hidden, true);
  assert.equal(fixture.tools.panel.inert, true);
});

test("desktop Tools, Help, and Sound are exclusive accessible disclosures while the collection stays available", () => {
  const { controller, root, tools, assistance, sound, inventory } = createFixture({ width: 1440, height: 900 });
  assert.equal(controller.state.layout, MOBILE_PLAY_LAYOUT.WIDE);
  assert.equal(inventory.panel.hidden, false);
  for (const entry of [tools, assistance, sound]) {
    assert.equal(entry.panel.hidden, true);
    assert.equal(entry.panel.inert, true);
    assert.equal(entry.toggle.getAttribute("aria-expanded"), "false");
  }

  controller.toggleSurface("tools");
  assert.equal(root.getAttribute("data-mobile-surface"), "tools");
  assert.equal(tools.panel.hidden, false);
  assert.equal(tools.panel.inert, false);
  assert.equal(tools.toggle.getAttribute("aria-expanded"), "true");
  assert.equal(inventory.panel.hidden, false);

  controller.toggleSurface("assistance");
  assert.equal(tools.panel.hidden, true);
  assert.equal(assistance.panel.hidden, false);
  assert.equal(tools.toggle.focusCount, 0);
  controller.toggleSurface("sound");
  assert.equal(assistance.panel.hidden, true);
  assert.equal(sound.panel.hidden, false);
  assert.equal(sound.disclosure.open, true);

  controller.closeSurface({ reason: "escape" });
  assert.equal(sound.panel.hidden, true);
  assert.equal(sound.disclosure.open, false);
  assert.equal(sound.toggle.focusCount, 1);
  assert.equal(root.getAttribute("data-mobile-surface"), "none");
  assert.equal(inventory.panel.inert, false);

  controller.toggleSurface("tools");
  controller.toggleSurface("tools");
  assert.equal(tools.panel.hidden, true);
  assert.equal(tools.toggle.focusCount, 1);
});

test("collapsed inventory may preserve an interactive card peek", () => {
  const fixture = createFixture({ preservePeekContent: true });
  assert.equal(fixture.controller.state.inventoryExpanded, false);
  assert.equal(fixture.inventory.toggle.getAttribute("aria-expanded"), "false");
  assert.equal(fixture.inventory.panel.getAttribute("data-mobile-state"), "closed");
  assert.equal(fixture.inventory.panel.hidden, false);
  assert.equal(fixture.inventory.panel.inert, false);
  assert.equal(fixture.inventory.panel.getAttribute("aria-hidden"), "false");

  fixture.controller.setInventoryExpanded(true);
  assert.equal(fixture.inventory.toggle.getAttribute("aria-expanded"), "true");
  assert.equal(fixture.inventory.panel.getAttribute("data-mobile-state"), "open");
  assert.equal(fixture.inventory.panel.hidden, false);
  assert.equal(fixture.inventory.panel.inert, false);
});

test("visual viewport variables update without keyboard height reclassifying the layout and destroy removes listeners", () => {
  const fixture = createFixture({ width: 390, height: 844 });
  assert.equal(fixture.root.style.getPropertyValue("--play-vv-width"), "390px");
  assert.equal(fixture.root.style.getPropertyValue("--play-vv-height"), "844px");
  assert.equal(fixture.visualViewport.count("resize"), 1);
  assert.equal(fixture.visualViewport.count("scroll"), 1);

  fixture.visualViewport.height = 280;
  fixture.visualViewport.offsetTop = 24;
  fixture.visualViewport.emit("resize");
  assert.equal(fixture.controller.state.layout, MOBILE_PLAY_LAYOUT.STACKED, "the software keyboard must not create landscape layout");
  assert.equal(fixture.root.style.getPropertyValue("--play-vv-height"), "280px");
  assert.equal(fixture.root.style.getPropertyValue("--play-vv-offset-top"), "24px");

  fixture.controller.toggleSurface("tools");
  fixture.controller.destroy();
  assert.equal(fixture.visualViewport.count("resize"), 0);
  assert.equal(fixture.visualViewport.count("scroll"), 0);
  assert.equal(fixture.windowRef.count("resize"), 0);
  assert.equal(fixture.root.hasAttribute("data-play-layout"), false);
  assert.equal(fixture.root.getAttribute("data-play-phase"), "tutorial", "destroy must not clear gameplay phase");
  assert.equal(fixture.tools.panel.hidden, false);
  assert.equal(fixture.tools.panel.inert, false);
  assert.equal(fixture.root.style.getPropertyValue("--play-vv-height"), "");
});

for (const [name, width, height] of [["desktop", 1440, 900], ["phone", 390, 844]]) {
  test(`${name} shell closes disclosures on Escape, outside press, and commands without losing focus`, () => {
    const fixture = createFixture({ width, height });
    fixture.controller.destroy();
    const documentRef = new FakeEventTarget({ defaultView: fixture.windowRef });
    fixture.root.ownerDocument = documentRef;
    const elements = [fixture.tools.toggle, fixture.tools.panel, fixture.assistance.toggle, fixture.assistance.panel,
      fixture.sound.toggle, fixture.sound.panel, fixture.sound.disclosure, fixture.inventory.toggle, fixture.inventory.panel];
    const bySelector = new Map(elements.map((element) => [`#${element.id}`, element]));
    fixture.root.querySelector = (selector) => bySelector.get(selector) || null;
    const controller = bindMobilePlayShell({ root: fixture.root });

    fixture.tools.toggle.emit("click");
    assert.equal(controller.state.activeSurface, "tools");
    const escape = documentRef.emit("keydown", { key: "Escape" });
    assert.equal(escape.defaultPrevented, true, "Escape must be consumed before the pause shortcut");
    assert.equal(controller.state.activeSurface, null);
    assert.equal(fixture.tools.toggle.focusCount, 1);

    fixture.tools.toggle.emit("click");
    fixture.assistance.toggle.emit("click");
    assert.equal(controller.state.activeSurface, "assistance");
    assert.equal(fixture.tools.panel.hidden, true);
    documentRef.emit("pointerdown", { target: fixture.assistance.panel });
    assert.equal(controller.state.activeSurface, "assistance", "inside interaction keeps the panel open");
    documentRef.emit("pointerdown", { target: new FakeElement("boardWord") });
    assert.equal(controller.state.activeSurface, null);
    assert.equal(fixture.assistance.toggle.focusCount, 0, "outside presses keep their own focus destination");

    const soundClick = fixture.sound.toggle.emit("click");
    assert.equal(soundClick.defaultPrevented, true, "the controller owns the native details state");
    assert.equal(controller.state.activeSurface, "sound");
    assert.equal(fixture.sound.disclosure.open, true);
    fixture.tools.toggle.emit("click");
    assert.equal(fixture.sound.disclosure.open, false);
    fixture.tools.panel.emit("click", { target: { closest: () => ({}) } });
    assert.equal(controller.state.activeSurface, null);
    assert.equal(fixture.tools.toggle.focusCount, 2, "command completion returns focus to the visible Tools control");
  });
}
