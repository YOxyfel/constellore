import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";

import {
  PLANET_HUB_BODY_DOUBLE_TAP_MS,
  createPlanetHubInteraction,
  resolvePlanetHubOrbitReturnContract
} from "../public/planet-hub-runtime.mjs";
import {
  createPlanetHubCameraOrbitState,
  stepPlanetHubRotation
} from "../public/planet-hub-renderer.mjs";
import {
  PLANET_HUB_DISTANCE_STOPS,
  PLANET_HUB_VIEW_BANDS,
  PLANET_HUB_ZOOM_ANCHOR_PROGRESS,
  calculatePlanetHubWheelZoom,
  classifyPlanetHubViewBand,
  planetHubZoomDistanceToProgress,
  planetHubZoomProgressToDistance,
  resolvePlanetHubRepresentedDistance
} from "../public/planet-hub-zoom.mjs";
import {
  createCelestialBodyRegistry,
  projectCelestialLabels
} from "../public/celestial-atlas-runtime.mjs";
import {
  formatPlanetHubPlaceDistance,
  normalizePlanetHubPlace,
  resolvePlanetHubPlacesBackContract,
  resolvePlanetHubPlacesContext,
  resolvePlanetHubPlacesContextLabel,
  selectPlanetHubFeaturedPlaces
} from "../public/planet-hub-places.mjs";

class InteractionStage {
  constructor({ width = 1000, height = 700 } = {}) {
    this.listeners = new Map();
    this.dataset = {};
    this.clientWidth = width;
    this.clientHeight = height;
    this.captured = new Set();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  setPointerCapture(id) { this.captured.add(id); }
  releasePointerCapture(id) { this.captured.delete(id); }

  getBoundingClientRect() {
    return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight, width: this.clientWidth, height: this.clientHeight };
  }

  dispatch(type, init = {}) {
    const event = {
      target: this,
      pointerType: "mouse",
      pointerId: 1,
      button: 0,
      isPrimary: true,
      clientX: 0,
      clientY: 0,
      timeStamp: 0,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      ...init
    };
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }
}

const finePointerWindow = Object.freeze({
  matchMedia: () => ({ matches: false })
});

test("passive hover identifies bodies and landmarks but never steers the astronomical camera", () => {
  const stage = new InteractionStage();
  let target = { target: "mars", body: "mars" };
  const calls = [];
  const interaction = createPlanetHubInteraction({
    stage,
    windowRef: finePointerWindow,
    getAvailable: () => ["forge", "journey", "arena"],
    pickDetail: () => target,
    onHoverOrbit: (...args) => calls.push(["hover-orbit", ...args]),
    onDragOrbit: (...args) => calls.push(["drag-orbit", ...args]),
    onLandmarkHoverChange: (destination, meta) => calls.push(["highlight", destination, meta])
  });

  stage.dispatch("pointermove", { clientX: 700, clientY: 160, timeStamp: 10 });
  assert.equal(interaction.snapshotPointer().region, "body");
  assert.equal(calls.some(([kind]) => kind === "hover-orbit"), false);
  assert.equal(calls.some(([kind]) => kind === "drag-orbit"), false);

  target = { target: "forge", destination: "forge", action: "forge-enter" };
  stage.dispatch("pointermove", { clientX: 510, clientY: 360, timeStamp: 30 });
  assert.equal(interaction.snapshotPointer().region, "landmark");
  assert.equal(calls.some(([kind]) => kind === "hover-orbit"), false);
  assert.deepEqual(calls.filter(([kind]) => kind === "highlight").at(-1).slice(0, 2), ["highlight", "forge"]);
  interaction.destroy();
});

for (const pointerType of ["mouse", "touch"]) {
  test(`${pointerType} drag directly orbits and releases with physical input metadata`, () => {
    const stage = new InteractionStage({ width: 390, height: 844 });
    const drags = [];
    const releases = [];
    const interaction = createPlanetHubInteraction({
      stage,
      windowRef: finePointerWindow,
      pickDetail: () => ({ target: "earth", body: "earth" }),
      onDragOrbit: (delta, meta) => {
        drags.push([delta, meta]);
        return true;
      },
      onDragEnd: (meta) => {
        releases.push(meta);
        return true;
      }
    });
    const source = pointerType === "touch" ? "touch-orbit" : "pointer-drag";
    stage.dispatch("pointerdown", {
      pointerId: 12,
      pointerType,
      clientX: 80,
      clientY: 120,
      timeStamp: 100
    });
    const move = stage.dispatch("pointermove", {
      pointerId: 12,
      pointerType,
      clientX: 150,
      clientY: 148,
      timeStamp: 132
    });
    stage.dispatch("pointerup", {
      pointerId: 12,
      pointerType,
      clientX: 188,
      clientY: 166,
      timeStamp: 164
    });

    assert.equal(drags.length, 1);
    assert.deepEqual(drags[0][0], { deltaX: 70, deltaY: 28, deltaMs: 32 });
    assert.equal(drags[0][1].source, source);
    assert.equal(move.defaultPrevented, true);
    assert.equal(releases.length, 1);
    assert.equal(releases[0].cancelled, false);
    assert.equal(releases[0].pointerType, pointerType);
    assert.ok(releases[0].distancePx > 110);
    assert.ok(releases[0].recentSpeedPxPerMs > 0);
    interaction.destroy();
  });
}

test("single click selects and only a spatially close same-body double click focuses a generic body", () => {
  const stage = new InteractionStage();
  let body = "mars";
  const selected = [];
  const focused = [];
  const interaction = createPlanetHubInteraction({
    stage,
    windowRef: finePointerWindow,
    pickDetail: () => ({ target: body, body }),
    onBodySelect: (id, meta) => selected.push([id, meta.source]),
    onBodyFocus: (id, meta) => focused.push([id, meta.source])
  });
  const click = ({ id, at, x = 300, y = 220 }) => {
    stage.dispatch("pointerdown", { pointerId: id, clientX: x, clientY: y, timeStamp: at });
    stage.dispatch("pointerup", { pointerId: id, clientX: x, clientY: y, timeStamp: at + 20 });
  };

  click({ id: 1, at: 10 });
  assert.deepEqual(selected, [["mars", "body-click"]]);
  assert.deepEqual(focused, []);

  body = "jupiter";
  click({ id: 2, at: 120 });
  assert.deepEqual(selected.at(-1), ["jupiter", "body-click"]);
  assert.deepEqual(focused, [], "switching bodies cannot borrow the previous body's click");

  click({ id: 3, at: 520, x: 306, y: 226 });
  assert.deepEqual(focused, [["jupiter", "body-double-click"]]);
  assert.equal(selected.filter(([id]) => id === "jupiter").length, 1,
    "the second click commits focus rather than toggling selection twice");
  interaction.destroy();
});

test("generic body navigation keeps one persistent semantic return contract", () => {
  assert.equal(PLANET_HUB_BODY_DOUBLE_TAP_MS, 500);
  assert.deepEqual(resolvePlanetHubOrbitReturnContract({
    mode: "overview",
    worldId: "earth",
    orbitBodyId: "mars",
    selectedBodyId: "mars"
  }), {
    visible: true,
    kind: "body-focus",
    action: "solar-system",
    label: "← Solar system",
    ariaLabel: "Back to Solar System"
  });
  assert.equal(resolvePlanetHubOrbitReturnContract({
    worldId: "earth",
    orbitBodyId: "earth",
    selectedBodyId: "saturn"
  }).action, "reset-view");
  assert.equal(resolvePlanetHubOrbitReturnContract({
    mode: "focused",
    worldId: "earth"
  }).action, "exit-focus");
  assert.equal(resolvePlanetHubOrbitReturnContract({ worldId: "earth" }).visible, false);
});

test("Places normalizes renderer descriptors and keeps five useful featured choices per scale", () => {
  const descriptor = normalizePlanetHubPlace({
    placeId: "sirius",
    name: "Sirius",
    type: "star",
    distanceLabel: "8.6 light-years away",
    capabilities: { select: true, visit: true },
    thumbnail: { hue: 204, pattern: "star" }
  });
  assert.deepEqual(descriptor, {
    id: "sirius",
    label: "Sirius",
    kind: "star",
    tier: null,
    detail: "8.6 light-years away",
    bodyId: null,
    available: true,
    selectable: true,
    visitable: true,
    featured: false,
    thumbnail: { hue: 204, pattern: "star" }
  });

  const solar = resolvePlanetHubPlacesContext({ viewBand: "system", selectedPlaceId: "earth", visitedPlaceId: "earth" });
  const stars = resolvePlanetHubPlacesContext({ viewBand: "galaxy", selectedPlaceId: "solar-system" });
  const milkyWay = resolvePlanetHubPlacesContext({ viewBand: "universe", visitedPlaceId: "solar-system" });
  assert.equal(solar.label, "Solar System");
  assert.ok(solar.places.length > 5, "All/search has more places than the featured five");
  const solarThumbnails = new Map(solar.places.map((place) => [place.id, place.thumbnail]));
  assert.deepEqual([
    "sun", "mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn", "uranus", "neptune"
  ].map((id) => [solarThumbnails.get(id).sprite, solarThumbnails.get(id).spriteIndex]), [
    ["sun", 0], ["mercury", 1], ["venus", 2], ["earth", 3], ["moon", 4],
    ["mars", 5], ["jupiter", 6], ["saturn", 7], ["uranus", 8], ["neptune", 9]
  ]);
  assert.equal(stars.label, "Nearby Stars");
  assert.ok(stars.places.slice(0, 5).some(({ id }) => id === "sirius"));
  assert.equal(stars.places.find(({ id }) => id === "sirius").visitable, false,
    "fallback stars do not advertise an action that the renderer cannot execute");
  const navigableStars = resolvePlanetHubPlacesContext({
    viewBand: "galaxy",
    capabilities: { selectPlace: true, visitPlace: true }
  });
  assert.equal(navigableStars.places.find(({ id }) => id === "sirius").visitable, true);
  assert.equal(milkyWay.label, "Milky Way");
  assert.ok(milkyWay.places.some(({ id }) => id === "galactic-centre"));
});

test("Places derives useful astronomical distance copy and authored cosmic headings", () => {
  assert.equal(formatPlanetHubPlaceDistance({ distanceLightYears: 4.37 }), "4.37 light-years away");
  assert.equal(formatPlanetHubPlaceDistance({ distanceLightYears: 2_500_000 }), "2.5 Mly away");
  assert.equal(formatPlanetHubPlaceDistance({
    distanceLightYears: 31_810_000_000,
    redshift: 10.6
  }), "31.81 Gly away comoving · redshift z 10.6");
  assert.equal(formatPlanetHubPlaceDistance({
    distanceMeaning: "contains-observer",
    extentLightYears: 100_000
  }), "Contains our location · spans about 100,000 light-years");
  assert.equal(resolvePlanetHubPlacesContextLabel("deepSky"), "Star Clusters & Nebulae");
  assert.equal(resolvePlanetHubPlacesContextLabel("local-group"), "Local Group");
  assert.equal(resolvePlanetHubPlacesContextLabel("observable-universe"), "Observable Universe");

  const andromeda = normalizePlanetHubPlace({
    id: "andromeda",
    label: "Andromeda Galaxy",
    kind: "spiral-galaxy",
    tierId: "local-group",
    distanceLightYears: 2_500_000,
    selectable: true,
    visitable: true
  }, { selectPlace: true, visitPlace: true });
  assert.equal(andromeda.detail, "Spiral galaxy · 2.5 Mly away");
  assert.equal(andromeda.tier, "local-group");
  assert.equal(andromeda.thumbnail.pattern, "galaxy");

  const stellarSystem = normalizePlanetHubPlace({
    id: "rigil-kent",
    label: "Rigil Kent",
    kind: "nearby-star",
    tier: "stellar",
    distanceLightYears: 4.37
  }, { selectPlace: true, visitPlace: true });
  const openCluster = normalizePlanetHubPlace({
    id: "beehive",
    label: "Beehive",
    kind: "deep-sky-object",
    tier: "deep-sky",
    distanceLightYears: 577
  }, { selectPlace: true, visitPlace: true });
  const globularCluster = normalizePlanetHubPlace({
    id: "messier-54",
    label: "Messier 54",
    kind: "deep-sky-object",
    tier: "deep-sky",
    distanceLightYears: 87_400
  }, { selectPlace: true, visitPlace: true });
  assert.equal(stellarSystem.detail, "Stellar system · 4.37 light-years away");
  assert.equal(openCluster.detail, "Open cluster · 577 light-years away");
  assert.equal(globularCluster.detail, "Globular cluster · 87,400 light-years away");
});

test("Places fills Featured to five and rejects stale selections from another scale", () => {
  const values = Array.from({ length: 7 }, (_, index) => Object.freeze({
    id: `place-${index}`,
    featured: index === 3
  }));
  assert.deepEqual(selectPlanetHubFeaturedPlaces(values).map(({ id }) => id), [
    "place-3", "place-0", "place-1", "place-2", "place-4"
  ]);

  const context = resolvePlanetHubPlacesContext({
    navigationContext: {
      id: "astronomy-solar",
      owner: "solar",
      label: "solar",
      selectedPlaceId: "sirius",
      places: [
        { id: "earth", label: "Earth", kind: "planet", tier: "solar", bodyId: "earth" },
        { id: "sirius", label: "Sirius", kind: "nearby-star", tier: "stellar", distanceLightYears: 8.6 }
      ]
    },
    capabilities: { selectPlace: true, visitPlace: true }
  });
  assert.equal(context.label, "Solar System");
  assert.deepEqual(context.places.map(({ id }) => id), ["earth"]);
  assert.equal(context.selectedPlaceId, "sirius",
    "history may retain the selection id while the current-scale list stays clean");
});

test("Places history takes priority over the legacy return contract without mutating it", () => {
  const fallback = resolvePlanetHubOrbitReturnContract({
    worldId: "earth",
    orbitBodyId: "mars",
    selectedBodyId: "mars"
  });
  const history = [Object.freeze({ placeId: "earth", label: "Earth" })];
  assert.deepEqual(resolvePlanetHubPlacesBackContract(history, fallback), {
    visible: true,
    kind: "place-history",
    action: "place-history",
    label: "← Earth",
    ariaLabel: "Back to Earth"
  });
  assert.equal(resolvePlanetHubPlacesBackContract([], fallback), fallback);
  assert.equal(fallback.action, "solar-system");
  assert.equal(resolvePlanetHubPlacesBackContract(history, fallback).label.codePointAt(0), 0x2190,
    "the visible Back affordance begins with an actual UTF-8 left arrow");
});

test("projected labels follow their body and disappear offscreen or behind nearer geometry", () => {
  const registry = createCelestialBodyRegistry({
    definitions: [
      { id: "near", label: "Near", parentId: null, radius: 0.72, focusRadius: 2, selectable: true, available: true },
      { id: "moving", label: "Moving", parentId: null, radius: 0.12, focusRadius: 0.5, selectable: true, available: true },
      { id: "hidden", label: "Hidden", parentId: null, radius: 0.12, focusRadius: 0.5, selectable: true, available: false },
      { id: "outside", label: "Outside", parentId: null, radius: 0.12, focusRadius: 0.5, selectable: true, available: false }
    ]
  });
  const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const project = (movingX) => projectCelestialLabels({
    layout: {
      positions: {
        near: [0, -0.25, 0],
        moving: [movingX, 0, -0.15],
        hidden: [0, -0.18, -2.2],
        outside: [100, 0, 0]
      }
    },
    registry,
    viewProjectionMatrix: matrix,
    viewport: { width: 1280, height: 720 },
    cameraPosition: camera.position,
    selectedBodyId: "moving",
    maxLabels: 10
  });
  const left = project(-1.4);
  const right = project(1.4);
  const leftMoving = left.find(({ id }) => id === "moving");
  const rightMoving = right.find(({ id }) => id === "moving");
  assert.ok(leftMoving && rightMoving);
  assert.ok(leftMoving.x < rightMoving.x, "screen-space label position follows its 3D anchor");
  assert.equal(left.some(({ id }) => id === "hidden"), false, "a nearer sphere occludes the body behind it");
  assert.equal(left.some(({ id }) => id === "outside"), false, "offscreen labels never enter collision layout");
});

test("continuous physical logarithmic zoom traverses all semantic bands and round-trips without jumps", () => {
  const bands = new Set();
  let previousDistance = 0;
  let previousRebaseIndex = 0;
  for (let index = 0; index <= 1000; index += 1) {
    const progress = index / 1000;
    const distance = planetHubZoomProgressToDistance(progress);
    const rebase = resolvePlanetHubRepresentedDistance(progress);
    bands.add(classifyPlanetHubViewBand({ progress }));
    assert.ok(distance >= previousDistance, `represented distance stays monotonic at sample ${index}`);
    assert.ok(Math.abs(planetHubZoomDistanceToProgress(distance) - progress) < 1e-9);
    assert.ok(rebase.localDollyFactor >= 1 - 1e-9 && rebase.localDollyFactor < 1.2 ** 8 + 1e-9,
      `sample ${index} remains inside one precision-safe render cell`);
    assert.ok(rebase.rebaseIndex >= previousRebaseIndex,
      `sample ${index} cannot reverse its local coordinate root while physical distance increases`);
    if (index > 0) {
      const relativeStep = distance / previousDistance;
      assert.ok(relativeStep > 0.999 && relativeStep < 1.2, `sample ${index} remains visually continuous`);
    }
    previousDistance = distance;
    previousRebaseIndex = rebase.rebaseIndex;
  }
  assert.deepEqual([...bands], PLANET_HUB_VIEW_BANDS);
  assert.ok(Math.abs(previousDistance / PLANET_HUB_DISTANCE_STOPS.universe - 1) < 1e-12);
  for (const band of PLANET_HUB_VIEW_BANDS) {
    assert.equal(classifyPlanetHubViewBand({ progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS[band] }), band,
      `${band} owns its physical-distance anchor`);
  }
});

test("wheel zoom changes radial intent without consuming the active angular coast", async () => {
  const orbit = createPlanetHubCameraOrbitState({
    position: [0, 0, 4.5],
    target: [0, 0, 0],
    velocity: { yaw: 1.4, pitch: -0.36 }
  });
  const wheel = calculatePlanetHubWheelZoom({ progress: 0.25, deltaY: 140 });
  const nextDistance = planetHubZoomProgressToDistance(wheel.progress);
  const coast = stepPlanetHubRotation({
    velocity: orbit.velocity,
    input: null,
    idleYaw: 0,
    releaseResponse: 3.4,
    deltaSeconds: 1 / 60
  });
  assert.ok(nextDistance > planetHubZoomProgressToDistance(0.25));
  assert.equal(Math.sign(coast.velocity.yaw), Math.sign(orbit.velocity.yaw));
  assert.equal(Math.sign(coast.velocity.pitch), Math.sign(orbit.velocity.pitch));

  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const start = source.indexOf("function setViewZoom(");
  const end = source.indexOf("\n  function adoptDestination", start);
  assert.ok(start > 0 && end > start, "renderer exposes a focused zoom implementation seam");
  const implementation = source.slice(start, end);
  assert.doesNotMatch(implementation, /orbitVelocity\s*=\s*\{\s*yaw:\s*0/, "wheel/pinch zoom must not zero angular inertia");
  assert.match(implementation, /Preserve angular coast/, "the intentional inertia contract stays documented beside its implementation");
});

test("renderer public API exposes generic selection and labels used by runtime", async () => {
  const source = await readFile(new URL("../public/planet-hub-renderer.mjs", import.meta.url), "utf8");
  const publicApi = source.slice(source.lastIndexOf("return Object.freeze({"), source.lastIndexOf("} catch (error)"));
  assert.match(publicApi, /\bsetSelectedBody\s*,/, "single-click selection must be callable through the renderer boundary");
  assert.match(publicApi, /\bgetBodyLabel\s*,/, "runtime status must read generic atlas labels through the renderer boundary");

  const pickStart = source.indexOf("function pickDetail(");
  const pickEnd = source.indexOf("\n  function satellitePointerMove(", pickStart);
  assert.ok(pickStart > 0 && pickEnd > pickStart);
  const picking = source.slice(pickStart, pickEnd);
  assert.match(picking, /celestialAtlas[^\n]*(bodies|bodyRoot)/,
    "generic atlas bodies must join the raycast roots before same-body double-click can focus them");
});

test("body focus and body selection expose the same cinematic return affordance as landmark focus", async () => {
  const css = await readFile(new URL("../public/planet-hub.css", import.meta.url), "utf8");
  const selector = css.slice(css.indexOf("[data-home-hub-return=\"body-focus\"]") - 180,
    css.indexOf("[data-home-hub-return=\"body-selection\"]") + 180);
  assert.match(selector, /data-home-hub-mode="focused"/);
  assert.match(selector, /data-home-hub-return="body-focus"/);
  assert.match(selector, /data-home-hub-return="body-selection"/);
  assert.match(css, /data-home-hub-return="place-history"/,
    "Places history must reveal the shared Back control outside legacy body modes");
  assert.match(selector, /opacity:\s*1/);
  assert.match(css, /data-planet-hub-return-kind="body-focus"[\s\S]{0,260}?color:\s*#fff0c5/i,
    "Solar-system return copy gets a distinct warm chart treatment");
  assert.match(css, /data-planet-hub-return-kind="body-selection"[\s\S]{0,220}?color:\s*#d9faff/i,
    "Selection reset stays visibly separate from a full body-focus return");
  assert.match(css, /data-planet-hub-return-kind="place-history"[\s\S]{0,220}?color:\s*#fff0c5/i,
    "Places history uses the warm Back treatment without requiring body focus");
});

test("Home exposes one accessible semantic zoom rail without making canvas the control", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/planet-hub.css", import.meta.url), "utf8");
  const runtime = await readFile(new URL("../public/planet-hub-runtime.mjs", import.meta.url), "utf8");
  const rail = html.slice(html.indexOf("data-planet-hub-zoom-rail"), html.indexOf("data-planet-hub-world-inspection"));
  assert.match(rail, /role="radiogroup"/);
  assert.equal((rail.match(/data-planet-hub-zoom-stop=/g) || []).length, 5);
  assert.match(rail, /data-planet-hub-zoom-stop="planet"/);
  assert.match(rail, /data-planet-hub-zoom-stop="galaxy"/);
  assert.match(rail, /data-planet-hub-zoom-stop="universe"/);
  assert.match(rail, /<output[\s\S]*?data-planet-hub-distance/);
  assert.match(rail, /data-planet-hub-distance-value[\s\S]*?data-planet-hub-distance-unit/);
  assert.match(rail, /aria-label="Current view distance: 12,742 kilometres"/);
  assert.match(runtime, /PLANET_HUB_SEMANTIC_ZOOM_STOPS[\s\S]{0,240}?PLANET_HUB_VIEW_BANDS[.]map[\s\S]{0,160}?PLANET_HUB_ZOOM_ANCHOR_PROGRESS/);
  assert.match(runtime, /applyViewZoom\(stop[.]progress/,
    "named stops delegate to the same camera authority as wheel and pinch");
  assert.match(runtime, /ArrowUp[\s\S]{0,240}?PageDown[\s\S]{0,240}?Home[\s\S]{0,120}?End/);
  assert.match(runtime, /returnKind[\s\S]{0,260}?body-focus[\s\S]{0,100}?body-selection/,
    "celestial body return/status owns the mobile-safe control region instead of the zoom rail");
  assert.match(runtime, /dialog\[open\][\s\S]{0,900}?!dialogOpen/,
    "dialogs make the rail inert as well as invisible");
  assert.match(css, /planet-hub__zoom-stops[^}]*[\s\S]{0,1000}?min-height:\s*48px/);
  assert.match(css, /planet-hub__distance-readout[\s\S]{0,400}?font-variant-numeric:\s*tabular-nums/);
  assert.match(css, /planet-hub__distance-readout[\s\S]{0,260}?grid-column:\s*1\s*\/\s*-1/,
    "the physical ruler gets a dedicated mobile row instead of squeezing the five zoom stops");
  assert.match(css, /data-planet-hub-journey-flight="true"[^\n]*planet-hub__zoom-rail/);
  assert.match(css, /:has\(dialog\[open\]/);
});

test("Home exposes an accessible optional Places drawer with a compact bottom sheet", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const [baseCss, placesCss] = await Promise.all([
    readFile(new URL("../public/planet-hub.css", import.meta.url), "utf8"),
    readFile(new URL("../public/planet-hub-cinematic.css", import.meta.url), "utf8")
  ]);
  const css = `${baseCss}\n${placesCss}`;
  const runtime = await readFile(new URL("../public/planet-hub-runtime.mjs", import.meta.url), "utf8");
  const places = html.slice(html.indexOf("data-planet-hub-places-toggle"), html.indexOf("data-planet-hub-zoom-rail"));
  assert.match(places, /<aside[\s\S]*?data-planet-hub-places/);
  assert.match(places, /aria-labelledby="planetHubPlacesHeading"/);
  assert.match(places, /data-planet-hub-places-search/);
  assert.match(places, /data-planet-hub-places-all[^>]*aria-pressed="false"/);
  assert.match(places, /data-planet-hub-places-list[^>]*aria-label="Celestial places"/);
  assert.ok((places.match(/data-planet-hub-ignore-gesture/g) || []).length >= 3);
  assert.ok((places.match(/data-planet-hub-ignore-zoom/g) || []).length >= 3);
  assert.match(css, /--planet-hub-places-width:\s*clamp\(/);
  assert.match(css, /--planet-hub-places-sheet-height:\s*min\(46dvh,\s*430px\)/);
  assert.match(css, /planet-hub-places__list[\s\S]{0,360}?overflow:\s*hidden auto/);
  assert.match(css, /planet-hub-places__toggle[\s\S]{0,900}?min-height:\s*48px/);
  assert.match(css, /planet-hub-places__close[\s\S]{0,220}?width:\s*48px[\s\S]{0,80}?height:\s*48px/);
  assert.match(css, /planet-hub-places__search[\s\S]{0,180}?min-height:\s*48px/);
  assert.match(css, /data-planet-hub-places-all[\s\S]{0,180}?min-height:\s*48px/);
  assert.match(css, /planet-hub-places__select[^}]*[\s\S]{0,150}?min-height:\s*48px/);
  assert.match(css, /planet-hub-places__thumbnail\[data-sprite\][\s\S]{0,400}?place-thumbnails\/solar-bodies[.]webp/,
    "solar Places use the one-request generated portrait sprite");
  assert.match(css, /background-size:\s*1000%\s+100%/,
    "the ten authored portraits map to ten exact horizontal sprite tiles");
  assert.match(css, /data-planet-hub-places-visible="true"[^}]*data-planet-hub-orbit-return[^}]*left:\s*calc\(max\(var\(--planet-hub-safe-left\),\s*14px\)\s*\+\s*var\(--planet-hub-places-width\)\s*\+\s*12px\)/,
    "desktop Back stays reachable beside the Places panel rather than underneath it");
  assert.match(css, /@media \(max-width:\s*900px\)[\s\S]*?planet-hub-places-sheet-in/);
  assert.match(runtime, /placesLoader\s*=\s*\(specifier\)\s*=>\s*import\(specifier\)/,
    "the substantial Places controller stays behind a computed optional import");
  assert.match(runtime, /selectPlace:[\s\S]{0,360}?visitPlace:[\s\S]{0,360}?backPlace:/,
    "the runtime exposes semantic wrappers instead of renderer internals");
});

test("atlas labels separate locked future worlds from available body names", async () => {
  const css = await readFile(new URL("../public/planet-hub.css", import.meta.url), "utf8");
  assert.match(css, /[.]planet-hub__label small:empty\s*\{[^}]*display:\s*none/i);
  assert.match(css, /[.]planet-hub__label small:not\(:empty\)\s*\{[^}]*border:[^}]*background:/i,
    "FUTURE is a compact status badge rather than undifferentiated name text");
  assert.match(css, /[.]planet-hub__label:has\(small:not\(:empty\)\)/,
    "locked bodies have an explicit lower-emphasis label state");
});
