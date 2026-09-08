import test from "node:test";
import assert from "node:assert/strict";
import {
  VOYAGE_BODY_LAYOUT,
  VOYAGE_BODY_SHADER_PROFILES,
  VOYAGE_INTERSTELLAR_SYSTEMS,
  createVoyageProjectionScene,
  createVoyageSystemLayout,
  resolveVoyageProjectionFrame,
  resolveVoyageSceneDpr
} from "../public/voyage-projection-scene.mjs";
import { createVoyageWorldPresentation, shotAtTime } from "../public/voyage-projection-domain.mjs";

test("solar layout contains the Sun, all eight planets, and the Moon as Earth's satellite", () => {
  const layout = createVoyageSystemLayout({
    worldPresentation: createVoyageWorldPresentation({ currentWorldId: "earth" })
  });
  assert.equal(layout.bodies.length, 10);
  assert.deepEqual(layout.planetIds, [
    "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"
  ]);
  assert.deepEqual(layout.satelliteIds, ["moon"]);
  assert.equal(layout.bodies.find((body) => body.id === "moon").parentId, "earth");
  assert.equal(layout.bodies.find((body) => body.id === "earth").status, "current");
  assert.ok(Object.isFrozen(layout));
  assert.ok(Object.isFrozen(VOYAGE_BODY_LAYOUT));
  assert.deepEqual(Object.keys(VOYAGE_BODY_SHADER_PROFILES).sort(), [
    "earth", "jupiter", "mars", "mercury", "moon", "neptune", "saturn", "uranus", "venus"
  ]);
  assert.ok(Object.values(VOYAGE_BODY_SHADER_PROFILES).every((profile) => Object.isFrozen(profile)));
  assert.ok(VOYAGE_BODY_SHADER_PROFILES.earth.terrain > VOYAGE_BODY_SHADER_PROFILES.jupiter.terrain);
});

test("the warp corridor crosses authored star systems in a deterministic route", () => {
  assert.equal(VOYAGE_INTERSTELLAR_SYSTEMS.length, 5);
  assert.deepEqual(
    VOYAGE_INTERSTELLAR_SYSTEMS.map(({ id }) => id),
    ["amber-binary", "cyan-rim", "violet-archipelago", "white-dwarf", "red-frontier"]
  );
  assert.ok(VOYAGE_INTERSTELLAR_SYSTEMS.every(({ position }) => position.length === 3));
  assert.ok(VOYAGE_INTERSTELLAR_SYSTEMS.every(({ position }, index, values) => (
    index === 0 || position[2] < values[index - 1].position[2]
  )));
  assert.ok(Object.isFrozen(VOYAGE_INTERSTELLAR_SYSTEMS));

  const warp = resolveVoyageProjectionFrame({ timelineSeconds: 32, shot: { id: "warp", progress: 0.5 } });
  assert.equal(warp.visibility.systems, true);
  assert.ok(warp.effects.systemTransitOffset > 0);
  const earth = resolveVoyageProjectionFrame({ timelineSeconds: 3, shot: { id: "earth", progress: 0.5 } });
  assert.equal(earth.visibility.systems, false);
});

test("DPR caps enforce the low and standard scene budgets", () => {
  assert.equal(resolveVoyageSceneDpr({ quality: "low", devicePixelRatio: 3 }), 1.25);
  assert.equal(resolveVoyageSceneDpr({ quality: "standard", devicePixelRatio: 3 }), 1.75);
  assert.equal(resolveVoyageSceneDpr({ quality: "standard", devicePixelRatio: 1 }), 1);
});

test("every authored shot resolves deterministic camera, rocket, and visibility choreography", () => {
  const shotIds = ["earth", "solar", "heliopause", "warp", "black-hole", "singularity", "return", "beyond"];
  for (const shotId of shotIds) {
    const variant = shotId === "beyond" ? "completion" : "promise";
    const times = {
      earth: 3, solar: 10, heliopause: 23, warp: 31, "black-hole": 43,
      singularity: 50, return: 55, beyond: 55
    };
    const shot = shotAtTime(times[shotId], { variant });
    const frame = resolveVoyageProjectionFrame({
      variant,
      timelineSeconds: times[shotId],
      shot
    });
    assert.equal(frame.shotId, shotId);
    assert.equal(frame.camera.position.length, 3);
    assert.equal(frame.camera.target.length, 3);
    assert.equal(frame.rocket.position.length, 3);
    assert.ok(frame.rocket.visualScale >= 0.25 && frame.rocket.visualScale <= 3);
    assert.equal(frame.visibility.rocket, true);
    assert.ok(Object.isFrozen(frame));
  }
});

test("review choreography keeps the rocket readable and opens Beyond into a distinct destination", () => {
  const earth = resolveVoyageProjectionFrame({
    timelineSeconds: 3.5,
    shot: { id: "earth", progress: 0.5 }
  });
  const solar = resolveVoyageProjectionFrame({
    timelineSeconds: 13.5,
    shot: { id: "solar", progress: 0.5 }
  });
  const beyond = resolveVoyageProjectionFrame({
    variant: "completion",
    timelineSeconds: 55,
    shot: { id: "beyond", progress: 0.5 }
  });
  assert.ok(earth.rocket.visualScale < 1, "the close launch plate must not crop the rocket");
  assert.ok(solar.rocket.visualScale >= 2.65 && solar.rocket.visualScale <= 2.75,
    "the solar reveal must retain a readable rocket against the wide system plate");
  assert.ok(earth.effects.earthPlateScale >= 2,
    "Earth must hold the launch plate rather than reading as a detached miniature");
  assert.equal(earth.effects.solarFocus, "earth");
  assert.equal(beyond.visibility.blackHole, false);
  assert.equal(beyond.visibility.warp, false);
  assert.equal(beyond.visibility.systems, false);
  assert.equal(beyond.visibility.beyondField, true);
  assert.ok(beyond.camera.target[2] < -15);
  assert.ok(beyond.effects.systemTransitOffset < 18);
});

test("review plates keep their subjects in deliberate cinematic lanes", () => {
  const heliopause = resolveVoyageProjectionFrame({
    timelineSeconds: 23.5,
    shot: { id: "heliopause", progress: 0.5 }
  });
  const warp = resolveVoyageProjectionFrame({
    timelineSeconds: 32.5,
    shot: { id: "warp", progress: 0.5 }
  });
  const beyondEarly = resolveVoyageProjectionFrame({
    variant: "completion",
    timelineSeconds: 53,
    shot: { id: "beyond", progress: 0 }
  });
  const beyondLate = resolveVoyageProjectionFrame({
    variant: "completion",
    timelineSeconds: 57,
    shot: { id: "beyond", progress: 1 }
  });
  const distance = (left, right) => Math.hypot(...left.map((value, index) => value - right[index]));

  assert.equal(heliopause.visibility.solar, false,
    "the heliopause plate must not carry an unrelated dark planet silhouette");
  assert.ok(heliopause.rocket.visualScale >= 2.8);
  assert.ok(Math.hypot(...heliopause.camera.position) > 28.5,
    "the heliopause camera must remain outside the shell so its curved limb is visible");
  assert.ok(warp.rocket.visualScale >= 1.65);
  assert.ok(VOYAGE_INTERSTELLAR_SYSTEMS.every(({ position, radius }) => (
    Math.abs(position[0]) >= 5 && radius <= 0.34
  )), "warp landmarks must stay outside the central flight lane");
  assert.ok(distance(beyondEarly.camera.position, beyondEarly.rocket.position) < 10);
  assert.deepEqual(beyondEarly.camera.target, beyondEarly.rocket.position,
    "Beyond must open centered on a complete rocket silhouette before revealing the destination");
  assert.ok(distance(beyondLate.camera.position, beyondLate.rocket.position) < 14,
    "the Beyond camera must travel with the rocket instead of losing it as a speck");
  assert.ok(Math.abs(
    distance(beyondEarly.camera.position, beyondEarly.rocket.position)
      - distance(beyondLate.camera.position, beyondLate.rocket.position)
  ) < 5, "the rocket's perceived Beyond scale must remain stable");
});

test("reduced motion holds a composed plate instead of tracking shot interpolation", () => {
  const early = resolveVoyageProjectionFrame({
    reducedMotion: true,
    timelineSeconds: 27.1,
    shot: { id: "warp", progress: 0.01 }
  });
  const late = resolveVoyageProjectionFrame({
    reducedMotion: true,
    timelineSeconds: 37.9,
    shot: { id: "warp", progress: 0.99 }
  });
  assert.deepEqual(early.camera, late.camera);
  assert.deepEqual(early.rocket, late.rocket);
  assert.equal(early.effects.starRotation, 0);
  assert.equal(late.effects.accretionRotation, 0);
});

function fakeThree() {
  class Vector {
    constructor() { this.x = 0; this.y = 0; this.z = 0; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; }
  }
  class Object3D {
    constructor() {
      this.children = [];
      this.position = new Vector();
      this.rotation = new Vector();
      this.scale = new Vector();
      this.scale.set(1, 1, 1);
      this.userData = {};
      this.visible = true;
    }
    add(...children) { this.children.push(...children); }
  }
  class Scene extends Object3D {}
  class Group extends Object3D {}
  class PerspectiveCamera extends Object3D {
    constructor(fov, aspect) { super(); this.fov = fov; this.aspect = aspect; }
    updateProjectionMatrix() {}
    lookAt(...values) { this.lookTarget = values; }
  }
  class Geometry {
    dispose() { this.disposed = true; }
  }
  class BufferGeometry extends Geometry {
    setAttribute(name, value) { this[name] = value; }
  }
  class Material {
    constructor(options = {}) { Object.assign(this, options); this.isMaterial = true; }
    dispose() { this.disposed = true; }
  }
  class Mesh extends Object3D {
    constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; }
  }
  class Points extends Mesh {}
  class LineSegments extends Mesh {}
  class Light extends Object3D {}
  class WebGLRenderer {
    constructor() { this.shadowMap = {}; this.renderCalls = 0; }
    setPixelRatio(value) { this.dpr = value; }
    setSize(width, height) { this.size = [width, height]; }
    setClearColor() {}
    render() { this.renderCalls += 1; }
    dispose() { this.disposed = true; }
  }
  return {
    Scene,
    Group,
    PerspectiveCamera,
    WebGLRenderer,
    Mesh,
    Points,
    LineSegments,
    SphereGeometry: Geometry,
    CylinderGeometry: Geometry,
    ConeGeometry: Geometry,
    RingGeometry: Geometry,
    TorusGeometry: Geometry,
    BufferGeometry,
    Float32BufferAttribute: class { constructor(values, size) { this.values = values; this.size = size; } },
    MeshBasicMaterial: Material,
    MeshStandardMaterial: Material,
    PointsMaterial: Material,
    LineBasicMaterial: Material,
    ShaderMaterial: Material,
    AmbientLight: Light,
    DirectionalLight: Light,
    PointLight: Light,
    AdditiveBlending: 2,
    DoubleSide: 2,
    BackSide: 1,
    SRGBColorSpace: "srgb",
    ACESFilmicToneMapping: 4
  };
}

function fakeCanvas() {
  const listeners = new Map();
  const attributes = new Map();
  return {
    clientWidth: 800,
    clientHeight: 450,
    width: 800,
    height: 450,
    style: {},
    setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.get(name); },
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
    dispatch(name, event = {}) { listeners.get(name)?.(event); },
    listenerCount: () => listeners.size
  };
}

test("scene lifecycle prepares, syncs, suspends, resumes, resizes, and destroys without its own loop", async () => {
  const canvas = fakeCanvas();
  const renders = [];
  const scene = createVoyageProjectionScene({
    canvas,
    THREE: fakeThree(),
    quality: "low",
    devicePixelRatio: 4,
    onRender: (snapshot) => renders.push(snapshot.shotId)
  });
  const ready = await scene.prepare();
  assert.equal(ready.phase, "ready");
  assert.equal(ready.dpr, 1.25);
  assert.equal(ready.bodyIds.length, 10);
  assert.equal(canvas.getAttribute("aria-hidden"), "true");
  assert.equal(canvas.inert, true);

  const beforeSync = scene.snapshot().renderCount;
  const shot = shotAtTime(30, { variant: "progress" });
  scene.sync({
    projectionSnapshot: { variant: "progress", timelineSeconds: 30, shot },
    worldPresentation: createVoyageWorldPresentation({ currentWorldId: "moon" })
  });
  assert.equal(scene.snapshot().shotId, "warp");
  assert.equal(scene.snapshot().renderCount, beforeSync + 1);

  scene.suspend("hidden");
  const suspendedRenders = scene.snapshot().renderCount;
  scene.sync({ variant: "progress", timelineSeconds: 31, shot: shotAtTime(31, { variant: "progress" }) });
  assert.equal(scene.snapshot().renderCount, suspendedRenders);
  scene.resume("hidden");
  assert.equal(scene.snapshot().phase, "ready");
  assert.equal(scene.snapshot().renderCount, suspendedRenders + 1);
  scene.resize({ width: 390, height: 844 });
  assert.deepEqual([scene.snapshot().width, scene.snapshot().height], [390, 844]);
  assert.ok(renders.length >= 3);

  assert.equal(scene.destroy(), true);
  assert.equal(scene.snapshot().phase, "destroyed");
  assert.equal(canvas.listenerCount(), 0);
  assert.equal(scene.destroy(), false);
});

test("missing Three and context loss enter the accessible fallback path", async () => {
  const absent = createVoyageProjectionScene({ canvas: fakeCanvas(), THREE: null });
  assert.equal((await absent.prepare()).fallbackReason, "three-unavailable");

  const canvas = fakeCanvas();
  const fallbacks = [];
  const scene = createVoyageProjectionScene({
    canvas,
    THREE: fakeThree(),
    onFallback: ({ reason }) => fallbacks.push(reason)
  });
  await scene.prepare();
  let prevented = false;
  canvas.dispatch("webglcontextlost", { preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(scene.snapshot().phase, "fallback");
  assert.equal(scene.snapshot().fallbackReason, "context-lost");
  assert.deepEqual(fallbacks, ["context-lost"]);
  scene.destroy();
});
