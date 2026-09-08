const FEATURED_LIMIT = 5;
const LIGHT_YEAR_METERS = 9_460_730_472_580_800;
const SOLAR_BODY_IDS = new Set([
  "sun", "mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn", "uranus", "neptune"
]);
const SOLAR_THUMBNAIL_ORDER = Object.freeze([
  "sun", "mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn", "uranus", "neptune"
]);
const SOLAR_THUMBNAIL_INDEX = new Map(SOLAR_THUMBNAIL_ORDER.map((id, index) => [id, index]));

const PLACE_DETAILS = Object.freeze({
  sun: "The star at the centre of our system",
  mercury: "0.39 astronomical units from the Sun",
  venus: "0.72 astronomical units from the Sun",
  earth: "Our planetary home, 1 astronomical unit from the Sun",
  moon: "384,400 kilometres from Earth",
  mars: "1.52 astronomical units from the Sun",
  jupiter: "5.20 astronomical units from the Sun",
  saturn: "9.58 astronomical units from the Sun",
  uranus: "19.2 astronomical units from the Sun",
  neptune: "30.1 astronomical units from the Sun"
});

const PLACE_PATTERNS = Object.freeze({
  "nearby-star": "star",
  "deep-sky-object": "cluster",
  "milky-way-region": "galaxy",
  "spiral-galaxy": "galaxy",
  "dwarf-galaxy": "galaxy",
  "galaxy-group": "cluster",
  "galaxy-cluster": "cluster",
  "velocity-basin": "cluster",
  "supercluster": "cluster",
  "supercluster-complex": "cluster",
  "early-galaxy": "galaxy",
  "observer-surface": "galaxy",
  "lensed-star": "star",
  quasar: "star"
});

const GLOBULAR_CLUSTER_IDS = new Set(["messier-54", "messier-79"]);

const CONTEXT_LABELS = Object.freeze({
  planet: "Planetary Home",
  orbit: "Local Orbit",
  system: "Solar System",
  solar: "Solar System",
  "solar-marker": "Solar System",
  stellar: "Nearby Stars",
  "deep-sky": "Star Clusters & Nebulae",
  "galactic-marker": "Milky Way Approach",
  "milky-way": "Milky Way",
  "local-group": "Local Group",
  "nearby-groups": "Nearby Galaxy Groups",
  supercluster: "Superclusters",
  "cosmic-web": "Cosmic Web",
  "observable-universe": "Observable Universe"
});

const freezePlace = (place) => Object.freeze({
  available: true,
  selectable: true,
  visitable: true,
  ...place,
  thumbnail: Object.freeze({ ...(place.thumbnail || {}) })
});

const SOLAR_PLACES = Object.freeze([
  freezePlace({ id: "sun", label: "Sun", kind: "star", detail: "The light at the centre of our system", bodyId: "sun", thumbnail: { hue: 38, pattern: "sun" } }),
  freezePlace({ id: "earth", label: "Earth", kind: "planet", detail: "Your planetary Home", bodyId: "earth", thumbnail: { hue: 198, pattern: "earth" } }),
  freezePlace({ id: "moon", label: "Moon", kind: "moon", detail: "Earth's closest companion", bodyId: "moon", thumbnail: { hue: 42, pattern: "moon" } }),
  freezePlace({ id: "mars", label: "Mars", kind: "planet", detail: "1.52 astronomical units from the Sun", bodyId: "mars", thumbnail: { hue: 13, pattern: "rock" } }),
  freezePlace({ id: "jupiter", label: "Jupiter", kind: "planet", detail: "The largest planet", bodyId: "jupiter", thumbnail: { hue: 27, pattern: "bands" } }),
  freezePlace({ id: "saturn", label: "Saturn", kind: "planet", detail: "The ringed giant", bodyId: "saturn", thumbnail: { hue: 39, pattern: "rings" } }),
  freezePlace({ id: "venus", label: "Venus", kind: "planet", detail: "A cloud-wrapped inner world", bodyId: "venus", thumbnail: { hue: 34, pattern: "clouds" } }),
  freezePlace({ id: "mercury", label: "Mercury", kind: "planet", detail: "The innermost planet", bodyId: "mercury", thumbnail: { hue: 28, pattern: "rock" } }),
  freezePlace({ id: "uranus", label: "Uranus", kind: "planet", detail: "An ice giant tipped on its side", bodyId: "uranus", thumbnail: { hue: 184, pattern: "ice" } }),
  freezePlace({ id: "neptune", label: "Neptune", kind: "planet", detail: "The outer blue world", bodyId: "neptune", thumbnail: { hue: 220, pattern: "ice" } })
]);

const STELLAR_PLACES = Object.freeze([
  freezePlace({ id: "solar-system", label: "Solar System", kind: "system", detail: "Return to the Sun and its worlds", bodyId: "sun", thumbnail: { hue: 42, pattern: "system" } }),
  freezePlace({ id: "rigil-kent", label: "Rigil Kent", kind: "star", detail: "4.37 light-years away", thumbnail: { hue: 48, pattern: "star" } }),
  freezePlace({ id: "sirius", label: "Sirius", kind: "star", detail: "8.6 light-years away", thumbnail: { hue: 204, pattern: "star" } }),
  freezePlace({ id: "eps-eridani", label: "Epsilon Eridani", kind: "star", detail: "10.5 light-years away", thumbnail: { hue: 31, pattern: "star" } }),
  freezePlace({ id: "tau-ceti", label: "Tau Ceti", kind: "star", detail: "11.9 light-years away", thumbnail: { hue: 54, pattern: "star" } }),
  freezePlace({ id: "altair", label: "Altair", kind: "star", detail: "16.7 light-years away", thumbnail: { hue: 190, pattern: "star" } }),
  freezePlace({ id: "vega", label: "Vega", kind: "star", detail: "25 light-years away", thumbnail: { hue: 215, pattern: "star" } }),
  freezePlace({ id: "pleiades", label: "Pleiades", kind: "cluster", detail: "An open star cluster 444 light-years away", thumbnail: { hue: 249, pattern: "cluster" } })
]);

const GALACTIC_PLACES = Object.freeze([
  freezePlace({ id: "milky-way", label: "Milky Way", kind: "galaxy", detail: "Our barred spiral galaxy", thumbnail: { hue: 226, pattern: "galaxy" } }),
  freezePlace({ id: "galactic-centre", label: "Galactic Centre", kind: "galaxy", detail: "About 26,000 light-years from the Sun", thumbnail: { hue: 28, pattern: "core" } }),
  freezePlace({ id: "solar-system", label: "Solar System", kind: "system", detail: "Our address within the Milky Way", bodyId: "sun", thumbnail: { hue: 42, pattern: "system" } }),
  freezePlace({ id: "messier-39", label: "Messier 39", kind: "cluster", detail: "An open cluster in Cygnus", thumbnail: { hue: 263, pattern: "cluster" } }),
  freezePlace({ id: "messier-46", label: "Messier 46", kind: "cluster", detail: "A distant open cluster", thumbnail: { hue: 279, pattern: "cluster" } }),
  freezePlace({ id: "beehive", label: "Beehive Cluster", kind: "cluster", detail: "About 577 light-years away", thumbnail: { hue: 49, pattern: "cluster" } }),
  freezePlace({ id: "pleiades", label: "Pleiades", kind: "cluster", detail: "A nearby open star cluster", thumbnail: { hue: 249, pattern: "cluster" } })
]);

const text = (value, fallback = "") => String(value ?? fallback).trim();
const boolean = (value, fallback) => typeof value === "boolean" ? value : fallback;
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const canonicalScaleId = (value = "") => text(value)
  .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
  .replace(/[\s_]+/g, "-")
  .toLowerCase();
const clampHue = (value, id = "place") => {
  const supplied = Number(value);
  if (Number.isFinite(supplied)) return ((supplied % 360) + 360) % 360;
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 360;
};

const formatCompactNumber = (value, maximumFractionDigits = 2) => new Intl.NumberFormat("en-US", {
  maximumFractionDigits
}).format(value);

export function formatPlanetHubPlaceDistance(value = {}) {
  const suppliedLightYears = finite(value.distanceLightYears ?? value.distanceLy);
  const suppliedMeters = finite(value.distanceMeters);
  const lightYears = suppliedLightYears ?? (suppliedMeters == null ? null : suppliedMeters / LIGHT_YEAR_METERS);
  const extent = finite(value.extentLightYears);
  const observerCentered = value.observerCentered === true || value.distanceMeaning === "contains-observer";
  if (observerCentered) {
    if (extent != null && extent > 0) return `Contains our location · spans about ${formatLightYears(extent)}`;
    return "Contains our location";
  }
  if (lightYears == null || lightYears < 0) return "";
  const distance = `${formatLightYears(lightYears)} away`;
  const redshift = finite(value.redshift);
  if (redshift != null && redshift > 0) return `${distance} comoving · redshift z ${formatCompactNumber(redshift, 2)}`;
  return distance;
}

function formatLightYears(lightYears) {
  const value = Math.max(0, Number(lightYears) || 0);
  if (value >= 1_000_000_000) return `${formatCompactNumber(value / 1_000_000_000, 2)} Gly`;
  if (value >= 1_000_000) return `${formatCompactNumber(value / 1_000_000, 2)} Mly`;
  return `${formatCompactNumber(value, value < 100 ? 2 : 0)} ${Math.abs(value - 1) < 1e-9 ? "light-year" : "light-years"}`;
}

function describePlaceKind(id, kind) {
  if (kind === "nearby-star") return "Stellar system";
  if (kind === "deep-sky-object") return GLOBULAR_CLUSTER_IDS.has(id) ? "Globular cluster" : "Open cluster";
  const labels = {
    "spiral-galaxy": "Spiral galaxy",
    "dwarf-galaxy": "Dwarf galaxy",
    "galaxy-group": "Galaxy group",
    "galaxy-cluster": "Galaxy cluster",
    "velocity-basin": "Velocity-basin reconstruction",
    supercluster: "Supercluster",
    "supercluster-complex": "Supercluster complex",
    "early-galaxy": "Early galaxy",
    "observer-surface": "Observer-centred surface",
    "lensed-star": "Gravitationally lensed star",
    quasar: "Quasar"
  };
  return labels[kind] || "";
}

export function resolvePlanetHubPlacesContextLabel(owner, fallback = "Celestial Places") {
  return CONTEXT_LABELS[canonicalScaleId(owner)] || text(fallback, "Celestial Places");
}

function belongsToContext(place, owner) {
  const tier = canonicalScaleId(place?.tier);
  if (!tier) return true;
  const scale = canonicalScaleId(owner);
  if (["planet", "orbit", "system", "solar", "solar-marker"].includes(scale)) return tier === "solar";
  if (scale === "galactic-marker") return tier === "milky-way";
  return tier === scale;
}

export function normalizePlanetHubPlace(value = {}, capabilities = {}) {
  const id = text(value.id || value.placeId || value.slug).toLowerCase();
  if (!id) return null;
  const bodyId = text(value.bodyId || (SOLAR_BODY_IDS.has(id) ? id : "")).toLowerCase() || null;
  const available = boolean(value.available, value.status !== "unavailable");
  const selectable = available && boolean(
    value.selectable ?? value.capabilities?.select,
    Boolean(bodyId || capabilities.selectPlace)
  );
  const visitable = available && boolean(
    value.visitable ?? value.capabilities?.visit,
    Boolean(bodyId || capabilities.visitPlace)
  );
  const label = text(value.label || value.name, id.replaceAll("-", " "));
  const kind = text(value.kind || value.type, bodyId ? (id === "sun" ? "star" : "planet") : "place").toLowerCase();
  const tier = canonicalScaleId(value.tierId || value.tier || (bodyId ? "solar" : "")) || null;
  const sprite = text(value.thumbnail?.sprite || bodyId).toLowerCase();
  const spriteIndex = SOLAR_THUMBNAIL_INDEX.get(sprite);
  const distanceDetail = formatPlanetHubPlaceDistance(value);
  const kindDetail = describePlaceKind(id, kind);
  const generatedDetail = [kindDetail, distanceDetail].filter(Boolean).join(" · ");
  return Object.freeze({
    id,
    label,
    kind,
    tier,
    detail: text(
      value.detail || value.description || value.distanceLabel || value.subtitle || generatedDetail || PLACE_DETAILS[id],
      available ? "Celestial place" : "Unavailable"
    ),
    bodyId,
    available,
    selectable,
    visitable,
    featured: boolean(value.featured, false),
    thumbnail: Object.freeze({
      hue: clampHue(value.thumbnail?.hue ?? value.hue, id),
      pattern: text(value.thumbnail?.pattern || value.thumbnailKind || PLACE_PATTERNS[kind] || kind, "place").toLowerCase(),
      ...(spriteIndex == null ? {} : { sprite, spriteIndex })
    })
  });
}

function fallbackContext(viewBand = "planet") {
  if (viewBand === "universe") return { id: "milky-way", label: "Milky Way", owner: "milky-way", places: GALACTIC_PLACES };
  if (viewBand === "galaxy") return { id: "nearby-stars", label: "Nearby stars", owner: "stellar", places: STELLAR_PLACES };
  if (viewBand === "system") return { id: "solar-system", label: "Solar System", owner: "solar", places: SOLAR_PLACES };
  if (viewBand === "orbit") return { id: "local-orbit", label: "Local orbit", owner: "solar", places: SOLAR_PLACES };
  return { id: "planetary-home", label: "Planetary Home", owner: "solar", places: SOLAR_PLACES };
}

export function resolvePlanetHubPlacesContext({
  navigationContext = null,
  viewBand = "planet",
  selectedPlaceId = "",
  visitedPlaceId = "",
  capabilities = {}
} = {}) {
  const fallback = fallbackContext(viewBand);
  const suppliedPlaces = Array.isArray(navigationContext)
    ? navigationContext
    : Array.isArray(navigationContext?.places)
      ? navigationContext.places
      : Array.isArray(navigationContext?.items)
        ? navigationContext.items
        : null;
  const owner = canonicalScaleId(navigationContext?.owner || navigationContext?.tier || fallback.owner);
  const places = (suppliedPlaces || fallback.places)
    .map((place) => normalizePlanetHubPlace(place, capabilities))
    .filter((place) => place && belongsToContext(place, owner))
    .map((place) => place && Object.freeze({
      ...place,
      selectable: place.selectable && Boolean(place.bodyId || capabilities.selectPlace),
      visitable: place.visitable && Boolean(place.bodyId || capabilities.visitPlace)
    }))
    .filter(Boolean);
  const selected = text(
    navigationContext?.selectedPlaceId || navigationContext?.selectedId,
    selectedPlaceId
  ).toLowerCase();
  const visited = text(
    navigationContext?.visitedPlaceId || navigationContext?.focusedPlaceId || navigationContext?.focusId,
    visitedPlaceId
  ).toLowerCase();
  return Object.freeze({
    id: text(navigationContext?.id, fallback.id),
    label: resolvePlanetHubPlacesContextLabel(owner, navigationContext?.label || navigationContext?.title || fallback.label),
    owner,
    selectedPlaceId: selected,
    visitedPlaceId: visited,
    places: Object.freeze(places)
  });
}

export function resolvePlanetHubPlacesBackContract(history = [], fallback = null) {
  const previous = Array.isArray(history) ? history.at(-1) : null;
  if (!previous) return fallback;
  const label = text(previous.label, "previous place");
  return Object.freeze({
    visible: true,
    kind: "place-history",
    action: "place-history",
    label: `← ${label}`,
    ariaLabel: `Back to ${label}`
  });
}

export function selectPlanetHubFeaturedPlaces(places = [], limit = FEATURED_LIMIT) {
  const values = Array.isArray(places) ? places : [];
  const featured = values.filter((place) => place?.featured);
  const remaining = values.filter((place) => !place?.featured);
  return Object.freeze([...featured, ...remaining].slice(0, Math.max(0, Number(limit) || 0)));
}

const nativePromise = (value) => value && typeof value.then === "function" ? value : Promise.resolve(value);
const accepted = (value) => value !== false && value != null;

export function createPlanetHubPlacesController({
  root,
  orbitRoot = root?.parentElement,
  documentRef = root?.ownerDocument || globalThis.document,
  windowRef = documentRef?.defaultView || globalThis.window,
  getHubState = () => ({}),
  getRenderer = () => null,
  selectBody = () => false,
  visitBody = () => false,
  onPlaceStateChange = () => {}
} = {}) {
  const host = orbitRoot || root;
  const panel = host?.querySelector?.("[data-planet-hub-places]");
  const toggle = host?.querySelector?.("[data-planet-hub-places-toggle]");
  const close = panel?.querySelector?.("[data-planet-hub-places-close]");
  const scrim = host?.querySelector?.("[data-planet-hub-places-scrim]");
  const title = panel?.querySelector?.("[data-planet-hub-places-title]");
  const contextLabel = panel?.querySelector?.("[data-planet-hub-places-context]");
  const search = panel?.querySelector?.("[data-planet-hub-places-search]");
  const all = panel?.querySelector?.("[data-planet-hub-places-all]");
  const list = panel?.querySelector?.("[data-planet-hub-places-list]");
  const empty = panel?.querySelector?.("[data-planet-hub-places-empty]");
  if (!panel || !toggle || !search || !all || !list) return null;

  const media = windowRef?.matchMedia?.("(max-width: 900px), (orientation: portrait) and (max-width: 1100px)");
  // Celestial browsing is an explicit drawer at every viewport.
  const compact = true;
  let open = false;
  let query = "";
  let showAll = false;
  let busy = false;
  let destroyed = false;
  let selectedPlaceId = "";
  let visitedPlaceId = "";
  let currentContext = null;
  let renderSignature = "";
  const history = [];
  const listeners = [];
  const rowControls = new Map();

  const listen = (target, type, listener, options) => {
    target?.addEventListener?.(type, listener, options);
    listeners.push([target, type, listener, options]);
  };
  const rendererCapabilities = () => {
    const renderer = getRenderer?.();
    return {
      selectPlace: typeof renderer?.selectPlace === "function",
      visitPlace: typeof renderer?.visitPlace === "function",
      captureNavigationState: typeof renderer?.captureNavigationState === "function",
      restoreNavigationState: typeof renderer?.restoreNavigationState === "function"
    };
  };
  const readRendererContext = ({ all: includeAll = false } = {}) => {
    const renderer = getRenderer?.();
    try {
      const context = renderer?.getNavigationContext?.({ all: includeAll });
      if (context && typeof context.then !== "function") return context;
      const places = renderer?.getNavigationPlaces?.({ all: includeAll });
      if (places && typeof places.then !== "function") return Array.isArray(places) ? { places } : places;
    } catch {}
    return null;
  };
  const readContext = () => {
    const state = getHubState?.() || {};
    currentContext = resolvePlanetHubPlacesContext({
      navigationContext: readRendererContext({ all: showAll || Boolean(query.trim()) }),
      viewBand: state.viewBand,
      selectedPlaceId: selectedPlaceId || state.selectedPlaceId || state.selectedBodyId,
      visitedPlaceId: visitedPlaceId || state.visitedPlaceId || state.orbitBodyId,
      capabilities: rendererCapabilities()
    });
    selectedPlaceId = currentContext.selectedPlaceId || selectedPlaceId;
    visitedPlaceId = currentContext.visitedPlaceId || visitedPlaceId;
    return currentContext;
  };
  const dialogOpen = () => Boolean(documentRef?.querySelector?.(
    "dialog[open], [role='dialog'][aria-modal='true']:not([hidden])"
  ));
  const isEligible = () => {
    const state = getHubState?.() || {};
    const flight = root?.dataset?.planetHubJourneyFlight === "true"
      || orbitRoot?.dataset?.planetHubJourneyFlight === "true";
    return state.renderer === "webgl"
      && state.mode === "overview"
      && !["loading", "fallback", "lost"].includes(state.phase)
      && !flight
      && !dialogOpen();
  };
  const canInteract = () => {
    const phase = getHubState?.()?.phase;
    return isEligible() && !busy && (phase === "ready" || phase === "preview");
  };
  const setOpen = (value, { restoreFocus = false } = {}) => {
    open = compact ? Boolean(value) : true;
    sync({ force: true });
    if (restoreFocus) toggle.focus?.({ preventScroll: true });
    else if (open && compact) search.focus?.({ preventScroll: true });
    return open;
  };
  const clearList = () => {
    rowControls.clear();
    if (typeof list.replaceChildren === "function") list.replaceChildren();
    else if (Array.isArray(list.children)) list.children.length = 0;
    else while (list.firstChild) list.removeChild?.(list.firstChild);
  };
  const make = (tag, className = "", value = "") => {
    const element = documentRef.createElement(tag);
    if (className) element.className = className;
    if (value) element.textContent = value;
    return element;
  };
  const focusRow = (id, kind = "select") => {
    const controls = rowControls.get(id);
    const target = kind === "visit" ? controls?.visit : controls?.select;
    target?.focus?.({ preventScroll: true });
    return Boolean(target);
  };
  const announce = (message) => {
    const status = documentRef?.getElementById?.("homeOrbitStatus");
    if (status) status.textContent = message;
  };

  async function selectPlace(id, { source = "places-select", restoreFocus = true } = {}) {
    if (busy || !canInteract()) {
      panel.dataset.planetHubPlacesLastAction = `select:${id}:blocked:${getHubState?.()?.phase || "unknown"}`;
      return false;
    }
    const context = readContext();
    const place = context.places.find((entry) => entry.id === String(id).toLowerCase());
    if (!place?.selectable) return false;
    const renderer = getRenderer?.();
    busy = true;
    sync({ force: true });
    let result;
    let failure = "";
    try {
      result = typeof renderer?.selectPlace === "function"
        ? await nativePromise(renderer.selectPlace(place.id, { source }))
        : place.bodyId
          ? await nativePromise(selectBody(place.bodyId, { source }))
          : false;
    } catch (error) {
      failure = String(error?.name || "error");
      result = false;
    }
    busy = false;
    panel.dataset.planetHubPlacesLastAction = `select:${place.id}:${accepted(result) ? "accepted" : failure ? `error-${failure}` : "rejected"}`;
    if (destroyed || !accepted(result)) {
      sync({ force: true });
      if (restoreFocus) focusRow(place.id, "select");
      return false;
    }
    selectedPlaceId = place.id;
    onPlaceStateChange({ selectedPlaceId, bodyId: place.bodyId, label: place.label, centered: false, source });
    announce(`${place.label} selected. Choose Visit to move the camera.`);
    sync({ force: true });
    if (restoreFocus) focusRow(place.id, "select");
    return true;
  }

  async function visitPlace(id, { source = "places-visit", restoreFocus = true } = {}) {
    if (busy || !canInteract()) return false;
    const context = readContext();
    const place = context.places.find((entry) => entry.id === String(id).toLowerCase());
    if (!place?.visitable) return false;
    const renderer = getRenderer?.();
    const previousId = visitedPlaceId || context.visitedPlaceId || getHubState?.()?.orbitBodyId;
    const previous = context.places.find((entry) => entry.id === previousId);
    let navigationState = null;
    try {
      if (typeof renderer?.captureNavigationState === "function") {
        navigationState = await nativePromise(renderer.captureNavigationState());
      }
    } catch {}
    busy = true;
    sync({ force: true });
    announce(`Travelling to ${place.label}.`);
    let result;
    try {
      result = typeof renderer?.visitPlace === "function"
        ? await nativePromise(renderer.visitPlace(place.id, { source, animate: true }))
        : place.bodyId
          ? await nativePromise(visitBody(place.bodyId, { source, animate: true }))
          : false;
    } catch { result = false; }
    busy = false;
    if (destroyed || !accepted(result)) {
      announce(`${place.label} is not available from this view.`);
      sync({ force: true });
      if (restoreFocus) focusRow(place.id, "visit");
      return false;
    }
    if (previousId && previousId !== place.id) {
      history.push(Object.freeze({
        placeId: previousId,
        label: previous?.label || text(previousId).replaceAll("-", " "),
        bodyId: previous?.bodyId || (SOLAR_BODY_IDS.has(previousId) ? previousId : null),
        navigationState
      }));
      if (history.length > 16) history.shift();
    }
    selectedPlaceId = visitedPlaceId = place.id;
    onPlaceStateChange({ selectedPlaceId, visitedPlaceId, bodyId: place.bodyId, label: place.label, centered: true, source });
    announce(`${place.label} centered. Drag to orbit or scroll to zoom.`);
    if (compact) open = false;
    sync({ force: true });
    if (restoreFocus) {
      if (compact) toggle.focus?.({ preventScroll: true });
      else focusRow(place.id, "visit") || search.focus?.({ preventScroll: true });
    }
    return true;
  }

  async function back({ source = "places-back", restoreFocus = true } = {}) {
    if (busy || !history.length) return false;
    const previous = history.at(-1);
    const renderer = getRenderer?.();
    busy = true;
    sync({ force: true });
    let result = false;
    try {
      if (previous.navigationState != null && typeof renderer?.restoreNavigationState === "function") {
        result = await nativePromise(renderer.restoreNavigationState(previous.navigationState, { source, animate: true }));
      }
      if (!accepted(result) && typeof renderer?.visitPlace === "function") {
        result = await nativePromise(renderer.visitPlace(previous.placeId, { source, animate: true }));
      }
      if (!accepted(result) && previous.bodyId) {
        result = await nativePromise(visitBody(previous.bodyId, { source, animate: true }));
      }
    } catch { result = false; }
    busy = false;
    if (destroyed || !accepted(result)) {
      announce(`Could not restore ${previous.label}.`);
      sync({ force: true });
      return false;
    }
    history.pop();
    selectedPlaceId = visitedPlaceId = previous.placeId;
    onPlaceStateChange({
      selectedPlaceId,
      visitedPlaceId,
      bodyId: previous.bodyId,
      label: previous.label,
      centered: true,
      source
    });
    announce(`${previous.label} restored.`);
    sync({ force: true });
    if (restoreFocus) {
      if (compact && !open) toggle.focus?.({ preventScroll: true });
      else focusRow(previous.placeId, "select") || search.focus?.({ preventScroll: true });
    }
    return true;
  }

  function render(context, force = false) {
    const interactive = canInteract();
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const matches = context.places.filter((place) => !normalizedQuery
      || `${place.label} ${place.detail}`.toLocaleLowerCase().includes(normalizedQuery));
    const candidates = !showAll && !normalizedQuery
      ? selectPlanetHubFeaturedPlaces(matches)
      : matches;
    const signature = JSON.stringify([
      context.id, context.owner, selectedPlaceId, visitedPlaceId, query, showAll, busy, interactive,
      candidates.map((place) => [place.id, place.label, place.detail, place.selectable, place.visitable])
    ]);
    if (!force && signature === renderSignature) return;
    renderSignature = signature;
    if (title) title.textContent = context.label;
    if (contextLabel) contextLabel.textContent = showAll || normalizedQuery
      ? `${matches.length} ${matches.length === 1 ? "place" : "places"}`
      : `Featured ${Math.min(FEATURED_LIMIT, candidates.length)} of ${matches.length}`;
    all.textContent = showAll ? "Featured" : `All ${context.places.length}`;
    all.setAttribute?.("aria-pressed", String(showAll));
    clearList();
    for (const place of candidates) {
      const item = make("li", "planet-hub-places__item");
      item.dataset.placeId = place.id;
      item.dataset.placeKind = place.kind;
      item.dataset.selected = String(place.id === selectedPlaceId);
      item.dataset.visited = String(place.id === visitedPlaceId);
      const select = make("button", "planet-hub-places__select");
      select.type = "button";
      select.dataset.planetHubPlaceSelect = place.id;
      select.disabled = !interactive || !place.selectable;
      select.setAttribute?.("aria-pressed", String(place.id === selectedPlaceId));
      select.setAttribute?.("aria-label", `${place.label}. ${place.detail}. ${place.id === selectedPlaceId ? "Selected" : "Select place"}.`);
      const thumbnail = make("span", "planet-hub-places__thumbnail");
      thumbnail.setAttribute?.("aria-hidden", "true");
      thumbnail.dataset.pattern = place.thumbnail.pattern;
      thumbnail.style?.setProperty?.("--planet-hub-place-hue", String(place.thumbnail.hue));
      if (Number.isInteger(place.thumbnail.spriteIndex)) {
        thumbnail.dataset.sprite = place.thumbnail.sprite;
        thumbnail.style?.setProperty?.(
          "--planet-hub-place-sprite-x",
          `${place.thumbnail.spriteIndex / Math.max(1, SOLAR_THUMBNAIL_ORDER.length - 1) * 100}%`
        );
      }
      const copy = make("span", "planet-hub-places__copy");
      copy.title = place.detail;
      copy.append?.(make("strong", "", place.label), make("small", "", place.detail));
      select.append?.(thumbnail, copy);
      const visit = make("button", "planet-hub-places__visit", place.id === visitedPlaceId ? "Viewing" : "Visit");
      visit.type = "button";
      visit.dataset.planetHubPlaceVisit = place.id;
      visit.disabled = !interactive || !place.visitable || place.id === visitedPlaceId;
      visit.setAttribute?.("aria-label", place.id === visitedPlaceId ? `Currently viewing ${place.label}` : `Visit ${place.label}`);
      select.addEventListener?.("click", () => { void selectPlace(place.id); }, false);
      visit.addEventListener?.("click", () => { void visitPlace(place.id); }, false);
      item.append?.(select, visit);
      list.append?.(item);
      rowControls.set(place.id, { select, visit });
    }
    if (empty) {
      empty.hidden = candidates.length > 0;
      empty.textContent = normalizedQuery ? `No places match “${query.trim()}”.` : "No places are available at this distance.";
    }
  }

  function sync({ force = false } = {}) {
    if (destroyed) return false;
    const eligible = isEligible();
    const visible = eligible && (!compact || open);
    toggle.hidden = !eligible || !compact;
    toggle.toggleAttribute?.("inert", !eligible || !compact);
    toggle.setAttribute?.("aria-expanded", String(visible));
    panel.hidden = !visible;
    panel.toggleAttribute?.("inert", !visible);
    panel.setAttribute?.("aria-hidden", String(!visible));
    if (close) close.hidden = !compact;
    if (scrim) scrim.hidden = !visible || !compact;
    host.dataset.planetHubPlacesVisible = String(visible);
    host.dataset.planetHubPlacesOpen = String(open);
    host.dataset.planetHubPlacesLayout = compact ? "sheet" : "aside";
    if (!eligible) return false;
    render(readContext(), force);
    return visible;
  }

  function reset({ selectedId = getHubState?.()?.worldId || "earth" } = {}) {
    history.length = 0;
    selectedPlaceId = visitedPlaceId = String(selectedId || "earth").toLowerCase();
    query = "";
    showAll = false;
    if (search) search.value = "";
    renderSignature = "";
    sync({ force: true });
  }

  function getBackContract(fallback) {
    return resolvePlanetHubPlacesBackContract(history, fallback);
  }

  function handleEscape() {
    if (compact && open) {
      setOpen(false, { restoreFocus: true });
      return true;
    }
    if (query) {
      query = "";
      search.value = "";
      sync({ force: true });
      (compact && !open ? toggle : search).focus?.({ preventScroll: true });
      return true;
    }
    if (history.length) {
      void back({ source: "escape" });
      return true;
    }
    return false;
  }

  listen(toggle, "click", () => setOpen(!open), false);
  listen(close, "click", () => setOpen(false, { restoreFocus: true }), false);
  listen(scrim, "click", () => setOpen(false, { restoreFocus: true }), false);
  listen(all, "click", () => {
    showAll = !showAll;
    sync({ force: true });
    all.focus?.({ preventScroll: true });
  }, false);
  listen(search, "input", () => {
    query = String(search.value || "");
    sync({ force: true });
  }, false);
  listen(search, "keydown", (event) => {
    if (event.key !== "Escape" || !query) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    query = "";
    search.value = "";
    sync({ force: true });
  }, false);
  const onMediaChange = (event) => {
    // Preserve the player's open/closed choice while the drawer resizes.
    sync({ force: true });
  };
  if (typeof media?.addEventListener === "function") media.addEventListener("change", onMediaChange);
  else media?.addListener?.(onMediaChange);

  sync({ force: true });
  return Object.freeze({
    sync,
    reset,
    selectPlace,
    visitPlace,
    back,
    handleEscape,
    getBackContract,
    snapshot: () => Object.freeze({
      open,
      compact,
      busy,
      query,
      showAll,
      selectedPlaceId,
      visitedPlaceId,
      navigationDepth: history.length,
      places: currentContext?.places || Object.freeze([])
    }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const [target, type, listener, options] of listeners) target?.removeEventListener?.(type, listener, options);
      listeners.length = 0;
      if (typeof media?.removeEventListener === "function") media.removeEventListener("change", onMediaChange);
      else media?.removeListener?.(onMediaChange);
      panel.hidden = true;
      panel.toggleAttribute?.("inert", true);
      panel.setAttribute?.("aria-hidden", "true");
      toggle.hidden = true;
      toggle.toggleAttribute?.("inert", true);
      delete host.dataset.planetHubPlacesVisible;
      delete host.dataset.planetHubPlacesOpen;
      delete host.dataset.planetHubPlacesLayout;
    }
  });
}
