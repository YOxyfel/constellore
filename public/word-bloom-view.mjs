const itemKey = (value) => String(value?.word ?? value?.id ?? value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en");

export const BLOOM_BOARD_PROTECTED_SELECTOR = [
  ".constellation-bloom",
  ".board-word",
  ".board-quick-tools",
  ".mobile-assist-toggle",
  ".mobile-assist-surface",
  ".board-assistance-rail",
  ".rival-ghost",
  ".ghost-preview",
  ".tap-chain-status",
  ".board-undo",
  ".reveal-controller",
  ".recipe-feedback",
  ".expected-pair-feedback",
  ".help-nudge",
  ".board-top-hud",
  "button",
  "a[href]",
  "input",
  "select",
  "textarea",
  "summary",
  "[role='button']",
  "[role='link']",
  "[contenteditable='true']",
  "[data-no-bloom]"
].join(", ");

export function bloomBoardTapAllowed(target, board) {
  if (!target || !board) return false;
  if (target !== board && !board.contains?.(target)) return false;
  return !target.closest?.(BLOOM_BOARD_PROTECTED_SELECTOR);
}

export function bloomPointFromPointer(event, boardRect) {
  if (!Number.isFinite(event?.clientX) || !Number.isFinite(event?.clientY) || !boardRect) return null;
  return {
    x: event.clientX - Number(boardRect.left || 0),
    y: event.clientY - Number(boardRect.top || 0)
  };
}

export function bloomListHas(list, item) {
  const wanted = itemKey(item);
  const values = list instanceof Set ? [...list] : Array.isArray(list) ? list : [];
  return values.some((value) => itemKey(value) === wanted);
}

export function bloomItemUnavailable(view, item) {
  if (item?.ghost || item?.unavailable || item?.disabled) return true;
  const source = view.unavailable;
  if (typeof source === "function") return Boolean(source(item));
  if (typeof source === "boolean") return source;
  if (source instanceof Set || Array.isArray(source)) return bloomListHas(source, item);
  return Boolean(source && typeof source === "object" && (source[itemKey(item)] ?? source[item?.id]));
}

export function clampBloom(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function renderBloomCategories({ entries, buttons, doc, container, view, radiusX, radiusY, highlight, disabled, onChoose }) {
  const icons = { discoveries: "\u2726", used: "\u21ba", search: "\u2315", basics: "\u25c9" };
  const activeIds = new Set(entries.map(({ id }) => id));
  for (const [id, button] of buttons) {
    if (activeIds.has(id)) continue;
    (button?.closest?.(".constellation-bloom__category-shell") || button)?.remove?.();
    buttons.delete(id);
  }
  entries.forEach((entry, index) => {
    let button = buttons.get(entry.id);
    if (!button) {
      const shell = doc.createElement("div");
      shell.className = "constellation-bloom__category-shell";
      button = doc.createElement("button");
      button.type = "button";
      button.className = `constellation-bloom__category constellation-bloom__category--${entry.id}`;
      button.dataset.bloomCategory = entry.id;
      const visual = doc.createElement("span");
      visual.className = "constellation-bloom__petal-visual";
      visual.setAttribute("aria-hidden", "true");
      const mark = doc.createElement("span");
      mark.className = "constellation-bloom__petal-mark";
      const label = doc.createElement("strong");
      label.className = "constellation-bloom__petal-label";
      const count = doc.createElement("small");
      count.className = "constellation-bloom__category-count";
      visual.append(mark, label, count);
      button.append(visual);
      button.addEventListener("click", () => onChoose(entry.id, button));
      shell.append(button);
      buttons.set(entry.id, button);
      container.append(shell);
    }
    button.className = `constellation-bloom__category constellation-bloom__category--${entry.id}`;
    button.classList.toggle("is-semantic", Number.isFinite(entry.count));
    button.querySelector(".constellation-bloom__petal-mark").textContent = entry.icon || icons[entry.id] || "\u2726";
    button.querySelector(".constellation-bloom__petal-label").textContent = ({ discoveries: "New discoveries", used: "Recently used", search: "Browse groups", basics: "Starter words" })[entry.id] || entry.shortLabel;
    const count = button.querySelector(".constellation-bloom__category-count");
    count.textContent = Number.isFinite(entry.count) ? String(entry.count) : "";
    count.hidden = !Number.isFinite(entry.count);
    button.classList.toggle("is-focused", highlight === entry.id);
    button.classList.toggle("is-recommended", Boolean(view.tutorial && entry.id === "basics"));
    const x = Number.isFinite(entry.offsetX) ? entry.offsetX : entry.x * radiusX;
    const y = Number.isFinite(entry.offsetY) ? entry.offsetY : entry.y * radiusY;
    const shell = button.closest?.(".constellation-bloom__category-shell") || button;
    shell.style.setProperty("--petal-x", `${x}px`);
    shell.style.setProperty("--petal-y", `${y}px`);
    shell.style.setProperty("--bloom-index", String(index));
    button.style.setProperty("--bloom-index", String(index));
    button.style.setProperty("--bloom-sway-duration", `${4.2 + (index % 5) * .37}s`);
    button.style.setProperty("--bloom-sway-delay", `${-(index * .61 + .17)}s`);
    button.style.setProperty("--bloom-sway-x", `${index % 2 ? -.55 : .55}px`);
    button.style.setProperty("--bloom-sway-y", `${index % 3 ? .4 : -.4}px`);
    button.style.setProperty("--bloom-sway-angle", `${index % 2 ? -.72 : .72}deg`);
    button.setAttribute("aria-label", `${entry.label}${Number.isFinite(entry.count) ? `, ${entry.count} ${entry.count === 1 ? "word" : "words"}` : ""}${view.tutorial && entry.id === "basics" ? ", recommended" : ""}`);
    button.disabled = disabled;
  });
  return entries.map((entry) => ({
    x: Number.isFinite(entry.offsetX) ? entry.offsetX : entry.x * radiusX,
    y: Number.isFinite(entry.offsetY) ? entry.offsetY : entry.y * radiusY
  }));
}

export function syncBloomCategoryHighlight(buttons, next) {
  for (const [id, button] of buttons) button?.classList.toggle("is-focused", id === next);
}

export function applyBloomWordFocus(buttons, index, focusedScale) {
  for (const button of buttons) {
    const active = Number(button.dataset.bloomIndex) === index;
    button.classList.toggle("is-focused", active);
    if (active) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
    button.style.setProperty("--bubble-focus-scale", active ? String(focusedScale) : "1");
  }
}

export function bloomPaletteMetrics({ boardRect, visualViewport = null, count = 0, ceiling = 8 } = {}) {
  const viewportLeft = Number(visualViewport?.offsetLeft) || 0;
  const viewportTop = Number(visualViewport?.offsetTop) || 0;
  const left = Math.max(0, viewportLeft - boardRect.left);
  const top = Math.max(0, viewportTop - boardRect.top);
  const right = Math.min(boardRect.width, Number.isFinite(visualViewport?.width) ? viewportLeft + visualViewport.width - boardRect.left : boardRect.width);
  const bottom = Math.min(boardRect.height, Number.isFinite(visualViewport?.height) ? viewportTop + visualViewport.height - boardRect.top : boardRect.height);
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const horizontal = width >= 520 && height < 400;
  const dense = !horizontal && height < 350;
  const columns = horizontal ? 3 : width < 280 ? 1 : 2;
  const rowHeight = horizontal || dense ? 52 : 64;
  const gap = horizontal || dense ? 6 : 8;
  const narrowHeader = columns === 1 ? 48 : 0;
  const plainChrome = (horizontal ? 75 : dense ? 116 : 136) + narrowHeader;
  const pagedChrome = (horizontal ? 126 : dense ? 164 : 190) + narrowHeader;
  const maxHeight = Math.min(480, Math.max(1, height - 24));
  const rowsThatFit = (chrome) => Math.max(1, Math.floor((maxHeight - chrome + gap) / (rowHeight + gap)));
  const plainCapacity = Math.min(ceiling, rowsThatFit(plainChrome) * columns);
  const pageSize = count <= plainCapacity ? plainCapacity : Math.min(ceiling, rowsThatFit(pagedChrome) * columns);
  return { left, top, width, height, horizontal, dense, columns, rowHeight, gap, pageSize,
    panelWidth: Math.min(horizontal ? 680 : 380, Math.max(1, width - 24)),
    panelHeight(items, pages) {
      const rows = Math.ceil(Math.max(1, items) / columns);
      return Math.min(maxHeight, (pages ? pagedChrome : plainChrome) + rows * rowHeight + (rows - 1) * gap);
    }
  };
}

export function positionConstellationBloom({ bloom, board, view, boardRect, layout, radiusX, radiusY, stage, origin = null, contentCount = 4, hasPages = false, paletteMetrics = null }) {
  const anchorElement = view.anchorId == null ? null : board?.querySelector?.(`.board-word[data-id="${String(view.anchorId).replace(/"/g, "")}"]`);
  const anchorRect = anchorElement?.getBoundingClientRect?.();
  const localAnchor = anchorRect ? {
    x: anchorRect.left - boardRect.left + anchorRect.width / 2,
    y: anchorRect.top - boardRect.top + anchorRect.height / 2
  } : null;
  const compact = view.layout === "short-landscape" || boardRect.height < 230;
  const anchoredX = localAnchor
    ? localAnchor.x + (localAnchor.x < boardRect.width / 2 ? Math.min(92, boardRect.width * .25) : -Math.min(92, boardRect.width * .25))
    : boardRect.width * .5;
  const requestedOrigin = Number.isFinite(origin?.x) && Number.isFinite(origin?.y) ? origin : null;
  const desiredX = requestedOrigin?.x
    ?? (["browse", "search"].includes(stage) && compact ? boardRect.width * .69 : anchoredX);
  const desiredY = requestedOrigin?.y ?? localAnchor?.y ?? boardRect.height * (compact ? .55 : .62);
  const wordMarginX = layout.length
    ? Math.max(...layout.map(({ x }) => Math.abs(x))) + (compact ? 22 : 34)
    : radiusX + (compact ? 36 : 42);
  const wordMarginY = layout.length
    ? Math.max(...layout.map(({ y }) => Math.abs(y))) + (compact ? 22 : 34)
    : radiusY + (compact ? 22 : 42);
  const marginX = (stage === "closed" ? 92 : wordMarginX) + 7;
  const marginY = (stage === "closed" ? 58 : wordMarginY) + 7;
  const topReserve = ["browse", "search"].includes(stage) ? Math.min(138, boardRect.height * .34) : 8;
  const minY = Math.max(marginY, topReserve);
  const x = Math.round(boardRect.width < marginX * 2 ? boardRect.width / 2 : clampBloom(desiredX, marginX, boardRect.width - marginX));
  const y = Math.round(boardRect.height < minY + marginY ? boardRect.height / 2 : clampBloom(desiredY, minY, boardRect.height - marginY));
  const metrics = paletteMetrics || bloomPaletteMetrics({ boardRect, count: contentCount });
  const panelWidth = metrics.panelWidth;
  const panelHeight = metrics.panelHeight(contentCount, hasPages);
  let panelX = Math.max(metrics.left + 12, Math.min(x - panelWidth / 2, metrics.left + metrics.width - panelWidth - 12));
  let panelY = Math.max(metrics.top + 12, Math.min(y - panelHeight / 2, metrics.top + metrics.height - panelHeight - 12));
  if (bloom.root.dataset) {
    bloom.root.dataset.paletteLayout = metrics.horizontal ? "horizontal" : metrics.dense ? "compact" : "stacked";
    bloom.root.dataset.hasPages = String(hasPages);
    bloom.root.dataset.columns = String(metrics.columns);
  }
  bloom.root.style.setProperty("--bloom-columns", String(metrics.columns));
  bloom.root.style.setProperty("--bloom-row-height", `${metrics.rowHeight}px`);
  bloom.root.style.setProperty("--bloom-row-gap", `${metrics.gap}px`);
  const guide = board?.ownerDocument?.querySelector?.("#firstOrbitGuide:not([hidden])");
  const guideRect = guide?.getBoundingClientRect?.();
  if (guideRect?.width && guideRect?.height) {
    const blocker = { left: guideRect.left - boardRect.left, right: guideRect.right - boardRect.left,
      top: guideRect.top - boardRect.top, bottom: guideRect.bottom - boardRect.top };
    if (panelX < blocker.right && panelX + panelWidth > blocker.left && panelY < blocker.bottom && panelY + panelHeight > blocker.top) {
      if (compact && blocker.right + 12 + panelWidth <= boardRect.width - 12) panelX = blocker.right + 12;
      else if (blocker.bottom + 12 + panelHeight <= boardRect.height - 12) panelY = blocker.bottom + 12;
      else if (blocker.right + 12 + panelWidth <= boardRect.width - 12) panelX = blocker.right + 12;
    }
  }
  bloom.root.style.setProperty("--bloom-panel-x", `${Math.round(panelX)}px`);
  bloom.root.style.setProperty("--bloom-panel-y", `${Math.round(panelY)}px`);
  bloom.root.style.setProperty("--bloom-panel-width", `${panelWidth}px`);
  bloom.root.style.setProperty("--bloom-panel-height", `${panelHeight}px`);
  bloom.root.style.setProperty("--bloom-origin-x", `${x}px`);
  bloom.root.style.setProperty("--bloom-origin-y", `${y}px`);
  bloom.root.style.setProperty("--bloom-category-radius-x", `${radiusX}px`);
  bloom.root.style.setProperty("--bloom-category-radius-y", `${radiusY}px`);
  const cancelOffset = x > boardRect.width / 2 ? -116 : 116;
  bloom.root.style.setProperty("--bloom-cancel-x", `${x + cancelOffset}px`);
  bloom.root.style.setProperty("--bloom-cancel-y", `${y}px`);
  return { x, y };
}

export function renderBloomLinks(doc, container, origin, vectors) {
  const wanted = !origin || !Array.isArray(vectors) ? [] : vectors;
  const lines = [...container.querySelectorAll?.("line") || []];
  wanted.forEach((vector, index) => {
    const line = lines[index] || doc.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", origin.x);
    line.setAttribute("y1", origin.y);
    line.setAttribute("x2", origin.x + vector.x);
    line.setAttribute("y2", origin.y + vector.y);
    if (!lines[index]) container.append(line);
  });
  lines.slice(wanted.length).forEach((line) => line.remove());
}

export function queryBloomElements(root, supplied = {}) {
  const find = (selector) => supplied[selector] || root?.querySelector?.(selector);
  return {
    board: supplied.board || find("#board"),
    gameScreen: supplied.gameScreen || find("#gameScreen"),
    inventory: supplied.inventory || find(".inventory"),
    drawerBody: supplied.drawerBody || find("#inventoryDrawerBody"),
    drawerToggle: supplied.drawerToggle || find("#inventoryDrawerToggle"),
    wordList: supplied.wordList || find("#wordList")
  };
}

export function buildConstellationBloom(doc, board) {
  const root = doc.createElement("div");
  root.className = "constellation-bloom";
  root.id = "constellationBloom";
  root.dataset.stage = "closed";
  root.hidden = true;
  root.innerHTML = `
    <button class="constellation-bloom__start" id="constellationBloomTrigger" type="button" aria-label="Open your word constellation" aria-expanded="false" aria-controls="constellationBloomPanel">
      <span class="constellation-bloom__star" aria-hidden="true">\u2726</span>
      <span class="constellation-bloom__start-copy"><small>CHOOSE</small><strong>Add word</strong></span>
    </button>
    <button class="constellation-bloom__cancel" id="constellationBloomCancel" type="button" aria-label="Cancel the armed word" hidden>\u00d7</button>
    <section class="constellation-bloom__panel" id="constellationBloomPanel" aria-label="Choose a word" hidden>
      <header class="constellation-bloom__head">
        <button id="constellationBloomBack" type="button" aria-label="Browse word groups">Groups</button>
        <span><small id="constellationBloomKicker">WORD CONSTELLATION</small><strong id="constellationBloomTitle">Choose a direction</strong></span>
        <b id="constellationBloomCount" aria-hidden="true"></b>
      </header>
      <svg class="constellation-bloom__links" id="constellationBloomLinks" aria-hidden="true"></svg>
      <div class="constellation-bloom__categories" id="constellationBloomCategories" role="group" aria-label="Word categories"></div>
      <div class="constellation-bloom__search" id="constellationBloomSearchWrap" hidden>
        <label class="sr-only" for="constellationBloomSearch">Search discovered words</label>
        <span aria-hidden="true">\u2315</span>
        <input id="constellationBloomSearch" type="search" placeholder="Find a word\u2026" autocomplete="off" spellcheck="false">
        <button id="constellationBloomSearchClear" type="button" aria-label="Clear word search" hidden>\u00d7</button>
      </div>
      <div class="constellation-bloom__words" id="constellationBloomWords" role="group" aria-label="Words"></div>
      <nav class="constellation-bloom__pager" id="constellationBloomPager" aria-label="More words" hidden>
        <button id="constellationBloomPrevious" type="button" aria-label="Previous words">\u2190</button>
        <span id="constellationBloomPage">1 / 1</span>
        <button id="constellationBloomNext" type="button" aria-label="Next words">\u2192</button>
      </nav>
    </section>
    <div class="constellation-bloom__transition-ghost" id="constellationBloomTransitionGhost" aria-hidden="true" hidden><span></span><strong></strong></div>
    <p class="sr-only" id="constellationBloomStatus" role="status" aria-live="polite" aria-atomic="true"></p>`;
  board?.append(root);
  const get = (selector) => root.querySelector(selector);
  return {
    root,
    trigger: get("#constellationBloomTrigger"),
    triggerStar: get(".constellation-bloom__star"),
    triggerKicker: get(".constellation-bloom__start-copy small"),
    triggerLabel: get(".constellation-bloom__start-copy strong"),
    cancel: get("#constellationBloomCancel"),
    panel: get("#constellationBloomPanel"),
    back: get("#constellationBloomBack"),
    kicker: get("#constellationBloomKicker"),
    title: get("#constellationBloomTitle"),
    count: get("#constellationBloomCount"),
    links: get("#constellationBloomLinks"),
    categories: get("#constellationBloomCategories"),
    words: get("#constellationBloomWords"),
    searchWrap: get("#constellationBloomSearchWrap"),
    search: get("#constellationBloomSearch"),
    searchClear: get("#constellationBloomSearchClear"),
    pager: get("#constellationBloomPager"),
    previous: get("#constellationBloomPrevious"),
    next: get("#constellationBloomNext"),
    page: get("#constellationBloomPage"),
    ghost: get("#constellationBloomTransitionGhost"),
    ghostIcon: get("#constellationBloomTransitionGhost span"),
    ghostLabel: get("#constellationBloomTransitionGhost strong"),
    status: get("#constellationBloomStatus")
  };
}

export function createBloomTransitions({ bloom, viewWindow, onSwap, onSettle } = {}) {
  let current = null;
  let timer = 0;
  let resolver = null;
  let sequence = 0;
  const reduced = () => Boolean(
    viewWindow.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    || ["reduced", "off"].includes(bloom.root.ownerDocument?.body?.dataset?.cosmeticEffects)
  );

  const nextFrame = () => new Promise((resolve) => {
    if (typeof viewWindow.requestAnimationFrame === "function") viewWindow.requestAnimationFrame(() => resolve());
    else viewWindow.setTimeout?.(resolve, 0);
  });

  function motionElements(phase, transition) {
    const layer = phase === "out" ? transition?.from : transition?.to;
    const nucleus = transition?.kind === "bloom-relocate" && (bloom.panel || bloom.trigger) ? [bloom.panel || bloom.trigger] : [];
    if (["categories", "browse"].includes(layer)) return [...nucleus, ...bloom.categories.querySelectorAll?.(".constellation-bloom__category-shell") || []];
    if (["words", "search"].includes(layer)) return [...nucleus, ...bloom.words.querySelectorAll?.(".constellation-bloom__word-shell") || []];
    if (nucleus.length) return nucleus;
    return [];
  }

  async function waitForMotion(elements, expectedSequence, maximumMs) {
    if (!elements.length || reduced()) return;
    await nextFrame();
    if (sequence !== expectedSequence || reduced()) return;
    const animations = elements.flatMap((element) => {
      try { return element.getAnimations?.({ subtree: false }) || []; } catch { return []; }
    }).filter((animation) => animation?.finished && animation.effect?.getTiming?.().iterations !== Infinity);
    if (!animations.length) return;
    await Promise.race([
      Promise.allSettled(animations.map((animation) => animation.finished)),
      new Promise((resolve) => { timer = viewWindow.setTimeout?.(resolve, maximumMs) || 0; })
    ]);
    if (timer) viewWindow.clearTimeout?.(timer);
    timer = 0;
  }

  function resetVisualState() {
    delete bloom.root.dataset.transitionPhase;
    delete bloom.root.dataset.transition;
    bloom.ghost.hidden = true;
    bloom.ghost.classList.remove("is-flying");
  }

  function clear({ complete = false } = {}) {
    sequence += 1;
    if (timer) viewWindow.clearTimeout?.(timer);
    timer = 0;
    const interrupted = current;
    current = null;
    resetVisualState();
    if (complete && interrupted && interrupted.phase === "out") {
      interrupted.swap?.();
      onSwap?.(interrupted);
    }
    const resolve = resolver;
    resolver = null;
    if (complete && interrupted) onSettle?.(interrupted);
    resolve?.();
  }

  function showGhost(source, kind) {
    if (reduced() || !source?.getBoundingClientRect) return;
    const rootRect = bloom.root.getBoundingClientRect();
    const sourceRect = source.getBoundingClientRect();
    const targetRect = bloom.trigger.getBoundingClientRect();
    const sourceX = sourceRect.left - rootRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top - rootRect.top + sourceRect.height / 2;
    const targetX = targetRect.left - rootRect.left + targetRect.width / 2;
    const targetY = targetRect.top - rootRect.top + targetRect.height / 2;
    bloom.ghostIcon.textContent = source.querySelector?.("span")?.textContent || "\u2726";
    bloom.ghostLabel.textContent = source.querySelector?.("strong")?.textContent || "";
    bloom.ghost.dataset.kind = kind;
    bloom.ghost.style.setProperty("--ghost-x", `${sourceX}px`);
    bloom.ghost.style.setProperty("--ghost-y", `${sourceY}px`);
    bloom.ghost.style.setProperty("--ghost-dx", `${targetX - sourceX}px`);
    bloom.ghost.style.setProperty("--ghost-dy", `${targetY - sourceY}px`);
    bloom.ghost.hidden = false;
    bloom.ghost.classList.remove("is-flying");
    void bloom.ghost.offsetWidth;
    bloom.ghost.classList.add("is-flying");
  }

  function begin(from, to, { source = null, kind = "handoff", duration = 260, force = false, swap = null } = {}) {
    clear();
    if ((!force && from === to) || reduced()) {
      swap?.();
      const finished = { from, to, kind, phase: "settled" };
      onSwap?.(finished);
      onSettle?.(finished);
      resetVisualState();
      return Promise.resolve(finished);
    }
    const token = ++sequence;
    current = { from, to, kind, phase: "out", swap };
    bloom.root.dataset.transition = kind;
    bloom.root.dataset.transitionPhase = "out";
    if (source) showGhost(source, kind);
    return new Promise((resolve) => {
      resolver = resolve;
      void (async () => {
        await waitForMotion(motionElements("out", current), token, Math.max(duration, 180) + 180);
        if (sequence !== token || !current) return;
        bloom.root.dataset.transitionPhase = "in";
        current.phase = "in";
        current.swap?.();
        onSwap?.(current);
        if (sequence !== token || !current) return;
        await nextFrame();
        if (sequence !== token || !current) return;
        await waitForMotion(motionElements("in", current), token, Math.max(duration, 180) + 220);
        if (sequence !== token || !current) return;
        const finished = { ...current, phase: "settled" };
        resolver = null;
        current = null;
        resetVisualState();
        onSettle?.(finished);
        resolve(finished);
      })();
    });
  }

  function finishIfReduced() {
    if (!current || !reduced()) return false;
    clear({ complete: true });
    return true;
  }

  return { begin, clear, finishIfReduced, reduced, get current() { return current; } };
}
