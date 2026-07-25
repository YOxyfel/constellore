import {
  getRankBoardArtCssVariables,
  getRankBoardArtPresentation
} from "./rank-board-art.mjs?v=3.3.0-beta.1";

export const RANK_BOARD_ART_PRELOAD_ATTRIBUTE = "data-constellore-rank-board-art";

function resolveRoot(target) {
  if (target?.nodeType === 9 && target.documentElement) {
    return { element: target.documentElement, document: target };
  }
  if (target?.style?.setProperty) {
    return { element: target, document: target.ownerDocument || null };
  }
  throw new TypeError("Rank board art needs a Document or style-capable Element.");
}

function resolvedView(element, document) {
  return document?.defaultView || element?.ownerDocument?.defaultView || null;
}

function measuredWidth(element, document, view, explicitWidth) {
  const requested = Number(explicitWidth);
  if (Number.isFinite(requested) && requested > 0) return requested;
  const candidates = [
    element?.clientWidth,
    document?.documentElement?.clientWidth,
    view?.innerWidth
  ];
  return candidates.find((value) => Number.isFinite(Number(value)) && Number(value) > 0)
    || 1_024;
}

function connectionFor(view, explicitConnection) {
  return explicitConnection || view?.navigator?.connection || null;
}

function reducedDataQuery(view, suppliedQuery) {
  if (suppliedQuery?.matches != null) return suppliedQuery;
  try {
    return view?.matchMedia?.("(prefers-reduced-data: reduce)") || null;
  } catch {
    return null;
  }
}

function effectiveReducedData(options, connection, query) {
  if (typeof options.reducedData === "boolean") return options.reducedData;
  if (typeof options.saveData === "boolean") return options.saveData;
  return connection?.saveData === true || query?.matches === true;
}

function setManagedAttribute(element, name, value) {
  if (typeof element?.setAttribute === "function") {
    element.setAttribute(name, String(value));
  }
}

function managedPreload(document) {
  return document?.querySelector?.(
    `link[${RANK_BOARD_ART_PRELOAD_ATTRIBUTE}="preload"]`
  ) || null;
}

function removeManagedPreload(document) {
  managedPreload(document)?.remove?.();
}

function syncManagedPreload(document, preload) {
  if (!document?.head || typeof document.createElement !== "function") return null;
  let link = managedPreload(document);
  if (!preload.recommended || !preload.href) {
    link?.remove?.();
    return null;
  }
  if (!link) {
    link = document.createElement("link");
    link.setAttribute(RANK_BOARD_ART_PRELOAD_ATTRIBUTE, "preload");
    document.head.append(link);
  }
  link.setAttribute("rel", "preload");
  link.setAttribute("as", preload.as);
  link.setAttribute("type", preload.type);
  link.setAttribute("href", preload.href);
  link.setAttribute("imagesrcset", preload.imageSrcSet);
  link.setAttribute("imagesizes", preload.imageSizes);
  link.setAttribute("fetchpriority", preload.fetchPriority);
  return link;
}

/**
 * Applies one safe rank-art presentation. The target can be the board itself
 * or a Document, in which case variables are inherited from its root.
 */
export function applyRankBoardArt(target, rank, options = {}) {
  const { element, document } = resolveRoot(target);
  const view = resolvedView(element, document);
  const connection = connectionFor(view, options.connection);
  const dataQuery = reducedDataQuery(view, options.reducedDataQuery);
  const presentationOptions = {
    ...options,
    viewportWidth: measuredWidth(
      element,
      document,
      view,
      options.viewportWidth
    ),
    reducedData: effectiveReducedData(options, connection, dataQuery),
    imminent: options.preload !== false && options.imminent !== false
  };
  const presentation = getRankBoardArtPresentation(rank, presentationOptions);
  const variables = getRankBoardArtCssVariables(rank, presentationOptions);
  for (const [name, value] of Object.entries(variables)) {
    element.style.setProperty(name, value);
  }
  setManagedAttribute(element, "data-rank-board-art-rank", presentation.rank.id);
  setManagedAttribute(element, "data-rank-board-art-tier", presentation.tier.id);
  setManagedAttribute(element, "data-rank-board-art-quality", presentation.variant.id);
  setManagedAttribute(
    element,
    "data-rank-board-art-reduced-data",
    presentation.reducedData
  );
  syncManagedPreload(document, presentation.preload);
  return presentation;
}

function subscribe(target, eventName, listener) {
  if (typeof target?.addEventListener === "function") {
    target.addEventListener(eventName, listener);
    return () => target.removeEventListener?.(eventName, listener);
  }
  if (eventName === "change" && typeof target?.addListener === "function") {
    target.addListener(listener);
    return () => target.removeListener?.(listener);
  }
  return () => {};
}

/**
 * Creates an explicitly mounted controller. Nothing starts at module import.
 * The controller refreshes responsive variants and Save-Data changes, and
 * releases every listener when destroyed.
 */
export function createRankBoardArtRuntime({
  target,
  rank = "bronze",
  quality = "auto",
  reducedData,
  preload = true,
  observeResize = true,
  observeDataSaver = true,
  connection: suppliedConnection,
  reducedDataQuery: suppliedReducedDataQuery,
  ResizeObserver: SuppliedResizeObserver
} = {}) {
  const resolved = resolveRoot(target);
  const view = resolvedView(resolved.element, resolved.document);
  const connection = connectionFor(view, suppliedConnection);
  const dataQuery = reducedDataQuery(view, suppliedReducedDataQuery);
  const disposers = [];
  let currentRank = rank;
  let currentQuality = quality;
  let reducedDataOverride = reducedData;
  let currentPresentation = null;
  let animationFrame = null;
  let destroyed = false;

  const refresh = (overrides = {}) => {
    if (destroyed) return currentPresentation;
    if (Object.hasOwn(overrides, "rank")) currentRank = overrides.rank;
    if (Object.hasOwn(overrides, "quality")) currentQuality = overrides.quality;
    if (Object.hasOwn(overrides, "reducedData")) {
      reducedDataOverride = overrides.reducedData;
    }
    currentPresentation = applyRankBoardArt(target, currentRank, {
      quality: currentQuality,
      reducedData: reducedDataOverride,
      preload,
      connection,
      reducedDataQuery: dataQuery,
      viewportWidth: overrides.viewportWidth
    });
    return currentPresentation;
  };

  const scheduleRefresh = () => {
    if (destroyed || animationFrame != null) return;
    const requestFrame = view?.requestAnimationFrame?.bind(view);
    if (requestFrame) {
      let ranSynchronously = false;
      const frame = requestFrame(() => {
        ranSynchronously = true;
        animationFrame = null;
        refresh();
      });
      if (!ranSynchronously) animationFrame = frame;
      return;
    }
    refresh();
  };

  if (observeResize) {
    const ResizeObserverClass = SuppliedResizeObserver || view?.ResizeObserver;
    if (typeof ResizeObserverClass === "function") {
      const observer = new ResizeObserverClass(scheduleRefresh);
      observer.observe(resolved.element);
      disposers.push(() => observer.disconnect());
    } else {
      disposers.push(subscribe(view, "resize", scheduleRefresh));
    }
  }
  if (observeDataSaver && connection) {
    disposers.push(subscribe(connection, "change", scheduleRefresh));
  }
  if (observeDataSaver && dataQuery) {
    disposers.push(subscribe(dataQuery, "change", scheduleRefresh));
  }

  refresh();

  return Object.freeze({
    refresh,
    setRank(nextRank) {
      return refresh({ rank: nextRank });
    },
    setQuality(nextQuality) {
      return refresh({ quality: nextQuality });
    },
    setReducedData(nextValue) {
      return refresh({ reducedData: nextValue });
    },
    get presentation() {
      return currentPresentation;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const dispose of disposers.splice(0)) dispose();
      if (animationFrame != null) {
        view?.cancelAnimationFrame?.(animationFrame);
        animationFrame = null;
      }
      removeManagedPreload(resolved.document);
    }
  });
}
