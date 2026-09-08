import assert from "node:assert/strict";
import test from "node:test";

import { selectPlanetHubQuality } from "../public/planet-hub-domain.mjs";
import {
  PLANET_HUB_DISTANCE_METERS,
  PLANET_HUB_DISTANCE_STOPS,
  PLANET_HUB_VIEW_BANDS,
  PLANET_HUB_ZOOM_ANCHOR_PROGRESS,
  classifyPlanetHubViewBand,
  classifyPlanetHubCosmicViewTier,
  resolvePlanetHubCosmicRepresentedDistance,
  resolvePlanetHubRepresentedDistance
} from "../public/planet-hub-zoom.mjs";

import {
  createPlanetHub,
  createPlanetHubInteraction,
  formatPlanetHubRepresentedDistance,
  normalizePlanetHubEffectsLevel,
  PLANET_HUB_SEMANTIC_ZOOM_STOPS,
  readPlanetHubCapabilities,
  readPlanetHubQualityOverride,
  resolvePlanetHubSemanticZoomKey,
  resolvePlanetHubJourneyAudioTimeline,
  resolvePlanetHubJourneyControls
} from "../public/planet-hub-runtime.mjs";

test("space effects preferences normalize to supported modes", () => {
  assert.equal(normalizePlanetHubEffectsLevel("reduced"), "reduced");
  assert.equal(normalizePlanetHubEffectsLevel("unknown"), "full");
  assert.equal(normalizePlanetHubEffectsLevel("off"), "off");
});

test("semantic zoom stops expose the authored Planet through Universe hierarchy", () => {
  assert.deepEqual(PLANET_HUB_SEMANTIC_ZOOM_STOPS,
    PLANET_HUB_VIEW_BANDS.map((band) => ({
      band,
      progress: PLANET_HUB_ZOOM_ANCHOR_PROGRESS[band]
    })),
  "the accessible rail follows the physical-distance anchors instead of retaining the old compressed camera stops");
  assert.equal(resolvePlanetHubSemanticZoomKey("ArrowDown", 0), 1);
  assert.equal(resolvePlanetHubSemanticZoomKey("ArrowRight", 1), 2);
  assert.equal(resolvePlanetHubSemanticZoomKey("PageDown", 2), 3);
  assert.equal(resolvePlanetHubSemanticZoomKey("ArrowDown", 3), 4);
  assert.equal(resolvePlanetHubSemanticZoomKey("ArrowUp", 4), 3);
  assert.equal(resolvePlanetHubSemanticZoomKey("PageUp", 2), 1);
  assert.equal(resolvePlanetHubSemanticZoomKey("Home", 3), 0);
  assert.equal(resolvePlanetHubSemanticZoomKey("End", 0), 4);
  assert.equal(resolvePlanetHubSemanticZoomKey("Escape", 2), null);
});

test("physical distance ruler advances from kilometres to the Milky Way", () => {
  assert.deepEqual(
    [
      PLANET_HUB_DISTANCE_STOPS.planet,
      PLANET_HUB_DISTANCE_STOPS.orbit,
      PLANET_HUB_DISTANCE_STOPS.system,
      PLANET_HUB_DISTANCE_STOPS.galaxy,
      PLANET_HUB_DISTANCE_STOPS.universe
    ].map((distance) => {
      const formatted = formatPlanetHubRepresentedDistance(distance);
      return [formatted.label, formatted.unit];
    }),
    [
      ["12,742", "km"],
      ["384,400", "km"],
      ["2", "AU"],
      ["10", "ly"],
      ["204", "kly"]
    ]
  );
  assert.equal(
    formatPlanetHubRepresentedDistance(PLANET_HUB_DISTANCE_METERS.au).ariaLabel,
    "Current view distance: 1 astronomical unit"
  );
  assert.deepEqual(
    [
      formatPlanetHubRepresentedDistance(10_000_000 * PLANET_HUB_DISTANCE_METERS.lightYear),
      formatPlanetHubRepresentedDistance(10_000_000_000 * PLANET_HUB_DISTANCE_METERS.lightYear)
    ].map(({ label, unit }) => [label, unit]),
    [["10", "Mly"], ["10", "Gly"]]
  );
});

class FakeElement {
  constructor(tagName = "DIV") {
    this.tagName = tagName;
    this.dataset = {};
    this.listeners = new Map();
    this.children = [];
    this.attributes = new Map();
    this.hidden = false;
    this.parentNode = null;
    this.parentElement = null;
    this.clientWidth = 800;
    this.clientHeight = 500;
    this.scrollWidth = 800;
    this.scrollHeight = 500;
  }
  addEventListener(type, listener, options = false) {
    const values = this.listeners.get(type) || [];
    values.push({ listener, capture: options === true || options?.capture === true });
    this.listeners.set(type, values);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((value) => value.listener !== listener));
  }
  dispatch(type, event = {}) {
    let immediateStopped = false;
    let defaultPrevented = false;
    const value = {
      type,
      target: this,
      currentTarget: this,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      timeStamp: 0,
      preventDefault() { defaultPrevented = true; },
      stopImmediatePropagation() { immediateStopped = true; },
      ...event
    };
    const ordered = [...(this.listeners.get(type) || [])].sort((a, b) => Number(b.capture) - Number(a.capture));
    for (const { listener } of ordered) {
      listener(value);
      if (immediateStopped) break;
    }
    return !defaultPrevented;
  }
  click() {
    this.clickCount = (this.clickCount || 0) + 1;
    this.dispatch("click", { currentTarget: this });
  }
  append(child) {
    child.parentNode = this;
    child.parentElement = this;
    this.children.push(child);
  }
  appendChild(child) { this.append(child); }
  querySelector(selector) {
    if (selector === "canvas[data-planet-hub-canvas]") return this.children.find((child) => child.tagName === "CANVAS") || null;
    const datasetKey = ({
      "[data-planet-hub-poster]": "planetHubPoster",
      "[data-planet-hub-orbit-return]": "planetHubOrbitReturn",
      "[data-planet-hub-world-inspection]": "planetHubWorldInspection",
      "[data-planet-hub-inspection-return]": "planetHubInspectionReturn",
      "[data-planet-hub-inspection-title]": "planetHubInspectionTitle",
      "[data-planet-hub-inspection-detail]": "planetHubInspectionDetail",
      "[data-planet-hub-inspection-select]": "planetHubInspectionSelect",
      "[data-planet-hub-world-switch]": "planetHubWorldSwitch",
      "[data-planet-hub-world-switch-icon]": "planetHubWorldSwitchIcon",
      "[data-planet-hub-world-switch-label]": "planetHubWorldSwitchLabel",
      "[data-planet-hub-zoom-rail]": "planetHubZoomRail",
      "[data-planet-hub-zoom-reset]": "planetHubZoomReset",
      "[data-planet-hub-distance]": "planetHubDistance",
      "[data-planet-hub-distance-value]": "planetHubDistanceValue",
      "[data-planet-hub-distance-unit]": "planetHubDistanceUnit"
    })[selector];
    if (datasetKey) {
      const pending = [...this.children];
      while (pending.length) {
        const child = pending.shift();
        if (datasetKey in child.dataset) return child;
        pending.push(...(child.children || []));
      }
    }
    return null;
  }
  querySelectorAll(selector) {
    if (selector !== "[data-planet-hub-zoom-stop]") return [];
    const matches = [];
    const pending = [...this.children];
    while (pending.length) {
      const child = pending.shift();
      if ("planetHubZoomStop" in child.dataset) matches.push(child);
      pending.push(...(child.children || []));
    }
    return matches;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  getBoundingClientRect() { return { left: 0, right: 800, top: 0, bottom: 500, width: 800, height: 500 }; }
  setPointerCapture() {}
  releasePointerCapture() {}
  closest() { return null; }
  remove() { this.removed = true; }
  focus(options) { this.focused = true; this.focusOptions = options; }
  getContext(type) { return type === "webgl2" ? {} : null; }
}

function manifestFixture() {
  const tier = (world, quality) => ({
    planet: `${world}-${quality}.glb`,
    landmarks: Object.fromEntries(["forge", "journey", "arena"].map((destination) => [destination, `${world}-${destination}-${quality}.glb`]))
  });
  return {
    schemaVersion: 1,
    worlds: Object.fromEntries(["earth", "moon"].map((world) => [world, {
      posters: Object.fromEntries(["forge", "journey", "arena"].map((destination) => [destination, `${world}-${destination}.webp`])),
      tiers: { low: tier(world, "low"), standard: tier(world, "standard") }
    }])),
    portal: { mp4: "portal.mp4", webm: "portal.webm", poster: "portal.webp", width: 1024, height: 512, frameCount: 200, durationSeconds: 6.667 }
  };
}

function fixture({
  capabilities,
  onSelect,
  onWorldSelect,
  rendererFactory,
  pick = () => "arena",
  pickDetail = null,
  useDefaultFocus = false,
  elements = new Map(),
  actionElements = null,
  withOrbitController = false,
  clearOrbitReportsReady = false,
  journeyDeparture = () => Promise.resolve(true),
  journeyReturn = () => Promise.resolve(true),
  withZoomRail = false,
  reducedMotion = false,
  placesLoader = null
} = {}) {
  const root = new FakeElement();
  const orbitRoot = new FakeElement();
  const orbitReturn = new FakeElement("BUTTON");
  orbitReturn.dataset.planetHubOrbitReturn = "";
  orbitRoot.append(orbitReturn);
  const worldInspection = new FakeElement("SECTION");
  worldInspection.dataset.planetHubWorldInspection = "";
  const inspectionCopy = new FakeElement();
  inspectionCopy.dataset.planetHubInspectionCopy = "";
  const inspectionMessage = new FakeElement("STRONG");
  inspectionMessage.dataset.planetHubInspectionTitle = "";
  inspectionMessage.textContent = "Not unlocked yet";
  inspectionCopy.append(inspectionMessage);
  const inspectionDetail = new FakeElement("P");
  inspectionDetail.dataset.planetHubInspectionDetail = "";
  inspectionCopy.append(inspectionDetail);
  worldInspection.append(inspectionCopy);
  const inspectionReturn = new FakeElement("BUTTON");
  inspectionReturn.dataset.planetHubInspectionReturn = "";
  worldInspection.append(inspectionReturn);
  const inspectionSelect = new FakeElement("BUTTON");
  inspectionSelect.dataset.planetHubInspectionSelect = "";
  worldInspection.append(inspectionSelect);
  orbitRoot.append(worldInspection);
  const worldSwitch = new FakeElement("BUTTON");
  worldSwitch.dataset.planetHubWorldSwitch = "";
  const worldSwitchIcon = new FakeElement("SPAN");
  worldSwitchIcon.dataset.planetHubWorldSwitchIcon = "";
  const worldSwitchLabel = new FakeElement("STRONG");
  worldSwitchLabel.dataset.planetHubWorldSwitchLabel = "";
  worldSwitch.append(worldSwitchIcon);
  worldSwitch.append(worldSwitchLabel);
  orbitRoot.append(worldSwitch);
  if (withZoomRail) {
    const zoomRail = new FakeElement("NAV");
    zoomRail.dataset.planetHubZoomRail = "";
    const zoomReset = new FakeElement("BUTTON");
    zoomReset.dataset.planetHubZoomReset = "";
    zoomRail.append(zoomReset);
    const zoomDistance = new FakeElement("OUTPUT");
    zoomDistance.dataset.planetHubDistance = "";
    const zoomDistanceValue = new FakeElement("STRONG");
    zoomDistanceValue.dataset.planetHubDistanceValue = "";
    zoomDistance.append(zoomDistanceValue);
    const zoomDistanceUnit = new FakeElement("ABBR");
    zoomDistanceUnit.dataset.planetHubDistanceUnit = "";
    zoomDistance.append(zoomDistanceUnit);
    zoomRail.append(zoomDistance);
    const zoomStops = new FakeElement();
    for (const { band } of PLANET_HUB_SEMANTIC_ZOOM_STOPS) {
      const control = new FakeElement("BUTTON");
      control.dataset.planetHubZoomStop = band;
      zoomStops.append(control);
    }
    zoomRail.append(zoomStops);
    orbitRoot.append(zoomRail);
  }
  const documentRef = new FakeElement("DOCUMENT");
  documentRef.hidden = false;
  documentRef.createElement = (tag) => new FakeElement(tag.toUpperCase());
  documentRef.getElementById = (id) => elements.get(id) || null;
  documentRef.defaultView = null;
  const windowRef = {
    innerWidth: 1440,
    innerHeight: 900,
    devicePixelRatio: 2,
    navigator: { deviceMemory: 8, hardwareConcurrency: 8, connection: { saveData: false } },
    matchMedia: () => ({ matches: false }),
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (callback) => setTimeout(() => callback(performance.now()), 0),
    cancelAnimationFrame: clearTimeout,
    performance
  };
  documentRef.defaultView = windowRef;
  root.ownerDocument = documentRef;
  const calls = [];
  let reportCenter = () => false;
  let reportSatellite = () => false;
  let reportPhase = () => false;
  let reportInteractionFrame = () => false;
  const fakeRendererFactory = rendererFactory || (async (options) => {
    calls.push(["create", options.worldId, options.quality]);
    reportCenter = options.onCenterDestination || reportCenter;
    reportSatellite = options.onSatelliteFocusChange || reportSatellite;
    reportPhase = options.onPhase || reportPhase;
    reportInteractionFrame = options.onInteractionFrame || reportInteractionFrame;
    options.onSpaceState?.(options.effectsLevel === "off" ? "static" : "dynamic");
    let fakeZoom = {
      ...resolvePlanetHubRepresentedDistance(0),
      targetProgress: 0,
      segment: "legacy",
      cosmicProgress: 0,
      cosmicTargetProgress: 0,
      cosmicTier: null,
      velocity: 0,
      radius: 4.5,
      band: "planet",
      bounds: { minRadius: 4.5, maxRadius: 40, maxFactor: 8.89, logRange: Math.log(8.89) }
    };
    options.onViewChange?.(fakeZoom);
    return {
      setDestination: (destination, meta) => calls.push(["destination", destination, meta]),
      setHubMode: (mode, destination, meta) => calls.push(["mode", mode, destination, meta]),
      setPointerPreview: (destination, meta) => calls.push(["pointer-preview", destination, meta]),
      clearPointerPreview: (meta) => calls.push(["pointer-clear", meta]),
      setPointerOrbit: (vector) => { calls.push(["pointer-orbit", vector]); return true; },
      setPointerDrag: (delta) => { calls.push(["pointer-drag", delta]); return true; },
      releasePointerDrag: (meta) => { calls.push(["pointer-drag-release", meta]); return true; },
      clearPointerOrbit: (meta) => {
        calls.push(["orbit-clear", meta]);
        if (clearOrbitReportsReady) reportPhase("ready");
        return true;
      },
      getCameraOwner: () => "home-orbit",
      getViewZoom: () => ({ ...fakeZoom }),
      setViewZoom: (progress, meta = {}) => {
        const currentProgress = meta.immediate ? progress : fakeZoom.progress;
        fakeZoom = {
          ...fakeZoom,
          ...resolvePlanetHubRepresentedDistance(currentProgress),
          progress: currentProgress,
          targetProgress: progress,
          segment: "legacy",
          cosmicProgress: progress < 1 ? 0 : fakeZoom.cosmicProgress,
          cosmicTargetProgress: progress < 1 ? 0 : fakeZoom.cosmicTargetProgress,
          cosmicTier: progress < 1 ? null : fakeZoom.cosmicTier,
          band: classifyPlanetHubViewBand({ progress: currentProgress })
        };
        calls.push(["view-zoom", progress, meta]);
        options.onViewChange?.(fakeZoom);
        return true;
      },
      setCosmicZoom: (progress, meta = {}) => {
        const currentProgress = meta.immediate ? progress : fakeZoom.cosmicProgress;
        const represented = resolvePlanetHubCosmicRepresentedDistance(currentProgress);
        fakeZoom = {
          ...fakeZoom,
          ...represented,
          progress: 1,
          targetProgress: 1,
          band: "universe",
          segment: progress > 0 || currentProgress > 0 ? "cosmic" : "legacy",
          cosmicProgress: currentProgress,
          cosmicTargetProgress: progress,
          cosmicTier: progress > 0 || currentProgress > 0
            ? classifyPlanetHubCosmicViewTier({ progress: currentProgress })
            : null
        };
        calls.push(["cosmic-zoom", progress, meta]);
        options.onViewChange?.(fakeZoom);
        return true;
      },
      getPlanetScreenBounds: () => ({ left: 200, right: 600, top: 50, bottom: 450, centerX: 400, centerY: 250, radiusX: 200, radiusY: 200 }),
      adoptDestination: (destination) => {
        calls.push(["adopt", destination]);
        calls.push(["portal", destination === "arena"]);
        return destination;
      },
      setPortalVisible: (visible) => calls.push(["portal", visible]),
      setOrbitBody: (body, meta = {}) => {
        calls.push(["orbit-body", body, meta]);
        return true;
      },
      setSelectedBody: (body, meta = {}) => {
        calls.push(["body-select", body, meta]);
        return true;
      },
      getBodyLabel: (body) => ({ earth: "Earth", moon: "Moon", mars: "Mars" })[body] || body,
      setSatelliteFocus: (target, meta = {}) => {
        calls.push(["satellite-focus", target, meta]);
        reportSatellite(target, { focused: true, source: meta.source || "api" });
        return true;
      },
      clearSatelliteFocus: (meta = {}) => {
        calls.push(["satellite-clear", meta]);
        reportSatellite(null, { focused: false, source: meta.source || "api" });
        return true;
      },
      setAvailable: (destinations) => calls.push(["available", ...destinations]),
      setEffectsLevel: (level, meta) => {
        calls.push(["space-effects", level, meta]);
        options.onSpaceState?.(level === "off" ? "static" : level === "reduced" ? "reduced" : "dynamic");
      },
      setHoveredDestination: (destination, meta) => {
        calls.push(["hover-destination", destination, meta]);
        return true;
      },
      setRocketIgnition: (level, duration) => calls.push(["ignition", level, duration]),
      playJourneyDeparture: (meta) => {
        calls.push(["journey-departure", meta]);
        return journeyDeparture(meta);
      },
      playJourneyReturn: (meta) => {
        calls.push(["journey-return", meta]);
        return journeyReturn(meta);
      },
      cancelJourneyReturn: (meta) => {
        calls.push(["journey-return-cancel", meta]);
        return true;
      },
      cancelJourneyDeparture: (meta) => {
        calls.push(["journey-departure-cancel", meta]);
        return true;
      },
      restoreJourneyRocket: () => {
        calls.push(["journey-rocket-restore"]);
        return true;
      },
      pick,
      pickDetail: pickDetail || ((...coordinates) => {
        const destination = pick(...coordinates);
        return destination ? { target: destination, destination, action: null } : null;
      }),
      suspend: (reason) => calls.push(["suspend", reason]),
      resume: () => calls.push(["resume"]),
      destroy: () => calls.push(["destroy"])
    };
  });
  const options = {
    root,
    orbitRoot,
    documentRef,
    windowRef,
    navigatorRef: windowRef.navigator,
    capabilities: capabilities || { webgl2: true, width: 1440, height: 900, deviceMemory: 8, hardwareConcurrency: 8 },
    fetchRef: async () => ({ ok: true, json: async () => manifestFixture() }),
    modulesLoader: async () => ({ THREE: {}, GLTFLoader: class {} }),
    rendererFactory: fakeRendererFactory,
    reducedMotion,
    actionElements,
    onSelect: (destination, meta) => {
      calls.push(["select", destination, meta.source]);
      return onSelect?.(destination, meta) ?? true;
    },
    onWorldSelect: (worldId, meta) => {
      calls.push(["world-select", worldId, meta]);
      return onWorldSelect?.(worldId, meta) ?? true;
    }
  };
  if (placesLoader) options.placesLoader = placesLoader;
  if (withOrbitController) {
    options.orbitController = {
      snapshot: () => ({ activeScene: "forge", availableScenes: ["forge", "journey", "arena"] }),
      select: (destination, meta = {}) => {
        calls.push(["controller-select", destination, meta]);
        orbitRoot.dispatch("homeorbitchange", {
          detail: {
            activeScene: destination,
            availableScenes: ["forge", "journey", "arena"],
            source: meta.source
          }
        });
        return true;
      }
    };
  }
  if (!useDefaultFocus) options.focusAction = (destination) => calls.push(["focus-action", destination]);
  const hub = createPlanetHub(options);
  return {
    hub,
    root,
    orbitRoot,
    documentRef,
    windowRef,
    calls,
    reportPhase: (phase) => reportPhase(phase),
    reportInteractionFrame: (meta) => reportInteractionFrame(meta),
    reportCenter: (destination, meta) => reportCenter(destination, meta),
    reportSatellite: (target, meta) => reportSatellite(target, meta)
  };
}

test("capability reader keeps WebGL probing and device policy inputs presentation-only", () => {
  let releasedProbe = 0;
  const documentRef = {
    createElement: () => ({
      getContext: (type) => type === "webgl2" ? {
        getExtension: (name) => name === "WEBGL_lose_context"
          ? { loseContext: () => { releasedProbe += 1; } }
          : null
      } : null
    })
  };
  const result = readPlanetHubCapabilities({
    documentRef,
    windowRef: { innerWidth: 390, innerHeight: 844, matchMedia: (query) => ({ matches: query.includes("coarse") }) },
    navigatorRef: { deviceMemory: 4, hardwareConcurrency: 4, connection: { saveData: true } }
  });
  assert.deepEqual(result, {
    webgl2: true,
    saveData: true,
    width: 390,
    height: 844,
    deviceMemory: 4,
    hardwareConcurrency: 4,
    coarsePointer: true,
    mobile: false,
    qualityOverride: null
  });
  assert.equal(releasedProbe, 1, "the disposable capability context must be released before the renderer starts");
});

test("capability probing rejects a major-performance-caveat context without a software retry", () => {
  let attempts = 0;
  let releasedProbe = 0;
  const result = readPlanetHubCapabilities({
    documentRef: {
      createElement: () => ({
        getContext: (type, options) => {
          if (type !== "webgl2") return null;
          attempts += 1;
          if (options?.failIfMajorPerformanceCaveat) return null;
          return {
            getExtension: () => ({ loseContext: () => { releasedProbe += 1; } })
          };
        }
      })
    },
    windowRef: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) },
    navigatorRef: {}
  });
  assert.equal(result.webgl2, false);
  assert.equal(result.deviceMemory, null);
  assert.equal(result.hardwareConcurrency, null);
  assert.equal(attempts, 1);
  assert.equal(releasedProbe, 0);
});

test("quality override accepts only deterministic static and low URL modes", () => {
  assert.equal(readPlanetHubQualityOverride({ search: "?birthday=off&hub=static" }), "static");
  assert.equal(readPlanetHubQualityOverride("http://127.0.0.1:4173/play/?hub=LOW"), "low");
  assert.equal(readPlanetHubQualityOverride({ href: "http://127.0.0.1:4173/play/?hub=standard" }), null);
  assert.equal(readPlanetHubQualityOverride({ search: "?hub=unknown" }), null);

  const capabilities = readPlanetHubCapabilities({
    webgl2: true,
    windowRef: {
      innerWidth: 1440,
      innerHeight: 900,
      location: { search: "?birthday=off&hub=static" },
      matchMedia: () => ({ matches: false })
    },
    navigatorRef: { deviceMemory: 8, hardwareConcurrency: 8 }
  });
  assert.equal(capabilities.qualityOverride, "static");
  assert.equal(selectPlanetHubQuality(capabilities), "static");
});

test("Journey semantic audio follows the authored shot grammar in both directions", () => {
  assert.deepEqual(resolvePlanetHubJourneyAudioTimeline(), [
    { cue: "journey-ignition", delayMs: 0, direction: "outbound" },
    { cue: "journey-liftoff", delayMs: 450, direction: "outbound" },
    { cue: "journey-transfer", delayMs: 3020, direction: "outbound" },
    { cue: "journey-approach", delayMs: 5600, direction: "outbound" }
  ]);
  assert.deepEqual(resolvePlanetHubJourneyAudioTimeline({ direction: "return" }), [
    { cue: "journey-ignition", delayMs: 0, direction: "return" },
    { cue: "journey-liftoff", delayMs: 450, direction: "return" },
    { cue: "journey-transfer", delayMs: 3020, direction: "return" },
    { cue: "journey-approach", delayMs: 5600, direction: "return" }
  ]);
  assert.deepEqual(resolvePlanetHubJourneyAudioTimeline({ reducedMotion: true }), [
    { cue: "journey-ignition", delayMs: 0, direction: "outbound" }
  ], "reduced motion keeps meaningful sound without compressing every flight cue into one instant");
});

test("hub prepares lazily, publishes its contract, mirrors sync, and delegates selection", async () => {
  const { hub, root, orbitRoot, calls, reportPhase } = fixture();
  assert.equal(root.dataset.homeHubRenderer, "pending");
  const prepared = await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  assert.equal(prepared.renderer, "webgl");
  assert.equal(prepared.quality, "standard");
  assert.equal(root.dataset.homeHubPhase, "ready");
  assert.equal(orbitRoot.dataset.homeHubRenderer, "webgl");
  assert.equal(orbitRoot.dataset.homeHubQuality, "standard");
  assert.equal(root.dataset.homeHubSpace, "dynamic");
  assert.equal(root.dataset.homeSpaceMotion, "active");
  assert.equal(hub.canvas.getAttribute?.("aria-hidden"), "true");
  assert.equal(hub.canvas.attributes.get("aria-hidden"), "true");
  assert.equal(hub.canvas.tabIndex, -1);

  hub.setEffectsLevel("reduced");
  assert.equal(root.dataset.homeHubSpace, "reduced");
  assert.equal(root.dataset.homeSpaceEffects, "reduced");
  assert.equal(root.dataset.homeSpaceMotion, "frozen");
  hub.setEffectsLevel("full");

  hub.sync({ worldId: "earth", activeDestination: "journey", availableDestinations: ["forge", "journey", "arena"], journeyAction: { actionKind: "continue", projectId: "lunar-dynamo" }, revealState: "revealed" });
  assert.equal(hub.snapshot().activeDestination, "journey");
  assert.equal(hub.snapshot().journeyAction, "continue");
  assert.equal(hub.focus("journey", { animate: false }), true);

  hub.canvas.dispatch("pointerdown", { target: hub.canvas, clientX: 400, clientY: 250, pointerId: 7, timeStamp: 0 });
  hub.canvas.dispatch("pointerup", { target: hub.canvas, clientX: 400, clientY: 250, pointerId: 7, timeStamp: 20 });
  // Interaction is bound to the stage, so dispatch there for a landmark activation.
  root.dispatch("pointerdown", { target: hub.canvas, clientX: 400, clientY: 250, pointerId: 8, timeStamp: 30 });
  root.dispatch("pointerup", { target: hub.canvas, clientX: 400, clientY: 250, pointerId: 8, timeStamp: 50 });
  assert.ok(calls.some((call) => call[0] === "select" && call[1] === "arena" && call[2] === "landmark"));
  assert.ok(calls.some((call) => call[0] === "focus-action" && call[1] === "arena"));
  assert.equal(hub.snapshot().mode, "focused");
  assert.equal(root.dataset.homeHubMode, "focused");
  assert.equal(root.dataset.homeHubTransition, "focus-in");
  reportPhase("ready");
  assert.equal(root.dataset.homeHubTransition, undefined);
  const orbitReturn = orbitRoot.children.find((child) => "planetHubOrbitReturn" in child.dataset);
  assert.equal(orbitReturn.hidden, false);
  orbitReturn.dispatch("click");
  assert.equal(hub.snapshot().mode, "overview");
  assert.equal(root.dataset.homeHubMode, "overview");
  assert.equal(root.dataset.homeHubTransition, "focus-out");
  reportPhase("ready");
  assert.equal(root.dataset.homeHubTransition, undefined);
  assert.ok(calls.some((call) => call[0] === "mode" && call[1] === "focused" && call[2] === "arena"));
});

test("hub lazily adapts the optional Places controller without adding it to the core graph", async () => {
  const calls = [];
  const controller = {
    sync: (options) => calls.push(["places-sync", options]),
    getBackContract: (fallback) => fallback,
    selectPlace: async (id) => { calls.push(["places-select", id]); return true; },
    visitPlace: async (id) => { calls.push(["places-visit", id]); return true; },
    back: async (options) => { calls.push(["places-back", options]); return true; },
    snapshot: () => ({ contextId: "solar-system", selectedPlaceId: "sun" }),
    reset: (options) => calls.push(["places-reset", options]),
    destroy: () => calls.push(["places-destroy"])
  };
  const loaded = [];
  const { hub } = fixture({
    placesLoader: async (specifier) => {
      loaded.push(specifier);
      return {
        createPlanetHubPlacesController: (options) => {
          calls.push(["places-create", Boolean(options.getRenderer?.())]);
          return controller;
        }
      };
    }
  });

  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  assert.equal(await hub.selectPlace("sun"), true);
  assert.equal(await hub.visitPlace("sun"), true);
  assert.equal(await hub.backPlace({ source: "test" }), true);
  assert.match(loaded[0], /^\.\/planet-hub-places[.]mjs\?v=/);
  assert.deepEqual(hub.getPlaces(), { contextId: "solar-system", selectedPlaceId: "sun" });
  assert.deepEqual(calls.find((call) => call[0] === "places-create"), ["places-create", true]);
  assert.ok(calls.some((call) => call[0] === "places-select" && call[1] === "sun"));
  assert.ok(calls.some((call) => call[0] === "places-visit" && call[1] === "sun"));
  assert.ok(calls.some((call) => call[0] === "places-back" && call[1].source === "test"));

  hub.destroy();
  assert.ok(calls.some((call) => call[0] === "places-destroy"));
});

test("the orbit brake ready pulse cannot erase a landmark focus transition", async () => {
  const { hub, root, reportPhase } = fixture({
    clearOrbitReportsReady: true,
    pick: () => "forge"
  });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });

  root.dispatch("pointerdown", {
    target: hub.canvas,
    clientX: 400,
    clientY: 180,
    pointerId: 91,
    timeStamp: 10
  });
  root.dispatch("pointerup", {
    target: hub.canvas,
    clientX: 400,
    clientY: 180,
    pointerId: 91,
    timeStamp: 30
  });

  assert.equal(hub.snapshot().mode, "focused");
  assert.equal(root.dataset.homeHubTransition, "focus-in");
});

test("clicking empty planet space exits focus despite pointer jitter and restores the authored overview pose", async () => {
  let pickedDestination = "journey";
  const { hub, root, calls } = fixture({ pick: () => pickedDestination });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  hub.sync({
    worldId: "earth",
    activeDestination: "journey",
    availableDestinations: ["forge", "journey", "arena"],
    journeyAction: { actionKind: "continue", projectId: "lunar-dynamo" },
    revealState: "revealed"
  });

  root.dispatch("pointerdown", { target: hub.canvas, clientX: 400, clientY: 180, pointerId: 41, timeStamp: 10 });
  root.dispatch("pointerup", { target: hub.canvas, clientX: 400, clientY: 180, pointerId: 41, timeStamp: 30 });
  assert.equal(hub.snapshot().mode, "focused");

  pickedDestination = null;
  root.dispatch("pointerdown", { target: hub.canvas, clientX: 120, clientY: 390, pointerId: 42, timeStamp: 50 });
  root.dispatch("pointermove", { target: hub.canvas, clientX: 130, clientY: 394, pointerId: 42, timeStamp: 62 });
  root.dispatch("pointerup", { target: hub.canvas, clientX: 130, clientY: 394, pointerId: 42, timeStamp: 70 });

  assert.equal(hub.snapshot().mode, "overview");
  assert.equal(root.dataset.homeHubMode, "overview");
  assert.deepEqual(
    calls.filter((call) => call[0] === "mode").at(-1),
    ["mode", "overview", "journey", { animate: true }]
  );
  assert.equal(root.dataset.homeHubExitSource, "planet-background");
});

test("a focused background press remains an exit if a moving landmark reaches the release point", () => {
  const stage = new FakeElement();
  const calls = [];
  let mode = "focused";
  let pickedDestination = null;
  const interaction = createPlanetHubInteraction({
    stage,
    windowRef: { matchMedia: () => ({ matches: false }) },
    getMode: () => mode,
    getAvailable: () => ["forge", "journey", "arena"],
    pick: () => pickedDestination,
    onCommit: (destination, meta) => calls.push(["commit", destination, meta.source]),
    onExitFocus: (meta) => {
      calls.push(["exit", meta.source]);
      mode = "overview";
    },
    onPreviewEnd: () => calls.push(["spring"])
  });

  stage.dispatch("pointerdown", { pointerType: "mouse", pointerId: 71, clientX: 120, clientY: 390, timeStamp: 10 });
  pickedDestination = "journey";
  stage.dispatch("pointermove", { pointerType: "mouse", pointerId: 71, clientX: 230, clientY: 394, timeStamp: 20 });
  stage.dispatch("pointerup", { pointerType: "mouse", pointerId: 71, clientX: 230, clientY: 394, timeStamp: 30 });

  assert.deepEqual(calls, [["exit", "planet-background"]]);
  interaction.destroy();
});

test("homeorbitchange remains authoritative for available sites", async () => {
  const { hub, orbitRoot, calls } = fixture();
  await hub.prepare({ deadlineMs: 0 });
  calls.length = 0;
  orbitRoot.dispatch("homeorbitchange", {
    detail: { activeScene: "journey", availableScenes: ["forge", "journey"], source: "tab" }
  });
  assert.equal(hub.snapshot().activeDestination, "journey");
  assert.deepEqual(hub.snapshot().availableDestinations, ["forge", "journey"]);
  assert.deepEqual(
    calls.filter((call) => call[0] === "destination"),
    [["destination", "journey", { animate: true }]],
    "rail selection must author one visible rotation from the globe's current pose"
  );
  assert.equal(calls.some((call) => call[0] === "mode" && call[3]?.animate === false), false,
    "rail selection must never hard-apply its target before the smooth turn begins");
});

test("a stably centered landmark selects its HTML destination without recentering the renderer", async () => {
  const { hub, root, calls, reportCenter } = fixture({
    withOrbitController: true,
    pick: () => "journey"
  });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  hub.sync({
    worldId: "earth",
    activeDestination: "forge",
    availableDestinations: ["forge", "journey", "arena"],
    revealState: "revealed"
  });
  calls.length = 0;

  assert.equal(reportCenter("journey", { source: "inertia" }), true);
  assert.equal(hub.snapshot().activeDestination, "journey");
  assert.equal(hub.snapshot().mode, "overview");
  assert.deepEqual(
    calls.find((call) => call[0] === "controller-select"),
    ["controller-select", "journey", { source: "planet-center", announce: false, focusTab: false }]
  );
  assert.deepEqual(calls.filter((call) => call[0] === "adopt"), [["adopt", "journey"]]);
  assert.deepEqual(calls.filter((call) => call[0] === "portal"), [["portal", false]]);
  assert.equal(calls.some((call) => call[0] === "destination" || call[0] === "mode"), false,
    "center-driven HTML selection must not author another globe pose");

  const rendererCallsBeforeSnapshotSync = calls.length;
  hub.sync({
    worldId: "earth",
    activeDestination: "journey",
    availableDestinations: ["forge", "journey", "arena"],
    revealState: "revealed"
  });
  const redundantSyncCalls = calls.slice(rendererCallsBeforeSnapshotSync);
  assert.equal(
    redundantSyncCalls.some((call) => ["orbit-clear", "pointer-clear", "destination", "mode"].includes(call[0])),
    false,
    "the app bridge's redundant post-selection snapshot must not brake coast or replay the authored pose"
  );

  const selectsBeforeRepeat = calls.filter((call) => call[0] === "controller-select").length;
  assert.equal(reportCenter("journey", { source: "idle" }), false);
  assert.equal(calls.filter((call) => call[0] === "controller-select").length, selectsBeforeRepeat);

  root.dispatch("pointerdown", { target: hub.canvas, clientX: 400, clientY: 180, pointerId: 51, timeStamp: 10 });
  root.dispatch("pointerup", { target: hub.canvas, clientX: 400, clientY: 180, pointerId: 51, timeStamp: 30 });
  assert.equal(hub.snapshot().mode, "focused", "ordinary landmark clicks still enter focused mode");
  assert.ok(calls.some((call) => call[0] === "mode" && call[1] === "focused" && call[2] === "journey"));
  assert.equal(reportCenter("arena", { source: "idle" }), false, "center reports are ignored while focused");
});

test("center selection activates Arena portal without an authored recenter", async () => {
  const { hub, calls, reportCenter } = fixture({ withOrbitController: true });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  calls.length = 0;

  assert.equal(reportCenter("arena", { source: "pointer-hover" }), true);
  assert.equal(hub.snapshot().activeDestination, "arena");
  assert.deepEqual(calls.filter((call) => call[0] === "adopt"), [["adopt", "arena"]]);
  assert.deepEqual(calls.filter((call) => call[0] === "portal"), [["portal", true]]);
  assert.equal(calls.some((call) => call[0] === "destination" || call[0] === "mode"), false);
});

test("a single Moon click selects and a same-body double-click centers it without changing expedition state", async () => {
  const { hub, root, calls } = fixture({
    pickDetail: () => ({ target: "moon", body: "moon", satellite: "moon" })
  });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  hub.sync({
    worldId: "earth",
    activeDestination: "forge",
    availableDestinations: ["forge", "journey", "arena"],
    revealState: "revealed"
  });
  calls.length = 0;

  const click = (pointerId, downAt, upAt) => {
    root.dispatch("pointerdown", { target: hub.canvas, pointerType: "mouse", pointerId, clientX: 520, clientY: 180, timeStamp: downAt });
    return root.dispatch("pointerup", { target: hub.canvas, pointerType: "mouse", pointerId, clientX: 520, clientY: 180, timeStamp: upAt });
  };
  assert.equal(click(1, 10, 30), true);
  assert.equal(hub.snapshot().orbitBodyId, "earth");
  assert.equal(hub.snapshot().selectedBodyId, "moon");
  assert.deepEqual(calls.filter((call) => call[0] === "body-select"), [[
    "body-select", "moon", { source: "body-click" }
  ]]);
  assert.equal(calls.some((call) => call[0] === "orbit-body"), false,
    "the first body click identifies the target without moving the camera pivot");

  assert.equal(click(2, 190, 220), false);
  assert.deepEqual(calls.filter((call) => call[0] === "orbit-body"), [[
    "orbit-body", "moon", { animate: true, source: "body-double-click" }
  ]]);
  const centered = hub.snapshot();
  assert.equal(centered.mode, "overview");
  assert.equal(centered.orbitBodyId, "moon");
  assert.equal(centered.worldId, "earth", "camera centering never records an expedition arrival");
  assert.equal(centered.activeDestination, "forge");
  assert.equal(root.dataset.homeHubOrbitBody, "moon");
  assert.equal(calls.some((call) => call[0] === "satellite-focus"), false);
});

test("Escape and the contextual background restore the authoritative current-world center", async () => {
  const { hub, root, orbitRoot, documentRef, calls } = fixture({
    pickDetail: (x) => x > 100
      ? ({ target: "moon", body: "moon", satellite: "moon" })
      : null
  });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  const inspection = orbitRoot.children.find((child) => "planetHubWorldInspection" in child.dataset);
  const centerMoon = (startAt) => {
    for (const [pointerId, at] of [[startAt, startAt], [startAt + 1, startAt + 160]]) {
      root.dispatch("pointerdown", { target: hub.canvas, pointerType: "mouse", pointerId, clientX: 500, clientY: 170, timeStamp: at });
      root.dispatch("pointerup", { target: hub.canvas, pointerType: "mouse", pointerId, clientX: 500, clientY: 170, timeStamp: at + 20 });
    }
    assert.equal(hub.snapshot().orbitBodyId, "moon");
  };

  centerMoon(10);
  assert.equal(inspection.hidden, false, "Moon status stays contextual without changing camera mode");
  calls.length = 0;
  let prevented = false;
  documentRef.dispatch("keydown", {
    key: "Escape",
    preventDefault: () => { prevented = true; },
    stopPropagation() {}
  });
  assert.equal(prevented, true);
  assert.equal(hub.snapshot().mode, "overview");
  assert.equal(hub.snapshot().orbitBodyId, "earth");
  assert.deepEqual(calls.filter((call) => call[0] === "orbit-body").at(-1), [
    "orbit-body", "earth", { animate: true, source: "escape" }
  ]);

  centerMoon(500);
  calls.length = 0;
  root.dispatch("pointerdown", {
    target: hub.canvas,
    pointerType: "mouse",
    pointerId: 50,
    clientX: 20,
    clientY: 20,
    timeStamp: 900
  });
  root.dispatch("pointerup", {
    target: hub.canvas,
    pointerType: "mouse",
    pointerId: 50,
    clientX: 20,
    clientY: 20,
    timeStamp: 920
  });
  assert.equal(hub.snapshot().mode, "overview");
  assert.equal(hub.snapshot().orbitBodyId, "earth");
  assert.deepEqual(calls.filter((call) => call[0] === "orbit-body").at(-1), [
    "orbit-body", "earth", { animate: true, source: "planet-background" }
  ]);
  assert.equal(hub.snapshot().worldId, "earth");
});

test("destination controls restore the current-world body before moving the destination", async () => {
  const { hub, root, orbitRoot, calls } = fixture({
    pickDetail: () => ({ target: "moon", body: "moon", satellite: "moon" })
  });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  hub.sync({
    worldId: "earth",
    activeDestination: "forge",
    availableDestinations: ["forge", "journey", "arena"],
    revealState: "revealed"
  });
  for (const [pointerId, at] of [[1, 10], [2, 170]]) {
    root.dispatch("pointerdown", { target: hub.canvas, pointerType: "mouse", pointerId, clientX: 500, clientY: 170, timeStamp: at });
    root.dispatch("pointerup", { target: hub.canvas, pointerType: "mouse", pointerId, clientX: 500, clientY: 170, timeStamp: at + 20 });
  }
  assert.equal(hub.snapshot().orbitBodyId, "moon");
  calls.length = 0;

  orbitRoot.dispatch("homeorbitchange", {
    detail: {
      activeScene: "journey",
      availableScenes: ["forge", "journey", "arena"],
      source: "tab"
    }
  });
  assert.equal(hub.snapshot().activeDestination, "journey");
  assert.equal(hub.snapshot().orbitBodyId, "earth");
  assert.deepEqual(calls.filter((call) => call[0] === "orbit-body").at(-1), [
    "orbit-body", "earth", { animate: true, source: "destination-control" }
  ]);
  assert.deepEqual(calls.filter((call) => call[0] === "destination").at(-1), [
    "destination", "journey", { animate: true }
  ]);
});

test("a responsive availability refresh preserves a centered celestial body", async () => {
  const { hub, root, orbitRoot, calls } = fixture({
    pickDetail: () => ({ target: "moon", body: "moon", satellite: "moon" })
  });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  hub.sync({
    worldId: "earth",
    activeDestination: "forge",
    availableDestinations: ["forge", "journey", "arena"],
    revealState: "revealed"
  });
  for (const [pointerId, at] of [[1, 10], [2, 170]]) {
    root.dispatch("pointerdown", { target: hub.canvas, pointerType: "mouse", pointerId, clientX: 500, clientY: 170, timeStamp: at });
    root.dispatch("pointerup", { target: hub.canvas, pointerType: "mouse", pointerId, clientX: 500, clientY: 170, timeStamp: at + 20 });
  }
  assert.equal(hub.snapshot().orbitBodyId, "moon");
  assert.equal(hub.snapshot().selectedBodyId, "moon");
  calls.length = 0;

  // home-menu-view emits this unchanged selection when a responsive body/layout
  // mutation makes it recalculate availability after a viewport resize.
  orbitRoot.dispatch("homeorbitchange", {
    detail: {
      activeScene: "forge",
      availableScenes: ["forge", "journey", "arena"],
      source: "availability"
    }
  });

  assert.equal(hub.snapshot().orbitBodyId, "moon");
  assert.equal(hub.snapshot().selectedBodyId, "moon");
  assert.equal(root.dataset.homeHubOrbitBody, "moon");
  assert.equal(root.dataset.homeHubSelectedBody, "moon");
  assert.equal(calls.some((call) => call[0] === "orbit-body" && call[1] === "earth"), false);
  assert.equal(calls.some((call) => call[0] === "destination" || call[0] === "mode"), false);
});

test("Moon-centered status exposes Home selection without making camera focus authoritative", async () => {
  const selectedWorlds = [];
  const { hub, root, orbitRoot } = fixture({
    pickDetail: () => ({ target: "moon", body: "moon", satellite: "moon" }),
    onWorldSelect: (worldId, meta) => {
      selectedWorlds.push([worldId, meta]);
      return true;
    }
  });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  const inspection = orbitRoot.children.find((child) => "planetHubWorldInspection" in child.dataset);
  const title = inspection.querySelector("[data-planet-hub-inspection-title]");
  const detail = inspection.querySelector("[data-planet-hub-inspection-detail]");
  const enterMoon = inspection.querySelector("[data-planet-hub-inspection-select]");
  const worldSwitch = orbitRoot.querySelector("[data-planet-hub-world-switch]");

  hub.sync({
    worldId: "earth",
    activeDestination: "forge",
    availableDestinations: ["forge", "journey", "arena"],
    selectableHomeWorldIds: ["earth"],
    moonHomeWorldAccess: { unlocked: false, milestoneId: "power" }
  });
  for (const [pointerId, at] of [[1, 10], [2, 170]]) {
    root.dispatch("pointerdown", { target: hub.canvas, pointerType: "mouse", pointerId, clientX: 500, clientY: 170, timeStamp: at });
    root.dispatch("pointerup", { target: hub.canvas, pointerType: "mouse", pointerId, clientX: 500, clientY: 170, timeStamp: at + 20 });
  }
  assert.equal(hub.snapshot().mode, "overview");
  assert.equal(hub.snapshot().orbitBodyId, "moon");
  assert.equal(title.textContent, "Wake the Moon");
  assert.match(detail.textContent, /Power project/);
  assert.equal(enterMoon.hidden, true);
  assert.equal(worldSwitch.hidden, true);

  hub.sync({
    worldId: "earth",
    activeDestination: "forge",
    availableDestinations: ["forge", "journey", "arena"],
    selectableHomeWorldIds: ["earth", "moon"],
    moonHomeWorldAccess: { unlocked: true, milestoneId: "power", completedAt: "2026-08-04T00:00:00.000Z" }
  });
  assert.equal(title.textContent, "Moon orbit ready");
  assert.match(detail.textContent, /Power is awake/);
  assert.equal(enterMoon.hidden, false);
  enterMoon.dispatch("click");
  assert.equal(hub.snapshot().worldId, "earth", "presentation waits for the authoritative profile sync");
  assert.equal(root.dataset.homeHubWorldSelection, "moon");
  assert.deepEqual(selectedWorlds, [["moon", { source: "moon-inspection", fromWorld: "earth" }]]);

  hub.sync({
    worldId: "moon",
    activeDestination: "forge",
    availableDestinations: ["forge", "journey", "arena"],
    selectableHomeWorldIds: ["earth", "moon"],
    moonHomeWorldAccess: { unlocked: true, milestoneId: "power" }
  });
  assert.equal(hub.snapshot().worldId, "moon");
  assert.equal(hub.snapshot().orbitBodyId, "moon", "authoritative Moon Home sync keeps Moon as the current-world center");
  assert.equal(worldSwitch.hidden, false);
  assert.equal(worldSwitch.dataset.planetHubWorldTarget, "earth");
  assert.deepEqual(worldSwitch.focusOptions, { preventScroll: true },
    "successful world selection restores focus to the visible world switch");
  worldSwitch.dispatch("click");
  assert.deepEqual(selectedWorlds.at(-1), ["earth", { source: "world-switch", fromWorld: "moon" }]);
  assert.equal(hub.snapshot().worldId, "moon", "world switch also waits for authoritative sync");
});

test("poster fallback keeps the unlocked planetary world switch usable", async () => {
  const selectedWorlds = [];
  const { hub, orbitRoot } = fixture({
    capabilities: { webgl2: false, saveData: true, width: 390, height: 844 },
    onWorldSelect: (worldId) => { selectedWorlds.push(worldId); return true; }
  });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  hub.sync({
    worldId: "earth",
    selectableHomeWorldIds: ["earth", "moon"],
    moonHomeWorldAccess: { unlocked: true }
  });
  const worldSwitch = orbitRoot.querySelector("[data-planet-hub-world-switch]");
  assert.equal(hub.snapshot().renderer, "fallback");
  assert.equal(worldSwitch.hidden, false);
  worldSwitch.dispatch("click");
  assert.deepEqual(selectedWorlds, ["moon"]);
});

test("Journey controls resolve one semantic action without ever activating the tab fallback", () => {
  const rocket = new FakeElement("BUTTON");
  const visit = new FakeElement("BUTTON");
  const tab = new FakeElement("BUTTON");
  for (const control of [rocket, visit, tab]) control.focus = () => {};
  const elements = new Map([
    ["moonHomeRocket", rocket],
    ["moonHomeProjectVisit", visit],
    ["homeOrbitTabJourney", tab]
  ]);
  const documentRef = { getElementById: (id) => elements.get(id) || null };

  const continuing = resolvePlanetHubJourneyControls({ documentRef, journeyAction: "continue" });
  assert.equal(continuing.actionTarget, rocket);
  assert.equal(continuing.focusTarget, rocket);
  assert.deepEqual(continuing.controls, [rocket, visit]);

  const preparing = resolvePlanetHubJourneyControls({ documentRef, journeyAction: { actionKind: "preparing" } });
  assert.equal(preparing.actionTarget, visit);
  assert.equal(preparing.focusTarget, visit);

  visit.hidden = true;
  rocket.disabled = true;
  const unavailable = resolvePlanetHubJourneyControls({ documentRef, journeyAction: "preparing" });
  assert.equal(unavailable.actionTarget, null, "the Journey tab is a focus fallback, not a launch action");
  assert.equal(unavailable.focusTarget, tab);
});

test("landmark focus falls through hidden or disabled actions to the visible Journey control", async () => {
  const rocket = new FakeElement("BUTTON");
  rocket.disabled = true;
  const visit = new FakeElement("BUTTON");
  visit.focus = (options) => { visit.focusOptions = options; };
  const tab = new FakeElement("BUTTON");
  tab.focus = () => { tab.focused = true; };
  const elements = new Map([
    ["moonHomeRocket", rocket],
    ["moonHomeProjectVisit", visit],
    ["homeOrbitTabJourney", tab]
  ]);
  const rendererFactory = async () => ({
    setDestination() {},
    setAvailable() {},
    pick: () => "journey",
    suspend() {},
    resume() {},
    destroy() {}
  });
  const { hub, root } = fixture({ useDefaultFocus: true, elements, rendererFactory });
  await hub.prepare({ deadlineMs: 0 });
  hub.sync({ activeDestination: "forge", availableDestinations: ["forge", "journey"] });
  root.dispatch("pointerdown", { target: hub.canvas, clientX: 400, clientY: 250, pointerId: 11, timeStamp: 10 });
  root.dispatch("pointerup", { target: hub.canvas, clientX: 400, clientY: 250, pointerId: 11, timeStamp: 30 });
  assert.deepEqual(visit.focusOptions, { preventScroll: true });
  assert.equal(tab.focused, undefined);
});

test("Journey control hover and focus drive ignition feedback without changing hub state", async () => {
  const journeyControl = new FakeElement("BUTTON");
  let journeyActivations = 0;
  journeyControl.addEventListener("click", () => { journeyActivations += 1; });
  const elements = new Map([["moonHomeRocket", journeyControl]]);
  const { hub, calls } = fixture({ elements });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  hub.sync({
    worldId: "earth",
    activeDestination: "journey",
    availableDestinations: ["forge", "journey", "arena"],
    journeyAction: { actionKind: "continue", projectId: "lunar-dynamo" },
    revealState: "revealed"
  });
  const before = hub.snapshot();
  calls.length = 0;

  journeyControl.dispatch("pointerenter");
  journeyControl.dispatch("focus");
  journeyControl.dispatch("pointerleave");
  journeyControl.dispatch("blur");
  journeyControl.dispatch("pointerdown");

  assert.deepEqual(calls.filter((call) => call[0] === "ignition"), [
    ["ignition", 0.42, 0],
    ["ignition", 0.42, 0],
    ["ignition", 0.42, 0],
    ["ignition", 0, 0],
    ["ignition", 1, 620]
  ]);
  assert.equal(journeyActivations, 0, "feedback alone never activates the semantic Journey action");
  assert.deepEqual(hub.snapshot(), before,
    "presentation feedback and delegated activation must not write Planet Hub save or progression state");
});

test("Rocket and Visit hover/focus sources keep semantic ignition active until every source leaves", async () => {
  const rocket = new FakeElement("BUTTON");
  const visit = new FakeElement("BUTTON");
  const elements = new Map([
    ["moonHomeRocket", rocket],
    ["moonHomeProjectVisit", visit]
  ]);
  const { hub, calls } = fixture({ elements });
  await hub.prepare({ deadlineMs: 0 });
  calls.length = 0;

  rocket.dispatch("focus");
  visit.dispatch("pointerenter");
  rocket.dispatch("blur");
  visit.dispatch("pointerleave");

  assert.deepEqual(calls.filter((call) => call[0] === "ignition"), [
    ["ignition", 0.42, 0],
    ["ignition", 0.42, 0],
    ["ignition", 0.42, 0],
    ["ignition", 0, 0]
  ]);
});

test("direct and keyboard-style Journey button clicks obey the same focus-first launch guard", async () => {
  const journeyControl = new FakeElement("BUTTON");
  journeyControl.focus = (options) => {
    journeyControl.focusOptions = options;
    journeyControl.dispatch("focus");
  };
  let semanticActivations = 0;
  journeyControl.addEventListener("click", () => { semanticActivations += 1; });
  const { hub, calls, reportPhase } = fixture({
    elements: new Map([["moonHomeRocket", journeyControl]]),
    useDefaultFocus: true
  });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  hub.sync({
    worldId: "earth",
    activeDestination: "forge",
    availableDestinations: ["forge", "journey", "arena"],
    journeyAction: { actionKind: "launch" },
    revealState: "revealed"
  });
  calls.length = 0;

  journeyControl.click();
  await Promise.resolve();
  assert.equal(hub.snapshot().activeDestination, "journey");
  assert.equal(hub.snapshot().mode, "focused");
  assert.equal(semanticActivations, 0, "the first semantic click only brings Journey into focus");
  reportPhase("ready");

  journeyControl.click();
  journeyControl.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(semanticActivations, 1, "one settled activation reaches Journey authority");
  assert.equal(calls.filter((call) => call[0] === "journey-departure").length, 1,
    "a second click during departure is consumed instead of starting another flight");
});

test("a Journey activation remains blocked when capable-device preparation only misses its soft deadline", async () => {
  const journeyControl = new FakeElement("BUTTON");
  let semanticActivations = 0;
  journeyControl.addEventListener("click", () => { semanticActivations += 1; });
  const { hub } = fixture({
    elements: new Map([["moonHomeRocket", journeyControl]]),
    rendererFactory: () => new Promise(() => {})
  });
  hub.sync({
    worldId: "earth",
    activeDestination: "journey",
    availableDestinations: ["forge", "journey", "arena"],
    journeyAction: { actionKind: "launch" },
    revealState: "revealed"
  });

  const preparing = hub.prepare({ worldId: "earth", deadlineMs: 8 });
  journeyControl.click();
  await Promise.resolve();
  assert.equal(semanticActivations, 0, "loading cannot leak an immediate semantic launch");

  await preparing;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(hub.snapshot().renderer, "pending");
  assert.equal(hub.snapshot().phase, "loading");
  assert.equal(semanticActivations, 0,
    "a soft deadline cannot turn an unfinished capable-device scene into an authoritative poster launch");
  hub.destroy();
});

test("Journey rocket requires settled focus, then departs before one semantic launch", async () => {
  const journeyControl = new FakeElement("BUTTON");
  let journeyActivations = 0;
  journeyControl.focus = (options) => {
    journeyControl.focusOptions = options;
    journeyControl.dispatch("focus");
  };
  journeyControl.addEventListener("click", () => { journeyActivations += 1; });
  const elements = new Map([["moonHomeRocket", journeyControl]]);
  let detail = { target: "journey", destination: "journey", action: "journey-launch" };
  journeyControl.addEventListener("click", () => { calls?.push?.(["semantic-journey"]); });
  const asyncAppHandoffs = [];
  journeyControl.addEventListener("click", () => {
    void Promise.resolve()
      .then(() => hub.stageJourneyActivation({ trigger: journeyControl }))
      .then((proceed) => asyncAppHandoffs.push(proceed));
  });
  const { hub, root, calls, reportPhase } = fixture({
    elements,
    useDefaultFocus: true,
    pick: () => detail?.destination || null,
    pickDetail: () => detail
  });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  hub.sync({
    worldId: "earth",
    activeDestination: "forge",
    availableDestinations: ["forge", "journey", "arena"],
    journeyAction: { actionKind: "launch", projectId: "lunar-dynamo" },
    revealState: "revealed"
  });
  calls.length = 0;

  const activate = (pointerId, timeStamp) => {
    root.dispatch("pointerdown", { target: hub.canvas, pointerType: "mouse", clientX: 400, clientY: 180, pointerId, timeStamp });
    root.dispatch("pointerup", { target: hub.canvas, pointerType: "mouse", clientX: 400, clientY: 180, pointerId, timeStamp: timeStamp + 20 });
  };

  activate(61, 10);
  assert.equal(hub.snapshot().mode, "focused", "the first Journey rocket click remains a focus transition");
  assert.equal(hub.snapshot().activeDestination, "journey");
  assert.equal(journeyActivations, 0, "overview selection must not launch through the action control");
  assert.deepEqual(journeyControl.focusOptions, { preventScroll: true });
  assert.ok(calls.some((call) => call[0] === "ignition" && call[1] > 0 && call[2] === 0),
    "focus on the authoritative Journey control should soften the engine flame");
  reportPhase("ready");

  calls.length = 0;
  root.dispatch("pointermove", { target: hub.canvas, pointerType: "mouse", clientX: 400, clientY: 180 });
  assert.deepEqual(calls.filter((call) => call[0] === "hover-destination").at(-1), [
    "hover-destination",
    "journey",
    { action: "journey-launch" }
  ], "focused rocket hover must carry action detail to the renderer's ignition affordance");
  root.dispatch("pointerleave", { target: hub.canvas, pointerType: "mouse" });
  assert.deepEqual(calls.filter((call) => call[0] === "hover-destination").at(-1), [
    "hover-destination",
    null,
    { action: null }
  ]);

  detail = null;
  activate(62, 50);
  assert.equal(hub.snapshot().mode, "overview", "empty space returns the complete world to overview");
  assert.equal(journeyActivations, 0, "background exit never launches Journey");
  reportPhase("ready");

  detail = { target: "journey", destination: "journey", action: "journey-launch" };
  const overviewSnapshot = hub.snapshot();
  activate(63, 90);
  assert.equal(hub.snapshot().mode, "focused", "an overview rocket click focuses even when Journey is already selected");
  assert.equal(journeyActivations, 0, "centering and launch can never occur on the same activation");
  reportPhase("ready");
  const selectsAfterFocus = calls.filter((call) => call[0] === "select").length;
  activate(64, 130);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(journeyActivations, 1, "the settled focused rocket delegates one semantic click after departure");
  assert.equal(calls.filter((call) => call[0] === "journey-departure").length, 1,
    "duplicate activation cannot replay the in-hub Earth-to-Moon handoff");
  assert.deepEqual(asyncAppHandoffs, [true],
    "the async app bridge consumes the delegated token without staging a second flight");
  assert.ok(calls.findIndex((call) => call[0] === "journey-departure")
    < calls.findIndex((call) => call[0] === "semantic-journey"),
  "the in-hub flight begins before Journey authority receives the delegated click");
  assert.equal(calls.filter((call) => call[0] === "select").length, selectsAfterFocus,
    "delegated launch does not reselect or reproduce Journey progression logic");
  assert.equal(hub.restoreJourneyAfterHandoff(), true,
    "a failed semantic handoff can explicitly restore the authored docked rocket");
  assert.deepEqual(calls.filter((call) => call[0] === "journey-rocket-restore").at(-1), ["journey-rocket-restore"]);
  const afterLaunch = hub.snapshot();
  assert.deepEqual({
    worldId: afterLaunch.worldId,
    activeDestination: afterLaunch.activeDestination,
    journeyAction: afterLaunch.journeyAction,
    availableDestinations: afterLaunch.availableDestinations
  }, {
    worldId: overviewSnapshot.worldId,
    activeDestination: overviewSnapshot.activeDestination,
    journeyAction: overviewSnapshot.journeyAction,
    availableDestinations: overviewSnapshot.availableDestinations
  }, "delegating the click leaves Planet Hub save/progression projection unchanged");

  detail = { target: "journey", destination: "journey", action: null };
  activate(65, 170);
  assert.equal(journeyActivations, 1, "the landing platform selects Journey but never launches it");

  detail = null;
  activate(66, 210);
  assert.equal(journeyActivations, 1, "focused background exit never launches Journey");
});

test("a deliberate Earth rocket activation stages departure for a continuing Moon project", async () => {
  const journeyControl = new FakeElement("BUTTON");
  const { hub, root, calls, reportPhase } = fixture({
    elements: new Map([["moonHomeRocket", journeyControl]]),
    pick: () => "journey"
  });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  hub.sync({
    worldId: "earth",
    activeDestination: "journey",
    availableDestinations: ["forge", "journey", "arena"],
    journeyAction: { actionKind: "continue", projectId: "lunar-dynamo" },
    revealState: "revealed"
  });
  root.dispatch("pointerdown", {
    target: hub.canvas, pointerType: "mouse", clientX: 400, clientY: 180, pointerId: 71, timeStamp: 10
  });
  root.dispatch("pointerup", {
    target: hub.canvas, pointerType: "mouse", clientX: 400, clientY: 180, pointerId: 71, timeStamp: 30
  });
  reportPhase("ready");
  calls.length = 0;

  assert.equal(await hub.stageJourneyActivation({ trigger: journeyControl }), true);
  assert.equal(calls.filter((call) => call[0] === "journey-departure").length, 1,
    "continue reuses the same in-hub Earth-to-Moon departure as first launch");
  assert.equal(hub.snapshot().journeyAction, "continue",
    "presentation replay must not mutate Journey progression state");
  hub.destroy();
});

test("backgrounding an outbound launch restores a ready Journey that can be activated again", async () => {
  let finishFirstDeparture;
  let departureCount = 0;
  const firstDeparture = new Promise((resolve) => { finishFirstDeparture = resolve; });
  const journeyControl = new FakeElement("BUTTON");
  const { hub, root, calls, reportPhase } = fixture({
    elements: new Map([["moonHomeRocket", journeyControl]]),
    pick: () => "journey",
    journeyDeparture: () => {
      departureCount += 1;
      return departureCount === 1 ? firstDeparture : Promise.resolve(true);
    }
  });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  hub.sync({
    worldId: "earth",
    activeDestination: "journey",
    availableDestinations: ["forge", "journey", "arena"],
    journeyAction: { actionKind: "continue" },
    revealState: "revealed"
  });
  root.dispatch("pointerdown", {
    target: hub.canvas, pointerType: "mouse", clientX: 400, clientY: 180, pointerId: 81, timeStamp: 10
  });
  root.dispatch("pointerup", {
    target: hub.canvas, pointerType: "mouse", clientX: 400, clientY: 180, pointerId: 81, timeStamp: 30
  });
  reportPhase("ready");

  const pending = hub.stageJourneyActivation({ trigger: journeyControl });
  await Promise.resolve();
  assert.equal(hub.snapshot().phase, "transitioning");
  hub.suspend("document-hidden");
  assert.equal(hub.snapshot().phase, "ready", "suspension cannot strand the launch gate in transitioning");
  assert.deepEqual(calls.filter((call) => call[0] === "journey-departure-cancel").at(-1), [
    "journey-departure-cancel",
    { reason: "document-hidden" }
  ]);
  finishFirstDeparture(false);
  assert.equal(await pending, false);

  hub.resume("document-hidden");
  assert.equal(await hub.stageJourneyActivation({ trigger: journeyControl }), true,
    "the same focused Journey remains launchable after foregrounding");
  assert.equal(departureCount, 2);
  hub.destroy();
});

test("suspend and resume reasons are idempotent under repeated activity synchronization", async () => {
  const { hub, calls } = fixture();
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  calls.length = 0;

  assert.equal(hub.resume("home-hidden"), false,
    "resuming an absent reason must not republish or wake the renderer");
  assert.equal(hub.suspend("home-hidden"), true);
  assert.equal(hub.suspend("home-hidden"), false,
    "the same observer signal must not suspend and publish twice");
  assert.equal(hub.resume("secondary-surface"), false,
    "an unrelated absent reason must leave the active suspension untouched");
  assert.equal(hub.resume("home-hidden"), true);
  assert.equal(hub.resume("home-hidden"), false,
    "the repeated visible-state signal must remain a no-op");

  assert.equal(calls.filter(([name]) => name === "suspend").length, 1);
  assert.equal(calls.filter(([name]) => name === "resume").length, 1);
  assert.equal(hub.snapshot().suspended, false);
  hub.destroy();
});

test("Moon project Home travel stages the Earth scene and delegates one reverse flight without replaying departure", async () => {
  const { hub, root, calls } = fixture();
  await hub.prepare({ worldId: "moon", deadlineMs: 0 });
  hub.sync({
    worldId: "moon",
    activeDestination: "journey",
    availableDestinations: ["forge", "journey", "arena"],
    journeyAction: { actionKind: "continue" },
    revealState: "revealed"
  });
  calls.length = 0;
  let prepared = 0;

  assert.equal(await hub.playJourneyReturn({
    fromWorld: "moon",
    toWorld: "earth",
    onPrepared: () => { prepared += 1; }
  }), true);
  assert.equal(prepared, 1);
  assert.ok(calls.some((call) => call[0] === "create" && call[1] === "earth"),
    "reverse travel is staged in the Earth scene that owns both worlds");
  assert.deepEqual(calls.filter((call) => call[0] === "journey-return"), [[
    "journey-return",
    { reducedMotion: false, fromWorld: "moon", toWorld: "earth" }
  ]]);
  assert.equal(calls.some((call) => call[0] === "journey-departure"), false,
    "returning Home can never replay forward arrival authority");
  assert.equal(root.dataset.homeHubJourneyReturn, "arrived");
  assert.equal(hub.snapshot().worldId, "earth", "the runtime swaps presentation only; persistence remains app-owned");
  hub.destroy();
});

test("passive Moon sync cannot replace the staged Earth renderer during reverse flight", async () => {
  let finishReturn;
  const returnFlight = new Promise((resolve) => { finishReturn = resolve; });
  const { hub, calls } = fixture({ journeyReturn: () => returnFlight });
  await hub.prepare({ worldId: "moon", deadlineMs: 0 });
  hub.sync({
    worldId: "moon",
    activeDestination: "journey",
    availableDestinations: ["forge", "journey", "arena"],
    journeyAction: { actionKind: "continue" },
    revealState: "revealed"
  });
  calls.length = 0;

  const pending = hub.playJourneyReturn({ fromWorld: "moon", toWorld: "earth" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(calls.some((call) => call[0] === "journey-return"));
  const destroysBeforeSync = calls.filter((call) => call[0] === "destroy").length;

  hub.sync({
    worldId: "moon",
    activeDestination: "forge",
    availableDestinations: ["forge", "journey", "arena"],
    journeyAction: { actionKind: "continue" },
    revealState: "revealed"
  });
  assert.equal(hub.snapshot().worldId, "earth", "the staged travel scene stays authoritative until landing");
  assert.equal(hub.snapshot().activeDestination, "journey", "passive sync cannot retarget an active flight");
  assert.equal(calls.filter((call) => call[0] === "destroy").length, destroysBeforeSync,
    "passive sync never destroys the in-flight renderer");

  finishReturn(true);
  assert.equal(await pending, true);
  hub.destroy();
});

test("suspending reverse flight reports interruption instead of a fallback-eligible failure", async () => {
  let finishReturn;
  const returnFlight = new Promise((resolve) => { finishReturn = resolve; });
  const { hub, root, calls } = fixture({ journeyReturn: () => returnFlight });
  await hub.prepare({ worldId: "moon", deadlineMs: 0 });
  hub.sync({
    worldId: "moon",
    activeDestination: "journey",
    availableDestinations: ["forge", "journey", "arena"],
    journeyAction: { actionKind: "continue" }
  });

  const pending = hub.playJourneyReturn({ fromWorld: "moon", toWorld: "earth" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  hub.suspend("document-hidden");
  assert.deepEqual(await pending, {
    status: "interrupted",
    completed: false,
    reason: "document-hidden"
  });
  assert.deepEqual(calls.filter((call) => call[0] === "journey-return-cancel").at(-1), [
    "journey-return-cancel",
    { reason: "document-hidden" }
  ]);
  assert.equal(root.dataset.homeHubJourneyReturn, "interrupted");
  assert.equal(root.dataset.homeHubJourneyReturnReason, "document-hidden");
  finishReturn(true);
  hub.destroy();
});

test("focused Journey rocket delegates preparing state to the visible Visit action", async () => {
  const rocket = new FakeElement("BUTTON");
  rocket.disabled = true;
  rocket.focus = () => { rocket.focused = true; };
  const visit = new FakeElement("BUTTON");
  visit.focus = (options) => {
    visit.focusOptions = options;
    visit.dispatch("focus");
  };
  let rocketActivations = 0;
  let visitActivations = 0;
  rocket.addEventListener("click", () => { rocketActivations += 1; });
  visit.addEventListener("click", () => { visitActivations += 1; });
  const elements = new Map([
    ["moonHomeRocket", rocket],
    ["moonHomeProjectVisit", visit]
  ]);
  const detail = { target: "journey", destination: "journey", action: "journey-launch" };
  const { hub, root, reportPhase } = fixture({
    elements,
    useDefaultFocus: true,
    pick: () => "journey",
    pickDetail: () => detail
  });
  await hub.prepare({ deadlineMs: 0 });
  hub.sync({
    activeDestination: "forge",
    availableDestinations: ["forge", "journey", "arena"],
    journeyAction: { actionKind: "preparing" }
  });
  const activate = (pointerId, timeStamp) => {
    root.dispatch("pointerdown", { target: hub.canvas, pointerType: "mouse", clientX: 400, clientY: 180, pointerId, timeStamp });
    root.dispatch("pointerup", { target: hub.canvas, pointerType: "mouse", clientX: 400, clientY: 180, pointerId, timeStamp: timeStamp + 20 });
  };

  activate(71, 10);
  assert.deepEqual(visit.focusOptions, { preventScroll: true });
  assert.equal(rocket.focused, undefined);
  assert.equal(visitActivations, 0, "the overview click only enters focused presentation");
  reportPhase("ready");

  activate(72, 50);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(visitActivations, 1, "preparing delegates to the existing Visit Moonhaven action");
  assert.equal(rocketActivations, 0, "the disabled voyage control is never activated");
  assert.equal(root.dataset.homeHubJourneyActivation, "preparing");
});

test("save-data devices remain on the usable poster path without importing Three.js", async () => {
  let rendererLoads = 0;
  const { hub, root } = fixture({
    capabilities: { webgl2: true, saveData: true, width: 1440, height: 900 },
    rendererFactory: async () => { rendererLoads += 1; }
  });
  const result = await hub.prepare({ deadlineMs: 0 });
  assert.equal(result.quality, "static");
  assert.equal(result.renderer, "fallback");
  assert.equal(root.dataset.homeHubPhase, "fallback");
  assert.equal(rendererLoads, 0);
  assert.match(hub.poster.src, /earth-forge\.webp$/);
});

test("poster fallback reserves touch drags for orbit semantics while labeled tabs remain authoritative", async () => {
  const { hub, root, orbitRoot, calls } = fixture({
    capabilities: { webgl2: false, saveData: false, width: 390, height: 844 }
  });
  await hub.prepare({ deadlineMs: 0 });
  hub.sync({ activeDestination: "forge", availableDestinations: ["forge", "journey", "arena"] });
  root.dispatch("pointerdown", { target: root, pointerType: "touch", pointerId: 31, clientX: 300, clientY: 200, timeStamp: 0 });
  root.dispatch("pointerup", { target: root, pointerType: "touch", pointerId: 31, clientX: 190, clientY: 202, timeStamp: 160 });
  assert.equal(calls.some((call) => call[0] === "select" && call[2] === "swipe"), false,
    "the canvas never reinterprets an orbit gesture as destination navigation");
  orbitRoot.dispatch("homeorbitchange", {
    detail: {
      activeScene: "journey",
      availableScenes: ["forge", "journey", "arena"],
      source: "tab"
    }
  });
  assert.match(hub.poster.src, /earth-journey\.webp$/);
  assert.equal(hub.snapshot().activeDestination, "journey");
  assert.equal(hub.snapshot().renderer, "fallback");
});

test("deadline keeps slow capable-device preparation visibly loading until a late renderer crossfades in", async () => {
  let release;
  const ready = new Promise((resolve) => { release = resolve; });
  const { hub, root } = fixture({ rendererFactory: async () => ready });
  const timed = await hub.prepare({ deadlineMs: 5 });
  assert.equal(timed.renderer, "pending");
  assert.equal(timed.phase, "loading");
  assert.equal(root.dataset.homeHubRenderer, "pending");
  assert.equal(root.dataset.homeHubPhase, "loading");
  release({ setDestination() {}, setAvailable() {}, pick() {}, suspend() {}, resume() {}, destroy() {} });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(hub.snapshot().renderer, "webgl");
  assert.equal(root.dataset.homeHubRenderer, "webgl");
});

test("a stale world preparation cannot discard the newer live renderer", async () => {
  const pending = [];
  const destroyed = [];
  const rendererFactory = (options) => new Promise((resolve) => {
    pending.push({ options, resolve });
  });
  const { hub } = fixture({ rendererFactory });
  const earth = hub.prepare({ worldId: "earth", deadlineMs: 0 });
  while (pending.length < 1) await new Promise((resolve) => setTimeout(resolve, 0));

  hub.sync({ worldId: "moon", activeDestination: "forge", availableDestinations: ["forge"] });
  while (pending.length < 2) await new Promise((resolve) => setTimeout(resolve, 0));

  pending[1].resolve({
    setDestination() {}, setAvailable() {}, pick() {}, suspend() {}, resume() {},
    destroy() { destroyed.push("moon"); }
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(hub.snapshot().renderer, "webgl");
  assert.equal(hub.snapshot().worldId, "moon");

  pending[0].resolve({
    setDestination() {}, setAvailable() {}, pick() {}, suspend() {}, resume() {},
    destroy() { destroyed.push("earth"); }
  });
  await earth;
  assert.deepEqual(destroyed, ["earth"]);
  assert.equal(hub.snapshot().renderer, "webgl");
  assert.equal(hub.snapshot().worldId, "moon");
});

test("context loss immediately restores the poster and permits only one renderer restoration", async () => {
  const { hub, root, calls } = fixture();
  await hub.prepare({ deadlineMs: 0 });
  let prevented = false;
  hub.canvas.dispatch("webglcontextlost", { preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(root.dataset.homeHubRenderer, "fallback");
  assert.equal(root.dataset.homeHubPhase, "lost");
  hub.canvas.dispatch("webglcontextrestored");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(root.dataset.homeHubRenderer, "webgl");
  const createCount = calls.filter((call) => call[0] === "create").length;
  hub.canvas.dispatch("webglcontextlost", { preventDefault() {} });
  hub.canvas.dispatch("webglcontextrestored");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(hub.snapshot().quality, "static");
  assert.equal(calls.filter((call) => call[0] === "create").length, createCount);
});

test("stationary fine pointers reconcile moving landmarks without creating camera steering", () => {
  const stage = new FakeElement();
  const calls = [];
  let picked = null;
  const interaction = createPlanetHubInteraction({
    stage,
    windowRef: { matchMedia: () => ({ matches: false }) },
    getAvailable: () => ["forge", "journey", "arena"],
    pickDetail: () => picked,
    onHoverOrbit: (vector, meta) => { calls.push(["orbit", vector, meta]); return true; },
    onHoverEnd: (meta) => { calls.push(["settle", meta]); return true; },
    onLandmarkHoverChange: (destination, meta) => calls.push(["landmark", destination, meta.action])
  });

  stage.dispatch("pointermove", { pointerType: "mouse", clientX: 520, clientY: 150 });
  assert.equal(interaction.snapshotPointer().region, "space");
  assert.equal(calls.some((call) => call[0] === "orbit"), false,
    "a parked pointer can never become an implicit orbit force");

  picked = { target: "journey", destination: "journey", action: "journey-launch" };
  interaction.reconcilePointer({ source: "renderer-frame" });
  assert.deepEqual(calls.filter((call) => call[0] === "landmark").at(-1), [
    "landmark", "journey", "journey-launch"
  ]);

  const callCountAtStableLandmark = calls.length;
  interaction.reconcilePointer({ source: "renderer-frame" });
  assert.equal(calls.length, callCountAtStableLandmark,
    "an unchanged renderer frame cannot re-fire semantic hover or mutate DOM-facing state");

  picked = null;
  interaction.reconcilePointer({ source: "renderer-frame" });
  assert.equal(interaction.snapshotPointer().region, "space");
  assert.deepEqual(calls.filter((call) => call[0] === "landmark").at(-1), ["landmark", null, null],
    "the landmark affordance clears when moving geometry leaves a parked pointer");

  const stableSpaceCallCount = calls.length;
  interaction.reconcilePointer({ source: "renderer-frame" });
  assert.equal(calls.length, stableSpaceCallCount,
    "stable empty space remains callback-free across renderer frames");
  interaction.destroy();
});

test("single body click selects while same-body double-click focuses exactly once", () => {
  const stage = new FakeElement();
  const selections = [];
  const focuses = [];
  const commits = [];
  const interaction = createPlanetHubInteraction({
    stage,
    windowRef: { matchMedia: () => ({ matches: false }) },
    getAvailable: () => ["forge", "journey", "arena"],
    pickDetail: () => ({ target: "earth", body: "earth", destination: null, action: null, satellite: null }),
    onBodySelect: (body, meta) => selections.push([body, meta.source]),
    onBodyFocus: (body, meta) => focuses.push([body, meta]),
    onCommit: (destination) => commits.push(destination)
  });

  stage.dispatch("pointerdown", { pointerType: "mouse", pointerId: 1, clientX: 200, clientY: 180, timeStamp: 10 });
  const firstAllowed = stage.dispatch("pointerup", { pointerType: "mouse", pointerId: 1, clientX: 202, clientY: 181, timeStamp: 30 });
  assert.equal(firstAllowed, true);
  assert.equal(interaction.snapshotPointer().pendingBody, "earth");
  assert.deepEqual(selections, [["earth", "body-click"]]);
  assert.deepEqual(focuses, [], "one body click selects without moving the camera pivot");

  stage.dispatch("pointerdown", { pointerType: "mouse", pointerId: 2, clientX: 216, clientY: 188, timeStamp: 220 });
  const secondAllowed = stage.dispatch("pointerup", { pointerType: "mouse", pointerId: 2, clientX: 218, clientY: 189, timeStamp: 250 });
  assert.equal(secondAllowed, false, "the recognized double-click suppresses native double-click zoom");
  assert.equal(interaction.snapshotPointer().pendingBody, null);
  assert.deepEqual(focuses, [["earth", {
    source: "body-double-click",
    pointerType: "mouse",
    clientX: 218,
    clientY: 189
  }]]);
  assert.equal(selections.length, 1, "the second click upgrades the pair to focus instead of reselecting");
  assert.deepEqual(commits, []);
  interaction.destroy();
});

test("body double activation honors modality distance and timing thresholds", () => {
  function run({ pointerType, first = [100, 100, 20], second = [100, 100, 300] }) {
    const stage = new FakeElement();
    const focuses = [];
    const interaction = createPlanetHubInteraction({
      stage,
      windowRef: { matchMedia: () => ({ matches: pointerType === "touch" }) },
      pickDetail: () => ({ body: "moon", satellite: "moon" }),
      onBodyFocus: (body, meta) => focuses.push([body, meta.source])
    });
    const tap = ([x, y, time], id) => {
      stage.dispatch("pointerdown", { pointerType, pointerId: id, clientX: x, clientY: y, timeStamp: time - 10 });
      stage.dispatch("pointerup", { pointerType, pointerId: id, clientX: x, clientY: y, timeStamp: time });
    };
    tap(first, 1);
    tap(second, 2);
    interaction.destroy();
    return focuses;
  }

  assert.equal(run({ pointerType: "mouse", second: [132, 100, 520] }).length, 1,
    "32px and 500ms are inclusive for mouse input");
  assert.equal(run({ pointerType: "mouse", second: [133, 100, 500] }).length, 0,
    "mouse clicks farther than 32px begin a new pair");
  assert.equal(run({ pointerType: "mouse", second: [100, 100, 521] }).length, 0,
    "mouse clicks later than 500ms begin a new pair");
  assert.deepEqual(run({ pointerType: "touch", second: [148, 100, 520] }), [["moon", "body-double-tap"]],
    "touch receives the larger 48px radius");
  assert.equal(run({ pointerType: "touch", second: [149, 100, 500] }).length, 0);
});

test("landmarks stay immediate and never participate in body double-click recognition", () => {
  const stage = new FakeElement();
  const calls = [];
  const interaction = createPlanetHubInteraction({
    stage,
    windowRef: { matchMedia: () => ({ matches: false }) },
    getAvailable: () => ["forge", "journey", "arena"],
    pickDetail: () => ({ target: "forge", body: "earth", destination: "forge", action: null }),
    onCommit: (destination, meta) => calls.push(["commit", destination, meta.source]),
    onBodyFocus: (body) => calls.push(["body", body])
  });
  for (const [id, time] of [[1, 30], [2, 180]]) {
    stage.dispatch("pointerdown", { pointerType: "mouse", pointerId: id, clientX: 220, clientY: 160, timeStamp: time - 10 });
    stage.dispatch("pointerup", { pointerType: "mouse", pointerId: id, clientX: 220, clientY: 160, timeStamp: time });
  }
  assert.deepEqual(calls, [
    ["commit", "forge", "landmark"],
    ["commit", "forge", "landmark"]
  ]);
  assert.equal(interaction.snapshotPointer().pendingBody, null);
  interaction.destroy();
});

test("drag, cancellation, different bodies, and pinch invalidate body double activation", () => {
  const stage = new FakeElement();
  const focuses = [];
  let body = "earth";
  const interaction = createPlanetHubInteraction({
    stage,
    windowRef: { matchMedia: () => ({ matches: false }) },
    pickDetail: () => ({ target: body, body }),
    onDragOrbit: () => true,
    onBodyFocus: (value) => focuses.push(value)
  });
  const tap = (id, time, pointerType = "mouse") => {
    stage.dispatch("pointerdown", { pointerType, pointerId: id, clientX: 100, clientY: 100, timeStamp: time - 10 });
    stage.dispatch("pointerup", { pointerType, pointerId: id, clientX: 100, clientY: 100, timeStamp: time });
  };

  tap(1, 20);
  stage.dispatch("pointerdown", { pointerType: "mouse", pointerId: 2, clientX: 100, clientY: 100, timeStamp: 80 });
  stage.dispatch("pointermove", { pointerType: "mouse", pointerId: 2, clientX: 140, clientY: 100, timeStamp: 100 });
  stage.dispatch("pointerup", { pointerType: "mouse", pointerId: 2, clientX: 140, clientY: 100, timeStamp: 120 });
  tap(3, 180);
  assert.deepEqual(focuses, [], "a drag clears the earlier click instead of completing it");

  stage.dispatch("pointercancel", { pointerType: "mouse", pointerId: 3, timeStamp: 200 });
  tap(4, 240);
  assert.deepEqual(focuses, [], "pointer cancellation clears the pending first click");

  body = "moon";
  tap(5, 280);
  assert.deepEqual(focuses, [], "a different body replaces rather than completes the pair");
  interaction.destroy();

  const touchStage = new FakeElement();
  const touchFocuses = [];
  const touchInteraction = createPlanetHubInteraction({
    stage: touchStage,
    windowRef: { matchMedia: () => ({ matches: true }) },
    pickDetail: () => ({ target: "moon", body: "moon", satellite: "moon" }),
    onPinchZoom: () => true,
    onBodyFocus: (value) => touchFocuses.push(value)
  });
  touchStage.dispatch("pointerdown", { pointerType: "touch", pointerId: 10, clientX: 100, clientY: 100, timeStamp: 10 });
  touchStage.dispatch("pointerup", { pointerType: "touch", pointerId: 10, clientX: 100, clientY: 100, timeStamp: 20 });
  touchStage.dispatch("pointerdown", { pointerType: "touch", pointerId: 11, clientX: 80, clientY: 100, timeStamp: 40 });
  touchStage.dispatch("pointerdown", { pointerType: "touch", pointerId: 12, isPrimary: false, clientX: 180, clientY: 100, timeStamp: 50 });
  assert.equal(touchInteraction.snapshotPointer().pendingBody, null);
  assert.deepEqual(touchFocuses, []);
  touchInteraction.destroy();
});

test("desktop hover only highlights while mouse and touch drags orbit directly", () => {
  const stage = new FakeElement();
  const calls = [];
  let active = "forge";
  let landmarkUnderPointer = false;
  const interaction = createPlanetHubInteraction({
    stage,
    windowRef: { matchMedia: () => ({ matches: false }) },
    getActive: () => active,
    getAvailable: () => ["forge", "journey", "arena"],
    getPlanetBounds: () => ({ left: 200, right: 600, top: 50, bottom: 450, centerX: 400, centerY: 250, radiusX: 200, radiusY: 200 }),
    pick: () => landmarkUnderPointer ? "journey" : null,
    onHoverOrbit: (vector) => calls.push(["orbit", vector]),
    onHoverEnd: (meta) => calls.push(["hover-end", meta]),
    onDragOrbit: (delta) => { calls.push(["drag", delta]); return true; },
    onDragEnd: (meta) => { calls.push(["drag-end", meta]); return true; },
    onLandmarkHoverChange: (destination, meta) => calls.push(["landmark-hover", destination, meta.source]),
    onPreviewEnd: (meta) => calls.push(["end", meta.source]),
    onCommit: (destination, meta) => { calls.push(["commit", destination, meta.source]); active = destination; }
  });
  stage.dispatch("pointermove", { pointerType: "mouse", clientX: 520, clientY: 150 });
  assert.equal(calls.some((call) => call[0] === "orbit"), false,
    "passive pointer position never steers the astronomical camera");

  landmarkUnderPointer = true;
  stage.dispatch("pointermove", { pointerType: "mouse", clientX: 520, clientY: 150 });
  assert.deepEqual(calls.at(-1), ["landmark-hover", "journey", "landmark-hover"]);
  landmarkUnderPointer = false;
  stage.dispatch("pointermove", { pointerType: "mouse", clientX: 400, clientY: 250 });
  assert.ok(calls.some((call) => call[0] === "landmark-hover" && call[1] === null && call[2] === "celestial-hover"));
  assert.equal(calls.some((call) => call[0] === "hover-end" && call[1].source === "dead-zone"), false);
  stage.dispatch("pointerleave", { pointerType: "mouse" });
  assert.deepEqual(calls.at(-1), ["hover-end", { source: "pointer-leave" }]);

  const commitsBeforeDrag = calls.filter((call) => call[0] === "commit").length;
  stage.dispatch("pointerdown", { pointerType: "mouse", clientX: 300, clientY: 200, pointerId: 2, timeStamp: 10 });
  stage.dispatch("pointermove", { pointerType: "mouse", clientX: 340, clientY: 200, pointerId: 2, timeStamp: 26 });
  stage.dispatch("pointermove", { pointerType: "mouse", clientX: 380, clientY: 202, pointerId: 2, timeStamp: 42 });
  stage.dispatch("pointerup", { pointerType: "mouse", clientX: 380, clientY: 202, pointerId: 2, timeStamp: 58 });
  const directDragCalls = calls.filter((call) => call[0] === "drag");
  assert.equal(directDragCalls.length, 2);
  assert.ok(directDragCalls.every((call) => call[1].deltaX > 0), "rightward mouse motion is forwarded without snapping");
  const releasedDrag = calls.filter((call) => call[0] === "drag-end").at(-1);
  assert.equal(releasedDrag[0], "drag-end");
  assert.equal(releasedDrag[1].source, "pointer-drag-release");
  assert.equal(releasedDrag[1].cancelled, false);
  assert.equal(releasedDrag[1].pointerType, "mouse");
  assert.equal(releasedDrag[1].displacementX, 80);
  assert.equal(releasedDrag[1].displacementY, 2);
  assert.ok(Math.abs(releasedDrag[1].distancePx - Math.hypot(80, 2)) < 1e-9);
  assert.equal(releasedDrag[1].durationMs, 48);
  assert.equal(releasedDrag[1].heldStillMs, 16);
  assert.ok(releasedDrag[1].recentVelocityX > 2);
  assert.ok(releasedDrag[1].recentSpeedPxPerMs > 2);
  assert.equal(releasedDrag[1].viewportWidth, 800);
  assert.equal(releasedDrag[1].viewportHeight, 500);
  assert.equal(calls.filter((call) => call[0] === "commit").length, commitsBeforeDrag,
    "a direct globe drag never commits a destination");

  landmarkUnderPointer = true;
  stage.dispatch("pointerdown", { pointerType: "mouse", clientX: 520, clientY: 150, pointerId: 5, timeStamp: 60 });
  landmarkUnderPointer = false;
  stage.dispatch("pointermove", { pointerType: "mouse", clientX: 580, clientY: 150, pointerId: 5, timeStamp: 76 });
  stage.dispatch("pointerup", { pointerType: "mouse", clientX: 580, clientY: 150, pointerId: 5, timeStamp: 92 });
  assert.equal(calls.filter((call) => call[0] === "commit").length, commitsBeforeDrag,
    "crossing the drag threshold suppresses a landmark click");

  stage.dispatch("pointerdown", { pointerType: "mouse", clientX: 300, clientY: 200, pointerId: 6, timeStamp: 94 });
  stage.dispatch("pointermove", { pointerType: "mouse", clientX: 350, clientY: 200, pointerId: 6, timeStamp: 110 });
  stage.dispatch("pointercancel", { pointerType: "mouse", pointerId: 6, timeStamp: 118 });
  const cancelledDrag = calls.filter((call) => call[0] === "drag-end").at(-1);
  assert.equal(cancelledDrag[0], "drag-end");
  assert.equal(cancelledDrag[1].source, "pointer-drag-cancel");
  assert.equal(cancelledDrag[1].cancelled, true);
  assert.equal(cancelledDrag[1].pointerType, "mouse");
  assert.equal(cancelledDrag[1].displacementX, 50);
  assert.equal(cancelledDrag[1].distancePx, 50);
  assert.equal(cancelledDrag[1].heldStillMs, 8,
    "cancelled gestures still report their final movement but the renderer discards the force");

  stage.dispatch("pointerdown", { pointerType: "mouse", clientX: 300, clientY: 200, pointerId: 7, timeStamp: 120 });
  stage.dispatch("pointermove", { pointerType: "mouse", clientX: 360, clientY: 200, pointerId: 7, timeStamp: 136 });
  stage.dispatch("lostpointercapture", { pointerType: "mouse", pointerId: 7, timeStamp: 144 });
  const lostCaptureDrag = calls.filter((call) => call[0] === "drag-end").at(-1);
  assert.equal(lostCaptureDrag[1].source, "pointer-capture-lost");
  assert.equal(lostCaptureDrag[1].cancelled, true,
    "unexpected capture loss cannot strand the renderer in drag mode");

  landmarkUnderPointer = true;
  stage.dispatch("pointerdown", { pointerType: "mouse", clientX: 520, clientY: 150, pointerId: 3, timeStamp: 70 });
  landmarkUnderPointer = false;
  stage.dispatch("pointerup", { pointerType: "mouse", clientX: 520, clientY: 150, pointerId: 3, timeStamp: 110 });
  assert.deepEqual(calls.at(-1), ["commit", "journey", "landmark"], "press capture survives inertial landmark motion");

  active = "forge";
  const dragsBeforeTouch = calls.filter((call) => call[0] === "drag").length;
  const commitsBeforeTouch = calls.filter((call) => call[0] === "commit").length;
  stage.dispatch("pointerdown", { pointerType: "touch", clientX: 300, clientY: 200, pointerId: 4, timeStamp: 100 });
  stage.dispatch("pointermove", { pointerType: "touch", clientX: 240, clientY: 203, pointerId: 4, timeStamp: 180 });
  stage.dispatch("pointerup", { pointerType: "touch", clientX: 200, clientY: 203, pointerId: 4, timeStamp: 300 });
  assert.equal(calls.filter((call) => call[0] === "drag").length, dragsBeforeTouch + 1,
    "one-finger touch uses the same direct orbit contract as mouse drag");
  assert.equal(calls.filter((call) => call[0] === "commit").length, commitsBeforeTouch,
    "touch orbit cannot become a destination swipe on release");
  interaction.destroy();
});

test("two-finger pinch owns zoom without committing the one-finger destination swipe", () => {
  const stage = new FakeElement();
  const calls = [];
  const interaction = createPlanetHubInteraction({
    stage,
    windowRef: { matchMedia: () => ({ matches: true }) },
    getAvailable: () => ["forge", "journey", "arena"],
    onPinchZoom: (value) => { calls.push(["pinch", value]); return true; },
    onPinchEnd: (meta) => calls.push(["pinch-end", meta]),
    onPreviewEnd: (meta) => calls.push(["preview-end", meta]),
    onCommit: (destination) => calls.push(["commit", destination])
  });

  stage.dispatch("pointerdown", { pointerType: "touch", isPrimary: true, pointerId: 1, clientX: 220, clientY: 220 });
  stage.dispatch("pointerdown", { pointerType: "touch", isPrimary: false, pointerId: 2, clientX: 420, clientY: 220 });
  const moveAllowed = stage.dispatch("pointermove", { pointerType: "touch", isPrimary: false, pointerId: 2, clientX: 350, clientY: 220 });
  stage.dispatch("pointerup", { pointerType: "touch", isPrimary: false, pointerId: 2, clientX: 350, clientY: 220 });

  assert.equal(moveAllowed, false, "an accepted pinch prevents native page zoom");
  assert.equal(calls.filter((call) => call[0] === "pinch").length, 1);
  assert.ok(calls.find((call) => call[0] === "pinch")[1].currentSpan < 200,
    "pinching inward is forwarded as an outward semantic zoom");
  assert.equal(calls.filter((call) => call[0] === "commit").length, 0);
  assert.equal(calls.filter((call) => call[0] === "pinch-end").length, 1);
  interaction.destroy();
});

test("Home wheel input changes semantic zoom while controls retain their own scrolling", async () => {
  const { hub, root, calls } = fixture({ pick: () => null });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  hub.sync({
    worldId: "earth",
    activeDestination: "forge",
    availableDestinations: ["forge", "journey", "arena"],
    revealState: "revealed"
  });

  const stageScrollAllowed = root.dispatch("wheel", { deltaY: 100, deltaMode: 0, target: root });
  const zoomCall = calls.filter((call) => call[0] === "view-zoom").at(-1);
  assert.equal(stageScrollAllowed, false, "the full-viewport stage contains wheel scrolling");
  assert.ok(zoomCall[1] > 0, "scrolling down moves outward through logarithmic view space");
  assert.ok(zoomCall[1] <= 0.032 + 1e-12, "one wheel input cannot leap across a semantic tier");
  assert.equal(zoomCall[2].source, "wheel");
  assert.equal(root.dataset.homeHubView, "planet");
  assert.ok(Number(root.dataset.homeHubZoom) >= 0);

  const button = new FakeElement("BUTTON");
  button.parentElement = root;
  button.closest = () => button;
  const callsBeforeControlWheel = calls.filter((call) => call[0] === "view-zoom").length;
  const controlScrollAllowed = root.dispatch("wheel", { deltaY: 100, deltaMode: 0, target: button });
  assert.equal(controlScrollAllowed, true);
  assert.equal(calls.filter((call) => call[0] === "view-zoom").length, callsBeforeControlWheel,
    "buttons and independently scrolling UI never steer the camera");
  hub.destroy();
});

test("rapid wheel pulses cross the Milky Way boundary without dropping cosmic distance", async () => {
  const { hub, root, orbitRoot, calls } = fixture({
    pick: () => null,
    withZoomRail: true,
    reducedMotion: true
  });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  hub.sync({
    worldId: "earth",
    activeDestination: "forge",
    availableDestinations: ["forge", "journey", "arena"],
    revealState: "revealed"
  });

  const stops = orbitRoot.querySelector("[data-planet-hub-zoom-rail]")
    .querySelectorAll("[data-planet-hub-zoom-stop]");
  stops.at(-1).click();
  assert.equal(calls.filter(([kind]) => kind === "view-zoom").at(-1)[1], 1);

  for (let index = 0; index < 3; index += 1) {
    const allowed = root.dispatch("wheel", { deltaY: 100, deltaMode: 0, target: root });
    assert.equal(allowed, false);
  }
  const cosmicCalls = calls.filter(([kind]) => kind === "cosmic-zoom");
  assert.equal(cosmicCalls.length, 3, "every queued notch advances the independent cosmic segment");
  const distances = cosmicCalls.map(([, progress]) =>
    resolvePlanetHubCosmicRepresentedDistance(progress).distanceMeters);
  assert.ok(Math.abs(distances[1] / distances[0] - 1.2) < 1e-12);
  assert.ok(Math.abs(distances[2] / distances[1] - 1.2) < 1e-12);
  assert.equal(hub.snapshot().viewSegment, "cosmic");
  assert.equal(hub.snapshot().viewDistanceUnit, "kly",
    "the first cosmic notches remain a truthful physical ruler rather than jumping to a fake unit");

  stops.at(-1).click();
  assert.equal(calls.filter(([kind]) => kind === "cosmic-zoom").at(-1)[1], 0,
    "the Milky Way rail stop returns from the extension to the exact shared boundary");
  hub.destroy();
});

test("semantic zoom rail reuses renderer zoom authority with mouse and complete keyboard navigation", async () => {
  const { hub, orbitRoot, calls } = fixture({ pick: () => null, withZoomRail: true });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  hub.sync({
    worldId: "earth",
    activeDestination: "forge",
    availableDestinations: ["forge", "journey", "arena"],
    revealState: "revealed"
  });

  const rail = orbitRoot.querySelector("[data-planet-hub-zoom-rail]");
  const stops = rail.querySelectorAll("[data-planet-hub-zoom-stop]");
  const reset = rail.querySelector("[data-planet-hub-zoom-reset]");
  const distance = rail.querySelector("[data-planet-hub-distance]");
  assert.equal(rail.hidden, false);
  assert.equal(rail.getAttribute("aria-hidden"), "false");
  assert.equal(stops[0].getAttribute("aria-checked"), "true");
  assert.equal(distance.querySelector("[data-planet-hub-distance-value]").textContent, "12,742");
  assert.equal(distance.querySelector("[data-planet-hub-distance-unit]").textContent, "km");
  assert.match(distance.getAttribute("aria-label"), /12,742 kilometres/i);
  assert.equal(hub.canvas.dataset.planetHubDistanceUnit, "km");

  stops[2].click();
  assert.deepEqual(calls.filter((call) => call[0] === "view-zoom").at(-1), [
    "view-zoom", PLANET_HUB_ZOOM_ANCHOR_PROGRESS.system, { source: "zoom-rail", immediate: false }
  ]);
  assert.equal(stops[0].getAttribute("aria-checked"), "true",
    "the rail reflects the camera's travelled distance, not a teleported target tier");

  const pageDownAllowed = stops[2].dispatch("keydown", { key: "PageDown" });
  assert.equal(pageDownAllowed, false);
  assert.equal(stops[3].focused, true);
  assert.equal(calls.filter((call) => call[0] === "view-zoom").at(-1)[1],
    PLANET_HUB_ZOOM_ANCHOR_PROGRESS.galaxy);
  assert.equal(calls.filter((call) => call[0] === "view-zoom").at(-1)[2].source, "zoom-rail-keyboard");

  stops[3].dispatch("keydown", { key: "End" });
  assert.equal(stops[4].focused, true);
  assert.equal(calls.filter((call) => call[0] === "view-zoom").at(-1)[1], 1);

  stops[4].dispatch("keydown", { key: "Home" });
  assert.equal(stops[0].focused, true);
  assert.equal(calls.filter((call) => call[0] === "view-zoom").at(-1)[1], 0);

  stops[1].click();
  reset.click();
  assert.equal(calls.filter((call) => call[0] === "view-zoom").at(-1)[1], 0);
  assert.match(reset.getAttribute("aria-label"), /Earth/i);
  hub.destroy();
  assert.equal(rail.hidden, true);
  assert.equal(rail.getAttribute("aria-hidden"), "true");
});

test("reduced motion makes an explicit zoom stop immediate without changing wheel precision", async () => {
  const { hub, root, orbitRoot, calls } = fixture({
    pick: () => null,
    withZoomRail: true,
    reducedMotion: true
  });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  hub.sync({
    worldId: "earth",
    activeDestination: "forge",
    availableDestinations: ["forge", "journey", "arena"],
    revealState: "revealed"
  });

  const stops = orbitRoot.querySelector("[data-planet-hub-zoom-rail]")
    .querySelectorAll("[data-planet-hub-zoom-stop]");
  stops[4].click();
  assert.deepEqual(calls.filter((call) => call[0] === "view-zoom").at(-1), [
    "view-zoom", 1, { source: "zoom-rail", immediate: true }
  ]);
  const distance = orbitRoot.querySelector("[data-planet-hub-zoom-rail]")
    .querySelector("[data-planet-hub-distance]");
  assert.equal(distance.querySelector("[data-planet-hub-distance-value]").textContent, "204");
  assert.equal(distance.querySelector("[data-planet-hub-distance-unit]").textContent, "kly");
  assert.equal(hub.canvas.dataset.planetHubDistanceUnit, "kly");
  assert.ok(Math.abs(hub.snapshot().viewDistanceMeters / PLANET_HUB_DISTANCE_STOPS.universe - 1) < 1e-12);

  root.dispatch("wheel", { deltaY: -100, deltaMode: 0, target: root });
  const wheel = calls.filter((call) => call[0] === "view-zoom").at(-1);
  assert.equal(wheel[2].source, "wheel");
  assert.equal(wheel[2].immediate, true);
  assert.ok(wheel[1] >= 1 - 0.032 - 1e-12);
  hub.destroy();
});

test("semantic zoom rail stays inert when the 3D presentation falls back", async () => {
  const { hub, orbitRoot } = fixture({
    withZoomRail: true,
    capabilities: { webgl2: false, width: 1440, height: 900, deviceMemory: 8, hardwareConcurrency: 8 }
  });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  const rail = orbitRoot.querySelector("[data-planet-hub-zoom-rail]");
  assert.equal(rail.hidden, true);
  assert.equal(rail.getAttribute("aria-hidden"), "true");
  hub.destroy();
});

test("celestial selection and body focus yield the zoom rail to the return/status control", async () => {
  const { hub, root, orbitRoot } = fixture({
    withZoomRail: true,
    pickDetail: () => ({ target: "moon", body: "moon", satellite: "moon" })
  });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  hub.sync({
    worldId: "earth",
    activeDestination: "forge",
    availableDestinations: ["forge", "journey", "arena"],
    revealState: "revealed"
  });
  const rail = orbitRoot.querySelector("[data-planet-hub-zoom-rail]");
  const orbitReturn = orbitRoot.querySelector("[data-planet-hub-orbit-return]");
  const clickMoon = (pointerId, downAt, upAt) => {
    root.dispatch("pointerdown", { target: hub.canvas, pointerType: "mouse", pointerId, clientX: 520, clientY: 180, timeStamp: downAt });
    root.dispatch("pointerup", { target: hub.canvas, pointerType: "mouse", pointerId, clientX: 520, clientY: 180, timeStamp: upAt });
  };

  assert.equal(rail.hidden, false);
  clickMoon(1, 10, 30);
  assert.equal(hub.snapshot().selectedBodyId, "moon");
  assert.equal(orbitRoot.dataset.homeHubReturn, "body-selection");
  assert.equal(rail.hidden, true);
  assert.equal(rail.getAttribute("aria-hidden"), "true");

  orbitReturn.click();
  assert.equal(hub.snapshot().selectedBodyId, "earth");
  assert.equal(rail.hidden, false, "resetting selection restores the rail in the same publish");

  clickMoon(2, 100, 120);
  clickMoon(3, 250, 270);
  assert.equal(hub.snapshot().orbitBodyId, "moon");
  assert.equal(orbitRoot.dataset.homeHubReturn, "body-focus");
  assert.equal(rail.hidden, true);

  orbitReturn.click();
  assert.equal(hub.snapshot().orbitBodyId, "earth");
  assert.equal(rail.hidden, false, "returning to the current world restores the rail immediately");
  hub.destroy();
});

test("hub leaves passive landmark highlights alone and stops only on stage exit", async () => {
  let pickedDestination = "journey";
  const { hub, root, calls } = fixture({ pick: () => pickedDestination });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  hub.sync({
    worldId: "earth",
    activeDestination: "forge",
    availableDestinations: ["forge", "journey", "arena"],
    revealState: "revealed"
  });

  root.dispatch("pointermove", { pointerType: "mouse", clientX: 520, clientY: 150 });
  assert.equal(calls.some((call) => call[0] === "orbit-clear"), false);

  pickedDestination = null;
  const clearsAfterLandmark = calls.filter((call) => call[0] === "orbit-clear").length;
  root.dispatch("pointermove", { pointerType: "mouse", clientX: 400, clientY: 250 });
  assert.equal(calls.filter((call) => call[0] === "orbit-clear").length, clearsAfterLandmark,
    "ordinary space hover has no steering state to stop");

  root.dispatch("pointermove", { pointerType: "mouse", clientX: 520, clientY: 150 });
  root.dispatch("pointerleave", { pointerType: "mouse" });
  assert.deepEqual(
    calls.filter((call) => call[0] === "orbit-clear").at(-1),
    ["orbit-clear", { source: "pointer-leave" }]
  );

  hub.destroy();
});

test("renderer motion-frame seam re-raycasts a parked pointer for highlights without steering", async () => {
  let pickedDestination = "journey";
  const { hub, root, calls, reportInteractionFrame } = fixture({ pick: () => pickedDestination });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  hub.sync({
    worldId: "earth",
    activeDestination: "forge",
    availableDestinations: ["forge", "journey", "arena"],
    revealState: "revealed"
  });

  root.dispatch("pointermove", { pointerType: "mouse", clientX: 520, clientY: 150 });
  assert.deepEqual(calls.filter((call) => call[0] === "hover-destination").at(-1), [
    "hover-destination", "journey", { action: null }
  ]);

  pickedDestination = null;
  assert.equal(reportInteractionFrame({ source: "camera-motion" }), true);
  assert.deepEqual(calls.filter((call) => call[0] === "hover-destination").at(-1), [
    "hover-destination", null, { action: null }
  ]);
  assert.equal(calls.filter((call) => call[0] === "pointer-orbit").length, 0,
    "moving geometry under a parked pointer never synthesizes camera input");

  const stableCallCount = calls.length;
  assert.equal(reportInteractionFrame({ source: "camera-motion" }), false);
  assert.equal(calls.length, stableCallCount,
    "stable projected geometry is reconciled without repeating renderer or DOM-facing callbacks");
  hub.destroy();
});

test("hub forwards measured drag distance and recent release speed to the renderer", async () => {
  const { hub, root, calls } = fixture({ pick: () => null });
  await hub.prepare({ worldId: "earth", deadlineMs: 0 });
  hub.sync({
    worldId: "earth",
    activeDestination: "forge",
    availableDestinations: ["forge", "journey", "arena"],
    revealState: "revealed"
  });

  root.dispatch("pointerdown", {
    pointerType: "mouse", pointerId: 31, clientX: 100, clientY: 100, timeStamp: 100
  });
  root.dispatch("pointermove", {
    pointerType: "mouse", pointerId: 31, clientX: 160, clientY: 110, timeStamp: 116
  });
  root.dispatch("pointerup", {
    pointerType: "mouse", pointerId: 31, clientX: 170, clientY: 115, timeStamp: 132
  });

  const release = calls.filter((call) => call[0] === "pointer-drag-release").at(-1)?.[1];
  assert.equal(release.cancelled, false);
  assert.equal(release.pointerType, "mouse");
  assert.equal(release.displacementX, 70);
  assert.equal(release.displacementY, 15);
  assert.ok(Math.abs(release.distancePx - Math.hypot(70, 15)) < 1e-9);
  assert.equal(release.durationMs, 32);
  assert.equal(release.heldStillMs, 0);
  assert.ok(release.recentSpeedPxPerMs > 0);
  assert.equal(release.viewportWidth, 800);
  assert.equal(release.viewportHeight, 500);
  hub.destroy();
});

test("planet gestures never begin on interactive or independently scrollable descendants", () => {
  const stage = new FakeElement();
  const commits = [];
  const interaction = createPlanetHubInteraction({
    stage,
    windowRef: { matchMedia: () => ({ matches: false }), setTimeout, clearTimeout },
    getActive: () => "forge",
    getAvailable: () => ["forge", "journey", "arena"],
    onCommit: (destination) => commits.push(destination)
  });
  const button = {
    tagName: "BUTTON",
    closest: () => button,
    parentElement: stage,
    clientWidth: 50,
    scrollWidth: 50,
    clientHeight: 50,
    scrollHeight: 50
  };
  stage.dispatch("pointerdown", { target: button, pointerType: "touch", pointerId: 21, clientX: 300, clientY: 200, timeStamp: 0 });
  stage.dispatch("pointerup", { target: button, pointerType: "touch", pointerId: 21, clientX: 180, clientY: 202, timeStamp: 150 });
  const scroller = {
    tagName: "DIV",
    closest: () => null,
    parentElement: stage,
    clientWidth: 100,
    scrollWidth: 240,
    clientHeight: 100,
    scrollHeight: 100
  };
  stage.dispatch("pointerdown", { target: scroller, pointerType: "touch", pointerId: 22, clientX: 300, clientY: 200, timeStamp: 200 });
  stage.dispatch("pointerup", { target: scroller, pointerType: "touch", pointerId: 22, clientX: 180, clientY: 202, timeStamp: 350 });
  assert.deepEqual(commits, []);
  interaction.destroy();
});
