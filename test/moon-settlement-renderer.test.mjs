import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

import {
  DEFAULT_MOON_SETTLEMENT_POSTER_URL,
  DEFAULT_MOON_SETTLEMENT_THREE_SPECIFIER,
  DEFAULT_MOON_SETTLEMENT_VENDOR_SPECIFIER,
  MOON_SETTLEMENT_ASSETS,
  MOON_SETTLEMENT_ASTRONAUT_HEIGHT_METERS,
  MOON_SETTLEMENT_AUTHORED_ENVELOPES,
  MOON_SETTLEMENT_GRAVITY,
  MOON_SETTLEMENT_LOCAL_TERRAIN_SEGMENTS,
  MOON_SETTLEMENT_LOCAL_TERRAIN_SIZE,
  MOON_SETTLEMENT_LUNAR_RADIUS_METERS,
  MOON_SETTLEMENT_PBR_ASSETS,
  MOON_SETTLEMENT_SURFACE_RADIUS,
  MOON_SETTLEMENT_WALK_BOUNDARY,
  MOON_SETTLEMENT_WALK_CLEARANCE,
  calculateMoonSettlementBondSpan,
  calculateMoonSettlementSurfaceFrame,
  calculateMoonSettlementSurfaceNormal,
  capMoonSettlementPixelRatio,
  createMoonSettlementAtomMaterialOptions,
  createMoonSettlementGlassMaterialOptions,
  createMoonSettlementRenderer,
  loadMoonSettlementThree,
  normalizeMoonSettlementMode,
  normalizeMoonSettlementQuality,
  normalizeMoonSettlementRenderState,
  projectMoonSettlementSurfacePosition,
  rankMoonSettlementRaycastHits,
  resolveMoonSettlementAssetKey,
  resolveMoonSettlementVisualKind,
  shouldRenderMoonSettlementBond,
  stepMoonSettlementMovement
} from "../public/moon-settlement-renderer.mjs";

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(...values) { values.forEach((value) => this.values.add(value)); }
  remove(...values) { values.forEach((value) => this.values.delete(value)); }
  toggle(value, force) {
    if (force === false) this.values.delete(value);
    else if (force === true || !this.values.has(value)) this.values.add(value);
    else this.values.delete(value);
    return this.values.has(value);
  }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.dataset = {};
    this.style = { values: {}, setProperty: (name, value) => { this.style.values[name] = value; } };
    this.classList = new FakeClassList();
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.parentElement = null;
    this.textContent = "";
    this.hidden = false;
  }
  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }
  prepend(child) {
    child.parentElement = this;
    this.children.unshift(child);
  }
  appendChild(child) { this.append(child); return child; }
  replaceChildren(...children) {
    this.children.forEach((child) => { child.parentElement = null; });
    this.children = [];
    this.append(...children);
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  hasAttribute(name) { return this.attributes.has(name); }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((value) => value !== listener));
  }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }
  get firstChild() { return this.children[0] || null; }
  removeChild(child) { child.remove(); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 600 }; }
}

class FakeDocument {
  constructor() { this.defaultView = {}; }
  createElement(tagName) { return new FakeElement(tagName, this); }
}

test("quality, mode, and pixel ratio stay inside renderer contracts", () => {
  assert.equal(normalizeMoonSettlementQuality("LOW"), "low");
  assert.equal(normalizeMoonSettlementQuality("ultra"), "standard");
  assert.equal(normalizeMoonSettlementMode("weave"), "weave");
  assert.equal(normalizeMoonSettlementMode("unknown"), "walk");
  assert.equal(capMoonSettlementPixelRatio(3, "low"), 1.15);
  assert.equal(capMoonSettlementPixelRatio(1.25, "standard"), 1.25);
  assert.equal(capMoonSettlementPixelRatio(0, "standard"), 1);
});

test("settlement coordinates mount deterministically onto the Moon surface", () => {
  assert.equal(MOON_SETTLEMENT_LUNAR_RADIUS_METERS, 1_737_400);
  assert.equal(MOON_SETTLEMENT_SURFACE_RADIUS, 1_800);
  assert.equal(MOON_SETTLEMENT_ASTRONAUT_HEIGHT_METERS, 1.78);
  assert.equal(MOON_SETTLEMENT_LOCAL_TERRAIN_SIZE, 96);
  assert.equal(MOON_SETTLEMENT_LOCAL_TERRAIN_SEGMENTS, 64);
  assert.ok(MOON_SETTLEMENT_LOCAL_TERRAIN_SIZE / 2 > MOON_SETTLEMENT_WALK_BOUNDARY,
    "the surveyed surface must cover the complete walkable district");
  assert.ok(MOON_SETTLEMENT_SURFACE_RADIUS / MOON_SETTLEMENT_ASTRONAUT_HEIGHT_METERS > 1_000,
    "the walking surface cannot read as a tiny asteroid beside the astronaut");
  assert.deepEqual(projectMoonSettlementSurfacePosition([0, 0, 0]), [0, 0, 0]);
  const mounted = projectMoonSettlementSurfacePosition([3, 0.5, 4], 10);
  assert.equal(mounted[0], 3);
  assert.equal(mounted[2], 4);
  assert.ok(Math.abs(mounted[1] - (Math.sqrt(75) - 9.5)) < 1e-12);
  assert.ok(Object.isFrozen(mounted));
  const oneHundredMetres = projectMoonSettlementSurfacePosition([100, 0, 0]);
  assert.ok(Math.abs(oneHundredMetres[1] + 2.779924256) < 1e-6);
});

test("the Moon treadmill frame is orthonormal and keeps the walked surface point under the astronaut", () => {
  assert.equal(MOON_SETTLEMENT_WALK_CLEARANCE, 0.04);
  assert.equal(MOON_SETTLEMENT_GRAVITY, 1.62);
  assert.equal(MOON_SETTLEMENT_WALK_BOUNDARY, 36);
  const normal = calculateMoonSettlementSurfaceNormal([3, 0, 4], 10);
  assert.ok(Math.abs(normal[0] - 0.3) < 1e-12);
  assert.ok(Math.abs(normal[1] - Math.sqrt(0.75)) < 1e-12);
  assert.ok(Math.abs(normal[2] - 0.4) < 1e-12);

  const origin = calculateMoonSettlementSurfaceFrame([0, 0, 0], 10);
  assert.deepEqual(origin.right, [1, 0, 0]);
  assert.deepEqual(origin.normal, [0, 1, 0]);
  assert.deepEqual(origin.forward, [0, 0, 1]);

  const frame = calculateMoonSettlementSurfaceFrame([3, 0, 4], 10);
  const dot = (left, right) => left.reduce((sum, value, axis) => sum + value * right[axis], 0);
  for (const axis of [frame.right, frame.normal, frame.forward]) assert.ok(Math.abs(Math.hypot(...axis) - 1) < 1e-12);
  assert.ok(Math.abs(dot(frame.right, frame.normal)) < 1e-12);
  assert.ok(Math.abs(dot(frame.forward, frame.normal)) < 1e-12);
  const radial = frame.normal.map((value) => value * 10);
  assert.ok(Math.abs(dot(frame.right, radial)) < 1e-12);
  assert.ok(Math.abs(dot(frame.normal, radial) - 10) < 1e-12);
  assert.ok(Math.abs(dot(frame.forward, radial)) < 1e-12);
  assert.deepEqual(calculateMoonSettlementSurfaceFrame([3, 0, 4], 10), frame, "the same chart point cannot accumulate rotational drift");
});

test("render-state projection accepts canonical collections and caps visible atoms", () => {
  const source = {
    revision: 7,
    structureInstances: {
      shelter: { id: "shelter", type: "haven-shelter", name: "Haven", position: [2, 0, -1] },
      processor: { id: "processor", type: "processor", name: "Processor" }
    },
    structures: [{ id: "shelter", name: "Duplicate" }],
    paths: [{ id: "path-home", kind: "objective", points: [[-2.8, 0, -1.45], [2, 0, -1]] }],
    parcels: [{ id: "parcel-home", siteId: "home", position: [1, 0, 1], selected: { cellX: 1, cellZ: -1 } }],
    structureDraft: {
      graph: {
        nodes: Array.from({ length: 11 }, (_, index) => ({ id: `a${index}`, name: `Atom ${index}` })),
        edges: [{ id: "b1", source: "a0", target: "a1", tier: "reinforced" }]
      }
    }
  };
  const projected = normalizeMoonSettlementRenderState(source);
  assert.equal(projected.revision, 7);
  assert.equal(projected.structures.length, 2);
  assert.equal(projected.structures[0].name, "Duplicate");
  assert.equal(projected.weave.atoms.length, 8);
  assert.equal(projected.weave.bonds[0].tier, "reinforced");
  assert.equal(projected.paths.length, 1);
  assert.equal(projected.parcels.length, 1);
  assert.equal(projected.parcels[0].selected.cellZ, -1);
  assert.equal(projected.paths[0].kind, "objective");
  assert.deepEqual(projected.paths[0].points[0], [-2.8, 0, -1.45]);
  assert.ok(Object.isFrozen(projected.paths));
  assert.ok(Object.isFrozen(projected.paths[0].points[0]));
  assert.ok(Object.isFrozen(projected));
  assert.ok(Object.isFrozen(projected.structures[0].position));
  assert.equal(source.structureInstances.shelter.name, "Haven", "presentation cannot mutate domain state");
});

test("low-gravity locomotion is deterministic, bounded, and lands safely", () => {
  const start = { position: [0, 0, 0], verticalVelocity: 0, grounded: true };
  const jumped = stepMoonSettlementMovement(start, { x: 1, z: 1, jump: true }, 0.05);
  const repeated = stepMoonSettlementMovement(start, { x: 1, z: 1, jump: true }, 0.05);
  assert.deepEqual(jumped, repeated);
  assert.ok(jumped.position[1] > 0);
  assert.equal(jumped.grounded, false);
  let current = jumped;
  for (let frame = 0; frame < 80; frame += 1) {
    current = stepMoonSettlementMovement(current, { x: 1, z: 0, boundary: 1 }, 0.05);
  }
  assert.equal(current.grounded, true);
  assert.equal(current.position[1], 0);
  assert.ok(Math.hypot(current.position[0], current.position[2]) <= 1 + 1e-12);
});

test("bond spans terminate at atom surfaces", () => {
  const span = calculateMoonSettlementBondSpan([0, 0, 0], [3, 0, 0], 0.4, 0.6);
  assert.deepEqual(span.start, [0.4, 0, 0]);
  assert.deepEqual(span.end, [2.4, 0, 0]);
  assert.deepEqual(span.midpoint, [1.4, 0, 0]);
  assert.ok(Math.abs(span.length - 2) < 1e-12);
  assert.equal(calculateMoonSettlementBondSpan([1, 1, 1], [1, 1, 1]).length, 0);
});

test("severed draft bonds retain removal state and own no render geometry", () => {
  const projected = normalizeMoonSettlementRenderState({
    weave: {
      atoms: [
        { id: "earth", name: "Earth" },
        { id: "dust", name: "Dust" }
      ],
      bonds: [
        { id: "cut", from: "earth", to: "dust", tier: "weak", removed: true },
        { id: "kept", from: "earth", to: "dust", tier: "stable" }
      ]
    }
  });
  assert.equal(projected.weave.bonds[0].removed, true);
  assert.equal(projected.weave.bonds[1].removed, false);
  assert.equal(shouldRenderMoonSettlementBond(projected.weave.bonds[0]), false);
  assert.equal(shouldRenderMoonSettlementBond(projected.weave.bonds[1]), true);
});

test("standard-material fallbacks receive no physical-only parameters", () => {
  const glassFallback = createMoonSettlementGlassMaterialOptions({ physical: false });
  const atomFallback = createMoonSettlementAtomMaterialOptions({ physical: false });
  assert.equal("transmission" in glassFallback, false);
  assert.equal("clearcoat" in atomFallback, false);
  assert.equal("clearcoatRoughness" in atomFallback, false);
  assert.equal(createMoonSettlementGlassMaterialOptions().transmission, 0.16);
  assert.equal(createMoonSettlementAtomMaterialOptions().clearcoat, 0.7);
});

test("construction pads and authored settlement landmarks resolve without generic boxes", () => {
  assert.equal(resolveMoonSettlementVisualKind({ type: "plot", previewType: "power" }), "construction-pad");
  assert.equal(resolveMoonSettlementVisualKind({ type: "storage" }), "storage");
  assert.equal(resolveMoonSettlementVisualKind({ type: "world-seed-cradle" }), "seed-cradle");
  assert.equal(resolveMoonSettlementVisualKind({ type: "unknown" }), "generic");
  assert.equal(resolveMoonSettlementAssetKey({ type: "processor" }), "processor");
  assert.equal(resolveMoonSettlementAssetKey({ type: "plot", previewType: "processor" }), "processor");
  assert.equal(resolveMoonSettlementAssetKey({ type: "world-seed-cradle" }), "portal");
  assert.equal(resolveMoonSettlementAssetKey({ type: "shelter" }), null);
  for (const type of [
    "solar-power", "lunar-power", "bastion-shelter", "hive-shelter", "haven-shelter",
    "beacon-signal", "stars-signal", "starter-vault", "storage", "reservoir", "greenhouse"
  ]) {
    assert.equal(resolveMoonSettlementAssetKey({ type }), type);
    assert.equal(resolveMoonSettlementAssetKey({ type: "plot", previewType: type }), type);
  }
  assert.equal(resolveMoonSettlementAssetKey({ type: "shelter", assetVariant: "hive-shelter" }), "hive-shelter");
  assert.equal(resolveMoonSettlementAssetKey({ type: "plot", previewType: "shelter", previewAsset: "haven-shelter" }), "haven-shelter");
});

test("raycast ranking keeps depth authority and uses intent only for close candidates", () => {
  const structure = { userData: { moonSettlementTarget: { id: "home", kind: "structure" } } };
  const atomParent = { userData: { moonSettlementTarget: { id: "earth", kind: "atom" } } };
  const atomChild = { parent: atomParent, userData: {} };
  assert.equal(rankMoonSettlementRaycastHits([
    { object: structure, distance: 2 },
    { object: atomChild, distance: 2.01 }
  ]).id, "earth", "near-equal atom proxy expresses the more precise intent");
  assert.equal(rankMoonSettlementRaycastHits([
    { object: structure, distance: 1 },
    { object: atomChild, distance: 2 }
  ]).id, "home", "a distant atom cannot select through foreground geometry");
  assert.equal(rankMoonSettlementRaycastHits([]), null);
});

test("Three loader preserves one vendor module identity when the bare import is unavailable", async () => {
  const calls = [];
  class WebGLRenderer {}
  class GLTFLoader {}
  const modules = await loadMoonSettlementThree({
    importer: async (specifier) => {
      calls.push(specifier);
      if (specifier === DEFAULT_MOON_SETTLEMENT_THREE_SPECIFIER) throw new Error("no import map");
      if (specifier === DEFAULT_MOON_SETTLEMENT_VENDOR_SPECIFIER) return { WebGLRenderer, GLTFLoader };
      throw new Error(`unexpected ${specifier}`);
    }
  });
  assert.deepEqual(calls, [DEFAULT_MOON_SETTLEMENT_THREE_SPECIFIER, DEFAULT_MOON_SETTLEMENT_VENDOR_SPECIFIER]);
  assert.equal(modules.THREE.WebGLRenderer, WebGLRenderer);
  assert.equal(modules.GLTFLoader, GLTFLoader);
});

test("controller replays pre-init state into a deterministic authored 2.5D fallback", async () => {
  const documentRef = new FakeDocument();
  const host = new FakeElement("main", documentRef);
  const labels = new FakeElement("div", documentRef);
  const selected = [];
  const errors = [];
  const ready = [];
  const renderer = createMoonSettlementRenderer({
    host,
    labelLayer: labels,
    documentRef,
    windowRef: {},
    importer: async () => { throw new Error("WebGL unavailable"); },
    onSelect: (target) => selected.push(target.id),
    onError: (error) => errors.push(error.message),
    onReady: (detail) => ready.push(detail)
  });
  renderer.sync({
    revision: 3,
    structures: [{ id: "greenhouse", name: "Greenhouse", type: "greenhouse", position: [1, 0, 1] }],
    weave: { atoms: [{ id: "earth", name: "Earth", sigil: "Ea" }], bonds: [] }
  });
  renderer.setMode("weave");
  renderer.focus("earth");
  renderer.quality("low");
  renderer.reducedMotion(true);
  await renderer.init();
  assert.equal(renderer.getBackend(), "2.5d");
  assert.equal(renderer.getMode(), "weave");
  assert.equal(renderer.quality(), "low");
  assert.equal(renderer.reducedMotion(), true);
  assert.deepEqual(errors, ["WebGL unavailable"]);
  assert.equal(ready[0].backend, "2.5d");
  const fallback = host.children[0];
  assert.equal(fallback.dataset.settlementBackend, "2.5d");
  assert.equal(fallback.dataset.settlementMode, "weave");
  assert.equal(fallback.dataset.settlementFocus, "earth");
  assert.equal(fallback.children[0].src, `http://localhost/${DEFAULT_MOON_SETTLEMENT_POSTER_URL.slice(2)}`);
  const atomButton = fallback.children[1].children[0];
  assert.equal(atomButton.textContent, "Ea");
  assert.equal(atomButton.style.values["--settlement-x"], "53.12%");
  for (const listener of atomButton.listeners.get("click")) listener();
  assert.deepEqual(selected, ["earth"]);
  assert.equal(renderer.dispose(), true);
  assert.equal(renderer.dispose(), false);
  assert.equal(host.dataset.settlementRenderer, "disposed");
});

test("an explicit fallback preference never probes WebGL dependencies", async () => {
  const documentRef = new FakeDocument();
  const host = new FakeElement("main", documentRef);
  let imports = 0;
  const renderer = createMoonSettlementRenderer({
    host,
    documentRef,
    windowRef: {},
    quality: "fallback",
    importer: async () => { imports += 1; throw new Error("must not run"); }
  });
  assert.equal(renderer.quality(), "fallback");
  await renderer.init();
  assert.equal(imports, 0);
  assert.equal(renderer.getBackend(), "2.5d");
  renderer.dispose();
});

test("the 2.5D fallback exposes the same 25-cell placement parcel", async () => {
  const documentRef = new FakeDocument();
  const host = new FakeElement("main", documentRef);
  const selected = [];
  const renderer = createMoonSettlementRenderer({
    host,
    documentRef,
    windowRef: {},
    quality: "fallback",
    onSelect: (target) => selected.push(target)
  });
  renderer.sync({
    structures: [{ id: "site-power", name: "Power foundation", type: "plot", position: [0, 0, 0] }],
    parcels: [
      { siteId: "power", name: "Power parcel", position: [0, 0, 0], selected: { cellX: 1, cellZ: -1 } },
      { siteId: "shelter", name: "Shelter parcel", position: [8.75, 0, 0], status: "planned", interactive: false }
    ]
  });
  renderer.setMode("inspect");
  await renderer.init();
  const buttons = host.children[0].children[1].children;
  const cells = buttons.filter((button) => button.dataset.settlementKind === "parcel-cell");
  assert.equal(cells.length, 25);
  assert.equal(cells.filter((button) => button.attributes.get("aria-pressed") === "true").length, 1);
  assert.equal(cells.filter((button) => button.dataset.placementValid === "true").length, 9);
  const center = cells.find((button) => button.textContent === "C3");
  for (const listener of center.listeners.get("click")) listener();
  assert.equal(selected.at(-1).kind, "parcel-cell");
  assert.equal(selected.at(-1).cellX, 0);
  renderer.dispose();
});

test("renderer source owns real Three geometry, projected DOM labels, lifecycle, and authored fallback media", async () => {
  const source = await readFile(new URL("../public/moon-settlement-renderer.mjs", import.meta.url), "utf8");
  assert.match(source, /new THREE[.]WebGLRenderer/);
  assert.match(source, /new THREE[.]Box3\(\)[.]setFromObject\(model\)/,
    "authored structures use exact bounds fitting when the shipped vendor pack is active");
  assert.match(source, /THREE[.]PCFShadowMap/,
    "Standard quality requests the shipped filtered-shadow mode");
  assert.match(source, /new THREE[.]Raycaster/);
  assert.match(source, /intersectObjects\(pickingRoots, true\)/,
    "the detailed Moon is never part of high-frequency picking");
  assert.doesNotMatch(source, /intersectObjects\(\[physicalRoot, weaveRoot\], true\)/);
  assert.match(source, /new GLTFLoader/);
  assert.match(source, /moon-landing-standard[.]glb/);
  assert.match(source, /moon-standard[.]glb/);
  assert.match(source, /rocket-standard[.]glb/);
  assert.match(source, /processor-standard[.]glb/);
  assert.match(source, /greenhouse-standard[.]glb/);
  assert.match(source, /bastion-shelter-standard[.]glb/);
  assert.match(source, /portal-standard[.]glb/);
  assert.doesNotMatch(source, /CircleGeometry\(11[.]8/,
    "the settlement no longer sits on a flat procedural disc");
  assert.match(source, /new THREE[.]SphereGeometry\([\s\S]*MOON_SETTLEMENT_SURFACE_RADIUS/,
    "a curved Moon remains available if the authored globe cannot load");
  assert.match(source, /moon-settlement-surveyed-regolith/,
    "a dense local regolith surface prevents planet-scale facets clipping through the settlement");
  assert.match(source, /globePivot[.]position[.]set\(0, -MOON_SETTLEMENT_SURFACE_RADIUS, 0\)[\s\S]*globeSurfaceRoot[.]position[.]set\(0, MOON_SETTLEMENT_SURFACE_RADIUS, 0\)/,
    "the world rolls around the actual Moon center");
  assert.match(source, /avatar[.]position[.]set\(0, MOON_SETTLEMENT_WALK_CLEARANCE \+ movement[.]position\[1\], 0\)/,
    "the astronaut remains upright above the rolling surface instead of descending into it");
  assert.doesNotMatch(source, /record\s*=\s*\{\s*[.][.][.]record,\s*position:\s*projectMoonSettlementSurfacePosition\(record[.]position\)/,
    "canonical structure coordinates are mounted exactly once and cannot sink into the Moon");
  assert.match(source, /parcelRoot[\s\S]*createMoonSettlementParcelCells[\s\S]*outside buildable footprint/,
    "placement owns a visible, pickable parcel grid with structural edge cues");
  assert.match(source, /new THREE[.]DataTexture\([\s\S]*textureSize[\s\S]*THREE[.]RGBAFormat/,
    "persistent plots use a vendor-compatible exact five-by-five tile texture");
  assert.match(source, /createLabelElement\(documentRef, target, selectTarget, inspectTarget\)/,
    "full names and atom sigils remain crisp DOM and expose the distinct inspect gesture");
  assert.match(source, /position[.]project\(camera\)/);
  assert.match(source, /object[.]receiveShadow = activeQuality === ["']standard["'] && opaque/,
    "opaque authored structures receive the motivated lunar key shadow");
  assert.match(source, /material[.]roughnessMap = sharedPbr[.]orm[\s\S]*material[.]metalnessMap = sharedPbr[.]orm[\s\S]*material[.]normalMap = sharedPbr[.]normal/,
    "authored materials receive the shared packed ORM and tangent normal atlases");
  assert.match(source, /texture[.]flipY = false[\s\S]*baseColor[.]colorSpace = THREE[.]SRGBColorSpace/,
    "external PBR maps follow glTF UV orientation and color-space rules");
  assert.match(source, /shadowCamera[.]near = 0[.]2[\s\S]*shadowCamera[.]far = 90/,
    "the settlement shadow camera uses a bounded, depth-precise frustum");
  assert.doesNotMatch(source, /FogExp2|scene[.]fog/,
    "the airless Moon must not use atmospheric fog to fake scale");
  assert.doesNotMatch(source, /stableHash/,
    "unknown structures use the deterministic overflow lattice instead of radial scattering");
  assert.match(source, /renderState[.]parcels[.]some\(\(parcel\) => parcel[.]interactive\)/,
    "persistent plot surfaces cannot steal structure picking outside active placement");
  assert.match(source, /calculateMoonSettlementBondSpan\(from[.]position, to[.]position/,
    "bonds share the audited surface-to-surface geometry helper");
  assert.match(source, /if \(!shouldRenderMoonSettlementBond\(bond\)\) return;/,
    "removed bonds cannot leave stale visible or picking geometry");
  assert.match(source, /new THREE[.]MeshBasicMaterial\(\{ transparent: true, opacity: 0, depthWrite: false \}\)/,
    "generous invisible hit proxies are separate from visual geometry");
  assert.match(source, /keydown[\s\S]*pointerdown[\s\S]*dblclick[\s\S]*wheel/);
  assert.match(source, /renderer[.]dispose[?][.]\(\)[\s\S]*renderer[.]forceContextLoss[?][.]\(\)/);
  assert.match(source, /moon-settlement-fallback__image[\s\S]*posterUrl/);
  assert.doesNotMatch(source, /<svg|data:image\/svg/,
    "the fallback reuses an authored project render rather than drawing a substitute asset");
  const authoredStructureIds = [
    "solar-power", "lunar-power", "bastion-shelter", "hive-shelter", "haven-shelter",
    "beacon-signal", "stars-signal", "starter-vault", "processor", "storage", "reservoir", "greenhouse"
  ];
  for (const tier of ["low", "standard"]) {
    assert.equal(MOON_SETTLEMENT_ASSETS[tier].moon, `./art/planet-hub/models/moon-${tier}.glb`);
    assert.equal(MOON_SETTLEMENT_ASSETS[tier].terrain, `./art/planet-hub/models/moon-landing-${tier}.glb`);
    assert.equal(MOON_SETTLEMENT_ASSETS[tier].lander, `./art/planet-hub/models/rocket-${tier}.glb`);
    assert.equal(MOON_SETTLEMENT_ASSETS[tier].portal, `./art/planet-hub/models/portal-${tier}.glb`);
    for (const assetId of authoredStructureIds) {
      assert.equal(MOON_SETTLEMENT_ASSETS[tier][assetId], `./art/moon-settlement/models/${assetId}-${tier}.glb`);
      assert.ok(MOON_SETTLEMENT_AUTHORED_ENVELOPES[assetId].height > 0);
      assert.ok(MOON_SETTLEMENT_AUTHORED_ENVELOPES[assetId].radius > 0);
    }
  }
  assert.deepEqual(Object.keys(MOON_SETTLEMENT_ASSETS.low), Object.keys(MOON_SETTLEMENT_ASSETS.standard),
    "low and standard tiers expose the same authored keys");
  for (const tier of ["low", "standard"]) {
    assert.deepEqual(Object.keys(MOON_SETTLEMENT_PBR_ASSETS[tier]), ["baseColor", "orm", "normal"]);
    for (const [channel, assetUrl] of Object.entries(MOON_SETTLEMENT_PBR_ASSETS[tier])) {
      assert.equal(assetUrl, `./art/moon-settlement/materials/fieldkit-${channel === "baseColor" ? "basecolor" : channel}-${tier}.png`);
      const texture = await readFile(new URL(`../public/${assetUrl.slice(2)}`, import.meta.url));
      assert.deepEqual([...texture.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    }
  }
  for (const profile of Object.values(MOON_SETTLEMENT_ASSETS)) {
    for (const assetUrl of Object.values(profile)) {
      const asset = await stat(new URL(`../public/${assetUrl.slice(2)}`, import.meta.url));
      assert.ok(asset.size > 0, `${assetUrl} must resolve to a non-empty authored asset`);
      assert.equal((await readFile(new URL(`../public/${assetUrl.slice(2)}`, import.meta.url))).subarray(0, 4).toString("utf8"), "glTF");
    }
  }
});
