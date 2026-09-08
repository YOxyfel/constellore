import {
  MOON_OUTPOST_ROCKET_LAYERS,
  MOON_OUTPOST_STRUCTURE_ORDER,
  createMoonOutpostCacheReceipt,
  moonOutpostCacheFailureMessage,
  moonOutpostLaunchMessage,
  moonOutpostSelectionMessage,
  moonOutpostStructureSuccessMessage,
  moonOutpostStructureFailureMessage,
  createMoonOutpostModel
} from "./moon-outpost-presentation.mjs?v=5.0.0-beta.4";

const DIALOG_ID = "moonOutpostDialog";
const OPEN_CLASS = "moon-outpost-is-open";
const MOON_ART = "./art/birthday-voyage/masters/moon-master.webp";

const text = (value, fallback = "", maximum = 180) => {
  const clean = String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
  return clean || fallback;
};

const safely = (callback, ...args) => {
  try {
    return callback?.(...args);
  } catch {
    return undefined;
  }
};

const OUTPOST_NAVIGATION_DESTINATIONS = Object.freeze({
  home: "Home",
  heart: "The Heart",
  worldweaving: "Moon Worldweaving"
});

export function moonOutpostNavigation(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const requestedOrigin = String(source.origin || "").trim().toLocaleLowerCase("en-US");
  const origin = Object.hasOwn(OUTPOST_NAVIGATION_DESTINATIONS, requestedOrigin)
    ? requestedOrigin
    : "home";
  const defaultLabel = OUTPOST_NAVIGATION_DESTINATIONS[origin];
  const backLabel = text(source.backLabel, defaultLabel, 48);
  return Object.freeze({
    origin,
    backLabel,
    backAriaLabel: text(source.backAriaLabel, `Back to ${backLabel}`, 80)
  });
}

function element(documentRef, tag, className, copy) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (copy != null) node.textContent = copy;
  return node;
}

function normalizedReceipt(raw, fallbackTitle) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const items = (Array.isArray(source.items) ? source.items : [])
    .slice(0, 6)
    .map((item) => ({
      label: text(item?.label ?? item?.name, "Reward", 64),
      value: text(item?.value ?? item?.amount, "", 32),
      icon: text(item?.icon, "\u2726", 8)
    }));
  return {
    title: text(source.title, fallbackTitle, 80),
    description: text(source.description, "The cache manifest has been recorded.", 220),
    items
  };
}

/**
 * Isolated Moon Outpost presentation.
 *
 * Persistence, rewards, and navigation remain host-owned. This runtime owns
 * only screen state, focus, responsive presentation, and the launch sequence.
 */
export function createMoonOutpostRuntime({
  documentRef = globalThis.document,
  getWorldweavingView,
  getOutpostState = () => ({}),
  onOpenCache,
  onClaimCache,
  onRedeemSelection,
  onBeginLaunch,
  onLaunchComplete,
  onExploreWorldword,
  onBack,
  onMainMenu,
  onReturnToWorldweaving,
  onOpenProject,
  onStructureAction,
  onClose = () => {},
  track = () => {},
  launchTimings = {}
} = {}) {
  if (!documentRef?.createElement || !documentRef.body) {
    throw new TypeError("Moon Outpost requires a document with a body.");
  }
  if (typeof getWorldweavingView !== "function") {
    throw new TypeError("Moon Outpost requires getWorldweavingView().");
  }

  const existing = documentRef.getElementById(DIALOG_ID);
  if (existing?.dataset?.moonOutpostRuntime === "true") existing.remove();

  const dialog = documentRef.createElement("dialog");
  dialog.id = DIALOG_ID;
  dialog.className = "moon-outpost";
  dialog.dataset.moonOutpostRuntime = "true";
  dialog.dataset.stage = "overview";
  dialog.dataset.launchPhase = "idle";
  dialog.setAttribute("aria-labelledby", "moonOutpostTitle");
  dialog.setAttribute("aria-describedby", "moonOutpostSummary");
  dialog.innerHTML = `
    <div class="moon-outpost__shell">
      <div class="moon-outpost__overview" data-outpost-screen="overview">
        <header class="moon-outpost__header">
          <button class="moon-outpost__icon-button moon-outpost__back-button" type="button" data-outpost-action="back" aria-label="Back to Home">
            <span class="moon-outpost__back-glyph" aria-hidden="true">&larr;</span>
            <span id="moonOutpostBackLabel">Home</span>
          </button>
          <div class="moon-outpost__identity">
            <span class="moon-outpost__eyebrow">LUNAR OUTPOST</span>
            <h1 id="moonOutpostTitle" tabindex="-1">The Moon remembers</h1>
            <p id="moonOutpostSummary">Three meanings now power one living settlement.</p>
          </div>
          <div class="moon-outpost__completion" id="moonOutpostCompletion" aria-label="Outpost structures online">
            <strong>0</strong><span>/ 3 online</span>
          </div>
          <details class="moon-outpost__overflow" id="moonOutpostOverflow">
            <summary aria-label="Open Outpost navigation" title="Outpost navigation">&#8943;</summary>
            <div class="moon-outpost__overflow-menu">
              <button class="moon-outpost__main-menu-button" type="button" data-outpost-action="main-menu">
                <span aria-hidden="true">&#8962;</span><span>Main menu</span>
              </button>
            </div>
          </details>
        </header>

        <nav class="moon-outpost__pane-switcher" aria-label="Moon Outpost view" role="tablist">
          <button type="button" role="tab" id="moonOutpostSceneTab" aria-controls="moonOutpostScene" aria-selected="true" data-outpost-action="pane" data-outpost-pane="scene">Scene</button>
          <button type="button" role="tab" id="moonOutpostConsoleTab" aria-controls="moonOutpostConsole" aria-selected="false" data-outpost-action="pane" data-outpost-pane="detail">Console</button>
        </nav>

        <main class="moon-outpost__body">
          <section class="moon-outpost__scene" id="moonOutpostScene" aria-label="Moon Outpost exterior" data-outpost-pane-content="scene" role="tabpanel" aria-labelledby="moonOutpostSceneTab">
            <img class="moon-outpost__moon-art" src="${MOON_ART}" alt="" decoding="async" draggable="false">
            <div class="moon-outpost__stars" aria-hidden="true"></div>
            <div class="moon-outpost__horizon" aria-hidden="true"></div>

            <button class="moon-outpost__rocket" type="button" data-outpost-rocket data-outpost-action="rocket-preview" data-art="placeholder" aria-label="Test Lander One engines" aria-pressed="false">
              <span class="moon-outpost__rocket-aura"></span>
              ${MOON_OUTPOST_ROCKET_LAYERS.map((layer) => `
                <span class="moon-outpost__rocket-layer moon-outpost__rocket-layer--${layer}" data-rocket-layer="${layer}" data-has-art="false">
                  <img alt="" draggable="false" decoding="async" hidden>
                </span>`).join("")}
            </button>

            <ol class="moon-outpost__structures" id="moonOutpostStructures" aria-label="Outpost structures"></ol>
            <button class="moon-outpost__cache-beacon" type="button" data-outpost-action="cache" aria-describedby="moonOutpostCacheHint">
              <span class="moon-outpost__cache-glyph" aria-hidden="true">\u2726</span>
              <span><strong>Landing cache</strong><small id="moonOutpostCacheHint">Check manifest</small></span>
            </button>
            <p class="moon-outpost__scene-caption">Every structure is the visible consequence of a word route.</p>
          </section>

          <aside class="moon-outpost__console" id="moonOutpostConsole" aria-label="Outpost command console" data-outpost-pane-content="detail" role="tabpanel" aria-labelledby="moonOutpostConsoleTab">
            <section class="moon-outpost__dossier" id="moonOutpostDossier" aria-live="polite"></section>
            <section class="moon-outpost__worldword" id="moonOutpostWorldword"></section>
            <div class="moon-outpost__actions" id="moonOutpostActions"></div>
            <p class="moon-outpost__status" id="moonOutpostStatus" role="status" aria-live="polite"></p>
          </aside>
        </main>
      </div>

      <section class="moon-outpost__cache-screen" data-outpost-screen="cache" aria-labelledby="moonOutpostCacheTitle" hidden>
        <button class="moon-outpost__icon-button moon-outpost__screen-back" type="button" data-outpost-action="cache-back" aria-label="Return to Moon Outpost">
          <span aria-hidden="true">&larr;</span>
        </button>
        <div class="moon-outpost__cache-stage" data-cache-phase="sealed" aria-hidden="true">
          <div class="moon-outpost__cache-rings"><i></i><i></i><i></i></div>
          <div class="moon-outpost__cache-crate"><i></i><b>MOON // 01</b></div>
          <div class="moon-outpost__cache-light"></div>
        </div>
        <div class="moon-outpost__cache-copy">
          <span class="moon-outpost__eyebrow">OUTPOST RECOVERY</span>
          <h2 id="moonOutpostCacheTitle" tabindex="-1">Lunar cache bay</h2>
          <p id="moonOutpostCacheDescription">Choose a cache tier. Inspecting the catalog never spends Stardust.</p>
          <div class="moon-outpost__cache-ledger">
            <span id="moonOutpostCacheWallet">0 Stardust</span>
            <span id="moonOutpostCacheShards">0 selection shards</span>
          </div>
          <div class="moon-outpost__cache-tiers" id="moonOutpostCacheTiers" role="group" aria-label="Moon cache tiers"></div>
          <div class="moon-outpost__cache-details" id="moonOutpostCacheDetails"></div>
          <div class="moon-outpost__selection-redeem" id="moonOutpostSelectionRedeem" hidden>
            <label for="moonOutpostSelectionChoice">Choose an unowned cosmetic</label>
            <div>
              <select id="moonOutpostSelectionChoice" aria-describedby="moonOutpostCacheShards"></select>
              <button class="moon-outpost__secondary" id="moonOutpostSelectionButton" type="button" data-outpost-action="selection-redeem">Redeem shards</button>
            </div>
          </div>
          <ul class="moon-outpost__reward-list" id="moonOutpostRewards" aria-label="Cache contents"></ul>
          <button class="moon-outpost__primary" id="moonOutpostCacheOpen" type="button" data-outpost-action="cache-open">Open selected cache</button>
          <button class="moon-outpost__secondary" id="moonOutpostCacheCatalog" type="button" data-outpost-action="cache-catalog" hidden>View cache catalog</button>
          <p class="moon-outpost__status" id="moonOutpostCacheStatus" role="status" aria-live="polite"></p>
        </div>
      </section>

      <section class="moon-outpost__launch" data-outpost-screen="launch" aria-labelledby="moonOutpostLaunchTitle" hidden>
        <div class="moon-outpost__launch-stars" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="moon-outpost__launch-planet" aria-hidden="true"></div>
        <div class="moon-outpost__launch-rocket" aria-hidden="true">
          <div class="moon-outpost__rocket" data-outpost-launch-rocket data-art="placeholder"></div>
          <i class="moon-outpost__engine-trail"></i>
        </div>
        <button class="moon-outpost__skip" type="button" data-outpost-action="launch-skip">Skip animation</button>
        <div class="moon-outpost__launch-copy">
          <span class="moon-outpost__eyebrow" id="moonOutpostLaunchEyebrow">PRE-FLIGHT</span>
          <h2 id="moonOutpostLaunchTitle" tabindex="-1">Lander One is waking</h2>
          <p id="moonOutpostLaunchDescription">The three lunar laws are becoming thrust, shelter, and a path through the dark.</p>
          <div class="moon-outpost__launch-actions" id="moonOutpostLaunchActions" hidden>
            <button class="moon-outpost__primary" type="button" data-outpost-action="launch-continue">Continue the journey</button>
            <button class="moon-outpost__secondary" type="button" data-outpost-action="launch-back">Return to the outpost</button>
          </div>
          <p class="moon-outpost__status" id="moonOutpostLaunchStatus" role="status" aria-live="polite"></p>
        </div>
      </section>
    </div>`;
  documentRef.body.append(dialog);

  const query = (selector) => dialog.querySelector(selector);
  const screens = Object.fromEntries(["overview", "cache", "launch"].map((name) => [
    name,
    query(`[data-outpost-screen="${name}"]`)
  ]));
  const nodes = {
    back: query('[data-outpost-action="back"]'),
    backLabel: query("#moonOutpostBackLabel"),
    title: query("#moonOutpostTitle"),
    scene: query(".moon-outpost__scene"),
    summary: query("#moonOutpostSummary"),
    completion: query("#moonOutpostCompletion"),
    overflow: query("#moonOutpostOverflow"),
    mainMenu: query('[data-outpost-action="main-menu"]'),
    paneTabs: [...dialog.querySelectorAll('[data-outpost-action="pane"]')],
    paneContents: [...dialog.querySelectorAll("[data-outpost-pane-content]")],
    structures: query("#moonOutpostStructures"),
    dossier: query("#moonOutpostDossier"),
    worldword: query("#moonOutpostWorldword"),
    actions: query("#moonOutpostActions"),
    status: query("#moonOutpostStatus"),
    cacheButton: query('[data-outpost-action="cache"]'),
    cacheStage: query(".moon-outpost__cache-stage"),
    cacheTitle: query("#moonOutpostCacheTitle"),
    cacheDescription: query("#moonOutpostCacheDescription"),
    cacheWallet: query("#moonOutpostCacheWallet"),
    cacheShards: query("#moonOutpostCacheShards"),
    cacheTiers: query("#moonOutpostCacheTiers"),
    cacheDetails: query("#moonOutpostCacheDetails"),
    selectionRedeem: query("#moonOutpostSelectionRedeem"),
    selectionChoice: query("#moonOutpostSelectionChoice"),
    selectionButton: query("#moonOutpostSelectionButton"),
    cacheRewards: query("#moonOutpostRewards"),
    cacheOpen: query("#moonOutpostCacheOpen"),
    cacheCatalog: query("#moonOutpostCacheCatalog"),
    cacheStatus: query("#moonOutpostCacheStatus"),
    launchEyebrow: query("#moonOutpostLaunchEyebrow"),
    launchTitle: query("#moonOutpostLaunchTitle"),
    launchDescription: query("#moonOutpostLaunchDescription"),
    launchActions: query("#moonOutpostLaunchActions"),
    launchStatus: query("#moonOutpostLaunchStatus"),
    launchSkip: query('[data-outpost-action="launch-skip"]')
  };

  let currentModel = null;
  let selectedStructure = "power";
  let stage = "overview";
  let openState = false;
  let currentNavigation = moonOutpostNavigation();
  let destroyed = false;
  let busy = false;
  let opener = null;
  let restoreFocusOnClose = true;
  let cacheReceipt = null;
  let selectedCacheTier = "common";
  let selectedCosmeticId = "";
  let launchAuthorized = null;
  let launchPhase = "idle";
  let launchCompleted = false;
  let activePane = "scene";
  let compactProjectLayout = false;
  const timers = new Set();

  const reducedMotion = () => Boolean(documentRef.defaultView
    ?.matchMedia?.("(prefers-reduced-motion: reduce)")
    ?.matches);

  const windowRef = documentRef.defaultView;
  const visualViewport = windowRef?.visualViewport;
  const compactQuery = windowRef?.matchMedia?.("(max-width: 700px), (orientation: portrait) and (max-width: 900px), (orientation: landscape) and (max-width: 900px) and (max-height: 500px)");

  function setProjectPane(pane, { focus = false } = {}) {
    activePane = pane === "detail" ? "detail" : "scene";
    dialog.dataset.projectPane = activePane;
    for (const tab of nodes.paneTabs) {
      const selected = tab.dataset.outpostPane === activePane;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (focus && selected) tab.focus?.({ preventScroll: true });
    }
    for (const content of nodes.paneContents) {
      const visible = !compactProjectLayout || content.dataset.outpostPaneContent === activePane;
      content.hidden = !visible;
      if (visible) content.removeAttribute("inert");
      else content.setAttribute("inert", "");
    }
  }

  function syncProjectLayout() {
    compactProjectLayout = Boolean(compactQuery?.matches);
    dialog.dataset.projectLayout = compactProjectLayout ? "compact" : "wide";
    setProjectPane(activePane);
  }

  function syncViewportHeight() {
    const heights = [visualViewport?.height, windowRef?.innerHeight]
      .map(Number)
      .filter((height) => Number.isFinite(height) && height > 0);
    if (!heights.length) return;
    dialog.style.setProperty("--outpost-viewport-height", `${Math.round(Math.min(...heights))}px`);
    syncProjectLayout();
  }

  function clearTimers() {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  }

  function later(callback, delay) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!destroyed && openState) callback();
    }, Math.max(0, Number(delay) || 0));
    timers.add(timer);
    return timer;
  }

  function readModel() {
    let world = {};
    let outpost = {};
    try {
      world = getWorldweavingView() || {};
      outpost = getOutpostState() || {};
    } catch (error) {
      safely(track, "moon_outpost_read_failed", { message: text(error?.message, "unknown", 96) });
    }
    return createMoonOutpostModel(world, outpost);
  }

  function setScreen(nextStage) {
    stage = ["overview", "cache", "launch"].includes(nextStage) ? nextStage : "overview";
    dialog.dataset.stage = stage;
    for (const [name, screen] of Object.entries(screens)) {
      const hidden = name !== stage;
      screen.hidden = hidden;
      if (hidden) screen.setAttribute("inert", "");
      else screen.removeAttribute("inert");
    }
  }

  function setStatus(message, error = false, target = nodes.status) {
    target.textContent = text(message, "", 220);
    target.classList.toggle("is-error", Boolean(error));
  }

  function applyRocketArt(root, model) {
    const layers = model?.rocket?.layers || {};
    let supplied = 0;
    root.querySelectorAll?.("[data-rocket-layer]").forEach((layer) => {
      const source = layers[layer.dataset.rocketLayer] || "";
      const image = layer.querySelector("img");
      layer.dataset.hasArt = String(Boolean(source));
      image.hidden = !source;
      if (source) {
        image.src = source;
        supplied += 1;
      } else {
        image.removeAttribute("src");
      }
    });
    root.dataset.art = supplied ? "layered" : "placeholder";
  }

  function cloneRocketForLaunch(model) {
    const launchRoot = query("[data-outpost-launch-rocket]");
    const source = query("[data-outpost-rocket]");
    launchRoot.replaceChildren(...[...source.querySelectorAll("[data-rocket-layer]")].map((layer) => layer.cloneNode(true)));
    launchRoot.dataset.art = source.dataset.art;
    launchRoot.dataset.status = model.rocket.status;
  }

  function renderStructures(model) {
    nodes.structures.replaceChildren();
    for (const slot of model.slots) {
      const simulator = slot.simulator;
      const item = element(documentRef, "li", "moon-outpost__structure-item");
      const button = element(documentRef, "button", "moon-outpost__structure");
      button.type = "button";
      button.dataset.outpostAction = "structure";
      button.dataset.structureId = slot.id;
      button.dataset.state = slot.state;
      button.dataset.variant = slot.choiceId || "pending";
      button.setAttribute("aria-pressed", String(slot.id === selectedStructure));
      button.setAttribute(
        "aria-label",
        `${simulator.name}, stage ${simulator.stage}: ${slot.state}. Meaning ${simulator.meaning.current}${simulator.meaning.capacity ? ` of ${simulator.meaning.capacity}` : ""}. ${simulator.stardust.pending} Stardust pending at ${simulator.stardust.ratePerHour} per hour${simulator.stardust.cap ? `, cap ${simulator.stardust.cap}` : ""}. ${simulator.stardust.calibrated ? "Calibrated" : "Needs calibration"}.`
      );
      const glyph = element(documentRef, "span", "moon-outpost__structure-glyph");
      glyph.setAttribute("aria-hidden", "true");
      glyph.dataset.structureGlyph = slot.id;
      const copy = element(documentRef, "span", "moon-outpost__structure-copy");
      copy.append(
        element(documentRef, "strong", "", simulator.name),
        element(
          documentRef,
          "small",
          "",
          slot.state === "installed"
            ? `Stage ${simulator.stage} \u00b7 ${simulator.stardust.pending} Stardust ready`
            : slot.state
        )
      );
      button.append(glyph, copy);
      item.append(button);
      nodes.structures.append(item);
    }
  }

  function appendRecipe(parent, recipe) {
    if (!recipe) return;
    const formula = element(documentRef, "p", "moon-outpost__recipe");
    formula.setAttribute("role", "group");
    formula.setAttribute("aria-label", `${recipe.a} plus ${recipe.b} made ${recipe.word}`);
    for (const [copy, className] of [[recipe.a, ""], ["+", "operator"], [recipe.b, ""], ["\u2192", "operator"], [recipe.word, "result"]]) {
      const part = element(documentRef, "span", className, copy);
      part.setAttribute("aria-hidden", "true");
      formula.append(part);
    }
    parent.append(formula);
  }

  function renderDossier(model) {
    const slot = model.slots.find((candidate) => candidate.id === selectedStructure) || model.slots[0];
    const simulator = slot.simulator;
    nodes.dossier.replaceChildren();
    nodes.dossier.dataset.state = slot.state;
    nodes.dossier.append(
      element(documentRef, "span", "moon-outpost__eyebrow", `${slot.sourceTitle.toUpperCase()} LAW \u00b7 STAGE ${simulator.stage}`),
      element(documentRef, "h2", "", simulator.name),
      element(documentRef, "p", "", slot.summary)
    );
    appendRecipe(nodes.dossier, slot.memory);

    const metrics = element(documentRef, "dl", "moon-outpost__simulator-metrics");
    metrics.setAttribute("aria-label", `${simulator.name} simulator status`);
    const metric = (label, value, state = "") => {
      const row = element(documentRef, "div", "moon-outpost__simulator-metric");
      if (state) row.dataset.state = state;
      row.append(element(documentRef, "dt", "", label), element(documentRef, "dd", "", value));
      metrics.append(row);
    };
    metric(
      simulator.meaning.label,
      simulator.meaning.capacity
        ? `${simulator.meaning.current} / ${simulator.meaning.capacity}`
        : String(simulator.meaning.current)
    );
    metric("Passive rate", `${simulator.stardust.ratePerHour} / hour`);
    metric(
      "Stardust pending",
      simulator.stardust.cap
        ? `${simulator.stardust.pending} / ${simulator.stardust.cap}`
        : String(simulator.stardust.pending)
    );
    metric(
      "Calibration",
      simulator.stardust.calibrated ? "Calibrated" : "Needs calibration",
      simulator.stardust.calibrated ? "ready" : "attention"
    );
    nodes.dossier.append(metrics);

    const actions = element(documentRef, "div", "moon-outpost__simulator-actions");
    actions.setAttribute("role", "group");
    actions.setAttribute("aria-label", `${simulator.name} actions`);
    if (slot.id === "shelter" && simulator.project) {
      const project = actionButton(simulator.project.label, "project", "moon-outpost__simulator-project");
      project.dataset.projectId = simulator.project.id;
      project.disabled = busy || !simulator.project.enabled || typeof onOpenProject !== "function";
      project.setAttribute("aria-label", `${simulator.project.label}. ${simulator.project.progressLabel}.`);
      project.title = simulator.project.progressLabel;
      actions.append(project);
    }
    for (const action of ["upgrade", "calibrate", "collect"]) {
      if (slot.id === "shelter" && action === "upgrade") continue;
      const actionState = simulator.actions[action];
      const label = action === "collect" && simulator.stardust.pending > 0
        ? `${actionState.label} ${simulator.stardust.pending}`
        : actionState.label;
      const button = actionButton(label, "structure-action", action === "collect" ? "moon-outpost__simulator-collect" : "moon-outpost__simulator-action");
      button.dataset.structureCommand = action;
      button.dataset.structureId = slot.id;
      button.disabled = busy || !actionState.enabled || typeof onStructureAction !== "function";
      button.setAttribute("aria-label", `${actionState.label} ${simulator.name}`);
      if (actionState.reason) button.title = actionState.reason;
      actions.append(button);
    }
    nodes.dossier.append(actions);
  }

  function actionButton(label, action, className = "moon-outpost__secondary") {
    const button = element(documentRef, "button", className, label);
    button.type = "button";
    button.dataset.outpostAction = action;
    return button;
  }

  function renderConsole(model) {
    renderDossier(model);
    nodes.worldword.replaceChildren();
    nodes.worldword.hidden = !model.worldword;
    if (model.worldword) {
      nodes.worldword.append(
        element(documentRef, "span", "moon-outpost__eyebrow", "WORLDWORD ON BOARD"),
        element(documentRef, "strong", "", model.worldword),
        element(documentRef, "small", "", "Born here. Usable beyond this world.")
      );
    }

    nodes.actions.replaceChildren();
    const voyagePreparing = model.complete && !model.destination.contentReady;
    const launch = actionButton(
      model.launchReady
        ? `Launch toward ${model.destination.title}`
        : voyagePreparing
          ? `${model.destination.title} voyage preparing`
          : "Launch systems offline",
      "launch",
      "moon-outpost__primary"
    );
    launch.disabled = !model.launchReady;
    launch.setAttribute("aria-describedby", "moonOutpostLaunchHint");
    const hint = element(
      documentRef,
      "small",
      "moon-outpost__action-hint",
      model.launchReady
        ? `${model.rocket.name} is ready. Destination: ${model.destination.title}.`
        : voyagePreparing
          ? `${model.destination.title} will unlock when its expedition content is ready.`
          : `${model.totalStructures - model.installedCount} structures still need a semantic law.`
    );
    hint.id = "moonOutpostLaunchHint";
    nodes.actions.append(launch, hint);
    if (model.worldword) nodes.actions.append(actionButton(`Use ${model.worldword} in Explore`, "explore"));
    nodes.actions.append(actionButton("Return to Worldweaving", "return-weaving", "moon-outpost__quiet"));
  }

  function renderOverview() {
    currentModel = readModel();
    if (!MOON_OUTPOST_STRUCTURE_ORDER.includes(selectedStructure)) selectedStructure = "power";
    dialog.dataset.complete = String(currentModel.complete);
    dialog.dataset.rocketStatus = currentModel.rocket.status;
    dialog.dataset.outcomeVariant = currentModel.variantKey;
    for (const slot of currentModel.slots) dialog.dataset[`${slot.id}Variant`] = slot.choiceId || "pending";
    nodes.title.textContent = currentModel.complete ? `${currentModel.title} remembers` : `Building ${currentModel.title}`;
    nodes.summary.textContent = currentModel.complete
      ? "Three meanings now power one living settlement."
      : `${currentModel.totalStructures - currentModel.installedCount} structures are still waiting for a word-made law.`;
    nodes.completion.replaceChildren(
      element(documentRef, "strong", "", String(currentModel.installedCount)),
      element(documentRef, "span", "", `/ ${currentModel.totalStructures} online`)
    );
    nodes.completion.setAttribute("aria-label", `${currentModel.installedCount} of ${currentModel.totalStructures} outpost structures online`);
    nodes.cacheButton.disabled = !currentModel.complete || busy;
    nodes.cacheButton.dataset.state = currentModel.complete ? "available" : "locked";
    query("#moonOutpostCacheHint").textContent = currentModel.complete
      ? `${currentModel.cache.wallet} ${currentModel.cache.currencyLabel}`
      : "Complete the outpost";
    const rocket = query("[data-outpost-rocket]");
    applyRocketArt(rocket, currentModel);
    rocket.dataset.status = currentModel.rocket.status;
    rocket.setAttribute("aria-label", currentModel.launchReady
      ? `${currentModel.rocket.name}, ready to launch toward ${currentModel.destination.title}`
      : currentModel.complete
        ? `${currentModel.rocket.name}, engines ready. ${currentModel.destination.title} voyage is preparing.`
        : `${currentModel.rocket.name}, assembling at the Moon Outpost`);
    renderStructures(currentModel);
    renderConsole(currentModel);
    setStatus("");
    return currentModel;
  }

  function render() {
    if (destroyed) return null;
    const model = renderOverview();
    if (stage === "launch") cloneRocketForLaunch(model);
    return model;
  }

  function focusHeading(heading) {
    (documentRef.defaultView?.requestAnimationFrame || ((callback) => setTimeout(callback, 0)))(() => {
      try {
        heading?.focus?.({ preventScroll: true });
      } catch {
        heading?.focus?.();
      }
    });
  }

  function showOverview({ focusAction = "" } = {}) {
    clearTimers();
    launchPhase = "idle";
    launchCompleted = false;
    dialog.dataset.launchPhase = "idle";
    setScreen("overview");
    renderOverview();
    const target = focusAction ? query(`[data-outpost-action="${focusAction}"]`) : nodes.title;
    focusHeading(target);
  }

  function renderReceipt(receipt) {
    nodes.cacheTitle.textContent = receipt.title;
    nodes.cacheDescription.textContent = receipt.description;
    nodes.cacheRewards.replaceChildren();
    nodes.cacheRewards.hidden = receipt.items.length === 0;
    for (const item of receipt.items) {
      const row = element(documentRef, "li", "moon-outpost__reward");
      const icon = element(documentRef, "span", "", item.icon);
      icon.setAttribute("aria-hidden", "true");
      row.append(icon, element(documentRef, "strong", "", item.label));
      if (item.value) row.append(element(documentRef, "small", "", item.value));
      nodes.cacheRewards.append(row);
    }
  }

  function renderCacheCatalog({ focus = false } = {}) {
    currentModel = readModel();
    const available = currentModel.cache.tiers.find((tier) => !tier.capabilityLocked);
    if (!currentModel.cache.tiers.some((tier) => tier.id === selectedCacheTier && !tier.capabilityLocked)) {
      selectedCacheTier = available?.id || "common";
    }
    setScreen("cache");
    nodes.cacheStage.dataset.cachePhase = "catalog";
    nodes.cacheTitle.textContent = "Lunar cache bay";
    nodes.cacheDescription.textContent = "Common and Rare are Moon-capable. Epic and Mythic stay visible until a deeper-world capability unlocks them.";
    nodes.cacheWallet.textContent = `${currentModel.cache.wallet} ${currentModel.cache.currencyLabel}`;
    const shards = currentModel.cache.selectionShards;
    nodes.cacheShards.textContent = shards.target
      ? `${shards.current} / ${shards.target} ${shards.label}`
      : `${shards.current} ${shards.label}`;
    nodes.cacheTiers.hidden = false;
    nodes.cacheDetails.hidden = false;
    nodes.cacheTiers.replaceChildren();
    for (const tier of currentModel.cache.tiers) {
      const button = element(documentRef, "button", "moon-outpost__cache-tier");
      button.type = "button";
      button.dataset.outpostAction = "cache-tier";
      button.dataset.cacheTier = tier.id;
      button.dataset.tier = tier.id;
      button.dataset.locked = String(tier.capabilityLocked);
      button.setAttribute("aria-pressed", String(tier.id === selectedCacheTier));
      button.disabled = tier.capabilityLocked;
      button.append(
        element(documentRef, "strong", "", tier.label),
        element(documentRef, "small", "", tier.capabilityLocked
          ? "Capability locked"
          : tier.freeOpens ? `${tier.freeOpens} free` : tier.cost == null ? "Catalog pending" : `${tier.cost} ${currentModel.cache.currencyLabel}`)
      );
      nodes.cacheTiers.append(button);
    }
    const tier = currentModel.cache.tiers.find((candidate) => candidate.id === selectedCacheTier) || currentModel.cache.tiers[0];
    nodes.cacheDetails.replaceChildren();
    if (tier) {
      const odds = tier.odds.length
        ? tier.odds.map((entry) => `${entry.label} ${entry.value}`).join(" \u00b7 ")
        : "Odds supplied by the live catalog";
      const pity = tier.pity.threshold
        ? `Pity ${tier.pity.current} / ${tier.pity.threshold}`
        : "No pity threshold supplied";
      nodes.cacheDetails.append(
        element(documentRef, "strong", "", `${tier.label} cache`),
        element(documentRef, "p", "", tier.description),
        element(documentRef, "small", "moon-outpost__cache-odds", odds),
        element(documentRef, "small", "moon-outpost__cache-pity", pity)
      );
      nodes.cacheOpen.disabled = !tier.canOpen || typeof (onOpenCache || onClaimCache) !== "function";
      nodes.cacheOpen.textContent = tier.capabilityLocked
        ? "Capability locked"
        : tier.freeOpens ? "Open free cache" : tier.cost == null ? "Cost unavailable" : `Open for ${tier.cost} ${currentModel.cache.currencyLabel}`;
    }
    const unownedSelections = currentModel.cache.selectionOptions.filter((option) => !option.owned);
    if (!unownedSelections.some((option) => option.id === selectedCosmeticId)) {
      selectedCosmeticId = unownedSelections[0]?.id || "";
    }
    nodes.selectionRedeem.hidden = unownedSelections.length === 0;
    nodes.selectionChoice.replaceChildren();
    for (const option of unownedSelections) {
      const choice = element(documentRef, "option", "", `${option.label} \u00b7 ${option.slot}`);
      choice.value = option.id;
      choice.selected = option.id === selectedCosmeticId;
      nodes.selectionChoice.append(choice);
    }
    const selectionReady = Boolean(
      unownedSelections.length
      && shards.target > 0
      && shards.current >= shards.target
    );
    nodes.selectionChoice.disabled = unownedSelections.length === 0 || busy;
    nodes.selectionButton.hidden = unownedSelections.length === 0;
    nodes.selectionButton.disabled = !selectionReady || busy || typeof onRedeemSelection !== "function";
    nodes.selectionButton.textContent = shards.target ? `Redeem ${shards.target} shards` : "Redemption unavailable";
    nodes.cacheRewards.replaceChildren();
    nodes.cacheRewards.hidden = true;
    nodes.cacheOpen.hidden = false;
    nodes.cacheCatalog.hidden = true;
    setStatus("", false, nodes.cacheStatus);
    if (focus) focusHeading(nodes.cacheTitle);
    return tier;
  }

  async function openCache(trigger) {
    if (busy) return false;
    currentModel = readModel();
    const tier = currentModel.cache.tiers.find((candidate) => candidate.id === selectedCacheTier);
    const callback = onOpenCache || onClaimCache;
    if (!tier || !tier.canOpen || typeof callback !== "function") {
      setStatus("This cache cannot be opened from the current catalog state.", true, nodes.cacheStatus);
      return false;
    }
    nodes.cacheStage.dataset.cachePhase = "opening";
    nodes.cacheTitle.textContent = `Opening ${tier.label.toLowerCase()} cache`;
    nodes.cacheDescription.textContent = tier.freeOpens
      ? "Using one earned free cache."
      : `Authorizing ${tier.cost} ${currentModel.cache.currencyLabel}.`;
    nodes.cacheTiers.hidden = true;
    nodes.cacheDetails.hidden = true;
    nodes.selectionRedeem.hidden = true;
    nodes.cacheOpen.disabled = true;
    nodes.cacheTiers.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    setStatus("Verifying cache seal\u2026", false, nodes.cacheStatus);
    safely(track, "moon_outpost_cache_opened", { tier: tier.id, free: tier.freeOpens > 0 });
    busy = true;
    let result;
    try {
      if (!reducedMotion()) await new Promise((resolve) => setTimeout(resolve, 760));
      if (!openState || stage !== "cache") return false;
      result = await callback({
        tierId: tier.id,
        outcomeKey: currentModel.outcomeKey,
        payment: {
          free: tier.freeOpens > 0,
          cost: tier.freeOpens > 0 ? 0 : tier.cost,
          currency: currentModel.cache.currencyLabel
        },
        pity: tier.pity
      }, trigger);
      if (result === false) throw new Error("cache_blocked");
      cacheReceipt = normalizedReceipt(result, `${tier.label} cache opened`);
      nodes.cacheStage.dataset.cachePhase = "revealed";
      renderReceipt(cacheReceipt);
      nodes.cacheOpen.hidden = true;
      nodes.cacheCatalog.hidden = false;
      setStatus("Manifest recovered.", false, nodes.cacheStatus);
      safely(track, "moon_outpost_cache_claimed", {
        tier: tier.id,
        itemCount: cacheReceipt.items.length
      });
      return true;
    } catch (error) {
      nodes.cacheStage.dataset.cachePhase = "sealed";
      nodes.cacheTitle.textContent = "The cache stayed sealed";
      nodes.cacheDescription.textContent = "Nothing was spent. Return to the outpost and try again.";
      nodes.cacheCatalog.hidden = false;
      setStatus("Cache claim could not be completed.", true, nodes.cacheStatus);
      safely(track, "moon_outpost_cache_failed", { message: text(error?.message, "unknown", 96) });
      return false;
    } finally {
      busy = false;
    }
  }

  async function redeemSelection(trigger) {
    if (busy) return false;
    currentModel = readModel();
    const shards = currentModel.cache.selectionShards;
    const cosmeticId = nodes.selectionChoice.value || selectedCosmeticId;
    const option = currentModel.cache.selectionOptions.find((candidate) => candidate.id === cosmeticId && !candidate.owned);
    if (!option || !shards.target || shards.current < shards.target || typeof onRedeemSelection !== "function") {
      setStatus("Selection redemption is not available yet.", true, nodes.cacheStatus);
      return false;
    }
    busy = true;
    nodes.selectionChoice.disabled = true;
    nodes.selectionButton.disabled = true;
    setStatus(`Redeeming ${option.label}\u2026`, false, nodes.cacheStatus);
    try {
      const result = await onRedeemSelection({ cosmeticId: option.id }, trigger);
      if (result === false || result?.ok === false) {
        setStatus(text(result?.message, "The selection was not redeemed. No shards changed."), true, nodes.cacheStatus);
        return false;
      }
      busy = false;
      renderCacheCatalog();
      const message = text(result?.message ?? result?.status, `${option.label} unlocked.`);
      setStatus(`Selection receipt: ${message}`, false, nodes.cacheStatus);
      safely(track, "moon_outpost_selection_redeemed", { cosmeticId: option.id, slot: option.slot });
      focusHeading(nodes.selectionRedeem.hidden ? nodes.cacheTitle : nodes.selectionButton);
      return true;
    } catch (error) {
      setStatus("The selection did not change. You can safely try again.", true, nodes.cacheStatus);
      safely(track, "moon_outpost_selection_redeem_failed", {
        cosmeticId: option.id,
        message: text(error?.message, "unknown", 96)
      });
      return false;
    } finally {
      if (busy) {
        busy = false;
        nodes.selectionChoice.disabled = false;
        nodes.selectionButton.disabled = false;
      }
    }
  }

  const timing = {
    ignition: Math.max(120, Number(launchTimings.ignition) || 300),
    ascent: Math.max(350, Number(launchTimings.ascent) || 780),
    horizon: Math.max(700, Number(launchTimings.horizon) || 1380),
    complete: Math.max(1000, Number(launchTimings.complete) || 2100)
  };

  function setLaunchPhase(next) {
    launchPhase = next;
    dialog.dataset.launchPhase = next;
    const destination = currentModel.destination;
    const copy = {
      preflight: ["PRE-FLIGHT", `${currentModel.rocket.name} is waking`, "Power, shelter, and signal are becoming one launch system."],
      ignition: ["IGNITION", "The Moon lets go", "Every law you installed is visible in the trail behind you."],
      ascent: ["ASCENT", "Carry the word onward", `${currentModel.worldword} is leaving its first world without leaving its memory behind.`],
      horizon: [destination.eyebrow, `${destination.title} is ahead`, destination.description],
      complete: ["NEW ROUTE READY", `Continue toward ${destination.title}`, `The Outpost will remain here, shaped by the exact meanings you chose.`]
    }[next] || ["FLIGHT", "Journey in progress", destination.description];
    nodes.launchEyebrow.textContent = copy[0];
    nodes.launchTitle.textContent = copy[1];
    nodes.launchDescription.textContent = copy[2];
    nodes.launchActions.hidden = next !== "complete";
    nodes.launchSkip.hidden = next === "complete";
    setStatus(next === "complete" ? "Launch handoff ready." : "", false, nodes.launchStatus);
  }

  function completeLaunchSequence({ skipped = false } = {}) {
    clearTimers();
    launchCompleted = true;
    setLaunchPhase("complete");
    safely(track, "moon_outpost_launch_cinematic_completed", {
      destination: currentModel.destination.id,
      skipped: Boolean(skipped)
    });
    focusHeading(nodes.launchTitle);
  }

  async function beginLaunch(trigger) {
    if (busy) return false;
    currentModel = readModel();
    if (!currentModel.launchReady) {
      setStatus("The rocket needs all three structures and the awakened Worldword.", true);
      return false;
    }
    busy = true;
    setStatus("Running launch checks\u2026");
    try {
      launchAuthorized = typeof onBeginLaunch === "function"
        ? await onBeginLaunch({ model: currentModel, destination: currentModel.destination }, trigger)
        : { preview: true };
      if (launchAuthorized === false) {
        setStatus("Launch is not available yet. Nothing changed.", true);
        return false;
      }
    } catch (error) {
      setStatus("Launch checks could not finish. Try again.", true);
      safely(track, "moon_outpost_launch_blocked", { message: text(error?.message, "unknown", 96) });
      return false;
    } finally {
      busy = false;
    }

    launchCompleted = false;
    cloneRocketForLaunch(currentModel);
    setScreen("launch");
    setLaunchPhase("preflight");
    safely(track, "moon_outpost_launch_started", { destination: currentModel.destination.id });
    focusHeading(nodes.launchTitle);
    if (reducedMotion()) {
      completeLaunchSequence();
    } else {
      later(() => setLaunchPhase("ignition"), timing.ignition);
      later(() => setLaunchPhase("ascent"), timing.ascent);
      later(() => setLaunchPhase("horizon"), timing.horizon);
      later(() => completeLaunchSequence(), timing.complete);
    }
    return true;
  }

  async function handoffLaunch(trigger) {
    if (!launchCompleted || busy) return false;
    busy = true;
    nodes.launchActions.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    setStatus(`Preparing ${currentModel.destination.title}\u2026`, false, nodes.launchStatus);
    try {
      const result = typeof onLaunchComplete === "function"
        ? await onLaunchComplete({
            model: currentModel,
            destination: currentModel.destination,
            authorization: launchAuthorized
          }, trigger)
        : false;
      if (result === false) {
        setStatus("The cinematic is ready. Connect onLaunchComplete for the destination handoff.", false, nodes.launchStatus);
        nodes.launchActions.querySelectorAll("button").forEach((button) => { button.disabled = false; });
        return false;
      }
      safely(track, "moon_outpost_launch_handoff", { destination: currentModel.destination.id });
      return true;
    } catch (error) {
      setStatus("The destination could not open. You can safely try again.", true, nodes.launchStatus);
      nodes.launchActions.querySelectorAll("button").forEach((button) => { button.disabled = false; });
      safely(track, "moon_outpost_launch_handoff_failed", { message: text(error?.message, "unknown", 96) });
      return false;
    } finally {
      busy = false;
    }
  }

  async function hostAction(callback, payload, trigger, failure) {
    if (busy || typeof callback !== "function") {
      setStatus(failure, true);
      return false;
    }
    busy = true;
    try {
      const result = await callback(payload, trigger);
      if (result === false) setStatus(failure, true);
      return result !== false;
    } catch (error) {
      setStatus(failure, true);
      safely(track, "moon_outpost_action_failed", { message: text(error?.message, "unknown", 96) });
      return false;
    } finally {
      busy = false;
    }
  }

  function syncNavigation(raw) {
    currentNavigation = moonOutpostNavigation(raw);
    dialog.dataset.navigationOrigin = currentNavigation.origin;
    nodes.backLabel.textContent = currentNavigation.backLabel;
    nodes.back.setAttribute("aria-label", currentNavigation.backAriaLabel);
    const redundantMainMenu = currentNavigation.origin === "home";
    nodes.mainMenu.hidden = redundantMainMenu;
    nodes.overflow.hidden = redundantMainMenu;
    if (redundantMainMenu) nodes.overflow.open = false;
  }

  async function navigate(callback, trigger, failure) {
    if (busy) return false;
    if (typeof callback !== "function") {
      close();
      return true;
    }
    busy = true;
    dialog.dataset.busy = "true";
    dialog.setAttribute("aria-busy", "true");
    try {
      const result = await callback();
      if (result === false || result?.ok === false) {
        if (openState) setStatus(text(result?.message, failure, 220), true);
        return false;
      }
      return true;
    } catch {
      if (openState) setStatus(failure, true);
      return false;
    } finally {
      busy = false;
      delete dialog.dataset.busy;
      dialog.removeAttribute("aria-busy");
      if (openState && stage === "overview") renderDossier(currentModel);
      trigger?.removeAttribute?.("aria-busy");
    }
  }

  function navigateBack(trigger = nodes.back) {
    const callback = typeof onBack === "function"
      ? () => onBack(currentNavigation, trigger)
      : currentNavigation.origin === "worldweaving" && typeof onReturnToWorldweaving === "function"
        ? () => onReturnToWorldweaving({ model: currentModel }, trigger)
        : currentNavigation.origin === "home" && typeof onMainMenu === "function"
          ? () => onMainMenu(trigger)
          : null;
    return navigate(callback, trigger, `${currentNavigation.backLabel} could not be opened. You can safely try again.`);
  }

  function navigateMainMenu(trigger) {
    return navigate(
      typeof onMainMenu === "function" ? () => onMainMenu(trigger) : null,
      trigger,
      "The main menu could not be opened. You can safely try again."
    );
  }

  async function runStructureAction(command, structureId, trigger) {
    if (busy) return false;
    const slot = currentModel?.slots.find((candidate) => candidate.id === structureId);
    const action = slot?.simulator?.actions?.[command];
    if (!slot || !action?.enabled || typeof onStructureAction !== "function") {
      setStatus(action?.reason || "That structure action is not available yet.", true);
      return false;
    }
    busy = true;
    dialog.dataset.busy = "true";
    dialog.querySelectorAll('[data-outpost-action="structure-action"]').forEach((button) => { button.disabled = true; });
    setStatus(`${action.label} in progress\u2026`);
    try {
      const result = await onStructureAction({ action: command, structureId }, trigger);
      if (result === false || result?.ok === false) {
        setStatus(text(result?.message, action.reason || `${action.label} is not available yet.`), true);
        return false;
      }
      busy = false;
      delete dialog.dataset.busy;
      render();
      setStatus(text(result?.message ?? result?.status, `${action.label} complete.`));
      safely(track, "moon_outpost_structure_action", { action: command, structureId, success: true });
      const next = query(`[data-structure-command="${command}"][data-structure-id="${structureId}"]`)
        || query(`[data-structure-id="${structureId}"]`);
      focusHeading(next);
      return true;
    } catch (error) {
      setStatus("The structure did not change. You can safely try again.", true);
      safely(track, "moon_outpost_structure_action", {
        action: command,
        structureId,
        success: false,
        message: text(error?.message, "unknown", 96)
      });
      return false;
    } finally {
      if (busy) {
        busy = false;
        delete dialog.dataset.busy;
        renderDossier(currentModel);
      }
    }
  }

  function restoreOpenerFocus() {
    const target = opener;
    opener = null;
    if (!target?.isConnected || target.closest?.("[hidden], [inert]")) return;
    try {
      target.focus({ preventScroll: true });
    } catch {
      target.focus?.();
    }
  }

  function finalizeClose() {
    if (!openState) return;
    openState = false;
    busy = false;
    clearTimers();
    resetParallax();
    const rocket = query("[data-outpost-rocket]");
    rocket?.setAttribute("aria-pressed", "false");
    if (rocket) rocket.dataset.ignited = "false";
    documentRef.documentElement?.classList.remove(OPEN_CLASS);
    documentRef.body?.classList.remove(OPEN_CLASS);
    if (restoreFocusOnClose) {
      (documentRef.defaultView?.requestAnimationFrame || ((callback) => setTimeout(callback, 0)))(restoreOpenerFocus);
    } else opener = null;
    safely(track, "moon_outpost_closed", { stage, launchPhase });
    if (!destroyed) safely(onClose, { stage, launchPhase });
  }

  function close({ restoreFocus = true } = {}) {
    if (!openState || destroyed) return false;
    restoreFocusOnClose = Boolean(restoreFocus);
    if (dialog.open && typeof dialog.close === "function") dialog.close();
    else {
      dialog.removeAttribute("open");
      finalizeClose();
    }
    return true;
  }

  function open({ opener: requestedOpener, navigation = null } = {}) {
    if (destroyed) return false;
    const otherDialog = [...documentRef.querySelectorAll("dialog[open]")].find((candidate) => candidate !== dialog);
    if (otherDialog) {
      safely(track, "moon_outpost_open_blocked", { dialogId: otherDialog.id || "unknown" });
      return false;
    }
    opener = requestedOpener || documentRef.activeElement || opener;
    restoreFocusOnClose = true;
    syncNavigation(navigation);
    activePane = "scene";
    cacheReceipt = null;
    launchAuthorized = null;
    syncViewportHeight();
    setScreen("overview");
    renderOverview();
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
        safely(track, "moon_outpost_open_failed", { message: text(error?.message, "unknown", 96) });
        return false;
      }
      safely(track, "moon_outpost_opened", {
        complete: currentModel.complete,
        installedCount: currentModel.installedCount
      });
    }
    focusHeading(nodes.title);
    return true;
  }

  async function onClick(event) {
    if (nodes.overflow.open && !event.target?.closest?.("#moonOutpostOverflow")) nodes.overflow.open = false;
    const button = event.target?.closest?.("button[data-outpost-action]");
    if (!button || !dialog.contains(button)) return;
    const action = button.dataset.outpostAction;
    if (action === "pane") setProjectPane(button.dataset.outpostPane, { focus: true });
    else if (action === "back") await navigateBack(button);
    else if (action === "main-menu") await navigateMainMenu(button);
    else if (action === "structure") {
      selectedStructure = button.dataset.structureId;
      renderStructures(currentModel);
      renderDossier(currentModel);
      setProjectPane("detail", { focus: compactProjectLayout });
      if (!compactProjectLayout) query(`[data-structure-id="${selectedStructure}"]`)?.focus?.({ preventScroll: true });
    } else if (action === "structure-action") {
      await runStructureAction(button.dataset.structureCommand, button.dataset.structureId, button);
    } else if (action === "project") {
      await hostAction(
        onOpenProject,
        { projectId: button.dataset.projectId || "heart" },
        button,
        "The Heart project is not available yet."
      );
    } else if (action === "rocket-preview") {
      const rocket = query("[data-outpost-rocket]");
      const ignited = rocket.getAttribute("aria-pressed") !== "true";
      rocket.setAttribute("aria-pressed", String(ignited));
      rocket.dataset.ignited = String(ignited);
      if (ignited) later(() => {
        rocket.setAttribute("aria-pressed", "false");
        rocket.dataset.ignited = "false";
      }, 1600);
    } else if (action === "cache") {
      renderCacheCatalog({ focus: true });
      safely(track, "moon_outpost_cache_catalog_opened", { wallet: currentModel.cache.wallet });
    } else if (action === "cache-tier") {
      selectedCacheTier = button.dataset.cacheTier;
      renderCacheCatalog();
      query(`[data-cache-tier="${selectedCacheTier}"]`)?.focus?.({ preventScroll: true });
    } else if (action === "cache-open") await openCache(button);
    else if (action === "cache-catalog") renderCacheCatalog({ focus: true });
    else if (action === "selection-redeem") await redeemSelection(button);
    else if (action === "cache-back") showOverview({ focusAction: "cache" });
    else if (action === "launch") await beginLaunch(button);
    else if (action === "launch-skip") completeLaunchSequence({ skipped: true });
    else if (action === "launch-continue") await handoffLaunch(button);
    else if (action === "launch-back") showOverview({ focusAction: "launch" });
    else if (action === "explore") await hostAction(
      onExploreWorldword,
      { word: currentModel.worldword, model: currentModel },
      button,
      "Explore is not connected to this Outpost yet."
    );
    else if (action === "return-weaving") await hostAction(
      onReturnToWorldweaving,
      { model: currentModel },
      button,
      "Worldweaving is not connected to this Outpost yet."
    );
  }

  function onCancel(event) {
    event.preventDefault();
    if (stage === "cache") showOverview({ focusAction: "cache" });
    else if (stage === "launch" && launchPhase !== "complete") completeLaunchSequence({ skipped: true });
    else if (stage === "launch") showOverview({ focusAction: "launch" });
    else void navigateBack(nodes.back);
  }

  function onKeydown(event) {
    if (event.target?.matches?.('[data-outpost-action="pane"]') && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      setProjectPane(event.key === "ArrowRight" ? "detail" : "scene", { focus: true });
      return;
    }
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    if (nodes.overflow.open) {
      nodes.overflow.open = false;
      nodes.overflow.querySelector("summary")?.focus?.({ preventScroll: true });
      return;
    }
    onCancel(event);
  }

  function onNativeClose() {
    finalizeClose();
  }

  function onSelectionChange() {
    selectedCosmeticId = nodes.selectionChoice.value;
  }

  let parallaxFrame = 0;

  function resetParallax() {
    if (parallaxFrame) documentRef.defaultView?.cancelAnimationFrame?.(parallaxFrame);
    parallaxFrame = 0;
    dialog.style.setProperty("--outpost-parallax-x", "0px");
    dialog.style.setProperty("--outpost-parallax-y", "0px");
    dialog.style.setProperty("--outpost-tilt-x", "0deg");
    dialog.style.setProperty("--outpost-tilt-y", "0deg");
    delete nodes.scene.dataset.interacting;
  }

  function updateParallax(event) {
    if (reducedMotion() || stage !== "overview") return;
    const bounds = nodes.scene.getBoundingClientRect?.();
    if (!bounds?.width || !bounds?.height) return;
    const x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1));
    const apply = () => {
      parallaxFrame = 0;
      dialog.style.setProperty("--outpost-parallax-x", `${(x * 11).toFixed(2)}px`);
      dialog.style.setProperty("--outpost-parallax-y", `${(y * 8).toFixed(2)}px`);
      dialog.style.setProperty("--outpost-tilt-x", `${(-y * 2.2).toFixed(2)}deg`);
      dialog.style.setProperty("--outpost-tilt-y", `${(x * 3.2).toFixed(2)}deg`);
      nodes.scene.dataset.interacting = "true";
    };
    if (parallaxFrame) documentRef.defaultView?.cancelAnimationFrame?.(parallaxFrame);
    parallaxFrame = (documentRef.defaultView?.requestAnimationFrame || ((callback) => setTimeout(callback, 0)))(apply);
  }

  function onScenePointerMove(event) {
    if (event.pointerType !== "touch") updateParallax(event);
  }

  function onScenePointerDown(event) {
    if (event.pointerType === "touch") updateParallax(event);
  }

  dialog.addEventListener("click", onClick);
  dialog.addEventListener("cancel", onCancel);
  dialog.addEventListener("keydown", onKeydown);
  dialog.addEventListener("close", onNativeClose);
  nodes.selectionChoice.addEventListener("change", onSelectionChange);
  nodes.scene.addEventListener("pointermove", onScenePointerMove, { passive: true });
  nodes.scene.addEventListener("pointerdown", onScenePointerDown, { passive: true });
  nodes.scene.addEventListener("pointerleave", resetParallax);
  nodes.scene.addEventListener("pointerup", resetParallax);
  nodes.scene.addEventListener("pointercancel", resetParallax);
  windowRef?.addEventListener?.("resize", syncViewportHeight, { passive: true });
  windowRef?.addEventListener?.("orientationchange", syncViewportHeight, { passive: true });
  visualViewport?.addEventListener?.("resize", syncViewportHeight, { passive: true });
  compactQuery?.addEventListener?.("change", syncProjectLayout);
  syncViewportHeight();

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    restoreFocusOnClose = false;
    clearTimers();
    resetParallax();
    if (dialog.open && typeof dialog.close === "function") dialog.close();
    else finalizeClose();
    documentRef.documentElement?.classList.remove(OPEN_CLASS);
    documentRef.body?.classList.remove(OPEN_CLASS);
    dialog.removeEventListener("click", onClick);
    dialog.removeEventListener("cancel", onCancel);
    dialog.removeEventListener("keydown", onKeydown);
    dialog.removeEventListener("close", onNativeClose);
    nodes.selectionChoice.removeEventListener("change", onSelectionChange);
    nodes.scene.removeEventListener("pointermove", onScenePointerMove);
    nodes.scene.removeEventListener("pointerdown", onScenePointerDown);
    nodes.scene.removeEventListener("pointerleave", resetParallax);
    nodes.scene.removeEventListener("pointerup", resetParallax);
    nodes.scene.removeEventListener("pointercancel", resetParallax);
    windowRef?.removeEventListener?.("resize", syncViewportHeight);
    windowRef?.removeEventListener?.("orientationchange", syncViewportHeight);
    visualViewport?.removeEventListener?.("resize", syncViewportHeight);
    compactQuery?.removeEventListener?.("change", syncProjectLayout);
    dialog.remove();
    opener = null;
    currentModel = null;
  }

  return Object.freeze({
    open,
    close,
    render,
    navigation: () => currentNavigation,
    destroy,
    showOverview,
    selectStructure(structureId, { focus = false } = {}) {
      if (!MOON_OUTPOST_STRUCTURE_ORDER.includes(structureId)) return false;
      selectedStructure = structureId;
      if (currentModel) {
        renderStructures(currentModel);
        renderDossier(currentModel);
      }
      setProjectPane("detail", { focus: compactProjectLayout && focus });
      if (focus && !compactProjectLayout) focusHeading(query(`[data-structure-id="${structureId}"]`));
      return true;
    },
    setPane: (pane, options) => { setProjectPane(pane, options); return activePane; },
    pane: () => activePane,
    isOpen: () => Boolean(openState && !destroyed),
    stage: () => stage,
    model: () => currentModel,
    cacheReceipt: createMoonOutpostCacheReceipt,
    cacheFailureMessage: moonOutpostCacheFailureMessage,
    launchMessage: moonOutpostLaunchMessage,
    selectionMessage: moonOutpostSelectionMessage,
    structureSuccessMessage: moonOutpostStructureSuccessMessage,
    structureFailureMessage: moonOutpostStructureFailureMessage
  });
}
