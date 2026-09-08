const SVG_NS = "http://www.w3.org/2000/svg";

export function conceptBondWordKey(value) {
  return String(value?.word ?? value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US");
}

export function conceptBondCurve(from, to, { bend = .28 } = {}) {
  const ax = Number(from?.x) || 0;
  const ay = Number(from?.y) || 0;
  const bx = Number(to?.x) || 0;
  const by = Number(to?.y) || 0;
  const dx = bx - ax;
  const dy = by - ay;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const curve = Math.min(54, distance * Math.max(0, Math.min(.5, Number(bend) || 0)));
  const c1 = { x: ax + dx * .34 + normalX * curve, y: ay + dy * .34 + normalY * curve };
  const c2 = { x: ax + dx * .72 + normalX * curve * .42, y: ay + dy * .72 + normalY * curve * .42 };
  return `M ${ax.toFixed(1)} ${ay.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${bx.toFixed(1)} ${by.toFixed(1)}`;
}

export function conceptBondFallbackEndpoint({ from, width, height, distance = 164 } = {}) {
  const boardWidth = Math.max(1, Number(width) || 1);
  const boardHeight = Math.max(1, Number(height) || 1);
  const start = { x: Number(from?.x) || boardWidth / 2, y: Number(from?.y) || boardHeight / 2 };
  const direction = start.x < boardWidth * .56 ? 1 : -1;
  return {
    x: Math.max(62, Math.min(boardWidth - 62, start.x + direction * Math.min(Number(distance) || 164, boardWidth * .3))),
    y: Math.max(72, Math.min(boardHeight - 72, start.y + Math.min(46, boardHeight * .08)))
  };
}

export function conceptBondGuideState(raw) {
  const guide = raw && typeof raw === "object" ? raw : {};
  const activeWord = guide.activeWord || guide.backboneWord || guide.focusWord || guide.anchorWord || "";
  const requiredPartner = guide.requiredPartner || guide.partnerWord || guide.reagentWord || guide.nextReagent || "";
  const expectedProduct = guide.expectedProduct || guide.productWord || guide.resultWord || guide.nextProduct || "";
  const detourActive = Boolean(
    guide.detour?.active === true
    || guide.allowedPair?.classification === "reagent"
    || guide.phase === "reagent"
    || guide.role === "reagent"
  );
  const backboneWord = guide.backboneWord || (detourActive ? "" : activeWord);
  const backboneRequiredPartner = guide.backboneRequiredPartner
    || (detourActive ? guide.detour?.target : requiredPartner)
    || "";
  const backboneProduct = guide.backboneProduct || (detourActive ? "" : expectedProduct);
  const active = Boolean(guide.active ?? (activeWord && requiredPartner));
  return {
    ...guide,
    active,
    phase: detourActive ? "reagent" : (guide.phase || guide.role || "backbone"),
    detourActive,
    activeWord: String(activeWord || ""),
    requiredPartner: String(requiredPartner || ""),
    expectedProduct: String(expectedProduct || ""),
    backboneWord: String(backboneWord || ""),
    backboneRequiredPartner: String(backboneRequiredPartner || ""),
    backboneProduct: String(backboneProduct || "")
  };
}

function ensureLayerContents(layer) {
  if (layer.querySelector(".concept-bond__path")) return;
  const waitingGlow = layer.ownerDocument.createElementNS(SVG_NS, "path");
  waitingGlow.setAttribute("class", "concept-bond__waiting-glow");
  waitingGlow.setAttribute("hidden", "");
  const waitingPath = layer.ownerDocument.createElementNS(SVG_NS, "path");
  waitingPath.setAttribute("class", "concept-bond__waiting-path");
  waitingPath.setAttribute("hidden", "");
  const glow = layer.ownerDocument.createElementNS(SVG_NS, "path");
  glow.setAttribute("class", "concept-bond__glow");
  const path = layer.ownerDocument.createElementNS(SVG_NS, "path");
  path.setAttribute("class", "concept-bond__path");
  const endpoint = layer.ownerDocument.createElementNS(SVG_NS, "g");
  endpoint.setAttribute("class", "concept-bond__endpoint");
  const halo = layer.ownerDocument.createElementNS(SVG_NS, "circle");
  halo.setAttribute("class", "concept-bond__endpoint-halo");
  halo.setAttribute("r", "19");
  const socket = layer.ownerDocument.createElementNS(SVG_NS, "circle");
  socket.setAttribute("class", "concept-bond__endpoint-socket");
  socket.setAttribute("r", "7");
  const label = layer.ownerDocument.createElementNS(SVG_NS, "text");
  label.setAttribute("class", "concept-bond__endpoint-label");
  label.setAttribute("y", "-25");
  label.setAttribute("text-anchor", "middle");
  endpoint.append(halo, socket, label);
  const waitingEndpoint = layer.ownerDocument.createElementNS(SVG_NS, "g");
  waitingEndpoint.setAttribute("class", "concept-bond__waiting-endpoint");
  waitingEndpoint.setAttribute("hidden", "");
  const waitingSocket = layer.ownerDocument.createElementNS(SVG_NS, "circle");
  waitingSocket.setAttribute("class", "concept-bond__waiting-socket");
  waitingSocket.setAttribute("r", "5");
  const waitingLabel = layer.ownerDocument.createElementNS(SVG_NS, "text");
  waitingLabel.setAttribute("class", "concept-bond__waiting-label");
  waitingLabel.setAttribute("y", "-18");
  waitingLabel.setAttribute("text-anchor", "middle");
  waitingEndpoint.append(waitingSocket, waitingLabel);
  layer.append(waitingGlow, waitingPath, glow, path, waitingEndpoint, endpoint);
}

function setSvgHidden(element, hidden) {
  element?.toggleAttribute?.("hidden", Boolean(hidden));
}

function readBloomOrigin(board, boardRect, viewWindow) {
  const bloom = board.querySelector("#constellationBloom");
  if (!bloom || bloom.hidden) return null;
  const style = viewWindow.getComputedStyle?.(bloom);
  const x = Number.parseFloat(style?.getPropertyValue("--bloom-origin-x"));
  const y = Number.parseFloat(style?.getPropertyValue("--bloom-origin-y"));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || x > boardRect.width || y < 0 || y > boardRect.height) return null;
  return { x, y };
}

function appendDescription(element, id, enabled) {
  const ids = new Set(String(element.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
  if (enabled) ids.add(id);
  else ids.delete(id);
  if (ids.size) element.setAttribute("aria-describedby", [...ids].join(" "));
  else element.removeAttribute("aria-describedby");
}

export function createConceptBondRuntime({
  board,
  layer,
  status,
  getSnapshot,
  viewWindow = globalThis.window
} = {}) {
  if (!board || !layer || typeof getSnapshot !== "function") throw new TypeError("Concept Bond requires a board, layer, and getSnapshot().");
  ensureLayerContents(layer);
  const waitingGlow = layer.querySelector(".concept-bond__waiting-glow");
  const waitingPath = layer.querySelector(".concept-bond__waiting-path");
  const glow = layer.querySelector(".concept-bond__glow");
  const path = layer.querySelector(".concept-bond__path");
  const waitingEndpoint = layer.querySelector(".concept-bond__waiting-endpoint");
  const waitingLabel = layer.querySelector(".concept-bond__waiting-label");
  const endpoint = layer.querySelector(".concept-bond__endpoint");
  const label = layer.querySelector(".concept-bond__endpoint-label");
  let frame = 0;
  let destroyed = false;
  let last = { active: false, activeWord: "", requiredPartner: "", expectedProduct: "" };

  function clearNodeRoles() {
    for (const node of board.querySelectorAll(".board-word.concept-backbone, .board-word.concept-reagent, .board-word.concept-detour-active, .board-word.concept-backbone-waiting")) {
      node.classList.remove("concept-backbone", "concept-reagent", "concept-detour-active", "concept-backbone-waiting");
      delete node.dataset.conceptRole;
      appendDescription(node, status?.id || "conceptChemistryStatus", false);
    }
  }

  function boardPoint(element, boardRect) {
    const rect = element?.getBoundingClientRect?.();
    return rect ? {
      x: rect.left - boardRect.left + rect.width / 2,
      y: rect.top - boardRect.top + rect.height / 2
    } : null;
  }

  function topNodeFor(nodes, key) {
    return nodes
      .filter((element) => conceptBondWordKey(element.dataset.word) === key)
      .sort((left, right) => (Number(right.style.zIndex) || 0) - (Number(left.style.zIndex) || 0))[0]
      || null;
  }

  function hideWaitingBond() {
    setSvgHidden(waitingGlow, true);
    setSvgHidden(waitingPath, true);
    setSvgHidden(waitingEndpoint, true);
  }

  function hideActiveBond() {
    setSvgHidden(glow, true);
    setSvgHidden(path, true);
    setSvgHidden(endpoint, true);
  }

  function sync() {
    frame = 0;
    if (destroyed) return last;
    clearNodeRoles();
    const guide = conceptBondGuideState(getSnapshot());
    last = guide;
    const activeKey = conceptBondWordKey(guide.activeWord);
    const partnerKey = conceptBondWordKey(guide.requiredPartner);
    const backboneKey = conceptBondWordKey(guide.backboneWord);
    board.dataset.conceptChemistry = guide.active ? guide.phase : "free";
    layer.dataset.phase = guide.phase;
    if (status) {
      const announcement = guide.active
        ? guide.detourActive
          ? `${guide.backboneWord} is waiting for ${guide.backboneRequiredPartner}. Build that reagent now: combine ${guide.activeWord} with ${guide.requiredPartner}${guide.expectedProduct ? ` to form ${guide.expectedProduct}` : ""}.`
          : `${guide.activeWord} has an open Concept Bond. Combine it with ${guide.requiredPartner}${guide.expectedProduct ? ` to form ${guide.expectedProduct}` : ""}. Finish this reaction before beginning another branch.`
        : "";
      if (status.textContent !== announcement) status.textContent = announcement;
    }
    if (!guide.active || !activeKey || !partnerKey) {
      hideActiveBond();
      hideWaitingBond();
      setSvgHidden(layer, true);
      return last;
    }
    const nodes = [...board.querySelectorAll(".board-word")].filter((element) => !element.disabled);
    const activeNode = topNodeFor(nodes, activeKey);
    const backboneNode = guide.detourActive ? topNodeFor(nodes, backboneKey) : activeNode;
    for (const node of nodes) {
      if (conceptBondWordKey(node.dataset.word) !== partnerKey) continue;
      node.classList.add("concept-reagent");
      node.dataset.conceptRole = "reagent";
    }
    if (backboneNode) {
      backboneNode.classList.add("concept-backbone");
      backboneNode.dataset.conceptRole = guide.detourActive ? "backbone-waiting" : "backbone";
      appendDescription(backboneNode, status?.id || "conceptChemistryStatus", true);
    }
    if (guide.detourActive && activeNode && activeNode !== backboneNode) {
      activeNode.classList.add("concept-detour-active");
      activeNode.dataset.conceptRole = "reagent-source";
      appendDescription(activeNode, status?.id || "conceptChemistryStatus", true);
    }
    const boardRect = board.getBoundingClientRect();
    const from = boardPoint(activeNode, boardRect);
    let activeVisible = false;
    if (from) {
      let to = readBloomOrigin(board, boardRect, viewWindow);
      if (!to || Math.hypot(to.x - from.x, to.y - from.y) < 78) {
        to = conceptBondFallbackEndpoint({ from, width: boardRect.width, height: boardRect.height });
      }
      const d = conceptBondCurve(from, to, { bend: guide.detourActive ? .2 : .28 });
      glow.setAttribute("d", d);
      path.setAttribute("d", d);
      endpoint.setAttribute("transform", `translate(${to.x.toFixed(1)} ${to.y.toFixed(1)})`);
      label.textContent = guide.requiredPartner.length > 18 ? `${guide.requiredPartner.slice(0, 17)}\u2026` : guide.requiredPartner;
      setSvgHidden(glow, false);
      setSvgHidden(path, false);
      setSvgHidden(endpoint, false);
      activeVisible = true;
    } else {
      hideActiveBond();
    }

    let waitingVisible = false;
    const waitingFrom = guide.detourActive ? boardPoint(backboneNode, boardRect) : null;
    if (waitingFrom) {
      backboneNode.classList.add("concept-backbone-waiting");
      const waitingTo = conceptBondFallbackEndpoint({
        from: waitingFrom,
        width: boardRect.width,
        height: boardRect.height,
        distance: 118
      });
      const waitingD = conceptBondCurve(waitingFrom, waitingTo, { bend: .12 });
      waitingGlow.setAttribute("d", waitingD);
      waitingPath.setAttribute("d", waitingD);
      waitingEndpoint.setAttribute("transform", `translate(${waitingTo.x.toFixed(1)} ${waitingTo.y.toFixed(1)})`);
      const waitingFor = guide.backboneRequiredPartner || guide.detour?.target || "reagent";
      waitingLabel.textContent = waitingFor.length > 18 ? `${waitingFor.slice(0, 17)}\u2026` : waitingFor;
      setSvgHidden(waitingGlow, false);
      setSvgHidden(waitingPath, false);
      setSvgHidden(waitingEndpoint, false);
      waitingVisible = true;
    } else {
      hideWaitingBond();
    }
    layer.setAttribute("viewBox", `0 0 ${Math.max(1, boardRect.width)} ${Math.max(1, boardRect.height)}`);
    setSvgHidden(layer, !activeVisible && !waitingVisible);
    return last;
  }

  function schedule() {
    if (destroyed || frame) return;
    frame = viewWindow.requestAnimationFrame?.(sync) || viewWindow.setTimeout?.(sync, 16) || 0;
  }

  const resizeObserver = typeof viewWindow.ResizeObserver === "function" ? new viewWindow.ResizeObserver(schedule) : null;
  resizeObserver?.observe(board);
  const mutationObserver = typeof viewWindow.MutationObserver === "function" ? new viewWindow.MutationObserver(schedule) : null;
  mutationObserver?.observe(board, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "hidden"] });
  viewWindow.addEventListener?.("resize", schedule, { passive: true });
  viewWindow.visualViewport?.addEventListener?.("resize", schedule, { passive: true });

  return {
    sync,
    schedule,
    pulse() {
      board.classList.remove("concept-bond-rejected");
      void board.offsetWidth;
      board.classList.add("concept-bond-rejected");
      viewWindow.setTimeout?.(() => board.classList.remove("concept-bond-rejected"), 620);
    },
    get snapshot() { return { ...last, visible: !layer.hasAttribute("hidden") }; },
    destroy() {
      destroyed = true;
      if (frame) viewWindow.cancelAnimationFrame?.(frame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      viewWindow.removeEventListener?.("resize", schedule);
      viewWindow.visualViewport?.removeEventListener?.("resize", schedule);
      clearNodeRoles();
      setSvgHidden(layer, true);
      delete board.dataset.conceptChemistry;
    }
  };
}
