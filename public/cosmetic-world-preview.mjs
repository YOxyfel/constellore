import {
  COSMETIC_COLLECTION_FAMILIES,
  COSMETIC_COLLECTIONS,
  COSMETIC_ITEMS,
  COSMETIC_SLOTS,
  cosmeticAnalyticsPayload,
  isCosmeticOwned,
  sanitizeCosmeticLoadout
} from "./cosmetic-economy.mjs?v=5.0.0-beta.4";
import {
  PROFILE_FRAMES
} from "./profile-frame-catalog.mjs?v=5.0.0-beta.4";
import {
  createProfileFramePreviewVideo,
  equipProfileFrame,
  readStoredProfileFrame
} from "./profile-rank-frame.mjs?v=5.0.0-beta.4";
import {
  createArenaDuelCard
} from "./arena-duel-card.mjs?v=5.0.0-beta.4";
import {
  routeRankProgressPresentation
} from "./route-rank-client.mjs?v=5.0.0-beta.4";

const PREVIEW_SURFACES = Object.freeze(["board", "home", "gate", "menu", "sound"]);
const PREVIEW_SURFACE_LABELS = Object.freeze({
  board: "Board",
  home: "Home",
  gate: "Constellation Fold",
  menu: "Menu",
  sound: "Sound theme"
});

function elementSnapshot(element) {
  if (!element) return null;
  return {
    element,
    hidden: Boolean(element.hidden),
    inert: Boolean(element.inert),
    hadInertAttribute: element.hasAttribute("inert"),
    inertAttribute: element.getAttribute("inert")
  };
}

function setElementInert(element, inert = true) {
  if (!element) return;
  if ("inert" in element) element.inert = inert;
  if (inert) element.setAttribute("inert", "");
  else element.removeAttribute("inert");
}

function restoreElement(snapshot) {
  if (!snapshot?.element) return;
  const { element } = snapshot;
  element.hidden = snapshot.hidden;
  if ("inert" in element) element.inert = snapshot.inert;
  if (snapshot.hadInertAttribute) element.setAttribute("inert", snapshot.inertAttribute ?? "");
  else element.removeAttribute("inert");
}

export function createCosmeticsObservatoryHost(options = {}) {
  const {
    documentRef = globalThis.document,
    windowRef = documentRef?.defaultView || globalThis.window,
    state,
    cosmicGate,
    gameAudio,
    createObservatory,
    getProfile,
    ensurePlayer,
    fetchJson,
    authHeaders,
    applyServerPlayer,
    applyCosmeticLoadout,
    cosmeticOwnershipOptions,
    legacyThemeForLoadout,
    saveProfile,
    sanitizeCosmeticEffects,
    track,
    openPremium,
    resumeTimerIfNeeded,
    startCosmos,
    stopTimer,
    closeHubMenu
  } = options;
  if (!documentRef || typeof createObservatory !== "function") {
    throw new Error("Cosmetics Observatory host dependencies are incomplete.");
  }

  const byId = (id) => documentRef.getElementById(id);
  const elements = {
    startScreen: byId("startScreen"),
    gameScreen: byId("gameScreen"),
    board: byId("board"),
    hubMenuDialog: byId("hubMenuDialog"),
    profileDialog: byId("profileDialog"),
    preview: byId("cosmeticWorldPreview"),
    title: byId("cosmeticPreviewTitle"),
    description: byId("cosmeticPreviewDescription"),
    surfaces: byId("cosmeticPreviewSurfaces"),
    exit: byId("cosmeticPreviewExit"),
    status: byId("cosmeticPreviewStatus"),
    gate: byId("cosmicGate")
  };
  const collectionById = new Map(COSMETIC_COLLECTIONS.map((collection) => [collection.id, collection]));
  const observatoryItems = COSMETIC_ITEMS.map((item) => {
    const collection = collectionById.get(item.collectionId);
    return {
      ...item,
      acquisition: collection?.acquisition || item.access,
      collectionFamily: collection?.collectionFamily || "",
      styleLabel: collection?.styleLabel || "",
      badge: collection?.purchaseOnly
        ? "Purchase only"
        : collection?.rankUnlock
          ? "Rank reward"
          : item.access,
      unlockHint: item.unlock
        ? item.preview?.body || item.description
        : collection?.unlockHint || ""
    };
  });
  const requestFrame = windowRef?.requestAnimationFrame?.bind(windowRef)
    || ((callback) => setTimeout(callback, 0));
  let preview = null;
  let transientLoadout = null;
  let observatory = null;

  function profile() {
    return getProfile?.() || {};
  }

  function profileFrameIdentity() {
    const current = profile();
    const rank = routeRankProgressPresentation(current.routeRank);
    return {
      callsign: current.callsign || "Offline Stargazer",
      mark: rank.mark,
      rankName: rank.name,
      rankNumber: rank.number,
      discoveries: Array.isArray(current.discovered) ? current.discovered.length : 0,
      wins: current.wins
    };
  }

  function ownershipOptions() {
    return cosmeticOwnershipOptions?.() || {};
  }

  function gateSnapshot() {
    if (!elements.gate) return null;
    const attributes = {};
    for (const name of ["aria-hidden", "data-kind", "data-phase", "data-content"]) {
      attributes[name] = elements.gate.hasAttribute(name) ? elements.gate.getAttribute(name) : null;
    }
    return { hidden: Boolean(elements.gate.hidden), attributes };
  }

  function restoreGate(snapshot) {
    if (!elements.gate || !snapshot) return;
    elements.gate.hidden = snapshot.hidden;
    for (const [name, value] of Object.entries(snapshot.attributes)) {
      if (value === null) elements.gate.removeAttribute(name);
      else elements.gate.setAttribute(name, value);
    }
  }

  function closePreviewMenu() {
    if (!elements.hubMenuDialog?.open) return;
    try {
      elements.hubMenuDialog.close();
    } catch {
      elements.hubMenuDialog.removeAttribute("open");
    }
  }

  function openPreviewMenu() {
    if (!elements.hubMenuDialog || elements.hubMenuDialog.open) return;
    const previewWasOpen = Boolean(elements.preview?.open);
    if (previewWasOpen) elements.preview.close();
    try {
      if (typeof elements.hubMenuDialog.showModal === "function") elements.hubMenuDialog.showModal();
      else if (typeof elements.hubMenuDialog.show === "function") elements.hubMenuDialog.show();
      else elements.hubMenuDialog.setAttribute("open", "");
    } catch {
      elements.hubMenuDialog.setAttribute("open", "");
    } finally {
      if (previewWasOpen && !elements.preview.open) {
        elements.preview.showModal();
        requestFrame(() => elements.exit?.focus({ preventScroll: true }));
      }
    }
  }

  function removeBoardSample() {
    byId("cosmeticPreviewBoardSample")?.remove();
  }

  function createBoardSample() {
    removeBoardSample();
    const layer = documentRef.createElement("div");
    layer.id = "cosmeticPreviewBoardSample";
    layer.className = "cosmetic-world-preview__board-sample";
    layer.setAttribute("aria-hidden", "true");

    const svgNamespace = "http://www.w3.org/2000/svg";
    const trail = documentRef.createElementNS(svgNamespace, "svg");
    trail.classList.add("cosmetic-world-preview__sample-trail");
    trail.setAttribute("viewBox", "0 0 100 100");
    trail.setAttribute("preserveAspectRatio", "none");
    const pathData = "M 13 68 C 24 43, 38 35, 51 47 S 73 68, 87 31";
    for (const className of ["is-glow", "is-core"]) {
      const path = documentRef.createElementNS(svgNamespace, "path");
      path.classList.add(className);
      path.setAttribute("d", pathData);
      trail.append(path);
    }
    layer.append(trail);

    const samples = [
      ["\u{1F30D}", "Earth", "nature", "13%", "68%"],
      ["\u{1F4A7}", "Water", "force", "31%", "38%"],
      ["\u{1F331}", "Life", "life", "51%", "47%"],
      ["\u{1F3DB}\u{FE0F}", "World", "structure", "70%", "67%"],
      ["\u{2726}", "Constellation", "celestial", "74%", "31%"]
    ];
    for (const [emoji, word, category, x, y] of samples) {
      const node = documentRef.createElement("div");
      node.className = "board-word";
      node.dataset.category = category;
      node.style.setProperty("--preview-x", x);
      node.style.setProperty("--preview-y", y);
      const icon = documentRef.createElement("span");
      icon.className = "emoji";
      icon.textContent = emoji;
      const label = documentRef.createElement("span");
      label.className = "word";
      label.textContent = word;
      node.append(icon, label);
      layer.append(node);
    }
    elements.board?.append(layer);
    return layer;
  }

  function syncSurfaceControls(surface) {
    elements.surfaces?.querySelectorAll("[data-cosmetic-preview-target]").forEach((button) => {
      const selected = button.dataset.cosmeticPreviewTarget === surface;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
  }

  function showSurface(requestedSurface) {
    if (!preview) return false;
    const surface = PREVIEW_SURFACES.includes(requestedSurface) ? requestedSurface : "board";
    preview.surface = surface;
    documentRef.body.dataset.cosmeticPreviewSurface = surface;
    documentRef.body.dataset.cosmeticPreviewBoard = state?.game ? "live" : "sample";
    closePreviewMenu();
    removeBoardSample();
    if (elements.gate) {
      elements.gate.hidden = true;
      elements.gate.setAttribute("aria-hidden", "true");
      elements.gate.dataset.phase = "idle";
      delete elements.gate.dataset.content;
    }

    const homeSurface = surface === "home" || surface === "menu" || surface === "sound";
    if (elements.startScreen) elements.startScreen.hidden = !homeSurface && surface !== "gate";
    if (elements.gameScreen) elements.gameScreen.hidden = surface !== "board";

    if (surface === "board") {
      createBoardSample();
      gameAudio?.setScene?.("run");
      requestFrame(startCosmos);
    } else if (surface === "menu") {
      if (elements.startScreen) elements.startScreen.hidden = false;
      openPreviewMenu();
      gameAudio?.setScene?.("home");
    } else if (surface === "gate") {
      if (elements.startScreen) elements.startScreen.hidden = false;
      if (elements.gate) {
        elements.gate.hidden = false;
        elements.gate.setAttribute("aria-hidden", "true");
        elements.gate.dataset.kind = "enter";
        elements.gate.dataset.phase = "closed";
        elements.gate.dataset.content = "hidden";
      }
      gameAudio?.setScene?.("home");
    } else {
      if (elements.startScreen) elements.startScreen.hidden = false;
      gameAudio?.setScene?.("home");
    }

    if (surface !== "board") startCosmos?.();
    if (surface !== "gate") {
      windowRef?.scrollTo?.({ top: 0, left: 0, behavior: "instant" });
      if (elements.startScreen) elements.startScreen.scrollTop = 0;
    }
    syncSurfaceControls(surface);
    const label = PREVIEW_SURFACE_LABELS[surface] || "Cosmetic";
    if (elements.description) {
      elements.description.textContent = `${label} \u00b7 the game is frozen while you inspect this look.`;
    }
    if (elements.status) elements.status.textContent = `${label} preview. Gameplay is frozen.`;
    return true;
  }

  function present({ loadout, meta, surface }) {
    if (!elements.preview || cosmicGate?.isActive?.()) return false;
    if (preview) closePreview({ resumeObservatory: false });
    const applied = applyCosmeticLoadout(loadout, { preview: true });
    transientLoadout = applied;
    const scrollingElement = documentRef.scrollingElement || documentRef.documentElement;
    preview = {
      loadout: { ...loadout },
      meta: { ...meta },
      surface,
      snapshots: [
        elementSnapshot(elements.startScreen),
        elementSnapshot(elements.gameScreen),
        elementSnapshot(elements.hubMenuDialog),
        elementSnapshot(elements.gate)
      ].filter(Boolean),
      gate: gateSnapshot(),
      hubMenuOpen: Boolean(elements.hubMenuDialog?.open),
      scrollTop: scrollingElement?.scrollTop || 0,
      startScrollTop: elements.startScreen?.scrollTop || 0,
      audioScene: state?.finished
        ? "result"
        : state?.pause?.active
          ? "paused"
          : state?.game && !elements.gameScreen?.hidden
            ? "run"
            : "home"
    };
    preview.snapshots.forEach(({ element }) => setElementInert(element));
    documentRef.body.classList.add("cosmetic-world-preview-active");
    if (elements.title) elements.title.textContent = meta?.label || "Cosmetic preview";
    if (elements.surfaces) elements.surfaces.hidden = meta?.type !== "collection";
    showSurface(surface);
    if (meta?.slot === "soundTheme" || meta?.slot === "sound") gameAudio?.preview?.(meta.id);

    try {
      if (!elements.preview.open) elements.preview.showModal();
    } catch {
      closePreview({ resumeObservatory: false });
      return false;
    }
    requestFrame(() => elements.exit?.focus({ preventScroll: true }));
    return true;
  }

  function closePreview({ resumeObservatory = true } = {}) {
    const activePreview = preview;
    if (!activePreview) return false;
    preview = null;
    if (elements.preview?.open) elements.preview.close();
    closePreviewMenu();
    removeBoardSample();
    restoreGate(activePreview.gate);
    activePreview.snapshots.forEach(restoreElement);
    if (activePreview.hubMenuOpen && !elements.hubMenuDialog?.open) openPreviewMenu();
    documentRef.body.classList.remove("cosmetic-world-preview-active");
    delete documentRef.body.dataset.cosmeticPreviewSurface;
    delete documentRef.body.dataset.cosmeticPreviewBoard;
    gameAudio?.endPreview?.();
    gameAudio?.setScene?.(activePreview.audioScene);
    transientLoadout = null;
    applyCosmeticLoadout();
    startCosmos?.();
    const scrollingElement = documentRef.scrollingElement || documentRef.documentElement;
    if (scrollingElement) scrollingElement.scrollTop = activePreview.scrollTop;
    if (elements.startScreen) elements.startScreen.scrollTop = activePreview.startScrollTop;
    if (resumeObservatory) observatory?.resumePreview?.();
    return true;
  }

  function handleSurfaceKeydown(event) {
    const button = event.target.closest?.("[data-cosmetic-preview-target]");
    if (!button || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const controls = [...elements.surfaces.querySelectorAll("[data-cosmetic-preview-target]")];
    const current = controls.indexOf(button);
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % controls.length;
    if (event.key === "ArrowLeft") next = (current - 1 + controls.length) % controls.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = controls.length - 1;
    const target = controls[next];
    showSurface(target.dataset.cosmeticPreviewTarget);
    requestFrame(() => requestFrame(() => target.focus()));
  }

  function guardInput(event) {
    if (!preview) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      closePreview();
      return;
    }
    if (event.key === "Tab") {
      const controls = [...elements.preview.querySelectorAll("button:not(:disabled)")]
        .filter((control) => control.tabIndex >= 0 && !control.closest("[hidden]"));
      const first = controls[0];
      const last = controls.at(-1);
      const activeInside = elements.preview.contains(documentRef.activeElement);
      if (!activeInside || controls.length <= 1 || (event.shiftKey && documentRef.activeElement === first) || (!event.shiftKey && documentRef.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
      return;
    }
    const previewControl = event.target.closest?.("#cosmeticWorldPreview button");
    const previewControlKey = ["Enter", " ", "Spacebar", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key);
    if (previewControl && previewControlKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  const observatoryOptions = {
    collectionFamilies: COSMETIC_COLLECTION_FAMILIES,
    collections: COSMETIC_COLLECTIONS,
    items: observatoryItems,
    slotOrder: COSMETIC_SLOTS,
    profileFrames: PROFILE_FRAMES,
    getProfileFrame: () => readStoredProfileFrame(),
    createProfileFramePreview: (slug, entry) => {
      const identity = profileFrameIdentity();
      const card = createArenaDuelCard({
        documentRef,
        frameSlug: slug,
        side: "self",
        status: "ready",
        featured: true,
        player: {
          callsign: identity.callsign,
          mark: identity.mark,
          rank: `${identity.rankName} · Rank ${String(identity.rankNumber).padStart(2, "0")}`,
          frameSlug: slug
        },
        ariaLabel: `${entry?.name || "Unframed"} Arena Duel Card preview`
      });
      const connection = (
        windowRef?.navigator?.connection
        || windowRef?.navigator?.mozConnection
        || windowRef?.navigator?.webkitConnection
      );
      const previewVideo = createProfileFramePreviewVideo({
        documentRef,
        entry,
        cosmeticEffects: sanitizeCosmeticEffects(profile().cosmeticEffects),
        reducedMotion: windowRef?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
        reducedData: windowRef?.matchMedia?.("(prefers-reduced-data: reduce)")?.matches,
        saveData: (
          connection?.saveData === true
          || documentRef.body?.dataset?.saveData === "true"
        )
      });
      const livePreview = documentRef.createElement("div");
      livePreview.className = "cosmetics-observatory__profile-frame-live-preview";
      livePreview.dataset.frame = entry?.slug || "none";
      livePreview.dataset.hasVideo = String(Boolean(previewVideo));
      livePreview.setAttribute("data-profile-frame-live-preview", "");
      if (entry?.palette?.length) {
        livePreview.style.setProperty("--profile-frame-accent", entry.palette[0]);
        livePreview.style.setProperty("--profile-frame-color-2", entry.palette[1]);
        livePreview.style.setProperty("--profile-frame-color-3", entry.palette[2]);
      }
      if (previewVideo) livePreview.append(previewVideo);
      if (card?.element) livePreview.append(card.element);
      return Object.freeze({
        element: livePreview,
        card,
        previewVideo
      });
    },
    onProfileFrameCommit: (slug, meta) => {
      const selectedSlug = equipProfileFrame(slug, {
        eventTarget: documentRef,
        CustomEventCtor: windowRef?.CustomEvent
      });
      track?.("arena_frame_changed", {
        source: "cosmetic_lab",
        frame: selectedSlug || "none",
        action: selectedSlug ? "equipped" : "removed",
        selection: meta?.id || "none"
      });
      return selectedSlug;
    },
    getLoadout: () => profile().cosmetics,
    isOwned: (item) => isCosmeticOwned(item, ownershipOptions()),
    getBalance: () => profile().credits,
    onPurchase: async (collection) => {
      if (!profile().playerId || !profile().playerToken) await ensurePlayer?.();
      const result = await fetchJson("/api/cosmetics/buy", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          collectionId: collection.id,
          idempotencyKey: globalThis.crypto?.randomUUID?.() || `cosmetic-${Date.now()}`
        })
      });
      applyServerPlayer?.(result.player);
      return result;
    },
    onPreview: (loadout, meta) => {
      if (meta?.carousel === true) {
        transientLoadout = null;
        return;
      }
      const transient = meta?.transient === true;
      const applied = applyCosmeticLoadout(loadout, { preview: transient });
      transientLoadout = transient ? applied : null;
      if (state?.game) startCosmos?.();
    },
    onPresentPreview: present,
    onDismissPreview: () => closePreview({ resumeObservatory: false }),
    onCommit: (loadout, meta) => {
      transientLoadout = null;
      const current = profile();
      current.cosmetics = sanitizeCosmeticLoadout(loadout, ownershipOptions());
      current.theme = legacyThemeForLoadout(current.cosmetics);
      applyCosmeticLoadout();
      saveProfile?.({ fields: ["settings"] });
      if (state?.game) startCosmos?.();
      track?.("cosmetic_changed", {
        source: meta?.type || "observatory",
        ...cosmeticAnalyticsPayload(current.cosmetics)
      });
      return current.cosmetics;
    },
    onClose: () => {
      if (preview) closePreview({ resumeObservatory: false });
      transientLoadout = null;
      applyCosmeticLoadout();
      if (state?.game) startCosmos?.();
      setTimeout(() => resumeTimerIfNeeded?.(), 0);
    },
    onSupporter: () => {
      observatory?.close?.("supporter-options");
      requestFrame(openPremium);
    },
    onSoundPreview: (item) => gameAudio?.preview?.(item.id),
    getEffects: () => sanitizeCosmeticEffects(profile().cosmeticEffects),
    onEffectsChange: (mode) => {
      const current = profile();
      current.cosmeticEffects = sanitizeCosmeticEffects(mode);
      applyCosmeticLoadout();
      saveProfile?.({ fields: ["settings"] });
      if (observatory?.isOpen?.() || observatory?.isPreviewMode?.()) {
        transientLoadout = applyCosmeticLoadout(
          observatory.getPreviewLoadout(),
          { preview: true }
        );
      }
      if (state?.game) startCosmos?.();
    }
  };

  observatory = createObservatory(observatoryOptions);
  if (!observatory || typeof observatory.open !== "function") {
    throw new Error("Cosmetics Observatory could not be initialized.");
  }

  elements.exit?.addEventListener("click", () => closePreview());
  elements.surfaces?.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-cosmetic-preview-target]");
    if (!button) return;
    showSurface(button.dataset.cosmeticPreviewTarget);
    requestFrame(() => requestFrame(() => button.focus()));
  });
  elements.surfaces?.addEventListener("keydown", handleSurfaceKeydown);
  elements.preview?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closePreview();
  });
  windowRef?.addEventListener?.("keydown", guardInput, { capture: true });

  return Object.freeze({
    async open({ trigger = documentRef.activeElement, tab = "collections", slot = "" } = {}) {
      stopTimer?.();
      if (elements.hubMenuDialog?.open) closeHubMenu?.();
      if (elements.profileDialog?.open) elements.profileDialog.close();
      observatory.refresh({
        items: observatoryItems,
        isOwned: (item) => isCosmeticOwned(item, ownershipOptions())
      });
      observatory.open({ tab, slot, trigger });
      track?.("cosmetics_observatory_opened", { tab, slot: slot || "all" });
      return true;
    },
    closePreview,
    getPreviewLoadout: () => transientLoadout,
    isPreviewActive: () => Boolean(preview),
    resizePreview: () => {
      if (!preview) return false;
      requestFrame(startCosmos);
      return true;
    }
  });
}
