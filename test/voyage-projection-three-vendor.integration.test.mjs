import assert from "node:assert/strict";
import test from "node:test";

import * as releasedThreeModule from "../public/vendor/three/planet-hub-three.mjs";
import { createVoyageProjectionScene } from "../public/voyage-projection-scene.mjs";
import { VOYAGE_PROJECTION_THREE_EXPORTS } from "../scripts/sync-planet-hub-vendor.mjs";

class HeadlessRendererAdapter {
  constructor({ canvas }) {
    this.domElement = canvas;
    this.shadowMap = { enabled: false };
    this.renderCalls = 0;
  }

  setPixelRatio(value) { this.pixelRatio = value; }
  setSize(width, height) { this.size = [width, height]; }
  setClearColor() {}
  render(scene, camera) {
    assert.equal(scene?.isScene, true);
    assert.equal(camera?.isPerspectiveCamera, true);
    this.renderCalls += 1;
  }
  dispose() { this.disposed = true; }
}

function headlessCanvas() {
  const listeners = new Map();
  const attributes = new Map();
  return {
    clientWidth: 640,
    clientHeight: 360,
    width: 640,
    height: 360,
    style: {},
    setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.get(name); },
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); }
  };
}

test("the actual released Three module can prepare the Voyage Projection scene", async () => {
  for (const exportName of VOYAGE_PROJECTION_THREE_EXPORTS) {
    assert.equal(typeof releasedThreeModule[exportName], "function", `Released Three module is missing ${exportName}.`);
  }

  // Node has no WebGL canvas. Replace only the renderer boundary while keeping
  // every scene graph, geometry, attribute, material, light, and camera class
  // from the exact browser module shipped by the import map. This catches the
  // production omission that fake-Three unit tests could not observe.
  const THREE = Object.freeze({
    ...releasedThreeModule,
    WebGLRenderer: HeadlessRendererAdapter
  });
  const scene = createVoyageProjectionScene({
    canvas: headlessCanvas(),
    THREE,
    quality: "low",
    devicePixelRatio: 1
  });

  const ready = await scene.prepare();
  assert.equal(ready.phase, "ready", ready.fallbackReason || "Voyage scene entered fallback.");
  assert.equal(ready.prepared, true);
  assert.deepEqual(ready.bodyIds, [
    "sun", "mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn", "uranus", "neptune"
  ]);
  assert.ok(ready.renderCount >= 1);
  assert.equal(scene.destroy(), true);
});
