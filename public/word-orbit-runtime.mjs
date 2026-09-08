import {
  WORD_BLOOM_CATEGORIES,
  WORD_BLOOM_SEMANTIC_FACETS,
  availableWordBloomFacets,
  boundedWordBloomFacetWindow,
  boundedWordBloomWindow,
  normalizeWordBloomFacet,
  wordBloomCategoryItems,
  wordBloomFacetLayout,
  wordBloomOrbitLayout
} from "./word-orbit.mjs?v=5.0.0-beta.4";
import {
  applyBloomWordFocus,
  bloomItemUnavailable as unavailable,
  bloomListHas as listHas,
  buildConstellationBloom,
  bloomPaletteMetrics,
  createBloomTransitions,
  positionConstellationBloom,
  queryBloomElements,
  renderBloomCategories,
  renderBloomLinks
} from "./word-bloom-view.mjs?v=5.0.0-beta.4";
import { bindBloomOrbInput, createBloomFocusController, createBloomRelocator } from "./word-bloom-input-runtime.mjs?v=5.0.0-beta.4";

const text = (value) => String(value ?? "");
const key = (value) => text(value?.word ?? value?.id ?? value).normalize("NFKC").trim().toLocaleLowerCase("en");

export function createWordOrbitRuntime({
  root = globalThis.document,
  elements = {},
  getSnapshot,
  onChoose,
  onCancelAnchor,
  onCloseLens,
  onQueryChange,
  onVisibleCount,
  onActivity
} = {}) {
  if (typeof getSnapshot !== "function") throw new TypeError("createWordOrbitRuntime requires getSnapshot().");
  const els = queryBloomElements(root, elements);
  const doc = root?.ownerDocument || root || globalThis.document;
  const bloom = buildConstellationBloom(doc, els.board);
  const listeners = [];
  let stage = "closed";
  let visualStage = "closed";
  let category = null;
  let categoryParent = "categories";
  let lastWordCategory = null;
  let queryReturn = null;
  let page = 0;
  let facetPage = 0;
  let focusIndex = -1;
  let query = text(getSnapshot()?.query);
  let lastExternalQuery = query;
  let choosing = false;
  let forcedBusy = false;
  let destroyed = false;
  let currentWindow = { items: [], page: 0, pageCount: 1 };
  let currentFacetWindow = { items: [], page: 0, pageCount: 1 };
  let currentLayout = [];
  let currentPalette = null;
  let currentCategoryEntries = [];
  let currentCategoryLayout = [];
  let commitKey = "";
  let commitAnimating = false;
  let bloomOrigin = null;
  let hubVisible = true;
  const categoryButtons = new Map(WORD_BLOOM_CATEGORIES.map((entry) => [entry.id, null]));
  const wordButtons = new Map();
  let emptyMessage = null;
  const semanticFacetById = new Map(WORD_BLOOM_SEMANTIC_FACETS.map((entry) => [entry.id, entry]));
  const viewWindow = doc.defaultView || globalThis;

  const listen = (element, type, handler, options) => {
    if (!element || typeof element.addEventListener !== "function") return;
    element.addEventListener(type, handler, options);
    listeners.push(() => element.removeEventListener(type, handler, options));
  };
  const snapshot = () => ({ words: [], starters: [], recent: [], newWords: [], spotlightWords: [], ...getSnapshot() });
  const activity = (type, detail = {}) => onActivity?.({ type, ...detail });
  const externallyBusy = (view) => Boolean(forcedBusy || view.busy);
  const busy = (view) => Boolean(externallyBusy(view) || choosing);
  const announce = (message) => { bloom.status.textContent = message; };
  const categoryLabel = (id) => WORD_BLOOM_CATEGORIES.find((entry) => entry.id === id)?.label
    || semanticFacetById.get(normalizeWordBloomFacet(id))?.label
    || (normalizeWordBloomFacet(id) === "all" ? "All discovered words" : "Words");
  const transitions = createBloomTransitions({
    bloom,
    viewWindow,
    onSwap: swapTransition,
    onSettle: settleTransition
  });

  function swapTransition(transition) {
    visualStage = transition?.to || stage;
    if (!destroyed) render();
  }

  function settleTransition(finished) {
    if (destroyed) return;
    visualStage = finished?.to || stage;
    render();
  }

  const focusController = createBloomFocusController({
    bloom,
    viewWindow,
    isDestroyed: () => destroyed,
    getCategoryButton: () => categoryButtons.get(category)
  });

  function setStage(next, { announce: message = "", focus = false, source = null, transitionKind = "" } = {}) {
    const previous = visualStage;
    if (next === "categories" && stage === "closed") {
      category = snapshot().tutorial ? "all" : lastWordCategory || "all";
      categoryParent = normalizeWordBloomFacet(category) ? "browse" : "categories";
      query = "";
      lastExternalQuery = "";
      onQueryChange?.("");
      next = "words";
    }
    stage = ["closed", "categories", "browse", "words", "search"].includes(next) ? next : "closed";
    if (stage !== "closed") hubVisible = true;
    if (message) announce(message);
    const kind = transitionKind || (stage === "closed" ? "closing" : previous === "closed" ? "opening" : `${previous}-to-${stage}`);
    const duration = kind === "category-commit" ? 160 : kind === "opening" ? 160 : 120;
    const handoff = transitions.begin(previous, stage, { source, kind, duration });
    render();
    if (stage === "closed") handoff.then(() => {
      if (stage !== "closed" || destroyed) return;
      category = null;
      categoryParent = "categories";
      page = 0;
      facetPage = 0;
      focusIndex = -1;
      render();
    });
    if (focus) {
      const target = typeof focus === "string" ? focus : stage === "search" ? "search" : ["categories", "browse"].includes(stage) ? "category" : stage === "words" ? "first-word" : "trigger";
      handoff.then(() => focusController.request(target));
    }
    return handoff;
  }

  function setQuery(value, { announceChange = true } = {}) {
    const previousPage = page;
    query = text(value).trimStart().slice(0, 60);
    lastExternalQuery = query;
    page = 0;
    focusIndex = -1;
    if (query && stage !== "search") {
      queryReturn = { stage, category, categoryParent, page: previousPage };
      category = "search";
      stage = "search";
    } else if (!query && stage === "search") {
      const previous = queryReturn || { stage: "words", category: lastWordCategory || "all", categoryParent: "browse" };
      stage = previous.stage;
      category = previous.category;
      categoryParent = previous.categoryParent;
      page = previous.page || 0;
      queryReturn = null;
    }
    // Typing is immediate: do not make results inert for an animation on every key.
    transitions.clear();
    visualStage = stage;
    onQueryChange?.(query);
    render();
    if (announceChange) {
      activity("search", { query });
      announce(query ? `${currentWindow.total || 0} search results.` : "Search cleared.");
    }
    return Promise.resolve();
  }

  function chooseCategory(next, source = categoryButtons.get(next)) {
    page = 0;
    focusIndex = -1;
    if (next === "search") {
      category = query ? "search" : null;
      categoryParent = "browse";
      facetPage = 0;
      activity("category", { category: "search" });
      return setStage(query ? "search" : "browse", {
        announce: query ? "Search results opened." : "Browse the categories available in your discovered words, or type to search.",
        focus: query ? "first-word" : "category",
        source,
        transitionKind: "category-commit"
      });
    }
    const semantic = normalizeWordBloomFacet(next);
    category = semantic || next;
    lastWordCategory = category;
    categoryParent = semantic ? "browse" : "categories";
    setStage("words", {
      announce: `${categoryLabel(category)} opened.`,
      focus: "first-word",
      source,
      transitionKind: "category-commit"
    });
    activity("category", { category });
  }

  function returnToParent({ announceChange = false, focus = true } = {}) {
    if (stage === "search" && query) {
      setQuery("", { announceChange: false });
      if (announceChange) announce("Search cleared. Browse your word categories.");
      if (focus) focusController.request(stage === "words" ? "first-word" : "category");
      return;
    }
    if (stage === "search") {
      category = null;
      return setStage("browse", { announce: "Browse your word categories.", focus: focus && "category" });
    }
    if (stage === "words" && categoryParent === "browse" && query) {
      setQuery("", { announceChange: false });
      if (announceChange) announce(`${categoryLabel(category)} filter cleared.`);
      if (focus) focusController.request("first-word");
      return;
    }
    if (stage === "words" && categoryParent === "browse") {
      page = 0;
      focusIndex = -1;
      return setStage("browse", { announce: "Browse your word categories.", focus: focus && "category" });
    }
    if (stage === "browse") {
      category = "search";
      return setStage("categories", { announce: "Word directions.", focus: focus && "category" });
    }
    if (stage === "words") return setStage("categories", { announce: "Word categories.", focus: focus && "category" });
    return setStage("closed", { announce: "Word constellation closed.", focus: focus && "trigger" });
  }

  async function choose(item, source) {
    const view = snapshot();
    if (destroyed || choosing || busy(view) || unavailable(view, item)) return;
    choosing = true;
    commitAnimating = true;
    commitKey = key(item);
    activity("choose", { item, source: "bloom", category, query });
    announce(`${text(item.word)} selected.`);
    const previous = visualStage;
    if (category && category !== "search") lastWordCategory = category;
    stage = "closed";
    const motion = transitions.begin(previous, "closed", { source, kind: "word-commit", duration: 160 });
    render();
    let canonicalChoice;
    try {
      canonicalChoice = Promise.resolve(onChoose?.(item, { source: "bloom", anchor: view.anchor || null, category, query }))
        .then((value) => ({ value }), (error) => ({ error }));
    } catch (error) {
      canonicalChoice = Promise.resolve({ error });
    }
    await motion;
    commitAnimating = false;
    commitKey = "";
    stage = "closed";
    category = null;
    page = 0;
    focusIndex = -1;
    bloomOrbInput.reset();
    if (!destroyed) render();
    const outcome = await canonicalChoice;
    if (outcome?.error) {
      announce("That word could not be selected. Try again.");
      activity("error", { error: outcome.error, item });
    } else {
      announce(view.anchor ? `${text(item.word)} fused.` : `${text(item.word)} selected. Choose the next ingredient.`);
    }
    choosing = false;
    if (!destroyed) {
      const nextView = snapshot();
      if (!outcome?.error && !view.anchor && nextView.anchor && !externallyBusy(nextView)) {
        category = nextView.tutorial ? "all" : lastWordCategory || "all";
        categoryParent = normalizeWordBloomFacet(category) ? "browse" : "categories";
        query = "";
        queryReturn = null;
        lastExternalQuery = "";
        onQueryChange?.("");
        stage = "words";
        visualStage = "words";
        render();
        focusController.request("first-word");
      } else {
        render();
        focusController.request("trigger");
      }
    }
  }

  function categoryItems(view) {
    const items = wordBloomCategoryItems({
      words: view.words,
      category: view.tutorial ? "all" : category || "basics",
      starters: view.starters,
      recent: view.recent,
      newWords: view.newWords,
      query: category === "search" || normalizeWordBloomFacet(category) ? query : ""
    });
    return view.tutorial && view.spotlightWords?.length
      ? items.filter((item) => listHas(view.spotlightWords, item))
      : items;
  }

  function clearWordButtons() {
    for (const button of wordButtons.values()) (button.closest?.(".constellation-bloom__word-shell") || button).remove?.();
    wordButtons.clear();
    emptyMessage?.remove?.();
    emptyMessage = null;
  }

  function renderWords(view, boardRect, { keepVisible = false, displayStage = stage } = {}) {
    if (keepVisible) {
      for (const button of bloom.words.querySelectorAll(".constellation-bloom__word")) button.disabled = true;
      return currentLayout;
    }
    if (!["words", "search"].includes(displayStage)) {
      currentWindow = { items: [], page: 0, pageCount: 1 };
      currentLayout = [];
      clearWordButtons();
      return [];
    }
    const items = categoryItems(view);
    currentPalette = bloomPaletteMetrics({ boardRect, visualViewport: viewWindow.visualViewport, count: items.length });
    currentWindow = boundedWordBloomWindow({ items, page, pageSize: currentPalette.pageSize });
    page = currentWindow.page;
    onVisibleCount?.(items.length);
    focusIndex = Math.min(focusIndex, currentWindow.items.length - 1);
    const layout = wordBloomOrbitLayout({
      count: currentWindow.items.length,
      width: boardRect.width,
      height: boardRect.height,
      focusIndex,
      compact: view.layout === "short-landscape"
    });
    currentLayout = layout;
    const activeKeys = new Set(currentWindow.items.map((item, index) => `${key(item)}::${index}`));
    for (const [itemId, button] of wordButtons) {
      if (activeKeys.has(itemId)) continue;
      (button.closest?.(".constellation-bloom__word-shell") || button).remove?.();
      wordButtons.delete(itemId);
    }
    const children = currentWindow.items.map((item, index) => {
      const position = layout[index];
      const itemId = `${key(item)}::${index}`;
      let button = wordButtons.get(itemId);
      if (!button) {
        const shell = doc.createElement("div");
        shell.className = "constellation-bloom__word-shell";
        button = doc.createElement("button");
        button.type = "button";
        button.className = "constellation-bloom__word";
        const visual = doc.createElement("span");
        visual.className = "constellation-bloom__petal-visual";
        visual.setAttribute("aria-hidden", "true");
        const emoji = doc.createElement("span");
        emoji.className = "constellation-bloom__petal-mark";
        const label = doc.createElement("strong");
        label.className = "constellation-bloom__petal-label";
        visual.append(emoji, label);
        button.append(visual);
        button.addEventListener("pointerenter", () => {
          const nextIndex = Number(button.dataset.bloomIndex);
          if (focusIndex !== nextIndex) syncWordFocus(nextIndex);
        });
        button.addEventListener("pointerleave", () => {
          if (doc.activeElement !== button && focusIndex === Number(button.dataset.bloomIndex)) syncWordFocus(-1);
        });
        button.addEventListener("focus", () => {
          const nextIndex = Number(button.dataset.bloomIndex);
          if (focusIndex !== nextIndex) syncWordFocus(nextIndex);
        });
        button.addEventListener("click", () => void choose(button.__bloomItem, button));
        shell.append(button);
        wordButtons.set(itemId, button);
      }
      button.__bloomItem = item;
      button.className = "constellation-bloom__word";
      button.dataset.word = key(item);
      button.dataset.bloomIndex = String(index);
      if (index === focusIndex) button.setAttribute("aria-current", "true");
      button.setAttribute("aria-label", view.anchor ? `Fuse ${text(view.anchor.word)} with ${text(item.word)}` : `Choose ${text(item.word)} as the first word`);
      button.disabled = busy(view) || Boolean(transitions.current) || unavailable(view, item);
      if (index === focusIndex) button.classList.add("is-focused");
      if (view.anchor && key(view.anchor) === key(item)) button.classList.add("is-repeat");
      if (listHas(view.spotlightWords, item)) button.classList.add("tutorial-hot");
      const shell = button.closest?.(".constellation-bloom__word-shell") || button;
      shell.style.setProperty("--word-x", `${position.x}px`);
      shell.style.setProperty("--word-y", `${position.y}px`);
      shell.style.setProperty("--word-layout-scale", position.scale);
      shell.style.setProperty("--bloom-index", String(index));
      button.style.setProperty("--bubble-focus-scale", index === focusIndex ? "1.11" : "1");
      button.style.setProperty("--bloom-sway-duration", `${4.35 + (index % 5) * .31}s`);
      button.style.setProperty("--bloom-sway-delay", `${-(index * .53 + .29)}s`);
      button.style.setProperty("--bloom-sway-x", `${index % 2 ? -.5 : .5}px`);
      button.style.setProperty("--bloom-sway-y", `${index % 3 ? .35 : -.35}px`);
      button.style.setProperty("--bloom-sway-angle", `${index % 2 ? -.62 : .62}deg`);
      button.querySelector(".constellation-bloom__petal-mark").textContent = text(item.emoji) || "\u2726";
      button.querySelector(".constellation-bloom__petal-label").textContent = text(item.word);
      button.style.setProperty("--bloom-index", String(index));
      button.classList.toggle("is-committing", commitAnimating && commitKey === key(item));
      shell.classList.toggle("is-committing", commitAnimating && commitKey === key(item));
      return button;
    });
    if (!children.length) {
      emptyMessage ||= doc.createElement("p");
      emptyMessage.className = "constellation-bloom__empty";
      emptyMessage.textContent = query ? `No words match \u201c${query}\u201d.` : "No words here yet. Try another direction.";
      if (!emptyMessage.parentNode) bloom.words.append(emptyMessage);
    } else {
      emptyMessage?.remove?.();
      emptyMessage = null;
    }
    bloom.words.append(...children.map((button) => button.closest?.(".constellation-bloom__word-shell") || button));
    return layout;
  }

  function syncWordFocus(index) {
    focusIndex = index;
    const boardHeight = els.board?.clientHeight || 360;
    const compact = snapshot().layout === "short-landscape" || boardHeight <= 210;
    const focusedScale = boardHeight <= 154 ? 1.08 : 1.11;
    applyBloomWordFocus(bloom.words.querySelectorAll(".constellation-bloom__word"), index, focusedScale);
  }

  function render() {
    if (destroyed) return;
    const view = snapshot();
    const cinematicPhase = ["result", "reveal"].includes(view.phase);
    const spatialBrowserEnabled = view.mobile !== false || view.observatory === true;
    const visible = spatialBrowserEnabled && ((!externallyBusy(view) && !cinematicPhase) || commitAnimating);
    bloom.root.hidden = !visible;
    els.gameScreen?.setAttribute("data-word-input", visible ? "bloom" : "inventory");
    if (!visible) {
      transitions.clear();
      stage = "closed";
      visualStage = "closed";
      bloomOrbInput.reset();
      focusController.reset();
      bloom.root.dataset.stage = "closed";
      els.gameScreen?.setAttribute("data-bloom-stage", "closed");
      return;
    }
    if (view.lensOpen) onCloseLens?.({ reason: "bloom", restoreFocus: false });
    const externalQuery = text(view.query);
    if (externalQuery !== lastExternalQuery) {
      query = externalQuery;
      lastExternalQuery = externalQuery;
      page = 0;
    }
    const boardRect = els.board?.getBoundingClientRect?.() || { width: 320, height: 400, left: 0, top: 0 };
    bloom.links.setAttribute("viewBox", `0 0 ${Math.max(1, boardRect.width)} ${Math.max(1, boardRect.height)}`);
    const compact = view.layout === "short-landscape" || boardRect.height < 230;
    const transition = transitions.current;
    const outgoing = transition?.phase === "out";
    const displayStage = outgoing ? transition.from : stage;
    const scopedSearchOpen = displayStage === "words" && categoryParent === "browse";
    const radiusX = Math.max(58, Math.min(compact ? 76 : 94, boardRect.width / 2 - 38));
    const radiusY = compact
      ? Math.max(44, Math.min(54, boardRect.height / 2 - 22))
      : Math.max(62, Math.min(82, boardRect.height / 2 - 38));
    bloom.root.dataset.stage = displayStage;
    bloom.root.dataset.categoryParent = categoryParent;
    els.gameScreen?.setAttribute("data-bloom-stage", displayStage);
    const categoryLayerStage = ["categories", "browse"].includes(displayStage) ? displayStage : stage;
    const showCategories = ["categories", "browse"].includes(displayStage);
    const showWords = ["words", "search"].includes(displayStage);
    const panelVisible = displayStage !== "closed" || Boolean(transition);
    bloom.panel.hidden = !panelVisible;
    bloom.panel.inert = stage === "closed" || busy(view);
    bloom.trigger.setAttribute("aria-expanded", String(stage !== "closed"));
    bloom.trigger.hidden = false;
    bloom.trigger.disabled = busy(view) || Boolean(transitions.current);
    bloom.trigger.classList.toggle("has-anchor", Boolean(view.anchor));
    bloom.triggerStar.textContent = displayStage === "closed" ? text(view.anchor?.emoji) || "\u2726" : "\u00d7";
    bloom.triggerKicker.textContent = view.anchor ? text(view.anchor.word).toLocaleUpperCase("en") : "CHOOSE";
    bloom.triggerLabel.textContent = displayStage === "closed" ? view.anchor ? "Combine with…" : "Add word" : "Close";
    bloom.trigger.setAttribute("aria-label", displayStage === "closed"
      ? view.anchor ? `Choose a word to combine with ${text(view.anchor.word)}` : "Add a word"
      : "Close word picker");
    bloom.cancel.hidden = !view.anchor || displayStage !== "closed";
    bloom.cancel.disabled = busy(view) || Boolean(transitions.current);
    bloom.cancel.setAttribute("aria-label", view.anchor ? `Cancel ${text(view.anchor.word)} selection` : "Cancel the armed word");
    bloom.categories.hidden = !showCategories;
    bloom.categories.inert = !["categories", "browse"].includes(displayStage) || Boolean(transition);
    bloom.categories.setAttribute("aria-label", displayStage === "browse" ? "Available word categories" : "Word categories");
    bloom.searchWrap.hidden = displayStage === "closed";
    bloom.words.hidden = !showWords;
    bloom.words.inert = !["words", "search"].includes(displayStage) || busy(view) || Boolean(transition);
    bloom.back.hidden = false;
    bloom.back.textContent = ["categories", "browse"].includes(displayStage) ? "Words" : "Groups";
    bloom.back.disabled = busy(view) || Boolean(transition);
    bloom.back.setAttribute("aria-label", ["categories", "browse"].includes(displayStage) ? "Back to words" : "Browse word groups");
    bloom.kicker.textContent = view.anchor ? "NEXT INGREDIENT" : "YOUR WORDS";
    bloom.title.textContent = view.anchor ? `Combine with ${text(view.anchor.word)}` : "Choose a word";
    const availableFacets = availableWordBloomFacets({ words: view.words });
    const allWordCount = wordBloomCategoryItems({
      words: view.words,
      category: "all",
      starters: view.starters,
      recent: view.recent,
      newWords: view.newWords
    }).length;
    const facetPalette = bloomPaletteMetrics({ boardRect, visualViewport: viewWindow.visualViewport, count: availableFacets.length + 1, ceiling: 6 });
    if (!outgoing) currentFacetWindow = facetPalette.pageSize === 1
      ? boundedWordBloomWindow({ items: [...boundedWordBloomFacetWindow({ facets: [], wordCount: allWordCount }).items, ...availableFacets], page: facetPage, pageSize: 1 })
      : boundedWordBloomFacetWindow({
      facets: availableFacets,
      wordCount: allWordCount,
      page: facetPage,
      pageSize: facetPalette.pageSize
    });
    if (!outgoing) facetPage = currentFacetWindow.page;
    if (!outgoing) currentCategoryLayout = categoryLayerStage === "browse"
      ? wordBloomFacetLayout({ count: currentFacetWindow.items.length, width: boardRect.width, height: boardRect.height, compact })
      : [];
    if (!outgoing) currentCategoryEntries = categoryLayerStage === "browse"
      ? currentFacetWindow.items.map((entry, index) => ({
          ...entry,
          offsetX: currentCategoryLayout[index]?.x || 0,
          offsetY: currentCategoryLayout[index]?.y || 0
        }))
      : view.tutorial
        ? WORD_BLOOM_CATEGORIES.filter(({ id }) => id === "basics")
        : WORD_BLOOM_CATEGORIES;
    const categoryVectors = showCategories ? renderBloomCategories({
      entries: currentCategoryEntries,
      buttons: categoryButtons,
      doc,
      container: bloom.categories,
      view,
      radiusX,
      radiusY,
      highlight: bloomOrbInput.highlight,
      disabled: busy(view) || !["categories", "browse"].includes(stage) || Boolean(transitions.current),
      onChoose: chooseCategory
    }) : [];
    const layout = renderWords(view, boardRect, { keepVisible: outgoing, displayStage });
    const pageModel = displayStage === "browse" ? currentFacetWindow : currentWindow;
    bloom.count.textContent = displayStage === "browse"
      ? availableFacets.length
        ? `${availableFacets.length} ${availableFacets.length === 1 ? "group" : "groups"}`
        : `${allWordCount} ${allWordCount === 1 ? "word" : "words"}`
      : ["words", "search"].includes(displayStage) ? `${currentWindow.total || 0}` : "";
    bloom.pager.hidden = !["browse", "words", "search"].includes(displayStage) || pageModel.pageCount <= 1;
    bloom.pager.setAttribute("aria-label", displayStage === "browse" ? "More word categories" : "More words");
    bloom.previous.disabled = !pageModel.hasPrevious;
    bloom.next.disabled = !pageModel.hasNext;
    bloom.page.textContent = `${pageModel.page + 1} / ${pageModel.pageCount}`;
    if (bloom.search.value !== query) bloom.search.value = query;
    bloom.search.disabled = busy(view);
    bloom.searchClear.disabled = busy(view);
    bloom.search.setAttribute("aria-label", "Search available words");
    bloom.searchWrap.classList.toggle("has-query", Boolean(query));
    bloom.searchClear.hidden = !query;
    bloom.search.placeholder = "Search words…";
    const placementStage = showCategories ? categoryLayerStage : displayStage;
    const placementLayout = categoryLayerStage === "browse" ? currentCategoryLayout : layout;
    const origin = positionConstellationBloom({
      bloom,
      board: els.board,
      view,
      boardRect,
      layout: placementLayout,
      radiusX,
      radiusY,
      stage: scopedSearchOpen ? "search" : placementStage,
      origin: bloomOrigin,
      contentCount: showCategories ? currentCategoryEntries.length : currentWindow.items.length,
      hasPages: pageModel.pageCount > 1,
      paletteMetrics: showCategories ? facetPalette : currentPalette
    });
    renderBloomLinks(doc, bloom.links, null, []);
  }

  const relocateBloom = createBloomRelocator({
    bloom,
    snapshot,
    busy,
    isDestroyed: () => destroyed,
    getStage: () => stage,
    getVisualStage: () => visualStage,
    getOpeningStage: () => {
      category = snapshot().tutorial ? "all" : lastWordCategory || "all";
      categoryParent = normalizeWordBloomFacet(category) ? "browse" : "categories";
      query = "";
      lastExternalQuery = "";
      onQueryChange?.("");
      return "words";
    },
    setActiveStage: (next) => { hubVisible = true; stage = next; },
    setOrigin: (next) => { bloomOrigin = next; },
    transitions,
    render,
    announce,
    activity
  });

  const bloomOrbInput = bindBloomOrbInput({
    bloom,
    board: els.board,
    listen,
    snapshot,
    busy,
    getStage: () => stage,
    setStage,
    chooseCategory,
    returnToParent,
    getCategoryButtons: () => categoryButtons,
    getCategoryLayout: () => currentCategoryLayout,
    getCategoryEntries: () => currentCategoryEntries,
    getCurrentWindowItems: () => currentWindow.items,
    getFocusIndex: () => focusIndex,
    syncWordFocus,
    activity,
    render,
    navigatorRef: globalThis.navigator
  });
  function dismissFromBoard() {
    const view = snapshot();
    hubVisible = true;
    if (view.anchor) {
      activity("cancel-anchor", { source: "board", anchor: view.anchor });
      onCancelAnchor?.({ source: "board", anchor: view.anchor });
      announce(`${text(view.anchor.word)} selection cancelled.`);
    } else if (stage !== "closed") {
      announce("Word constellation closed.");
    }
    if (stage !== "closed") setStage("closed");
    else render();
  }

  function relocateFromBoard(origin, options = {}) {
    hubVisible = true;
    return relocateBloom(origin, options);
  }
  listen(bloom.cancel, "click", (event) => {
    event.stopPropagation();
    const view = snapshot();
    if (!view.anchor || busy(view)) return;
    activity("cancel-anchor", { anchor: view.anchor });
    try {
      onCancelAnchor?.({ source: "bloom", anchor: view.anchor });
      announce(`${text(view.anchor.word)} selection cancelled.`);
    } catch (error) {
      announce("The selection could not be cancelled. Try again.");
      activity("error", { error, anchor: view.anchor });
      return;
    }
    setStage("closed", { focus: "trigger" });
  });
  listen(bloom.back, "click", () => {
    if (query) setQuery("", { announceChange: false });
    if (["categories", "browse"].includes(stage)) {
      category = snapshot().tutorial ? "all" : lastWordCategory || "all";
      categoryParent = normalizeWordBloomFacet(category) ? "browse" : "categories";
      setStage("words", { focus: "first-word" });
    } else setStage("categories", { focus: "category" });
  });
  listen(bloom.search, "input", (event) => setQuery(event.currentTarget.value));
  listen(bloom.searchClear, "click", () => { setQuery(""); bloom.search.focus({ preventScroll: true }); });
  function changePage(delta, control) {
    const previousStage = stage;
    if (stage === "browse") facetPage = Math.max(0, facetPage + delta);
    else page = Math.max(0, page + delta);
    focusIndex = -1;
    bloom.words.scrollTop = 0;
    bloom.categories.scrollTop = 0;
    const motion = transitions.begin(visualStage, stage, { kind: "page-change", duration: 140, force: true });
    render();
    motion.then(() => {
      if (destroyed || stage !== previousStage) return;
      focusController.request(control.disabled ? stage === "browse" ? "category" : "first-word" : control);
    });
  }
  listen(bloom.previous, "click", () => changePage(-1, bloom.previous));
  listen(bloom.next, "click", () => changePage(1, bloom.next));
  listen(bloom.root, "keydown", (event) => {
    const target = event.target?.closest?.(".constellation-bloom__word, .constellation-bloom__category");
    if (!target || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const container = target.closest(".constellation-bloom__words, .constellation-bloom__categories");
    const buttons = [...container.querySelectorAll("button:not(:disabled)")];
    const index = buttons.indexOf(target);
    if (index < 0) return;
    const columns = Number(bloom.root.dataset.columns) || 2;
    const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key] || 0;
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + offset));
    event.preventDefault();
    event.stopPropagation();
    buttons[next]?.focus({ preventScroll: true });
  });
  listen(doc, "keydown", (event) => {
    const view = snapshot();
    if (event.key !== "Escape" || stage === "closed" || !(view.mobile || view.observatory)) return;
    event.preventDefault();
    event.stopPropagation();
    returnToParent({ announceChange: true, focus: true });
  }, true);
  listen(doc, "click", (event) => {
    if (stage === "closed" || bloom.root.contains(event.target)) return;
    if (event.target?.closest?.(".board-word, #mobileToolsToggle, #mobileAssistToggle, #playSoundToggle, #menuButton, [aria-haspopup='dialog']")) {
      setStage("closed");
    }
  }, true);
  listen(globalThis.visualViewport, "resize", () => { bloomOrbInput.reset(); render(); });
  listen(globalThis, "orientationchange", () => { bloomOrbInput.reset(); setStage("closed"); });
  const reducedMotionQuery = viewWindow.matchMedia?.("(prefers-reduced-motion: reduce)");
  listen(reducedMotionQuery, "change", () => { if (!transitions.finishIfReduced()) render(); });
  if (doc.body && typeof viewWindow.MutationObserver === "function") {
    const effectsObserver = new viewWindow.MutationObserver(() => { if (!transitions.finishIfReduced()) render(); });
    effectsObserver.observe(doc.body, { attributes: true, attributeFilter: ["data-cosmetic-effects"] });
    listeners.push(() => effectsObserver.disconnect());
  }

  return {
    render,
    reset({ query: nextQuery = text(getSnapshot()?.query) } = {}) {
      transitions.clear();
      query = text(nextQuery);
      lastExternalQuery = query;
      category = null;
      forcedBusy = false;
      choosing = false;
      commitAnimating = false;
      commitKey = "";
      bloomOrbInput.reset();
      focusController.reset();
      bloomOrigin = null;
      hubVisible = true;
      categoryParent = "categories";
      facetPage = 0;
      stage = "closed";
      visualStage = "closed";
      render();
      onQueryChange?.(query);
    },
    setBusy(value) { forcedBusy = Boolean(value); if (forcedBusy) { transitions.clear(); stage = "closed"; visualStage = "closed"; bloomOrbInput.reset(); focusController.reset(); } render(); },
    beforeDialog() { transitions.clear(); stage = "closed"; visualStage = "closed"; category = null; categoryParent = "categories"; facetPage = 0; bloomOrbInput.reset(); focusController.reset(); render(); },
    close({ restoreFocus = false } = {}) { setStage("closed", { focus: restoreFocus }); },
    dismissFromBoard,
    relocateFromBoard,
    get state() { return { stage, category, categoryParent, page, facetPage, focusIndex, query, origin: bloomOrigin && { ...bloomOrigin }, hubVisible }; },
    destroy() {
      destroyed = true;
      transitions.clear();
      focusController.reset();
      listeners.splice(0).forEach((remove) => remove());
      bloom.root.remove();
      els.gameScreen?.removeAttribute("data-word-input");
      els.gameScreen?.removeAttribute("data-bloom-stage");
      doc.body?.classList.remove("word-lens-open");
      for (const blocker of [els.board, els.gameScreen?.querySelector?.(".game-nav")]) if (blocker) blocker.inert = false;
    }
  };
}
