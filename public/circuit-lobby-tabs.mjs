export const CIRCUIT_LOBBY_TABS = Object.freeze(["fly", "progress", "rewards", "rules"]);

export function nextCircuitLobbyTab(current, key, tabs = CIRCUIT_LOBBY_TABS) {
  const available = [...tabs];
  if (!available.length) return "";
  const index = Math.max(0, available.indexOf(current));
  if (key === "Home") return available[0];
  if (key === "End") return available.at(-1);
  if (key === "ArrowLeft" || key === "ArrowUp") return available[(index - 1 + available.length) % available.length];
  if (key === "ArrowRight" || key === "ArrowDown") return available[(index + 1) % available.length];
  return current;
}

export function createCircuitLobbyTabs({
  root = globalThis.document?.querySelector?.("#circuitLobby"),
  initial = "fly"
} = {}) {
  const buttons = [...(root?.querySelectorAll?.("[data-circuit-lobby-tab]") || [])];
  const panels = [...(root?.querySelectorAll?.("[data-circuit-lobby-panel]") || [])];
  const available = buttons
    .map((button) => button.dataset.circuitLobbyTab)
    .filter((id) => CIRCUIT_LOBBY_TABS.includes(id) && panels.some((panel) => panel.dataset.circuitLobbyPanel === id));
  let current = available.includes(initial) ? initial : available[0] || "";

  const select = (id, { focus = false } = {}) => {
    if (!available.includes(id)) return false;
    current = id;
    if (root?.dataset) root.dataset.lobbyTab = id;
    for (const button of buttons) {
      const selected = button.dataset.circuitLobbyTab === id;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus();
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.circuitLobbyPanel !== id;
    }
    return true;
  };

  const onClick = (event) => {
    const button = event.target.closest?.("[data-circuit-lobby-tab]");
    if (button) select(button.dataset.circuitLobbyTab);
  };
  const onKeydown = (event) => {
    const button = event.target.closest?.("[data-circuit-lobby-tab]");
    if (!button || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    select(nextCircuitLobbyTab(button.dataset.circuitLobbyTab, event.key, available), { focus: true });
  };

  root?.addEventListener?.("click", onClick);
  root?.addEventListener?.("keydown", onKeydown);
  select(current);

  return {
    current: () => current,
    select,
    destroy() {
      root?.removeEventListener?.("click", onClick);
      root?.removeEventListener?.("keydown", onKeydown);
    }
  };
}
