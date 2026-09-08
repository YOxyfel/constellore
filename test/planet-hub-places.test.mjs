import assert from "node:assert/strict";
import test from "node:test";

import { createPlanetHubPlacesController } from "../public/planet-hub-places.mjs";

const camel = (value) => value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName || "div").toUpperCase();
    this.ownerDocument = ownerDocument;
    this.dataset = {};
    this.attributes = new Map();
    this.children = [];
    this.listeners = new Map();
    this.style = { values: new Map(), setProperty: (name, value) => this.style.values.set(name, String(value)) };
    this.hidden = false;
    this.inert = false;
    this.disabled = false;
    this.value = "";
    this.textContent = "";
    this.parentElement = null;
    this.parentNode = null;
  }

  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      child.parentNode = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type, init = {}) {
    const event = {
      key: "",
      target: this,
      currentTarget: this,
      defaultPrevented: false,
      propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.propagationStopped = true; },
      ...init
    };
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  toggleAttribute(name, force) {
    if (force) this.attributes.set(name, "");
    else this.attributes.delete(name);
    if (name === "inert") this.inert = Boolean(force);
  }

  focus(options) {
    this.ownerDocument.activeElement = this;
    this.focusOptions = options;
  }

  querySelector(selector) {
    const data = /^\[data-([^\]]+)\]$/.exec(selector)?.[1];
    if (!data) return null;
    const key = camel(data);
    const pending = [...this.children];
    while (pending.length) {
      const child = pending.shift();
      if (key in child.dataset) return child;
      pending.push(...child.children);
    }
    return null;
  }
}

class FakeDocument {
  constructor() {
    this.activeElement = null;
    this.status = this.createElement("p");
  }
  createElement(tagName) { return new FakeElement(tagName, this); }
  getElementById(id) { return id === "homeOrbitStatus" ? this.status : null; }
  querySelector() { return null; }
}

const addData = (documentRef, tagName, key, parent) => {
  const element = documentRef.createElement(tagName);
  element.dataset[key] = "";
  parent?.append(element);
  return element;
};

function createPlacesFixture({ compact = false } = {}) {
  const documentRef = new FakeDocument();
  const orbitRoot = documentRef.createElement("section");
  const root = documentRef.createElement("div");
  orbitRoot.append(root);
  const toggle = addData(documentRef, "button", "planetHubPlacesToggle", orbitRoot);
  const scrim = addData(documentRef, "div", "planetHubPlacesScrim", orbitRoot);
  const panel = addData(documentRef, "aside", "planetHubPlaces", orbitRoot);
  const title = addData(documentRef, "h2", "planetHubPlacesTitle", panel);
  const close = addData(documentRef, "button", "planetHubPlacesClose", panel);
  const search = addData(documentRef, "input", "planetHubPlacesSearch", panel);
  const all = addData(documentRef, "button", "planetHubPlacesAll", panel);
  const context = addData(documentRef, "p", "planetHubPlacesContext", panel);
  const list = addData(documentRef, "ul", "planetHubPlacesList", panel);
  const empty = addData(documentRef, "p", "planetHubPlacesEmpty", panel);
  const mediaListeners = new Set();
  const windowRef = {
    matchMedia: () => ({
      matches: compact,
      addEventListener: (_type, listener) => mediaListeners.add(listener),
      removeEventListener: (_type, listener) => mediaListeners.delete(listener)
    })
  };
  const state = {
    renderer: "webgl",
    mode: "overview",
    phase: "ready",
    viewBand: "system",
    selectedPlaceId: "earth",
    visitedPlaceId: "earth",
    selectedBodyId: "earth",
    orbitBodyId: "earth"
  };
  const places = ["earth", "mercury", "venus", "moon", "mars", "jupiter", "saturn"].map((id) => ({
    id,
    label: id.slice(0, 1).toUpperCase() + id.slice(1),
    kind: id === "moon" ? "moon" : "planet",
    tier: "solar",
    bodyId: id,
    selectable: true,
    visitable: true,
    featured: id === "earth"
  }));
  const calls = [];
  const changes = [];
  let rendererSelected = "earth";
  let rendererVisited = "earth";
  const renderer = {
    getNavigationContext: () => ({
      id: "astronomy-solar",
      owner: "solar",
      label: "solar",
      selectedPlaceId: rendererSelected,
      visitedPlaceId: rendererVisited,
      places
    }),
    selectPlace: async (id) => {
      calls.push(["select", id]);
      rendererSelected = id;
      return { accepted: true, id };
    },
    captureNavigationState: async () => ({ pose: rendererVisited }),
    visitPlace: async (id) => {
      calls.push(["visit", id]);
      rendererSelected = rendererVisited = id;
      return { accepted: true, id };
    },
    restoreNavigationState: async (navigationState) => {
      calls.push(["restore", navigationState.pose]);
      rendererSelected = rendererVisited = navigationState.pose;
      return true;
    }
  };
  const controller = createPlanetHubPlacesController({
    root,
    orbitRoot,
    documentRef,
    windowRef,
    getHubState: () => state,
    getRenderer: () => renderer,
    onPlaceStateChange: (change) => {
      changes.push(change);
      if (change.selectedPlaceId) state.selectedPlaceId = change.selectedPlaceId;
      if (change.visitedPlaceId) state.visitedPlaceId = change.visitedPlaceId;
      if (change.bodyId) {
        state.selectedBodyId = change.bodyId;
        if (change.centered) state.orbitBodyId = change.bodyId;
      }
    }
  });
  return {
    controller,
    renderer,
    state,
    calls,
    changes,
    documentRef,
    root,
    orbitRoot,
    toggle,
    scrim,
    panel,
    title,
    close,
    search,
    all,
    context,
    list,
    empty,
    resize: (matches) => { for (const listener of mediaListeners) listener({ matches }); }
  };
}

test("Places offers Featured five, All, and scale-local search without moving the camera", async () => {
  const fixture = createPlacesFixture();
  assert.equal(fixture.title.textContent, "Solar System");
  assert.equal(fixture.list.children.length, 5);
  assert.match(fixture.context.textContent, /^Featured 5 of 7$/);

  fixture.all.dispatch("click");
  assert.equal(fixture.list.children.length, 7);
  assert.equal(fixture.all.getAttribute("aria-pressed"), "true");
  const earthThumbnail = fixture.list.children
    .find((item) => item.dataset.placeId === "earth")
    .children[0].children[0];
  assert.equal(earthThumbnail.dataset.sprite, "earth");
  assert.equal(earthThumbnail.style.values.get("--planet-hub-place-sprite-x"), `${3 / 9 * 100}%`);
  const saturnThumbnail = fixture.list.children
    .find((item) => item.dataset.placeId === "saturn")
    .children[0].children[0];
  assert.equal(saturnThumbnail.dataset.sprite, "saturn");
  assert.equal(saturnThumbnail.style.values.get("--planet-hub-place-sprite-x"), `${7 / 9 * 100}%`);

  fixture.search.value = "saturn";
  fixture.search.dispatch("input");
  assert.equal(fixture.list.children.length, 1);
  assert.equal(fixture.list.children[0].dataset.placeId, "saturn");

  fixture.search.value = "";
  fixture.search.dispatch("input");
  assert.equal(await fixture.controller.selectPlace("mars"), true);
  assert.deepEqual(fixture.calls.filter(([kind]) => kind === "select"), [["select", "mars"]]);
  assert.equal(fixture.calls.some(([kind]) => kind === "visit"), false,
    "Select updates chart selection without issuing a camera visit");
  assert.match(fixture.documentRef.status.textContent, /Mars selected/);
  fixture.controller.destroy();
});

test("Places accepts a Select click while pointer preview temporarily owns the scene phase", async () => {
  const fixture = createPlacesFixture();
  fixture.state.phase = "preview";
  assert.equal(await fixture.controller.selectPlace("mars"), true);
  assert.deepEqual(fixture.calls.filter(([kind]) => kind === "select"), [["select", "mars"]]);
  assert.equal(fixture.controller.snapshot().selectedPlaceId, "mars");
  fixture.controller.destroy();
});

test("Places records exact async camera poses and Back restores the prior pose and focus", async () => {
  const fixture = createPlacesFixture();
  assert.equal(await fixture.controller.visitPlace("mars"), true);
  assert.equal(await fixture.controller.visitPlace("jupiter"), true);
  assert.equal(fixture.controller.snapshot().navigationDepth, 2);
  assert.equal(fixture.controller.getBackContract(null).ariaLabel, "Back to Mars");

  assert.equal(await fixture.controller.back(), true);
  assert.deepEqual(fixture.calls.at(-1), ["restore", "mars"]);
  assert.equal(fixture.controller.snapshot().visitedPlaceId, "mars");
  assert.equal(fixture.controller.snapshot().navigationDepth, 1);
  assert.equal(fixture.documentRef.activeElement, fixture.toggle,
    "Back restores focus to the visible drawer trigger when the directory is closed");
  assert.equal(fixture.changes.at(-1).centered, true);
  assert.equal(fixture.changes.at(-1).bodyId, "mars");
  fixture.controller.destroy();
});

for (const compact of [false, true]) {
  test(`${compact ? "phone" : "desktop"} Places starts closed, restores focus, and closes after Visit`, async () => {
    const fixture = createPlacesFixture({ compact });
    assert.equal(fixture.controller.snapshot().open, false);
    assert.equal(fixture.panel.hidden, true);
    assert.equal(fixture.panel.inert, true);
    assert.equal(fixture.toggle.hidden, false);
    assert.equal(fixture.toggle.getAttribute("aria-expanded"), "false");

    fixture.toggle.dispatch("click");
    assert.equal(fixture.panel.hidden, false);
    assert.equal(fixture.panel.inert, false);
    assert.equal(fixture.toggle.getAttribute("aria-expanded"), "true");
    assert.equal(fixture.documentRef.activeElement, fixture.search);
    assert.equal(await fixture.controller.visitPlace("mars"), true);
    assert.equal(fixture.panel.hidden, true);
    assert.equal(fixture.documentRef.activeElement, fixture.toggle);
    fixture.controller.destroy();
  });
}

test("Places keeps the player's drawer choice across viewport changes", () => {
  const fixture = createPlacesFixture();
  fixture.resize(true);
  fixture.resize(false);
  assert.equal(fixture.controller.snapshot().open, false);
  assert.equal(fixture.panel.hidden, true);
  fixture.toggle.dispatch("click");
  fixture.resize(true);
  fixture.resize(false);
  assert.equal(fixture.controller.snapshot().open, true);
  assert.equal(fixture.panel.hidden, false);
  fixture.controller.destroy();
});

test("Places Escape, close, and scrim all restore focus without navigating", () => {
  const fixture = createPlacesFixture();
  for (const dismiss of [
    () => assert.equal(fixture.controller.handleEscape(), true),
    () => fixture.close.dispatch("click"),
    () => fixture.scrim.dispatch("click")
  ]) {
    fixture.toggle.dispatch("click");
    assert.equal(fixture.panel.hidden, false);
    dismiss();
    assert.equal(fixture.panel.hidden, true);
    assert.equal(fixture.documentRef.activeElement, fixture.toggle);
  }
  assert.equal(fixture.controller.handleEscape(), false);
  assert.deepEqual(fixture.calls, []);
  fixture.controller.destroy();
});


test("Escape clears a retained search without focusing the closed drawer", () => {
  const fixture = createPlacesFixture();
  fixture.toggle.dispatch("click");
  fixture.search.value = "Mars";
  fixture.search.dispatch("input");
  fixture.close.dispatch("click");
  assert.equal(fixture.panel.hidden, true);
  assert.equal(fixture.controller.handleEscape(), true);
  assert.equal(fixture.search.value, "");
  assert.equal(fixture.documentRef.activeElement, fixture.toggle);
  assert.equal(fixture.panel.hidden, true);
  fixture.controller.destroy();
});
