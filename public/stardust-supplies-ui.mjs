const TAB_ENTRIES = Object.freeze([
  { name: "reserve", tabId: "stardustReserveTab", panelId: "stardustReservePanel" },
  { name: "automatic", tabId: "stardustAutomaticTab", panelId: "stardustAutomaticPanel" }
]);

const CONTEXT_COPY = Object.freeze({
  "route-signal": "Route Signals refill to three when you begin another orbit. They are earned through play and are not sold.",
  "star-compass": "Star Compass charges can be added to your permanent reserve with earned Stardust.",
  "word-gift": "Word Gift returns on the next orbit when an undiscovered bridge is available. It cannot be bought.",
  reveal: "Reveal is always available. It changes the current orbit to Study with no score."
});

export function normalizeStardustSupplyTab(name) {
  return name === "automatic" ? "automatic" : "reserve";
}

export function setStardustSupplyTab({ documentRef = document, dialog = null, name = "reserve", focus = false } = {}) {
  const selected = normalizeStardustSupplyTab(name);
  for (const entry of TAB_ENTRIES) {
    const active = entry.name === selected;
    const tab = documentRef.getElementById(entry.tabId);
    const panel = documentRef.getElementById(entry.panelId);
    tab?.setAttribute("aria-selected", String(active));
    if (tab) tab.tabIndex = active ? 0 : -1;
    if (panel) {
      panel.hidden = !active;
      panel.inert = !active;
    }
    if (active && focus) tab?.focus({ preventScroll: true });
  }
  if (dialog) dialog.dataset.activeSection = selected;
  return selected;
}

export function configureStardustSupplyDialog({ documentRef = document, dialog = null, focusItem = "" } = {}) {
  const context = documentRef.getElementById("stardustDialogContext");
  if (context) context.textContent = CONTEXT_COPY[focusItem]
    || "Automatic allowances return on a new orbit; permanent reserves use earned Stardust.";
  documentRef.querySelectorAll("[data-supply-item]").forEach((item) => {
    item.classList.toggle("is-context-target", item.dataset.supplyItem === focusItem);
  });
  const automaticItem = ["route-signal", "word-gift", "reveal"].includes(focusItem);
  setStardustSupplyTab({ documentRef, dialog, name: automaticItem ? "automatic" : "reserve" });
  return focusItem
    ? documentRef.querySelector(`[data-supply-item="${focusItem}"]`)
    : documentRef.getElementById("stardustReserveTab");
}

export function bindStardustSupplyTabs({ documentRef = document, dialog = null } = {}) {
  for (const entry of TAB_ENTRIES) {
    const tab = documentRef.getElementById(entry.tabId);
    tab?.addEventListener("click", () => setStardustSupplyTab({ documentRef, dialog, name: entry.name }));
    tab?.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const name = event.key === "ArrowLeft" || event.key === "Home" ? "reserve" : "automatic";
      setStardustSupplyTab({ documentRef, dialog, name, focus: true });
    });
  }
}
