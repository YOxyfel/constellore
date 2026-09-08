import assert from "node:assert/strict";
import test from "node:test";

import {
  boardWorldToScreen,
  clampBoardZoom,
  createBoardCameraRuntime,
  screenToBoardWorld,
  zoomBoardCameraAt
} from "../public/board-camera-runtime.mjs";

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || new Set();
    handlers.add(handler);
    this.listeners.set(type, handlers);
  }

  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }

  dispatch(type, event = {}) {
    for (const handler of this.listeners.get(type) || []) handler(event);
  }
}

function cameraFixture(options = {}) {
  const viewport = new FakeEventTarget();
  viewport.dataset = {};
  viewport.clientHeight = 600;
  viewport.getBoundingClientRect = () => ({ left: 10, top: 20, width: 800, height: 600 });
  viewport.setPointerCapture = () => {};
  viewport.closest = () => null;

  const properties = new Map();
  const world = {
    style: {
      setProperty: (name, value) => properties.set(name, value),
      removeProperty: (name) => properties.delete(name)
    }
  };

  const viewWindow = new FakeEventTarget();
  const timers = new Map();
  let nextTimer = 1;
  viewWindow.setTimeout = (callback) => {
    const id = nextTimer++;
    timers.set(id, callback);
    return id;
  };
  viewWindow.clearTimeout = (id) => timers.delete(id);
  viewWindow.flushTimers = () => {
    const callbacks = [...timers.values()];
    timers.clear();
    callbacks.forEach((callback) => callback());
  };

  const runtime = createBoardCameraRuntime({ viewport, world, viewWindow, ...options });
  return { viewport, viewWindow, runtime };
}

function targetMatching(token) {
  return {
    closest(selector) {
      return selector.split(",").map((entry) => entry.trim()).includes(token) ? this : null;
    }
  };
}

function pointerEvent(target, overrides = {}) {
  return {
    target,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientX: 200,
    clientY: 160,
    timeStamp: 10,
    preventDefault() { this.defaultPrevented = true; },
    ...overrides
  };
}

const closeTo = (actual, expected, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
};

const pointsClose = (actual, expected, tolerance = 1e-9) => {
  closeTo(actual.x, expected.x, tolerance);
  closeTo(actual.y, expected.y, tolerance);
};

test("board zoom clamps to the supported 0.35 through 2.5 range", () => {
  assert.equal(clampBoardZoom(-1), 0.35);
  assert.equal(clampBoardZoom(0.35), 0.35);
  assert.equal(clampBoardZoom(1), 1);
  assert.equal(clampBoardZoom(2.5), 2.5);
  assert.equal(clampBoardZoom(20), 2.5);
});

test("screen and board-world coordinates round trip through a translated zoom camera", () => {
  const camera = { x: 84, y: -36, zoom: 1.75 };
  const screenPoint = { x: 430, y: 215 };

  const worldPoint = screenToBoardWorld(screenPoint, camera);
  pointsClose(boardWorldToScreen(worldPoint, camera), screenPoint);

  const independentWorldPoint = { x: -92.5, y: 318.25 };
  pointsClose(
    screenToBoardWorld(boardWorldToScreen(independentWorldPoint, camera), camera),
    independentWorldPoint
  );
});

test("pointer-anchored zoom preserves the board-world point beneath the pointer", () => {
  const camera = { x: 90, y: -40, zoom: 1.4 };
  const anchor = { x: 320, y: 180 };
  const anchoredWorldPoint = screenToBoardWorld(anchor, camera);

  const zoomed = zoomBoardCameraAt(camera, 0.65, anchor);

  assert.equal(zoomed.zoom, 0.65);
  pointsClose(screenToBoardWorld(anchor, zoomed), anchoredWorldPoint);
  pointsClose(boardWorldToScreen(anchoredWorldPoint, zoomed), anchor);
});

test("zooming out moves camera translation toward the anchor by the inverse-scale amount", () => {
  const camera = { x: 40, y: -20, zoom: 2 };
  const anchor = { x: 100, y: 80 };

  const zoomed = zoomBoardCameraAt(camera, 1, anchor);

  assert.deepEqual(zoomed, { x: 70, y: 30, zoom: 1 });
  pointsClose(boardWorldToScreen({ x: 30, y: 50 }, zoomed), anchor);
});

test("a protected pointer action cancels a pending blank-board activation", () => {
  let singleActivations = 0;
  const { viewport, viewWindow, runtime } = cameraFixture({
    onSingleActivation: () => { singleActivations += 1; }
  });

  viewport.dispatch("pointerdown", pointerEvent(viewport));
  viewWindow.dispatch("pointerup", pointerEvent(viewport, { timeStamp: 20 }));
  viewport.dispatch("pointerdown", pointerEvent(targetMatching(".constellation-bloom"), {
    defaultPrevented: true,
    timeStamp: 120
  }));
  viewWindow.flushTimers();

  assert.equal(singleActivations, 0);
  runtime.destroy();
});

test("wheel input over Bloom and fixed board overlays does not zoom the camera", () => {
  const { viewport, runtime } = cameraFixture();

  for (const token of [".constellation-bloom", ".board-top-hud", ".board-quick-tools"]) {
    let prevented = false;
    viewport.dispatch("wheel", {
      target: targetMatching(token),
      clientX: 240,
      clientY: 180,
      deltaY: 120,
      deltaMode: 0,
      preventDefault() { prevented = true; }
    });
    assert.equal(runtime.snapshot().zoom, 1, `${token} must not change zoom`);
    assert.equal(prevented, false, `${token} must retain its native wheel behavior`);
  }

  runtime.destroy();
});
