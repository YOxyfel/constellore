function clampNumber(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function wordKey(value) {
  return String(value || "").trim().toLowerCase();
}

export function revealBatchKeys(batch) {
  const sourceKeys = new Set();
  const resultKeys = new Set();
  for (const step of batch?.steps || []) {
    sourceKeys.add(step.aKey || wordKey(step.a));
    sourceKeys.add(step.bKey || wordKey(step.b));
    resultKeys.add(step.resultKey || wordKey(step.word));
  }
  return { sourceKeys, resultKeys };
}

export function revealCameraForBatch(batch, layout, phase = "result") {
  const maximum = Number(layout?.bounds?.maxCameraY) || 0;
  if (!layout || maximum <= 0 || !batch) return 0;
  const { sourceKeys, resultKeys } = revealBatchKeys(batch);
  const focusKeys = phase === "summon" || phase === "merge" ? sourceKeys : resultKeys;
  const activeNodes = [...focusKeys]
    .map((key) => layout.nodeByKey?.[wordKey(key)])
    .filter(Boolean);
  if (!activeNodes.length) return 0;
  const minimumY = Math.min(...activeNodes.map((node) => node.y));
  const maximumY = Math.max(...activeNodes.map((node) => node.y + node.height));
  const safeTop = Number(layout.bounds?.top) || 0;
  const safeBottom = Number(layout.bounds?.bottom) || 0;
  const visibleCenter = safeTop
    + Math.max(0, layout.bounds.height - safeTop - safeBottom) / 2;
  const centeredCamera = (minimumY + maximumY) / 2 - visibleCenter;
  const minimumCamera = maximumY - (layout.bounds.height - safeBottom);
  const maximumCamera = minimumY - safeTop;
  if (minimumCamera <= maximumCamera) {
    return clampNumber(
      centeredCamera,
      clampNumber(minimumCamera, 0, maximum),
      clampNumber(maximumCamera, 0, maximum)
    );
  }
  return clampNumber(centeredCamera, 0, maximum);
}

export function revealStageGeometry(rect) {
  const compact = rect.width < 620;
  const shortCompactStage = compact && rect.height < 400;
  const stacked = compact && rect.height >= 560;
  const centerX = rect.width / 2;
  const targetX = clampNumber(centerX - 72, 12, Math.max(12, rect.width - 162));
  const safeTop = compact ? (shortCompactStage ? 84 : 92) : 132;
  const safeBottom = compact ? 146 : 106;
  const targetY = clampNumber(
    rect.height * (compact ? .52 : .56) - 24,
    safeTop,
    Math.max(safeTop, rect.height - safeBottom - 48)
  );
  const spread = compact
    ? Math.min(104, Math.max(72, rect.width * .24))
    : Math.min(238, Math.max(154, rect.width * .24));
  const sourceY = stacked
    ? clampNumber(targetY + 112, 188, Math.max(188, rect.height - 82))
    : targetY;
  const leftX = clampNumber(targetX - spread, 10, Math.max(10, rect.width - 160));
  const rightX = clampNumber(targetX + spread, 10, Math.max(10, rect.width - 160));
  const center = (x, y) => ({ x: x + 72, y: y + 24 });
  return {
    leftX,
    rightX,
    sourceY,
    targetX,
    targetY,
    left: center(leftX, sourceY),
    right: center(rightX, sourceY),
    target: center(targetX, targetY)
  };
}

export function renderRevealPresentation({
  batch,
  batchIndex,
  phase,
  total,
  completedNow,
  target,
  layout,
  left,
  right,
  result,
  elements,
  now = globalThis.performance?.now?.() || Date.now()
}) {
  const steps = Array.isArray(batch?.steps) ? batch.steps : [];
  const step = steps[0];
  const {
    board,
    revealEquation,
    revealEquationStep,
    revealEquationA,
    revealEquationAEmoji,
    revealEquationB,
    revealEquationBEmoji,
    revealEquationAnswer,
    revealEquationAnswerEmoji,
    revealEquationNote
  } = elements || {};
  if (!step || !revealEquation || !board) return null;
  const resolved = phase === "result" || phase === "complete";
  const parallel = steps.length;
  const equations = steps.map((entry) => resolved
    ? `${entry.a} + ${entry.b} = ${entry.word}`
    : `${entry.a} + ${entry.b}`);
  revealEquation.hidden = false;
  revealEquation.dataset.phase = phase;
  revealEquation.dataset.parallel = String(parallel);
  revealEquation.classList.toggle("parallel-paths", parallel > 1);
  revealEquationStep.textContent = phase === "complete"
    ? "Answer complete"
    : parallel > 1
      ? `${parallel} paths growing together`
      : `Combination ${completedNow + 1} of ${total}`;
  revealEquationA.textContent = step.a;
  revealEquationAEmoji.textContent = left?.emoji || "✦";
  revealEquationB.textContent = step.b;
  revealEquationBEmoji.textContent = right?.emoji || "✦";
  revealEquationAnswer.textContent = resolved ? step.word : "?";
  revealEquationAnswerEmoji.textContent = resolved ? result?.emoji || step.emoji || "✦" : "✦";
  revealEquationNote.textContent = phase === "merge"
    ? parallel > 1
      ? `${parallel} combinations are fusing at the same time…`
      : "The two words are fusing…"
    : phase === "result"
      ? equations.join(" · ")
      : phase === "complete"
        ? `Target found: ${target}. The full path remains on the board.`
        : parallel > 1
          ? `Watch ${parallel} branches grow upward together.`
          : "Watch these two words combine.";
  revealEquation.setAttribute("aria-label", resolved
    ? `${phase === "complete" ? "Answer complete" : `${parallel} combinations completed; ${completedNow} of ${total}`}: ${equations.join("; ")}.`
    : `${parallel} combinations active: ${equations.join("; ")}. Answers not shown yet.`);
  board.classList.remove("reveal-summoning", "reveal-merging", "reveal-resulting");
  if (phase === "summon") board.classList.add("reveal-summoning");
  if (phase === "merge") board.classList.add("reveal-merging");
  if (resolved) board.classList.add("reveal-resulting");
  board.dataset.revealNodeCount = String(layout?.nodes?.length || 0);
  board.dataset.revealEdgeCount = String(layout?.edges?.length || 0);
  board.dataset.revealActivePaths = String(parallel);
  board.dataset.revealCompletedPaths = String(phase === "complete" ? total : completedNow);
  board.dataset.revealPhase = phase;
  return {
    phase,
    batchIndex,
    steps,
    activeStepIndices: steps.map((entry) => entry.index),
    layout,
    startedAt: now
  };
}

export function renderRevealController({
  completedCount,
  batch,
  resolved = false,
  total,
  replaying,
  paused,
  elements
}) {
  const complete = !batch && completedCount >= total;
  const parallel = batch?.steps?.length || 0;
  const nextCount = Math.min(total, completedCount + (resolved ? parallel : 0));
  const label = complete
    ? replaying
      ? "Replay complete · returning to mode selection…"
      : `Answer complete · ${total} combination${total === 1 ? "" : "s"} shown`
    : batch
      ? resolved
        ? `${parallel} path${parallel === 1 ? "" : "s"} connected · ${nextCount} of ${total}`
        : `${parallel} path${parallel === 1 ? "" : "s"} combining together · ${completedCount} of ${total}`
      : "Getting the words ready…";
  const progressSteps = complete ? total : resolved ? nextCount : completedCount;
  const progress = total ? Math.min(100, progressSteps / total * 100) : 100;
  elements.revealStepText.textContent = label;
  elements.revealAnnouncement.textContent = label;
  elements.revealProgressBar.style.width = `${progress}%`;
  elements.revealProgressBar.parentElement?.setAttribute("aria-valuenow", String(Math.round(progress)));
  elements.revealPause.disabled = complete;
  elements.revealSpeed.disabled = complete;
  elements.revealSkip.hidden = complete;
  elements.revealController.classList.toggle("is-paused", paused && !complete);
  elements.revealController.classList.toggle("is-complete", complete);
  return label;
}

export function revealBatchAnnouncement(batch, completedCount, total) {
  const equations = (batch?.steps || [])
    .map((step) => `${step.a} plus ${step.b} makes ${step.word}`);
  if (!equations.length) return "";
  return `${equations.join(". ")}. ${completedCount} of ${total} combinations complete.`;
}

export function drawRevealGraph(ctx, {
  visual,
  layout,
  nodes,
  completedSteps,
  paused,
  pausedAt,
  time,
  speed,
  reduced,
  strongerContrast,
  accent,
  cyan
}) {
  if (!visual || !layout?.edges?.length) return false;
  const nodeByKey = new Map(
    (nodes || [])
      .filter((node) => node.revealKey)
      .map((node) => [wordKey(node.revealKey), node])
  );
  const renderedEdge = (edge) => {
    const source = nodeByKey.get(wordKey(edge.fromKey));
    const target = nodeByKey.get(wordKey(edge.toKey));
    if (!source || !target) return null;
    const laneOffset = Number(edge.laneOffset) || 0;
    return {
      ...edge,
      from: {
        x: source.x + (Number(source.revealWidth) || 132) / 2 + laneOffset,
        y: source.y + (Number(source.revealHeight) || 42) / 2
      },
      to: {
        x: target.x + (Number(target.revealWidth) || 132) / 2 + laneOffset * .28,
        y: target.y + (Number(target.revealHeight) || 42) / 2
      }
    };
  };
  const now = paused && pausedAt ? pausedAt : time || globalThis.performance?.now?.() || Date.now();
  const elapsed = Math.max(0, now - visual.startedAt);
  const phase = visual.phase;
  const merging = phase === "merge";
  const resolved = phase === "result" || phase === "complete";
  const activeSteps = new Set(visual.activeStepIndices || []);
  const completed = new Set(completedSteps || []);
  const activeEdges = layout.edges
    .filter((edge) => activeSteps.has(edge.stepIndex))
    .map(renderedEdge)
    .filter(Boolean);
  const visibleEdges = layout.edges
    .filter((edge) => activeSteps.has(edge.stepIndex) || completed.has(edge.stepIndex))
    .map(renderedEdge)
    .filter(Boolean);
  const curveFor = (edge) => ({
    x: (edge.from.x + edge.to.x) / 2,
    y: Math.min(edge.from.y, edge.to.y) - Math.min(44, Math.abs(edge.from.x - edge.to.x) * .11 + 12)
  });
  const traceEdge = (edge, control) => {
    ctx.beginPath();
    ctx.moveTo(edge.from.x, edge.from.y);
    ctx.quadraticCurveTo(control.x, control.y, edge.to.x, edge.to.y);
  };

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const edge of visibleEdges) {
    const active = activeSteps.has(edge.stepIndex);
    const control = curveFor(edge);
    ctx.setLineDash(active && !merging ? [3, 9] : []);
    ctx.globalAlpha = active ? (merging ? .9 : .55) : strongerContrast ? .58 : .34;
    ctx.strokeStyle = active ? (edge.slot === "a" ? accent : cyan) : "rgba(184,211,207,.9)";
    ctx.lineWidth = active ? (merging ? 2.5 : 1.65) : strongerContrast ? 1.8 : 1.2;
    ctx.shadowColor = active ? cyan : "transparent";
    ctx.shadowBlur = active ? (merging ? 18 : 9) : 0;
    traceEdge(edge, control);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  if (!reduced && !resolved) {
    for (const [index, edge] of activeEdges.entries()) {
      const control = curveFor(edge);
      const travel = merging
        ? Math.min(1, elapsed / Math.max(240, 720 / speed))
        : (now * .00022 + index / Math.max(1, activeEdges.length)) % 1;
      const inverse = 1 - travel;
      const x = inverse * inverse * edge.from.x + 2 * inverse * travel * control.x + travel * travel * edge.to.x;
      const y = inverse * inverse * edge.from.y + 2 * inverse * travel * control.y + travel * travel * edge.to.y;
      ctx.globalAlpha = merging ? .96 : .58;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = edge.slot === "a" ? accent : cyan;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(x, y, merging ? 3.3 : 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const activeTargets = [...new Set((visual.steps || []).map((step) => step.resultKey || wordKey(step.word)))]
    .map((key) => nodeByKey.get(wordKey(key)))
    .filter(Boolean);
  for (const target of activeTargets) {
    const targetX = target.x + (Number(target.revealWidth) || 132) / 2;
    const targetY = target.y + (Number(target.revealHeight) || 42) / 2;
    const pulse = reduced ? 1 : .8 + Math.sin(now * .006 + targetX * .01) * .16;
    const radius = resolved
      ? phase === "complete" ? 30 : 20 + ((elapsed * .07) % 42)
      : merging ? 15 + pulse * 6 : 9 + pulse * 3;
    ctx.globalAlpha = resolved ? (phase === "complete" ? .32 : Math.max(.12, .76 - radius / 86)) : merging ? .52 : .24;
    ctx.strokeStyle = resolved ? accent : cyan;
    ctx.lineWidth = resolved ? 1.8 : 1.2;
    ctx.shadowColor = resolved ? accent : cyan;
    ctx.shadowBlur = resolved ? 22 : 12;
    ctx.beginPath();
    ctx.arc(targetX, targetY, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  return true;
}
