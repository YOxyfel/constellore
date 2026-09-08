import {
  CONCEPT_MATTER_HOLD_MS,
  listConceptMatterCuts,
  normalizeConceptMatterRepresentation,
  planConceptMatterCut,
  projectConceptMatterCompound
} from "./concept-matter.mjs?v=5.0.0-beta.4";

function text(value, fallback = "") {
  try {
    return String(value ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim() || fallback;
  } catch {
    return fallback;
  }
}

function escapeSelector(value) {
  const source = String(value ?? "");
  return globalThis.CSS?.escape ? globalThis.CSS.escape(source) : source.replace(/["\\]/gu, "\\$&");
}

function iconFor(kind) {
  return ({ peel: "↶", split: "⋈", fracture: "⌁", twist: "✦" })[kind] || "◇";
}

function actionLabel(cut) {
  if (cut.kind === "peel") return `Peel ${cut.input.word}`;
  if (cut.kind === "split") return `Split at ${cut.input.word}`;
  if (cut.kind === "twist") return `Open unstable ${cut.input.word} bond`;
  return `Fracture ${cut.input.word} bond`;
}

function nodeElement(documentRef, tag, className, attributes = {}) {
  const element = documentRef.createElement(tag);
  if (className) element.className = className;
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined) continue;
    element.setAttribute(name, String(value));
  }
  return element;
}

function viewportFor(documentRef) {
  return documentRef.defaultView || globalThis.window;
}

function mobileOrbLayout(view) {
  const width = Math.max(1, Number(view?.innerWidth) || 1280);
  const height = Math.max(1, Number(view?.innerHeight) || 720);
  return width <= 700 || (width <= 900 && height >= width);
}

function orbSizeFor(compound, view) {
  const desktopSize = compound.derived ? Math.min(126, 104 + compound.ancestryCount * 4) : 68;
  if (!mobileOrbLayout(view)) return desktopSize;
  return compound.derived ? Math.min(desktopSize, 98) : 62;
}

function positionPanel(panel, host, view) {
  const hostRect = host?.getBoundingClientRect?.();
  const panelRect = panel?.getBoundingClientRect?.();
  if (!hostRect || !panelRect) return;
  const width = Math.max(320, Number(view?.innerWidth) || 1280);
  const height = Math.max(320, Number(view?.innerHeight) || 720);
  const margin = 12;
  const center = Math.min(width - panelRect.width / 2 - margin, Math.max(panelRect.width / 2 + margin, hostRect.left + hostRect.width / 2));
  const fitsAbove = hostRect.top >= panelRect.height + 26;
  const top = fitsAbove
    ? Math.max(margin, hostRect.top - panelRect.height - 14)
    : Math.min(height - panelRect.height - margin, hostRect.bottom + 14);
  panel.style.setProperty("--concept-matter-panel-x", `${Math.round(center)}px`);
  panel.style.setProperty("--concept-matter-panel-y", `${Math.round(Math.max(margin, top))}px`);
  panel.dataset.placement = fitsAbove ? "above" : "below";
}

function cloneMolecularGlyph(host) {
  const glyph = host?.querySelector?.(".molecular-memory__glyph");
  if (!glyph?.cloneNode) return null;
  const clone = glyph.cloneNode(true);
  clone.classList.add("concept-matter-inspector__glyph");
  clone.removeAttribute("aria-hidden");
  clone.setAttribute("focusable", "false");
  return clone;
}

function renderOrb(documentRef, compound, host) {
  const orb = nodeElement(documentRef, "span", "concept-matter-orb", { "aria-hidden": "true" });
  const body = nodeElement(documentRef, "span", "concept-matter-orb__body");
  const membrane = nodeElement(documentRef, "span", "concept-matter-orb__membrane");
  const interior = nodeElement(documentRef, "span", "concept-matter-orb__interior");
  const sourceEmoji = host?.querySelector?.(":scope > .emoji")?.textContent || "✦";
  if (compound.immediateInputs.length) {
    for (const [index, input] of compound.immediateInputs.slice(0, 2).entries()) {
      const ingredient = nodeElement(documentRef, "span", `concept-matter-orb__ingredient concept-matter-orb__ingredient--${index + 1}`);
      ingredient.textContent = input.word.slice(0, 2).toLocaleUpperCase("en-US");
      ingredient.title = input.word;
      interior.append(ingredient);
    }
    const bond = nodeElement(documentRef, "span", "concept-matter-orb__bond");
    interior.prepend(bond);
  } else {
    const origin = nodeElement(documentRef, "span", "concept-matter-orb__origin");
    origin.textContent = sourceEmoji;
    interior.append(origin);
  }
  if (compound.hiddenGroupCount > 0) {
    const more = nodeElement(documentRef, "span", "concept-matter-orb__more");
    more.textContent = `+${compound.hiddenGroupCount}`;
    interior.append(more);
  }
  const nameplate = nodeElement(documentRef, "span", "concept-matter-orb__nameplate");
  nameplate.textContent = compound.word;
  body.append(membrane, interior);
  orb.append(body, nameplate);
  return orb;
}

export function createConceptMatterRuntime({
  document: documentRef = globalThis.document,
  boardItems,
  onCommit,
  onInspect,
  onClose,
  onAnnounce
} = {}) {
  if (!documentRef?.createElement || !boardItems) throw new TypeError("Concept Matter runtime requires a document and board item host.");
  const view = viewportFor(documentRef);
  const records = new Map();
  let snapshot = {
    nodes: [],
    history: [],
    capabilities: {},
    routeGuide: null,
    representation: "compound",
    active: false
  };
  let activeNodeId = "";
  let activeCutGesture = null;
  const suppressedPointerClicks = new WeakSet();

  const panel = nodeElement(documentRef, "section", "concept-matter-inspector", {
    id: "conceptMatterInspector",
    role: "dialog",
    "aria-modal": "false",
    "aria-labelledby": "conceptMatterInspectorTitle",
    "aria-describedby": "conceptMatterInspectorInstruction conceptMatterInspectorIntegrity",
    tabindex: "-1"
  });
  panel.hidden = true;
  documentRef.body?.append(panel);

  function recordFor(nodeId) {
    return records.get(String(nodeId || "")) || null;
  }

  function activeRecord() {
    return recordFor(activeNodeId);
  }

  function announce(message) {
    if (message) onAnnounce?.(message);
  }

  function resetCutGesture() {
    const gesture = activeCutGesture;
    activeCutGesture = null;
    if (!gesture) return;
    try {
      if (gesture.button.hasPointerCapture?.(gesture.pointerId)) gesture.button.releasePointerCapture?.(gesture.pointerId);
    } catch {}
    gesture.button.classList.remove("is-tearing", "is-armed");
    gesture.button.style.removeProperty("--tear-x");
    gesture.button.style.removeProperty("--tear-y");
  }

  function suppressNextPointerClick(button) {
    if (!button) return;
    suppressedPointerClicks.add(button);
    const clear = () => suppressedPointerClicks.delete(button);
    // Safari can defer the compatibility click after a touch-pointer sequence.
    // Keep the one-shot guard just long enough to consume that click.
    if (typeof view?.setTimeout === "function") view.setTimeout(clear, 400);
    else globalThis.setTimeout?.(clear, 400);
  }

  function close({ restoreFocus = false, reason = "close" } = {}) {
    resetCutGesture();
    const current = activeRecord();
    if (!activeNodeId && panel.hidden) return false;
    panel.hidden = true;
    panel.dataset.state = "closed";
    panel.replaceChildren();
    if (current?.host) {
      current.host.classList.remove("concept-matter-inspecting");
      if (restoreFocus && current.host.offsetParent !== null) current.host.focus?.({ preventScroll: true });
    }
    activeNodeId = "";
    onClose?.({ reason });
    return true;
  }

  function commitCut(cut, { source = "pointer" } = {}) {
    const current = activeRecord();
    if (!current || !cut?.enabled) {
      announce(cut?.reason || "That bond is stable in the current mode.");
      return null;
    }
    const plan = planConceptMatterCut({
      history: snapshot.history,
      concept: { word: current.node.item?.word, instanceId: current.instanceId },
      cutId: cut.id,
      capabilities: snapshot.capabilities,
      routeGuide: snapshot.routeGuide
    });
    if (!plan.allowed) {
      announce(plan.message);
      return plan;
    }
    close({ restoreFocus: false, reason: "commit" });
    onCommit?.({ nodeId: current.node.id, cut, plan, source });
    return plan;
  }

  function cutButton(cut) {
    const button = nodeElement(documentRef, "button", `concept-matter-cut concept-matter-cut--${cut.kind}`, {
      type: "button",
      "data-concept-matter-cut": cut.id,
      "data-cut-kind": cut.kind,
      "aria-disabled": String(!cut.enabled),
      title: cut.enabled ? `${cut.outcomeLabel}. Drag outward or activate.` : cut.reason
    });
    const icon = nodeElement(documentRef, "span", "concept-matter-cut__icon", { "aria-hidden": "true" });
    icon.textContent = iconFor(cut.kind);
    const copy = nodeElement(documentRef, "span", "concept-matter-cut__copy");
    const title = nodeElement(documentRef, "strong", "");
    title.textContent = actionLabel(cut);
    const detail = nodeElement(documentRef, "small", "");
    detail.textContent = cut.enabled ? cut.outcomeLabel : cut.reason;
    copy.append(title, detail);
    const affordance = nodeElement(documentRef, "span", "concept-matter-cut__affordance", { "aria-hidden": "true" });
    affordance.textContent = cut.enabled ? "DRAG" : "LOCKED";
    button.append(icon, copy, affordance);
    button.addEventListener("click", (event) => {
      if (event.detail !== 0 && suppressedPointerClicks.has(button)) {
        suppressedPointerClicks.delete(button);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (activeCutGesture) return;
      event.stopPropagation();
      commitCut(cut, { source: event.detail === 0 ? "keyboard" : "tap" });
    });
    return button;
  }

  function renderInspector(current) {
    // A sync can replace the cut controls while a pointer is captured. Cancel
    // that gesture before rebuilding so no detached control keeps ownership.
    resetCutGesture();
    const header = nodeElement(documentRef, "header", "concept-matter-inspector__header");
    const heading = nodeElement(documentRef, "span", "concept-matter-inspector__heading");
    const kicker = nodeElement(documentRef, "small", "");
    kicker.textContent = "MOLECULAR VIEW";
    const title = nodeElement(documentRef, "strong", "", { id: "conceptMatterInspectorTitle" });
    title.textContent = current.compound.word;
    heading.append(kicker, title);
    const closeButton = nodeElement(documentRef, "button", "concept-matter-inspector__close", {
      type: "button",
      "aria-label": `Close ${current.compound.word} Molecular View`
    });
    closeButton.textContent = "×";
    closeButton.addEventListener("click", () => close({ restoreFocus: true, reason: "button" }));
    header.append(heading, closeButton);

    const structure = nodeElement(documentRef, "div", "concept-matter-inspector__structure", {
      role: "img",
      "aria-label": current.compound.accessibleLabel
    });
    const glyph = cloneMolecularGlyph(current.host);
    if (glyph) structure.append(glyph);
    else {
      const fallback = nodeElement(documentRef, "p", "concept-matter-inspector__formula");
      fallback.textContent = current.compound.immediateInputs.length
        ? `${current.compound.immediateInputs.map((input) => input.word).join(" + ")} → ${current.compound.word}`
        : `${current.compound.word} · ORIGIN`;
      structure.append(fallback);
    }

    const instruction = nodeElement(documentRef, "p", "concept-matter-inspector__instruction", {
      id: "conceptMatterInspectorInstruction"
    });
    instruction.textContent = current.cuts.some((cut) => cut.enabled)
      ? "Pull an available bond through the membrane. Its exact result is shown before you commit."
      : "This compound can be inspected here. Its bonds are stabilized in the current mode.";
    const cutList = nodeElement(documentRef, "div", "concept-matter-inspector__cuts", {
      role: "group",
      "aria-label": `${current.compound.word} bonds`
    });
    if (current.cuts.length) cutList.append(...current.cuts.map(cutButton));
    else {
      const origin = nodeElement(documentRef, "p", "concept-matter-inspector__origin");
      origin.textContent = "Origin concepts have no performed bond to open.";
      cutList.append(origin);
    }
    const integrity = nodeElement(documentRef, "p", "concept-matter-inspector__integrity", {
      id: "conceptMatterInspectorIntegrity"
    });
    integrity.textContent = "Board matter only · discoveries, score, project progress, and reaction memory are never removed.";
    panel.replaceChildren(header, structure, instruction, cutList, integrity);
  }

  function inspect(nodeId, { pinned = true, focus = false, source = "program" } = {}) {
    const current = recordFor(nodeId);
    if (!current || snapshot.capabilities?.inspect !== true) return false;
    if (activeNodeId && activeNodeId !== String(nodeId)) close({ restoreFocus: false, reason: "switch" });
    activeNodeId = String(nodeId);
    onInspect?.({ nodeId: current.node.id, source });
    current.host.classList.add("concept-matter-inspecting");
    renderInspector(current);
    panel.hidden = false;
    panel.dataset.state = pinned ? "pinned" : "preview";
    panel.dataset.profile = snapshot.capabilities.profile || "observational";
    positionPanel(panel, current.host, view);
    if (focus) panel.focus?.({ preventScroll: true });
    announce(`${current.compound.word} Molecular View opened. ${current.cuts.filter((cut) => cut.enabled).length} editable ${current.cuts.filter((cut) => cut.enabled).length === 1 ? "bond" : "bonds"}.`);
    return true;
  }

  function decorate(recordValue) {
    const { host, compound } = recordValue;
    host.querySelector?.(":scope > .concept-matter-orb")?.remove?.();
    host.classList.add("concept-matter-node");
    host.classList.toggle("concept-matter-node--derived", compound.derived);
    host.classList.toggle("concept-matter-node--origin", !compound.derived);
    host.dataset.conceptMatter = compound.derived ? "compound" : "origin";
    host.dataset.conceptMatterInstance = compound.instanceId;
    host.dataset.conceptMatterReactions = String(compound.ancestryCount);
    host.style.setProperty("--concept-matter-base-size", compound.derived ? `${Math.min(126, 104 + compound.ancestryCount * 4)}px` : "68px");
    host.append(renderOrb(documentRef, compound, host));
  }

  function undecorate(host) {
    host?.querySelector?.(":scope > .concept-matter-orb")?.remove?.();
    host?.classList?.remove?.("concept-matter-node", "concept-matter-node--derived", "concept-matter-node--origin", "concept-matter-inspecting");
    host?.removeAttribute?.("data-concept-matter");
    host?.removeAttribute?.("data-concept-matter-instance");
    host?.removeAttribute?.("data-concept-matter-reactions");
    host?.style?.removeProperty?.("--concept-matter-base-size");
    host?.style?.removeProperty?.("--concept-matter-size");
  }

  function sync(next = {}) {
    snapshot = {
      nodes: Array.isArray(next.nodes) ? next.nodes : [],
      history: Array.isArray(next.history) ? next.history : [],
      capabilities: next.capabilities || {},
      routeGuide: next.routeGuide || null,
      representation: normalizeConceptMatterRepresentation(next.representation),
      active: next.active !== false
    };
    boardItems.dataset.conceptMatterRepresentation = snapshot.representation;
    boardItems.dataset.conceptMatterProfile = snapshot.capabilities.profile || "observational";
    const liveIds = new Set();
    if (!snapshot.active) {
      close({ restoreFocus: false, reason: "inactive" });
      for (const current of records.values()) undecorate(current.host);
      records.clear();
      return;
    }
    if (snapshot.capabilities?.inspect !== true) close({ restoreFocus: false, reason: "inspection-disabled" });
    for (const node of snapshot.nodes) {
      if (!node || node.revealRole || node.item?.ghost) continue;
      const id = String(node.id);
      const host = boardItems.querySelector(`.board-word[data-id="${escapeSelector(id)}"]`);
      if (!host) continue;
      liveIds.add(id);
      const instanceId = text(node.molecularMemoryInstanceId, `origin:${text(node.item?.word).toLocaleLowerCase("en-US")}`);
      const compound = projectConceptMatterCompound({
        history: snapshot.history,
        concept: { word: node.item?.word, instanceId }
      });
      const cuts = listConceptMatterCuts({
        history: snapshot.history,
        concept: { word: node.item?.word, instanceId },
        capabilities: snapshot.capabilities,
        routeGuide: snapshot.routeGuide
      });
      const previous = records.get(id);
      const current = { node, host, instanceId, compound, cuts };
      records.set(id, current);
      const signature = `${snapshot.representation}|${compound.instanceId}|${compound.ancestryCount}|${cuts.map((cut) => `${cut.id}:${cut.enabled}`).join("|")}`;
      if (
        previous?.host !== host
        || previous.signature !== signature
        || !host.classList.contains("concept-matter-node")
        || !host.querySelector(":scope > .concept-matter-orb")
      ) {
        decorate(current);
      }
      current.signature = signature;
      if (activeNodeId === id && !panel.hidden) {
        renderInspector(current);
        positionPanel(panel, host, view);
      }
    }
    for (const [id, current] of [...records.entries()]) {
      if (liveIds.has(id)) continue;
      if (activeNodeId === id) close({ restoreFocus: false, reason: "node-removed" });
      undecorate(current.host);
      records.delete(id);
    }
  }

  function estimateSize({ word = "", instanceId = "", history = snapshot.history, representation = snapshot.representation } = {}) {
    if (normalizeConceptMatterRepresentation(representation) === "compact") return null;
    const compound = projectConceptMatterCompound({ history, concept: { word, instanceId } });
    const size = orbSizeFor(compound, view);
    return Object.freeze({ width: size, height: size + 18, derived: compound.derived });
  }

  function beginCutGesture(event) {
    const button = event.target?.closest?.("[data-concept-matter-cut]");
    if (!button || button.getAttribute("aria-disabled") === "true" || Number(event.button ?? 0) !== 0) return;
    const cut = activeRecord()?.cuts.find((candidate) => candidate.id === button.dataset.conceptMatterCut);
    if (!cut?.enabled) return;
    event.stopPropagation();
    const pointerId = event.pointerId;
    activeCutGesture = {
      pointerId,
      button,
      cut,
      startX: event.clientX,
      startY: event.clientY,
      armed: false,
      moved: false
    };
    button.setPointerCapture?.(pointerId);
    button.classList.add("is-tearing");
  }

  function moveCutGesture(event) {
    const gesture = activeCutGesture;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    const distance = Math.hypot(dx, dy);
    const threshold = gesture.cut.kind === "peel" ? 72 : 96;
    gesture.moved ||= distance > 6;
    gesture.armed = distance >= threshold;
    gesture.button.style.setProperty("--tear-x", `${Math.round(dx)}px`);
    gesture.button.style.setProperty("--tear-y", `${Math.round(dy)}px`);
    gesture.button.classList.toggle("is-armed", gesture.armed);
    if (gesture.moved) event.preventDefault();
  }

  function endCutGesture(event) {
    const gesture = activeCutGesture;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const armed = gesture.armed;
    const moved = gesture.moved;
    const cut = gesture.cut;
    if (moved) suppressNextPointerClick(gesture.button);
    resetCutGesture();
    if (armed) {
      event.preventDefault();
      event.stopPropagation();
      commitCut(cut, { source: "tear" });
    } else if (moved) {
      event.preventDefault();
      event.stopPropagation();
      announce(`${cut.outcomeLabel}. Pull farther to commit, or press Enter.`);
    }
  }

  function cancelCutGesture(event) {
    if (!activeCutGesture || (event?.pointerId != null && event.pointerId !== activeCutGesture.pointerId)) return;
    resetCutGesture();
  }

  function keydown(event) {
    if (event.key !== "Escape" || panel.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    close({ restoreFocus: true, reason: "escape" });
  }

  function outsidePointer(event) {
    if (panel.hidden || panel.contains(event.target) || activeRecord()?.host?.contains?.(event.target)) return;
    close({ restoreFocus: false, reason: "outside" });
  }

  function viewportResize() {
    const current = activeRecord();
    if (current && !panel.hidden) positionPanel(panel, current.host, view);
  }

  panel.addEventListener("pointerdown", beginCutGesture);
  panel.addEventListener("lostpointercapture", cancelCutGesture);
  view?.addEventListener?.("pointermove", moveCutGesture);
  view?.addEventListener?.("pointerup", endCutGesture);
  view?.addEventListener?.("pointercancel", cancelCutGesture);
  view?.addEventListener?.("resize", viewportResize, { passive: true });
  documentRef.addEventListener("keydown", keydown, true);
  documentRef.addEventListener("pointerdown", outsidePointer, true);

  function destroy() {
    close({ restoreFocus: false, reason: "destroy" });
    for (const current of records.values()) undecorate(current.host);
    records.clear();
    panel.remove();
    view?.removeEventListener?.("pointermove", moveCutGesture);
    view?.removeEventListener?.("pointerup", endCutGesture);
    view?.removeEventListener?.("pointercancel", cancelCutGesture);
    view?.removeEventListener?.("resize", viewportResize);
    documentRef.removeEventListener("keydown", keydown, true);
    documentRef.removeEventListener("pointerdown", outsidePointer, true);
  }

  return Object.freeze({
    sync,
    inspect,
    close,
    destroy,
    estimateSize,
    has: (nodeId) => records.has(String(nodeId)),
    modelFor: (nodeId) => recordFor(nodeId)?.compound || null,
    cutsFor: (nodeId) => recordFor(nodeId)?.cuts || Object.freeze([]),
    get holdMs() { return CONCEPT_MATTER_HOLD_MS; },
    get activeNodeId() { return activeNodeId; },
    get panel() { return panel; }
  });
}
