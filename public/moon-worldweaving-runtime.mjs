import {
  MOON_WORLDWEAVING,
  moonWorldweavingView
} from "./worldweaving.mjs?v=5.0.0-beta.4";

const DIALOG_ID = "moonWorldDialog";
const OPEN_CLASS = "moon-worldweaving-is-open";
const MOON_ART = "./art/birthday-voyage/masters/moon-master.webp";

const asText = (value, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const slug = (value, fallback = "unknown") => {
  const clean = asText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return clean || fallback;
};

const callSafely = (callback, ...args) => {
  try {
    const result = callback?.(...args);
    result?.catch?.(() => {});
    return result;
  } catch {
    return undefined;
  }
};

const WORLDWEAVING_NAVIGATION_DESTINATIONS = Object.freeze({
  home: "Home",
  outpost: "Moon Outpost"
});

export function moonWorldweavingNavigation(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const requestedOrigin = String(source.origin || "").trim().toLocaleLowerCase("en-US");
  const origin = Object.hasOwn(WORLDWEAVING_NAVIGATION_DESTINATIONS, requestedOrigin)
    ? requestedOrigin
    : "home";
  const defaultLabel = WORLDWEAVING_NAVIGATION_DESTINATIONS[origin];
  const backLabel = asText(source.backLabel, defaultLabel).slice(0, 48);
  return Object.freeze({
    origin,
    backLabel,
    backAriaLabel: asText(
      source.backAriaLabel,
      origin === "home" ? "Return flight to Home" : `Back to ${backLabel}`
    ).slice(0, 80)
  });
}

const PRESENTATION = Object.freeze({
  power: {
    label: "Power",
    question: "What will wake the Moon?",
    choices: {
      solar: "A dawn-fed lattice turns sunlight into a golden lunar pulse.",
      lunar: "Silver-violet energy runs through the rock like a second heartbeat."
    }
  },
  shelter: {
    label: "Shelter",
    question: "How will life take root here?",
    choices: {
      bastion: "One shielded refuge stands firm against the dark.",
      hive: "Connected rooms grow into a bright, communal settlement.",
      haven: "Regolith arches rise gently from the Moon itself."
    }
  },
  signal: {
    label: "Signal",
    question: "How will this Moon answer the stars?",
    choices: {
      beacon: "A clear beam crosses the sky and announces that life is here.",
      stars: "Constellations become a language written above the settlement."
    }
  }
});

function createElement(documentRef, tag, className, text) {
  const element = documentRef.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function recipeParts(source, fallback = {}) {
  const recipe = source?.recipe && typeof source.recipe === "object"
    ? source.recipe
    : source?.memory?.recipe && typeof source.memory.recipe === "object"
      ? source.memory.recipe
      : source?.memory && typeof source.memory === "object"
        ? source.memory
      : source?.semanticMemory && typeof source.semanticMemory === "object"
        ? source.semanticMemory
        : source || {};
  return {
    a: asText(recipe.a ?? source?.a, asText(fallback.a, "Unknown")),
    b: asText(recipe.b ?? source?.b, asText(fallback.b, "Unknown")),
    word: asText(
      recipe.word ?? recipe.output ?? source?.word ?? source?.output,
      asText(fallback.word ?? fallback.output, "Discovery")
    )
  };
}

const recipeLabel = (recipe) => `${recipe.a} + ${recipe.b} → ${recipe.word}`;

function normalizedSlots(view) {
  const definitions = Array.isArray(MOON_WORLDWEAVING?.slots) ? MOON_WORLDWEAVING.slots : [];
  const presented = Array.isArray(view?.slots) && view.slots.length ? view.slots : definitions;
  const currentId = asText(
    typeof view?.currentSlot === "string"
      ? view.currentSlot
      : view?.currentSlot?.id ?? view?.currentSlotId
  );

  return presented.map((presentedSlot, index) => {
    const id = asText(presentedSlot?.id, asText(definitions[index]?.id, `slot-${index + 1}`));
    const definition = definitions.find((slot) => slot?.id === id) || definitions[index] || {};
    const presentation = PRESENTATION[id] || {};
    const anchor = presentedSlot?.anchor ?? (presentedSlot?.memory
      ? {
          choiceId: presentedSlot.choiceId,
          memory: presentedSlot.memory,
          completedAt: presentedSlot.completedAt
        }
      : null);
    let status = asText(presentedSlot?.status).toLowerCase();
    if (!status) {
      if (anchor) status = "complete";
      else if (id === currentId) status = "current";
      else status = index === 0 ? "current" : "locked";
    }
    if (status === "completed" || status === "installed" || status === "anchored") status = "complete";
    if (!new Set(["complete", "current", "locked"]).has(status)) status = "locked";
    return {
      ...definition,
      ...presentedSlot,
      id,
      label: asText(
        presentedSlot?.label ?? presentedSlot?.title,
        asText(definition?.label ?? definition?.title, asText(presentation.label, `Anchor ${index + 1}`))
      ),
      question: asText(
        presentedSlot?.question ?? definition?.question,
        asText(presentation.question, "What should this place become?")
      ),
      choices: (Array.isArray(presentedSlot?.choices)
        ? presentedSlot.choices
        : Array.isArray(definition?.choices)
          ? definition.choices
          : []).map((choice) => ({
            ...choice,
            label: asText(choice?.label ?? choice?.title, choice?.recipe?.word),
            description: asText(choice?.description, presentation.choices?.[choice?.id] || "")
          })),
      anchor,
      status
    };
  });
}

function choiceForAnchor(slot) {
  const anchor = slot?.anchor || {};
  const interpretationId = asText(
    anchor.interpretationId ?? anchor.choiceId ?? anchor.interpretation?.id
  );
  return slot?.choices?.find((choice) => choice?.id === interpretationId) || null;
}

function memoryForSlot(slot) {
  const choice = choiceForAnchor(slot);
  const anchor = slot?.anchor || {};
  return {
    slotId: slot.id,
    slotLabel: slot.label,
    interpretationId: asText(
      anchor.interpretationId ?? anchor.choiceId ?? choice?.id,
      "remembered"
    ),
    interpretationLabel: asText(
      anchor.interpretationLabel ?? anchor.label ?? choice?.label,
      slot.label
    ),
    description: asText(
      anchor.description ?? anchor.consequence ?? choice?.description,
      `The Moon now carries this ${slot.label.toLowerCase()} law.`
    ),
    recipe: recipeParts(anchor, choice?.recipe)
  };
}

function worldwordFrom(view) {
  const supplied = view?.worldword || MOON_WORLDWEAVING?.worldword || {};
  return {
    word: asText(supplied.word ?? supplied.output ?? supplied.title, "Lander"),
    recipe: recipeParts(
      supplied?.provenance?.recipe || supplied,
      MOON_WORLDWEAVING?.worldword?.recipe || { a: "Rocket", b: "Moon", word: "Lander" }
    ),
    description: asText(
      supplied.description,
      "A word born from this world can now carry its memory into the next one."
    )
  };
}

/**
 * Lazy, self-contained Moon Worldweaving surface.
 *
 * The host owns persistence and run transitions. This runtime only renders the
 * current model view and hands intentional actions back to the host.
 */
export function createMoonWorldweavingRuntime({
  documentRef = globalThis.document,
  getState,
  onStartMission,
  onExploreWorldword,
  onOpenOutpost,
  onBack,
  onMainMenu,
  onClose = () => {},
  track = () => {}
} = {}) {
  if (!documentRef?.createElement || !documentRef.body) {
    throw new TypeError("Moon Worldweaving requires a document with a body.");
  }
  if (typeof getState !== "function" || typeof onStartMission !== "function") {
    throw new TypeError("Moon Worldweaving requires getState() and onStartMission().");
  }

  const existing = documentRef.getElementById(DIALOG_ID);
  if (existing?.dataset?.moonRuntime === "true") existing.remove();

  const dialog = documentRef.createElement("dialog");
  dialog.id = DIALOG_ID;
  dialog.className = "moon-worldweaving";
  dialog.dataset.moonRuntime = "true";
  dialog.dataset.world = "moon";
  dialog.dataset.stage = "overview";
  dialog.setAttribute("aria-labelledby", "moonWorldTitle");
  dialog.setAttribute("aria-describedby", "moonWorldSummary");
  dialog.innerHTML = `
    <div class="moon-worldweaving__shell">
      <header class="moon-worldweaving__header">
        <button class="moon-worldweaving__close moon-worldweaving__back is-return-flight" id="moonWorldClose" type="button" aria-label="Return flight to Home">
          <span class="moon-worldweaving__back-emblem" aria-hidden="true"><i>&larr;</i></span>
          <span class="moon-worldweaving__back-copy">
            <small id="moonWorldBackKicker">RETURN FLIGHT</small>
            <strong id="moonWorldBackLabel">Home</strong>
          </span>
        </button>
        <div class="moon-worldweaving__identity">
          <span class="moon-worldweaving__eyebrow">LUNAR WORLDWEAVING</span>
          <h1 id="moonWorldTitle" tabindex="-1">Shape the Moon</h1>
        </div>
        <div class="moon-worldweaving__progress" id="moonWorldProgress" aria-label="Moon anchors installed">
          <strong>0</strong><span>/ 3</span>
        </div>
        <details class="moon-worldweaving__overflow" id="moonWorldOverflow">
          <summary aria-label="Open Worldweaving navigation" title="Worldweaving navigation">&#8943;</summary>
          <div class="moon-worldweaving__overflow-menu">
            <button class="moon-worldweaving__main-menu" id="moonWorldMainMenu" type="button" data-moon-action="main-menu">
              <span aria-hidden="true">&#8962;</span><span>Main menu</span>
            </button>
          </div>
        </details>
      </header>

      <nav class="moon-worldweaving__pane-switcher" aria-label="Moon Worldweaving view" role="tablist">
        <button type="button" role="tab" id="moonWorldSceneTab" aria-controls="moonWorldScene" aria-selected="true" data-moon-action="pane" data-moon-pane="scene">Scene</button>
        <button type="button" role="tab" id="moonWorldDetailTab" aria-controls="moonWorldTray" aria-selected="false" data-moon-action="pane" data-moon-pane="detail">Weave</button>
      </nav>

      <div class="moon-worldweaving__body">
        <section class="moon-worldweaving__scene" id="moonWorldScene" role="tabpanel" aria-labelledby="moonWorldSceneTab" aria-label="The Moon, waiting to be shaped by three word-made laws" data-moon-pane-content="scene">
          <img class="moon-worldweaving__art" src="${MOON_ART}" alt="" decoding="async" draggable="false">
          <div class="moon-worldweaving__vignette" aria-hidden="true"></div>
          <div class="moon-worldweaving__orbit-lines" aria-hidden="true"><i></i><i></i><i></i></div>

          <div class="moon-worldweaving__layer moon-worldweaving__layer--power" data-moon-layer="power" aria-hidden="true">
            <i class="moon-worldweaving__power-ring"></i>
            <i class="moon-worldweaving__power-seam"></i>
            <i class="moon-worldweaving__power-node"></i>
            <i class="moon-worldweaving__power-node"></i>
            <i class="moon-worldweaving__power-node"></i>
            <i class="moon-worldweaving__power-node"></i>
          </div>

          <div class="moon-worldweaving__layer moon-worldweaving__layer--shelter" data-moon-layer="shelter" aria-hidden="true">
            <i class="moon-worldweaving__dome"></i>
            <i class="moon-worldweaving__dome"></i>
            <i class="moon-worldweaving__dome"></i>
            <i class="moon-worldweaving__corridor"></i>
          </div>

          <div class="moon-worldweaving__layer moon-worldweaving__layer--signal" data-moon-layer="signal" aria-hidden="true">
            <i class="moon-worldweaving__signal-origin"></i>
            <i class="moon-worldweaving__signal-beam"></i>
            <i class="moon-worldweaving__signal-star"></i>
            <i class="moon-worldweaving__signal-star"></i>
            <i class="moon-worldweaving__signal-star"></i>
            <i class="moon-worldweaving__signal-star"></i>
            <i class="moon-worldweaving__signal-link"></i>
          </div>

          <div class="moon-worldweaving__anchors" id="moonWorldAnchors" role="group" aria-label="Moon anchors"></div>
          <p class="moon-worldweaving__scene-caption" id="moonWorldSummary">Three meanings will become one living world.</p>
        </section>

        <section class="moon-worldweaving__tray" id="moonWorldTray" role="tabpanel" aria-labelledby="moonWorldDetailTab" aria-label="Current Moon question" data-moon-pane-content="detail">
          <div class="moon-worldweaving__memories" id="moonWorldMemories" hidden></div>
          <div class="moon-worldweaving__question" id="moonWorldQuestion"></div>
          <p class="moon-worldweaving__status" id="moonWorldStatus" role="status" aria-live="polite"></p>
        </section>
      </div>
    </div>`;
  documentRef.body.append(dialog);

  const query = (selector) => dialog.querySelector(selector);
  const elements = {
    title: query("#moonWorldTitle"),
    progress: query("#moonWorldProgress"),
    scene: query("#moonWorldScene"),
    summary: query("#moonWorldSummary"),
    anchors: query("#moonWorldAnchors"),
    memories: query("#moonWorldMemories"),
    question: query("#moonWorldQuestion"),
    status: query("#moonWorldStatus"),
    close: query("#moonWorldClose"),
    backLabel: query("#moonWorldBackLabel"),
    backKicker: query("#moonWorldBackKicker"),
    mainMenu: query("#moonWorldMainMenu"),
    overflow: query("#moonWorldOverflow"),
    paneTabs: [...dialog.querySelectorAll('[data-moon-action="pane"]')],
    paneContents: [...dialog.querySelectorAll("[data-moon-pane-content]")]
  };

  let openState = false;
  let currentNavigation = moonWorldweavingNavigation();
  let opener = null;
  let restoreFocusOnClose = true;
  let awakening = false;
  let actionBusy = false;
  let destroyed = false;
  let latestView = null;
  let latestSlots = [];
  let activePane = "scene";
  let compactProjectLayout = false;
  const windowRef = documentRef.defaultView;
  const visualViewport = windowRef?.visualViewport;
  const compactQuery = windowRef?.matchMedia?.("(max-width: 700px), (orientation: portrait) and (max-width: 900px), (orientation: landscape) and (max-width: 900px) and (max-height: 500px)");

  function setProjectPane(pane, { focus = false } = {}) {
    activePane = pane === "detail" ? "detail" : "scene";
    dialog.dataset.projectPane = activePane;
    for (const tab of elements.paneTabs) {
      const selected = tab.dataset.moonPane === activePane;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (focus && selected) tab.focus?.({ preventScroll: true });
    }
    for (const content of elements.paneContents) {
      const visible = !compactProjectLayout || content.dataset.moonPaneContent === activePane;
      content.hidden = !visible;
      if (visible) content.removeAttribute("inert");
      else content.setAttribute("inert", "");
    }
  }

  function syncProjectLayout() {
    compactProjectLayout = Boolean(compactQuery?.matches);
    dialog.dataset.projectLayout = compactProjectLayout ? "compact" : "wide";
    const heights = [visualViewport?.height, windowRef?.innerHeight]
      .map(Number)
      .filter((height) => Number.isFinite(height) && height > 0);
    if (heights.length) dialog.style.setProperty("--moon-viewport-height", `${Math.round(Math.min(...heights))}px`);
    setProjectPane(activePane);
  }

  function setStatus(message, isError = false) {
    elements.status.textContent = asText(message);
    elements.status.classList.toggle("is-error", Boolean(isError));
  }

  function readView() {
    try {
      return moonWorldweavingView(getState());
    } catch (error) {
      setStatus("The lunar map could not be read. Close this view and try again.", true);
      callSafely(track, "moon_world_render_failed", { message: asText(error?.message, "unknown") });
      let fallbackState = {};
      try {
        fallbackState = getState() || {};
      } catch {
        // Keep the optional story surface fail-soft if host state is unavailable.
      }
      return {
        state: fallbackState,
        currentSlot: null,
        completedCount: 0,
        total: Array.isArray(MOON_WORLDWEAVING?.slots) ? MOON_WORLDWEAVING.slots.length : 3,
        complete: false,
        outcomeKey: "",
        worldword: MOON_WORLDWEAVING?.worldword,
        slots: MOON_WORLDWEAVING?.slots || []
      };
    }
  }

  function renderAnchors(slots, currentSlot) {
    elements.anchors.replaceChildren();
    slots.forEach((slot, index) => {
      const button = createElement(documentRef, "button", "moon-worldweaving__anchor");
      button.type = "button";
      button.dataset.moonSlot = slot.id;
      button.dataset.state = slot.status;
      if (slot.status === "current") button.setAttribute("aria-current", "step");
      if (slot.status === "locked") button.disabled = true;
      const status = slot.status === "complete"
        ? "Installed"
        : slot.status === "current"
          ? "Shape now"
          : "Locked";
      button.setAttribute("aria-label", `${slot.label}: ${status}`);

      const number = createElement(documentRef, "span", "moon-worldweaving__anchor-number", String(index + 1).padStart(2, "0"));
      number.setAttribute("aria-hidden", "true");
      const copy = createElement(documentRef, "span", "moon-worldweaving__anchor-copy");
      copy.append(
        createElement(documentRef, "strong", "", slot.label),
        createElement(documentRef, "small", "", status)
      );
      button.append(number, copy);
      elements.anchors.append(button);
    });

    if (currentSlot && !elements.anchors.querySelector('[aria-current="step"]')) {
      [...elements.anchors.querySelectorAll("[data-moon-slot]")]
        .find((button) => button.dataset.moonSlot === currentSlot.id)
        ?.setAttribute("aria-current", "step");
    }
  }

  function renderLayers(slots) {
    const completeSlots = slots.filter((slot) => slot.status === "complete");
    const newest = completeSlots.at(-1)?.id;
    dialog.querySelectorAll("[data-moon-layer]").forEach((layer) => {
      const slot = slots.find((candidate) => candidate.id === layer.dataset.moonLayer);
      const installed = slot?.status === "complete";
      const memory = installed ? memoryForSlot(slot) : null;
      layer.classList.toggle("is-installed", installed);
      layer.classList.toggle("is-new", Boolean(installed && awakening && slot.id === newest));
      layer.dataset.variant = memory ? slug(memory.interpretationId) : "none";
    });
  }

  function renderMemories(slots) {
    const completeSlots = slots.filter((slot) => slot.status === "complete");
    elements.memories.replaceChildren();
    elements.memories.hidden = completeSlots.length === 0;
    if (!completeSlots.length) return;

    const heading = createElement(documentRef, "h2", "moon-worldweaving__memory-heading", "Semantic memory");
    const rail = createElement(documentRef, "div", "moon-worldweaving__memory-rail");
    rail.tabIndex = 0;
    rail.setAttribute("role", "list");
    rail.setAttribute("aria-label", "Installed semantic memories");
    completeSlots.forEach((slot) => {
      const memory = memoryForSlot(slot);
      const card = createElement(documentRef, "div", "moon-worldweaving__memory-card");
      card.id = `moonWorldMemory-${slug(slot.id)}`;
      card.dataset.memorySlot = slot.id;
      card.dataset.variant = slug(memory.interpretationId);
      card.setAttribute("role", "listitem");
      const label = createElement(documentRef, "span", "", slot.label);
      const title = createElement(documentRef, "strong", "", memory.interpretationLabel);
      const recipe = createElement(documentRef, "small", "", recipeLabel(memory.recipe));
      card.append(label, title, recipe);
      rail.append(card);
    });
    elements.memories.append(heading, rail);
  }

  function appendRecipe(parent, recipe, className = "moon-worldweaving__recipe") {
    const formula = createElement(documentRef, "p", className);
    formula.append(createElement(documentRef, "span", "moon-worldweaving__sr-only", recipeLabel(recipe)));
    const parts = [
      createElement(documentRef, "span", "", recipe.a),
      createElement(documentRef, "i", "", "+"),
      createElement(documentRef, "span", "", recipe.b),
      createElement(documentRef, "i", "", "→"),
      createElement(documentRef, "strong", "", recipe.word)
    ];
    parts.forEach((part) => part.setAttribute("aria-hidden", "true"));
    formula.append(...parts);
    parent.append(formula);
    return formula;
  }

  function renderChoiceQuestion(currentSlot, completedCount, total) {
    const fragment = documentRef.createDocumentFragment();
    const copy = createElement(documentRef, "div", "moon-worldweaving__question-copy");
    copy.append(
      createElement(documentRef, "span", "moon-worldweaving__kicker", `${currentSlot.label.toUpperCase()} · QUESTION ${completedCount + 1} OF ${total}`),
      createElement(documentRef, "h2", "", currentSlot.question),
      createElement(documentRef, "p", "", "Choose a meaning. The final pair you make will become part of this Moon.")
    );
    fragment.append(copy);

    const choices = createElement(documentRef, "div", "moon-worldweaving__choices");
    choices.setAttribute("aria-label", `${currentSlot.label} interpretations`);
    currentSlot.choices.forEach((choice) => {
      const recipe = recipeParts(choice?.recipe, { word: choice?.target });
      const button = createElement(documentRef, "button", "moon-worldweaving__choice");
      button.type = "button";
      button.dataset.slotId = currentSlot.id;
      button.dataset.interpretationId = asText(choice?.id, slug(choice?.label));
      button.dataset.variant = slug(choice?.id ?? choice?.label);
      button.disabled = actionBusy;
      const heading = createElement(documentRef, "span", "moon-worldweaving__choice-heading");
      heading.append(
        createElement(documentRef, "i", "moon-worldweaving__choice-star", "✦"),
        createElement(documentRef, "strong", "", asText(choice?.label, recipe.word))
      );
      button.append(
        heading,
        createElement(documentRef, "span", "moon-worldweaving__choice-description", asText(choice?.description, `Build toward ${recipe.word}.`)),
        createElement(documentRef, "small", "moon-worldweaving__choice-recipe", recipeLabel(recipe))
      );
      choices.append(button);
    });

    if (!currentSlot.choices.length) {
      const unavailable = createElement(documentRef, "p", "moon-worldweaving__empty", "This lunar question is still forming.");
      fragment.append(unavailable);
    } else {
      fragment.append(choices);
    }
    elements.question.append(fragment);
  }

  function renderAwakening(slots, complete) {
    const installed = slots.filter((slot) => slot.status === "complete");
    const newest = installed.at(-1);
    const memory = newest ? memoryForSlot(newest) : null;
    const moonHomeAwakened = !complete && newest?.id === "power";
    const card = createElement(documentRef, "article", "moon-worldweaving__awakening-card");
    card.append(
      createElement(documentRef, "span", "moon-worldweaving__kicker", complete ? "THE THREE LAWS ALIGN" : `${newest?.label?.toUpperCase() || "MOON"} ANCHOR AWAKENED`),
      createElement(documentRef, "h2", "", complete ? "Your Moon has found its voice." : `${memory?.interpretationLabel || "A new law"} lives here now.`)
    );
    if (memory) appendRecipe(card, memory.recipe);
    card.append(createElement(
      documentRef,
      "p",
      "moon-worldweaving__awakening-copy",
      complete
        ? "Power, shelter, and signal now answer one another. A new word is ready to leave this world."
        : moonHomeAwakened
          ? "Power has awakened the Moon in your Observatory. You can now choose it as a full Home world; shelter and signal will keep transforming it."
        : memory?.description || "The path you made is now visible on the lunar surface."
    ));

    if (moonHomeAwakened) {
      const unlock = createElement(documentRef, "p", "moon-worldweaving__home-unlock");
      unlock.dataset.moonHomeUnlock = "moon";
      unlock.append(
        createElement(documentRef, "span", "", "ORBITAL ACCESS"),
        createElement(documentRef, "strong", "", "Moon Home unlocked")
      );
      card.append(unlock);
    }

    if (!complete) {
      const button = createElement(documentRef, "button", "moon-worldweaving__primary", "Shape the next anchor");
      button.type = "button";
      button.dataset.moonAction = "continue";
      button.disabled = actionBusy;
      card.append(button);
    }
    elements.question.append(card);
  }

  function renderComplete(view) {
    const worldword = worldwordFrom(view);
    const card = createElement(documentRef, "article", "moon-worldweaving__worldword");
    const icon = createElement(documentRef, "span", "moon-worldweaving__worldword-icon", "✦");
    icon.setAttribute("aria-hidden", "true");
    const copy = createElement(documentRef, "div", "moon-worldweaving__worldword-copy");
    copy.append(
      createElement(documentRef, "span", "moon-worldweaving__kicker", "WORLDWORD AWAKENED"),
      createElement(documentRef, "h2", "", worldword.word)
    );
    appendRecipe(copy, worldword.recipe, "moon-worldweaving__worldword-recipe");
    copy.append(
      createElement(documentRef, "p", "", worldword.description),
      createElement(documentRef, "small", "moon-worldweaving__availability", "Available in Explore")
    );
    card.append(icon, copy);

    const actions = createElement(documentRef, "div", "moon-worldweaving__worldword-actions");
    const outpost = createElement(documentRef, "button", "moon-worldweaving__primary", "Enter Moon Outpost");
    outpost.type = "button";
    outpost.dataset.moonAction = "open-outpost";
    outpost.disabled = actionBusy;
    const explore = createElement(documentRef, "button", "moon-worldweaving__secondary", "Take Lander into Explore");
    explore.type = "button";
    explore.dataset.moonAction = "explore-worldword";
    explore.disabled = actionBusy;
    const close = createElement(documentRef, "button", "moon-worldweaving__secondary", `Back to ${currentNavigation.backLabel}`);
    close.type = "button";
    close.dataset.moonAction = "close";
    close.disabled = actionBusy;
    actions.append(outpost, explore, close);
    card.append(actions);
    elements.question.append(card);
  }

  function render() {
    if (destroyed) return null;
    const view = readView();
    const slots = normalizedSlots(view);
    const currentSlotId = asText(
      typeof view?.currentSlot === "string"
        ? view.currentSlot
        : view?.currentSlot?.id ?? view?.currentSlotId
    );
    const currentSlot = slots.find((slot) => slot.id === currentSlotId)
      || slots.find((slot) => slot.status === "current")
      || null;
    const completedCount = Math.max(
      0,
      Math.min(
        slots.length,
        Number(view?.completedCount ?? view?.completedAnchors)
          || slots.filter((slot) => slot.status === "complete").length
      )
    );
    const total = Math.max(1, Number(view?.total ?? view?.totalAnchors) || slots.length || 3);
    const complete = Boolean(view?.complete ?? view?.completed ?? (slots.length && completedCount >= slots.length));
    const stage = complete ? (awakening ? "awakening" : "complete") : awakening ? "awakening" : "overview";

    latestView = view;
    latestSlots = slots;
    dialog.dataset.stage = stage;
    dialog.dataset.progress = `${completedCount}`;
    dialog.dataset.complete = String(complete);
    dialog.dataset.outcome = slug(view?.outcomeKey, "forming");
    elements.title.textContent = complete
      ? "Your Moon remembers."
      : awakening
        ? "A new law awakens."
        : "Shape the Moon";
    elements.progress.replaceChildren(
      createElement(documentRef, "strong", "", String(completedCount)),
      createElement(documentRef, "span", "", `/ ${total}`)
    );
    elements.progress.setAttribute("aria-label", `${completedCount} of ${total} Moon anchors installed`);
    elements.summary.textContent = complete
      ? "Three meanings have become one living world."
      : `${total - completedCount} lunar ${total - completedCount === 1 ? "law remains" : "laws remain"}.`;
    elements.scene.setAttribute(
      "aria-label",
      complete
        ? "A living Moon shaped by its installed power, shelter, and signal laws"
        : `The Moon with ${completedCount} of ${total} laws installed`
    );

    renderAnchors(slots, currentSlot);
    renderLayers(slots);
    renderMemories(slots);
    elements.question.replaceChildren();
    setStatus("");

    if (complete) renderComplete(view);
    else if (awakening) renderAwakening(slots, false);
    else if (currentSlot) renderChoiceQuestion(currentSlot, completedCount, total);
    else elements.question.append(createElement(documentRef, "p", "moon-worldweaving__empty", "The next lunar question is still beyond the horizon."));

    return view;
  }

  function syncNavigation(raw) {
    currentNavigation = moonWorldweavingNavigation(raw);
    dialog.dataset.navigationOrigin = currentNavigation.origin;
    elements.backLabel.textContent = currentNavigation.backLabel;
    const returnFlight = currentNavigation.origin === "home";
    elements.backKicker.textContent = returnFlight ? "RETURN FLIGHT" : "BACK TO";
    elements.close.classList.toggle("is-return-flight", returnFlight);
    elements.close.setAttribute("aria-label", currentNavigation.backAriaLabel);
    const redundantMainMenu = currentNavigation.origin === "home";
    elements.mainMenu.hidden = redundantMainMenu;
    elements.overflow.hidden = redundantMainMenu;
    if (redundantMainMenu) elements.overflow.open = false;
  }

  async function navigate(callback, trigger, failure) {
    if (actionBusy) return false;
    if (typeof callback !== "function") {
      close();
      return true;
    }
    actionBusy = true;
    dialog.dataset.busy = "true";
    dialog.setAttribute("aria-busy", "true");
    try {
      const result = await callback();
      if (result === false || result?.ok === false) {
        if (openState) setStatus(asText(result?.message, failure), true);
        return false;
      }
      return true;
    } catch {
      if (openState) setStatus(failure, true);
      return false;
    } finally {
      actionBusy = false;
      delete dialog.dataset.busy;
      dialog.removeAttribute("aria-busy");
      if (openState) render();
      trigger?.removeAttribute?.("aria-busy");
    }
  }

  function navigateBack(trigger = elements.close) {
    const callback = typeof onBack === "function"
      ? () => onBack(currentNavigation, trigger)
      : currentNavigation.origin === "outpost" && typeof onOpenOutpost === "function"
        ? () => onOpenOutpost(trigger)
        : currentNavigation.origin === "home" && typeof onMainMenu === "function"
          ? () => onMainMenu(trigger)
          : null;
    return navigate(callback, trigger, `${currentNavigation.backLabel} could not be opened. You can safely try again.`);
  }

  function navigateMainMenu(trigger = elements.mainMenu) {
    return navigate(
      typeof onMainMenu === "function" ? () => onMainMenu(trigger) : null,
      trigger,
      "The main menu could not be opened. You can safely try again."
    );
  }

  function restoreOpenerFocus() {
    const target = opener;
    opener = null;
    if (!target?.isConnected || target.closest?.("[hidden], [inert]")) return;
    try {
      target.focus({ preventScroll: true });
    } catch {
      // Focus restoration is best-effort when a host rerenders its opener.
    }
  }

  function finalizeClose() {
    if (!openState) return;
    openState = false;
    actionBusy = false;
    awakening = false;
    documentRef.documentElement?.classList.remove(OPEN_CLASS);
    documentRef.body?.classList.remove(OPEN_CLASS);
    const shouldRestore = restoreFocusOnClose;
    const completedCount = Number(dialog.dataset.progress) || 0;
    if (shouldRestore) {
      (documentRef.defaultView?.requestAnimationFrame || ((callback) => setTimeout(callback, 0)))(restoreOpenerFocus);
    } else {
      opener = null;
    }
    callSafely(track, "moon_world_closed", { completedCount });
    if (!destroyed) callSafely(onClose, { completedCount });
  }

  function close({ restoreFocus = true } = {}) {
    if (!openState || destroyed) return false;
    restoreFocusOnClose = Boolean(restoreFocus);
    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
      queueMicrotask(() => {
        if (openState && !dialog.open) finalizeClose();
      });
    } else {
      dialog.removeAttribute("open");
      finalizeClose();
    }
    return true;
  }

  function focusEntry() {
    const focusTarget = elements.title || elements.close;
    try {
      focusTarget?.focus({ preventScroll: true });
    } catch {
      elements.close?.focus?.();
    }
  }

  function open({ opener: requestedOpener, awakening: requestedAwakening = false, navigation = null } = {}) {
    if (destroyed) return false;
    const otherDialog = [...documentRef.querySelectorAll("dialog[open]")]
      .find((candidate) => candidate !== dialog);
    if (otherDialog) {
      callSafely(track, "moon_world_open_blocked", { reason: "dialog_open", dialogId: otherDialog.id || "unknown" });
      return false;
    }

    opener = requestedOpener || documentRef.activeElement || opener;
    awakening = Boolean(requestedAwakening);
    restoreFocusOnClose = true;
    syncNavigation(navigation);
    activePane = "scene";
    syncProjectLayout();
    render();
    if (!openState) {
      openState = true;
      documentRef.documentElement?.classList.add(OPEN_CLASS);
      documentRef.body?.classList.add(OPEN_CLASS);
      try {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      } catch (error) {
        openState = false;
        documentRef.documentElement?.classList.remove(OPEN_CLASS);
        documentRef.body?.classList.remove(OPEN_CLASS);
        setStatus("The Moon view could not be opened.", true);
        callSafely(track, "moon_world_open_failed", { message: asText(error?.message, "unknown") });
        return false;
      }
      callSafely(track, "moon_world_opened", {
        awakening,
        completedCount: Number(dialog.dataset.progress) || 0
      });
    }
    (documentRef.defaultView?.requestAnimationFrame || ((callback) => setTimeout(callback, 0)))(focusEntry);
    return true;
  }

  async function startMission(button) {
    if (actionBusy) return;
    const slotId = asText(button?.dataset?.slotId);
    const interpretationId = asText(button?.dataset?.interpretationId);
    if (!slotId || !interpretationId) return;
    const current = latestSlots.find((slot) => slot.id === slotId);
    if (!current || current.status !== "current") {
      setStatus("That lunar anchor is not ready yet.", true);
      return;
    }

    actionBusy = true;
    dialog.dataset.busy = "true";
    dialog.querySelectorAll("button").forEach((control) => { control.disabled = true; });
    setStatus(`Opening the ${current.label} route…`);
    callSafely(track, "moon_world_mission_started", { slotId, interpretationId });
    let failureMessage = "";
    try {
      const result = await onStartMission({ slotId, interpretationId }, button);
      if (result === false) failureMessage = "That route could not be opened. Try again.";
    } catch (error) {
      failureMessage = "That route could not be opened. Try again.";
      callSafely(track, "moon_world_mission_failed", {
        slotId,
        interpretationId,
        message: asText(error?.message, "unknown")
      });
    } finally {
      actionBusy = false;
      delete dialog.dataset.busy;
      if (openState) {
        render();
        if (failureMessage) setStatus(failureMessage, true);
      }
    }
  }

  async function exploreWorldword(trigger) {
    if (actionBusy) return;
    actionBusy = true;
    dialog.dataset.busy = "true";
    dialog.querySelectorAll("button").forEach((control) => { control.disabled = true; });
    setStatus("Carrying Lander into Explore…");
    callSafely(track, "moon_worldword_explore_started", { outcomeKey: latestView?.outcomeKey || "" });
    let failureMessage = "";
    try {
      if (typeof onExploreWorldword !== "function") {
        failureMessage = "Explore is preparing a place for Lander.";
        return;
      }
      const result = await onExploreWorldword(trigger);
      if (result === false) failureMessage = "Explore could not be opened. Try again.";
    } catch (error) {
      failureMessage = "Explore could not be opened. Try again.";
      callSafely(track, "moon_worldword_explore_failed", { message: asText(error?.message, "unknown") });
    } finally {
      actionBusy = false;
      delete dialog.dataset.busy;
      if (openState) {
        render();
        if (failureMessage) setStatus(failureMessage, true);
      }
    }
  }

  async function openOutpost(trigger) {
    if (actionBusy || typeof onOpenOutpost !== "function") return;
    actionBusy = true;
    dialog.dataset.busy = "true";
    dialog.querySelectorAll("button").forEach((control) => { control.disabled = true; });
    setStatus("Opening your living Moon Outpost…");
    try {
      const result = await onOpenOutpost(trigger);
      if (result === false && openState) setStatus("The Outpost could not be opened. Try again.", true);
    } catch (error) {
      if (openState) setStatus("The Outpost could not be opened. Try again.", true);
      callSafely(track, "moon_outpost_open_failed", { message: asText(error?.message, "unknown") });
    } finally {
      actionBusy = false;
      delete dialog.dataset.busy;
      if (openState) render();
    }
  }

  function onDialogClick(event) {
    if (elements.overflow.open && !event.target?.closest?.("#moonWorldOverflow")) elements.overflow.open = false;
    const target = event.target?.closest?.("button");
    if (!target || !dialog.contains(target)) return;
    if (target.dataset.moonAction === "pane") {
      setProjectPane(target.dataset.moonPane, { focus: true });
      return;
    }
    if (target === elements.close || target.dataset.moonAction === "close") {
      void navigateBack(target);
      return;
    }
    if (target === elements.mainMenu || target.dataset.moonAction === "main-menu") {
      void navigateMainMenu(target);
      return;
    }
    if (target.matches(".moon-worldweaving__choice")) {
      startMission(target);
      return;
    }
    if (target.dataset.moonAction === "continue") {
      awakening = false;
      render();
      setProjectPane("scene", { focus: compactProjectLayout });
      const current = dialog.querySelector('.moon-worldweaving__anchor[data-state="current"]');
      if (!compactProjectLayout) current?.focus?.({ preventScroll: true });
      return;
    }
    if (target.dataset.moonAction === "explore-worldword") {
      exploreWorldword(target);
      return;
    }
    if (target.dataset.moonAction === "open-outpost") {
      openOutpost(target);
      return;
    }
    if (target.matches(".moon-worldweaving__anchor")) {
      const slotId = target.dataset.moonSlot;
      const slot = latestSlots.find((candidate) => candidate.id === slotId);
      if (slot?.status === "complete") {
        setProjectPane("detail", { focus: compactProjectLayout });
        const memory = query(`#moonWorldMemory-${slug(slotId)}`);
        const reducedMotion = documentRef.defaultView
          ?.matchMedia?.("(prefers-reduced-motion: reduce)")
          ?.matches;
        memory?.scrollIntoView?.({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest", inline: "center" });
      } else if (slot?.status === "current") {
        setProjectPane("detail", { focus: compactProjectLayout });
        if (!compactProjectLayout) query(".moon-worldweaving__choice")?.focus?.({ preventScroll: true });
      }
    }
  }

  function onDialogCancel(event) {
    event.preventDefault();
    if (!actionBusy) void navigateBack(elements.close);
  }

  function onDialogKeydown(event) {
    if (event.target?.matches?.('[data-moon-action="pane"]') && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      setProjectPane(event.key === "ArrowRight" ? "detail" : "scene", { focus: true });
      return;
    }
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    if (elements.overflow.open) {
      elements.overflow.open = false;
      elements.overflow.querySelector("summary")?.focus?.({ preventScroll: true });
      return;
    }
    if (!actionBusy) void navigateBack(elements.close);
  }

  function onNativeClose() {
    finalizeClose();
  }

  dialog.addEventListener("click", onDialogClick);
  dialog.addEventListener("cancel", onDialogCancel);
  dialog.addEventListener("close", onNativeClose);
  dialog.addEventListener("keydown", onDialogKeydown);
  windowRef?.addEventListener?.("resize", syncProjectLayout, { passive: true });
  windowRef?.addEventListener?.("orientationchange", syncProjectLayout, { passive: true });
  visualViewport?.addEventListener?.("resize", syncProjectLayout, { passive: true });
  compactQuery?.addEventListener?.("change", syncProjectLayout);
  syncProjectLayout();

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (openState) {
      restoreFocusOnClose = false;
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
      else {
        dialog.removeAttribute("open");
        finalizeClose();
      }
    }
    documentRef.documentElement?.classList.remove(OPEN_CLASS);
    documentRef.body?.classList.remove(OPEN_CLASS);
    dialog.removeEventListener("click", onDialogClick);
    dialog.removeEventListener("cancel", onDialogCancel);
    dialog.removeEventListener("close", onNativeClose);
    dialog.removeEventListener("keydown", onDialogKeydown);
    windowRef?.removeEventListener?.("resize", syncProjectLayout);
    windowRef?.removeEventListener?.("orientationchange", syncProjectLayout);
    visualViewport?.removeEventListener?.("resize", syncProjectLayout);
    compactQuery?.removeEventListener?.("change", syncProjectLayout);
    dialog.remove();
    opener = null;
    latestView = null;
    latestSlots = [];
  }

  return Object.freeze({
    open,
    close,
    render,
    setPane: (pane, options) => { setProjectPane(pane, options); return activePane; },
    pane: () => activePane,
    navigation: () => currentNavigation,
    destroy,
    isOpen: () => Boolean(openState && !destroyed)
  });
}
