import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  conceptBondCurve,
  conceptBondFallbackEndpoint,
  conceptBondGuideState,
  createConceptBondRuntime,
  conceptBondWordKey
} from "../public/concept-bond-runtime.mjs";

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }

  add(...names) {
    for (const name of names) this.values.add(name);
  }

  remove(...names) {
    for (const name of names) this.values.delete(name);
  }

  contains(name) {
    return this.values.has(name);
  }

  replaceFrom(value) {
    this.values = new Set(String(value || "").split(/\s+/).filter(Boolean));
  }
}

class FakeElement {
  constructor(ownerDocument, { id = "", classes = [], rect = null } = {}) {
    this.ownerDocument = ownerDocument;
    this.id = id;
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.classList = new FakeClassList(this);
    this.classList.add(...classes);
    this.rect = rect || { left: 0, top: 0, width: 0, height: 0 };
  }

  append(...children) {
    this.children.push(...children);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "class") this.classList.replaceFrom(value);
    if (name === "id") this.id = String(value);
    if (name === "hidden") this.hidden = true;
  }

  getAttribute(name) {
    if (name === "id") return this.id || null;
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === "hidden") this.hidden = false;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  toggleAttribute(name, force) {
    const enabled = force === undefined ? !this.hasAttribute(name) : Boolean(force);
    if (enabled) this.setAttribute(name, "");
    else this.removeAttribute(name);
    return enabled;
  }

  getBoundingClientRect() {
    return this.rect;
  }

  matches(selector) {
    if (selector.startsWith("#")) return this.id === selector.slice(1);
    const classes = [...selector.matchAll(/[.]([a-z0-9_-]+)/gi)].map((match) => match[1]);
    return classes.length > 0 && classes.every((name) => this.classList.contains(name));
  }

  querySelectorAll(selector) {
    const selectors = selector.split(",").map((part) => part.trim());
    const result = [];
    const visit = (element) => {
      for (const child of element.children) {
        if (selectors.some((part) => child.matches(part))) result.push(child);
        visit(child);
      }
    };
    visit(this);
    return result;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

function fakeChemistryBoard() {
  const ownerDocument = {
    createElementNS() {
      return new FakeElement(ownerDocument);
    }
  };
  const board = new FakeElement(ownerDocument, { rect: { left: 0, top: 0, width: 800, height: 500 } });
  const layer = new FakeElement(ownerDocument, { id: "conceptBondLayer" });
  layer.hidden = true;
  const status = new FakeElement(ownerDocument, { id: "conceptChemistryStatus" });
  const word = (name, left, top, zIndex = 1) => {
    const element = new FakeElement(ownerDocument, {
      classes: ["board-word"],
      rect: { left, top, width: 100, height: 44 }
    });
    element.dataset.word = name;
    element.style.zIndex = String(zIndex);
    board.append(element);
    return element;
  };
  board.append(layer);
  return {
    board,
    layer,
    status,
    mud: word("Mud", 120, 160, 3),
    fire: word("Fire", 410, 250, 4),
    air: word("Air", 590, 250, 2)
  };
}

test("Concept Bond normalizes words and makes a bounded chemistry curve", () => {
  assert.equal(conceptBondWordKey({ word: "  LAVA  " }), "lava");
  const path = conceptBondCurve({ x: 20, y: 30 }, { x: 180, y: 120 });
  assert.match(path, /^M 20\.0 30\.0 C /);
  assert.match(path, /180\.0 120\.0$/);
});

test("Concept Bond fallback endpoint stays inside the playable board", () => {
  assert.deepEqual(
    conceptBondFallbackEndpoint({ from: { x: 20, y: 12 }, width: 320, height: 220, distance: 999 }),
    { x: 116, y: 72 }
  );
  const right = conceptBondFallbackEndpoint({ from: { x: 290, y: 205 }, width: 320, height: 220 });
  assert.ok(right.x >= 62 && right.x <= 258);
  assert.ok(right.y >= 72 && right.y <= 148);
});

test("guide state derives reagent phase while retaining the waiting backbone", () => {
  const guide = conceptBondGuideState({
    activeWord: "Fire",
    requiredPartner: "Air",
    expectedProduct: "Energy",
    backboneWord: "Mud",
    backboneRequiredPartner: "Energy",
    backboneProduct: "Life",
    detour: { active: true, target: "Energy" },
    allowedPair: { classification: "reagent" }
  });
  assert.deepEqual(
    {
      phase: guide.phase,
      detourActive: guide.detourActive,
      activeWord: guide.activeWord,
      requiredPartner: guide.requiredPartner,
      backboneWord: guide.backboneWord,
      backboneRequiredPartner: guide.backboneRequiredPartner,
      backboneProduct: guide.backboneProduct
    },
    {
      phase: "reagent",
      detourActive: true,
      activeWord: "Fire",
      requiredPartner: "Air",
      backboneWord: "Mud",
      backboneRequiredPartner: "Energy",
      backboneProduct: "Life"
    }
  );
});

test("detours render an active reagent bond without dropping the waiting backbone", () => {
  const { board, layer, status, mud, fire, air } = fakeChemistryBoard();
  let statusText = "";
  let statusWrites = 0;
  Object.defineProperty(status, "textContent", {
    configurable: true,
    get: () => statusText,
    set: (value) => {
      statusWrites += 1;
      statusText = String(value);
    }
  });
  let guide = {
    activeWord: "Fire",
    requiredPartner: "Air",
    expectedProduct: "Energy",
    backboneWord: "Mud",
    backboneRequiredPartner: "Energy",
    backboneProduct: "Life",
    detour: { active: true, target: "Energy" },
    allowedPair: { classification: "reagent" }
  };
  const runtime = createConceptBondRuntime({
    board,
    layer,
    status,
    getSnapshot: () => guide,
    viewWindow: {
      addEventListener() {},
      removeEventListener() {},
      setTimeout() { return 0; }
    }
  });

  const detour = runtime.sync();
  assert.equal(detour.phase, "reagent");
  assert.equal(detour.detourActive, true);
  assert.equal(layer.dataset.phase, "reagent");
  assert.equal(layer.hidden, false);
  assert.equal(layer.querySelector(".concept-bond__path").hidden, false);
  assert.equal(layer.querySelector(".concept-bond__waiting-path").hidden, false);
  assert.match(layer.querySelector(".concept-bond__path").getAttribute("d"), /^M /);
  assert.match(layer.querySelector(".concept-bond__waiting-path").getAttribute("d"), /^M /);
  assert.equal(layer.querySelector(".concept-bond__endpoint-label").textContent, "Air");
  assert.equal(layer.querySelector(".concept-bond__waiting-label").textContent, "Energy");
  assert.equal(mud.dataset.conceptRole, "backbone-waiting");
  assert.equal(mud.classList.contains("concept-backbone-waiting"), true);
  assert.equal(fire.dataset.conceptRole, "reagent-source");
  assert.equal(fire.classList.contains("concept-detour-active"), true);
  assert.equal(air.dataset.conceptRole, "reagent");
  assert.match(status.textContent, /Mud is waiting for Energy/);
  assert.match(status.textContent, /Fire with Air/);
  runtime.sync();
  assert.equal(statusWrites, 1, "geometry-only syncs must not reannounce an unchanged bond instruction");

  guide = {
    activeWord: "Mud",
    requiredPartner: "Energy",
    expectedProduct: "Life",
    backboneWord: "Mud",
    backboneRequiredPartner: "Energy",
    backboneProduct: "Life",
    detour: { active: false },
    allowedPair: { classification: "backbone" }
  };
  runtime.sync();
  assert.equal(layer.dataset.phase, "backbone");
  assert.equal(layer.querySelector(".concept-bond__waiting-path").hidden, true);
  assert.equal(mud.dataset.conceptRole, "backbone");
  assert.equal(mud.classList.contains("concept-backbone-waiting"), false);
  assert.equal(fire.classList.contains("concept-detour-active"), false);
  runtime.destroy();
});

test("play document owns one noninteractive Concept Bond layer and accessible status", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/concept-chemistry.css", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="conceptBondLayer"[^>]+aria-hidden="true"[^>]+hidden/);
  assert.match(html, /id="conceptChemistryStatus"[^>]+role="status"/);
  assert.match(css, /\.concept-bond-layer[\s\S]*pointer-events:\s*none/);
  assert.match(css, /[.]concept-bond__waiting-path/);
  assert.match(css, /data-phase="reagent"/);
  assert.match(css, /[.]board-word[.]concept-backbone-waiting/);
  assert.match(css, /[.]board-word[.]concept-detour-active/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
});
