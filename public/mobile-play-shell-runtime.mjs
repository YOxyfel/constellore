import { createMobilePlayChrome } from "./mobile-play-chrome.mjs?v=5.0.0-beta.4";

const noop = () => {};

function query(root, selector) {
  return root?.querySelector?.(selector) || null;
}

function contains(entry, target) {
  return Boolean(target && entry?.some((element) => (
    element && (element === target || element.contains?.(target))
  )));
}

// Shared play chrome.
export function bindMobilePlayShell({
  root = globalThis.document?.querySelector?.("#gameScreen") || null,
  onLayoutChange = noop,
  onInventoryChange = noop,
  onViewportChange = noop,
  onBeforeDialog = noop,
  onSurfaceChange = noop
} = {}) {
  if (!root) throw new TypeError("bindMobilePlayShell requires #gameScreen");

  const documentRef = root.ownerDocument || globalThis.document;
  const windowRef = documentRef?.defaultView || globalThis.window;
  const elements = {
    toolsToggle: query(root, "#mobileToolsToggle"),
    toolsPanel: query(root, "#mobileToolsPanel"),
    assistToggle: query(root, "#mobileAssistToggle"),
    assistPanel: query(root, "#boardAssistanceRail"),
    soundDisclosure: query(root, "#playSoundDisclosure"),
    soundToggle: query(root, "#playSoundToggle"),
    soundPanel: query(root, "#playSoundPanel"),
    inventoryToggle: query(root, "#inventoryDrawerToggle"),
    inventoryPanel: query(root, "#inventoryDrawerBody"),
    inventorySearch: query(root, "#inventorySearch"),
    inventory: query(root, ".inventory"),
    board: query(root, "#board"),
    boardTopHud: query(root, "#boardTopHud")
  };

  const controller = createMobilePlayChrome({
    root,
    windowRef,
    visualViewport: windowRef?.visualViewport,
    surfaces: {
      tools: { toggle: elements.toolsToggle, panel: elements.toolsPanel },
      assistance: { toggle: elements.assistToggle, panel: elements.assistPanel },
      sound: {
        toggle: elements.soundToggle,
        panel: elements.soundPanel,
        disclosure: elements.soundDisclosure
      }
    },
    inventory: {
      toggle: elements.inventoryToggle,
      panel: elements.inventoryPanel,
      preservePeekContent: false
    },
    onLayoutChange,
    onInventoryChange,
    onViewportChange,
    onBeforeDialog,
    onSurfaceChange
  });

  const mobile = () => controller.state.layout !== "wide";
  const surfaceElements = {
    tools: [elements.toolsToggle, elements.toolsPanel],
    assistance: [elements.assistToggle, elements.assistPanel],
    sound: [elements.soundToggle, elements.soundPanel]
  };

  elements.toolsToggle?.addEventListener("click", (event) => {
    controller.toggleSurface("tools", { opener: event.currentTarget });
  });
  elements.toolsPanel?.addEventListener("click", (event) => {
    if (event.target?.closest?.("button")) {
      controller.closeSurface({ restoreFocus: true, reason: "command" });
    }
  });
  elements.assistToggle?.addEventListener("click", (event) => {
    controller.toggleSurface("assistance", { opener: event.currentTarget });
  });
  elements.soundToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    controller.toggleSurface("sound", { opener: event.currentTarget });
  });
  elements.inventorySearch?.addEventListener("focus", () => {
    if (mobile() && !controller.state.inventoryExpanded) {
      controller.setInventoryExpanded(true, { reason: "search" });
    }
  });

  documentRef?.addEventListener?.("keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented || !controller.state.activeSurface) return;
    event.preventDefault();
    controller.closeSurface({ restoreFocus: true, reason: "escape" });
  });

  documentRef?.addEventListener?.("pointerdown", (event) => {
    const active = controller.state.activeSurface;
    if (!active || contains(surfaceElements[active], event.target)) return;
    controller.closeSurface({ restoreFocus: false, reason: "outside" });
  }, true);

  documentRef?.addEventListener?.("toggle", (event) => {
    const disclosure = event.target;
    if (
      disclosure?.tagName !== "DETAILS"
      || !disclosure.open
      || disclosure === elements.soundDisclosure
    ) return;
    controller.closeSurface({ restoreFocus: false, reason: "disclosure" });
  }, true);

  const MutationObserverRef = windowRef?.MutationObserver || globalThis.MutationObserver;
  if (typeof MutationObserverRef === "function") {
    documentRef?.querySelectorAll?.("dialog").forEach((dialog) => {
      new MutationObserverRef(() => {
        if (dialog.open) controller.beforeDialog();
      }).observe(dialog, { attributes: true, attributeFilter: ["open"] });
    });
  }

  const ResizeObserverRef = windowRef?.ResizeObserver || globalThis.ResizeObserver;
  if (typeof ResizeObserverRef === "function") {
    const observer = new ResizeObserverRef(() => {
      onViewportChange({ reason: "resize-observer" });
    });
    [elements.board, elements.boardTopHud, elements.inventory]
      .filter(Boolean)
      .forEach((element) => observer.observe(element));
  }

  return controller;
}
