import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createPlanetHubAppBridge,
  PLANET_HUB_CINEMATIC_STYLESHEET
} from "../public/planet-hub-app.mjs";
import { createPlanetHubHost } from "../public/planet-hub-host.mjs";
import {
  createExpeditionState,
  recordExpeditionArrival,
  selectExpeditionHomeWorld
} from "../public/expedition.mjs";
import { createWorldweavingState } from "../public/worldweaving.mjs";

class FakeNode {
  constructor() {
    this.dataset = {};
    this.attributes = new Map();
    this.hidden = false;
  }

  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  set src(value) { this.attributes.set("src", String(value)); }
  get src() { return this.attributes.get("src") || ""; }
}

test("cinematic CSS and the 3D runtime load concurrently but both settle before Home can reveal", async () => {
  const stage = new FakeNode();
  const home = new FakeNode();
  const poster = new FakeNode();
  const calls = [];
  const documentRef = {
    querySelector(selector) {
      if (selector === "[data-planet-hub]") return stage;
      if (selector === "[data-planet-hub-poster]") return poster;
      return null;
    },
    getElementById(id) { return id === "homePlaySplit" ? home : null; }
  };
  const fakeHub = {
    sync() { calls.push("sync"); },
    prepare() { calls.push("prepare"); return Promise.resolve(); },
    destroy() {}
  };
  let releaseStyle;
  const styleReady = new Promise((resolve) => { releaseStyle = resolve; });
  const bridge = createPlanetHubAppBridge({
    documentRef,
    getSnapshot: () => ({ worldId: "earth", activeDestination: "forge" }),
    stylesheetLoader: async () => { calls.push("style-start"); await styleReady; calls.push("style-ready"); },
    runtimeImporter: async () => {
      calls.push("runtime");
      return { createPlanetHub: () => fakeHub };
    }
  });

  const ensuring = bridge.ensure();
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(calls.includes("runtime"), "runtime import must overlap a pending stylesheet fetch");
  assert.ok(!calls.includes("sync"), "Home must not reveal until the stylesheet settles");
  releaseStyle();
  await ensuring;
  assert.equal(
    PLANET_HUB_CINEMATIC_STYLESHEET.split("?")[0],
    "planet-hub-cinematic.css",
    "release synchronization may append the canonical asset version"
  );
  assert.ok(calls.indexOf("style-start") < calls.indexOf("style-ready"));
  assert.ok(calls.indexOf("runtime") < calls.indexOf("style-ready"));
  assert.ok(calls.indexOf("style-ready") < calls.indexOf("sync"));
});

test("lazy adapter failure preserves the exact poster and publishes fallback state on both Home hosts", async () => {
  const stage = new FakeNode();
  const home = new FakeNode();
  const poster = new FakeNode();
  const documentRef = {
    querySelector(selector) {
      if (selector === "[data-planet-hub]") return stage;
      if (selector === "[data-planet-hub-poster]") return poster;
      return null;
    },
    getElementById(id) { return id === "homePlaySplit" ? home : null; }
  };
  const bridge = createPlanetHubAppBridge({
    documentRef,
    getSnapshot: () => ({
      worldId: "moon",
      activeDestination: "arena",
      availableDestinations: ["forge", "journey", "arena"]
    }),
    runtimeImporter: async () => { throw new TypeError("offline"); }
  });

  assert.equal(await bridge.ensure(), null);
  assert.equal(await bridge.playJourneyReturn({ fromWorld: "moon", toWorld: "earth" }), false,
    "poster-only Home delegates reverse travel to the app's black-fade fallback");
  assert.equal(poster.src, "./art/planet-hub/posters/moon-arena.webp");
  for (const host of [stage, home]) {
    assert.equal(host.dataset.homeHubRenderer, "fallback");
    assert.equal(host.dataset.homeHubPhase, "fallback");
    assert.equal(host.dataset.homeHubQuality, "static");
    assert.equal(host.dataset.homeHubSpace, "static");
    assert.equal(host.dataset.homeWorld, "moon");
    assert.equal(host.dataset.homeHubDestination, "arena");
  }
});

test("static Home fallback is usable before JavaScript and the adapter watches dynamically added dialogs", async () => {
  const [html, bridge, host, app] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/planet-hub-app.mjs", import.meta.url), "utf8"),
    readFile(new URL("../public/planet-hub-host.mjs", import.meta.url), "utf8"),
    readFile(new URL("../public/app.js", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="homePlaySplit"[^>]+data-home-hub-renderer="fallback"[^>]+data-home-hub-phase="fallback"[^>]+data-home-hub-quality="static"[^>]+data-home-world="earth"/);
  assert.match(html, /data-planet-hub-poster[^>]+alt=""[^>]+draggable="false"/);
  assert.match(bridge, /attributeFilter:\s*\["open"\][\s\S]*childList:\s*true[\s\S]*subtree:\s*true/);
  assert.match(app, /import\("[.]\/planet-hub-host[.]mjs[^)]*\)/);
  assert.match(app, /[.]catch\(\(\) => homePlanetHubBridgePromise = null\)/,
    "a transient lazy-host failure must clear the cached promise so Home can retry");
  assert.match(host, /createPlanetHubAppBridge\(/,
    "the host owns the lazy presentation bridge");
  assert.match(host, /function markFallback\(error\)/,
    "the host retains an explicit poster fallback independent of declaration order");
  assert.match(host, /expeditionView\(profile[.]expedition[\s\S]*selectableHomeWorldIds/);
  assert.match(app, /function syncHomePlanetHub\(\)[\s\S]*bridge[?][.]sync[?][.]\(\)/);
  assert.match(app, /restoreMoonHomeRocketAfterHandoffResult\(result\)/,
    "resolved false/opened:false Journey handoffs must restore the docked rocket");
});

test("the lazy Home host commits Earth only after a completed reverse landing", async () => {
  const stage = new FakeNode();
  const home = new FakeNode();
  const poster = new FakeNode();
  const startScreen = new FakeNode();
  const rocket = new FakeNode();
  rocket.focus = (options) => { rocket.focusOptions = options; };
  const calls = [];
  class FakeMutationObserver { observe() {} disconnect() {} }
  const nodes = new Map([
    ["homePlaySplit", home],
    ["startScreen", startScreen],
    ["moonHomeRocket", rocket]
  ]);
  const documentRef = {
    hidden: false,
    body: new FakeNode(),
    documentElement: new FakeNode(),
    defaultView: {
      MutationObserver: FakeMutationObserver,
      requestAnimationFrame: (callback) => { callback(); return 1; },
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
    },
    querySelector(selector) {
      if (selector === "[data-planet-hub]") return stage;
      if (selector === "[data-planet-hub-poster]") return poster;
      return null;
    },
    getElementById(id) { return nodes.get(id) || null; }
  };
  const worldweaving = createWorldweavingState();
  let expedition = recordExpeditionArrival(createExpeditionState(), "moon", { worldweaving });
  const fakeHub = {
    sync(value) { calls.push(["sync", value.worldId]); },
    prepare() { return Promise.resolve(); },
    suspend() {},
    resume() {},
    setReducedMotion() {},
    playJourneyReturn(options) { calls.push(["return", options, expedition.homeWorldId]); return Promise.resolve(true); },
    destroy() {}
  };
  const host = createPlanetHubHost({
    documentRef,
    getProfile: () => ({ expedition, worldweaving }),
    getJourney: () => ({ actionKind: "continue" }),
    getOrbitController: () => ({ snapshot: () => ({ activeScene: "journey", availableScenes: ["forge", "journey", "arena"] }) }),
    getRevealState: () => "revealed",
    getEffectsLevel: () => "full",
    selectHomeWorld: (worldId) => {
      expedition = selectExpeditionHomeWorld(expedition, worldId, { worldweaving });
      calls.push(["select-world", worldId, expedition.activeWorldId]);
      return expedition;
    },
    showHome: (destination) => calls.push(["show-home", destination]),
    afterWorldChange: () => calls.push(["render-world"]),
    getStartScreen: () => startScreen,
    track: (name, payload) => calls.push(["track", name, payload]),
    runtimeImporter: async () => ({ createPlanetHub: () => fakeHub })
  });

  await host.ensure();
  assert.equal(expedition.homeWorldId, "moon");
  await host.returnJourneyHome({ fromWorld: "moon", toWorld: "earth", destination: "journey" });
  assert.deepEqual(calls.find((call) => call[0] === "return"), [
    "return",
    { fromWorld: "moon", toWorld: "earth" },
    "moon"
  ]);
  assert.equal(expedition.activeWorldId, "moon", "confirmed arrival never rolls back");
  assert.equal(expedition.homeWorldId, "earth", "Home presentation changes only after touchdown");
  assert.ok(calls.findIndex((call) => call[0] === "return") < calls.findIndex((call) => call[0] === "select-world"));
  assert.deepEqual(rocket.focusOptions, { preventScroll: true });
  assert.equal(startScreen.inert, false);
});

test("reduced-motion Home return uses the real black fade without starting a spatial flight", async () => {
  const stage = new FakeNode();
  const home = new FakeNode();
  const poster = new FakeNode();
  const startScreen = new FakeNode();
  const rocket = new FakeNode();
  rocket.focus = (options) => { rocket.focusOptions = options; };
  const calls = [];
  class FakeMutationObserver { observe() {} disconnect() {} }
  const nodes = new Map([
    ["homePlaySplit", home],
    ["startScreen", startScreen],
    ["moonHomeRocket", rocket]
  ]);
  const documentRef = {
    hidden: false,
    body: new FakeNode(),
    documentElement: new FakeNode(),
    defaultView: {
      MutationObserver: FakeMutationObserver,
      requestAnimationFrame: (callback) => { callback(); return 1; },
      matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} })
    },
    querySelector(selector) {
      if (selector === "[data-planet-hub]") return stage;
      if (selector === "[data-planet-hub-poster]") return poster;
      return null;
    },
    getElementById(id) { return nodes.get(id) || null; }
  };
  const worldweaving = createWorldweavingState();
  let expedition = recordExpeditionArrival(createExpeditionState(), "moon", { worldweaving });
  const fakeHub = {
    sync(value) { calls.push(["sync", value.worldId]); },
    prepare() { return Promise.resolve(); },
    suspend() {},
    resume() {},
    setReducedMotion() {},
    playJourneyReturn() { calls.push(["spatial-return"]); return Promise.resolve(true); },
    destroy() {}
  };
  const host = createPlanetHubHost({
    documentRef,
    getProfile: () => ({ expedition, worldweaving }),
    getJourney: () => ({ actionKind: "continue" }),
    getOrbitController: () => ({ snapshot: () => ({ activeScene: "journey", availableScenes: ["forge", "journey", "arena"] }) }),
    getRevealState: () => "revealed",
    getEffectsLevel: () => "full",
    selectHomeWorld: (worldId) => {
      expedition = selectExpeditionHomeWorld(expedition, worldId, { worldweaving });
      calls.push(["select-world", worldId]);
      return expedition;
    },
    showHome: (destination) => calls.push(["show-home", destination]),
    afterWorldChange: () => calls.push(["render-world"]),
    getStartScreen: () => startScreen,
    track: (name, payload) => calls.push(["track", name, payload]),
    runtimeImporter: async () => ({ createPlanetHub: () => fakeHub }),
    projectLaunchImporter: async () => ({
      createMoonProjectLaunch: () => ({
        play: async ({ label, open }) => {
          calls.push(["black-fade", label]);
          await open();
          return { opened: true };
        }
      })
    })
  });

  await host.ensure();
  assert.equal(await host.returnJourneyHome(), true);
  assert.equal(calls.some((call) => call[0] === "spatial-return"), false);
  assert.deepEqual(calls.find((call) => call[0] === "black-fade"), ["black-fade", "Earth Home"]);
  assert.equal(expedition.activeWorldId, "moon");
  assert.equal(expedition.homeWorldId, "earth");
  assert.deepEqual(calls.find((call) => call[0] === "track"), [
    "track",
    "moon_return_home_completed",
    { kind: "black-fade", phase: "moon-to-earth" }
  ]);
});

test("an interrupted reverse flight restores Moon without black-fading or persisting Earth", async () => {
  const stage = new FakeNode();
  const home = new FakeNode();
  const poster = new FakeNode();
  const startScreen = new FakeNode();
  const rocket = new FakeNode();
  rocket.focus = (options) => { rocket.focusOptions = options; };
  const calls = [];
  class FakeMutationObserver { observe() {} disconnect() {} }
  const nodes = new Map([
    ["homePlaySplit", home],
    ["startScreen", startScreen],
    ["moonHomeRocket", rocket]
  ]);
  const documentRef = {
    hidden: false,
    body: new FakeNode(),
    documentElement: new FakeNode(),
    defaultView: {
      MutationObserver: FakeMutationObserver,
      requestAnimationFrame: (callback) => { callback(); return 1; },
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
    },
    querySelector(selector) {
      if (selector === "[data-planet-hub]") return stage;
      if (selector === "[data-planet-hub-poster]") return poster;
      return null;
    },
    getElementById(id) { return nodes.get(id) || null; }
  };
  const worldweaving = createWorldweavingState();
  let expedition = recordExpeditionArrival(createExpeditionState(), "moon", { worldweaving });
  const fakeHub = {
    sync(value) { calls.push(["sync", value.worldId]); },
    prepare() { return Promise.resolve(); },
    suspend() {},
    resume() {},
    setReducedMotion() {},
    playJourneyReturn() {
      return Promise.resolve({ status: "interrupted", completed: false, reason: "document-hidden" });
    },
    destroy() {}
  };
  const host = createPlanetHubHost({
    documentRef,
    getProfile: () => ({ expedition, worldweaving }),
    getJourney: () => ({ actionKind: "continue" }),
    getOrbitController: () => ({ snapshot: () => ({ activeScene: "journey", availableScenes: ["forge", "journey", "arena"] }) }),
    getRevealState: () => "revealed",
    getEffectsLevel: () => "full",
    selectHomeWorld: (worldId) => {
      calls.push(["select-world", worldId]);
      expedition = selectExpeditionHomeWorld(expedition, worldId, { worldweaving });
      return expedition;
    },
    showHome: (destination) => calls.push(["show-home", destination]),
    afterWorldChange: () => calls.push(["render-world"]),
    getStartScreen: () => startScreen,
    track: (name, payload) => calls.push(["track", name, payload]),
    runtimeImporter: async () => ({ createPlanetHub: () => fakeHub })
  });

  await host.ensure();
  assert.equal(await host.returnJourneyHome(), false);
  assert.equal(expedition.homeWorldId, "moon");
  assert.equal(calls.some((call) => call[0] === "select-world"), false,
    "interruption cannot invoke either scene arrival or black-fade arrival");
  assert.ok(calls.some((call) => call[0] === "sync" && call[1] === "moon"),
    "the authoritative Moon snapshot is restored after cancellation");
  assert.deepEqual(calls.find((call) => call[0] === "track"), [
    "track",
    "moon_return_home_interrupted",
    { kind: "planet-hub", phase: "moon-to-earth", reason: "document-hidden" }
  ]);
  assert.deepEqual(rocket.focusOptions, { preventScroll: true });
});

test("the app bridge forwards live reduced-motion changes and exposes failed-handoff restoration", async () => {
  const stage = new FakeNode();
  const home = new FakeNode();
  const poster = new FakeNode();
  const startScreen = new FakeNode();
  const motionValues = [];
  let restoreCalls = 0;
  const returnCalls = [];
  let returnOutcome = true;
  const syncSnapshots = [];
  let runtimeOptions = null;
  let motionListener = null;
  const motionQuery = {
    matches: false,
    addEventListener(type, listener) { if (type === "change") motionListener = listener; },
    removeEventListener(type, listener) { if (type === "change" && motionListener === listener) motionListener = null; }
  };
  class FakeMutationObserver {
    observe() {}
    disconnect() {}
  }
  const fakeHub = {
    sync(value) { syncSnapshots.push(value); },
    prepare() { return Promise.resolve(); },
    suspend() {},
    resume() {},
    setReducedMotion(value) { motionValues.push(value); },
    playJourneyReturn(options) { returnCalls.push(options); return Promise.resolve(returnOutcome); },
    restoreJourneyAfterHandoff() { restoreCalls += 1; return "restored"; },
    destroy() {}
  };
  const documentRef = {
    hidden: false,
    body: new FakeNode(),
    documentElement: new FakeNode(),
    defaultView: {
      MutationObserver: FakeMutationObserver,
      matchMedia: () => motionQuery
    },
    querySelector(selector) {
      if (selector === "[data-planet-hub]") return stage;
      if (selector === "[data-planet-hub-poster]") return poster;
      return null;
    },
    getElementById(id) {
      if (id === "homePlaySplit") return home;
      if (id === "startScreen") return startScreen;
      return null;
    }
  };
  const bridge = createPlanetHubAppBridge({
    documentRef,
    getSnapshot: () => ({
      worldId: "earth",
      activeDestination: "journey",
      availableDestinations: ["forge", "journey", "arena"],
      selectableHomeWorldIds: ["earth", "moon"],
      moonHomeWorldAccess: { unlocked: true, milestoneId: "power", completedAt: "2026-08-04T00:00:00.000Z" }
    }),
    onWorldSelect: (worldId) => worldId === "moon",
    runtimeImporter: async () => ({ createPlanetHub: (options) => { runtimeOptions = options; return fakeHub; } })
  });

  await bridge.ensure();
  assert.equal(runtimeOptions.onWorldSelect("moon"), true);
  assert.deepEqual(syncSnapshots[0].selectableHomeWorldIds, ["earth", "moon"]);
  assert.deepEqual(syncSnapshots[0].moonHomeWorldAccess, {
    worldId: "moon",
    unlocked: true,
    milestoneId: "power",
    completedAt: "2026-08-04T00:00:00.000Z"
  });
  assert.deepEqual(motionValues, [false]);
  motionListener?.({ matches: true });
  assert.deepEqual(motionValues, [false, true]);
  assert.equal(bridge.restoreJourneyAfterHandoffResult({ opened: true }), false);
  assert.equal(restoreCalls, 0);
  assert.equal(bridge.restoreJourneyAfterHandoffResult(false), "restored");
  assert.equal(bridge.restoreJourneyAfterHandoffResult({ opened: false }), "restored");
  assert.equal(restoreCalls, 2, "both supported resolved-failure shapes restore the docked rocket");
  assert.equal(bridge.restoreJourneyAfterHandoff(), "restored");
  const reverseOptions = { fromWorld: "moon", toWorld: "earth" };
  assert.equal(await bridge.playJourneyReturn(reverseOptions), true);
  returnOutcome = { status: "interrupted", completed: false, reason: "document-hidden" };
  assert.deepEqual(await bridge.playJourneyReturn(reverseOptions), returnOutcome,
    "the bridge must not flatten interruption into fallback-eligible false");
  assert.deepEqual(returnCalls, [reverseOptions, reverseOptions]);
  bridge.destroy();
  assert.equal(motionListener, null);
});

test("activity observation only suspends or resumes the hub when activity state changes", async () => {
  const stage = new FakeNode();
  const home = new FakeNode();
  const poster = new FakeNode();
  const startScreen = new FakeNode();
  const activityCalls = [];
  let observerCallback = null;
  class FakeMutationObserver {
    constructor(callback) { observerCallback = callback; }
    observe() {}
    disconnect() {}
  }
  const fakeHub = {
    sync() {},
    prepare() { return Promise.resolve(); },
    suspend(reason) { activityCalls.push(["suspend", reason]); },
    resume(reason) { activityCalls.push(["resume", reason]); },
    setReducedMotion() {},
    destroy() {}
  };
  const documentRef = {
    hidden: false,
    body: new FakeNode(),
    documentElement: new FakeNode(),
    defaultView: {
      MutationObserver: FakeMutationObserver,
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
    },
    querySelector(selector) {
      if (selector === "[data-planet-hub]") return stage;
      if (selector === "[data-planet-hub-poster]") return poster;
      return null;
    },
    getElementById(id) {
      if (id === "homePlaySplit") return home;
      if (id === "startScreen") return startScreen;
      return null;
    }
  };
  const bridge = createPlanetHubAppBridge({
    documentRef,
    getSnapshot: () => ({
      worldId: "earth",
      activeDestination: "forge",
      availableDestinations: ["forge", "journey", "arena"]
    }),
    runtimeImporter: async () => ({ createPlanetHub: () => fakeHub })
  });

  await bridge.ensure();
  assert.deepEqual(activityCalls, [
    ["resume", "home-hidden"],
    ["resume", "secondary-surface"]
  ]);

  observerCallback?.([{ type: "childList", addedNodes: [new FakeNode()] }]);
  observerCallback?.([{ type: "childList", addedNodes: [new FakeNode()] }]);
  assert.equal(activityCalls.length, 2,
    "hub-published childList mutations cannot recursively resume the unchanged activity channels");

  startScreen.hidden = true;
  observerCallback?.([{ type: "attributes", attributeName: "hidden", target: startScreen }]);
  assert.deepEqual(activityCalls.at(-1), ["suspend", "home-hidden"]);
  observerCallback?.([{ type: "childList", addedNodes: [new FakeNode()] }]);
  assert.equal(activityCalls.length, 3);

  home.dataset.homeSurface = "forge-catalog";
  observerCallback?.([{ type: "attributes", attributeName: "data-home-surface", target: home }]);
  assert.deepEqual(activityCalls.at(-1), ["suspend", "secondary-surface"]);

  startScreen.hidden = false;
  home.dataset.homeSurface = "none";
  observerCallback?.([{ type: "childList", addedNodes: [] }]);
  assert.deepEqual(activityCalls.slice(-2), [
    ["resume", "home-hidden"],
    ["resume", "secondary-surface"]
  ]);
});

test("destroying the app bridge invalidates a deferred runtime import before it can create a late hub", async () => {
  const stage = new FakeNode();
  const home = new FakeNode();
  const poster = new FakeNode();
  let releaseImport;
  let created = 0;
  const deferredImport = new Promise((resolve) => { releaseImport = resolve; });
  const documentRef = {
    querySelector(selector) {
      if (selector === "[data-planet-hub]") return stage;
      if (selector === "[data-planet-hub-poster]") return poster;
      return null;
    },
    getElementById(id) { return id === "homePlaySplit" ? home : null; }
  };
  const bridge = createPlanetHubAppBridge({
    documentRef,
    getSnapshot: () => ({ worldId: "earth", activeDestination: "forge", availableDestinations: ["forge"] }),
    runtimeImporter: () => deferredImport
  });

  const pending = bridge.ensure();
  bridge.destroy();
  releaseImport({
    createPlanetHub() {
      created += 1;
      return { sync() {}, prepare() {}, destroy() {} };
    }
  });
  assert.equal(await pending, null);
  assert.equal(created, 0, "a destroyed bridge cannot construct or observe a late renderer runtime");
  assert.equal(await bridge.ensure(), null);
});
