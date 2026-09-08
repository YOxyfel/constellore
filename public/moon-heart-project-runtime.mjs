import {
  createMoonHeartDossierEntries,
  createMoonHeartProjectModel,
  moonHeartChoiceFailureMessage
} from "./moon-heart-project-presentation.mjs?v=5.0.0-beta.4";

const DIALOG_ID = "moonHeartProjectDialog";
const OPEN_CLASS = "moon-heart-project-is-open";

const safely = (callback, ...args) => {
  try {
    return callback?.(...args);
  } catch {
    return undefined;
  }
};

const HEART_NAVIGATION_DESTINATIONS = Object.freeze({
  home: "Home",
  outpost: "Moon Outpost",
  worldweaving: "Moon Worldweaving"
});

const navigationText = (value, fallback, maximum = 48) => {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maximum);
  return clean || fallback;
};

/**
 * Bounded navigation metadata supplied by the host that opened The Heart.
 * Keeping the origin explicit prevents a visual Back action from silently
 * changing meaning depending on which planetary surface happens to be open.
 */
export function moonHeartNavigation(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const requestedOrigin = String(source.origin || "").trim().toLocaleLowerCase("en-US");
  const origin = Object.hasOwn(HEART_NAVIGATION_DESTINATIONS, requestedOrigin)
    ? requestedOrigin
    : "outpost";
  const defaultLabel = HEART_NAVIGATION_DESTINATIONS[origin];
  const backLabel = navigationText(source.backLabel, defaultLabel);
  return Object.freeze({
    origin,
    backLabel,
    backAriaLabel: navigationText(source.backAriaLabel, `Back to ${backLabel}`, 80)
  });
}

function element(documentRef, tag, className = "", copy = null) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (copy != null) node.textContent = copy;
  return node;
}

function stateLabel(state) {
  return {
    available: "READY",
    current: "IN PROGRESS",
    complete: "REMEMBERED",
    locked: "BEYOND THE HORIZON"
  }[state] || "PROJECT";
}

function taskDefaultLabel(task) {
  return {
    choice: "Make this part of Moonhaven",
    crisis: "Face the crisis",
    finale: "Begin First Dawn"
  }[task?.kind] || "Enter orbit";
}

/**
 * Full-page, presentation-only workspace for the Moon's first Great Project.
 * The host owns task validation, run creation, persistence, and rewards.
 */
export function createMoonHeartProjectRuntime({
  documentRef = globalThis.document,
  getProjectState,
  onBeginMission,
  onChooseSettlement,
  onBack,
  onReturnToOutpost,
  onMainMenu,
  onClose = () => {}
} = {}) {
  if (!documentRef?.createElement || !documentRef.body) {
    throw new TypeError("The Heart requires a document with a body.");
  }
  if (typeof getProjectState !== "function") {
    throw new TypeError("The Heart requires getProjectState().");
  }

  const existing = documentRef.getElementById(DIALOG_ID);
  if (existing?.dataset?.moonHeartProjectRuntime === "true") existing.remove();

  const dialog = documentRef.createElement("dialog");
  dialog.id = DIALOG_ID;
  dialog.className = "moon-heart-project";
  dialog.dataset.moonHeartProjectRuntime = "true";
  dialog.setAttribute("aria-labelledby", "moonHeartProjectTitle");
  dialog.setAttribute("aria-describedby", "moonHeartProjectSubtitle");
  dialog.innerHTML = `
    <div class="moon-heart-project__shell">
      <header class="moon-heart-project__header">
        <button class="moon-heart-project__icon-button moon-heart-project__back-button" type="button" data-heart-action="back" aria-label="Back to Moon Outpost">
          <span class="moon-heart-project__back-glyph" aria-hidden="true">&larr;</span>
          <span id="moonHeartBackLabel">Moon Outpost</span>
        </button>
        <div class="moon-heart-project__identity">
          <span class="moon-heart-project__eyebrow">GREAT PROJECT</span>
          <h1 id="moonHeartProjectTitle" tabindex="-1">The Heart</h1>
          <p id="moonHeartProjectSubtitle">A Home Beneath No Sky</p>
        </div>
        <div class="moon-heart-project__progress" id="moonHeartProjectProgress" role="progressbar" aria-label="Project progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <strong>0 / 0</strong><span>chapters</span>
        </div>
        <details class="moon-heart-project__overflow" id="moonHeartOverflow">
          <summary aria-label="Open project navigation" title="Project navigation">&#8943;</summary>
          <div class="moon-heart-project__overflow-menu">
            <button class="moon-heart-project__main-menu-button" type="button" data-heart-action="main-menu">
              <span aria-hidden="true">&#8962;</span>
              <span>Main menu</span>
            </button>
          </div>
        </details>
      </header>

      <nav class="moon-heart-project__pane-switcher" aria-label="The Heart view" role="tablist">
        <button type="button" role="tab" id="moonHeartSceneTab" aria-controls="moonHeartProjectPanorama" aria-selected="true" data-heart-action="pane" data-heart-pane="scene">Scene</button>
        <button type="button" role="tab" id="moonHeartDetailTab" aria-controls="moonHeartProjectDossier" aria-selected="false" data-heart-action="pane" data-heart-pane="detail">Project</button>
      </nav>

      <main class="moon-heart-project__body">
        <nav class="moon-heart-project__chapters" aria-label="The Heart chapters" data-heart-pane-content="detail">
          <span class="moon-heart-project__rail-label">PROJECT LOG</span>
          <ol id="moonHeartProjectChapters"></ol>
        </nav>

        <section class="moon-heart-project__panorama" id="moonHeartProjectPanorama" aria-label="Moonhaven construction panorama" data-heart-pane-content="scene" role="tabpanel" aria-labelledby="moonHeartSceneTab">
          <div class="moon-heart-project__stars" aria-hidden="true"></div>
          <div class="moon-heart-project__planet" aria-hidden="true"></div>
          <div class="moon-heart-project__settlement" aria-hidden="true">
            <i data-heart-landmark="1"></i>
            <i data-heart-landmark="2"></i>
            <i data-heart-landmark="3"></i>
            <i data-heart-landmark="4"></i>
            <i data-heart-landmark="5"></i>
            <b></b>
          </div>
          <div class="moon-heart-project__panorama-copy">
            <span class="moon-heart-project__eyebrow" id="moonHeartProjectPanoramaKicker">MOONHAVEN</span>
            <strong id="moonHeartProjectPanoramaTitle">A light beneath no sky</strong>
            <small id="moonHeartProjectPanoramaSummary">Every answer becomes part of the settlement.</small>
          </div>
        </section>

        <article class="moon-heart-project__dossier" id="moonHeartProjectDossier" data-heart-pane-content="detail" role="tabpanel" aria-labelledby="moonHeartDetailTab">
          <div class="moon-heart-project__chapter-copy">
            <span class="moon-heart-project__eyebrow" id="moonHeartChapterKicker">CHAPTER</span>
            <h2 id="moonHeartChapterTitle" tabindex="-1">The first question</h2>
            <p id="moonHeartChapterSummary">The project is waiting for its first finding.</p>
          </div>
          <section class="moon-heart-project__evidence" aria-labelledby="moonHeartEvidenceTitle">
            <div class="moon-heart-project__section-heading">
              <h3 id="moonHeartEvidenceTitle">Project evidence</h3>
              <span id="moonHeartEvidenceProgress">0 / 0</span>
            </div>
            <ol id="moonHeartEvidenceList"></ol>
          </section>
          <section class="moon-heart-project__choice" id="moonHeartChoice" aria-labelledby="moonHeartChoiceTitle" hidden>
            <div class="moon-heart-project__section-heading">
              <h3 id="moonHeartChoiceTitle" tabindex="-1">What should grow here?</h3>
            </div>
            <p id="moonHeartChoiceDescription"></p>
            <div class="moon-heart-project__choice-grid" id="moonHeartChoiceGrid"></div>
          </section>
          <section class="moon-heart-project__reward" id="moonHeartReward" aria-labelledby="moonHeartRewardTitle" hidden>
            <span class="moon-heart-project__eyebrow">PROJECT REMEMBERED</span>
            <h3 id="moonHeartRewardTitle">Moonhaven remembers</h3>
            <p id="moonHeartRewardDescription"></p>
            <ul id="moonHeartRewardItems"></ul>
          </section>
          <div class="moon-heart-project__action-dock" id="moonHeartActionDock">
            <button class="moon-heart-project__primary" id="moonHeartPrimaryAction" type="button" data-heart-action="mission">Enter orbit</button>
            <p class="moon-heart-project__status" id="moonHeartProjectStatus" role="status" aria-live="polite"></p>
          </div>
        </article>
      </main>
    </div>`;
  documentRef.body.append(dialog);

  const query = (selector) => dialog.querySelector(selector);
  const nodes = {
    back: query('[data-heart-action="back"]'),
    backLabel: query("#moonHeartBackLabel"),
    title: query("#moonHeartProjectTitle"),
    subtitle: query("#moonHeartProjectSubtitle"),
    progress: query("#moonHeartProjectProgress"),
    overflow: query("#moonHeartOverflow"),
    mainMenu: query('[data-heart-action="main-menu"]'),
    paneTabs: [...dialog.querySelectorAll('[data-heart-action="pane"]')],
    paneContents: [...dialog.querySelectorAll("[data-heart-pane-content]")],
    chapters: query("#moonHeartProjectChapters"),
    panorama: query("#moonHeartProjectPanorama"),
    panoramaKicker: query("#moonHeartProjectPanoramaKicker"),
    panoramaTitle: query("#moonHeartProjectPanoramaTitle"),
    panoramaSummary: query("#moonHeartProjectPanoramaSummary"),
    chapterKicker: query("#moonHeartChapterKicker"),
    chapterTitle: query("#moonHeartChapterTitle"),
    chapterSummary: query("#moonHeartChapterSummary"),
    evidenceProgress: query("#moonHeartEvidenceProgress"),
    evidenceList: query("#moonHeartEvidenceList"),
    choice: query("#moonHeartChoice"),
    choiceTitle: query("#moonHeartChoiceTitle"),
    choiceDescription: query("#moonHeartChoiceDescription"),
    choiceGrid: query("#moonHeartChoiceGrid"),
    reward: query("#moonHeartReward"),
    rewardTitle: query("#moonHeartRewardTitle"),
    rewardDescription: query("#moonHeartRewardDescription"),
    rewardItems: query("#moonHeartRewardItems"),
    actionDock: query("#moonHeartActionDock"),
    primaryAction: query("#moonHeartPrimaryAction"),
    status: query("#moonHeartProjectStatus")
  };

  const windowRef = documentRef.defaultView;
  const visualViewport = windowRef?.visualViewport;
  let currentModel = null;
  let currentNavigation = moonHeartNavigation();
  let selectedChapterId = "";
  let openState = false;
  let destroyed = false;
  let busy = false;
  let opener = null;
  let restoreFocusOnClose = true;
  let activePane = "scene";
  let compactProjectLayout = false;

  const compactQuery = windowRef?.matchMedia?.("(max-width: 700px), (orientation: portrait) and (max-width: 900px), (orientation: landscape) and (max-width: 900px) and (max-height: 500px)");

  function setProjectPane(pane, { focus = false } = {}) {
    activePane = pane === "detail" ? "detail" : "scene";
    dialog.dataset.projectPane = activePane;
    for (const tab of nodes.paneTabs) {
      const selected = tab.dataset.heartPane === activePane;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (focus && selected) focusNode(tab);
    }
    for (const content of nodes.paneContents) {
      const visible = !compactProjectLayout || content.dataset.heartPaneContent === activePane;
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
    dialog.style.setProperty("--heart-viewport-height", `${Math.round(Math.min(...heights))}px`);
    syncProjectLayout();
  }

  function readModel() {
    try {
      return createMoonHeartProjectModel(getProjectState() || {});
    } catch {
      return createMoonHeartProjectModel();
    }
  }

  function setStatus(message = "", error = false) {
    const copy = String(message || "").slice(0, 220);
    nodes.status.textContent = copy;
    nodes.status.classList.toggle("is-error", Boolean(error));
    nodes.actionDock.hidden = Boolean(nodes.primaryAction.hidden && !copy);
  }

  function selectedChapter(model = currentModel) {
    return model?.chapters.find((chapter) => chapter.id === selectedChapterId)
      || model?.chapters.find((chapter) => chapter.id === model.activeChapterId)
      || model?.chapters[0]
      || null;
  }

  function focusNode(node) {
    const focus = () => {
      try {
        node?.focus?.({ preventScroll: true });
      } catch {
        node?.focus?.();
      }
    };
    if (typeof windowRef?.requestAnimationFrame === "function") {
      windowRef.requestAnimationFrame(focus);
    } else {
      setTimeout(focus, 0);
    }
  }

  function renderChapterRail(model) {
    nodes.chapters.replaceChildren();
    for (const chapter of model.chapters) {
      const item = element(documentRef, "li", "moon-heart-project__chapter-item");
      const button = element(documentRef, "button", "moon-heart-project__chapter");
      button.type = "button";
      button.dataset.heartAction = "chapter";
      button.dataset.chapterId = chapter.id;
      button.dataset.state = chapter.state;
      button.setAttribute("aria-pressed", String(chapter.id === selectedChapterId));
      button.setAttribute("aria-controls", "moonHeartProjectDossier");
      if (chapter.id === model.activeChapterId) button.setAttribute("aria-current", "step");
      button.setAttribute("aria-label", `Chapter ${chapter.number}: ${chapter.title}. ${stateLabel(chapter.state)}. ${chapter.progress.label}.`);
      const marker = element(documentRef, "span", "moon-heart-project__chapter-marker", chapter.state === "complete" ? "\u2713" : String(chapter.number).padStart(2, "0"));
      marker.setAttribute("aria-hidden", "true");
      const copy = element(documentRef, "span", "moon-heart-project__chapter-label");
      copy.append(
        element(documentRef, "strong", "", chapter.title),
        element(documentRef, "small", "", stateLabel(chapter.state))
      );
      button.append(marker, copy);
      item.append(button);
      nodes.chapters.append(item);
    }
  }

  function renderPanorama(model, chapter) {
    const completed = model.chapters.filter((candidate) => candidate.state === "complete").length;
    dialog.dataset.projectState = model.state;
    dialog.dataset.projectVariant = model.variant;
    dialog.dataset.projectStage = String(completed);
    nodes.panorama.dataset.variant = model.variant;
    nodes.panoramaKicker.textContent = model.state === "complete" ? "MOONHAVEN REMEMBERS" : `MOONHAVEN \u00b7 ${model.progress.label.toUpperCase()}`;
    nodes.panoramaTitle.textContent = chapter?.title || "A light beneath no sky";
    nodes.panoramaSummary.textContent = chapter?.summary || model.subtitle;
    nodes.panorama.setAttribute("aria-label", `${model.title} construction panorama. ${model.progress.label}. ${chapter?.title || "Project not begun"}.`);
  }

  function renderEvidence(chapter) {
    const entries = createMoonHeartDossierEntries(chapter);
    nodes.evidenceList.replaceChildren();
    nodes.evidenceList.dataset.count = String(entries.length);
    const complete = entries.filter(({ entry }) => entry.state !== "missing").length;
    nodes.evidenceProgress.textContent = `${complete} / ${entries.length}`;
    nodes.evidenceList.setAttribute(
      "aria-label",
      `${complete} of ${entries.length} project findings recorded. Select any available finding to enter or revisit its orbit.`
    );
    if (!entries.length) {
      const empty = element(documentRef, "li", "moon-heart-project__evidence-empty", "The first finding will appear here after a project orbit.");
      nodes.evidenceList.append(empty);
      return;
    }
    for (const { entry, task } of entries) {
      const item = element(documentRef, "li", "moon-heart-project__evidence-socket");
      item.dataset.state = entry.state;
      item.dataset.kind = entry.kind;
      const actionable = Boolean(
        task
        && task.enabled
        && task.kind !== "choice"
        && task.kind !== "complete"
        && typeof onBeginMission === "function"
      );
      const surface = element(
        documentRef,
        actionable ? "button" : "div",
        "moon-heart-project__evidence-action"
      );
      if (actionable) {
        surface.type = "button";
        surface.dataset.heartAction = "mission";
        surface.dataset.taskId = task.id;
        surface.dataset.taskState = task.state;
        surface.title = task.reason || task.label || "";
      }
      const glyph = element(documentRef, "span", "moon-heart-project__evidence-glyph", entry.state === "missing" ? "?" : "\u2726");
      glyph.setAttribute("aria-hidden", "true");
      const copy = element(documentRef, "span", "moon-heart-project__evidence-copy");
      copy.append(
        element(documentRef, "small", "", entry.kind),
        element(documentRef, "strong", "", entry.word || entry.label)
      );
      if (entry.word && entry.label !== entry.word) copy.append(element(documentRef, "span", "", entry.label));
      const accessibleLabel = `${entry.label}. ${entry.word ? `Discovered word: ${entry.word}.` : "Not yet discovered."}${entry.description ? ` ${entry.description}.` : ""}${actionable ? ` ${task.label || taskDefaultLabel(task)}.` : task?.reason ? ` ${task.reason}.` : ""}`;
      if (actionable) surface.setAttribute("aria-label", accessibleLabel);
      else if (entry.description || task?.reason) surface.title = entry.description || task.reason;
      surface.append(glyph, copy);
      if (actionable) {
        const launch = element(documentRef, "span", "moon-heart-project__evidence-launch", task.state === "complete" ? "\u21bb" : "\u203a");
        launch.setAttribute("aria-hidden", "true");
        surface.append(launch);
      }
      item.append(surface);
      nodes.evidenceList.append(item);
    }
  }

  function renderChoice(model, chapter) {
    const choice = model.settlementChoice;
    const visible = Boolean(
      choice.options.length
      && (model.state === "choice" || chapter?.action?.kind === "choice" || choice.selectedId)
    );
    nodes.choice.hidden = !visible;
    nodes.choiceGrid.replaceChildren();
    if (!visible) return;
    nodes.choiceTitle.textContent = choice.title;
    nodes.choiceDescription.textContent = choice.description;
    for (const option of choice.options) {
      const hasAction = Boolean(!choice.selectedId);
      const card = element(documentRef, hasAction ? "button" : "div", "moon-heart-project__choice-card");
      if (hasAction) {
        card.type = "button";
        card.dataset.heartAction = "choose";
        card.dataset.choiceId = option.id;
        card.disabled = busy || !option.enabled || typeof onChooseSettlement !== "function";
      }
      card.dataset.choiceId = option.id;
      card.dataset.selected = String(option.id === choice.selectedId);
      if (option.id === choice.selectedId) card.setAttribute("aria-current", "true");
      if (!hasAction && option.id === choice.selectedId) card.tabIndex = -1;
      const heading = element(documentRef, "strong", "", option.title);
      const description = element(documentRef, "span", "", option.description);
      card.append(heading, description);
      if (option.consequence) card.append(element(documentRef, "small", "", option.consequence));
      if (!option.enabled && option.reason) card.title = option.reason;
      nodes.choiceGrid.append(card);
    }
  }

  function renderReward(model) {
    const visible = model.state === "complete";
    nodes.reward.hidden = !visible;
    nodes.rewardItems.replaceChildren();
    if (!visible) return;
    nodes.rewardTitle.textContent = model.reward.title;
    nodes.rewardDescription.textContent = model.reward.description;
    for (const reward of model.reward.items) {
      const item = element(documentRef, "li", "moon-heart-project__reward-item");
      const icon = element(documentRef, "span", "", reward.icon);
      icon.setAttribute("aria-hidden", "true");
      item.append(icon, element(documentRef, "strong", "", reward.label));
      if (reward.value) item.append(element(documentRef, "small", "", reward.value));
      nodes.rewardItems.append(item);
    }
  }

  function renderAction(model, chapter) {
    const action = chapter?.action;
    const choiceBlocking = model.state === "choice" && !model.settlementChoice.selectedId && model.settlementChoice.options.length > 0;
    const visible = Boolean(action && action.kind !== "complete" && !choiceBlocking && model.state !== "complete");
    nodes.actionDock.hidden = !visible;
    nodes.primaryAction.hidden = !visible;
    nodes.primaryAction.dataset.taskId = action?.id || "";
    nodes.primaryAction.disabled = busy || !action?.enabled || typeof onBeginMission !== "function";
    nodes.primaryAction.textContent = action?.label || taskDefaultLabel(action);
    nodes.primaryAction.title = action?.reason || "";
    if (visible && !action.enabled && action.reason) setStatus(action.reason);
    else nodes.actionDock.hidden = Boolean(!visible && !nodes.status.textContent);
  }

  function renderDossier(model) {
    const chapter = selectedChapter(model);
    nodes.chapterKicker.textContent = chapter
      ? `CHAPTER ${String(chapter.number).padStart(2, "0")} \u00b7 ${stateLabel(chapter.state)}`
      : "PROJECT LOG";
    nodes.chapterTitle.textContent = chapter?.title || "The first question is forming";
    nodes.chapterSummary.textContent = chapter?.summary || model.subtitle;
    renderEvidence(chapter);
    renderChoice(model, chapter);
    renderReward(model);
    renderAction(model, chapter);
  }

  function rememberFocus() {
    const active = documentRef.activeElement;
    if (!active || !dialog.contains(active)) return null;
    if (active.id) return { id: active.id };
    const action = active.dataset?.heartAction || "";
    if (action === "mission") return { action, taskId: active.dataset.taskId || "" };
    if (action === "chapter") return { action, chapterId: active.dataset.chapterId || "" };
    if (action === "choose") return { action, choiceId: active.dataset.choiceId || "" };
    return null;
  }

  function nodeForRememberedFocus(memory) {
    if (!memory) return null;
    if (memory.id) return dialog.querySelector(`#${memory.id}`);
    if (memory.action === "mission") {
      return [...dialog.querySelectorAll('[data-heart-action="mission"]')]
        .find((candidate) => candidate.dataset.taskId === memory.taskId) || null;
    }
    if (memory.action === "chapter") {
      return [...dialog.querySelectorAll('[data-heart-action="chapter"]')]
        .find((candidate) => candidate.dataset.chapterId === memory.chapterId) || null;
    }
    if (memory.action === "choose") {
      return [...dialog.querySelectorAll('[data-choice-id]')]
        .find((candidate) => candidate.dataset.choiceId === memory.choiceId) || null;
    }
    return null;
  }

  function render() {
    if (destroyed) return null;
    const focusMemory = rememberFocus();
    currentModel = readModel();
    if (!currentModel.chapters.some((chapter) => chapter.id === selectedChapterId)) {
      selectedChapterId = currentModel.activeChapterId || currentModel.chapters[0]?.id || "";
    }
    nodes.title.textContent = currentModel.title;
    nodes.subtitle.textContent = currentModel.subtitle;
    nodes.progress.replaceChildren(
      element(documentRef, "strong", "", currentModel.progress.total ? `${currentModel.progress.completed} / ${currentModel.progress.total}` : `${currentModel.progress.percent}%`),
      element(documentRef, "span", "", currentModel.progress.unit)
    );
    nodes.progress.setAttribute("aria-label", `${currentModel.progress.label} project progress`);
    nodes.progress.setAttribute("aria-valuemax", String(currentModel.progress.total || 100));
    nodes.progress.setAttribute("aria-valuenow", String(currentModel.progress.total ? currentModel.progress.completed : currentModel.progress.percent));
    renderChapterRail(currentModel);
    const chapter = selectedChapter(currentModel);
    renderPanorama(currentModel, chapter);
    renderDossier(currentModel);
    const rememberedTarget = nodeForRememberedFocus(focusMemory);
    if (focusMemory && documentRef.activeElement !== rememberedTarget) focusNode(rememberedTarget || nodes.chapterTitle);
    return currentModel;
  }

  function showChapter(chapterId, { focus = false } = {}) {
    const id = String(chapterId || "").trim().toLocaleLowerCase("en-US");
    if (!currentModel?.chapters.some((chapter) => chapter.id === id)) return false;
    selectedChapterId = id;
    setStatus("");
    renderChapterRail(currentModel);
    const chapter = selectedChapter(currentModel);
    renderPanorama(currentModel, chapter);
    renderDossier(currentModel);
    if (focus) focusNode(query(`[data-chapter-id="${id}"]`) || nodes.chapterTitle);
    return true;
  }

  async function beginMission(taskId, trigger) {
    const id = String(taskId || "").trim();
    if (!id || busy || typeof onBeginMission !== "function") {
      setStatus("That project orbit is not ready yet.", true);
      return false;
    }
    busy = true;
    dialog.dataset.busy = "true";
    dialog.setAttribute("aria-busy", "true");
    dialog.querySelectorAll('[data-heart-action="mission"]').forEach((button) => { button.disabled = true; });
    setStatus("Preparing the next project orbit\u2026");
    try {
      const result = await onBeginMission({ taskId: id }, trigger);
      if (result === false || result?.ok === false) {
        setStatus(String(result?.message || "That project orbit could not begin.").slice(0, 220), true);
        return false;
      }
      setStatus(String(result?.message || "Project orbit ready.").slice(0, 220));
      return true;
    } catch {
      setStatus("That project orbit could not begin. Nothing changed.", true);
      return false;
    } finally {
      busy = false;
      delete dialog.dataset.busy;
      dialog.removeAttribute("aria-busy");
      if (openState) render();
    }
  }

  async function chooseSettlement(choiceId, trigger) {
    const id = String(choiceId || "").trim();
    if (!id || busy || typeof onChooseSettlement !== "function") {
      setStatus("That Moonhaven path is not ready yet.", true);
      return false;
    }
    const available = currentModel?.settlementChoice?.options.some((option) => option.id === id && option.enabled);
    if (!available || currentModel?.settlementChoice?.selectedId) {
      setStatus("That Moonhaven path cannot be changed here.", true);
      return false;
    }
    busy = true;
    dialog.dataset.busy = "true";
    dialog.setAttribute("aria-busy", "true");
    let chosen = false;
    dialog.querySelectorAll('[data-heart-action="choose"]').forEach((button) => { button.disabled = true; });
    setStatus("Writing this choice into Moonhaven\u2026");
    try {
      const result = await onChooseSettlement({ choiceId: id }, trigger);
      if (result === false || result?.ok === false) {
        setStatus(String(result?.message || "That choice was not recorded.").slice(0, 220), true);
        return false;
      }
      setStatus(String(result?.message || "Moonhaven will remember this choice.").slice(0, 220));
      chosen = true;
      return true;
    } catch {
      setStatus("That choice could not be recorded. Nothing changed.", true);
      return false;
    } finally {
      busy = false;
      delete dialog.dataset.busy;
      dialog.removeAttribute("aria-busy");
      if (openState) {
        render();
        if (chosen) {
          focusNode(query('.moon-heart-project__choice-card[data-selected="true"]') || nodes.choiceTitle);
        }
      }
    }
  }

  function syncNavigation(raw) {
    currentNavigation = moonHeartNavigation(raw);
    dialog.dataset.navigationOrigin = currentNavigation.origin;
    nodes.backLabel.textContent = currentNavigation.backLabel;
    nodes.back.setAttribute("aria-label", currentNavigation.backAriaLabel);
    const redundantMainMenu = currentNavigation.origin === "home";
    nodes.mainMenu.hidden = redundantMainMenu;
    nodes.overflow.hidden = redundantMainMenu;
    if (redundantMainMenu) nodes.overflow.open = false;
  }

  async function returnToOrigin(trigger = nodes.back) {
    if (busy) return false;
    const callback = typeof onBack === "function"
      ? () => onBack(currentNavigation, trigger)
      : currentNavigation.origin === "home" && typeof onMainMenu === "function"
        ? () => onMainMenu(trigger)
        : typeof onReturnToOutpost === "function"
          ? () => onReturnToOutpost(trigger)
          : null;
    if (!callback) {
      close();
      return true;
    }
    busy = true;
    dialog.dataset.busy = "true";
    dialog.setAttribute("aria-busy", "true");
    try {
      const result = await callback();
      if (result === false || result?.ok === false) {
        setStatus(String(result?.message || `${currentNavigation.backLabel} could not be opened.`).slice(0, 220), true);
        return false;
      }
      return true;
    } catch {
      setStatus(`${currentNavigation.backLabel} could not be opened. You can safely try again.`, true);
      return false;
    } finally {
      busy = false;
      delete dialog.dataset.busy;
      dialog.removeAttribute("aria-busy");
    }
  }

  async function returnToMainMenu(trigger) {
    if (busy || typeof onMainMenu !== "function") {
      setStatus("The main menu is not available yet.", true);
      return false;
    }
    busy = true;
    dialog.dataset.busy = "true";
    dialog.setAttribute("aria-busy", "true");
    try {
      const result = await onMainMenu(trigger);
      if (result === false || result?.ok === false) {
        setStatus(String(result?.message || "The main menu could not be opened.").slice(0, 220), true);
        return false;
      }
      return true;
    } catch {
      setStatus("The main menu could not be opened. You can safely try again.", true);
      return false;
    } finally {
      busy = false;
      delete dialog.dataset.busy;
      dialog.removeAttribute("aria-busy");
    }
  }

  function focusDocumentFallback() {
    const body = documentRef.body;
    if (!body?.focus) return;
    const previousTabIndex = body.getAttribute?.("tabindex");
    body.setAttribute?.("tabindex", "-1");
    try {
      body.focus({ preventScroll: true });
    } catch {
      body.focus();
    }
    if (previousTabIndex == null) body.removeAttribute?.("tabindex");
    else body.setAttribute?.("tabindex", previousTabIndex);
  }

  function restoreOpenerFocus() {
    const target = opener;
    opener = null;
    if (
      !target?.isConnected
      || target.closest?.('[hidden], [inert], [aria-hidden="true"], dialog:not([open])')
    ) {
      focusDocumentFallback();
      return;
    }
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
    delete dialog.dataset.busy;
    dialog.removeAttribute("aria-busy");
    documentRef.documentElement?.classList.remove(OPEN_CLASS);
    documentRef.body?.classList.remove(OPEN_CLASS);
    if (restoreFocusOnClose) {
      if (typeof windowRef?.requestAnimationFrame === "function") {
        windowRef.requestAnimationFrame(restoreOpenerFocus);
      } else {
        setTimeout(restoreOpenerFocus, 0);
      }
    }
    else opener = null;
    if (!destroyed) safely(onClose, { selectedChapterId, projectId: currentModel?.id || "heart" });
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

  function open({ opener: requestedOpener, focusChapterId = "", navigation = null } = {}) {
    if (destroyed) return false;
    const otherDialog = [...documentRef.querySelectorAll("dialog[open]")].find((candidate) => candidate !== dialog);
    if (otherDialog) return false;
    if (!openState) opener = requestedOpener || documentRef.activeElement || opener;
    restoreFocusOnClose = true;
    syncNavigation(navigation);
    activePane = focusChapterId ? "detail" : "scene";
    syncViewportHeight();
    selectedChapterId = String(focusChapterId || "").trim().toLocaleLowerCase("en-US");
    setStatus("");
    render();
    if (!openState) {
      openState = true;
      documentRef.documentElement?.classList.add(OPEN_CLASS);
      documentRef.body?.classList.add(OPEN_CLASS);
      try {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      } catch {
        openState = false;
        documentRef.documentElement?.classList.remove(OPEN_CLASS);
        documentRef.body?.classList.remove(OPEN_CLASS);
        return false;
      }
    }
    focusNode(nodes.title);
    return true;
  }

  async function onClick(event) {
    if (nodes.overflow.open && !event.target?.closest?.("#moonHeartOverflow")) nodes.overflow.open = false;
    const button = event.target?.closest?.("[data-heart-action]");
    if (!button || !dialog.contains(button)) return;
    const action = button.dataset.heartAction;
    if (busy) return;
    if (action === "pane") setProjectPane(button.dataset.heartPane, { focus: true });
    else if (action === "main-menu") await returnToMainMenu(button);
    else if (action === "back") await returnToOrigin(button);
    else if (action === "chapter") {
      setProjectPane("detail");
      showChapter(button.dataset.chapterId, { focus: true });
    }
    else if (action === "mission") await beginMission(button.dataset.taskId, button);
    else if (action === "choose") await chooseSettlement(button.dataset.choiceId, button);
  }

  function onCancel(event) {
    event.preventDefault();
    if (!busy) void returnToOrigin(nodes.back);
  }

  function onKeydown(event) {
    if (event.target?.matches?.('[data-heart-action="pane"]') && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
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
    if (!busy) void returnToOrigin(nodes.back);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    restoreFocusOnClose = false;
    if (dialog.open && typeof dialog.close === "function") dialog.close();
    else finalizeClose();
    documentRef.documentElement?.classList.remove(OPEN_CLASS);
    documentRef.body?.classList.remove(OPEN_CLASS);
    dialog.removeEventListener("click", onClick);
    dialog.removeEventListener("cancel", onCancel);
    dialog.removeEventListener("keydown", onKeydown);
    dialog.removeEventListener("close", finalizeClose);
    windowRef?.removeEventListener?.("resize", syncViewportHeight);
    windowRef?.removeEventListener?.("orientationchange", syncViewportHeight);
    visualViewport?.removeEventListener?.("resize", syncViewportHeight);
    compactQuery?.removeEventListener?.("change", syncProjectLayout);
    dialog.remove();
    opener = null;
    currentModel = null;
  }

  dialog.addEventListener("click", onClick);
  dialog.addEventListener("cancel", onCancel);
  dialog.addEventListener("keydown", onKeydown);
  dialog.addEventListener("close", finalizeClose);
  windowRef?.addEventListener?.("resize", syncViewportHeight, { passive: true });
  windowRef?.addEventListener?.("orientationchange", syncViewportHeight, { passive: true });
  visualViewport?.addEventListener?.("resize", syncViewportHeight, { passive: true });
  compactQuery?.addEventListener?.("change", syncProjectLayout);
  syncViewportHeight();

  return Object.freeze({
    open,
    close,
    render,
    showChapter,
    destroy,
    isOpen: () => Boolean(openState && !destroyed),
    model: () => currentModel,
    navigation: () => currentNavigation,
    choiceFailureMessage: moonHeartChoiceFailureMessage,
    selectedChapterId: () => selectedChapterId,
    setPane: (pane, options) => { setProjectPane(pane, options); return activePane; },
    pane: () => activePane
  });
}
