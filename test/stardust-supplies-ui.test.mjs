import test from "node:test";
import assert from "node:assert/strict";
import {
  configureStardustSupplyDialog,
  normalizeStardustSupplyTab,
  setStardustSupplyTab
} from "../public/stardust-supplies-ui.mjs";

function fakeElement(dataset = {}) {
  return {
    dataset,
    hidden: false,
    inert: false,
    tabIndex: 0,
    textContent: "",
    attributes: new Map(),
    focused: false,
    classList: {
      values: new Set(),
      toggle(name, enabled) {
        if (enabled) this.values.add(name);
        else this.values.delete(name);
      }
    },
    setAttribute(name, value) { this.attributes.set(name, value); },
    focus() { this.focused = true; }
  };
}

function fakeDocument() {
  const elements = new Map([
    ["stardustReserveTab", fakeElement()],
    ["stardustAutomaticTab", fakeElement()],
    ["stardustReservePanel", fakeElement()],
    ["stardustAutomaticPanel", fakeElement()],
    ["stardustDialogContext", fakeElement()]
  ]);
  const supplies = [fakeElement({ supplyItem: "route-signal" }), fakeElement({ supplyItem: "star-compass" })];
  return {
    elements,
    supplies,
    getElementById: (id) => elements.get(id) || null,
    querySelectorAll: (selector) => selector === "[data-supply-item]" ? supplies : [],
    querySelector: (selector) => supplies.find((item) => selector === `[data-supply-item="${item.dataset.supplyItem}"]`) || null
  };
}

test("Stardust supply tabs normalize and expose only the selected panel", () => {
  const documentRef = fakeDocument();
  const dialog = fakeElement();
  assert.equal(normalizeStardustSupplyTab("unknown"), "reserve");
  assert.equal(setStardustSupplyTab({ documentRef, dialog, name: "automatic", focus: true }), "automatic");
  assert.equal(documentRef.elements.get("stardustReservePanel").hidden, true);
  assert.equal(documentRef.elements.get("stardustAutomaticPanel").hidden, false);
  assert.equal(documentRef.elements.get("stardustAutomaticTab").focused, true);
  assert.equal(dialog.dataset.activeSection, "automatic");
});

test("Stardust supply context routes automatic and reserve items to their matching tabs", () => {
  const documentRef = fakeDocument();
  const dialog = fakeElement();
  const routeSignal = configureStardustSupplyDialog({ documentRef, dialog, focusItem: "route-signal" });
  assert.equal(routeSignal, documentRef.supplies[0]);
  assert.equal(dialog.dataset.activeSection, "automatic");
  assert.match(documentRef.elements.get("stardustDialogContext").textContent, /refill to three/i);
  assert.equal(documentRef.supplies[0].classList.values.has("is-context-target"), true);

  configureStardustSupplyDialog({ documentRef, dialog, focusItem: "star-compass" });
  assert.equal(dialog.dataset.activeSection, "reserve");
  assert.equal(documentRef.supplies[0].classList.values.has("is-context-target"), false);
  assert.equal(documentRef.supplies[1].classList.values.has("is-context-target"), true);
});
