const OBSERVATORY_TABS = Object.freeze(["collections", "pieces", "owned"]);
const PROFILE_FRAME_CATEGORY = "profileFrames";
const PROFILE_FRAME_NONE_ID = "profile-frame-none";
const BROWSER_TABS = Object.freeze(["collections", "pieces", PROFILE_FRAME_CATEGORY]);
const EFFECT_MODES = Object.freeze(["full", "reduced", "off"]);
const PREVIEW_SURFACES = Object.freeze(["board", "home", "gate", "menu", "sound"]);
const ALLOWED_BADGES = new Set(["Free", "Earned", "Supporter", "Event", "Rank reward", "Purchase only"]);
const PRESENTATION_SCOPES = new Set(["foundation", "accent", "full-shell"]);
const COLLECTION_FAMILY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FALLBACK_COLLECTION_FAMILY_ID = "other-collections";

const DEFAULT_SLOT_LABELS = Object.freeze({
  wordPlaque: "Word plaques",
  trailSet: "Trails",
  boardFinish: "Board backgrounds & finishes",
  boardScene: "Board backgrounds & finishes",
  homeScene: "Home backgrounds",
  gateStyle: "Worldweave transitions",
  uiFinish: "Interface styles",
  soundTheme: "Sound themes",
  theme: "Interface styles",
  board: "Board backgrounds & finishes",
  trail: "Trails",
  sound: "Sound themes"
});

const COLLECTION_SLOT_CHIPS = Object.freeze({
  wordPlaque: "Words",
  trailSet: "Trail",
  boardFinish: "Board",
  homeScene: "Background",
  gateStyle: "Worldweave",
  uiFinish: "UI",
  soundTheme: "Sound"
});

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => asText(value)).filter(Boolean))];
}

function safeCollectionFamilyId(value, fallback = FALLBACK_COLLECTION_FAMILY_ID) {
  const id = asText(value).toLowerCase();
  return COLLECTION_FAMILY_ID_PATTERN.test(id) ? id : fallback;
}

function collectionFamilyLabel(id) {
  if (id === FALLBACK_COLLECTION_FAMILY_ID) return "Other Collections";
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function normalizeCollectionFamily(family, index = 0) {
  const source = asRecord(family);
  const id = asText(source.id).toLowerCase();
  if (!COLLECTION_FAMILY_ID_PATTERN.test(id) || id === FALLBACK_COLLECTION_FAMILY_ID) return null;
  return Object.freeze({
    ...source,
    id,
    label: asText(source.label, collectionFamilyLabel(id)),
    kicker: asText(source.kicker),
    description: asText(source.description, "More complete cosmetic collections."),
    order: Number.isFinite(Number(source.order)) ? Number(source.order) : index,
    future: source.future === true
  });
}

function fallbackCollectionFamily() {
  return Object.freeze({
    id: FALLBACK_COLLECTION_FAMILY_ID,
    label: "Other Collections",
    kicker: "More collections",
    description: "Collections that do not yet belong to a named catalog family.",
    order: Number.MAX_SAFE_INTEGER,
    future: false
  });
}

function safeBadge(value, entitlement = "") {
  const requested = asText(value);
  if (ALLOWED_BADGES.has(requested)) return requested;
  const requestedMatch = [...ALLOWED_BADGES].find((label) => label.toLowerCase() === requested.toLowerCase());
  if (requestedMatch) return requestedMatch;
  const access = asText(entitlement || requested).toLowerCase();
  if (access === "free") return "Free";
  if (access === "earned") return "Earned";
  if (access === "event") return "Event";
  return "Supporter";
}

function safeTone(value, fallback = "celestial") {
  const tone = asText(value, fallback).toLowerCase();
  if (tone.includes("pixel") || tone.includes("arcade") || tone.includes("cartridge") || tone.includes("scanline")) return "pixel";
  if (tone.includes("bubble") || tone.includes("reef") || tone.includes("coral") || tone.includes("pearl")) return "reef";
  if (tone.includes("vanguard") || tone.includes("meridian") || tone.includes("command") || tone.includes("ion-crescent") || tone.includes("ion-star") || tone.includes("void-overture")) return "vanguard";
  if (tone.includes("eclipse") || tone.includes("sovereign") || tone.includes("obsidian") || tone.includes("corona")) return "eclipse";
  if (tone.includes("lunar") || tone.includes("moon") || tone.includes("silverleaf")) return "lunar";
  if (tone.includes("aurora") || tone.includes("frost") || tone.includes("glass")) return "aurora";
  if (tone.includes("solar") || tone.includes("brass") || tone.includes("ember") || tone.includes("foundry")) return "solar";
  if (tone.includes("prism")) return "prism";
  return "celestial";
}

function normalizeItem(item, index = 0) {
  const source = asRecord(item);
  const id = asText(source.id, `cosmetic-${index + 1}`);
  const slot = asText(source.slot ?? source.kind, "misc");
  const acquisition = asText(source.acquisition).toLowerCase();
  const badge = acquisition === "purchase-only"
    ? "Purchase only"
    : acquisition === "purchase-or-rank"
      ? "Rank reward"
      : safeBadge(source.badge ?? source.access, source.entitlement);
  return Object.freeze({
    ...source,
    id,
    slot,
    label: asText(source.label ?? source.name, id),
    description: asText(source.description ?? source.summary, "A look-only cosmetic."),
    collectionId: asText(source.collectionId ?? source.collection),
    collectionFamily: safeCollectionFamilyId(source.collectionFamily),
    styleLabel: asText(source.styleLabel),
    badge,
    unlockHint: asText(source.unlockHint ?? source.requirement),
    tone: safeTone(source.tone ?? source.visualTone ?? source.collectionId ?? id),
    order: Number.isFinite(Number(source.order)) ? Number(source.order) : index
  });
}

function normalizeCollection(collection, index = 0) {
  const source = asRecord(collection);
  const id = asText(source.id, `collection-${index + 1}`);
  const acquisition = asText(source.acquisition).toLowerCase();
  const badge = acquisition === "purchase-only"
    ? "Purchase only"
    : acquisition === "purchase-or-rank"
      ? "Rank reward"
      : safeBadge(source.badge ?? source.access, source.entitlement);
  const requestedPresentation = asText(source.presentation ?? source.presentationScope).toLowerCase();
  return Object.freeze({
    ...source,
    id,
    label: asText(source.label ?? source.name, id),
    description: asText(source.description ?? source.summary, "A coordinated cosmetic collection."),
    collectionFamily: safeCollectionFamilyId(source.collectionFamily),
    styleLabel: asText(source.styleLabel),
    badge,
    tier: asText(source.tier ?? source.presentationTier, badge === "Free" ? "Included" : "Signature"),
    presentation: PRESENTATION_SCOPES.has(requestedPresentation)
      ? requestedPresentation
      : badge === "Free" ? "foundation" : "accent",
    creditPrice: Math.max(0, Math.floor(Number(source.creditPrice) || 0)),
    unlockHint: asText(source.unlockHint ?? source.requirement),
    tone: safeTone(source.tone ?? source.visualTone ?? id),
    itemIds: uniqueStrings(source.itemIds ?? source.items ?? source.pieces),
    loadout: Object.freeze({ ...asRecord(source.loadout) }),
    order: Number.isFinite(Number(source.order)) ? Number(source.order) : index
  });
}

function resolveOwned(resolver, item) {
  try {
    if (typeof resolver === "function") return Boolean(resolver(item, item.id));
    if (resolver instanceof Set) return resolver.has(item.id);
    if (Array.isArray(resolver)) return resolver.includes(item.id);
    if (resolver && typeof resolver === "object") return Boolean(resolver[item.id]);
  } catch {
    return false;
  }
  return item.badge === "Free";
}

function sortByOrderThenLabel(a, b) {
  const left = asRecord(a);
  const right = asRecord(b);
  const leftOrder = Number.isFinite(Number(left.order)) ? Number(left.order) : Number.MAX_SAFE_INTEGER;
  const rightOrder = Number.isFinite(Number(right.order)) ? Number(right.order) : Number.MAX_SAFE_INTEGER;
  return (leftOrder - rightOrder)
    || asText(left.label ?? left.id).localeCompare(asText(right.label ?? right.id));
}

export function observatoryCollectionValue(collection = {}) {
  const creditPrice = Math.max(0, Math.floor(Number(asRecord(collection).creditPrice) || 0));
  return creditPrice > 0 ? `${creditPrice.toLocaleString("en-US")} Star Credits` : "Included";
}

export function observatoryPurchaseStep(armedCollectionId = "", targetCollectionId = "") {
  const armed = asText(armedCollectionId);
  const target = asText(targetCollectionId);
  if (!target) return Object.freeze({ action: "idle", armedCollectionId: "" });
  if (armed === target) return Object.freeze({ action: "confirm", armedCollectionId: "" });
  return Object.freeze({ action: "arm", armedCollectionId: target });
}

/**
 * Produces the UI's stable, serializable view model. The function is intentionally
 * DOM-independent so manifest migrations and ownership rules can be tested in Node.
 */
export function buildObservatoryModel({
  collectionFamilies = [],
  collections = [],
  items = [],
  slotOrder = [],
  loadout = {},
  owned = null,
  slotLabels = {}
} = {}) {
  const normalizedItems = (Array.isArray(items) ? items : []).map(normalizeItem).sort(sortByOrderThenLabel);
  const normalizedCollections = (Array.isArray(collections) ? collections : [])
    .map(normalizeCollection)
    .sort(sortByOrderThenLabel);
  const familyById = new Map();
  for (const family of (Array.isArray(collectionFamilies) ? collectionFamilies : [])
    .map(normalizeCollectionFamily)
    .filter(Boolean)
    .sort(sortByOrderThenLabel)) {
    if (!familyById.has(family.id)) familyById.set(family.id, family);
  }
  const needsFallbackFamily = normalizedCollections.some((collection) => !familyById.has(collection.collectionFamily));
  if (needsFallbackFamily && !familyById.has(FALLBACK_COLLECTION_FAMILY_ID)) {
    familyById.set(FALLBACK_COLLECTION_FAMILY_ID, fallbackCollectionFamily());
  }
  const normalizedFamilies = [...familyById.values()].sort(sortByOrderThenLabel);
  const inferredSlots = normalizedItems.map((item) => item.slot);
  const slots = uniqueStrings([...(Array.isArray(slotOrder) ? slotOrder : []), ...inferredSlots]);
  const current = asRecord(loadout);
  const safeLoadout = Object.freeze(Object.fromEntries(slots.map((slot) => [slot, asText(current[slot])]).filter(([, id]) => id)));
  const labels = asRecord(slotLabels);
  const ownedItems = normalizedItems.map((item) => Object.freeze({ ...item, owned: resolveOwned(owned, item) }));
  const itemById = new Map(ownedItems.map((item) => [item.id, item]));

  const collectionModels = normalizedCollections.map((collection) => {
    const collectionLoadout = deriveCollectionLoadout(collection, ownedItems, slots, safeLoadout);
    const representedItems = Object.values(collectionLoadout).map((id) => itemById.get(id)).filter(Boolean);
    const isOwned = representedItems.length > 0 && representedItems.every((item) => item.owned);
    const collectionFamily = familyById.has(collection.collectionFamily)
      ? collection.collectionFamily
      : FALLBACK_COLLECTION_FAMILY_ID;
    return Object.freeze({
      ...collection,
      collectionFamily,
      loadout: Object.freeze(collectionLoadout),
      owned: isOwned
    });
  });

  return Object.freeze({
    slots: Object.freeze(slots),
    slotLabels: Object.freeze(Object.fromEntries(slots.map((slot) => [
      slot,
      asText(labels[slot], DEFAULT_SLOT_LABELS[slot] || slot)
    ]))),
    loadout: safeLoadout,
    items: Object.freeze(ownedItems),
    collectionFamilies: Object.freeze(normalizedFamilies),
    collections: Object.freeze(collectionModels)
  });
}

/**
 * Groups a collection view into semantic catalog families. Empty registered
 * families are intentionally omitted so future shelves appear only when used.
 */
export function groupObservatoryCollectionsByFamily(model, collections = null) {
  const source = asRecord(model);
  const familyById = new Map();
  for (const family of (Array.isArray(source.collectionFamilies) ? source.collectionFamilies : [])
    .map(normalizeCollectionFamily)
    .filter(Boolean)
    .sort(sortByOrderThenLabel)) {
    if (!familyById.has(family.id)) familyById.set(family.id, family);
  }

  const candidates = (Array.isArray(collections)
    ? collections
    : Array.isArray(source.collections) ? source.collections : [])
    .filter((collection) => collection && typeof collection === "object")
    .slice()
    .sort(sortByOrderThenLabel);
  const needsFallbackFamily = candidates.some((collection) => {
    const id = safeCollectionFamilyId(collection.collectionFamily);
    return !familyById.has(id);
  });
  if (needsFallbackFamily && !familyById.has(FALLBACK_COLLECTION_FAMILY_ID)) {
    familyById.set(FALLBACK_COLLECTION_FAMILY_ID, fallbackCollectionFamily());
  }

  const buckets = new Map([...familyById.keys()].map((id) => [id, []]));
  for (const collection of candidates) {
    const requestedId = safeCollectionFamilyId(collection.collectionFamily);
    const familyId = familyById.has(requestedId) ? requestedId : FALLBACK_COLLECTION_FAMILY_ID;
    if (!buckets.has(familyId)) buckets.set(familyId, []);
    buckets.get(familyId).push(collection);
  }

  return Object.freeze(
    [...familyById.values()]
      .sort(sortByOrderThenLabel)
      .filter((family) => (buckets.get(family.id) || []).length > 0)
      .map((family) => Object.freeze({
        ...family,
        collections: Object.freeze((buckets.get(family.id) || []).slice().sort(sortByOrderThenLabel))
      }))
  );
}

export function deriveCollectionLoadout(collection, items = [], slotOrder = [], fallbackLoadout = {}) {
  const source = asRecord(collection);
  const explicit = asRecord(source.loadout);
  const slots = uniqueStrings(slotOrder);
  const allowedSlots = new Set(slots);
  const result = {};

  for (const [slot, id] of Object.entries(explicit)) {
    if ((!allowedSlots.size || allowedSlots.has(slot)) && asText(id)) result[slot] = asText(id);
  }

  const ids = new Set(uniqueStrings(source.itemIds ?? source.items ?? source.pieces));
  const collectionId = asText(source.id);
  for (const rawItem of Array.isArray(items) ? items : []) {
    const item = normalizeItem(rawItem);
    if (ids.has(item.id) || (collectionId && item.collectionId === collectionId)) {
      if ((!allowedSlots.size || allowedSlots.has(item.slot)) && !result[item.slot]) result[item.slot] = item.id;
    }
  }

  const fallback = asRecord(fallbackLoadout);
  for (const slot of slots) {
    if (!result[slot] && asText(fallback[slot])) result[slot] = asText(fallback[slot]);
  }
  return result;
}

export function calculatePieceLoadout(loadout, item) {
  const source = asRecord(loadout);
  const piece = normalizeItem(item);
  return { ...source, [piece.slot]: piece.id };
}

export function loadoutsEqual(left, right, slotOrder = []) {
  const a = asRecord(left);
  const b = asRecord(right);
  const slots = uniqueStrings([
    ...(Array.isArray(slotOrder) ? slotOrder : []),
    ...Object.keys(a),
    ...Object.keys(b)
  ]);
  return slots.every((slot) => asText(a[slot]) === asText(b[slot]));
}

export function filterObservatoryItems(model, { tab = "pieces", slot = "" } = {}) {
  const source = asRecord(model);
  const safeTab = OBSERVATORY_TABS.includes(tab) ? tab : "pieces";
  return (Array.isArray(source.items) ? source.items : []).filter((item) => {
    if (slot && item.slot !== slot) return false;
    return safeTab !== "owned" || item.owned;
  });
}

export function filterObservatoryCollections(model, { tab = "collections" } = {}) {
  const source = asRecord(model);
  const safeTab = OBSERVATORY_TABS.includes(tab) ? tab : "collections";
  return (Array.isArray(source.collections) ? source.collections : [])
    .filter((collection) => safeTab !== "owned" || collection.owned);
}

export function observatorySelectionState({
  candidate,
  currentLoadout,
  previewLoadout,
  slotOrder = [],
  owned = false
} = {}) {
  const desired = asRecord(candidate);
  return Object.freeze({
    owned: Boolean(owned),
    equipped: loadoutsEqual(desired, currentLoadout, slotOrder),
    previewed: loadoutsEqual(desired, previewLoadout, slotOrder),
    canEquip: Boolean(owned) && !loadoutsEqual(desired, currentLoadout, slotOrder)
  });
}

/**
 * Summarizes the equipped presentation and any staged preview without changing
 * ownership or persistence. This powers the Lab's always-visible loadout rail.
 */
export function observatoryLoadoutSummary(model, currentLoadout, stagedLoadout) {
  const source = asRecord(model);
  const slots = uniqueStrings(source.slots);
  const items = Array.isArray(source.items) ? source.items : [];
  const collections = Array.isArray(source.collections) ? source.collections : [];
  const equipped = asRecord(currentLoadout ?? source.loadout);
  const staged = asRecord(stagedLoadout ?? equipped);
  const itemById = new Map(items.map((item) => [asText(item?.id), item]));
  const matchingCollection = collections.find((collection) =>
    loadoutsEqual(collection?.loadout, equipped, slots)
  );
  const slotSummaries = slots.map((slot) => {
    const itemId = asText(equipped[slot]);
    const stagedItemId = asText(staged[slot], itemId);
    const item = itemById.get(itemId);
    const stagedItem = itemById.get(stagedItemId);
    return Object.freeze({
      slot,
      slotLabel: asText(source.slotLabels?.[slot], DEFAULT_SLOT_LABELS[slot] || slot),
      itemId,
      itemLabel: asText(item?.label, "Default look"),
      itemTone: safeTone(item?.tone ?? item?.collectionId ?? itemId),
      stagedItemId,
      stagedItemLabel: asText(stagedItem?.label, "Default look"),
      staged: stagedItemId !== itemId,
      ownedOptions: items.filter((candidate) => candidate?.slot === slot && candidate?.owned).length
    });
  });

  return Object.freeze({
    collectionId: asText(matchingCollection?.id),
    label: asText(matchingCollection?.label, "Custom mix"),
    staged: slotSummaries.some((slot) => slot.staged),
    slots: Object.freeze(slotSummaries)
  });
}

function setText(element, value) {
  element.textContent = asText(value);
  return element;
}

function element(tag, className = "", textValue = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textValue) setText(node, textValue);
  return node;
}

function button(className, textValue, onClick) {
  const node = element("button", className, textValue);
  node.type = "button";
  if (onClick) node.addEventListener("click", onClick);
  return node;
}

function setPressed(buttonNode, pressed) {
  buttonNode.setAttribute("aria-pressed", String(Boolean(pressed)));
}

function firstFocusable(root) {
  return root?.querySelector(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
}

function allFocusable(root) {
  return [...(root?.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ) || [])].filter((node) => !node.hidden && node.getAttribute("aria-hidden") !== "true");
}

export function observatoryLoadoutIsOwned(model, loadout) {
  const byId = new Map(model.items.map((item) => [item.id, item]));
  const candidate = asRecord(loadout);
  if (Object.keys(candidate).some((slot) => !model.slots.includes(slot))) return false;
  const requiredSlots = model.slots.filter((slot) => model.items.some((item) => item.slot === slot));
  return requiredSlots.every((slot) => {
    const id = candidate[slot];
    const item = byId.get(id);
    return Boolean(item && item.slot === slot && item.owned);
  });
}

export function calculatePiecePreviewLoadout(baseLoadout, item) {
  return calculatePieceLoadout(baseLoadout, item);
}

export function observatoryEffectModeForKey(currentMode, key) {
  const current = EFFECT_MODES.includes(currentMode) ? currentMode : EFFECT_MODES[0];
  const index = EFFECT_MODES.indexOf(current);
  if (key === "Home") return EFFECT_MODES[0];
  if (key === "End") return EFFECT_MODES.at(-1);
  if (key === "ArrowRight" || key === "ArrowDown") return EFFECT_MODES[(index + 1) % EFFECT_MODES.length];
  if (key === "ArrowLeft" || key === "ArrowUp") return EFFECT_MODES[(index - 1 + EFFECT_MODES.length) % EFFECT_MODES.length];
  return current;
}

export function observatoryPreviewSurface(meta = {}) {
  const slot = asText(asRecord(meta).slot);
  if (["homeScene"].includes(slot)) return "home";
  if (["gateStyle"].includes(slot)) return "gate";
  if (["uiFinish", "theme"].includes(slot)) return "menu";
  if (["soundTheme", "sound"].includes(slot)) return "sound";
  return "board";
}

export function observatoryPreviewAssetUrl(item, {
  size = "sm",
  moduleUrl = import.meta.url
} = {}) {
  const responsive = asRecord(asRecord(item).assets?.responsive);
  const preferred = ["sm", "md", "lg"].includes(size) ? size : "sm";
  const assetPath = asText(
    responsive[preferred]
    ?? responsive.sm
    ?? responsive.md
    ?? responsive.lg
  );
  if (!/^\/art\/[A-Za-z0-9._/-]+\.(?:avif|jpe?g|png|webp)$/i.test(assetPath)) return "";
  try {
    return new URL(`.${assetPath}`, moduleUrl).href;
  } catch {
    return "";
  }
}

function selectedTone(model, loadout) {
  const ids = new Set(Object.values(asRecord(loadout)));
  const selected = model.items.find((item) => ids.has(item.id) && item.tone !== "celestial")
    || model.items.find((item) => ids.has(item.id));
  return selected?.tone || "celestial";
}

function toneForSlots(model, loadout, slots, fallback = "celestial") {
  const current = asRecord(loadout);
  for (const slot of slots) {
    const id = current[slot];
    const item = model.items.find((candidate) => candidate.id === id);
    if (item) return item.tone;
  }
  return fallback;
}

function itemForSlots(model, loadout, slots) {
  const current = asRecord(loadout);
  for (const slot of slots) {
    const id = current[slot];
    const item = model.items.find((candidate) => candidate.id === id && candidate.slot === slot);
    if (item) return item;
  }
  return null;
}

const VISUAL_KINDS = Object.freeze({
  collection: "collection",
  wordPlaque: "word-plaque",
  trailSet: "trail-set",
  boardFinish: "board-finish",
  boardScene: "board-finish",
  homeScene: "home-scene",
  gateStyle: "gate-style",
  uiFinish: "ui-finish",
  soundTheme: "sound-theme",
  theme: "ui-finish",
  board: "board-finish",
  trail: "trail-set",
  sound: "sound-theme"
});

function visualKind(value) {
  return VISUAL_KINDS[asText(value)] || "piece";
}

function applyPreviewImage(node, item, size = "sm") {
  const assetUrl = observatoryPreviewAssetUrl(item, { size });
  if (!assetUrl) return;
  node.classList.add("has-image");
  node.style.setProperty("--observatory-preview-image", `url("${assetUrl}")`);
  for (const responsiveSize of ["sm", "md", "lg"]) {
    const responsiveUrl = observatoryPreviewAssetUrl(item, { size: responsiveSize });
    if (responsiveUrl) {
      node.style.setProperty(`--observatory-preview-image-${responsiveSize}`, `url("${responsiveUrl}")`);
    }
  }
}

function actionKey(type, id) {
  return `${type}:${id}`;
}

function focusKeyAfterCommit(meta, fallback = "") {
  if (meta?.type === "collection" && meta.id) return actionKey("carousel-option", meta.id);
  if (meta?.type === "piece" && meta.id) return actionKey("carousel-option", meta.id);
  return fallback || actionKey("close", "observatory");
}

/**
 * Mounts a full-page Cosmetics Observatory without requiring static HTML.
 *
 * Callbacks:
 * - getLoadout(): current canonical loadout
 * - isOwned(item, id): authoritative ownership result
 * - onPreview(loadout, meta): apply a transient presentation
 * - onCommit(loadout, meta): persist an owned presentation and optionally return
 *   the authoritative loadout (may return a Promise)
 * - getBalance(), onPurchase(collection), onClose(meta), onSupporter(subject)
 * - onSoundPreview(item)
 * - onPresentPreview({ loadout, meta, surface }): optionally move the transient
 *   preview onto a real app surface while this dialog is suspended
 * - onDismissPreview(meta): tear down an externally presented preview
 * - getEffects(), onEffectsChange(mode)
 * - profileFrames, getProfileFrame(), createProfileFramePreview(slug, entry)
 * - onProfileFrameCommit(slug, meta): persist the independent Arena frame
 */
export function createCosmeticsObservatory(options = {}) {
  if (typeof document === "undefined") {
    throw new Error("Cosmetics Observatory requires a browser document.");
  }

  const settings = asRecord(options);
  const mount = settings.mount || document.body;
  let dialog = null;
  let activeTab = "collections";
  let ownedOnly = false;
  let selectedSlot = "";
  const carouselSelectionByCategory = new Map();
  let baseLoadout = {};
  let previewLoadout = {};
  let previewMeta = null;
  let equippedProfileFrame = "";
  let stagedProfileFrame = "";
  let previewMode = false;
  let previewSuspended = false;
  let previewSurface = PREVIEW_SURFACES[0];
  let previewReturnFocusKey = "";
  let returnFocus = null;
  const initialEffects = settings.getEffects?.();
  let effects = EFFECT_MODES.includes(initialEffects) ? initialEffects : "full";
  let committing = false;
  let armedPurchaseId = "";

  function makeModel() {
    return buildObservatoryModel({
      collectionFamilies: settings.collectionFamilies,
      collections: settings.collections,
      items: settings.items,
      slotOrder: settings.slotOrder,
      loadout: baseLoadout,
      owned: settings.isOwned ?? settings.owned,
      slotLabels: settings.slotLabels
    });
  }

  function profileFrameCatalog() {
    return (Array.isArray(settings.profileFrames) ? settings.profileFrames : [])
      .filter((entry) => entry && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(asText(entry.slug)));
  }

  function configuredProfileFrame(value) {
    const slug = asText(value);
    return profileFrameCatalog().some((entry) => entry.slug === slug) ? slug : "";
  }

  function readConfiguredProfileFrame() {
    try {
      return configuredProfileFrame(settings.getProfileFrame?.() ?? settings.profileFrame);
    } catch {
      return "";
    }
  }

  function configuredLoadout(raw) {
    return {
      ...buildObservatoryModel({
        collectionFamilies: settings.collectionFamilies,
        collections: settings.collections,
        items: settings.items,
        slotOrder: settings.slotOrder,
        loadout: raw,
        owned: settings.isOwned ?? settings.owned,
        slotLabels: settings.slotLabels
      }).loadout
    };
  }

  function announce(message) {
    const live = dialog?.querySelector("[data-observatory-live]");
    if (live) setText(live, message);
  }

  function currentBalance() {
    try {
      return Math.max(0, Math.floor(Number(settings.getBalance?.() ?? settings.balance) || 0));
    } catch {
      return 0;
    }
  }

  function clearPurchaseConfirmation() {
    armedPurchaseId = "";
  }

  function callPreview(loadout, meta) {
    try {
      settings.onPreview?.({ ...loadout }, meta);
    } catch {
      announce("Preview could not be shown.");
    }
  }

  function showDialog() {
    if (!dialog) return;
    dialog.setAttribute("aria-hidden", "false");
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else dialog.setAttribute("open", "");
  }

  function presentPreviewExternally() {
    if (typeof settings.onPresentPreview !== "function" || !dialog?.hasAttribute("open")) return false;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    dialog.setAttribute("aria-hidden", "true");
    previewSuspended = true;
    try {
      const presented = settings.onPresentPreview({
        loadout: { ...previewLoadout },
        meta: { ...previewMeta },
        surface: previewSurface
      });
      if (presented !== false) return true;
    } catch {
      // Fall back to the self-contained theater when the host cannot present.
    }
    previewSuspended = false;
    showDialog();
    return false;
  }

  function preview(candidate, meta, focusKey = "") {
    if (committing) return;
    clearPurchaseConfirmation();
    previewLoadout = { ...candidate };
    previewMeta = meta;
    previewMode = true;
    previewSurface = observatoryPreviewSurface(meta);
    previewReturnFocusKey = focusKey;
    callPreview(previewLoadout, { ...meta, transient: true });
    if (presentPreviewExternally()) return;
    render(actionKey("preview-exit", "theater"));
    announce(`${meta.label} preview mode opened. Nothing has been equipped and gameplay is locked.`);
  }

  async function commit(candidate, meta, focusKey = "") {
    if (committing) return;
    clearPurchaseConfirmation();
    const model = makeModel();
    if (!observatoryLoadoutIsOwned(model, candidate)) {
      announce(`${meta.label} is available to preview, but is not unlocked.`);
      return;
    }
    committing = true;
    dialog?.setAttribute("aria-busy", "true");
    dialog?.querySelectorAll("[data-commit-control]").forEach((control) => {
      control.setAttribute("aria-disabled", "true");
    });
    let announcement = "";
    let nextFocusKey = focusKey;
    try {
      const persisted = await settings.onCommit?.({ ...candidate }, meta);
      const committedLoadout = asRecord(persisted) ? configuredLoadout(persisted) : { ...candidate };
      baseLoadout = committedLoadout;
      previewLoadout = { ...committedLoadout };
      previewMeta = null;
      previewMode = false;
      previewSuspended = false;
      previewReturnFocusKey = "";
      callPreview(baseLoadout, { ...meta, transient: false, committed: true });
      nextFocusKey = focusKeyAfterCommit(meta, focusKey);
      announcement = loadoutsEqual(committedLoadout, candidate)
        ? `${meta.label} equipped.`
        : "Your available cosmetic look was restored.";
    } catch {
      announcement = "That cosmetic could not be equipped. Your previous look is still active.";
    } finally {
      committing = false;
      dialog?.removeAttribute("aria-busy");
      render(nextFocusKey);
      announce(announcement);
    }
  }

  async function commitProfileFrame(candidate, meta, focusKey = "") {
    if (committing) return;
    clearPurchaseConfirmation();
    const requestedSlug = configuredProfileFrame(candidate);
    committing = true;
    dialog?.setAttribute("aria-busy", "true");
    dialog?.querySelectorAll("[data-commit-control]").forEach((control) => {
      control.setAttribute("aria-disabled", "true");
    });
    let announcement = "";
    try {
      const persisted = await settings.onProfileFrameCommit?.(requestedSlug, meta);
      equippedProfileFrame = persisted === undefined
        ? requestedSlug
        : configuredProfileFrame(persisted);
      stagedProfileFrame = equippedProfileFrame;
      previewMeta = null;
      carouselSelectionByCategory.set(
        PROFILE_FRAME_CATEGORY,
        equippedProfileFrame || PROFILE_FRAME_NONE_ID
      );
      announcement = equippedProfileFrame
        ? `${meta.label} equipped for Scramble Arena.`
        : "The Arena frame was removed.";
    } catch {
      stagedProfileFrame = equippedProfileFrame;
      announcement = "That profile frame could not be equipped. Your previous frame is still active.";
    } finally {
      committing = false;
      dialog?.removeAttribute("aria-busy");
      render(focusKeyAfterCommit(meta, focusKey));
      announce(announcement);
    }
  }

  async function purchase(collection, focusKey = "") {
    if (committing || !collection.creditPrice || typeof settings.onPurchase !== "function") return;
    if (currentBalance() < collection.creditPrice) {
      const shortfall = collection.creditPrice - currentBalance();
      clearPurchaseConfirmation();
      render(focusKey);
      announce(`You need ${shortfall.toLocaleString()} more Star Credits to unlock ${collection.label}.`);
      return;
    }
    const confirmation = observatoryPurchaseStep(armedPurchaseId, collection.id);
    armedPurchaseId = confirmation.armedCollectionId;
    if (confirmation.action !== "confirm") {
      const value = observatoryCollectionValue(collection);
      render(focusKey);
      announce(`Confirm ${collection.label} for ${value}. Activate Confirm purchase to spend exactly ${value}.`);
      return;
    }
    committing = true;
    dialog?.setAttribute("aria-busy", "true");
    render(focusKey);
    let unlocked = false;
    let message = "";
    try {
      await settings.onPurchase(collection);
      unlocked = true;
    } catch (error) {
      message = asText(error?.message, `${collection.label} could not be unlocked.`);
    } finally {
      committing = false;
      dialog?.removeAttribute("aria-busy");
    }
    if (unlocked) {
      await commit(
        collection.loadout,
        { type: "collection", id: collection.id, label: collection.label, purchased: true },
        focusKeyAfterCommit({ type: "collection", id: collection.id }, focusKey)
      );
    } else {
      render(focusKey);
      announce(message);
    }
  }

  function revertTransient() {
    clearPurchaseConfirmation();
    const changed = !loadoutsEqual(previewLoadout, baseLoadout);
    const frameChanged = stagedProfileFrame !== equippedProfileFrame;
    previewMode = false;
    previewSuspended = false;
    previewSurface = PREVIEW_SURFACES[0];
    previewReturnFocusKey = "";
    previewLoadout = { ...baseLoadout };
    previewMeta = null;
    if (changed) callPreview(baseLoadout, { reason: "revert", transient: false });
    stagedProfileFrame = equippedProfileFrame;
    if (frameChanged) {
      carouselSelectionByCategory.set(
        PROFILE_FRAME_CATEGORY,
        equippedProfileFrame || PROFILE_FRAME_NONE_ID
      );
    }
  }

  function stopProfileFramePreviewMedia(root = dialog) {
    for (const video of root?.querySelectorAll?.("[data-profile-frame-preview-video]") || []) {
      try {
        video.pause?.();
        video.removeAttribute("src");
        video.load?.();
      } catch {
        // Detached preview media is disposable; the static frame remains available.
      }
    }
  }

  function close(reason = "close") {
    if (!dialog || (!dialog.hasAttribute("open") && !previewSuspended)) return;
    if (committing) {
      announce("Finishing your cosmetic change before closing.");
      return;
    }
    stopProfileFramePreviewMedia();
    clearPurchaseConfirmation();
    if (previewSuspended) {
      try {
        settings.onDismissPreview?.({ reason });
      } catch { /* The canonical presentation is restored below. */ }
    }
    revertTransient();
    if (dialog.hasAttribute("open")) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
    dialog.setAttribute("aria-hidden", "true");
    settings.onClose?.({ reason, loadout: { ...baseLoadout } });
    const focusTarget = returnFocus;
    returnFocus = null;
    const scheduleFocus = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (callback) => setTimeout(callback, 0);
    scheduleFocus(() => {
      if (focusTarget?.isConnected && typeof focusTarget.focus === "function") focusTarget.focus();
    });
  }

  function badgeNode(label) {
    const node = element("span", `cosmetics-observatory__badge is-${label.toLowerCase().replaceAll(" ", "-")}`, label);
    node.setAttribute("aria-label", `Access: ${label}`);
    return node;
  }

  function statePills({ owned, equipped, previewed }) {
    const list = element("div", "cosmetics-observatory__states");
    if (equipped) list.append(element("span", "cosmetics-observatory__state is-equipped", "Equipped"));
    if (previewed && !equipped) list.append(element("span", "cosmetics-observatory__state is-preview", "Preview"));
    list.append(element("span", `cosmetics-observatory__state ${owned ? "is-owned" : "is-locked"}`, owned ? "Owned" : "Locked"));
    return list;
  }

  function visualNode(tone, kind = "piece", item = null) {
    const safeKind = visualKind(kind);
    const visual = element("div", `cosmetics-observatory__card-visual is-${safeTone(tone)} is-${safeKind}`);
    visual.setAttribute("aria-hidden", "true");
    visual.dataset.previewKind = safeKind;
    applyPreviewImage(visual, item);
    visual.append(
      element("i", "cosmetics-observatory__visual-star"),
      element("i", "cosmetics-observatory__visual-line"),
      element("i", "cosmetics-observatory__visual-plaque"),
      element("i", "cosmetics-observatory__visual-detail"),
      element("span", "cosmetics-observatory__visual-label", asText(item?.label, safeKind.replaceAll("-", " ")))
    );
    return visual;
  }

  function markFocusKey(node, key) {
    node.dataset.focusKey = key;
    return node;
  }

  function collectionCard(collection, model, headingTag = "h3") {
    const state = observatorySelectionState({
      candidate: collection.loadout,
      currentLoadout: baseLoadout,
      previewLoadout,
      slotOrder: model.slots,
      owned: collection.owned
    });
    const card = element(
      "article",
      `cosmetics-observatory__card is-${collection.tone} is-${collection.presentation}`
    );
    card.dataset.collectionId = collection.id;
    card.dataset.collectionFamily = collection.collectionFamily;
    if (collection.styleLabel) card.dataset.styleLabel = collection.styleLabel;
    card.dataset.presentation = collection.presentation;
    card.dataset.presentationTier = collection.tier;
    card.dataset.collectionTier = collection.tier;
    card.dataset.creditPrice = String(collection.creditPrice);
    const acquisition = asText(collection.acquisition, collection.purchaseOnly
      ? "purchase-only"
      : collection.rankUnlock
        ? "purchase-or-rank"
        : collection.badge === "Free"
          ? "included"
          : "entitlement");
    card.dataset.acquisition = acquisition;
    card.dataset.unlockPolicy = acquisition;
    if (collection.rankUnlock?.id) card.dataset.unlockRank = collection.rankUnlock.id;
    if (state.equipped) card.dataset.equipped = "true";
    if (state.previewed) card.dataset.previewed = "true";

    const representative = itemForSlots(
      model,
      collection.loadout,
      ["homeScene", "gateStyle", "boardFinish", "wordPlaque"]
    );
    card.append(visualNode(collection.tone, "collection", representative));
    const body = element("div", "cosmetics-observatory__card-body");
    const eyebrow = element("div", "cosmetics-observatory__card-eyebrow");
    eyebrow.append(badgeNode(collection.badge), statePills(state));
    body.append(eyebrow);
    if (collection.styleLabel) {
      body.append(element("p", "cosmetics-observatory__card-style", collection.styleLabel));
    }
    const heading = element(headingTag, "cosmetics-observatory__card-title", collection.label);
    body.append(heading, element("p", "cosmetics-observatory__card-copy", collection.description));
    const pieceCount = Object.values(collection.loadout).filter(Boolean).length;
    const facts = element("div", "cosmetics-observatory__collection-facts");
    const tierFact = element("span", "cosmetics-observatory__collection-fact is-tier");
    tierFact.append(
      element("small", "", "Style tier"),
      element("strong", "", collection.tier)
    );
    const kitFact = element("span", "cosmetics-observatory__collection-fact is-kit");
    kitFact.append(
      element("small", "", "Collection size"),
      element("strong", "", `${pieceCount} pieces`)
    );
    facts.append(
      tierFact,
      kitFact,
      element(
        "span",
        "cosmetics-observatory__collection-fact is-background",
        "Home background included"
      )
    );
    const priceFact = element("span", "cosmetics-observatory__collection-fact is-price");
    priceFact.append(
      element("small", "", "Star Credit value"),
      element("strong", "", observatoryCollectionValue(collection))
    );
    facts.append(priceFact);

    const includedSlots = element("ul", "cosmetics-observatory__included-slots");
    includedSlots.setAttribute("aria-label", "Included cosmetic slots");
    for (const slot of model.slots) {
      if (!collection.loadout[slot]) continue;
      includedSlots.append(element("li", "", COLLECTION_SLOT_CHIPS[slot] || model.slotLabels[slot] || slot));
    }
    body.append(facts, includedSlots);

    const actions = element("div", "cosmetics-observatory__card-actions");
    const previewKey = actionKey("preview-collection", collection.id);
    actions.append(markFocusKey(button(
      "cosmetics-observatory__button is-secondary",
      state.previewed && !state.equipped ? "Previewing" : "Preview collection",
      () => preview(collection.loadout, { type: "collection", id: collection.id, label: collection.label }, previewKey)
    ), previewKey));

    if (collection.owned) {
      const equipKey = actionKey("equip-collection", collection.id);
      const equip = markFocusKey(button(
        "cosmetics-observatory__button is-primary",
        state.equipped ? "Collection equipped" : "Equip collection",
        () => commit(collection.loadout, { type: "collection", id: collection.id, label: collection.label }, equipKey)
      ), equipKey);
      equip.disabled = state.equipped || committing;
      equip.dataset.commitControl = "";
      actions.append(equip);
    } else if (collection.creditPrice > 0) {
      if (collection.creditPrice > 0 && typeof settings.onPurchase === "function") {
        const purchaseKey = actionKey("purchase-collection", collection.id);
        const balance = currentBalance();
        const affordable = balance >= collection.creditPrice;
        const shortfall = Math.max(0, collection.creditPrice - balance);
        const purchaseArmed = armedPurchaseId === collection.id;
        const purchaseValue = observatoryCollectionValue(collection);
        const purchaseButton = markFocusKey(button(
          "cosmetics-observatory__button is-primary is-purchase",
          purchaseArmed
            ? `Confirm ${purchaseValue}`
            : affordable
              ? `Unlock for ${purchaseValue}`
              : `Need ${shortfall.toLocaleString("en-US")} more credits`,
          () => purchase(collection, purchaseKey)
        ), purchaseKey);
        purchaseButton.disabled = !affordable || committing;
        purchaseButton.dataset.purchaseControl = "";
        purchaseButton.dataset.confirmArmed = String(purchaseArmed);
        purchaseButton.setAttribute(
          "aria-label",
          purchaseArmed
            ? `Confirm purchase of ${collection.label} for ${purchaseValue}`
            : affordable
              ? `Unlock ${collection.label} for ${purchaseValue}`
              : `Need ${shortfall.toLocaleString("en-US")} more Star Credits to unlock ${collection.label}`
        );
        actions.append(purchaseButton);
      }
      actions.append(button(
        "cosmetics-observatory__button is-supporter",
        "Included with Supporter",
        () => settings.onSupporter?.(collection)
      ));
    }
    if (!collection.owned && collection.unlockHint) {
      body.append(element("p", "cosmetics-observatory__unlock-hint", collection.unlockHint));
    }
    body.append(actions);
    card.append(body);
    return card;
  }

  function pieceCard(item, model) {
    const candidate = calculatePieceLoadout(baseLoadout, item);
    const previewCandidate = calculatePiecePreviewLoadout(baseLoadout, item);
    const equipped = baseLoadout[item.slot] === item.id;
    const previewed = previewLoadout[item.slot] === item.id;
    const state = { owned: item.owned, equipped, previewed };
    const card = element("article", `cosmetics-observatory__card is-piece is-${item.tone}`);
    card.dataset.itemId = item.id;
    if (equipped) card.dataset.equipped = "true";
    if (previewed) card.dataset.previewed = "true";
    card.append(visualNode(item.tone, item.slot, item));

    const body = element("div", "cosmetics-observatory__card-body");
    const eyebrow = element("div", "cosmetics-observatory__card-eyebrow");
    eyebrow.append(badgeNode(item.badge), statePills(state));
    body.append(
      eyebrow,
      element("h3", "cosmetics-observatory__card-title", item.label),
      element("p", "cosmetics-observatory__card-copy", item.description)
    );

    const actions = element("div", "cosmetics-observatory__card-actions");
    const previewKey = actionKey("preview-piece", item.id);
    actions.append(markFocusKey(button(
      "cosmetics-observatory__button is-secondary",
      previewed && !equipped ? "Previewing" : "Preview piece",
      () => preview(previewCandidate, { type: "piece", id: item.id, slot: item.slot, label: item.label }, previewKey)
    ), previewKey));

    if (item.slot === "soundTheme" || item.slot === "sound") {
      const soundButton = button(
        "cosmetics-observatory__icon-button",
        "Play sample",
        () => settings.onSoundPreview?.(item)
      );
      soundButton.setAttribute("aria-label", `Play ${item.label} sound sample`);
      actions.append(soundButton);
    }

    if (item.owned) {
      const equipKey = actionKey("equip-piece", item.id);
      const equip = markFocusKey(button(
        "cosmetics-observatory__button is-primary",
        equipped ? "Piece equipped" : "Equip piece",
        () => commit(candidate, { type: "piece", id: item.id, slot: item.slot, label: item.label }, equipKey)
      ), equipKey);
      equip.disabled = equipped || committing;
      equip.dataset.commitControl = "";
      actions.append(equip);
    } else if (item.access === "supporter" || item.entitlement === "supporter") {
      actions.append(button(
        "cosmetics-observatory__button is-supporter",
        "Supporter options",
        () => settings.onSupporter?.(item)
      ));
    }
    if (!item.owned && item.unlockHint) {
      body.append(element("p", "cosmetics-observatory__unlock-hint", item.unlockHint));
    }
    body.append(actions);
    card.append(body);
    return card;
  }

  function previewSurfaceTabs() {
    const nav = element("div", "cosmetics-observatory__preview-surfaces");
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", "Preview surface");
    const labels = {
      board: "Board",
      home: "Home",
      gate: "Constellation Fold",
      menu: "Menu",
      sound: "Sound"
    };
    for (const surface of PREVIEW_SURFACES) {
      const control = button("cosmetics-observatory__preview-surface", labels[surface], () => {
        previewSurface = surface;
        render(actionKey("preview-surface", surface));
        announce(`${labels[surface]} cosmetic preview shown.`);
      });
      control.id = `cosmetics-preview-surface-${surface}`;
      control.dataset.surface = surface;
      control.setAttribute("role", "tab");
      control.setAttribute("aria-selected", String(previewSurface === surface));
      control.setAttribute("aria-controls", "cosmetics-preview-surface-panel");
      control.tabIndex = previewSurface === surface ? 0 : -1;
      markFocusKey(control, actionKey("preview-surface", surface));
      nav.append(control);
    }
    return nav;
  }

  function boardPreview(model, { immersive = false } = {}) {
    const overallTone = selectedTone(model, previewLoadout);
    const boardTone = toneForSlots(model, previewLoadout, ["boardFinish", "boardScene", "board"], overallTone);
    const plaqueTone = toneForSlots(model, previewLoadout, ["wordPlaque"], overallTone);
    const trailTone = toneForSlots(model, previewLoadout, ["trailSet", "trail"], overallTone);
    const sky = element("div", `cosmetics-observatory__mini-board is-${boardTone}${immersive ? " is-immersive" : ""}`);
    sky.setAttribute("aria-label", "Live cosmetic preview board");
    sky.setAttribute("role", "img");
    const constellation = element("div", "cosmetics-observatory__mini-constellation");
    const words = ["STARS", "MAP", "LIGHT"];
    for (const word of words) constellation.append(element("span", `cosmetics-observatory__mini-plaque is-${plaqueTone}`, word));
    constellation.append(element("i", `cosmetics-observatory__mini-trail is-${trailTone}`));
    sky.append(constellation);
    return sky;
  }

  function scenePreview(model, slot, title, { immersive = false } = {}) {
    const item = itemForSlots(model, previewLoadout, [slot]);
    const pane = element(
      "div",
      `cosmetics-observatory__scene-preview is-${visualKind(slot)} is-${safeTone(item?.tone)}${immersive ? " is-immersive" : ""}`
    );
    pane.dataset.surface = slot === "homeScene" ? "home" : "gate";
    pane.setAttribute("role", "img");
    pane.setAttribute("aria-label", `${title} preview: ${asText(item?.label, "default look")}`);
    applyPreviewImage(pane, item, immersive ? "md" : "sm");
    const label = element("span", "cosmetics-observatory__scene-label");
    label.append(
      element("small", "", title),
      element("strong", "", asText(item?.label, "Default look"))
    );
    pane.append(element("i", "cosmetics-observatory__scene-seam"), label);
    return pane;
  }

  function menuPreview(model) {
    const item = itemForSlots(model, previewLoadout, ["uiFinish", "theme"]);
    const tone = safeTone(item?.tone || selectedTone(model, previewLoadout));
    const panel = element("div", `cosmetics-observatory__menu-preview is-${tone}`);
    panel.setAttribute("role", "img");
    panel.setAttribute("aria-label", `Interface style preview: ${asText(item?.label, "default look")}`);
    const sample = element("div", "cosmetics-observatory__menu-sample");
    sample.append(
      element("p", "cosmetics-observatory__kicker", "Choose your orbit"),
      element("h3", "", asText(item?.label, "Default look")),
      element("p", "", "Buttons, panels, borders, and highlights use this finish.")
    );
    const actions = element("div", "cosmetics-observatory__menu-actions");
    actions.append(
      element("span", "cosmetics-observatory__menu-button is-primary", "Enter"),
      element("span", "cosmetics-observatory__menu-button", "Explore")
    );
    sample.append(actions);
    panel.append(sample);
    return panel;
  }

  function soundPreview(model) {
    const item = itemForSlots(model, previewLoadout, ["soundTheme", "sound"]);
    const tone = safeTone(item?.tone || selectedTone(model, previewLoadout));
    const panel = element("div", `cosmetics-observatory__sound-preview is-${tone}`);
    const glyph = element("span", "cosmetics-observatory__sound-glyph", "♪");
    glyph.setAttribute("aria-hidden", "true");
    const copy = element("div");
    copy.append(
      element("p", "cosmetics-observatory__kicker", "Sound theme"),
      element("h3", "", asText(item?.label, "Default sound")),
      element("p", "", "Hear a short preview-only sample. Your equipped sound returns when previewing ends.")
    );
    panel.append(glyph, copy);
    if (item && typeof settings.onSoundPreview === "function") {
      const sample = button("cosmetics-observatory__button is-primary", "Play sample", () => {
        settings.onSoundPreview?.(item);
        announce(`${item.label} sound sample playing.`);
      });
      sample.setAttribute("aria-label", `Play ${item.label} sound sample`);
      panel.append(sample);
    }
    return panel;
  }

  function previewPanel(model, { immersive = false } = {}) {
    const overallTone = selectedTone(model, previewLoadout);
    const loadoutSummary = observatoryLoadoutSummary(model, previewLoadout, previewLoadout);
    const section = element(
      "section",
      `cosmetics-observatory__preview is-${overallTone}${immersive ? " is-immersive" : ""}`
    );
    section.setAttribute("aria-labelledby", "cosmetics-preview-title");
    const headingRow = element("div", "cosmetics-observatory__preview-heading");
    const titles = element("div");
    const kicker = element("p", "cosmetics-observatory__kicker", immersive ? "Preview mode" : "Live look");
    const title = element(
      "h2",
      "",
      immersive
        ? asText(previewMeta?.label, "Cosmetic preview")
        : asText(previewMeta?.label, loadoutSummary.label)
    );
    title.id = "cosmetics-preview-title";
    titles.append(kicker, title);
    headingRow.append(titles, element("span", "cosmetics-observatory__preview-rank", "Rank sky · Wayfinder"));

    const sceneSplit = element("div", "cosmetics-observatory__scene-split");
    sceneSplit.setAttribute("aria-label", "Home background and Constellation Fold previews");
    sceneSplit.append(
      scenePreview(model, "homeScene", "Home background"),
      scenePreview(model, "gateStyle", "Constellation Fold")
    );

    const caption = element(
      "p",
      "cosmetics-observatory__preview-caption",
      previewMeta
        ? `${previewMeta.label} is staged. Nothing is equipped, and gameplay stays locked in preview mode.`
        : "The rank sky remains the foundation beneath every board finish."
    );
    section.append(headingRow);
    if (immersive) {
      section.append(previewSurfaceTabs());
      const panel = element("div", "cosmetics-observatory__preview-surface-panel");
      panel.id = "cosmetics-preview-surface-panel";
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", `cosmetics-preview-surface-${previewSurface}`);
      if (previewSurface === "home") panel.append(scenePreview(model, "homeScene", "Home background", { immersive: true }));
      else if (previewSurface === "gate") panel.append(scenePreview(model, "gateStyle", "Constellation Fold", { immersive: true }));
      else if (previewSurface === "menu") panel.append(menuPreview(model));
      else if (previewSurface === "sound") panel.append(soundPreview(model));
      else panel.append(boardPreview(model, { immersive: true }));
      section.append(panel);
    } else {
      section.append(boardPreview(model), sceneSplit);
    }
    section.append(caption);
    return section;
  }

  function equippedLoadoutNode(model) {
    const summary = observatoryLoadoutSummary(model, baseLoadout, previewLoadout);
    const section = element("section", "cosmetics-observatory__loadout");
    section.setAttribute("aria-labelledby", "cosmetics-loadout-title");
    section.dataset.staged = String(summary.staged);

    const header = element("header", "cosmetics-observatory__loadout-heading");
    const copy = element("div");
    copy.append(
      element("p", "cosmetics-observatory__kicker", "Equipped look"),
      element("h3", "", summary.label)
    );
    copy.querySelector("h3").id = "cosmetics-loadout-title";
    const state = element(
      "span",
      `cosmetics-observatory__loadout-state${summary.staged ? " is-staged" : ""}`,
      summary.staged ? "Preview staged" : "Equipped now"
    );
    header.append(copy, state);

    const grid = element("div", "cosmetics-observatory__loadout-grid");
    grid.setAttribute("aria-label", "Currently equipped cosmetic pieces");
    for (const slot of summary.slots) {
      const control = button(
        `cosmetics-observatory__loadout-slot is-${slot.itemTone}${slot.staged ? " is-staged" : ""}`,
        "",
        () => {
          clearPurchaseConfirmation();
          activeTab = "pieces";
          ownedOnly = true;
          selectedSlot = slot.slot;
          render(actionKey("slot", slot.slot));
          announce(`${slot.slotLabel} inventory opened. ${slot.ownedOptions} owned options available.`);
        }
      );
      control.dataset.slot = slot.slot;
      control.setAttribute(
        "aria-label",
        `Change ${slot.slotLabel}. Equipped: ${slot.itemLabel}. ${slot.ownedOptions} owned options.`
      );
      control.append(
        element("small", "", slot.slotLabel),
        element("strong", "", slot.itemLabel),
        element(
          "span",
          "",
          slot.staged ? `Preview: ${slot.stagedItemLabel}` : `${slot.ownedOptions} owned · Change`
        )
      );
      grid.append(control);
    }
    section.append(header, grid);
    return section;
  }

  function effectControls() {
    const fieldset = element("fieldset", "cosmetics-observatory__effects");
    const legend = element("legend", "", "Effects");
    const group = element("div", "cosmetics-observatory__segment");
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", "Cosmetic effects intensity");
    group.setAttribute("aria-orientation", "horizontal");
    for (const mode of EFFECT_MODES) {
      const label = mode[0].toUpperCase() + mode.slice(1);
      const control = button("cosmetics-observatory__segment-button", label, () => {
        if (committing) return;
        clearPurchaseConfirmation();
        effects = mode;
        dialog.dataset.effects = mode;
        settings.onEffectsChange?.(mode);
        render(actionKey("effect", mode));
        announce(`Cosmetic effects set to ${label}.`);
      });
      control.setAttribute("role", "radio");
      control.setAttribute("aria-checked", String(effects === mode));
      control.tabIndex = effects === mode ? 0 : -1;
      control.dataset.mode = mode;
      markFocusKey(control, actionKey("effect", mode));
      group.append(control);
    }
    fieldset.append(legend, group);
    return fieldset;
  }

  function browserToolbar(model) {
    const toolbar = element("div", "cosmetics-observatory__browser-toolbar");
    const nav = element("div", "cosmetics-observatory__tabs");
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", "Cosmetics browser");
    const labels = { collections: "Collections", pieces: "Pieces" };
    for (const tab of BROWSER_TABS) {
      const control = button("cosmetics-observatory__tab", labels[tab], () => {
        clearPurchaseConfirmation();
        activeTab = tab;
        render(actionKey("tab", tab));
      });
      control.id = `cosmetics-tab-${tab}`;
      control.dataset.tab = tab;
      control.setAttribute("role", "tab");
      control.setAttribute("aria-selected", String(activeTab === tab));
      control.setAttribute("aria-controls", "cosmetics-observatory-panel");
      control.tabIndex = activeTab === tab ? 0 : -1;
      markFocusKey(control, actionKey("tab", tab));
      nav.append(control);
    }

    const ownedCount = model.items.filter((item) => item.owned).length;
    const ownedToggle = button("cosmetics-observatory__owned-toggle", "", () => {
      clearPurchaseConfirmation();
      ownedOnly = !ownedOnly;
      render(actionKey("filter", "owned"));
      announce(ownedOnly
        ? `Showing owned inventory only. ${ownedCount} of ${model.items.length} pieces unlocked.`
        : "Showing all cosmetics, including locked previews.");
    });
    ownedToggle.setAttribute("role", "switch");
    ownedToggle.setAttribute("aria-checked", String(ownedOnly));
    ownedToggle.setAttribute(
      "aria-label",
      `${ownedOnly ? "Show all cosmetics" : "Show owned cosmetics only"}. ${ownedCount} of ${model.items.length} pieces unlocked.`
    );
    markFocusKey(ownedToggle, actionKey("filter", "owned"));
    ownedToggle.append(
      element("i", "cosmetics-observatory__owned-toggle-track"),
      element("span", "", "Owned only"),
      element("small", "", `${ownedCount}/${model.items.length}`)
    );
    toolbar.append(nav, ownedToggle);
    return toolbar;
  }

  function activeCarouselCategory(model) {
    if (activeTab === "collections") return "collections";
    if (activeTab === PROFILE_FRAME_CATEGORY) return PROFILE_FRAME_CATEGORY;
    if (model.slots.includes(selectedSlot)) return selectedSlot;
    selectedSlot = model.slots[0] || "";
    return selectedSlot || "collections";
  }

  function carouselCategoryLabel(model, category, { short = false } = {}) {
    if (category === "collections") return short ? "Kits" : "Collections";
    if (category === PROFILE_FRAME_CATEGORY) return short ? "Frames" : "Arena frames";
    const shortLabels = {
      wordPlaque: "Words",
      trailSet: "Trails",
      boardFinish: "Board",
      boardScene: "Board",
      homeScene: "Home",
      gateStyle: "Folds",
      uiFinish: "Interface",
      soundTheme: "Sound",
      theme: "Interface",
      board: "Board",
      trail: "Trails",
      sound: "Sound"
    };
    return short ? (shortLabels[category] || model.slotLabels[category] || category) : (model.slotLabels[category] || category);
  }

  function carouselEntryForCollection(collection, model) {
    const representative = itemForSlots(
      model,
      collection.loadout,
      ["homeScene", "gateStyle", "boardFinish", "wordPlaque"]
    );
    return {
      type: "collection",
      id: collection.id,
      slot: "",
      label: collection.label,
      description: collection.description,
      tone: collection.tone,
      badge: collection.badge,
      owned: collection.owned,
      subject: collection,
      representative,
      previewCandidate: { ...collection.loadout },
      commitCandidate: { ...collection.loadout },
      meta: { type: "collection", id: collection.id, label: collection.label }
    };
  }

  function carouselEntryForItem(item) {
    return {
      type: "piece",
      id: item.id,
      slot: item.slot,
      label: item.label,
      description: item.description,
      tone: item.tone,
      badge: item.badge,
      owned: item.owned,
      subject: item,
      representative: item,
      previewCandidate: calculatePiecePreviewLoadout(baseLoadout, item),
      commitCandidate: calculatePieceLoadout(baseLoadout, item),
      meta: { type: "piece", id: item.id, slot: item.slot, label: item.label }
    };
  }

  function carouselEntryForProfileFrame(entry) {
    if (!entry) {
      return {
        type: "profile-frame",
        id: PROFILE_FRAME_NONE_ID,
        slot: PROFILE_FRAME_CATEGORY,
        frameSlug: "",
        label: "No frame",
        description: "Enter Scramble Arena with a clean, undecorated Duel Card.",
        tone: "celestial",
        badge: "Option",
        owned: true,
        subject: null,
        representative: null,
        meta: { type: "profile-frame", id: PROFILE_FRAME_NONE_ID, slug: "", label: "No frame" }
      };
    }
    return {
      type: "profile-frame",
      id: entry.slug,
      slot: PROFILE_FRAME_CATEGORY,
      frameSlug: entry.slug,
      label: asText(entry.name, entry.slug),
      description: asText(entry.description, "An independent Scramble Arena Duel Card frame."),
      tone: safeTone(`${entry.slug} ${entry.epithet || ""}`),
      badge: entry.animated ? "Animated" : "Prototype",
      owned: true,
      subject: entry,
      representative: null,
      meta: {
        type: "profile-frame",
        id: entry.slug,
        slug: entry.slug,
        label: asText(entry.name, entry.slug)
      }
    };
  }

  function carouselEntries(model, category = activeCarouselCategory(model), { includeLocked = true } = {}) {
    if (category === PROFILE_FRAME_CATEGORY) {
      return [
        carouselEntryForProfileFrame(null),
        ...profileFrameCatalog().map(carouselEntryForProfileFrame)
      ];
    }
    if (category === "collections") {
      return model.collections
        .filter((collection) => includeLocked || collection.owned)
        .map((collection) => carouselEntryForCollection(collection, model));
    }
    return model.items
      .filter((item) => item.slot === category && (includeLocked || item.owned))
      .map(carouselEntryForItem);
  }

  function carouselEntryIsEquipped(entry, model) {
    if (!entry) return false;
    if (entry.type === "profile-frame") {
      return entry.frameSlug === equippedProfileFrame;
    }
    if (entry.type === "collection") {
      return loadoutsEqual(entry.commitCandidate, baseLoadout, model.slots);
    }
    return asText(baseLoadout[entry.slot]) === entry.id;
  }

  function resolveCarouselSelection(model, entries, category = activeCarouselCategory(model)) {
    if (!entries.length) {
      carouselSelectionByCategory.delete(category);
      return null;
    }
    const rememberedId = carouselSelectionByCategory.get(category);
    let selected = entries.find((entry) => entry.id === rememberedId);
    if (!selected) selected = entries.find((entry) => carouselEntryIsEquipped(entry, model));
    if (!selected && category === "collections") {
      const activeIds = new Set(Object.values(baseLoadout));
      selected = entries.find((entry) =>
        Object.values(entry.commitCandidate).filter(Boolean).some((id) => activeIds.has(id))
      );
    }
    if (!selected) selected = entries.find((entry) => entry.owned) || entries[0];
    carouselSelectionByCategory.set(category, selected.id);
    return selected;
  }

  function carouselParentCollection(model, entry) {
    if (!entry) return null;
    if (entry.type === "profile-frame") return null;
    if (entry.type === "collection") return entry.subject;
    return model.collections.find((collection) => collection.id === entry.subject.collectionId) || null;
  }

  function carouselAccessState(model, entry, equipped = carouselEntryIsEquipped(entry, model)) {
    if (equipped) {
      return {
        key: "equipped",
        shortLabel: "Equipped",
        accessibleLabel: "Equipped."
      };
    }
    if (entry.owned) {
      return {
        key: "owned",
        shortLabel: "Owned",
        accessibleLabel: "Owned."
      };
    }

    const parentCollection = carouselParentCollection(model, entry);
    const accessSubject = entry.type === "collection" ? entry.subject : (parentCollection || entry.subject);
    const price = Math.max(0, Math.floor(Number(accessSubject?.creditPrice) || 0));
    const rankName = asText(accessSubject?.rankUnlock?.name);
    const acquisition = asText(accessSubject?.acquisition).toLowerCase();

    if (accessSubject?.purchaseOnly === true || acquisition === "purchase-only") {
      return {
        key: "purchase",
        shortLabel: price ? `Purchase only · ${price.toLocaleString("en-US")}` : "Purchase only",
        accessibleLabel: price
          ? `Locked. Purchase for ${price.toLocaleString("en-US")} Star Credits.`
          : "Locked. Purchase only."
      };
    }
    if (rankName || accessSubject?.rankUnlock || acquisition === "purchase-or-rank") {
      return {
        key: "rank",
        shortLabel: `${rankName || "Rank"}${price ? ` · ${price.toLocaleString("en-US")}` : ""}`,
        accessibleLabel: rankName && price
          ? `Locked. Unlock at ${rankName} Route Rank or purchase for ${price.toLocaleString("en-US")} Star Credits.`
          : rankName
            ? `Locked. Unlock at ${rankName} Route Rank.`
            : price
              ? `Locked. Reach the required rank or purchase for ${price.toLocaleString("en-US")} Star Credits.`
              : "Locked. Reach the required Route Rank."
      };
    }
    if (acquisition === "event" || entry.badge === "Event") {
      return {
        key: "event",
        shortLabel: "Event unlock",
        accessibleLabel: "Locked. Event unlock."
      };
    }
    return {
      key: "locked",
      shortLabel: "Locked",
      accessibleLabel: "Locked."
    };
  }

  function carouselStateIcon(state) {
    const mark = element("span", `cosmetics-observatory__carousel-state-mark is-${state.key}`);
    mark.setAttribute("aria-hidden", "true");
    mark.dataset.ownershipIcon = state.key;
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("focusable", "false");

    const path = document.createElementNS(namespace, "path");
    if (state.key === "equipped" || state.key === "owned") {
      path.setAttribute("d", "M5.5 12.5 9.5 16.5 18.5 7.5");
    } else if (state.key === "rank") {
      path.setAttribute("d", "m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z");
    } else if (state.key === "purchase") {
      path.setAttribute("d", "M12 5v14m3.5-11.5H10a2.5 2.5 0 0 0 0 5h4a2.5 2.5 0 0 1 0 5H8.5");
    } else if (state.key === "event") {
      path.setAttribute("d", "M6 5h12v14H6zM8 3v4m8-4v4M6 9h12m-8 4h4");
    } else {
      path.setAttribute("d", "M7.5 10V8a4.5 4.5 0 0 1 9 0v2m-10 0h11v9h-11z");
    }
    svg.append(path);
    mark.append(svg);
    return mark;
  }

  function announceCarouselEntry(entry, index, total) {
    const access = entry.type === "profile-frame"
      ? "available"
      : entry.owned ? "owned" : "locked";
    announce(`${entry.label}, ${index + 1} of ${total}, ${access}.`);
  }

  function stageCarouselEntry(model, entry, focusKey = "", { announceSelection = true } = {}) {
    if (!entry || committing) return;
    clearPurchaseConfirmation();
    const category = activeCarouselCategory(model);
    carouselSelectionByCategory.set(category, entry.id);
    if (entry.type === "profile-frame") {
      const cosmeticChanged = !loadoutsEqual(previewLoadout, baseLoadout, model.slots);
      if (cosmeticChanged) callPreview(baseLoadout, { reason: "frame-preview", transient: false });
      previewLoadout = { ...baseLoadout };
      previewMeta = { ...entry.meta };
      stagedProfileFrame = entry.frameSlug;
      previewMode = false;
      previewReturnFocusKey = focusKey;
      render(focusKey);
      if (announceSelection) {
        const entries = carouselEntries(model);
        const index = Math.max(0, entries.findIndex((candidate) => candidate.id === entry.id));
        announceCarouselEntry(entry, index, entries.length);
      }
      return;
    }
    previewLoadout = { ...entry.previewCandidate };
    previewMeta = { ...entry.meta };
    previewMode = false;
    previewSurface = observatoryPreviewSurface(entry.meta);
    previewReturnFocusKey = focusKey;
    callPreview(previewLoadout, { ...entry.meta, transient: true, carousel: true });
    render(focusKey);
    if (announceSelection) {
      const entries = carouselEntries(model);
      const index = Math.max(0, entries.findIndex((candidate) => candidate.id === entry.id));
      announceCarouselEntry(entry, index, entries.length);
    }
  }

  function selectCarouselIndex(model, index, focusKey = "") {
    const entries = carouselEntries(model);
    if (!entries.length) return;
    const nextIndex = Math.max(0, Math.min(entries.length - 1, index));
    const current = resolveCarouselSelection(model, entries);
    if (current?.id === entries[nextIndex].id) {
      announceCarouselEntry(entries[nextIndex], nextIndex, entries.length);
      return;
    }
    stageCarouselEntry(model, entries[nextIndex], focusKey);
  }

  function switchCarouselCategory(model, category, focusKey) {
    clearPurchaseConfirmation();
    activeTab = category === "collections"
      ? "collections"
      : category === PROFILE_FRAME_CATEGORY ? PROFILE_FRAME_CATEGORY : "pieces";
    selectedSlot = ["collections", PROFILE_FRAME_CATEGORY].includes(category) ? "" : category;
    const nextModel = makeModel();
    const entries = carouselEntries(nextModel, category);
    const selected = resolveCarouselSelection(nextModel, entries, category);
    if (selected) {
      stageCarouselEntry(nextModel, selected, focusKey);
      return;
    }
    revertTransient();
    render(focusKey);
    announce(`No ${carouselCategoryLabel(nextModel, category).toLowerCase()} are available in this view.`);
  }

  function carouselCategoryStrip(model) {
    const strip = element("div", "cosmetics-observatory__category-strip");
    const track = element("div", "cosmetics-observatory__category-track");
    track.setAttribute("role", "tablist");
    track.setAttribute("aria-label", "Cosmetic categories");
    const activeCategory = activeCarouselCategory(model);
    const categories = [
      "collections",
      ...(profileFrameCatalog().length ? [PROFILE_FRAME_CATEGORY] : []),
      ...model.slots
    ];

    for (const category of categories) {
      const label = carouselCategoryLabel(model, category, { short: true });
      const count = category === "collections"
        ? model.collections.length
        : category === PROFILE_FRAME_CATEGORY
          ? profileFrameCatalog().length
          : model.items.filter((item) => item.slot === category).length;
      const control = button("cosmetics-observatory__category-tab", "", () => {
        switchCarouselCategory(model, category, actionKey("category", category));
      });
      control.id = `cosmetics-category-${category}`;
      control.dataset.category = category;
      if (!["collections", PROFILE_FRAME_CATEGORY].includes(category)) control.dataset.slot = category;
      control.setAttribute("role", "tab");
      control.setAttribute("aria-selected", String(activeCategory === category));
      control.setAttribute("aria-controls", "cosmetics-observatory-carousel");
      control.setAttribute("aria-label", `${carouselCategoryLabel(model, category)}, ${count} choices`);
      control.tabIndex = activeCategory === category ? 0 : -1;
      markFocusKey(control, actionKey("category", category));
      control.append(
        element("span", "", label),
        element("small", "", String(count))
      );
      track.append(control);
    }

    const currentEntries = carouselEntries(model);
    const ownedCount = currentEntries.filter((entry) => entry.owned).length;
    const allCount = currentEntries.length;
    const inventorySummary = element("div", "cosmetics-observatory__inventory-summary");
    inventorySummary.setAttribute(
      "aria-label",
      `All ${allCount} choices are shown. ${ownedCount} owned.`
    );
    inventorySummary.append(
      element("span", "is-owned", `${ownedCount} owned`),
      element("span", "", `${allCount} total`)
    );
    const utilities = element("div", "cosmetics-observatory__category-utilities");
    utilities.append(inventorySummary, effectControls());
    strip.append(track, utilities);
    return strip;
  }

  function profileFrameThumbnailVisual(entry) {
    const visual = element(
      "span",
      `cosmetics-observatory__frame-thumb-visual${entry.frameSlug ? "" : " is-none"}`
    );
    const palette = Array.isArray(entry.subject?.palette) ? entry.subject.palette : [];
    palette.slice(0, 4).forEach((color, index) => {
      visual.style.setProperty(`--frame-color-${index + 1}`, color);
    });
    visual.append(
      element("i", "is-top"),
      element("i", "is-left"),
      element("i", "is-right"),
      element("span", "", entry.frameSlug ? "ARENA" : "NONE")
    );
    return visual;
  }

  function carouselThumbnail(entry, model, selected) {
    const equipped = carouselEntryIsEquipped(entry, model);
    const accessState = carouselAccessState(model, entry, equipped);
    const control = button(
      `cosmetics-observatory__carousel-thumb is-${entry.tone}`,
      "",
      () => stageCarouselEntry(model, entry, actionKey("carousel-option", entry.id))
    );
    control.setAttribute("role", "option");
    control.setAttribute("aria-selected", String(selected));
    control.tabIndex = selected ? 0 : -1;
    control.setAttribute(
      "aria-label",
      `${entry.label}. ${accessState.accessibleLabel}`
    );
    control.dataset.carouselOptionId = entry.id;
    control.dataset.owned = String(entry.owned);
    control.dataset.accessState = accessState.key;
    if (entry.type === "collection") control.dataset.collectionId = entry.id;
    else if (entry.type === "profile-frame") control.dataset.profileFrameSlug = entry.frameSlug;
    else control.dataset.itemId = entry.id;
    if (equipped) control.dataset.equipped = "true";
    markFocusKey(control, actionKey("carousel-option", entry.id));
    control.append(
      entry.type === "profile-frame"
        ? profileFrameThumbnailVisual(entry)
        : visualNode(entry.tone, entry.type === "collection" ? "collection" : entry.slot, entry.representative),
      carouselStateIcon(accessState)
    );
    const copy = element("span", "cosmetics-observatory__carousel-thumb-copy");
    copy.append(
      element("strong", "", entry.label),
      element("small", `is-${accessState.key}`, accessState.shortLabel)
    );
    control.append(copy);
    return control;
  }

  function carouselPreviewVisual(model, entry) {
    const visual = element("div", `cosmetics-observatory__carousel-visual is-${entry.tone}`);
    if (entry.type === "profile-frame") {
      const mount = element("div", "cosmetics-observatory__profile-frame-preview");
      let previewNode = null;
      try {
        const preview = settings.createProfileFramePreview?.(entry.frameSlug, entry.subject);
        previewNode = preview?.element || preview;
      } catch {
        previewNode = null;
      }
      if (previewNode?.nodeType) mount.append(previewNode);
      else mount.append(profileFrameThumbnailVisual(entry));
      visual.append(mount);
    } else if (entry.type === "collection") {
      visual.append(previewPanel(model));
    } else if (entry.slot === "homeScene") {
      visual.append(scenePreview(model, "homeScene", "Home background", { immersive: true }));
    } else if (entry.slot === "gateStyle") {
      visual.append(scenePreview(model, "gateStyle", "Constellation Fold", { immersive: true }));
    } else if (["uiFinish", "theme"].includes(entry.slot)) {
      visual.append(menuPreview(model));
    } else if (["soundTheme", "sound"].includes(entry.slot)) {
      visual.append(soundPreview(model));
    } else {
      visual.append(boardPreview(model, { immersive: true }));
    }
    return visual;
  }

  function bindCarouselSwipe(node, model, index, total) {
    let pointer = null;
    node.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button > 0 || event.target.closest("button, a, input, select, textarea")) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      node.setPointerCapture?.(event.pointerId);
    });
    node.addEventListener("pointercancel", () => {
      pointer = null;
    });
    node.addEventListener("pointerup", (event) => {
      if (!pointer || event.pointerId !== pointer.id) return;
      const deltaX = event.clientX - pointer.x;
      const deltaY = event.clientY - pointer.y;
      pointer = null;
      if (Math.abs(deltaX) < 42 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
      if (deltaX < 0 && index < total - 1) selectCarouselIndex(model, index + 1);
      else if (deltaX > 0 && index > 0) selectCarouselIndex(model, index - 1);
    });
  }

  function carouselFocusedPreview(model, entries, selected) {
    const index = entries.findIndex((entry) => entry.id === selected.id);
    const region = element("section", "cosmetics-observatory__carousel-focus");
    region.setAttribute("aria-label", `${carouselCategoryLabel(model, activeCarouselCategory(model))} preview carousel`);
    region.setAttribute("aria-roledescription", "carousel");

    const viewport = element("div", "cosmetics-observatory__carousel-viewport");
    viewport.dataset.carouselViewport = "";
    viewport.dataset.selectedId = selected.id;
    viewport.dataset.hasPrevious = String(index > 0);
    viewport.dataset.hasNext = String(index < entries.length - 1);

    const stage = element("div", "cosmetics-observatory__carousel-stage");
    stage.dataset.carouselStage = "";
    stage.dataset.selectedId = selected.id;
    stage.tabIndex = 0;
    stage.setAttribute("role", "group");
    stage.setAttribute("aria-roledescription", "slide");
    stage.setAttribute("aria-label", `${index + 1} of ${entries.length}: ${selected.label}`);
    markFocusKey(stage, actionKey("carousel-stage", "active"));
    stage.append(carouselPreviewVisual(model, selected));
    bindCarouselSwipe(stage, model, index, entries.length);

    const previous = markFocusKey(button(
      "cosmetics-observatory__carousel-arrow is-previous",
      "←",
      () => {
        if (index > 0) selectCarouselIndex(model, index - 1, actionKey("carousel-arrow", "previous"));
      }
    ), actionKey("carousel-arrow", "previous"));
    previous.setAttribute("aria-label", `Previous cosmetic${index > 0 ? `: ${entries[index - 1].label}` : ""}`);
    previous.setAttribute("aria-disabled", String(index === 0));

    const next = markFocusKey(button(
      "cosmetics-observatory__carousel-arrow is-next",
      "→",
      () => {
        if (index < entries.length - 1) selectCarouselIndex(model, index + 1, actionKey("carousel-arrow", "next"));
      }
    ), actionKey("carousel-arrow", "next"));
    next.setAttribute("aria-label", `Next cosmetic${index < entries.length - 1 ? `: ${entries[index + 1].label}` : ""}`);
    next.setAttribute("aria-disabled", String(index === entries.length - 1));

    viewport.append(stage, previous, next);
    const caption = element("div", "cosmetics-observatory__carousel-counter");
    const captionCopy = element("div");
    captionCopy.append(
      element("strong", "", selected.label),
      element("span", "", selected.type === "profile-frame"
        ? (carouselEntryIsEquipped(selected, model) ? "Equipped for Scramble Arena" : "Live Duel Card preview")
        : selected.owned ? "Owned choice" : "Preview available · Locked")
    );
    caption.append(
      captionCopy,
      element("span", "cosmetics-observatory__carousel-position", `${index + 1} / ${entries.length}`)
    );
    region.append(viewport, caption);
    return region;
  }

  function carouselDetails(model, entry) {
    const parentCollection = carouselParentCollection(model, entry);
    const equipped = carouselEntryIsEquipped(entry, model);
    const state = {
      owned: entry.owned,
      equipped,
      previewed: entry.type === "profile-frame"
        ? entry.frameSlug === stagedProfileFrame
        : loadoutsEqual(entry.previewCandidate, previewLoadout, model.slots)
    };
    const aside = element("aside", `cosmetics-observatory__carousel-details is-${entry.tone}`);
    aside.dataset.selectedId = entry.id;
    aside.setAttribute("aria-label", "Selected cosmetic details");

    const heading = element("div", "cosmetics-observatory__carousel-details-heading");
    const eyebrow = element("div", "cosmetics-observatory__card-eyebrow");
    eyebrow.append(badgeNode(entry.badge), statePills(state));
    heading.append(
      eyebrow,
      element("p", "cosmetics-observatory__carousel-context", entry.type === "collection"
        ? `${entry.subject.styleLabel || "Complete look"} · ${entry.subject.tier}`
        : entry.type === "profile-frame"
          ? `${entry.subject?.epithet || "Clean Arena card"} · Independent frame`
          : `${model.slotLabels[entry.slot] || entry.slot}${parentCollection ? ` · ${parentCollection.label}` : ""}`),
      element("h3", "", entry.label),
      element("p", "", entry.description)
    );
    aside.append(heading);

    const facts = element("dl", "cosmetics-observatory__carousel-facts");
    if (entry.type === "profile-frame") {
      facts.append(
        element("dt", "", "Category"),
        element("dd", "", "Arena frame"),
        element("dt", "", "Appears on"),
        element("dd", "", "Scramble Duel Cards")
      );
    } else if (entry.type === "collection") {
      const pieceCount = Object.values(entry.commitCandidate).filter(Boolean).length;
      facts.append(
        element("dt", "", "Collection"),
        element("dd", "", `${pieceCount} coordinated pieces`),
        element("dt", "", "Value"),
        element("dd", "", observatoryCollectionValue(entry.subject))
      );
    } else {
      facts.append(
        element("dt", "", "Category"),
        element("dd", "", model.slotLabels[entry.slot] || entry.slot),
        element("dt", "", "Collection"),
        element("dd", "", parentCollection?.label || "Independent piece")
      );
    }
    facts.append(
      element("dt", "", "Status"),
      element("dd", "", equipped ? "Equipped now" : entry.owned ? "Ready to equip" : "Locked · preview only")
    );
    aside.append(facts);

    if (!entry.owned && (entry.subject.unlockHint || parentCollection?.unlockHint)) {
      aside.append(element(
        "p",
        "cosmetics-observatory__unlock-hint is-carousel",
        entry.subject.unlockHint || parentCollection.unlockHint
      ));
    }

    const actions = element("div", "cosmetics-observatory__carousel-details-actions");
    if (entry.type === "profile-frame") {
      if (entry.frameSlug) {
        const removeKey = actionKey("frame-remove", entry.id);
        actions.append(markFocusKey(button(
          "cosmetics-observatory__button is-quiet",
          "Preview without a frame",
          () => {
            const nextModel = makeModel();
            const none = carouselEntries(nextModel, PROFILE_FRAME_CATEGORY)
              .find((candidate) => candidate.id === PROFILE_FRAME_NONE_ID);
            if (none) stageCarouselEntry(nextModel, none, removeKey);
          }
        ), removeKey));
      } else {
        actions.append(element(
          "p",
          "cosmetics-observatory__frame-note",
          "The live card is unframed. Equip this option to remove the current border."
        ));
      }
    } else {
      const previewKey = actionKey("carousel-preview", entry.id);
      actions.append(markFocusKey(button(
        "cosmetics-observatory__button is-secondary",
        "View in game",
        () => preview(entry.previewCandidate, entry.meta, previewKey)
      ), previewKey));
    }

    if (entry.type === "piece" && ["soundTheme", "sound"].includes(entry.slot)) {
      const sample = button(
        "cosmetics-observatory__button is-quiet",
        "Play sample",
        () => settings.onSoundPreview?.(entry.subject)
      );
      sample.setAttribute("aria-label", `Play ${entry.label} sound sample`);
      actions.append(sample);
    }

    if (!entry.owned && entry.type === "piece" && parentCollection) {
      actions.append(button(
        "cosmetics-observatory__button is-quiet",
        `See ${parentCollection.label}`,
        () => {
          activeTab = "collections";
          selectedSlot = "";
          carouselSelectionByCategory.set("collections", parentCollection.id);
          const nextModel = makeModel();
          const parentEntry = carouselEntries(nextModel, "collections")
            .find((candidate) => candidate.id === parentCollection.id);
          if (parentEntry) stageCarouselEntry(nextModel, parentEntry, actionKey("category", "collections"));
        }
      ));
    }

    const supporterSubject = entry.type === "collection" ? entry.subject : (parentCollection || entry.subject);
    if (!entry.owned && supporterSubject && typeof settings.onSupporter === "function") {
      actions.append(button(
        "cosmetics-observatory__button is-supporter",
        "Supporter options",
        () => settings.onSupporter?.(supporterSubject)
      ));
    }
    aside.append(actions);
    return aside;
  }

  function carouselPanel(model) {
    const category = activeCarouselCategory(model);
    const entries = carouselEntries(model, category);
    const selected = resolveCarouselSelection(model, entries, category);
    const panel = element("section", "cosmetics-observatory__carousel");
    panel.id = "cosmetics-observatory-carousel";
    panel.dataset.category = category;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `cosmetics-category-${category}`);

    if (!selected) {
      panel.append(emptyState(
        "No owned choices here yet",
        "Turn off Owned only to preview every available cosmetic."
      ));
      return { panel, selected: null };
    }

    const shelf = element("aside", "cosmetics-observatory__carousel-shelf");
    const shelfHeading = element("header", "cosmetics-observatory__carousel-shelf-heading");
    const allEntries = carouselEntries(model, category, { includeLocked: true });
    const ownedEntries = allEntries.filter((entry) => entry.owned);
    shelfHeading.append(
      element("p", "cosmetics-observatory__kicker", "Decoration library"),
      element("h3", "", `All ${carouselCategoryLabel(model, category, { short: true })}`),
      element("span", "", `${ownedEntries.length}/${allEntries.length} owned`)
    );
    const shelfTrack = element("div", "cosmetics-observatory__carousel-shelf-track");
    shelfTrack.setAttribute("role", "listbox");
    shelfTrack.setAttribute(
      "aria-label",
      `All ${carouselCategoryLabel(model, category).toLowerCase()}. Owned and locked states are marked on every choice.`
    );
    if (allEntries.length) {
      for (const entry of allEntries) {
        shelfTrack.append(carouselThumbnail(entry, model, entry.id === selected.id));
      }
    } else {
      shelfTrack.append(element("p", "cosmetics-observatory__carousel-shelf-empty", "No decorations are available in this category yet."));
    }
    shelf.append(shelfHeading, shelfTrack);
    panel.append(
      shelf,
      carouselFocusedPreview(model, entries, selected),
      carouselDetails(model, selected)
    );
    return { panel, selected };
  }

  function emptyState(title, copy) {
    const empty = element("div", "cosmetics-observatory__empty");
    empty.append(
      element("span", "cosmetics-observatory__empty-star", "✦"),
      element("h3", "", title),
      element("p", "", copy)
    );
    return empty;
  }

  function collectionGrid(model, collections, headingTag = "h3") {
    const grid = element("div", "cosmetics-observatory__card-grid is-collections");
    for (const collection of collections) grid.append(collectionCard(collection, model, headingTag));
    return grid;
  }

  function collectionBrowser(model, collections, {
    emptyTitle = "No collections in this view",
    emptyCopy = "More complete cosmetic collections will appear here when available."
  } = {}) {
    const families = groupObservatoryCollectionsByFamily(model, collections);
    if (!families.length) return emptyState(emptyTitle, emptyCopy);

    const browser = element("div", "cosmetics-observatory__collection-families");
    for (const family of families) {
      const section = element("section", "cosmetics-observatory__collection-family");
      section.dataset.collectionFamily = family.id;
      const headingId = `cosmetics-family-${family.id}-${activeTab}`;
      section.setAttribute("aria-labelledby", headingId);

      const header = element("header", "cosmetics-observatory__family-heading");
      const copy = element("div", "cosmetics-observatory__family-copy");
      if (family.kicker) copy.append(element("span", "cosmetics-observatory__family-kicker", family.kicker));
      const heading = element("h3", "", family.label);
      heading.id = headingId;
      copy.append(heading, element("p", "", family.description));
      const count = family.collections.length;
      header.append(
        copy,
        element("span", "cosmetics-observatory__family-count", `${count} ${count === 1 ? "collection" : "collections"}`)
      );
      section.append(header, collectionGrid(model, family.collections, "h4"));
      browser.append(section);
    }
    return browser;
  }

  function pieceBrowser(model, items, showSlots = true) {
    const wrap = element("div", "cosmetics-observatory__piece-browser");
    if (showSlots) {
      const slots = element("nav", "cosmetics-observatory__slots");
      slots.setAttribute("aria-label", "Cosmetic piece categories");
      const allControl = button("cosmetics-observatory__slot is-all", "", () => {
        clearPurchaseConfirmation();
        selectedSlot = "";
        render(actionKey("slot", "all"));
      });
      setPressed(allControl, !selectedSlot);
      markFocusKey(allControl, actionKey("slot", "all"));
      const allCount = element("span", "cosmetics-observatory__slot-count", String(items.length));
      allCount.setAttribute("aria-label", `${items.length} pieces`);
      allControl.append(
        element("span", "", ownedOnly ? "All owned pieces" : "All pieces"),
        allCount
      );
      slots.append(allControl);
      for (const slot of model.slots) {
        const count = items.filter((item) => item.slot === slot).length;
        const control = button("cosmetics-observatory__slot", "", () => {
          clearPurchaseConfirmation();
          selectedSlot = selectedSlot === slot ? "" : slot;
          render(actionKey("slot", selectedSlot || "all"));
        });
        setPressed(control, selectedSlot === slot);
        markFocusKey(control, actionKey("slot", slot));
        const label = element("span", "", model.slotLabels[slot]);
        const counter = element("span", "cosmetics-observatory__slot-count", String(count));
        counter.setAttribute("aria-label", `${count} pieces`);
        control.append(label, counter);
        slots.append(control);
      }
      wrap.append(slots);
    }
    const visible = showSlots && selectedSlot ? items.filter((item) => item.slot === selectedSlot) : items;
    if (!visible.length) {
      wrap.append(emptyState("No pieces in this view", "Choose another category or return to all cosmetics."));
      return wrap;
    }
    const grid = element("div", "cosmetics-observatory__card-grid is-pieces");
    for (const item of visible) grid.append(pieceCard(item, model));
    wrap.append(grid);
    return wrap;
  }

  function contentPanel(model) {
    const panel = element("section", "cosmetics-observatory__panel");
    panel.id = "cosmetics-observatory-panel";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `cosmetics-tab-${activeTab}`);

    const filterTab = ownedOnly ? "owned" : activeTab;
    if (activeTab === "collections") {
      const intro = element("div", "cosmetics-observatory__section-heading");
      intro.append(
        element("h2", "", ownedOnly ? "Your unlocked collections" : "Complete collections"),
        element(
          "p",
          "",
          ownedOnly
            ? "Every collection here is ready to equip in one action."
            : "Browse by universe, then equip a coordinated look or preview every detail first."
        )
      );
      panel.append(
        intro,
        collectionBrowser(model, filterObservatoryCollections(model, { tab: filterTab }), {
          emptyTitle: "No unlocked collections yet",
          emptyCopy: "Owned individual pieces remain available in the Pieces inventory."
        })
      );
    } else {
      const intro = element("div", "cosmetics-observatory__section-heading");
      const titleRow = element("div");
      titleRow.append(
        element(
          "h2",
          "",
          selectedSlot
            ? `${ownedOnly ? "Owned " : ""}${model.slotLabels[selectedSlot]}`
            : ownedOnly ? "Your inventory" : "Mix your own constellation"
        ),
        element(
          "p",
          "",
          ownedOnly
            ? "Equip any unlocked piece below. Every other equipped slot stays exactly as it is."
            : "Changing a single piece creates a custom collection without affecting gameplay."
        )
      );
      intro.append(titleRow);
      if (selectedSlot) {
        intro.append(button("cosmetics-observatory__button is-quiet", "Show all pieces", () => {
          clearPurchaseConfirmation();
          selectedSlot = "";
          render();
        }));
      }
      panel.append(intro, pieceBrowser(model, filterObservatoryItems(model, { tab: filterTab }), true));
    }
    return panel;
  }

  function footerNode(model, entry = null) {
    const footer = element("footer", "cosmetics-observatory__footer");
    const summary = element("div", "cosmetics-observatory__footer-summary");
    if (entry?.type === "profile-frame") {
      const dirty = stagedProfileFrame !== equippedProfileFrame;
      const equipped = carouselEntryIsEquipped(entry, model);
      summary.append(
        element(
          "strong",
          "",
          dirty ? `${entry.label} selected` : equipped ? `${entry.label} is equipped` : "Arena frame"
        ),
        element(
          "span",
          "",
          dirty
            ? "Live preview only until you equip it."
            : "This frame appears on your Scramble Arena Duel Card."
        )
      );
      const actions = element("div", "cosmetics-observatory__footer-actions");
      const cancel = button(
        "cosmetics-observatory__button is-secondary",
        dirty ? "Restore equipped" : "Close Lab",
        () => {
          if (!dirty) {
            close("cancel");
            return;
          }
          stagedProfileFrame = equippedProfileFrame;
          carouselSelectionByCategory.set(
            PROFILE_FRAME_CATEGORY,
            equippedProfileFrame || PROFILE_FRAME_NONE_ID
          );
          previewMeta = null;
          render(actionKey("footer", "cancel"));
          announce("Your equipped Arena frame is restored.");
        }
      );
      markFocusKey(cancel, actionKey("footer", "cancel"));
      actions.append(cancel);

      const equipKey = actionKey("carousel-primary", entry.id);
      const equip = button(
        "cosmetics-observatory__button is-primary is-apply",
        equipped
          ? (entry.frameSlug ? "Frame equipped" : "No frame equipped")
          : (entry.frameSlug ? "Equip frame" : "Remove frame"),
        () => commitProfileFrame(entry.frameSlug, entry.meta, equipKey)
      );
      equip.disabled = equipped || committing;
      equip.dataset.commitControl = "";
      markFocusKey(equip, equipKey);
      actions.append(equip);
      footer.append(summary, actions);
      return footer;
    }

    const dirty = !loadoutsEqual(previewLoadout, baseLoadout, model.slots);
    const equipped = carouselEntryIsEquipped(entry, model);
    const parentCollection = carouselParentCollection(model, entry);
    summary.append(
      element("strong", "", dirty ? `${entry?.label || previewMeta?.label || "Cosmetic"} selected` : `${entry?.label || "Equipped look"} is active`),
      element("span", "", dirty
        ? (entry?.owned ? "Preview only until you equip it." : "Locked preview · nothing has been purchased.")
        : "Swipe or use the arrows to explore another look.")
    );
    const actions = element("div", "cosmetics-observatory__footer-actions");
    const cancelPreview = button("cosmetics-observatory__button is-secondary", dirty ? "Restore equipped" : "Close Lab", () => {
      if (dirty) {
        carouselSelectionByCategory.delete(activeCarouselCategory(model));
        revertTransient();
        render(actionKey("footer", "cancel"));
        announce("Your equipped look is restored.");
      } else close("cancel");
    });
    markFocusKey(cancelPreview, actionKey("footer", "cancel"));
    actions.append(cancelPreview);

    if (entry?.owned) {
      const equipKey = actionKey("carousel-primary", entry.id);
      const equip = button(
        "cosmetics-observatory__button is-primary is-apply",
        equipped ? (entry.type === "collection" ? "Collection equipped" : "Piece equipped") : (entry.type === "collection" ? "Equip collection" : "Equip piece"),
        () => commit(entry.commitCandidate, entry.meta, equipKey)
      );
      equip.disabled = equipped || committing;
      equip.dataset.commitControl = "";
      markFocusKey(equip, equipKey);
      actions.append(equip);
    } else if (parentCollection?.creditPrice > 0 && typeof settings.onPurchase === "function") {
      const purchaseKey = actionKey("carousel-primary", entry.id);
      const affordable = currentBalance() >= parentCollection.creditPrice;
      const shortfall = Math.max(0, parentCollection.creditPrice - currentBalance());
      const purchaseArmed = armedPurchaseId === parentCollection.id;
      const purchaseValue = observatoryCollectionValue(parentCollection);
      const purchaseButton = button(
        "cosmetics-observatory__button is-primary is-purchase",
        purchaseArmed
          ? `Confirm ${purchaseValue}`
          : affordable
            ? `Unlock for ${purchaseValue}`
            : `Need ${shortfall.toLocaleString("en-US")} more credits`,
        () => purchase(parentCollection, purchaseKey)
      );
      purchaseButton.disabled = !affordable || committing;
      purchaseButton.dataset.purchaseControl = "";
      purchaseButton.dataset.confirmArmed = String(purchaseArmed);
      purchaseButton.setAttribute(
        "aria-label",
        purchaseArmed
          ? `Confirm purchase of ${parentCollection.label} for ${purchaseValue}`
          : affordable
            ? `Unlock ${parentCollection.label} for ${purchaseValue}`
            : `Need ${shortfall.toLocaleString("en-US")} more Star Credits to unlock ${parentCollection.label}`
      );
      markFocusKey(purchaseButton, purchaseKey);
      actions.append(purchaseButton);
    } else {
      const locked = button("cosmetics-observatory__button is-primary", "Locked · Preview only");
      locked.disabled = true;
      actions.append(locked);
    }
    footer.append(summary, actions);
    return footer;
  }

  function leavePreviewMode({ cancel = false } = {}) {
    const focusKey = previewReturnFocusKey || actionKey("close", "observatory");
    previewMode = false;
    if (cancel) {
      revertTransient();
      render(focusKey);
      announce("Preview cancelled. Your equipped look is restored.");
      return;
    }
    render(focusKey);
    announce("Preview mode closed. The cosmetic remains staged until you equip or cancel it.");
  }

  function resumePreview() {
    if (!dialog || !previewSuspended) return false;
    const focusKey = previewReturnFocusKey || actionKey("close", "observatory");
    previewSuspended = false;
    previewMode = false;
    render(focusKey);
    showDialog();
    const scheduleFocus = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (callback) => setTimeout(callback, 0);
    scheduleFocus(() => {
      const target = [...dialog.querySelectorAll("[data-focus-key]")]
        .find((node) => node.dataset.focusKey === focusKey);
      (target || firstFocusable(dialog))?.focus();
    });
    announce("Preview closed. The cosmetic remains staged until you equip or cancel it.");
    return true;
  }

  function previewFooterNode() {
    const footer = element("footer", "cosmetics-observatory__footer is-preview-mode");
    const summary = element("div", "cosmetics-observatory__footer-summary");
    summary.append(
      element("strong", "", `${previewMeta?.label || "Cosmetic"} preview`),
      element("span", "", "Preview only · gameplay and navigation are locked.")
    );
    const actions = element("div", "cosmetics-observatory__footer-actions");
    const cancel = button("cosmetics-observatory__button is-secondary", "Cancel preview", () => {
      leavePreviewMode({ cancel: true });
    });
    const exit = markFocusKey(button(
      "cosmetics-observatory__button is-primary",
      "Back to cosmetics",
      () => leavePreviewMode()
    ), actionKey("preview-exit", "theater"));
    actions.append(cancel, exit);
    footer.append(summary, actions);
    return footer;
  }

  function render(focusKey = "") {
    if (!dialog) return;
    const model = makeModel();
    if (selectedSlot && !model.slots.includes(selectedSlot)) selectedSlot = model.slots[0] || "";
    dialog.dataset.effects = effects;
    dialog.dataset.previewMode = String(previewMode);
    const surface = dialog.querySelector(".cosmetics-observatory__surface");
    if (!surface) return;
    const scrollState = {
      surfaceTop: surface.scrollTop,
      categoryLeft: surface.querySelector(".cosmetics-observatory__category-track")?.scrollLeft || 0,
      shelfLeft: surface.querySelector(".cosmetics-observatory__carousel-shelf-track")?.scrollLeft || 0,
      shelfTop: surface.querySelector(".cosmetics-observatory__carousel-shelf-track")?.scrollTop || 0,
      category: surface.querySelector(".cosmetics-observatory__carousel")?.dataset.category || ""
    };
    stopProfileFramePreviewMedia(surface);
    surface.replaceChildren();

    const header = element("header", "cosmetics-observatory__header");
    const titleGroup = element("div", "cosmetics-observatory__title-group");
    const kicker = element("p", "cosmetics-observatory__kicker", previewMode ? "Preview only" : "Constellation atelier");
    const title = element("h2", "", previewMode ? "Cosmetic preview" : "Cosmetic Lab");
    title.id = "cosmetics-observatory-title";
    const lede = element(
      "p",
      "cosmetics-observatory__lede",
      previewMode
        ? "Explore the staged look here. The game and all unrelated actions remain locked until you leave preview mode."
        : "Shape your universe. Explore every crafted decoration, preview it live, then equip the pieces you own."
    );
    lede.id = "cosmetics-observatory-description";
    titleGroup.append(kicker, title, lede);
    const headerActions = element("div", "cosmetics-observatory__header-actions");
    if (!previewMode) {
      const balance = element("p", "cosmetics-observatory__balance");
      balance.append(
        element("span", "", "Star Credits"),
        element("strong", "", currentBalance().toLocaleString("en-US"))
      );
      headerActions.append(balance);
    }
    const closeButton = button("cosmetics-observatory__close", "\u00d7", () => close("close-button"));
    closeButton.setAttribute("aria-label", "Close Cosmetic Lab");
    markFocusKey(closeButton, actionKey("close", "observatory"));
    headerActions.append(closeButton);
    header.append(titleGroup, headerActions);

    const stage = element("div", `cosmetics-observatory__stage${previewMode ? " is-preview-mode" : ""}`);
    if (previewMode) {
      stage.append(previewPanel(model, { immersive: true }));
      surface.append(header, stage, previewFooterNode());
      surface.scrollTop = 0;
    } else {
      const carousel = carouselPanel(model);
      surface.append(header, carouselCategoryStrip(model), carousel.panel, footerNode(model, carousel.selected));
      surface.scrollTop = scrollState.surfaceTop;
      const categoryTrack = surface.querySelector(".cosmetics-observatory__category-track");
      if (categoryTrack) categoryTrack.scrollLeft = scrollState.categoryLeft;
      if (scrollState.category === carousel.panel.dataset.category) {
        const shelfTrack = surface.querySelector(".cosmetics-observatory__carousel-shelf-track");
        if (shelfTrack) {
          shelfTrack.scrollLeft = scrollState.shelfLeft;
          shelfTrack.scrollTop = scrollState.shelfTop;
        }
      }
    }

    if (focusKey) {
      const target = [...surface.querySelectorAll("[data-focus-key]")].find((node) => node.dataset.focusKey === focusKey);
      target?.focus({ preventScroll: true });
      if (target?.matches(".cosmetics-observatory__category-tab, .cosmetics-observatory__carousel-thumb")) {
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }
  }

  function keydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (previewMode) {
        leavePreviewMode();
        return;
      }
      if (armedPurchaseId) {
        const focusKey = document.activeElement?.dataset?.focusKey || "";
        clearPurchaseConfirmation();
        render(focusKey);
        announce("Purchase confirmation cancelled.");
        return;
      }
      close("escape");
      return;
    }
    const carouselStage = event.target.closest?.("[data-carousel-stage]");
    if (carouselStage && event.target === carouselStage && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const model = makeModel();
      const entries = carouselEntries(model);
      const selected = resolveCarouselSelection(model, entries);
      const current = Math.max(0, entries.findIndex((entry) => entry.id === selected?.id));
      let next = current;
      if (event.key === "ArrowRight") next = Math.min(entries.length - 1, current + 1);
      if (event.key === "ArrowLeft") next = Math.max(0, current - 1);
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = Math.max(0, entries.length - 1);
      selectCarouselIndex(model, next, actionKey("carousel-stage", "active"));
      return;
    }
    const carouselOption = event.target.closest?.(".cosmetics-observatory__carousel-thumb[role=\"option\"]");
    if (carouselOption && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const model = makeModel();
      const listbox = carouselOption.closest('[role="listbox"]');
      const controls = [...(listbox?.querySelectorAll('.cosmetics-observatory__carousel-thumb[role="option"]') || [])];
      const current = controls.indexOf(carouselOption);
      let next = current;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(controls.length - 1, current + 1);
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, current - 1);
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = Math.max(0, controls.length - 1);
      const target = controls[next];
      const entry = carouselEntries(model).find((candidate) => candidate.id === target?.dataset.carouselOptionId);
      if (entry) stageCarouselEntry(model, entry, actionKey("carousel-option", entry.id));
      return;
    }
    const previewTab = event.target.closest?.(".cosmetics-observatory__preview-surface");
    if (previewTab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const current = PREVIEW_SURFACES.indexOf(previewTab.dataset.surface);
      let next = current;
      if (event.key === "ArrowRight") next = (current + 1) % PREVIEW_SURFACES.length;
      if (event.key === "ArrowLeft") next = (current - 1 + PREVIEW_SURFACES.length) % PREVIEW_SURFACES.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = PREVIEW_SURFACES.length - 1;
      previewSurface = PREVIEW_SURFACES[next];
      render(actionKey("preview-surface", previewSurface));
      return;
    }
    const tab = event.target.closest?.('[role="tab"]');
    if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const tablist = tab.closest('[role="tablist"]');
      const controls = [...(tablist?.querySelectorAll('[role="tab"]') || [])];
      const current = controls.indexOf(tab);
      let next = current;
      if (event.key === "ArrowRight") next = (current + 1) % controls.length;
      if (event.key === "ArrowLeft") next = (current - 1 + controls.length) % controls.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = controls.length - 1;
      controls[next]?.click();
      return;
    }
    const radio = event.target.closest?.('[role="radio"]');
    if (radio && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const nextMode = observatoryEffectModeForKey(radio.dataset.mode, event.key);
      const next = [...dialog.querySelectorAll('[role="radio"]')]
        .find((control) => control.dataset.mode === nextMode);
      next?.click();
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = allFocusable(dialog);
    if (!focusables.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = element("dialog", "cosmetics-observatory");
    dialog.setAttribute("aria-labelledby", "cosmetics-observatory-title");
    dialog.setAttribute("aria-describedby", "cosmetics-observatory-description");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-hidden", "true");
    dialog.dataset.presentation = "full-page";
    dialog.tabIndex = -1;
    const surface = element("div", "cosmetics-observatory__surface");
    const live = element("p", "cosmetics-observatory__sr-only");
    live.dataset.observatoryLive = "";
    live.setAttribute("aria-live", "polite");
    live.setAttribute("aria-atomic", "true");
    dialog.append(surface, live);
    dialog.addEventListener("keydown", keydown);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close("cancel-event");
    });
    mount.append(dialog);
    return dialog;
  }

  function open({ tab = "collections", slot = "", trigger = null } = {}) {
    ensureDialog();
    clearPurchaseConfirmation();
    returnFocus = trigger || document.activeElement;
    ownedOnly = tab === "owned";
    activeTab = BROWSER_TABS.includes(tab) ? tab : "collections";
    const configuredSlots = uniqueStrings(settings.slotOrder);
    selectedSlot = asText(slot, configuredSlots[0] || "");
    carouselSelectionByCategory.clear();
    baseLoadout = configuredLoadout(asRecord(settings.getLoadout?.() ?? settings.loadout));
    previewLoadout = { ...baseLoadout };
    previewMeta = null;
    equippedProfileFrame = readConfiguredProfileFrame();
    stagedProfileFrame = equippedProfileFrame;
    previewMode = false;
    previewSuspended = false;
    previewSurface = PREVIEW_SURFACES[0];
    previewReturnFocusKey = "";
    const savedEffects = settings.getEffects?.();
    effects = EFFECT_MODES.includes(savedEffects) ? savedEffects : effects;
    render();
    showDialog();
    const scheduleFocus = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (callback) => setTimeout(callback, 0);
    scheduleFocus(() => firstFocusable(dialog)?.focus());
    announce("Cosmetic Lab opened as a full-page decoration atelier. All owned and locked choices are visible.");
  }

  function refresh(next = {}) {
    if (next && typeof next === "object") Object.assign(settings, next);
    if (dialog?.hasAttribute("open")) {
      clearPurchaseConfirmation();
      baseLoadout = configuredLoadout(asRecord(settings.getLoadout?.() ?? baseLoadout));
      if (!previewMeta) previewLoadout = { ...baseLoadout };
      const frameWasDirty = stagedProfileFrame !== equippedProfileFrame;
      equippedProfileFrame = readConfiguredProfileFrame();
      if (!frameWasDirty) stagedProfileFrame = equippedProfileFrame;
      const model = makeModel();
      const category = activeCarouselCategory(model);
      const selectedId = carouselSelectionByCategory.get(category);
      if (selectedId && !carouselEntries(model, category).some((entry) => entry.id === selectedId)) {
        carouselSelectionByCategory.delete(category);
      }
      render();
    }
  }

  function destroy() {
    if (!dialog) return;
    clearPurchaseConfirmation();
    if (dialog.hasAttribute("open") || previewSuspended) close("destroy");
    dialog.removeEventListener("keydown", keydown);
    dialog.remove();
    dialog = null;
  }

  return Object.freeze({
    open,
    close,
    refresh,
    destroy,
    resumePreview,
    isOpen: () => Boolean(dialog?.hasAttribute("open")),
    isPreviewMode: () => previewMode,
    isPreviewSuspended: () => previewSuspended,
    getPreviewLoadout: () => ({ ...previewLoadout })
  });
}

export const COSMETICS_OBSERVATORY_TABS = OBSERVATORY_TABS;
export const COSMETICS_EFFECT_MODES = EFFECT_MODES;
