/**
 * Keeps the decorative combination story tied to authoritative target-route
 * progress. A valid recipe is not necessarily useful for the current target;
 * only steps that reduced the server-authored route distance (or completed the
 * target) are allowed to become story chapters.
 */

function normalizedWord(value) {
  return String(value || "").trim().toLocaleLowerCase("en-US");
}

const ROUTE_RELEVANCE = new Set(["route", "target", "discovery", "known", "ignored"]);

function historyKey(step) {
  if (!step || typeof step !== "object" || Array.isArray(step)) return "";
  return `${normalizedWord(step.a)}+${normalizedWord(step.b)}=>${normalizedWord(step.word)}`;
}

export function isTargetRouteStoryStep(step) {
  if (!step || typeof step !== "object" || Array.isArray(step)) return false;
  if (step.routeCompleted === true) return true;
  const stepsAdvanced = Number(step.routeStepsAdvanced);
  if (Number.isFinite(stepsAdvanced) && stepsAdvanced > 0) return true;
  const relevance = String(step.runIqRelevance || "").trim().toLocaleLowerCase("en-US");
  return relevance === "route" || relevance === "target";
}

export function targetRouteStoryHistory(history, target = "") {
  const source = Array.isArray(history) ? history : [];
  const targetKey = normalizedWord(target);
  const route = [];
  for (const step of source) {
    if (!isTargetRouteStoryStep(step)) continue;
    route.push(step);
    if (targetKey && normalizedWord(step.word) === targetKey) break;
  }
  return route;
}

/**
 * Restores client-computed route evidence after an authoritative run resume.
 * The merge is deliberately all-or-nothing: evidence is copied only when the
 * saved history is an exact, ordered match for the server history.
 */
export function restoreTargetRouteStoryEvidence(history, savedHistory) {
  const current = Array.isArray(history) ? history : [];
  const saved = Array.isArray(savedHistory) ? savedHistory : [];
  const matches = current.length === saved.length
    && current.every((step, index) => historyKey(step) && historyKey(step) === historyKey(saved[index]));
  if (!matches) return current;

  return current.map((step, index) => {
    const evidence = saved[index] || {};
    const relevance = String(evidence.runIqRelevance || "").trim().toLocaleLowerCase("en-US");
    const stepsAdvanced = Number(evidence.routeStepsAdvanced);
    const routeTotal = Number(evidence.routeTotal);
    return {
      ...step,
      ...(typeof evidence.runIqNewToRun === "boolean" ? { runIqNewToRun: evidence.runIqNewToRun } : {}),
      ...(ROUTE_RELEVANCE.has(relevance) ? { runIqRelevance: relevance } : {}),
      ...(Number.isFinite(stepsAdvanced) ? { routeStepsAdvanced: Math.max(0, Math.min(100, stepsAdvanced)) } : {}),
      ...(Number.isFinite(routeTotal) ? { routeTotal: Math.max(0, Math.min(100, routeTotal)) } : {}),
      ...(typeof evidence.routeCompleted === "boolean" ? { routeCompleted: evidence.routeCompleted } : {})
    };
  });
}
