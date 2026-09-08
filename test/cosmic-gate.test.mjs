import test from "node:test";
import assert from "node:assert/strict";
import { COSMIC_GATE_TIMINGS, createCosmicGate } from "../public/cosmic-gate.mjs";

const FAST_TIMINGS = Object.freeze(Object.fromEntries(
  Object.keys(COSMIC_GATE_TIMINGS).map((key) => [key, 0])
));

const TEST_QUOTE = Object.freeze({
  id: "test-canvas",
  text: "The world is waiting for the shape only you can give it.",
  author: "Constellore"
});

test("the constellation fold keeps milestone quotes but makes routine entry immediate", () => {
  assert.ok(COSMIC_GATE_TIMINGS.introQuoteHold >= 2000);
  assert.ok(COSMIC_GATE_TIMINGS.enterQuoteHold <= 150);
  assert.ok(COSMIC_GATE_TIMINGS.enterClose + COSMIC_GATE_TIMINGS.enterQuoteHold + COSMIC_GATE_TIMINGS.enterOpen <= 1300);
  assert.ok(COSMIC_GATE_TIMINGS.introOpen > COSMIC_GATE_TIMINGS.doorOpen);
  assert.ok(COSMIC_GATE_TIMINGS.enterOpen >= 400);
  assert.ok(COSMIC_GATE_TIMINGS.dialogOpen <= 200);
  assert.ok(COSMIC_GATE_TIMINGS.dialogArrive <= 350);
  assert.ok(COSMIC_GATE_TIMINGS.firstDiscoveryHold >= COSMIC_GATE_TIMINGS.dialogClose);
  assert.ok(COSMIC_GATE_TIMINGS.firstDiscoveryHold <= 1200);
  assert.ok(COSMIC_GATE_TIMINGS.firstDiscoveryReducedHold <= 300);
});

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name),
    toggle(name, force) {
      const enabled = force ?? !values.has(name);
      if (enabled) values.add(name);
      else values.delete(name);
      return enabled;
    }
  };
}

function createTransitionNode() {
  const listeners = new Map();
  return {
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) {
      listeners.get(type)?.delete(callback);
    },
    dispatch(type, propertyName = "transform") {
      for (const callback of listeners.get(type) || []) {
        callback({ target: this, propertyName });
      }
    }
  };
}

function createRoot({ celebration = false, veil = null } = {}) {
  const labels = new Map([
    [".cosmic-gate__eyebrow", { textContent: "" }],
    [".cosmic-gate__label", { textContent: "" }],
    [".cosmic-gate__copy", { textContent: "" }]
  ]);
  const createElement = () => ({
    className: "",
    dataset: {},
    attributes: new Map(),
    children: [],
    style: {
      values: new Map(),
      setProperty(name, value) { this.values.set(name, value); }
    },
    setAttribute(name, value) { this.attributes.set(name, value); },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = [...children]; },
    textContent: ""
  });
  const ownerDocument = { createElement };
  const field = createElement();
  field.ownerDocument = ownerDocument;
  const title = createElement();
  title.ownerDocument = ownerDocument;
  const layer = celebration ? {
    activationCount: 0,
    querySelector(selector) {
      if (selector === ".cosmic-gate__confetti") return field;
      if (selector === ".cosmic-gate__first-discovery-title strong") return title;
      return null;
    }
  } : null;
  if (layer) {
    let hidden = true;
    Object.defineProperty(layer, "hidden", {
      get() { return hidden; },
      set(value) {
        hidden = Boolean(value);
        if (!hidden) this.activationCount += 1;
      }
    });
  }
  return {
    hidden: true,
    dataset: {},
    attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); },
    querySelector(selector) {
      if (selector === ".cosmic-gate__first-discovery") return layer;
      if (selector === ".cosmic-gate__veil") return veil;
      return labels.get(selector) || null;
    },
    labels,
    veil,
    celebrationLayer: layer,
    celebrationField: field,
    celebrationTitle: title
  };
}

function createDialog({ onShow = null } = {}) {
  const focusTarget = { focused: false, focus() { this.focused = true; } };
  return {
    open: false,
    dataset: {},
    classList: createClassList(),
    showModal() {
      onShow?.();
      this.open = true;
    },
    close() { this.open = false; },
    querySelector(selector) { return selector === ".primary-action" ? focusTarget : null; },
    focusTarget
  };
}

function createSurface({ inert = false, inertAttribute = null } = {}) {
  const attributes = new Map();
  if (inertAttribute !== null) attributes.set("inert", inertAttribute);
  return {
    inert,
    setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
    hasAttribute(name) { return attributes.has(name); },
    removeAttribute(name) { attributes.delete(name); }
  };
}

test("launch gate reveals the app once and cleans its blocking state", async () => {
  const originalDocument = globalThis.document;
  const originalAnimationFrame = globalThis.requestAnimationFrame;
  const body = { classList: createClassList(["cosmic-intro-pending"]) };
  globalThis.document = { body, querySelector: () => null };
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  try {
    const root = createRoot();
    const gate = createCosmicGate({
      root,
      reducedMotion: true,
      timings: FAST_TIMINGS,
      quoteSelector: () => TEST_QUOTE
    });
    assert.equal(await gate.playIntro(), true);
    assert.equal(root.hidden, true);
    assert.equal(root.dataset.played, "true");
    assert.equal(root.dataset.phase, "idle");
    assert.equal(body.classList.contains("cosmic-intro-pending"), false);
    assert.equal(body.classList.contains("transition-active"), false);
    assert.equal(root.attributes.get("aria-hidden"), "true");
    assert.equal(root.dataset.quoteId, TEST_QUOTE.id);
    assert.equal(root.labels.get(".cosmic-gate__label").textContent, `“${TEST_QUOTE.text}”`);
    assert.equal(root.labels.get(".cosmic-gate__eyebrow").textContent, "CONSTELLORE");
    assert.equal(root.labels.get(".cosmic-gate__eyebrow").hidden, false);
    assert.equal(root.labels.get(".cosmic-gate__copy").textContent, "— Constellore");
    assert.equal(root.labels.get(".cosmic-gate__copy").hidden, false);
    assert.equal(await gate.playIntro(), false);
  } finally {
    globalThis.document = originalDocument;
    globalThis.requestAnimationFrame = originalAnimationFrame;
  }
});

test("the mandatory first game can dismiss the launch gate synchronously", () => {
  const originalDocument = globalThis.document;
  const body = { classList: createClassList(["cosmic-intro-pending"]) };
  globalThis.document = { body, querySelector: () => null };
  try {
    const root = createRoot();
    root.hidden = false;
    const gate = createCosmicGate({ root });
    assert.equal(gate.skipIntro(), true);
    assert.equal(root.hidden, true);
    assert.equal(root.dataset.played, "true");
    assert.equal(root.dataset.phase, "idle");
    assert.equal(root.attributes.get("aria-hidden"), "true");
    assert.equal(body.classList.contains("cosmic-intro-pending"), false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test("the constellation fold covers Home, swaps while opaque, then resolves onto the board", async () => {
  const originalDocument = globalThis.document;
  const originalAnimationFrame = globalThis.requestAnimationFrame;
  const body = { classList: createClassList() };
  globalThis.document = { body, querySelector: () => null };
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  try {
    const root = createRoot();
    const menu = createSurface();
    const board = createSurface({ inert: true, inertAttribute: "" });
    const transitions = [];
    const gate = createCosmicGate({
      root,
      reducedMotion: true,
      timings: FAST_TIMINGS,
      quoteSelector: () => TEST_QUOTE,
      onTransition: (cue, detail) => transitions.push([cue, detail]),
      surfaces: [menu, board]
    });
    const phases = [];
    const swapped = await gate.enterBoard(() => {
      phases.push(root.dataset.phase);
      assert.equal(root.hidden, false);
      assert.equal(body.classList.contains("transition-active"), true);
      assert.equal(menu.inert, true);
      assert.equal(menu.hasAttribute("inert"), true);
      assert.equal(board.inert, true);
      assert.equal(board.hasAttribute("inert"), true);
    }, {
      label: "Find Telescope.",
      afterOpen: () => {
        phases.push(root.dataset.phase);
        assert.equal(root.hidden, false);
        assert.equal(body.classList.contains("transition-active"), true);
        assert.equal(menu.inert, true);
        assert.equal(board.inert, true);
      }
    });

    assert.equal(swapped, true);
    assert.deepEqual(phases, ["closed", "opening"]);
    assert.equal(root.labels.get(".cosmic-gate__eyebrow").textContent, "WORLDWEAVE");
    assert.equal(root.labels.get(".cosmic-gate__eyebrow").hidden, false);
    assert.equal(root.labels.get(".cosmic-gate__label").textContent, "Reality is drawing near");
    assert.equal(root.labels.get(".cosmic-gate__copy").textContent, "Find Telescope.");
    assert.equal(root.labels.get(".cosmic-gate__copy").hidden, false);
    assert.equal(root.hidden, true);
    assert.equal(root.dataset.phase, "idle");
    assert.equal(body.classList.contains("transition-active"), false);
    assert.equal(menu.inert, false);
    assert.equal(menu.hasAttribute("inert"), false);
    assert.equal(board.inert, true);
    assert.equal(board.hasAttribute("inert"), true);
    assert.deepEqual(transitions, [
      ["gateClose", { kind: "enter", surface: "board", semantic: "foldGather" }],
      ["gateOpen", { kind: "enter", surface: "board", semantic: "foldResolve" }]
    ]);
  } finally {
    globalThis.document = originalDocument;
    globalThis.requestAnimationFrame = originalAnimationFrame;
  }
});

test("the board swap and reveal wait for the fold veil instead of removed door elements", async () => {
  const originalDocument = globalThis.document;
  const originalAnimationFrame = globalThis.requestAnimationFrame;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const body = { classList: createClassList() };
  globalThis.document = { body, querySelector: () => null };
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.getComputedStyle = () => ({
    transitionProperty: "transform, opacity",
    transitionDuration: "560ms, 360ms",
    transitionDelay: "0ms, 0ms"
  });
  try {
    const veil = createTransitionNode();
    const root = createRoot({ veil });
    const order = [];
    const gate = createCosmicGate({ root, reducedMotion: false, timings: FAST_TIMINGS });
    const pending = gate.enterBoard(() => order.push(`swap:${root.dataset.phase}`), {
      afterOpen: () => order.push(`ready:${root.dataset.phase}`)
    });

    while (root.dataset.phase !== "closing") await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(order, []);
    veil.dispatch("transitionend");
    while (root.dataset.phase !== "opening") await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(order, ["swap:closed"]);
    veil.dispatch("transitionend");
    assert.equal(await pending, true);
    assert.deepEqual(order, ["swap:closed", "ready:opening"]);
  } finally {
    globalThis.document = originalDocument;
    globalThis.requestAnimationFrame = originalAnimationFrame;
    globalThis.getComputedStyle = originalGetComputedStyle;
  }
});

test("the constellation fold always restores keyboard access when board setup fails", async () => {
  const originalDocument = globalThis.document;
  const originalAnimationFrame = globalThis.requestAnimationFrame;
  const body = { classList: createClassList() };
  globalThis.document = { body, querySelector: () => null };
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  try {
    const root = createRoot();
    const menu = createSurface();
    const board = createSurface();
    const gate = createCosmicGate({
      root,
      reducedMotion: true,
      timings: FAST_TIMINGS,
      quoteSelector: () => TEST_QUOTE,
      surfaces: [menu, board]
    });

    await assert.rejects(
      gate.enterBoard(() => {
        assert.equal(root.dataset.phase, "closed");
        assert.equal(menu.inert, true);
        assert.equal(board.inert, true);
        throw new Error("board setup failed");
      }),
      /board setup failed/
    );

    assert.equal(menu.inert, false);
    assert.equal(menu.hasAttribute("inert"), false);
    assert.equal(board.inert, false);
    assert.equal(board.hasAttribute("inert"), false);
    assert.equal(root.hidden, true);
    assert.equal(root.dataset.phase, "idle");
    assert.equal(body.classList.contains("transition-active"), false);
  } finally {
    globalThis.document = originalDocument;
    globalThis.requestAnimationFrame = originalAnimationFrame;
  }
});

test("pause and result dialogs use local motion without taking over the world fold", async () => {
  const originalDocument = globalThis.document;
  const originalAnimationFrame = globalThis.requestAnimationFrame;
  const body = { classList: createClassList() };
  globalThis.document = { body, querySelector: () => null };
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  try {
    const root = createRoot();
    const dialog = createDialog();
    let quoteRequests = 0;
    const transitions = [];
    const gate = createCosmicGate({
      root,
      reducedMotion: true,
      timings: FAST_TIMINGS,
      onTransition: (cue, detail) => transitions.push([cue, detail]),
      quoteSelector: () => {
        quoteRequests += 1;
        return TEST_QUOTE;
      }
    });
    assert.equal(await gate.presentDialog(dialog, {
      kind: "victory",
      label: "Telescope discovered",
      focus: ".primary-action"
    }), true);
    assert.equal(dialog.open, true);
    assert.equal(dialog.dataset.phase, "closed");
    assert.equal(dialog.classList.contains("cosmic-dialog-transition--result"), true);
    assert.equal(root.hidden, true);
    assert.equal(quoteRequests, 0);

    assert.equal(await gate.dismissDialog(dialog, { immediate: true }), true);
    assert.equal(dialog.open, false);
    assert.equal(dialog.classList.contains("cosmic-dialog-transition"), false);
    assert.equal(root.hidden, true);
    assert.equal(root.dataset.phase, undefined);
    assert.equal(body.classList.contains("transition-active"), false);
    assert.deepEqual(transitions, []);
  } finally {
    globalThis.document = originalDocument;
    globalThis.requestAnimationFrame = originalAnimationFrame;
  }
});

test("a result opens through its bounded dialog animation without waiting for the full-screen fold", async () => {
  const originalDocument = globalThis.document;
  const originalAnimationFrame = globalThis.requestAnimationFrame;
  const body = { classList: createClassList() };
  globalThis.document = { body, querySelector: () => null };
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  try {
    const root = createRoot();
    const dialog = createDialog();
    const gate = createCosmicGate({
      root,
      reducedMotion: false,
      timings: FAST_TIMINGS
    });

    assert.equal(await gate.presentDialog(dialog, { kind: "victory" }), true);
    assert.equal(dialog.open, true);
    assert.equal(root.hidden, true);
  } finally {
    globalThis.document = originalDocument;
    globalThis.requestAnimationFrame = originalAnimationFrame;
  }
});

test("first-discovery celebration is finite, nonduplicating, and keyboard-modal before its result", async () => {
  const originalDocument = globalThis.document;
  const originalAnimationFrame = globalThis.requestAnimationFrame;
  const body = { classList: createClassList() };
  globalThis.document = { body, querySelector: () => null };
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  try {
    const root = createRoot({ celebration: true });
    const menu = createSurface();
    const board = createSurface({ inert: true, inertAttribute: "" });
    let showCount = 0;
    const dialog = createDialog({
      onShow: () => {
        showCount += 1;
        assert.equal(menu.inert, true);
        assert.equal(board.inert, true);
        assert.equal(root.celebrationLayer.hidden, true);
      }
    });
    const gate = createCosmicGate({
      root,
      reducedMotion: false,
      timings: FAST_TIMINGS,
      surfaces: [menu, board]
    });
    const celebration = { kind: "first-orbit", word: "Mud", emoji: "🟤" };

    assert.equal(await gate.presentDialog(dialog, {
      kind: "victory",
      focus: ".primary-action",
      celebration
    }), true);
    assert.equal(showCount, 1);
    assert.equal(root.celebrationLayer.activationCount, 1);
    assert.equal(root.celebrationField.children.length, 42);
    assert.equal(root.celebrationField.dataset.ready, "true");
    assert.equal(root.celebrationLayer.hidden, true);
    assert.equal("celebration" in root.dataset, false);
    assert.equal(menu.inert, false);
    assert.equal(menu.hasAttribute("inert"), false);
    assert.equal(board.inert, true);
    assert.equal(board.hasAttribute("inert"), true);

    assert.equal(await gate.dismissDialog(dialog, { immediate: true }), true);
    assert.equal(await gate.presentDialog(dialog, {
      kind: "victory",
      focus: ".primary-action",
      celebration
    }), true);
    assert.equal(showCount, 2);
    assert.equal(root.celebrationLayer.activationCount, 2);
    assert.equal(root.celebrationField.children.length, 42);
    assert.equal(menu.inert, false);
    assert.equal(board.inert, true);
  } finally {
    globalThis.document = originalDocument;
    globalThis.requestAnimationFrame = originalAnimationFrame;
  }
});

test("quotes remain milestone language and routine folds use concise destination context", async () => {
  const originalDocument = globalThis.document;
  const originalAnimationFrame = globalThis.requestAnimationFrame;
  const body = { classList: createClassList(["cosmic-intro-pending"]) };
  globalThis.document = { body, querySelector: () => null };
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  try {
    const root = createRoot();
    const requests = [];
    const quotes = [
      TEST_QUOTE,
      { id: "test-stars", text: "Follow the path that makes you curious.", author: "" }
    ];
    const gate = createCosmicGate({
      root,
      reducedMotion: true,
      timings: FAST_TIMINGS,
      quoteSelector: ({ previousId }) => {
        requests.push(previousId);
        return quotes[requests.length - 1];
      }
    });

    assert.equal(await gate.playIntro(), true);
    assert.equal(await gate.enterBoard(() => {}, { label: "Find Moon." }), true);
    assert.deepEqual(requests, [""]);
    assert.equal(root.dataset.quoteId, TEST_QUOTE.id);
    assert.equal(root.labels.get(".cosmic-gate__eyebrow").textContent, "WORLDWEAVE");
    assert.equal(root.labels.get(".cosmic-gate__label").textContent, "Reality is drawing near");
    assert.equal(root.labels.get(".cosmic-gate__copy").textContent, "Find Moon.");
    assert.equal(root.labels.get(".cosmic-gate__copy").hidden, false);
  } finally {
    globalThis.document = originalDocument;
    globalThis.requestAnimationFrame = originalAnimationFrame;
  }
});
