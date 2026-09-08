import { routeRankProgressPresentation } from "./route-rank-client.mjs?v=5.0.0-beta.4";

function byId(documentRef, id) {
  return documentRef.getElementById(id);
}

export const HOME_ORBIT_SCENES = Object.freeze(["forge", "journey", "arena"]);

const HOME_ORBIT_LABELS = Object.freeze({
  forge: "Play",
  journey: "Journey",
  arena: "Arena"
});

export const HOME_ORBIT_SWIPE_MAX_DURATION_MS = 675;
export const HOME_ORBIT_SUPPRESS_CLICK_MS = 560;

export function deriveHomeLayout({
  sharedLayout = "",
  sharedDensity = "",
  width = 1280,
  height = 720
} = {}) {
  const viewportWidth = Math.max(1, Number(width) || 1280);
  const viewportHeight = Math.max(1, Number(height) || 720);
  const normalizedSharedLayout = String(sharedLayout || "").trim().toLowerCase();
  const normalizedSharedDensity = String(sharedDensity || "").trim().toLowerCase();
  const portrait = viewportHeight >= viewportWidth;
  const shortLandscape = normalizedSharedLayout === "short-landscape"
    || (!portrait && viewportWidth <= 900 && viewportHeight <= 500);
  const stacked = normalizedSharedLayout === "stacked"
    || (!shortLandscape && (viewportWidth <= 700 || (portrait && viewportWidth <= 900)));
  const roomyLandscape = !portrait && viewportWidth >= 960 && viewportHeight >= 700;
  const layout = stacked
    ? "stacked"
    : !shortLandscape && (roomyLandscape || (viewportWidth >= 1180 && viewportHeight >= 700))
      ? "observatory"
      : "compact";
  const density = normalizedSharedDensity === "compact-height" || viewportHeight < 700
    ? "compact-height"
    : "regular";
  return Object.freeze({ layout, density, width: viewportWidth, height: viewportHeight });
}

export function normalizeHomeCatalogSearch(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function homeCatalogItemMatches(value, query) {
  const terms = normalizeHomeCatalogSearch(query).split(" ").filter(Boolean);
  if (!terms.length) return true;
  const haystack = normalizeHomeCatalogSearch(value);
  return terms.every((term) => haystack.includes(term));
}

const HOME_CATALOG_FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function normalizeHomeOrbitScene(value, fallback = "forge") {
  const scene = String(value || "").trim().toLowerCase();
  return HOME_ORBIT_SCENES.includes(scene) ? scene : fallback;
}

function sceneIsAvailable(availability, scene) {
  if (Array.isArray(availability)) return availability.includes(scene);
  return availability?.[scene] !== false;
}

export function nextHomeOrbitScene(current, direction = 1, availability = {}) {
  const active = normalizeHomeOrbitScene(current);
  const available = HOME_ORBIT_SCENES.filter((scene) => sceneIsAvailable(availability, scene));
  if (!available.length) return "forge";
  const currentIndex = available.indexOf(active);
  const start = currentIndex >= 0 ? currentIndex : 0;
  const step = Number(direction) < 0 ? -1 : 1;
  return available[(start + step + available.length) % available.length];
}

function setElementInert(element, inert) {
  if (!element) return;
  try { element.inert = Boolean(inert); } catch { /* Older engines use the attribute only. */ }
  if (inert) element.setAttribute("inert", "");
  else element.removeAttribute("inert");
}

function safeStorageRead(storage, key) {
  try { return storage?.getItem?.(key) || ""; } catch { return ""; }
}

function safeStorageWrite(storage, key, value) {
  try { storage?.setItem?.(key, value); } catch { /* Private storage can reject writes. */ }
}

/**
 * Owns only Home presentation. Game, Scramble, and project actions stay bound
 * to their existing buttons; this controller selects which destination is
 * visible and keeps every inactive scene out of the focus/accessibility tree.
 */
export function createHomeOrbitController({
  documentRef = globalThis.document,
  windowRef = documentRef?.defaultView || globalThis.window,
  storage = windowRef?.localStorage,
  revealStorageKey = "constellore-home-orbit-reveal-v1"
} = {}) {
  const root = documentRef?.querySelector?.("[data-home-orbit]");
  if (!root) return null;

  const track = root.querySelector("[data-home-orbit-track]");
  const viewport = root.querySelector("[data-home-orbit-viewport]");
  const tablist = root.querySelector("[role=tablist]");
  const status = byId(documentRef, "homeOrbitStatus");
  const tabs = new Map(HOME_ORBIT_SCENES.map((scene) => [
    scene,
    root.querySelector(`[data-home-orbit-tab="${scene}"]`)
  ]));
  const scenes = new Map(HOME_ORBIT_SCENES.map((scene) => [
    scene,
    root.querySelector(`[data-home-orbit-scene="${scene}"]`)
  ]));
  const previous = root.querySelector("[data-home-orbit-previous]");
  const next = root.querySelector("[data-home-orbit-next]");
  const catalogToggle = byId(documentRef, "homeForgeCatalogToggle");
  const catalog = byId(documentRef, "homeForgeCatalog");
  const catalogClose = byId(documentRef, "homeForgeCatalogClose");
  const catalogSearch = byId(documentRef, "homeForgeCatalogSearch");
  const catalogSearchClear = byId(documentRef, "homeForgeCatalogSearchClear");
  const catalogSearchStatus = byId(documentRef, "homeForgeCatalogSearchStatus");
  const catalogNoResults = byId(documentRef, "homeForgeCatalogNoResults");
  let activeScene = "forge";
  let availability = { forge: true, journey: false, arena: false };
  let revealAcknowledged = safeStorageRead(storage, revealStorageKey) === "1";
  let pointerStart = null;
  let suppressNextClickUntil = 0;
  let catalogOpener = null;
  let catalogBackground = [];
  let observer = null;

  function syncLayout() {
    const visualViewport = windowRef?.visualViewport;
    const documentElement = documentRef?.documentElement;
    const sharedLayout = documentElement?.dataset?.uiLayout || documentRef.body?.dataset?.uiLayout || "";
    const sharedDensity = documentElement?.dataset?.uiDensity || documentRef.body?.dataset?.uiDensity || "";
    const width = visualViewport?.width || windowRef?.innerWidth || documentElement?.clientWidth || 1280;
    const height = visualViewport?.height || windowRef?.innerHeight || documentElement?.clientHeight || 720;
    const presentation = deriveHomeLayout({
      sharedLayout,
      sharedDensity,
      width,
      height
    });
    const railOrientation = width > height && width <= 900 && height <= 500 ? "vertical" : "horizontal";
    root.dataset.homeLayout = presentation.layout;
    root.dataset.homeDensity = presentation.density;
    root.dataset.homeRailOrientation = railOrientation;
    tablist?.setAttribute("aria-orientation", railOrientation);
    if (documentRef.body?.dataset) {
      documentRef.body.dataset.homeLayout = presentation.layout;
      documentRef.body.dataset.homeDensity = presentation.density;
    }
    return presentation;
  }

  function focusAfterPaint(element) {
    if (!element?.focus) return;
    const focus = () => element.focus({ preventScroll: true });
    if (typeof windowRef?.requestAnimationFrame === "function") windowRef.requestAnimationFrame(focus);
    else focus();
  }

  function catalogIsOpen() {
    return Boolean(catalog && !catalog.hidden);
  }

  function visibleCatalogFocusables() {
    if (!catalog?.querySelectorAll) return [];
    return [...catalog.querySelectorAll(HOME_CATALOG_FOCUSABLE)].filter((element) => {
      if (element.hidden || element.disabled || element.getAttribute?.("aria-hidden") === "true") return false;
      if (element.closest?.("[hidden], [inert]")) return false;
      return typeof element.getClientRects !== "function" || element.getClientRects().length > 0;
    });
  }

  function isolateCatalogBackground() {
    if (!catalog || catalogBackground.length) return;
    const snapshots = [];
    let branch = catalog;
    let ancestor = catalog.parentElement;
    while (ancestor) {
      for (const sibling of ancestor.children || []) {
        if (sibling === branch) continue;
        snapshots.push({
          element: sibling,
          inert: Boolean(sibling.inert),
          hadInert: sibling.hasAttribute?.("inert") === true
        });
        setElementInert(sibling, true);
      }
      if (ancestor === documentRef.body) break;
      branch = ancestor;
      ancestor = ancestor.parentElement;
    }
    catalogBackground = snapshots;
  }

  function restoreCatalogBackground() {
    for (const { element, inert, hadInert } of catalogBackground) {
      if (!element) continue;
      try { element.inert = inert; } catch { /* Attribute restoration below covers older engines. */ }
      if (inert || hadInert) element.setAttribute?.("inert", "");
      else element.removeAttribute?.("inert");
    }
    catalogBackground = [];
  }

  function clearManagedCatalogVisibility() {
    catalog?.querySelectorAll?.("[data-home-catalog-search-hidden]").forEach((element) => {
      element.hidden = false;
      element.removeAttribute("data-home-catalog-search-hidden");
    });
  }

  function setCatalogSearchHidden(element, hidden) {
    if (!element) return;
    if (hidden) {
      if (!element.hidden) {
        element.hidden = true;
        element.setAttribute("data-home-catalog-search-hidden", "");
      }
      return;
    }
    if (element.hasAttribute?.("data-home-catalog-search-hidden")) {
      element.hidden = false;
      element.removeAttribute("data-home-catalog-search-hidden");
    }
  }

  function catalogElementIsAvailable(element) {
    if (!element || element.hidden || element.closest?.("[hidden]")) return false;
    if (typeof windowRef?.getComputedStyle === "function") {
      const style = windowRef.getComputedStyle(element);
      if (style?.display === "none" || style?.visibility === "hidden") return false;
    }
    return true;
  }

  function resetCatalogSearch({ focus = false } = {}) {
    clearManagedCatalogVisibility();
    if (catalogSearch) catalogSearch.value = "";
    if (catalogSearchClear) catalogSearchClear.hidden = true;
    if (catalogNoResults) catalogNoResults.hidden = true;
    if (catalogSearchStatus) catalogSearchStatus.textContent = "Search all unlocked Forge choices.";
    if (focus) focusAfterPaint(catalogSearch);
  }

  function applyCatalogSearch() {
    if (!catalogSearch || !catalog) return 0;
    clearManagedCatalogVisibility();
    const query = normalizeHomeCatalogSearch(catalogSearch.value);
    if (catalogSearchClear) catalogSearchClear.hidden = !query;
    if (!query) {
      if (catalogNoResults) catalogNoResults.hidden = true;
      if (catalogSearchStatus) catalogSearchStatus.textContent = "Search all unlocked Forge choices.";
      return 0;
    }

    let matches = 0;
    for (const section of catalog.querySelectorAll?.("[data-home-catalog-section]") || []) {
      if (!catalogElementIsAvailable(section)) continue;
      let sectionMatches = 0;
      for (const choice of section.querySelectorAll?.("[data-home-catalog-choice]") || []) {
        if (!catalogElementIsAvailable(choice)) continue;
        const match = homeCatalogItemMatches(`${choice.dataset?.homeCatalogKeywords || ""} ${choice.textContent || ""}`, query);
        setCatalogSearchHidden(choice, !match);
        if (match) {
          matches += 1;
          sectionMatches += 1;
        }
      }
      setCatalogSearchHidden(section, sectionMatches === 0);
    }

    if (catalogNoResults) catalogNoResults.hidden = matches > 0;
    if (catalogSearchStatus) {
      catalogSearchStatus.textContent = matches
        ? `${matches} Forge choice${matches === 1 ? "" : "s"} found for “${catalogSearch.value.trim()}”.`
        : `No Forge choices found for “${catalogSearch.value.trim()}”.`;
    }
    return matches;
  }

  function validCatalogReturnTarget(element) {
    return Boolean(element?.focus
      && element.isConnected !== false
      && !element.hidden
      && !element.disabled
      && !element.closest?.("[hidden], [inert]"));
  }

  function snapshot() {
    return Object.freeze({
      activeScene,
      availableScenes: HOME_ORBIT_SCENES.filter((scene) => availability[scene]),
      catalogOpen: Boolean(catalog && !catalog.hidden),
      layout: root.dataset.homeLayout || "observatory",
      density: root.dataset.homeDensity || "regular"
    });
  }

  function emitChange(source) {
    const CustomEventCtor = windowRef?.CustomEvent;
    if (typeof root.dispatchEvent !== "function" || typeof CustomEventCtor !== "function") return;
    root.dispatchEvent(new CustomEventCtor("homeorbitchange", {
      bubbles: true,
      detail: { ...snapshot(), source }
    }));
  }

  function updateArrowState() {
    const availableScenes = HOME_ORBIT_SCENES.filter((scene) => availability[scene]);
    const disabled = availableScenes.length < 2;
    if (previous) previous.disabled = disabled;
    if (next) next.disabled = disabled;
    if (!disabled) {
      const previousScene = nextHomeOrbitScene(activeScene, -1, availability);
      const nextScene = nextHomeOrbitScene(activeScene, 1, availability);
      if (previous) previous.dataset.homeOrbitDestination = previousScene;
      if (next) next.dataset.homeOrbitDestination = nextScene;
      previous?.setAttribute("aria-label", `Previous destination: ${HOME_ORBIT_LABELS[previousScene]}`);
      next?.setAttribute("aria-label", `Next destination: ${HOME_ORBIT_LABELS[nextScene]}`);
      const previousLabel = previous?.querySelector?.("[data-home-orbit-previous-label]");
      const nextLabel = next?.querySelector?.("[data-home-orbit-next-label]");
      if (previousLabel) previousLabel.textContent = HOME_ORBIT_LABELS[previousScene];
      if (nextLabel) nextLabel.textContent = HOME_ORBIT_LABELS[nextScene];
    }
  }

  function acknowledgeReveal() {
    if (revealAcknowledged) return;
    revealAcknowledged = true;
    root.dataset.homeOrbitReveal = "seen";
    safeStorageWrite(storage, revealStorageKey, "1");
  }

  function closeCatalog({ restoreFocus = false } = {}) {
    if (!catalogIsOpen()) return false;
    const preferredReturn = catalogOpener?.focus && catalogOpener.isConnected !== false
      ? catalogOpener
      : catalogToggle?.focus && catalogToggle.isConnected !== false
        ? catalogToggle
        : tabs.get(activeScene);
    if (catalog.open && typeof catalog.close === "function") {
      try { catalog.close(); } catch { catalog.removeAttribute?.("open"); }
    } else {
      catalog.removeAttribute?.("open");
    }
    catalog.hidden = true;
    setElementInert(catalog, true);
    catalog.setAttribute("aria-hidden", "true");
    root.dataset.catalogOpen = "false";
    root.dataset.homeSurface = "none";
    catalogToggle?.setAttribute("aria-expanded", "false");
    documentRef.body?.classList?.remove("home-forge-catalog-open");
    restoreCatalogBackground();
    resetCatalogSearch();
    if (restoreFocus && validCatalogReturnTarget(catalogOpener)) focusAfterPaint(catalogOpener);
    else if (restoreFocus && validCatalogReturnTarget(preferredReturn)) focusAfterPaint(preferredReturn);
    catalogOpener = null;
    return true;
  }

  function openCatalog({ trigger = catalogToggle, focus = true } = {}) {
    if (!catalog || !catalogToggle || catalogToggle.hidden || catalogToggle.disabled) return false;
    if (activeScene !== "forge") select("forge", { source: "catalog" });
    catalogOpener = trigger;
    resetCatalogSearch();
    catalog.hidden = false;
    setElementInert(catalog, false);
    catalog.setAttribute("aria-hidden", "false");
    isolateCatalogBackground();
    if (!catalog.open && typeof catalog.showModal === "function") {
      try { catalog.showModal(); } catch { catalog.setAttribute?.("open", ""); }
    } else {
      catalog.setAttribute?.("open", "");
    }
    root.dataset.catalogOpen = "true";
    root.dataset.homeSurface = "forge-catalog";
    catalogToggle.setAttribute("aria-expanded", "true");
    documentRef.body?.classList?.add("home-forge-catalog-open");
    if (focus) focusAfterPaint(catalogClose);
    return true;
  }

  function select(rawScene, {
    focusTab = false,
    announce = true,
    source = "programmatic"
  } = {}) {
    const scene = normalizeHomeOrbitScene(rawScene);
    if (!availability[scene]) return false;
    if (scene !== "forge") closeCatalog();
    activeScene = scene;
    root.dataset.homeOrbitActive = scene;
    root.dataset.homeDestination = scene;
    track?.style?.setProperty("--home-orbit-index", String(HOME_ORBIT_SCENES.indexOf(scene)));

    for (const candidate of HOME_ORBIT_SCENES) {
      const active = candidate === scene;
      const tab = tabs.get(candidate);
      const panel = scenes.get(candidate);
      tab?.setAttribute("aria-selected", String(active));
      if (tab) tab.tabIndex = active ? 0 : -1;
      panel?.setAttribute("aria-hidden", String(!active));
      setElementInert(panel, !active);
    }

    if (status) {
      // A planet-centre change updates the tab semantics and visible card but
      // is intentionally silent for assistive technology. Clear the previous
      // announcement so it never contradicts the newly selected tab.
      status.textContent = announce ? `${HOME_ORBIT_LABELS[scene]} selected.` : "";
    }
    if (scene !== "forge" && !["availability", "sync"].includes(source)) acknowledgeReveal();
    if (focusTab) tabs.get(scene)?.focus?.({ preventScroll: true });
    updateArrowState();
    emitChange(source);
    return true;
  }

  function syncAvailability(nextAvailability = {}) {
    const rocket = byId(documentRef, "moonHomeRocket");
    const firstSession = documentRef.body?.classList?.contains?.("first-session") === true;
    availability = {
      forge: nextAvailability.forge !== false,
      journey: nextAvailability.journey ?? (availability.journey || Boolean(rocket && !rocket.hidden)),
      arena: nextAvailability.arena ?? (availability.arena || !firstSession)
    };
    const journeyPanel = scenes.get("journey");
    if (journeyPanel) journeyPanel.dataset.journeyReady = String(Boolean(rocket && !rocket.hidden));

    for (const scene of HOME_ORBIT_SCENES) {
      const available = Boolean(availability[scene]);
      const tab = tabs.get(scene);
      const panel = scenes.get(scene);
      if (tab) {
        tab.hidden = !available;
        tab.disabled = !available;
        tab.setAttribute("aria-disabled", String(!available));
      }
      if (panel) panel.dataset.homeOrbitAvailable = String(available);
    }

    root.dataset.homeOrbitReveal = !revealAcknowledged && !firstSession && (availability.journey || availability.arena)
      ? "new"
      : "seen";
    if (root.dataset.homeOrbitReveal === "new"
      && windowRef?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      acknowledgeReveal();
    }
    if (!availability[activeScene]) {
      const fallback = HOME_ORBIT_SCENES.find((scene) => availability[scene]) || "forge";
      select(fallback, { announce: false, source: "availability" });
    } else {
      select(activeScene, { announce: false, source: "availability" });
    }
    if (catalogIsOpen() && catalogSearch?.value) applyCatalogSearch();
    root.dataset.homeOrbitReady = "true";
    return snapshot();
  }

  function selectAdjacent(direction, source) {
    return select(nextHomeOrbitScene(activeScene, direction, availability), { source });
  }

  function onTabClick(event) {
    const directDestination = event.target?.closest?.("[data-home-orbit-go]");
    if (directDestination && root.contains(directDestination)) {
      select(directDestination.dataset.homeOrbitGo, { focusTab: true, source: "scene-action" });
      return;
    }
    const tab = event.target?.closest?.("[data-home-orbit-tab]");
    if (!tab || !root.contains(tab)) return;
    select(tab.dataset.homeOrbitTab, { focusTab: true, source: "tab" });
  }

  function onTabKeydown(event) {
    const tab = event.target?.closest?.("[data-home-orbit-tab]");
    if (!tab) return;
    let destination = "";
    const vertical = tablist?.getAttribute?.("aria-orientation") === "vertical";
    if ((!vertical && event.key === "ArrowLeft") || (vertical && event.key === "ArrowUp")) {
      destination = nextHomeOrbitScene(activeScene, -1, availability);
    }
    if ((!vertical && event.key === "ArrowRight") || (vertical && event.key === "ArrowDown")) {
      destination = nextHomeOrbitScene(activeScene, 1, availability);
    }
    if (event.key === "Home") destination = HOME_ORBIT_SCENES.find((scene) => availability[scene]) || "forge";
    if (event.key === "End") destination = [...HOME_ORBIT_SCENES].reverse().find((scene) => availability[scene]) || "forge";
    if (!destination) return;
    event.preventDefault();
    select(destination, { focusTab: true, source: "keyboard" });
  }

  function onPointerDown(event) {
    if (event.isPrimary === false || (event.button != null && event.button !== 0)) return;
    const origin = event.target;
    // The Living Planet stage owns its own direction-locked drag, edge preview,
    // and landmark picking. Letting the legacy viewport recognizer observe the
    // same pointer would occasionally commit two destinations for one gesture.
    const planetStage = root.querySelector?.("[data-planet-hub]");
    if (planetStage?.contains?.(origin)) return;
    if (suppressNextClickUntil <= Date.now()) suppressNextClickUntil = 0;
    const interactive = origin?.closest?.("button, a, input, select, textarea, summary, [contenteditable=true]");
    // The Journey artwork is intentionally one large launch control. A tap
    // still launches, while clear horizontal intent is reserved for Orbit
    // navigation so the scene does not become a swipe trap on touch screens.
    if (interactive && interactive.id !== "moonHomeRocket") return;
    if (typeof windowRef?.getComputedStyle === "function") {
      let candidate = origin;
      while (candidate && candidate !== viewport) {
        const style = windowRef.getComputedStyle(candidate);
        const scrollableX = /(auto|scroll)/.test(style?.overflowX || "") && candidate.scrollWidth > candidate.clientWidth;
        // Vertical content remains a valid gesture origin. Direction locking
        // below gives native vertical scrolling priority until horizontal
        // intent is unambiguous.
        if (scrollableX) return;
        candidate = candidate.parentElement;
      }
    }
    const eventTime = Number.isFinite(event.timeStamp) ? event.timeStamp : Date.now();
    pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY, time: eventTime, intent: "pending" };
    track?.style?.setProperty?.("--home-orbit-drag", "0px");
  }

  function settlePointerDrag() {
    root.dataset.homeOrbitDragging = "false";
    track?.style?.setProperty?.("--home-orbit-drag", "0px");
  }

  function clearPointer({ settle = true } = {}) {
    if (pointerStart?.id != null) {
      try { viewport?.releasePointerCapture?.(pointerStart.id); } catch { /* Capture can already be gone. */ }
    }
    pointerStart = null;
    if (settle) settlePointerDrag();
  }

  function onPointerMove(event) {
    if (!pointerStart || (pointerStart.id != null && event.pointerId !== pointerStart.id)) return;
    const eventTime = Number.isFinite(event.timeStamp) ? event.timeStamp : Date.now();
    if (eventTime - pointerStart.time > HOME_ORBIT_SWIPE_MAX_DURATION_MS) return clearPointer();
    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    if (pointerStart.intent === "pending") {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 9) return;
      if (Math.abs(deltaY) > Math.abs(deltaX) * 1.08) return clearPointer();
      if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.12) return;
      pointerStart.intent = "horizontal";
      root.dataset.homeOrbitDragging = "true";
      try { viewport?.setPointerCapture?.(event.pointerId); } catch { /* Capture is an enhancement only. */ }
    }
    if (pointerStart.intent !== "horizontal") return;
    event.preventDefault?.();
    const drag = Math.max(-82, Math.min(82, deltaX * .34));
    track?.style?.setProperty?.("--home-orbit-drag", `${drag}px`);
  }

  function onPointerUp(event) {
    if (!pointerStart || (pointerStart.id != null && event.pointerId !== pointerStart.id)) return clearPointer();
    const deltaX = event.clientX - pointerStart.x;
    const deltaY = event.clientY - pointerStart.y;
    const eventTime = Number.isFinite(event.timeStamp) ? event.timeStamp : Date.now();
    const duration = eventTime - pointerStart.time;
    clearPointer();
    if (duration > HOME_ORBIT_SWIPE_MAX_DURATION_MS || Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;
    suppressNextClickUntil = Date.now() + HOME_ORBIT_SUPPRESS_CLICK_MS;
    windowRef?.setTimeout?.(() => {
      if (suppressNextClickUntil <= Date.now()) suppressNextClickUntil = 0;
    }, HOME_ORBIT_SUPPRESS_CLICK_MS + 20);
    selectAdjacent(deltaX < 0 ? 1 : -1, "swipe");
  }

  function onViewportClick(event) {
    if (!suppressNextClickUntil || suppressNextClickUntil < Date.now()) {
      suppressNextClickUntil = 0;
      return;
    }
    suppressNextClickUntil = 0;
    event.preventDefault();
    event.stopPropagation();
  }

  function onDocumentKeydown(event) {
    if (event.key !== "Escape" || !catalogIsOpen()) return;
    if (catalogSearch?.value) {
      event.preventDefault();
      resetCatalogSearch({ focus: true });
      return;
    }
    if (closeCatalog({ restoreFocus: true })) event.preventDefault();
  }

  function onCatalogKeydown(event) {
    if (event.key !== "Tab" || !catalogIsOpen()) return;
    const focusables = visibleCatalogFocusables();
    if (!focusables.length) {
      event.preventDefault();
      catalog.focus?.({ preventScroll: true });
      return;
    }
    const first = focusables[0];
    const last = focusables.at(-1);
    const current = documentRef.activeElement;
    if (event.shiftKey && (current === first || !catalog.contains?.(current))) {
      event.preventDefault();
      last.focus?.({ preventScroll: true });
    } else if (!event.shiftKey && (current === last || !catalog.contains?.(current))) {
      event.preventDefault();
      first.focus?.({ preventScroll: true });
    }
  }

  function onCatalogCancel(event) {
    event.preventDefault?.();
    closeCatalog({ restoreFocus: true });
  }

  function onDocumentFocusIn(event) {
    if (!catalogIsOpen() || catalog.contains?.(event.target)) return;
    const target = visibleCatalogFocusables()[0] || catalog;
    focusAfterPaint(target);
  }

  function onCatalogSearchInput() {
    applyCatalogSearch();
  }

  function onCatalogSearchClear() {
    resetCatalogSearch({ focus: true });
  }

  function onRevealAnimationEnd(event) {
    if (event.animationName === "home-orbit-destination-reveal") acknowledgeReveal();
  }

  root.addEventListener("click", onTabClick);
  root.addEventListener("animationend", onRevealAnimationEnd);
  tablist?.addEventListener("keydown", onTabKeydown);
  previous?.addEventListener("click", () => selectAdjacent(-1, "previous"));
  next?.addEventListener("click", () => selectAdjacent(1, "next"));
  viewport?.addEventListener("pointerdown", onPointerDown);
  viewport?.addEventListener("pointermove", onPointerMove);
  viewport?.addEventListener("pointerup", onPointerUp);
  viewport?.addEventListener("pointercancel", clearPointer);
  viewport?.addEventListener("click", onViewportClick, true);
  catalogToggle?.addEventListener("click", (event) => openCatalog({ trigger: event.currentTarget }));
  catalog?.querySelectorAll?.("[data-home-forge-close]").forEach((button) => {
    button.addEventListener("click", () => closeCatalog({ restoreFocus: true }));
  });
  catalog?.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-mode], #voyageHubButton, #eventHubButton, #cosmosCircuitHomeButton")) closeCatalog();
  });
  catalog?.addEventListener("keydown", onCatalogKeydown);
  catalog?.addEventListener("cancel", onCatalogCancel);
  catalogSearch?.addEventListener("input", onCatalogSearchInput);
  catalogSearchClear?.addEventListener("click", onCatalogSearchClear);
  documentRef.addEventListener?.("keydown", onDocumentKeydown);
  documentRef.addEventListener?.("focusin", onDocumentFocusIn);
  windowRef?.addEventListener?.("resize", syncLayout, { passive: true });
  windowRef?.visualViewport?.addEventListener?.("resize", syncLayout, { passive: true });

  const MutationObserverCtor = windowRef?.MutationObserver;
  if (typeof MutationObserverCtor === "function") {
    observer = new MutationObserverCtor(() => {
      syncLayout();
      syncAvailability();
    });
    const rocket = byId(documentRef, "moonHomeRocket");
    if (rocket) observer.observe(rocket, { attributes: true, attributeFilter: ["hidden", "data-project-surface", "data-journey-state"] });
    if (documentRef.body) {
      observer.observe(documentRef.body, {
        attributes: true,
        attributeFilter: ["class", "data-ui-layout", "data-ui-density"]
      });
    }
    if (documentRef.documentElement) {
      observer.observe(documentRef.documentElement, {
        attributes: true,
        attributeFilter: ["data-ui-layout", "data-ui-density"]
      });
    }
  }

  syncLayout();
  syncAvailability();

  function restoreFrom(origin = "gameplay") {
    const destination = ({ gameplay: "forge", project: "journey", arena: "arena" })[String(origin).toLowerCase()] || "forge";
    return select(destination, { announce: false, source: `restore-${origin}` });
  }

  function reset() {
    closeCatalog({ restoreFocus: false });
    clearPointer();
    return select("forge", { announce: false, source: "reset" });
  }

  return Object.freeze({
    select,
    setActive: select,
    next: () => selectAdjacent(1, "api"),
    previous: () => selectAdjacent(-1, "api"),
    step: (direction = 1) => selectAdjacent(direction, "step"),
    syncAvailability,
    syncLayout,
    openCatalog,
    openForgeCatalog: openCatalog,
    closeCatalog,
    closeSurface: closeCatalog,
    restoreFrom,
    reset,
    snapshot,
    destroy() {
      closeCatalog({ restoreFocus: false });
      observer?.disconnect?.();
      root.removeEventListener("click", onTabClick);
      root.removeEventListener("animationend", onRevealAnimationEnd);
      tablist?.removeEventListener("keydown", onTabKeydown);
      viewport?.removeEventListener("pointerdown", onPointerDown);
      viewport?.removeEventListener("pointermove", onPointerMove);
      viewport?.removeEventListener("pointerup", onPointerUp);
      viewport?.removeEventListener("pointercancel", clearPointer);
      viewport?.removeEventListener("click", onViewportClick, true);
      catalog?.removeEventListener("keydown", onCatalogKeydown);
      catalog?.removeEventListener("cancel", onCatalogCancel);
      catalogSearch?.removeEventListener("input", onCatalogSearchInput);
      catalogSearchClear?.removeEventListener("click", onCatalogSearchClear);
      documentRef.removeEventListener?.("keydown", onDocumentKeydown);
      documentRef.removeEventListener?.("focusin", onDocumentFocusIn);
      windowRef?.removeEventListener?.("resize", syncLayout);
      windowRef?.visualViewport?.removeEventListener?.("resize", syncLayout);
    }
  });
}

const homeOrbitControllers = new WeakMap();

export function getHomeOrbitController(documentRef = document) {
  if (!documentRef || (typeof documentRef !== "object" && typeof documentRef !== "function")) return null;
  let controller = homeOrbitControllers.get(documentRef);
  if (!controller) {
    controller = createHomeOrbitController({ documentRef });
    if (controller) homeOrbitControllers.set(documentRef, controller);
  }
  return controller;
}

export function syncHomeOrbitView({
  forgeAvailable = true,
  journeyAvailable,
  arenaAvailable,
  catalogAvailable = false,
  preferredScene = ""
} = {}, documentRef = document) {
  const controller = getHomeOrbitController(documentRef);
  if (!controller) return null;
  const catalogWasOpen = controller.snapshot().catalogOpen;
  const catalogToggle = byId(documentRef, "homeForgeCatalogToggle");
  if (catalogToggle) {
    catalogToggle.hidden = !catalogAvailable && !catalogWasOpen;
    catalogToggle.disabled = !catalogAvailable && !catalogWasOpen;
  }
  const result = controller.syncAvailability({
    forge: forgeAvailable,
    ...(journeyAvailable == null ? {} : { journey: journeyAvailable }),
    ...(arenaAvailable == null ? {} : { arena: arenaAvailable })
  });
  if (preferredScene) controller.select(preferredScene, { announce: false, source: "sync" });
  if (!catalogAvailable && !catalogWasOpen) controller.closeCatalog();
  return result;
}

export function renderProfileRankView(routeRank, documentRef = document) {
  const progress = routeRankProgressPresentation(routeRank);
  const card = byId(documentRef, "profileRouteRankCard");
  card.dataset.rank = progress.id;
  card.dataset.tier = String(Math.ceil(progress.number / 2));
  byId(documentRef, "profileRouteRankMark").textContent = progress.mark;
  byId(documentRef, "profileRouteRankName").textContent = progress.name;
  byId(documentRef, "profileRouteRankNumber").textContent = `RANK ${String(progress.number).padStart(2, "0")}`;
  byId(documentRef, "profileRouteRankStatus").textContent = progress.status;
  byId(documentRef, "profileRouteRankProgress").style.width = `${progress.progress}%`;
  byId(documentRef, "profileRouteRankPercent").textContent = `${progress.progress}%`;
  byId(documentRef, "profileRouteRankDetail").textContent = progress.detail;
  byId(documentRef, "profileRouteRankUnlock").textContent = progress.nextUnlock;
  const meter = byId(documentRef, "profileRouteRankMeter");
  meter.setAttribute("aria-valuenow", String(progress.progress));
  meter.setAttribute("aria-valuetext", progress.meterLabel);
  meter.setAttribute("aria-label", `${progress.name} Route Rank progress`);
  return progress;
}

export function syncHomeMenuView({
  menu,
  trainingCompleted,
  secondOrbitCompleted,
  wins,
  routeRank,
  startStyle
}, documentRef = document) {
  const body = documentRef.body;
  body.dataset.homeStage = menu.stage;
  body.classList.toggle("first-session", !menu.onboardingComplete);
  body.classList.toggle("training-needed", !trainingCompleted);
  body.classList.toggle("second-orbit-needed", trainingCompleted && !secondOrbitCompleted && wins === 0);
  for (const state of ["progress", "sharing", "daily", "choices", "explore", "adventures", "advanced"]) {
    body.classList.toggle(`${state}-ready`, menu[`${state}Ready`]);
  }
  body.classList.toggle("daily-locked", menu.dailyLocked);
  body.classList.toggle("daily-attention", menu.dailyAttention);
  body.classList.toggle("focus-mode", menu.focusMode);

  const primary = menu.primary;
  const pressureReady = routeRank.rank.number > 2;
  byId(documentRef, "primaryOrbitKicker").textContent = primary.kicker;
  byId(documentRef, "primaryOrbitTitle").textContent = primary.title;
  byId(documentRef, "primaryOrbitDescription").textContent = primary.description;
  byId(documentRef, "primaryOrbitButton").querySelector("span").textContent = primary.label;
  byId(documentRef, "primaryOrbitMeta").textContent = primary.action === "training" || menu.focusMode
    ? primary.meta
    : `${routeRank.rank.name} · ${startStyle}`;
  byId(documentRef, "primaryOrbitButton").dataset.action = primary.action;
  byId(documentRef, "primaryOrbitSecondary").hidden = !menu.choicesReady && primary.secondaryAction === "modes";
  byId(documentRef, "homeRouteRank").textContent = routeRank.rank.name;
  byId(documentRef, "modeSectionSummary").textContent = pressureReady
    ? "Relaxed, timed, and limited-move games"
    : "Relaxed play";

  const arenaTabCaption = documentRef.querySelector('[data-home-orbit-tab="arena"] small');
  if (arenaTabCaption) arenaTabCaption.textContent = menu.arenaReady ? "1 v 1" : "Silver";
  syncHomeOrbitView({
    forgeAvailable: true,
    journeyAvailable: menu.onboardingComplete,
    arenaAvailable: menu.onboardingComplete,
    catalogAvailable: menu.choicesReady || menu.exploreReady || menu.adventuresReady
  }, documentRef);

  const dailyStar = byId(documentRef, "dailyStarButton");
  if (dailyStar) {
    dailyStar.hidden = !menu.dailyAttention;
    dailyStar.disabled = !menu.dailyAvailable;
  }

  const dailyDestination = documentRef.querySelector('[data-home-mode="daily"]');
  if (dailyDestination) {
    const played = menu.dailyAvailable && !menu.dailyAttention;
    dailyDestination.dataset.dailyState = played ? "played" : "new";
    byId(documentRef, "dailyDestinationIcon").textContent = played ? "✓" : "✦";
    byId(documentRef, "dailyDestinationStatus").textContent = played ? "PLAYED TODAY" : "DAILY WORD";
    byId(documentRef, "dailyDestinationDescription").textContent = played
      ? "The orbiting prompt is tucked away. You can still return."
      : "Everyone gets the same target today.";
    byId(documentRef, "dailyDestinationAction").textContent = played ? "Play again" : "Play today’s word";
  }

  const secondary = byId(documentRef, "primaryOrbitSecondary");
  secondary.textContent = primary.secondaryLabel;
  secondary.dataset.action = primary.secondaryAction;

  const unlockNote = documentRef.querySelector('[data-progressive="advanced-lock"]');
  if (unlockNote) {
    const remaining = menu.winsUntilAdvanced;
    unlockNote.textContent = !menu.rankReadyForAdvanced
      ? `Reach Gold Route Rank${remaining > 0 ? ` and complete ${remaining} more game${remaining === 1 ? "" : "s"}` : ""} to open Adventures and competitive tools.`
      : remaining === 1
        ? "More opens after your next completed game."
        : `More opens after ${remaining} completed games.`;
  }

  for (const card of documentRef.querySelectorAll("[data-home-mode]")) {
    card.hidden = card.dataset.homeMode === primary.action
      || (["quick", "moves"].includes(card.dataset.homeMode) && !pressureReady)
      || (card.dataset.homeMode === "daily" && !menu.dailyAvailable);
  }
}
