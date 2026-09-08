import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyHomeLayout,
  classifyResponsiveContext,
  UI_DENSITY,
  UI_LAYOUT
} from "../public/responsive-context.mjs";

test("responsive context follows the shared phone, landscape, and tablet contract", () => {
  assert.equal(classifyResponsiveContext({ width: 320, height: 568 }).layout, UI_LAYOUT.STACKED);
  assert.equal(classifyResponsiveContext({ width: 768, height: 1024 }).layout, UI_LAYOUT.STACKED);
  assert.equal(classifyResponsiveContext({ width: 568, height: 320 }).layout, UI_LAYOUT.SHORT_LANDSCAPE);
  assert.equal(classifyResponsiveContext({ width: 1024, height: 768 }).layout, UI_LAYOUT.WIDE);
});

test("height density is independent from orientation and width", () => {
  assert.equal(classifyResponsiveContext({ width: 1280, height: 720 }).density, UI_DENSITY.REGULAR);
  assert.equal(classifyResponsiveContext({ width: 1440, height: 650 }).density, UI_DENSITY.COMPACT_HEIGHT);
  assert.equal(classifyResponsiveContext({ width: 390, height: 844 }).density, UI_DENSITY.REGULAR);
});

test("Home reserves the cinematic observatory for viewports that can contain it", () => {
  assert.equal(classifyHomeLayout({ width: 390, height: 844 }), "stacked");
  assert.equal(classifyHomeLayout({ width: 568, height: 320 }), "compact");
  assert.equal(classifyHomeLayout({ width: 1024, height: 768 }), "compact");
  assert.equal(classifyHomeLayout({ width: 1280, height: 720 }), "observatory");
  assert.equal(classifyHomeLayout({ width: 1440, height: 650 }), "compact");
});
