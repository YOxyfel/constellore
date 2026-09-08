/* Presentation-only bridge between the authoritative Home controller and the
 * lazy Living Planet renderer. Keeping this module out of app.js ensures the
 * optional hub does not increase the core gameplay bundle.
 */

export const PLANET_HUB_CINEMATIC_STYLESHEET = "planet-hub-cinematic.css?v=5.0.0-beta.4";
const cinematicStylesheetPromises = new WeakMap();

export function loadPlanetHubCinematicStylesheet(documentRef = globalThis.document) {
  if (!documentRef?.head || typeof documentRef.createElement !== "function") return Promise.resolve(null);
  const cached = cinematicStylesheetPromises.get(documentRef);
  if (cached) return cached;
  const href = new URL(`./${PLANET_HUB_CINEMATIC_STYLESHEET}`, import.meta.url);
  const version = new URL(import.meta.url).searchParams.get("v");
  if (version) href.searchParams.set("v", version);
  const expectedHref = href.href;
  const links = [...(documentRef.querySelectorAll?.('link[rel="stylesheet"]') || [])];
  let link = links.find((candidate) => candidate.href === expectedHref);
  const promise = new Promise((resolve, reject) => {
    if (link?.sheet) {
      resolve(link);
      return;
    }
    if (!link) {
      link = documentRef.createElement("link");
      link.rel = "stylesheet";
      link.href = expectedHref;
      link.dataset.planetHubCinematic = "true";
      documentRef.head.append(link);
    }
    if (typeof link.addEventListener !== "function") {
      resolve(link);
      return;
    }
    link.addEventListener("load", () => resolve(link), { once: true });
    link.addEventListener("error", () => {
      cinematicStylesheetPromises.delete(documentRef);
      link.remove?.();
      reject(new Error("Planet Hub cinematic styles could not be loaded."));
    }, { once: true });
  });
  cinematicStylesheetPromises.set(documentRef, promise);
  return promise;
}

function normalizedSnapshot(getSnapshot) {
  const value = getSnapshot?.() || {};
  const activeDestination = ["forge", "journey", "arena"].includes(value.activeDestination)
    ? value.activeDestination
    : "forge";
  const effectsLevel = ["full", "reduced", "off"].includes(value.effectsLevel)
    ? value.effectsLevel
    : "full";
  const selectableHomeWorldIds = Array.isArray(value.selectableHomeWorldIds)
    && value.selectableHomeWorldIds.includes("moon")
    ? ["earth", "moon"]
    : ["earth"];
  return {
    ...value,
    worldId: value.worldId === "moon" ? "moon" : "earth",
    activeDestination,
    effectsLevel,
    selectableHomeWorldIds,
    moonHomeWorldAccess: {
      worldId: "moon",
      unlocked: selectableHomeWorldIds.includes("moon") && value.moonHomeWorldAccess?.unlocked !== false,
      milestoneId: String(value.moonHomeWorldAccess?.milestoneId || "power"),
      completedAt: String(value.moonHomeWorldAccess?.completedAt || "")
    },
    availableDestinations: Array.isArray(value.availableDestinations) && value.availableDestinations.length
      ? value.availableDestinations
      : ["forge"]
  };
}

export function createPlanetHubAppBridge({
  documentRef = globalThis.document,
  getSnapshot,
  getOrbitController,
  onWorldSelect,
  audioDirector = null,
  stylesheetLoader = () => loadPlanetHubCinematicStylesheet(documentRef),
  runtimeImporter = () => import("./planet-hub-runtime.mjs?v=5.0.0-beta.4")
} = {}) {
  let hub = null;
  let hubPromise = null;
  let activityObserver = null;
  let reducedMotionQuery = null;
  let reducedMotionListener = null;
  let destroyed = false;
  let generation = 0;
  let activityState = {
    homeHidden: null,
    surfaceOpen: null
  };

  const byId = (id) => documentRef?.getElementById?.(id) || null;
  const root = () => documentRef?.querySelector?.("[data-planet-hub]") || null;
  const orbitRoot = () => byId("homePlaySplit");

  function syncPoster(snapshot = normalizedSnapshot(getSnapshot)) {
    const poster = documentRef?.querySelector?.("[data-planet-hub-poster]");
    if (!poster) return;
    const relativeSource = `./art/planet-hub/posters/${snapshot.worldId}-${snapshot.activeDestination}.webp`;
    if (!poster.getAttribute?.("src")?.endsWith(relativeSource.slice(1))) poster.src = relativeSource;
  }

  function syncActivity() {
    if (!hub && !audioDirector) return;
    const homeHidden = Boolean(byId("startScreen")?.hidden || documentRef?.hidden);
    const surfaceOpen = orbitRoot()?.dataset.homeSurface === "forge-catalog"
      || Boolean(documentRef?.querySelector?.("dialog[open]"));
    if (activityState.homeHidden !== homeHidden) {
      activityState.homeHidden = homeHidden;
      if (homeHidden) {
        hub?.suspend?.("home-hidden");
        audioDirector?.suspend?.("home-hidden");
      } else {
        hub?.resume?.("home-hidden");
        audioDirector?.resume?.("home-hidden");
      }
    }
    if (activityState.surfaceOpen !== surfaceOpen) {
      activityState.surfaceOpen = surfaceOpen;
      if (surfaceOpen) {
        hub?.suspend?.("secondary-surface");
        audioDirector?.suspend?.("secondary-surface");
      } else {
        hub?.resume?.("secondary-surface");
        audioDirector?.resume?.("secondary-surface");
      }
    }
  }

  function observeActivity() {
    const MutationObserverCtor = documentRef?.defaultView?.MutationObserver || globalThis.MutationObserver;
    if (activityObserver || typeof MutationObserverCtor !== "function") return;
    activityObserver = new MutationObserverCtor((records = []) => {
      syncActivity();
      if (records.some((record) => record.attributeName === "data-cosmetic-effects")) sync();
    });
    const startScreen = byId("startScreen");
    if (startScreen) activityObserver.observe(startScreen, { attributes: true, attributeFilter: ["hidden"] });
    const home = orbitRoot();
    if (home) activityObserver.observe(home, { attributes: true, attributeFilter: ["data-home-surface"] });
    if (documentRef?.body) activityObserver.observe(documentRef.body, {
      attributes: true,
      attributeFilter: ["data-cosmetic-effects"]
    });
    const activityRoot = documentRef?.documentElement || documentRef?.body;
    if (activityRoot) activityObserver.observe(activityRoot, {
      attributes: true,
      attributeFilter: ["open"],
      childList: true,
      subtree: true
    });
    if (!reducedMotionQuery && typeof documentRef?.defaultView?.matchMedia === "function") {
      reducedMotionQuery = documentRef.defaultView.matchMedia("(prefers-reduced-motion: reduce)");
      reducedMotionListener = (event) => {
        hub?.setReducedMotion?.(Boolean(event.matches));
        audioDirector?.setReducedMotion?.(Boolean(event.matches));
      };
      if (typeof reducedMotionQuery.addEventListener === "function") {
        reducedMotionQuery.addEventListener("change", reducedMotionListener);
      } else reducedMotionQuery.addListener?.(reducedMotionListener);
      hub?.setReducedMotion?.(Boolean(reducedMotionQuery.matches));
      audioDirector?.setReducedMotion?.(Boolean(reducedMotionQuery.matches));
    }
  }

  async function ensure() {
    if (destroyed) return null;
    if (hub) return hub;
    if (hubPromise) return hubPromise;
    const stage = root();
    const home = orbitRoot();
    if (!stage || !home) return null;
    const initial = normalizedSnapshot(getSnapshot);
    const expectedGeneration = ++generation;
    syncPoster(initial);
    // The semantic soundscape is independent from WebGL. Start its lifecycle
    // observation before the optional renderer import so poster fallback still
    // honors Home visibility, dialogs, and reduced-motion preference changes.
    audioDirector?.sync?.(initial);
    observeActivity();
    syncActivity();
    // Fetch/parse the optional visual layer and the runtime together.  Both
    // still settle before Home can reveal its live renderer, but serializing
    // them needlessly left the cached Three/runtime graph idle behind CSS I/O
    // on every load.
    hubPromise = Promise.all([
      Promise.resolve().then(() => stylesheetLoader?.()),
      Promise.resolve().then(() => runtimeImporter())
    ])
      .then(([, { createPlanetHub }]) => {
        if (destroyed || expectedGeneration !== generation) return null;
        const candidate = createPlanetHub({
          root: stage,
          orbitRoot: home,
          orbitController: getOrbitController?.(),
          onWorldSelect,
          onSemanticEvent: (event) => audioDirector?.cue?.(event?.cue, event)
        });
        if (!candidate) throw new Error("Planet Hub could not be initialized.");
        if (destroyed || expectedGeneration !== generation) {
          candidate.destroy?.();
          return null;
        }
        hub = candidate;
        hub.setReducedMotion?.(Boolean(reducedMotionQuery?.matches));
        // Activity belongs to the renderer instance. The first synchronization
        // must reach a freshly created hub even when it happens to inherit the
        // same visible/hidden state as the previous instance.
        activityState = { homeHidden: null, surfaceOpen: null };
        hub.sync(initial);
        audioDirector?.sync?.(initial);
        observeActivity();
        syncActivity();
        void hub.prepare({ worldId: initial.worldId, deadlineMs: 900 });
        return hub;
      })
      .catch((error) => {
        if (destroyed || expectedGeneration !== generation) return null;
        hubPromise = null;
        for (const host of [stage, home]) {
          host.dataset.homeHubRenderer = "fallback";
          host.dataset.homeHubPhase = "fallback";
          host.dataset.homeHubQuality = "static";
          host.dataset.homeHubSpace = "static";
          host.dataset.homeWorld = initial.worldId;
          host.dataset.homeHubDestination = initial.activeDestination;
        }
        stage.dataset.homeHubError = error?.name || "Error";
        stage.dataset.homeHubErrorMessage = String(error?.message || "Planet Hub initialization failed.");
        return null;
      });
    return hubPromise;
  }

  function sync() {
    const snapshot = normalizedSnapshot(getSnapshot);
    syncPoster(snapshot);
    audioDirector?.sync?.(snapshot);
    if (hub) {
      hub.sync(snapshot);
      syncActivity();
      return snapshot;
    }
    void ensure().then((value) => value?.sync(snapshot));
    return snapshot;
  }

  function playRocketIgnition() {
    if (hub) return hub.playRocketIgnition();
    void ensure().then((value) => value?.playRocketIgnition());
    return false;
  }

  async function stageJourneyActivation(options = {}) {
    const value = hub || await ensure();
    // Static/poster fallback has no spatial focus or in-hub flight to wait for;
    // preserve the existing semantic Journey action in that case.
    if (!value?.stageJourneyActivation) return true;
    return value.stageJourneyActivation(options);
  }

  async function playJourneyReturn(options = {}) {
    const value = hub || await ensure();
    if (!value?.playJourneyReturn) return false;
    try {
      const outcome = await value.playJourneyReturn(options);
      // Preserve interruption as a third outcome. Flattening it to `false`
      // would make the host mistake a backgrounded/cancelled flight for a
      // renderer failure and incorrectly black-fade + persist Earth.
      if (outcome?.status === "interrupted") return outcome;
      return outcome === true;
    } catch {
      return false;
    }
  }

  function restoreJourneyAfterHandoff() {
    return hub?.restoreJourneyAfterHandoff?.() || false;
  }

  function restoreJourneyAfterHandoffResult(result) {
    if (result !== false && result?.opened !== false) return false;
    return restoreJourneyAfterHandoff();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    generation += 1;
    activityObserver?.disconnect?.();
    activityObserver = null;
    if (typeof reducedMotionQuery?.removeEventListener === "function") {
      reducedMotionQuery.removeEventListener("change", reducedMotionListener);
    } else reducedMotionQuery?.removeListener?.(reducedMotionListener);
    reducedMotionQuery = null;
    reducedMotionListener = null;
    hub?.destroy?.();
    audioDirector?.destroy?.();
    hub = null;
    hubPromise = null;
    activityState = { homeHidden: null, surfaceOpen: null };
  }

  return Object.freeze({
    ensure,
    sync,
    syncActivity,
    playRocketIgnition,
    stageJourneyActivation,
    playJourneyReturn,
    restoreJourneyAfterHandoff,
    restoreJourneyAfterHandoffResult,
    destroy
  });
}
