import assert from "node:assert/strict";
import test from "node:test";

import {
  beginCosmeticDragTrail,
  measuredNodeAnchor,
  queueCosmeticFusionBurst,
  recordCosmeticDragTrail
} from "../public/cosmetic-canvas.mjs";

test("cosmetic trail state is bounded, board-relative, and resettable", () => {
  const originalDocument = globalThis.document;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalMatchMedia = globalThis.matchMedia;
  try {
    globalThis.document = { body: { dataset: { cosmeticEffects: "full" } } };
    globalThis.getComputedStyle = () => ({
      getPropertyValue(property) {
        if (property === "--cosmetic-trail-enabled") return "1";
        if (property === "--cosmetic-trail-sample-cap") return "3";
        return "";
      }
    });
    globalThis.matchMedia = () => ({ matches: false });
    const state = { dragTrailSamples: [], fusionBursts: [] };
    const board = {
      getBoundingClientRect: () => ({ left: 100, top: 50, width: 300, height: 200 })
    };
    recordCosmeticDragTrail(state, {
      clientX: 150,
      clientY: 80,
      getCoalescedEvents: () => [
        { clientX: 130, clientY: 70 },
        { clientX: 160, clientY: 90 },
        { clientX: 190, clientY: 110 },
        { clientX: 220, clientY: 130 }
      ]
    }, board);
    assert.equal(state.dragTrailSamples.length, 3);
    assert.deepEqual(
      state.dragTrailSamples.map(({ x, y }) => ({ x, y })),
      [{ x: 60, y: 40 }, { x: 90, y: 60 }, { x: 120, y: 80 }]
    );
    beginCosmeticDragTrail(state);
    assert.deepEqual(state.dragTrailSamples, []);
  } finally {
    globalThis.document = originalDocument;
    globalThis.getComputedStyle = originalGetComputedStyle;
    globalThis.matchMedia = originalMatchMedia;
  }
});

test("fusion bursts respect Effects Off and measured anchors use live dimensions", () => {
  const originalDocument = globalThis.document;
  try {
    const state = { fusionBursts: [] };
    globalThis.document = { body: { dataset: { cosmeticEffects: "off" } } };
    queueCosmeticFusionBurst(state, 10, 20);
    assert.deepEqual(state.fusionBursts, []);
    globalThis.document.body.dataset.cosmeticEffects = "full";
    queueCosmeticFusionBurst(state, 10, 20);
    assert.equal(state.fusionBursts.length, 1);
    assert.deepEqual(
      measuredNodeAnchor({ x: 12, y: 18 }, { offsetWidth: 100, offsetHeight: 46 }),
      { x: 62, y: 41 }
    );
  } finally {
    globalThis.document = originalDocument;
  }
});
