const OBSERVATORY_TABS = Object.freeze(["collections", "pieces", "owned"]);
const EFFECT_MODES = Object.freeze(["full", "reduced", "off"]);
const PREVIEW_SURFACES = Object.freeze(["board", "home", "gate", "menu", "sound"]);
const ALLOWED_BADGES = new Set(["Free", "Earned", "Supporter", "Event", "Rank reward", "Purchase only"]);
const PRESENTATION_SCOPES = new Set(["foundation", "accent", "full-shell"]);

const DEFAULT_SLOT_LABELS = Object.freeze({
  wordPlaque: "Word plaques",
  trailSet: "Trails",
  boardFinish: "Board backgrounds & finishes",
  boardScene: "Board backgrounds & finishes",
  homeScene: "Main-menu backgrounds",
  gateStyle: "Opening gates",
  uiFinish: "Menu finishes",
  soundTheme: "Sound themes",
  theme: "Menu finishes",
  board: "Board backgrounds & finishes",
  trail: "Trails",
  sound: "Sound themes"
});

const COLLECTION_SLOT_CHIPS = Object.freeze({
  wordPlaque: "Words",
  trailSet: "Trail",
  boardFinish: "Board",
  homeScene: "Background",
  gateStyle: "Gate",
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
    description: asText(source.description ?? source.summary, "A presentation-only cosmetic."),
    collectionId: asText(source.collectionId ?? source.collection),
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
  return (a.order - b.order) || a.label.localeCompare(b.label);
}

export function observatoryCollectionValue(collection = {}) {
  const creditPrice = Math.max(0, Math.floor(Number(asRecord(collection).creditPrice) || 0));
  return creditPrice > 0 ? `${creditPrice.toLocaleString("en-US")} C` : "Included";
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
    return Object.freeze({ ...collection, loadout: Object.freeze(collectionLoadout), owned: isOwned });
  });

  return Object.freeze({
    slots: Object.freeze(slots),
    slotLabels: Object.freeze(Object.fromEntries(slots.map((slot) => [
      slot,
      asText(labels[slot], DEFAULT_SLOT_LABELS[slot] || slot)
    ]))),
    loadout: safeLoadout,
    items: Object.freeze(ownedItems),
    collections: Object.freeze(collectionModels)
  });
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

function applyPreviewImage(node, item) {
  const assetUrl = observatoryPreviewAssetUrl(item);
  if (!assetUrl) return;
  node.classList.add("has-image");
  node.style.setProperty("--observatory-preview-image", `url("${assetUrl}")`);
}

function actionKey(type, id) {
  return `${type}:${id}`;
}

function focusKeyAfterCommit(meta, fallback = "") {
  if (meta?.type === "collection" && meta.id) return actionKey("preview-collection", meta.id);
  if (meta?.type === "piece" && meta.id) return actionKey("preview-piece", meta.id);
  return fallback || actionKey("close", "observatory");
}

/**
 * Mounts a modal Cosmetics Observatory without requiring static HTML.
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
 */
export function createCosmeticsObservatory(options = {}) {
  if (typeof document === "undefined") {
    throw new Error("Cosmetics Observatory requires a browser document.");
  }

  const settings = asRecord(options);
  const mount = settings.mount || document.body;
  let dialog = null;
  let activeTab = "collections";
  let selectedSlot = "";
  let baseLoadout = {};
  let previewLoadout = {};
  let previewMeta = null;
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
      collections: settings.collections,
      items: settings.items,
      slotOrder: settings.slotOrder,
      loadout: baseLoadout,
      owned: settings.isOwned ?? settings.owned,
      slotLabels: settings.slotLabels
    });
  }

  function configuredLoadout(raw) {
    return {
      ...buildObservatoryModel({
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
        : "Your available cosmetic loadout was restored.";
    } catch {
      announcement = "That cosmetic could not be equipped. Your previous look is still active.";
    } finally {
      committing = false;
      dialog?.removeAttribute("aria-busy");
      render(nextFocusKey);
      announce(announcement);
    }
  }

  async function purchase(collection, focusKey = "") {
    if (committing || !collection.creditPrice || typeof settings.onPurchase !== "function") return;
    if (currentBalance() < collection.creditPrice) {
      clearPurchaseConfirmation();
      render(focusKey);
      announce(`You need ${collection.creditPrice.toLocaleString()} Star Credits to unlock ${collection.label}.`);
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
    previewMode = false;
    previewSuspended = false;
    previewSurface = PREVIEW_SURFACES[0];
    previewReturnFocusKey = "";
    previewLoadout = { ...baseLoadout };
    previewMeta = null;
    if (changed) callPreview(baseLoadout, { reason: "revert", transient: false });
  }

  function close(reason = "close") {
    if (!dialog || (!dialog.hasAttribute("open") && !previewSuspended)) return;
    if (committing) {
      announce("Finishing your cosmetic change before closing.");
      return;
    }
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

  function collectionCard(collection, model) {
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
    const heading = element("h3", "cosmetics-observatory__card-title", collection.label);
    body.append(heading, element("p", "cosmetics-observatory__card-copy", collection.description));
    const pieceCount = Object.values(collection.loadout).filter(Boolean).length;
    const facts = element("div", "cosmetics-observatory__collection-facts");
    const tierFact = element("span", "cosmetics-observatory__collection-fact is-tier");
    tierFact.append(
      element("small", "", "Presentation tier"),
      element("strong", "", collection.tier)
    );
    const kitFact = element("span", "cosmetics-observatory__collection-fact is-kit");
    kitFact.append(
      element("small", "", "Complete collection"),
      element("strong", "", `${pieceCount}-piece kit`)
    );
    facts.append(
      tierFact,
      kitFact,
      element(
        "span",
        "cosmetics-observatory__collection-fact is-background",
        "Main-menu background included"
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
        const affordable = currentBalance() >= collection.creditPrice;
        const purchaseArmed = armedPurchaseId === collection.id;
        const purchaseValue = observatoryCollectionValue(collection);
        const purchaseButton = markFocusKey(button(
          "cosmetics-observatory__button is-primary is-purchase",
          purchaseArmed
            ? `Confirm ${purchaseValue}`
            : affordable
              ? `Unlock for ${purchaseValue}`
              : `Need ${purchaseValue}`,
          () => purchase(collection, purchaseKey)
        ), purchaseKey);
        purchaseButton.disabled = !affordable || committing;
        purchaseButton.dataset.purchaseControl = "";
        purchaseButton.dataset.confirmArmed = String(purchaseArmed);
        purchaseButton.setAttribute(
          "aria-label",
          purchaseArmed
            ? `Confirm purchase of ${collection.label} for ${purchaseValue}`
            : `Unlock ${collection.label} for ${purchaseValue}`
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
      gate: "Gate",
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
    pane.setAttribute("aria-label", `${title} preview: ${asText(item?.label, "default presentation")}`);
    applyPreviewImage(pane, item);
    const label = element("span", "cosmetics-observatory__scene-label");
    label.append(
      element("small", "", title),
      element("strong", "", asText(item?.label, "Default presentation"))
    );
    pane.append(element("i", "cosmetics-observatory__scene-seam"), label);
    return pane;
  }

  function menuPreview(model) {
    const item = itemForSlots(model, previewLoadout, ["uiFinish", "theme"]);
    const tone = safeTone(item?.tone || selectedTone(model, previewLoadout));
    const panel = element("div", `cosmetics-observatory__menu-preview is-${tone}`);
    panel.setAttribute("role", "img");
    panel.setAttribute("aria-label", `Menu finish preview: ${asText(item?.label, "default presentation")}`);
    const sample = element("div", "cosmetics-observatory__menu-sample");
    sample.append(
      element("p", "cosmetics-observatory__kicker", "Choose your orbit"),
      element("h3", "", asText(item?.label, "Default presentation")),
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
      element("p", "", "Hear a short presentation-only sample. Your equipped sound returns when previewing ends.")
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
    const section = element(
      "section",
      `cosmetics-observatory__preview is-${overallTone}${immersive ? " is-immersive" : ""}`
    );
    section.setAttribute("aria-labelledby", "cosmetics-preview-title");
    const headingRow = element("div", "cosmetics-observatory__preview-heading");
    const titles = element("div");
    const kicker = element("p", "cosmetics-observatory__kicker", immersive ? "Preview mode" : "Live presentation");
    const title = element("h2", "", immersive ? asText(previewMeta?.label, "Cosmetic preview") : "Your constellation");
    title.id = "cosmetics-preview-title";
    titles.append(kicker, title);
    headingRow.append(titles, element("span", "cosmetics-observatory__preview-rank", "Rank sky · Wayfinder"));

    const sceneSplit = element("div", "cosmetics-observatory__scene-split");
    sceneSplit.setAttribute("aria-label", "Main-menu background and opening gate previews");
    sceneSplit.append(
      scenePreview(model, "homeScene", "Main-menu background"),
      scenePreview(model, "gateStyle", "Opening gate")
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
      if (previewSurface === "home") panel.append(scenePreview(model, "homeScene", "Main-menu background", { immersive: true }));
      else if (previewSurface === "gate") panel.append(scenePreview(model, "gateStyle", "Opening gate", { immersive: true }));
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

  function tabsNode() {
    const nav = element("div", "cosmetics-observatory__tabs");
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", "Cosmetics browser");
    const labels = { collections: "Collections", pieces: "Pieces", owned: "Owned" };
    for (const tab of OBSERVATORY_TABS) {
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
    return nav;
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

  function collectionGrid(model, collections) {
    if (!collections.length) return emptyState("No owned collections yet", "Free and earned individual pieces still appear in the Owned view.");
    const grid = element("div", "cosmetics-observatory__card-grid is-collections");
    for (const collection of collections) grid.append(collectionCard(collection, model));
    return grid;
  }

  function pieceBrowser(model, items, showSlots = true) {
    const wrap = element("div", "cosmetics-observatory__piece-browser");
    if (showSlots) {
      const slots = element("nav", "cosmetics-observatory__slots");
      slots.setAttribute("aria-label", "Cosmetic piece categories");
      for (const slot of model.slots) {
        const count = items.filter((item) => item.slot === slot).length;
        const control = button("cosmetics-observatory__slot", "", () => {
          clearPurchaseConfirmation();
          selectedSlot = slot;
          render(actionKey("slot", slot));
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

    if (activeTab === "collections") {
      const intro = element("div", "cosmetics-observatory__section-heading");
      intro.append(
        element("h2", "", "Complete collections"),
        element("p", "", "Equip a coordinated look in one action, or preview every detail first.")
      );
      panel.append(intro, collectionGrid(model, filterObservatoryCollections(model, { tab: activeTab })));
    } else if (activeTab === "pieces") {
      const intro = element("div", "cosmetics-observatory__section-heading");
      const titleRow = element("div");
      titleRow.append(
        element("h2", "", selectedSlot ? model.slotLabels[selectedSlot] : "Mix your own constellation"),
        element("p", "", "Changing a single piece creates a custom collection without affecting gameplay.")
      );
      intro.append(titleRow);
      if (selectedSlot) {
        intro.append(button("cosmetics-observatory__button is-quiet", "Show all pieces", () => {
          clearPurchaseConfirmation();
          selectedSlot = "";
          render();
        }));
      }
      panel.append(intro, pieceBrowser(model, filterObservatoryItems(model, { tab: activeTab }), true));
    } else {
      const ownedCollections = filterObservatoryCollections(model, { tab: activeTab });
      const ownedItems = filterObservatoryItems(model, { tab: activeTab });
      const collectionHeading = element("div", "cosmetics-observatory__section-heading");
      collectionHeading.append(
        element("h2", "", "Owned collections"),
        element("p", "", "Everything ready to equip now.")
      );
      const pieceHeading = element("div", "cosmetics-observatory__section-heading");
      pieceHeading.append(element("h2", "", "Owned pieces"));
      panel.append(
        collectionHeading,
        collectionGrid(model, ownedCollections),
        pieceHeading,
        pieceBrowser(model, ownedItems, false)
      );
    }
    return panel;
  }

  function footerNode(model) {
    const footer = element("footer", "cosmetics-observatory__footer");
    const summary = element("div", "cosmetics-observatory__footer-summary");
    const dirty = !loadoutsEqual(previewLoadout, baseLoadout, model.slots);
    const previewOwned = observatoryLoadoutIsOwned(model, previewLoadout);
    summary.append(
      element("strong", "", dirty ? `${previewMeta?.label || "Cosmetic"} preview ready` : "No pending changes"),
      element("span", "", dirty
        ? (previewOwned ? "Apply to keep this presentation." : "Locked previews cannot be equipped.")
        : "Preview any collection or individual piece.")
    );
    const actions = element("div", "cosmetics-observatory__footer-actions");
    const cancelPreview = button("cosmetics-observatory__button is-secondary", dirty ? "Cancel preview" : "Close", () => {
      if (dirty) {
        revertTransient();
        render(actionKey("footer", "cancel"));
        announce("Preview cancelled. Your equipped presentation is restored.");
      } else close("cancel");
    });
    markFocusKey(cancelPreview, actionKey("footer", "cancel"));
    actions.append(cancelPreview);
    const apply = button(
      "cosmetics-observatory__button is-primary is-apply",
      !dirty
        ? "Select a preview"
        : previewMeta?.type === "collection"
          ? "Equip collection"
          : "Equip piece",
      () => commit(previewLoadout, previewMeta || { type: "preview", label: "Cosmetic preview" }, actionKey("apply", "preview"))
    );
    apply.disabled = !dirty || !previewOwned || committing;
    apply.dataset.commitControl = "";
    markFocusKey(apply, actionKey("apply", "preview"));
    actions.append(apply);
    footer.append(summary, actions);
    return footer;
  }

  function leavePreviewMode({ cancel = false } = {}) {
    const focusKey = previewReturnFocusKey || actionKey("close", "observatory");
    previewMode = false;
    if (cancel) {
      revertTransient();
      render(focusKey);
      announce("Preview cancelled. Your equipped presentation is restored.");
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
      element("span", "", "Presentation only · gameplay and navigation are locked.")
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
    surface.replaceChildren();

    const header = element("header", "cosmetics-observatory__header");
    const titleGroup = element("div");
    const kicker = element("p", "cosmetics-observatory__kicker", previewMode ? "Presentation only" : "Presentation workshop");
    const title = element("h1", "", previewMode ? "Cosmetic preview" : "Cosmetics Observatory");
    title.id = "cosmetics-observatory-title";
    const lede = element(
      "p",
      "cosmetics-observatory__lede",
      previewMode
        ? "Explore the staged look here. The game and all unrelated actions remain locked until you leave preview mode."
        : "Shape how your words travel through the cosmos. Every choice is visual or audible only."
    );
    lede.id = "cosmetics-observatory-description";
    titleGroup.append(kicker, title, lede);
    const closeButton = button("cosmetics-observatory__close", "Close", () => close("close-button"));
    closeButton.setAttribute("aria-label", "Close Cosmetics Observatory");
    markFocusKey(closeButton, actionKey("close", "observatory"));
    header.append(titleGroup, closeButton);

    const stage = element("div", `cosmetics-observatory__stage${previewMode ? " is-preview-mode" : ""}`);
    if (previewMode) {
      stage.append(previewPanel(model, { immersive: true }));
      surface.append(header, stage, previewFooterNode());
      surface.scrollTop = 0;
    } else {
      stage.append(previewPanel(model), effectControls());
      surface.append(header, stage, tabsNode(), contentPanel(model), footerNode(model));
    }

    if (focusKey) {
      const target = [...surface.querySelectorAll("[data-focus-key]")].find((node) => node.dataset.focusKey === focusKey);
      target?.focus();
    }
  }

  function keydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (previewMode) {
        leavePreviewMode();
        return;
      }
      close("escape");
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
      const controls = [...dialog.querySelectorAll('[role="tab"]')];
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
    activeTab = OBSERVATORY_TABS.includes(tab) ? tab : "collections";
    const configuredSlots = uniqueStrings(settings.slotOrder);
    selectedSlot = asText(slot, configuredSlots[0] || "");
    baseLoadout = configuredLoadout(asRecord(settings.getLoadout?.() ?? settings.loadout));
    previewLoadout = { ...baseLoadout };
    previewMeta = null;
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
    announce("Cosmetics Observatory opened. No gameplay rules are changed here.");
  }

  function refresh(next = {}) {
    if (next && typeof next === "object") Object.assign(settings, next);
    if (dialog?.hasAttribute("open")) {
      clearPurchaseConfirmation();
      baseLoadout = configuredLoadout(asRecord(settings.getLoadout?.() ?? baseLoadout));
      if (!previewMeta) previewLoadout = { ...baseLoadout };
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
