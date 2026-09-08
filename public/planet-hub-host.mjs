import { expeditionView } from "./expedition.mjs?v=5.0.0-beta.4";
import { createPlanetHubAppBridge } from "./planet-hub-app.mjs?v=5.0.0-beta.4";

function createLazyAudioDirector({ documentRef, audioRuntime, importer }) {
  if (!audioRuntime?.createAuxiliaryChannel || typeof importer !== "function") return null;
  let director = null;
  let loading = null;
  let destroyed = false;

  const load = () => {
    if (destroyed) return Promise.resolve(null);
    if (director) return Promise.resolve(director);
    if (loading) return loading;
    loading = Promise.resolve()
      .then(() => importer())
      .then((module) => {
        if (destroyed || typeof module?.createPlanetHubAudioDirector !== "function") return null;
        director = module.createPlanetHubAudioDirector({ documentRef, audioRuntime });
        return director;
      })
      .catch(() => {
        loading = null;
        return null;
      });
    return loading;
  };
  const proxy = {};
  for (const method of ["sync", "cue", "suspend", "resume", "setReducedMotion"]) {
    proxy[method] = (...args) => {
      if (destroyed) return false;
      void load().then((value) => value?.[method]?.(...args));
      return true;
    };
  }
  proxy.destroy = () => {
    if (destroyed) return false;
    destroyed = true;
    director?.destroy?.();
    director = null;
    return true;
  };
  return Object.freeze(proxy);
}

/*
 * App-facing coordinator for the optional Living Planet Home. Keeping travel
 * handoffs here makes the 3D journey lazy without moving any profile authority
 * into the renderer.
 */
export function createPlanetHubHost({
  documentRef = globalThis.document,
  getProfile,
  getJourney,
  getOrbitController,
  getRevealState,
  getEffectsLevel,
  selectHomeWorld,
  showHome,
  afterWorldChange,
  getStartScreen,
  audioRuntime,
  track,
  runtimeImporter,
  audioImporter = () => import("./planet-hub-audio.mjs?v=5.0.0-beta.4"),
  projectLaunchImporter = () => import("./moon-project-launch.mjs?v=5.0.0-beta.4")
} = {}) {
  let destroyed = false;
  const audioDirector = createLazyAudioDirector({ documentRef, audioRuntime, importer: audioImporter });

  function snapshot() {
    const profile = getProfile?.() || {};
    const orbit = getOrbitController?.()?.snapshot?.() || {};
    const journey = getJourney?.();
    const expedition = expeditionView(profile.expedition, { worldweaving: profile.worldweaving });
    return {
      worldId: expedition.homeWorldId,
      activeDestination: orbit.activeScene || "forge",
      availableDestinations: orbit.availableScenes || ["forge"],
      selectableHomeWorldIds: expedition.selectableHomeWorldIds,
      moonHomeWorldAccess: expedition.moonHomeWorldAccess,
      journeyAction: journey?.actionKind || journey?.kind || journey?.action || "launch",
      revealState: getRevealState?.() || "tutorial",
      effectsLevel: getEffectsLevel?.() || "full"
    };
  }

  function markFallback(error) {
    const { worldId, activeDestination: destination } = snapshot();
    const poster = documentRef?.querySelector?.("[data-planet-hub-poster]");
    const source = `./art/planet-hub/posters/${worldId}-${destination}.webp`;
    if (poster && !poster.getAttribute?.("src")?.endsWith(source.slice(1))) poster.setAttribute?.("src", source);
    for (const host of [documentRef?.querySelector?.("[data-planet-hub]"), documentRef?.getElementById?.("homePlaySplit")]) {
      if (!host?.dataset) continue;
      Object.assign(host.dataset, {
        homeHubRenderer: "fallback",
        homeHubPhase: "fallback",
        homeHubQuality: "static",
        homeHubSpace: "static",
        homeWorld: worldId,
        homeHubDestination: destination
      });
    }
    const stage = documentRef?.querySelector?.("[data-planet-hub]");
    if (stage?.dataset) stage.dataset.homeHubError = error?.name || "Error";
  }

  function commitWorldSelection(worldId, { sync = true } = {}) {
    const selected = selectHomeWorld?.(worldId);
    const accepted = selected?.homeWorldId === worldId;
    if (!accepted) return false;
    afterWorldChange?.();
    if (sync) Promise.resolve().then(() => bridge.sync());
    return true;
  }

  const bridge = createPlanetHubAppBridge({
    documentRef,
    getSnapshot: snapshot,
    getOrbitController,
    onWorldSelect: (worldId) => commitWorldSelection(worldId),
    audioDirector,
    runtimeImporter
  });

  const nextHomePaint = () => new Promise((resolve) => {
    const frame = documentRef?.defaultView?.requestAnimationFrame || globalThis.requestAnimationFrame;
    if (typeof frame !== "function") return resolve();
    frame(() => frame(resolve));
  });

  function focusJourneyHome() {
    if (documentRef?.hidden || getStartScreen?.()?.hidden) return false;
    const rocket = documentRef?.getElementById?.("moonHomeRocket");
    const target = !rocket?.hidden && !rocket?.disabled
      ? rocket
      : documentRef?.getElementById?.("homeOrbitTabJourney");
    target?.focus?.({ preventScroll: true });
    return Boolean(target);
  }

  async function returnJourneyHome({
    fromWorld = "moon",
    toWorld = "earth",
    destination = "journey"
  } = {}) {
    if (destroyed) return false;
    const startScreen = getStartScreen?.();
    const home = documentRef?.getElementById?.("homePlaySplit");
    const wasInert = Boolean(startScreen?.inert);
    const hadInert = startScreen?.hasAttribute?.("inert") === true;
    const previousInert = startScreen?.getAttribute?.("inert");
    showHome?.(destination);
    if (startScreen) {
      startScreen.inert = true;
      startScreen.setAttribute?.("inert", "");
      startScreen.setAttribute?.("aria-busy", "true");
    }
    if (home?.dataset) home.dataset.homeJourneyReturn = "active";

    const arrive = () => {
      commitWorldSelection(toWorld, { sync: false });
      bridge.sync();
      return true;
    };

    let returnedInScene = false;
    let interrupted = null;
    try {
      await nextHomePaint();
      const prefersReducedMotion = documentRef?.defaultView
        ?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
      // The spatial renderer's accessibility result is intentionally not a
      // compressed flight. Route reduced-motion returns directly through the
      // real black-fade surface so the world change remains visible and calm.
      const outcome = prefersReducedMotion
        ? false
        : await bridge.playJourneyReturn?.({ fromWorld, toWorld });
      returnedInScene = outcome === true;
      interrupted = outcome?.status === "interrupted" ? outcome : null;
      if (interrupted) {
        // The profile still owns Moon. Resyncing after the runtime has released
        // its staged-return guard restores the Moon presentation without
        // recording Earth or invoking the black-fade fallback.
        bridge.sync();
        track?.("moon_return_home_interrupted", {
          kind: "planet-hub",
          phase: `${fromWorld}-to-${toWorld}`,
          reason: interrupted.reason || "interrupted"
        });
        return false;
      }
      if (returnedInScene) arrive();
      else {
        try {
          const { createMoonProjectLaunch } = await projectLaunchImporter();
          const fallback = createMoonProjectLaunch({
            documentRef,
            reducedMotion: () => documentRef?.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true
          });
          await fallback.play({ label: "Earth Home", open: async () => arrive() });
        } catch {
          arrive();
        }
      }
      track?.("moon_return_home_completed", {
        kind: returnedInScene ? "planet-hub" : "black-fade",
        phase: `${fromWorld}-to-${toWorld}`
      });
      return true;
    } finally {
      if (startScreen) {
        startScreen.inert = wasInert;
        if (hadInert) startScreen.setAttribute?.("inert", previousInert ?? "");
        else startScreen.removeAttribute?.("inert");
        startScreen.removeAttribute?.("aria-busy");
      }
      if (home?.dataset) delete home.dataset.homeJourneyReturn;
      (documentRef?.defaultView?.requestAnimationFrame || globalThis.requestAnimationFrame || ((callback) => callback()))(focusJourneyHome);
    }
  }

  return Object.freeze({
    ensure: () => bridge.ensure(),
    sync: () => bridge.sync(),
    syncActivity: () => bridge.syncActivity(),
    playRocketIgnition: () => bridge.playRocketIgnition(),
    stageJourneyActivation: (options) => bridge.stageJourneyActivation(options),
    restoreJourneyAfterHandoff: () => bridge.restoreJourneyAfterHandoff(),
    restoreJourneyAfterHandoffResult: (result) => bridge.restoreJourneyAfterHandoffResult(result),
    returnJourneyHome,
    snapshot,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      bridge.destroy();
    }
  });
}
