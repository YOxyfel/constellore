import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  MOLECULAR_MEMORY_HOVER_EXPAND_MS,
  MOLECULAR_MEMORY_HOVER_PREVIEW_MS,
  MOLECULAR_MEMORY_STYLESHEET,
  buildMolecularMemoryModel,
  createMolecularMemory,
  molecularMemorySymbol,
  normalizeMolecularMemoryHistory,
  projectMolecularMemoryGlyph,
  renderMolecularMemoryGlyph
} from "../public/molecular-memory.mjs";
import { createConceptReactionHistory } from "../public/concept-chemistry.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

class FakeStyle {
  values = new Map();

  setProperty(name, value) {
    this.values.set(name, String(value));
  }

  getPropertyValue(name) {
    return this.values.get(name) || "";
  }
}

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
  }

  values() {
    return new Set(String(this.owner.className || "").split(/\s+/u).filter(Boolean));
  }

  contains(name) {
    return this.values().has(name);
  }

  toggle(name, force) {
    const values = this.values();
    const present = force === undefined ? !values.has(name) : Boolean(force);
    if (present) values.add(name);
    else values.delete(name);
    this.owner.className = [...values].join(" ");
    return present;
  }
}

function dataProperty(name) {
  return name.slice(5).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = "";
    this.classList = new FakeClassList(this);
    this.style = new FakeStyle();
    this.textContent = "";
    this.hidden = false;
    this.offsetWidth = 320;
    this.offsetHeight = 280;
    this.dataset = new Proxy({}, {
      set: (target, property, value) => {
        const normalized = String(value);
        target[property] = normalized;
        const suffix = String(property).replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
        this.attributes.set(`data-${suffix}`, normalized);
        return true;
      },
      deleteProperty: (target, property) => {
        delete target[property];
        const suffix = String(property).replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
        this.attributes.delete(`data-${suffix}`);
        return true;
      }
    });
  }

  append(...children) {
    for (const child of children.flat()) {
      if (!child) continue;
      child.remove?.();
      child.parentElement = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this.append(...children);
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  contains(candidate) {
    if (candidate === this) return true;
    return this.children.some((child) => child.contains?.(candidate));
  }

  setAttribute(name, value) {
    const normalized = String(value);
    this.attributes.set(name, normalized);
    if (name === "class") this.className = normalized;
    if (name.startsWith("data-")) this.dataset[dataProperty(name)] = normalized;
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name.startsWith("data-")) delete this.dataset[dataProperty(name)];
  }

  addEventListener(type, listener) {
    const values = this.listeners.get(type) || [];
    values.push(listener);
    this.listeners.set(type, values);
  }

  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((candidate) => candidate !== listener));
  }

  dispatch(type, init = {}) {
    const event = {
      type,
      target: this,
      currentTarget: this,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.propagationStopped = true; },
      ...init
    };
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }

  matches(selector) {
    if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
    if (selector.startsWith("#")) return this.getAttribute("id") === selector.slice(1);
    const attribute = selector.match(/^\[([a-z0-9-]+)(?:="([^"]*)")?\]$/iu);
    if (attribute) {
      return this.hasAttribute(attribute[1]) && (attribute[2] === undefined || this.getAttribute(attribute[1]) === attribute[2]);
    }
    return this.tagName === selector.toUpperCase();
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches?.(selector)) return child;
      const nested = child.querySelector?.(selector);
      if (nested) return nested;
    }
    return null;
  }

  querySelectorAll(selector) {
    const matches = [];
    for (const child of this.children) {
      if (child.matches?.(selector)) matches.push(child);
      matches.push(...(child.querySelectorAll?.(selector) || []));
    }
    return matches;
  }

  getBoundingClientRect() {
    return { left: 120, top: 80, right: 220, bottom: 124, width: 100, height: 44 };
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }
}

class FakeView {
  constructor() {
    this.innerWidth = 900;
    this.innerHeight = 700;
    this.listeners = new Map();
    this.nextTimer = 1;
    this.timers = new Map();
  }

  setTimeout(callback) {
    const id = this.nextTimer++;
    this.timers.set(id, callback);
    return id;
  }

  clearTimeout(id) {
    this.timers.delete(id);
  }

  addEventListener(type, listener) {
    const values = this.listeners.get(type) || [];
    values.push(listener);
    this.listeners.set(type, values);
  }

  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((candidate) => candidate !== listener));
  }
}

class FakeDocument {
  constructor() {
    this.defaultView = new FakeView();
    this.body = new FakeElement("body", this);
    this.activeElement = null;
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  createElementNS(_namespace, tagName) {
    return new FakeElement(tagName, this);
  }
}

function descendants(root) {
  return root.children.flatMap((child) => [child, ...descendants(child)]);
}

const branchedHistory = [
  { id: "mud", recipeId: "earth-water", inputs: ["Earth", "Water"], output: "Mud", role: "backbone" },
  { id: "energy", recipeId: "fire-air", inputs: ["Fire", "Air"], output: "Energy", role: "reagent" },
  { id: "clay", recipeId: "mud-energy", inputs: ["Mud", "Energy"], output: "Clay" },
  { id: "brick", recipeId: "clay-fire", inputs: ["Clay", "Fire"], output: "Brick", routeForward: true }
];

test("performed provenance normalizes common recipe shapes without admitting future steps", () => {
  const normalized = normalizeMolecularMemoryHistory([
    { id: "mud", a: "Earth", b: "Water", word: "Mud" },
    { id: "brick", ingredients: ["Mud", "Fire"], result: { word: "Brick", id: "brick-node" } },
    { id: "future", inputs: ["Brick", "Brick"], output: "House", predicted: true }
  ]);

  assert.equal(normalized.length, 2);
  assert.deepEqual(normalized[0].inputs.map(({ word }) => word), ["Earth", "Water"]);
  assert.equal(normalized[1].inputs[0].sourceReactionId, "mud");
  assert.equal(normalized[1].inputs[0].sourceOutputId, "mud:output");
  assert.equal(normalized[1].output.id, "brick-node");
  assert.equal(Object.isFrozen(normalized[1].inputs[0]), true);
});

test("the renderer accepts the concept-chemistry reaction ledger without an adapter", () => {
  const ledger = createConceptReactionHistory([
    { id: "mud", a: "Earth", b: "Water", word: "Mud", outputInstanceId: "mud-1" },
    { id: "brick", a: "Mud", b: "Fire", word: "Brick", outputInstanceId: "brick-1" }
  ]);
  const normalized = normalizeMolecularMemoryHistory(ledger);
  const model = buildMolecularMemoryModel({ word: "Brick", history: ledger });

  assert.equal(normalized.length, 2);
  assert.equal(normalized[1].inputs[0].sourceReactionId, "mud");
  assert.equal(normalized[1].output.id, "brick-1");
  assert.deepEqual(model.recipeLedger[0].steps.map(({ reactionId }) => reactionId), ["mud", "brick"]);
});

test("a compact glyph uses a backbone and collapsed functional groups while preserving every exact recipe", () => {
  const source = structuredClone(branchedHistory);
  const first = buildMolecularMemoryModel({ word: "Brick", history: source });
  source[0].inputs[0] = "Changed later";
  const second = buildMolecularMemoryModel({ word: "Brick", history: branchedHistory });
  const glyph = projectMolecularMemoryGlyph(first, { maxBackbone: 3, maxVisibleGroups: 4 });
  const again = projectMolecularMemoryGlyph(second, { maxBackbone: 3, maxVisibleGroups: 4 });

  assert.deepEqual(glyph, again, "the same provenance produces byte-stable projected data");
  assert.equal(first.recipeLedger[0].steps[0].equation, "Earth + Water → Mud");
  assert.deepEqual(first.recipeLedger[0].steps[2].inputs.map(({ word }) => word), ["Mud", "Energy"]);
  assert.deepEqual(glyph.coverage.missing, []);
  assert.deepEqual(new Set(glyph.coverage.represented), new Set(["mud", "energy", "clay", "brick"]));
  assert.ok(glyph.backboneNodes.length <= 4, "the compact formula is bounded instead of becoming a tree");
  const energyGroup = glyph.functionalGroups.find(({ word }) => word === "Energy");
  assert.ok(energyGroup?.collapsed, "independently synthesized Energy becomes a functional group");
  assert.deepEqual(energyGroup.reactionIds, ["energy"]);
  assert.equal(energyGroup.steps[0].inputs[0].word, "Fire", "collapsed groups retain the exact hidden recipe");
  assert.equal(Object.isFrozen(glyph.recipeLedger[0].inputs[0]), true);
});

test("alternate target derivations become selectable isomers, including different transitive ancestry", () => {
  const model = buildMolecularMemoryModel({
    word: "Brick",
    history: [
      { id: "mud", a: "Earth", b: "Water", word: "Mud" },
      { id: "lava", a: "Earth", b: "Fire", word: "Lava" },
      { id: "fired-brick", a: "Mud", b: "Fire", word: "Brick" },
      { id: "air-brick", a: "Lava", b: "Air", word: "Brick" }
    ]
  });

  assert.equal(model.isomerCount, 2);
  assert.equal(model.alternateCount, 1);
  assert.notEqual(model.isomers[0].signature, model.isomers[1].signature);
  assert.deepEqual(model.isomers[0].reactionIds, ["mud", "fired-brick"]);
  assert.deepEqual(model.isomers[1].reactionIds, ["lava", "air-brick"]);
  assert.equal(model.activeIsomerId, model.isomers[1].id, "the most recently performed isomer is active by default");

  const firstGlyph = projectMolecularMemoryGlyph(model, { isomerId: model.isomers[0].id });
  const secondGlyph = projectMolecularMemoryGlyph(model, { isomerId: model.isomers[1].id });
  assert.equal(firstGlyph.equation, "Mud + Fire → Brick");
  assert.equal(secondGlyph.equation, "Lava + Air → Brick");
  assert.notEqual(firstGlyph.signature, secondGlyph.signature);
});

test("a selected concept instance keeps its own derivation when a newer isomer exists", () => {
  const ledger = createConceptReactionHistory([
    { id: "mud", a: "Earth", b: "Water", word: "Mud", outputInstanceId: "mud-1" },
    { id: "fired-brick", a: "Mud", b: "Fire", word: "Brick", outputInstanceId: "brick-fired" },
    { id: "lava", a: "Earth", b: "Fire", word: "Lava", outputInstanceId: "lava-1" },
    { id: "air-brick", a: "Lava", b: "Air", word: "Brick", outputInstanceId: "brick-air" }
  ]);
  const fired = buildMolecularMemoryModel({ word: "Brick", instanceId: "brick-fired", history: ledger });
  const air = buildMolecularMemoryModel({ word: "Brick", instanceId: "brick-air", history: ledger });

  assert.equal(fired.isomerCount, 2);
  assert.equal(fired.selectedInstanceId, "brick-fired");
  assert.equal(fired.isomers.find(({ id }) => id === fired.activeIsomerId).equation, "Mud + Fire → Brick");
  assert.equal(air.isomers.find(({ id }) => id === air.activeIsomerId).equation, "Lava + Air → Brick");
});

test("commutative input order remains one recipe while its performed order stays exact", () => {
  const model = buildMolecularMemoryModel({
    word: "Mud",
    history: [
      { id: "left-first", a: "Earth", b: "Water", word: "Mud" },
      { id: "right-first", a: "Water", b: "Earth", word: "Mud" }
    ]
  });

  assert.equal(model.isomerCount, 1, "drag direction alone must not invent an isomer");
  assert.deepEqual(
    model.recipeLedger[0].steps[0].inputs.map(({ word }) => word),
    ["Water", "Earth"],
    "the latest retained performance still preserves its exact input order"
  );
});

test("symbols and SVG output are compact, deterministic, code-native, and provenance-addressable", () => {
  assert.equal(molecularMemorySymbol("Earth"), "Ea");
  assert.equal(molecularMemorySymbol("Black Hole"), "BH");
  assert.equal(molecularMemorySymbol("✨"), "?");

  const documentRef = new FakeDocument();
  const glyph = projectMolecularMemoryGlyph(buildMolecularMemoryModel({ word: "Brick", history: branchedHistory }));
  const svg = renderMolecularMemoryGlyph(documentRef, glyph);
  const nodes = descendants(svg);
  assert.equal(svg.tagName, "SVG");
  assert.equal(svg.getAttribute("aria-hidden"), "true");
  assert.equal(svg.getAttribute("data-mm-signature"), glyph.signature);
  assert.ok(nodes.some((node) => node.getAttribute("data-mm-reaction-id") === "brick"));
  assert.ok(nodes.some((node) => (node.getAttribute("data-mm-reaction-ids") || "").includes("energy")));
  assert.equal(nodes.some(({ tagName }) => ["IMG", "CANVAS"].includes(tagName)), false);
});

test("the DOM controller keeps board buttons valid and exposes a keyboard-accessible exact ledger", () => {
  const documentRef = new FakeDocument();
  const host = documentRef.createElement("button");
  host.setAttribute("aria-describedby", "existing-help");
  host.setAttribute("aria-pressed", "false");
  documentRef.body.append(host);
  const memory = createMolecularMemory({
    document: documentRef,
    view: documentRef.defaultView,
    id: "brick-memory",
    word: "Brick",
    history: [
      ...branchedHistory,
      { id: "alternate", a: "Lava", b: "Air", word: "Brick" }
    ]
  }).attach(host);

  assert.equal(memory.root.parentElement, host, "only the inert glyph is nested in the board button");
  assert.equal(memory.descriptor.parentElement, host, "the accessible description is outside the aria-hidden glyph");
  assert.equal(memory.root.getAttribute("aria-hidden"), "true");
  assert.equal(descendants(memory.root).some(({ tagName }) => tagName === "BUTTON"), false);
  assert.equal(memory.panel.parentElement, documentRef.body, "interactive controls live outside the board button");
  assert.equal(memory.panel.getAttribute("role"), "dialog");
  assert.equal(memory.panel.hidden, true);
  assert.equal(host.getAttribute("aria-describedby"), "existing-help brick-memory-description");
  assert.equal(host.getAttribute("aria-controls"), "brick-memory-panel");
  assert.equal(host.getAttribute("aria-haspopup"), "dialog");
  assert.equal(host.getAttribute("aria-keyshortcuts"), "Alt+ArrowDown");
  assert.equal((documentRef.defaultView.listeners.get("resize") || []).length, 0, "closed words own no global geometry listeners");

  const keyboardOpen = host.dispatch("keydown", { key: "ArrowDown", altKey: true });
  assert.equal(keyboardOpen.defaultPrevented, true);
  assert.equal(memory.panel.hidden, false);
  assert.equal(memory.snapshot().pinned, true);
  assert.equal(host.getAttribute("aria-expanded"), "true");
  assert.equal(documentRef.activeElement, memory.panel);
  assert.equal((documentRef.defaultView.listeners.get("resize") || []).length, 1, "position listeners exist only for an open portal");
  const ledger = memory.panel.querySelector(".molecular-memory__recipe-ledger");
  assert.ok(ledger);
  assert.equal(ledger.getAttribute("aria-label").includes("exact reaction history"), true);
  assert.equal(ledger.children.length, memory.glyph.recipeLedger.length);
  assert.equal(
    memory.panel.querySelector(".molecular-memory__integrity").textContent,
    "The recorded reaction is preserved in this structure."
  );

  const firstIsomer = memory.model.isomers[0];
  assert.equal(memory.selectIsomer(firstIsomer.id), true);
  assert.equal(memory.activeIsomerId, firstIsomer.id);
  assert.equal(memory.root.querySelector("svg").getAttribute("data-mm-isomer-id"), firstIsomer.id);

  memory.setExpanded(false);
  assert.equal(documentRef.activeElement, host, "external closure restores focus when the portal owned it");
  assert.equal((documentRef.defaultView.listeners.get("resize") || []).length, 0);

  memory.detach();
  assert.equal(memory.root.parentElement, null);
  assert.equal(memory.descriptor.parentElement, null);
  assert.equal(memory.panel.parentElement, null);
  assert.equal(host.getAttribute("aria-describedby"), "existing-help");
  assert.equal(host.getAttribute("aria-pressed"), "false", "unrelated board semantics remain untouched");
  assert.equal(host.getAttribute("aria-controls"), null);
  assert.equal(host.getAttribute("aria-keyshortcuts"), null);
});

test("presentation defaults and stylesheet stay isolated, responsive, and accessible", async () => {
  assert.equal(MOLECULAR_MEMORY_HOVER_PREVIEW_MS, 600);
  assert.equal(MOLECULAR_MEMORY_HOVER_EXPAND_MS, 1_100);
  assert.equal(
    new URL(MOLECULAR_MEMORY_STYLESHEET, "https://constellore.invalid").pathname,
    "/molecular-memory.css",
    "release cache-busting may version the isolated stylesheet without changing its asset contract"
  );
  const [styles, source] = await Promise.all([
    readFile(path.join(projectRoot, "public", "molecular-memory.css"), "utf8"),
    readFile(path.join(projectRoot, "public", "molecular-memory.mjs"), "utf8")
  ]);
  assert.match(styles, /[.]molecular-memory__panel\s*\{/u);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(styles, /@media \(forced-colors: active\)/u);
  assert.match(styles, /100dvh/u);
  assert.match(styles, /[.]molecular-memory__close\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/su);
  assert.match(styles, /[.]molecular-memory__isomer\s*\{[^}]*min-height:\s*44px/su);
  assert.doesNotMatch(styles, /(?:^|[\s,])(?:body|[.]board-word|[.]constellation-bloom)(?:[\s:{.#]|$)/mu);
  assert.doesNotMatch(source, /\b(?:fetch|localStorage|sessionStorage|WebSocket)\s*[.(]/u);
  assert.doesNotMatch(source, /innerHTML\s*=/u);
});
