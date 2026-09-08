export function createInventoryRenderer({
  document,
  els,
  getState,
  spatialBloomSelectorActive,
  getWordOrbitRuntime,
  getCombiningBoardRuntime,
  combiningBoardView,
  updateHud,
  orderInventory,
  inventoryKey,
  recentInventoryWords,
  visualWordCategory,
  visualWordToken,
  senseWordActive,
  firstOrbitWordActive,
  masteryStarsForWord,
  escapeHtml,
  activateTrayItem,
  startTrayPointerDrag
} = {}) {
  function selectedIngredient(state) {
    const selected = state.nodes?.find((node) => node.id === state.selectedNodeId);
    return selected && !selected.revealRole && !selected.item.ghost && !state.busyPairs?.has(selected.id)
      ? selected.item
      : null;
  }

  function syncWordChoice(button, item, selected, state) {
    const active = Boolean(selected && inventoryKey(selected) === inventoryKey(item));
    button.dataset.selected = String(active);
    button.setAttribute("aria-pressed", String(active));
    const unavailable = state.finished || state.pause.active || state.reveal.active || state.reveal.pending || item.ghost;
    const startingNote = item.source === "loaned-start" ? " This starting word is only for this game." : "";
    const action = selected
      ? `Choose ${item.word} to combine with ${selected.word}.`
      : `Choose ${item.word}, then choose another word to combine.`;
    button.setAttribute("aria-label", item.ghost
      ? `${item.word}, temporary answer word. Not playable.`
      : unavailable
        ? `${item.word}. Not available right now.`
        : `${active ? `${item.word} selected as your first word. ` : ""}${action}${startingNote}`);
    button.title = unavailable ? "" : `${action} You can also drag it onto a board word.${startingNote}`;
  }

  function syncSelection() {
    const state = getState();
    const selected = selectedIngredient(state);
    const words = new Map(state.words.map((item) => [inventoryKey(item), item]));
    for (const button of els.wordList.querySelectorAll(".inventory-word")) {
      const item = words.get(button.dataset.word);
      if (item) syncWordChoice(button, item, selected, state);
    }
  }

  function renderInventory() {
    const state = getState();
    const wordOrbitRuntime = getWordOrbitRuntime();
    const combiningBoardRuntime = getCombiningBoardRuntime();

    if (spatialBloomSelectorActive()) {
      wordOrbitRuntime?.render();
      combiningBoardRuntime?.sync(combiningBoardView());
      state.inventoryFocusWord = "";
      return updateHud();
    }
    const focusedWord = els.wordList.contains(document.activeElement)
      ? document.activeElement.closest?.(".inventory-word")?.dataset.word || ""
      : "";
    const visible = orderInventory(state.words, {
      starters: state.game?.starters || ["Earth", "Water", "Fire", "Air"],
      recent: recentInventoryWords(),
      query: state.inventoryQuery
    });
    state.inventoryVisibleCount = visible.length;
    const selected = selectedIngredient(state);
    const controls = visible.map((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `inventory-word${["wish", "market"].includes(item.source) ? " wish" : ""}${item.source === "gift" ? " gift" : ""}${item.source === "twist" ? " twist" : ""}${item.source === "worldword" || item.source === "worldweaving" ? " worldword" : ""}${item.source === "loaned-start" ? " loaned" : ""}${item.ghost ? " reveal-ghost" : ""}${senseWordActive(item) ? " sense-hot" : ""}${firstOrbitWordActive(item) ? " tutorial-hot" : ""}`;
      button.dataset.word = inventoryKey(item);
      button.dataset.category = visualWordCategory(item.category);
      button.dataset.source = visualWordToken(item.source);
      const revealLocked = state.reveal.active || state.reveal.pending;
      const unavailable = state.finished || state.pause.active || revealLocked || item.ghost;
      button.draggable = false;
      button.disabled = unavailable;
      syncWordChoice(button, item, selected, state);
      const tag = item.ghost ? "REVEALED" : item.source === "loaned-start" ? "START" : item.source === "gift" ? "GIFT" : item.source === "twist" ? "TWIST" : item.source === "worldword" || item.source === "worldweaving" ? "WORLDWORD" : item.source === "wish" ? "WISH" : item.source === "market" ? "VAULT" : item.source?.startsWith("ai") ? "AI" : "";
      const masteryStars = masteryStarsForWord(item.word);
      button.innerHTML = `<span class="emoji">${escapeHtml(item.emoji)}</span><span class="word">${escapeHtml(item.word)}</span>${tag ? `<span class="source-tag">${tag}</span>` : ""}${masteryStars ? `<span class="mastery-tag" aria-label="${masteryStars} recipe mastery stars">★${masteryStars}</span>` : ""}`;
      let suppressClickUntil = 0;
      button.addEventListener("click", (event) => {
        if (performance.now() < suppressClickUntil) {
          event.preventDefault();
          return;
        }
        void activateTrayItem(item);
      });
      button.addEventListener("pointerdown", (event) => startTrayPointerDrag(event, item, button, () => {
        suppressClickUntil = performance.now() + 650;
      }));
      return button;
    });
    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "inventory-empty";
      empty.textContent = state.inventoryQuery ? `No discoveries match “${state.inventoryQuery}”.` : "Your discoveries will gather here.";
      controls.push(empty);
    }
    els.wordList.replaceChildren(...controls);
    document.querySelector(".inventory")?.classList.toggle("has-many-words", state.words.length >= 12);
    if (els.inventorySearch.value !== state.inventoryQuery) els.inventorySearch.value = state.inventoryQuery;
    els.inventorySearchClear.hidden = !state.inventoryQuery;
    els.inventorySearchStatus.textContent = state.inventoryQuery
      ? visible.length
        ? `${visible.length} of ${state.words.length} discovered words shown.`
        : `No discovered words match “${state.inventoryQuery}”.`
      : `${state.words.length} discovered words.`;
    if (focusedWord) {
      const restoredFocus = [...els.wordList.querySelectorAll(".inventory-word")].find((button) => button.dataset.word === focusedWord);
      if (restoredFocus && !restoredFocus.disabled) restoredFocus.focus({ preventScroll: true });
      else els.inventorySearch.focus({ preventScroll: true });
    }
    const focusKey = state.inventoryFocusWord;
    if (focusKey) {
      const focusElement = [...els.wordList.querySelectorAll(".inventory-word")].find((button) => button.dataset.word === focusKey);
      if (focusElement) {
        focusElement.classList.add("new-discovery");
        requestAnimationFrame(() => focusElement.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }));
        setTimeout(() => focusElement.classList.remove("new-discovery"), 1000);
      }
      state.inventoryFocusWord = "";
    }
    updateHud();
  }

  renderInventory.syncSelection = syncSelection;
  return renderInventory;
}
