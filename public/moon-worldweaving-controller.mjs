import {
  moonOutpostView,
  recordMoonOutpostRoute
} from "./moon-outpost.mjs?v=5.0.0-beta.4";
import {
  claimMoonHeartProjectReward,
  moonHeartProjectView,
  recordMoonHeartProjectRoute
} from "./moon-heart-project.mjs?v=5.0.0-beta.4";
import {
  recordExpeditionArrival,
  replaceMoonOutpostState,
  sanitizeExpeditionState,
  selectExpeditionHomeWorld
} from "./expedition.mjs?v=5.0.0-beta.4";
import {
  moonWorldweavingView,
  recordWorldweavingCompletion,
  sanitizeWorldweavingState,
  worldwordInventoryItem
} from "./worldweaving.mjs?v=5.0.0-beta.4";

const MOON_HOME_ROCKET_ASSET = new URL("./art/moon-outpost/rocket-core-v1.png", import.meta.url).href;
const HOME_JOURNEY_PLANETS = Object.freeze({
  earth: Object.freeze({
    id: "earth",
    label: "Earth",
    platformArt: new URL("./art/birthday-voyage/masters/earth-master.webp", import.meta.url).href,
    destinationArt: new URL("./art/birthday-voyage/thumbs/earth-thumb.webp", import.meta.url).href
  }),
  moon: Object.freeze({
    id: "moon",
    label: "Moon",
    platformArt: new URL("./art/birthday-voyage/masters/moon-master.webp", import.meta.url).href,
    destinationArt: new URL("./art/birthday-voyage/thumbs/moon-thumb.webp", import.meta.url).href
  }),
  mars: Object.freeze({
    id: "mars",
    label: "Mars",
    platformArt: new URL("./art/birthday-voyage/masters/mars-master.webp", import.meta.url).href,
    destinationArt: new URL("./art/birthday-voyage/thumbs/mars-thumb.webp", import.meta.url).href
  })
});
const HOME_PROJECT_ORIGIN = Object.freeze({ kind: "home", destination: "journey" });
const HOME_JOURNEY_ART_IDS = Object.freeze([
  "moonHomePlatformArt",
  "moonHomeDestinationArt",
  "moonHomeRocketArt"
]);
const HOME_JOURNEY_ART_TIMEOUT_MS = 1_800;

export function createMoonWorldweavingController(host) {
  const documentRef = host.documentRef || globalThis.document;
  // Browser animation-frame functions require their Window receiver. Keep the
  // scheduler behind a plain callback so passing it through the lazy Outpost
  // host can never turn it into an illegal method invocation.
  const requestFrame = typeof host.requestFrame === "function"
    ? (callback) => host.requestFrame(callback)
    : typeof globalThis.requestAnimationFrame === "function"
      ? (callback) => globalThis.requestAnimationFrame(callback)
      : (callback) => setTimeout(callback, 0);
  let worldweavingRuntimePromise = null;
  let worldweavingRuntime = null;
  let outpostRuntimePromise = null;
  let outpostRuntime = null;
  let heartRuntimePromise = null;
  let heartRuntime = null;
  let lastHeartOutcome = null;
  let resultPresentation = null;
  let worldweavingActions = null;
  let outpostActions = null;
  let heartActions = null;
  let worldweavingOrigin = "home";
  let outpostOrigin = "home";
  let heartOrigin = "home";
  let homeReturnPromise = null;

  const profile = () => host.getProfile();
  const gameState = () => host.getState();
  const element = (id) => documentRef?.getElementById?.(id) || null;
  const view = () => moonWorldweavingView(profile()?.worldweaving);

  function currentExpedition() {
    const current = profile();
    return sanitizeExpeditionState(current?.expedition, { worldweaving: current?.worldweaving });
  }

  function persistExpedition(next, { progression = false } = {}) {
    const current = profile();
    current.expedition = sanitizeExpeditionState(next, { worldweaving: current.worldweaving });
    host.saveProfile({ fields: [...(progression ? ["progression"] : []), "journeys"] });
    outpostRuntime?.render();
    syncEntryState();
    return current.expedition;
  }

  function normalizeSurfaceOrigin(value, allowed, fallback = "home") {
    let candidate = typeof value === "string" ? value : "";
    if (value && typeof value === "object") {
      if (value.kind === "home") candidate = "home";
      else if (value.kind === "world" && value.worldId === "moon") candidate = value.surface || "outpost";
    }
    candidate = String(candidate || "").trim().toLowerCase();
    return allowed.includes(candidate) ? candidate : fallback;
  }

  function rememberedOrigin(surface, leaving) {
    const remembered = surface === "worldweaving"
      ? worldweavingOrigin
      : surface === "outpost"
        ? outpostOrigin
        : heartOrigin;
    // Never let stale transient state point back at the surface being left.
    return remembered === leaving ? "home" : remembered;
  }

  function recordArrival(worldId, { at = new Date() } = {}) {
    const current = profile();
    const before = currentExpedition();
    const next = recordExpeditionArrival(before, worldId, {
      worldweaving: current.worldweaving,
      at
    });
    if (next.revision === before.revision && next.activeWorldId === before.activeWorldId) return before;
    current.expedition = next;
    host.saveProfile({ fields: ["journeys"] });
    syncEntryState();
    return current.expedition;
  }

  function selectHomeWorld(worldId, { at = new Date() } = {}) {
    const current = profile();
    const before = currentExpedition();
    const next = selectExpeditionHomeWorld(before, worldId, {
      worldweaving: current.worldweaving,
      at
    });
    if (next.revision === before.revision && next.homeWorldId === before.homeWorldId) return before;
    current.expedition = next;
    host.saveProfile({ fields: ["journeys"] });
    syncEntryState();
    return current.expedition;
  }

  function addWorldword(item) {
    if (!item) return false;
    const current = profile();
    current.exploreWords = host.mergeExploreInventory(current.exploreWords, item);
    if (!current.discovered.some((word) => host.inventoryKey(word) === host.inventoryKey(item.word))) {
      current.discovered.push(item.word);
    }
    return true;
  }

  async function beginMission(slotId, choiceId, { trigger = documentRef?.activeElement } = {}) {
    return worldweavingActions?.beginMission(slotId, choiceId, { trigger });
  }

  async function beginWorldwordExplore({ trigger = documentRef?.activeElement } = {}) {
    return worldweavingActions?.beginWorldwordExplore({ trigger });
  }

  function heartDomainOptions(outpost) {
    const shelter = outpost?.structures?.shelter;
    return {
      shelterStage: Math.max(0, Math.floor(Number(shelter?.stage) || 0))
    };
  }

  function heartProjectState(expedition = currentExpedition()) {
    const outpost = expedition.worlds.moon.outpost;
    return moonHeartProjectView(outpost.projects, heartDomainOptions(outpost));
  }

  function synchronizeHeartShelterStage(rawOutpost, { force = false } = {}) {
    const outpost = structuredClone(rawOutpost);
    const shelter = outpost?.structures?.shelter;
    if (!shelter || (shelter.calibratedAt && !force)) return outpost;
    const project = moonHeartProjectView(outpost.projects, heartDomainOptions(outpost));
    shelter.stage = Math.max(shelter.stage, project.projectedShelterStage);
    return outpost;
  }

  function outpostWorldView() {
    return view();
  }

  async function openCache({ tierId } = {}) {
    return outpostActions?.openCache({ tierId });
  }

  async function redeemSelection({ cosmeticId } = {}) {
    return outpostActions?.redeemSelection({ cosmeticId });
  }

  async function structureAction({ action, structureId } = {}) {
    return outpostActions?.structureAction({ action, structureId });
  }

  async function beginHeartMission({ taskId } = {}, trigger = documentRef?.activeElement) {
    return heartActions?.beginMission({ taskId }, trigger);
  }

  function chooseHeartSettlement({ choiceId } = {}) {
    return heartActions?.chooseSettlement({ choiceId });
  }

  async function beginLaunch() {
    return outpostActions?.beginLaunch();
  }

  async function completeLaunch(payload = {}) {
    return outpostActions?.completeLaunch(payload);
  }

  function backFromWorldweaving(navigation, trigger) {
    if (navigation?.origin === "outpost") {
      worldweavingRuntime?.close({ restoreFocus: false });
      requestFrame(() => void openOutpost({
        trigger,
        origin: rememberedOrigin("outpost", "worldweaving")
      }));
      return true;
    }
    return returnToMainMenu(trigger);
  }

  function backFromOutpost(navigation, trigger) {
    if (navigation?.origin === "worldweaving") {
      outpostRuntime?.close({ restoreFocus: false });
      requestFrame(() => void openWorldweaving({
        trigger,
        origin: rememberedOrigin("worldweaving", "outpost")
      }));
      return true;
    }
    if (navigation?.origin === "heart") {
      outpostRuntime?.close({ restoreFocus: false });
      requestFrame(() => void openHeartProject({
        trigger,
        origin: rememberedOrigin("heart", "outpost")
      }));
      return true;
    }
    return returnToMainMenu(trigger);
  }

  function backFromHeart(navigation, trigger) {
    if (navigation?.origin === "outpost") {
      heartRuntime?.close({ restoreFocus: false });
      requestFrame(() => void openOutpost({
        trigger,
        origin: rememberedOrigin("outpost", "heart"),
        focusStructure: "shelter"
      }));
      return true;
    }
    if (navigation?.origin === "worldweaving") {
      heartRuntime?.close({ restoreFocus: false });
      requestFrame(() => void openWorldweaving({
        trigger,
        origin: rememberedOrigin("worldweaving", "heart")
      }));
      return true;
    }
    return returnToMainMenu(trigger);
  }

  function connectLazyModule(module) {
    resultPresentation = module.createMoonResultPresentation || resultPresentation;
    worldweavingActions ||= module.createMoonWorldweavingActions?.({
      profile,
      state: gameState,
      view,
      addWorldword,
      worldweavingRuntime: () => worldweavingRuntime,
      outpostRuntime: () => outpostRuntime,
      showToast: host.showToast,
      track: host.track,
      beginMode: host.beginMode,
      primaryTrigger: host.primaryTrigger,
      saveProfile: host.saveProfile,
      startExplore: host.startExplore
    });
  }

  function ensureWorldweavingRuntime() {
    if (worldweavingRuntime) return Promise.resolve(worldweavingRuntime);
    if (!worldweavingRuntimePromise) {
      worldweavingRuntimePromise = host.loadSecondarySurfaceModule()
        .then((module) => {
          connectLazyModule(module);
          return module.createLazyMoonWorldweaving({
          documentRef,
          getState: () => sanitizeWorldweavingState(profile().worldweaving),
          onStartMission: ({ slotId, choiceId, interpretationId }, trigger) => (
            beginMission(slotId, choiceId || interpretationId, { trigger })
          ),
          onExploreWorldword: (trigger) => beginWorldwordExplore({ trigger }),
          onOpenOutpost: (trigger) => {
            worldweavingRuntime?.close({ restoreFocus: false });
            requestFrame(() => void openOutpost({
              trigger,
              origin: worldweavingOrigin === "outpost"
                ? rememberedOrigin("outpost", "worldweaving")
                : "worldweaving"
            }));
            return true;
          },
          onBack: (navigation, trigger) => backFromWorldweaving(navigation, trigger),
          onMainMenu: (trigger) => returnToMainMenu(trigger),
          onClose: () => host.resumeTimerIfNeeded(),
            track: host.track
          });
        })
        .then((created) => {
          if (!created || typeof created.open !== "function" || typeof created.render !== "function") {
            throw new Error("Moon Worldweaving could not be initialized.");
          }
          worldweavingRuntime = created;
          return created;
        })
        .catch((error) => {
          worldweavingRuntimePromise = null;
          throw error;
        });
    }
    return worldweavingRuntimePromise;
  }

  function ensureOutpostRuntime() {
    if (outpostRuntime) return Promise.resolve(outpostRuntime);
    if (!outpostRuntimePromise) {
      outpostRuntimePromise = host.loadSecondarySurfaceModule()
        .then((module) => {
          connectLazyModule(module);
          outpostActions ||= module.createMoonOutpostActions?.({
            profile,
            currentExpedition,
            persistExpedition,
            synchronizeHeartShelterStage,
            heartProjectState,
            view,
            runtime: () => outpostRuntime,
            isRunActive: host.isRunActive,
            expeditionCapabilities: host.expeditionCapabilities,
            cosmeticOwnershipOptions: host.cosmeticOwnershipOptions,
            showToast: host.showToast,
            track: host.track,
            requestFrame
          });
          return module.createLazyMoonOutpost({
          documentRef,
          getWorldweavingView: outpostWorldView,
          getOutpostState: () => outpostActions?.presentationState() || {},
          onOpenCache: (payload) => openCache(payload),
          onRedeemSelection: (payload) => redeemSelection(payload),
          onStructureAction: (payload) => structureAction(payload),
          onOpenProject: (_payload, trigger) => {
            outpostRuntime?.close({ restoreFocus: false });
            requestFrame(() => void openHeartProject({ trigger, origin: "outpost" }));
            return true;
          },
          onBeginLaunch: () => beginLaunch(),
          onLaunchComplete: (payload) => completeLaunch(payload),
          onExploreWorldword: (_payload, trigger) => beginWorldwordExplore({ trigger }),
          onReturnToWorldweaving: (_payload, trigger) => {
            outpostRuntime?.close({ restoreFocus: false });
            requestFrame(() => void openWorldweaving({
              trigger,
              origin: outpostOrigin === "worldweaving"
                ? rememberedOrigin("worldweaving", "outpost")
                : "outpost"
            }));
            return true;
          },
          onBack: (navigation, trigger) => backFromOutpost(navigation, trigger),
          onMainMenu: (trigger) => returnToMainMenu(trigger),
          onClose: () => host.resumeTimerIfNeeded(),
            track: host.track
          });
        })
        .then((created) => {
          if (!created || typeof created.open !== "function" || typeof created.render !== "function") {
            throw new Error("Moon Outpost could not be initialized.");
          }
          outpostRuntime = created;
          return created;
        })
        .catch((error) => {
          outpostRuntimePromise = null;
          throw error;
        });
    }
    return outpostRuntimePromise;
  }

  function ensureHeartRuntime() {
    if (heartRuntime) return Promise.resolve(heartRuntime);
    if (!heartRuntimePromise) {
      heartRuntimePromise = host.loadSecondarySurfaceModule()
        .then((module) => {
          connectLazyModule(module);
          heartActions ||= module.createMoonHeartActions?.({
            profile,
            currentExpedition,
            heartProjectState,
            persistExpedition,
            runtime: () => heartRuntime,
            state: gameState,
            track: host.track,
            beginMode: host.beginMode,
            primaryTrigger: host.primaryTrigger
          });
          return module.createLazyMoonHeartProject({
          documentRef,
          getProjectState: heartProjectState,
          onBeginMission: (payload, trigger) => beginHeartMission(payload, trigger),
          onChooseSettlement: (payload) => chooseHeartSettlement(payload),
          onBack: (navigation, trigger) => backFromHeart(navigation, trigger),
          onReturnToOutpost: (trigger) => backFromHeart({ origin: "outpost" }, trigger),
          onMainMenu: (trigger) => returnToMainMenu(trigger),
          onClose: () => host.resumeTimerIfNeeded(),
            track: host.track
          });
        })
        .then((created) => {
          if (!created || typeof created.open !== "function" || typeof created.render !== "function") {
            throw new Error("The Heart project could not be initialized.");
          }
          heartRuntime = created;
          return created;
        })
        .catch((error) => {
          heartRuntimePromise = null;
          throw error;
        });
    }
    return heartRuntimePromise;
  }

  async function openWorldweaving({
    trigger = documentRef?.activeElement,
    awakening = false,
    origin = worldweavingOrigin
  } = {}) {
    worldweavingOrigin = normalizeSurfaceOrigin(origin, ["home", "outpost"], worldweavingOrigin);
    host.closeHubMenu();
    try {
      const presentation = await ensureWorldweavingRuntime();
      presentation.open({
        opener: trigger,
        awakening,
        navigation: { origin: worldweavingOrigin }
      });
      host.track("worldweaving_opened", { phase: view().completed ? "complete" : "building" });
      return true;
    } catch (error) {
      host.showSecondarySurfaceFailure(error, "The Moon could not be opened.");
      return false;
    }
  }

  async function openOutpost({
    trigger = documentRef?.activeElement,
    focusStructure = "",
    origin = outpostOrigin
  } = {}) {
    outpostOrigin = normalizeSurfaceOrigin(origin, ["home", "heart", "worldweaving"], outpostOrigin);
    if (!view().completed) return openWorldweaving({ trigger, origin });
    host.closeHubMenu();
    try {
      const presentation = await ensureOutpostRuntime();
      presentation.open({ opener: trigger, navigation: { origin: outpostOrigin } });
      if (focusStructure) presentation.selectStructure?.(focusStructure, { focus: true });
      host.track("moon_outpost_opened", {
        phase: currentExpedition().worlds.moon.launches ? "returning" : "first"
      });
      return true;
    } catch (error) {
      host.showSecondarySurfaceFailure(error, "The Moon Outpost could not be opened.");
      return false;
    }
  }

  async function openHeartProject({
    trigger = documentRef?.activeElement,
    focusChapterId = "",
    origin = heartOrigin
  } = {}) {
    heartOrigin = normalizeSurfaceOrigin(origin, ["home", "outpost", "worldweaving"], heartOrigin);
    if (!view().completed) return openWorldweaving({ trigger, origin });
    host.closeHubMenu();
    try {
      const presentation = await ensureHeartRuntime();
      presentation.open({ opener: trigger, focusChapterId, navigation: { origin: heartOrigin } });
      host.track("moon_heart_project_opened", {
        phase: heartProjectState().phase
      });
      return true;
    } catch (error) {
      host.showSecondarySurfaceFailure(error, "The Heart project could not be opened.");
      return false;
    }
  }

  function journeyEligible() {
    const current = profile() || {};
    return Number(current.wins) > 0
      || (current.firstOrbit?.completed === true && current.secondOrbit?.completed === true);
  }

  async function open({ trigger = documentRef?.activeElement, awakening = false, surface = "auto" } = {}) {
    if (!journeyEligible()) {
      host.showToast("Complete First and Second Orbit to open the Moon journey.", { scope: "global" });
      return false;
    }
    if (view().completed && surface !== "worldweaving") return openOutpost({ trigger, origin: "home" });
    return openWorldweaving({ trigger, awakening, origin: "home" });
  }

  function homeProject() {
    const moon = view();
    const expedition = currentExpedition();
    const arrivedOnMoon = expedition.activeWorldId === "moon";
    const homeIsMoon = expedition.homeWorldId === "moon";
    const activeMoonJourney = (projectTitle) => ({
      // Arrival is monotonic progression authority; Home location is the
      // current physical platform. After a reverse flight the player keeps
      // Moon progress but sees an Earth-to-Moon return route, never Moon copy
      // composited over the Earth scene.
      origin: homeIsMoon ? HOME_JOURNEY_PLANETS.moon : HOME_JOURNEY_PLANETS.earth,
      destination: HOME_JOURNEY_PLANETS.moon,
      state: arrivedOnMoon ? "continue" : "launch",
      actionKind: arrivedOnMoon ? "continue" : "launch",
      launchReady: !homeIsMoon,
      action: !arrivedOnMoon
        ? "Launch to Moon"
        : homeIsMoon ? `Continue ${projectTitle}` : "Return to Moon"
    });
    if (!moon.completed) {
      const current = moon.slots.find((slot) => slot.status === "current");
      const title = moon.completedAnchors ? `Weave ${current?.title || "the Moon"}` : "Shape the Moon";
      return {
        surface: "worldweaving",
        kicker: "MOON PROJECT · WORLDWEAVING",
        title,
        status: `${moon.completedAnchors} of ${moon.totalAnchors} lunar memories installed`,
        journey: activeMoonJourney(title)
      };
    }

    const heart = heartProjectState(expedition);
    if (!heart.complete) {
      const chapter = heart.chapters.find((entry) => entry.status === "current");
      const title = heart.title || "The Heart";
      return {
        surface: "heart",
        kicker: "CURRENT GREAT PROJECT",
        title,
        status: `${heart.findingProgress.current} of ${heart.findingProgress.total} experiments${chapter?.title ? ` · ${chapter.title}` : ""}`,
        journey: activeMoonJourney(title)
      };
    }

    const outpost = moonOutpostView(expedition.worlds.moon.outpost, { at: new Date() });
    return {
      surface: "outpost",
      kicker: "NEXT FRONTIER · MARS",
      title: "Prepare the Mars mission",
      status: outpost.totalPendingStardust
        ? `${outpost.totalPendingStardust} Stardust ready at Moonhaven`
        : `Moon complete · ${expedition.worlds.moon.launches} launch${expedition.worlds.moon.launches === 1 ? "" : "es"} recorded`,
      journey: {
        origin: HOME_JOURNEY_PLANETS.moon,
        destination: HOME_JOURNEY_PLANETS.mars,
        state: "preparing",
        actionKind: "preparing",
        launchReady: false,
        action: "Mars voyage preparing"
      }
    };
  }

  function decodeHomeJourneyArt({ timeoutMs = HOME_JOURNEY_ART_TIMEOUT_MS } = {}) {
    const images = HOME_JOURNEY_ART_IDS
      .map((id) => element(id))
      .filter((image) => image?.getAttribute?.("src"));
    if (!images.length) return Promise.resolve();
    const decoded = Promise.allSettled(images.map((image) => {
      if (typeof image.decode === "function") return Promise.resolve().then(() => image.decode());
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener?.("load", resolve, { once: true });
        image.addEventListener?.("error", resolve, { once: true });
      });
    }));
    const boundedTimeout = Math.max(
      0,
      Math.min(5_000, Number(timeoutMs) || HOME_JOURNEY_ART_TIMEOUT_MS)
    );
    let timeoutId;
    const timeout = new Promise((resolve) => {
      timeoutId = setTimeout(resolve, boundedTimeout);
    });
    return Promise.race([decoded, timeout])
      .finally(() => clearTimeout(timeoutId))
      .then(() => undefined);
  }

  function prepareHomeJourneyArt(options = {}) {
    syncEntryState();
    return decodeHomeJourneyArt(options);
  }

  async function openCurrentProject({
    trigger = documentRef?.activeElement,
    origin = HOME_PROJECT_ORIGIN
  } = {}) {
    if (!journeyEligible()) {
      host.showToast("Complete First and Second Orbit to open the Moon journey.", { scope: "global" });
      return false;
    }
    const destination = homeProject();
    if (destination.surface === "heart") return openHeartProject({ trigger, origin });
    if (destination.surface === "outpost") return openOutpost({ trigger, origin });
    return openWorldweaving({ trigger, origin });
  }

  function decorateHomeMenu(menu) {
    // The planetary scene is now the journey entry. Keep the primary orbit
    // focused on ordinary word play instead of repeating the same Moon CTA.
    return menu;
  }

  function syncEntryState() {
    const button = element("moonWorldweavingMenuButton");
    const status = element("moonWorldweavingMenuStatus");
    const homeButton = element("moonHomeRocket");
    const visitButton = element("moonHomeProjectVisit");
    if ((!button || !status) && !homeButton && !visitButton) return;
    const eligible = journeyEligible();
    const moon = view();
    if (button && status) {
      button.hidden = !eligible;
      button.disabled = !eligible;
      button.dataset.worldweavingState = moon.completed ? "complete" : moon.completedAnchors ? "active" : "new";
      const label = button.querySelector("b");
      if (label) label.textContent = moon.completed ? "Moon Outpost" : "Moon Worldweaving";
      if (moon.completed) {
        const expedition = currentExpedition();
        const pending = moonOutpostView(expedition.worlds.moon.outpost, { at: new Date() }).totalPendingStardust;
        status.textContent = pending
          ? `${pending} Stardust ready · ${expedition.worlds.moon.launches} launches`
          : `${moon.worldword?.word || "Lander"} online · build, harvest, launch`;
      } else {
        status.textContent = moon.completedAnchors
          ? `${moon.completedAnchors} of ${moon.totalAnchors} lunar memories installed`
          : "Shape your first living world";
      }
    }
    if (homeButton) {
      const destination = homeProject();
      const journey = destination.journey;
      homeButton.hidden = !eligible;
      homeButton.disabled = !eligible || journey.actionKind === "preparing";
      homeButton.dataset.projectSurface = destination.surface;
      homeButton.dataset.originWorld = journey.origin.id;
      homeButton.dataset.destinationWorld = journey.destination.id;
      homeButton.dataset.journeyState = journey.state;
      homeButton.dataset.journeyAction = journey.actionKind || (journey.launchReady ? "launch" : "continue");
      homeButton.setAttribute("aria-label", journey.actionKind === "launch"
        ? `Launch from ${journey.origin.label} to the ${journey.destination.label}. ${destination.title}. ${destination.status}.`
        : journey.actionKind === "preparing"
          ? `${journey.destination.label} voyage preparing from ${journey.origin.label}. ${destination.status}.`
          : `Continue ${destination.title} on the ${journey.destination.label}. ${destination.status}.`);
      const art = element("moonHomeRocketArt");
      if (eligible && art && !art.getAttribute("src")) art.setAttribute("src", MOON_HOME_ROCKET_ASSET);
      const platformArt = element("moonHomePlatformArt");
      const destinationArt = element("moonHomeDestinationArt");
      if (eligible && platformArt && platformArt.getAttribute("src") !== journey.origin.platformArt) {
        platformArt.setAttribute("src", journey.origin.platformArt);
      }
      if (eligible && destinationArt && destinationArt.getAttribute("src") !== journey.destination.destinationArt) {
        destinationArt.setAttribute("src", journey.destination.destinationArt);
      }
      const kicker = element("moonHomeRocketKicker");
      const title = element("moonHomeRocketTitle");
      const homeStatus = element("moonHomeRocketStatus");
      const originPrefix = element("moonHomeOriginPrefix");
      const originLabel = element("moonHomeOriginLabel");
      const destinationLabel = element("moonHomeDestinationLabel");
      const actionLabel = element("moonHomeRocketAction");
      if (kicker) kicker.textContent = destination.kicker;
      if (title) title.textContent = destination.title;
      if (homeStatus) homeStatus.textContent = destination.status;
      if (originPrefix) originPrefix.textContent = journey.actionKind === "preparing"
        ? "NEXT LAUNCH FROM"
        : journey.origin.id !== journey.destination.id
          ? (journey.actionKind === "launch" ? "LAUNCHING FROM" : "RETURNING FROM")
          : "LANDED ON";
      if (originLabel) originLabel.textContent = journey.origin.label.toUpperCase();
      if (destinationLabel) destinationLabel.textContent = journey.destination.label.toUpperCase();
      if (actionLabel) actionLabel.textContent = journey.action.toUpperCase();
      if (visitButton) {
        const canVisitMoonhaven = eligible && journey.actionKind === "preparing";
        visitButton.hidden = !canVisitMoonhaven;
        visitButton.disabled = !canVisitMoonhaven;
      }
    }
    worldweavingRuntime?.render();
    outpostRuntime?.render();
    heartRuntime?.render();
  }

  function recordRoute(history) {
    const current = profile();
    const expedition = currentExpedition();
    const game = gameState();
    const outcome = recordMoonOutpostRoute(expedition.worlds.moon.outpost, history);
    let nextOutpost = outcome.state;
    let projectOutcome = null;
    if (game.journeyContext?.kind === "moon-project") {
      projectOutcome = recordMoonHeartProjectRoute(nextOutpost.projects, {
        context: game.journeyContext,
        history,
        completedAt: new Date().toISOString(),
        revealed: Boolean(game.reveal?.revealed),
        scoringDisabled: Boolean(game.scoringDisabled),
        scoreEligible: !game.scoringDisabled,
        assist: game.assist,
        shelterStage: nextOutpost.structures.shelter?.stage || 1
      });
      if (projectOutcome.recorded) {
        nextOutpost = structuredClone(nextOutpost);
        nextOutpost.projects = projectOutcome.state;
        nextOutpost = synchronizeHeartShelterStage(nextOutpost);
      }
      lastHeartOutcome = {
        ...projectOutcome,
        kind: "moon-project",
        runId: String(game.run?.id || ""),
        context: game.journeyContext
      };
    } else {
      lastHeartOutcome = null;
    }
    if (!outcome.charged && !projectOutcome?.recorded) return { ...outcome, project: projectOutcome };
    const next = replaceMoonOutpostState(expedition, nextOutpost, {
      worldweaving: current.worldweaving,
      at: new Date()
    });
    persistExpedition(next);
    if (outcome.charged) {
      host.track("moon_outpost_meaning_charged", {
        reward: outcome.totalMeaning,
        phase: outcome.multiplier > 1 ? "alternate-route" : "standard"
      });
    }
    if (projectOutcome?.recorded) {
      host.track("moon_heart_evidence_recorded", {
        kind: projectOutcome.milestoneId,
        phase: projectOutcome.reason
      });
    }
    return { ...outcome, project: projectOutcome };
  }

  function commitResult() {
    const state = gameState();
    if (state.reveal.revealed) return null;
    if (state.journeyContext?.kind === "moon-project") {
      if (state.scoringDisabled || state.run?.scoreEligible === false) return null;
      const current = profile();
      let expedition = currentExpedition();
      const projectOutcome = lastHeartOutcome?.runId === String(state.run?.id || "")
        && lastHeartOutcome?.context?.milestoneId === state.journeyContext.milestoneId
        ? lastHeartOutcome
        : null;
      const project = heartProjectState(expedition);
      let rewardStardust = 0;
      let rewardCapability = null;
      if (project.complete && project.reward.available) {
        const claimed = claimMoonHeartProjectReward(expedition.worlds.moon.outpost.projects, {
          claimedAt: new Date().toISOString()
        });
        if (claimed.claimed) {
          const nextOutpost = structuredClone(expedition.worlds.moon.outpost);
          nextOutpost.projects = claimed.state;
          expedition = replaceMoonOutpostState(expedition, nextOutpost, {
            worldweaving: current.worldweaving,
            at: new Date()
          });
          current.expedition = expedition;
          rewardStardust = claimed.grant.stardust;
          rewardCapability = claimed.grant.capability;
          host.track("moon_heart_reward_claimed", {
            kind: claimed.receipt.rewardId,
            reward: rewardStardust
          });
        }
      }
      const updated = heartProjectState(expedition);
      return {
        ...(projectOutcome || {}),
        kind: "moon-project",
        advanced: Boolean(projectOutcome?.recorded),
        context: state.journeyContext,
        project: updated,
        rewardStardust,
        rewardCapability
      };
    }
    if (state.journeyContext?.kind !== "worldweaving") return null;
    const current = profile();
    const outcome = recordWorldweavingCompletion(current.worldweaving, {
      context: state.journeyContext,
      history: state.history,
      completedAt: new Date().toISOString()
    });
    current.worldweaving = outcome.state;
    current.expedition = sanitizeExpeditionState(current.expedition, { worldweaving: current.worldweaving });
    if (!outcome.advanced) return outcome;
    const worldword = worldwordInventoryItem(outcome.state);
    addWorldword(worldword);
    host.saveProfile({ fields: ["journeys", ...(worldword ? ["mastery"] : [])] });
    host.track("worldweaving_memory_installed", {
      kind: state.journeyContext.slotId,
      phase: outcome.worldwordUnlocked ? "complete" : "anchor"
    });
    return outcome;
  }

  function continueFromResult({ awakening = false } = {}) {
    const els = host.getElements();
    if (els.resultDialog.open) els.resultDialog.close();
    host.returnHome({ destination: "journey" });
    requestFrame(() => {
      const recoveryDialog = element("recoveryDialog");
      const reopen = () => void open({ trigger: host.primaryTrigger(), awakening });
      if (recoveryDialog?.open) {
        recoveryDialog.addEventListener("close", reopen, { once: true });
        return;
      }
      reopen();
    });
  }

  function returnToMainMenu(trigger = documentRef?.activeElement) {
    if (homeReturnPromise) return homeReturnPromise;
    heartRuntime?.close({ restoreFocus: false });
    outpostRuntime?.close({ restoreFocus: false });
    worldweavingRuntime?.close({ restoreFocus: false });
    if (typeof host.returnJourneyHome !== "function") {
      host.returnHome({ skipForfeit: true, destination: "journey" });
      return true;
    }
    homeReturnPromise = Promise.resolve(host.returnJourneyHome({
      trigger,
      fromWorld: "moon",
      toWorld: "earth",
      destination: "journey"
    })).finally(() => { homeReturnPromise = null; });
    return homeReturnPromise;
  }

  function returnToHeartProject(context = null, { skipForfeit = false } = {}) {
    const els = host.getElements?.();
    if (els?.resultDialog?.open) els.resultDialog.close();
    host.returnHome({ skipForfeit, destination: "journey" });
    requestFrame(() => {
      const recoveryDialog = element("recoveryDialog");
      const reopen = () => void openHeartProject({
        trigger: host.primaryTrigger(),
        focusChapterId: context?.chapterId === "finale" ? "first-dawn" : context?.chapterId || ""
      });
      if (recoveryDialog?.open) {
        recoveryDialog.addEventListener("close", reopen, { once: true });
        return;
      }
      reopen();
    });
    return true;
  }

  function continueHeartFromResult(context = null) {
    return returnToHeartProject(context);
  }

  function renderResult(outcome) {
    const card = element("worldweavingResultCard");
    const state = gameState();
    const presentation = resultPresentation?.(outcome, state);
    if (card) card.hidden = !presentation?.visible;
    if (!presentation?.visible) return;
    const els = host.getElements();
    element("worldweavingResultKicker").textContent = presentation.kicker;
    element("worldweavingResultTitle").textContent = presentation.title;
    element("worldweavingResultRecipe").textContent = presentation.recipe;
    element("worldweavingResultConsequence").textContent = presentation.consequence;
    els.resultKicker.textContent = presentation.resultKicker;
    els.resultTitle.textContent = presentation.resultTitle;
    els.resultStats.textContent = presentation.resultStats;
    state.resultAction = presentation.heart
      ? () => continueHeartFromResult(presentation.context)
      : () => continueFromResult({ awakening: presentation.awakening });
    els.resultPrimary.querySelector("span").textContent = presentation.primaryLabel;
    els.resultRetry.hidden = true;
    els.resultReplay.hidden = true;
    els.resultShare.hidden = true;
    els.resultPrimary.classList.add("primary-action");
    els.resultPrimary.classList.remove("quiet-action", "secondary-action");
  }

  return Object.freeze({
    commitResult,
    decorateHomeMenu,
    homeProject,
    open,
    openCurrentProject,
    openHeartProject,
    openOutpost,
    prepareHomeJourneyArt,
    recordArrival,
    recordRoute,
    renderResult,
    returnToHeartProject,
    selectHomeWorld,
    syncEntryState,
    view
  });
}
