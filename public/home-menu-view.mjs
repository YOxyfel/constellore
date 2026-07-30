import { routeRankProgressPresentation } from "./route-rank-client.mjs?v=5.0.0-beta.1";

function byId(documentRef, id) {
  return documentRef.getElementById(id);
}

export function renderProfileRankView(routeRank, documentRef = document) {
  const progress = routeRankProgressPresentation(routeRank);
  const card = byId(documentRef, "profileRouteRankCard");
  card.dataset.rank = progress.id;
  card.dataset.tier = String(Math.ceil(progress.number / 2));
  byId(documentRef, "profileRouteRankMark").textContent = progress.mark;
  byId(documentRef, "profileRouteRankName").textContent = progress.name;
  byId(documentRef, "profileRouteRankNumber").textContent = `RANK ${String(progress.number).padStart(2, "0")}`;
  byId(documentRef, "profileRouteRankStatus").textContent = progress.status;
  byId(documentRef, "profileRouteRankProgress").style.width = `${progress.progress}%`;
  byId(documentRef, "profileRouteRankPercent").textContent = `${progress.progress}%`;
  byId(documentRef, "profileRouteRankDetail").textContent = progress.detail;
  byId(documentRef, "profileRouteRankUnlock").textContent = progress.nextUnlock;
  const meter = byId(documentRef, "profileRouteRankMeter");
  meter.setAttribute("aria-valuenow", String(progress.progress));
  meter.setAttribute("aria-valuetext", progress.meterLabel);
  meter.setAttribute("aria-label", `${progress.name} Route Rank progress`);
  return progress;
}

export function syncHomeMenuView({
  menu,
  trainingCompleted,
  secondOrbitCompleted,
  wins,
  routeRank,
  startStyle,
  dailyCompleted,
  todayKey
}, documentRef = document) {
  const body = documentRef.body;
  body.dataset.homeStage = menu.stage;
  body.classList.toggle("first-session", !menu.onboardingComplete);
  body.classList.toggle("training-needed", !trainingCompleted);
  body.classList.toggle("second-orbit-needed", trainingCompleted && !secondOrbitCompleted && wins === 0);
  for (const state of ["progress", "sharing", "daily", "choices", "explore", "adventures", "advanced"]) {
    body.classList.toggle(`${state}-ready`, menu[`${state}Ready`]);
  }
  body.classList.toggle("daily-locked", menu.dailyLocked);
  body.classList.toggle("focus-mode", menu.focusMode);

  const primary = menu.primary;
  const pressureReady = routeRank.rank.number > 2;
  byId(documentRef, "primaryOrbitKicker").textContent = primary.kicker;
  byId(documentRef, "primaryOrbitTitle").textContent = primary.title;
  byId(documentRef, "primaryOrbitDescription").textContent = primary.description;
  byId(documentRef, "primaryOrbitButton").querySelector("span").textContent = primary.label;
  byId(documentRef, "primaryOrbitMeta").textContent = primary.action === "training" || menu.focusMode
    ? primary.meta
    : `${routeRank.rank.name} · ${startStyle}`;
  byId(documentRef, "primaryOrbitButton").dataset.action = primary.action;
  byId(documentRef, "primaryOrbitSecondary").hidden = !menu.choicesReady && primary.secondaryAction === "modes";
  byId(documentRef, "homeRouteRank").textContent = routeRank.rank.name;
  byId(documentRef, "modeSectionSummary").textContent = pressureReady
    ? "Relaxed, timed, and limited-move games"
    : "Relaxed play";

  const secondary = byId(documentRef, "primaryOrbitSecondary");
  secondary.textContent = primary.secondaryLabel;
  secondary.dataset.action = primary.secondaryAction;

  const unlockNote = documentRef.querySelector('[data-progressive="advanced-lock"]');
  if (unlockNote) {
    const remaining = menu.winsUntilAdvanced;
    unlockNote.textContent = !menu.rankReadyForAdvanced
      ? `Reach Gold Route Rank${remaining > 0 ? ` and complete ${remaining} more game${remaining === 1 ? "" : "s"}` : ""} to open Adventures and competitive tools.`
      : remaining === 1
        ? "More opens after your next completed game."
        : `More opens after ${remaining} completed games.`;
  }

  for (const card of documentRef.querySelectorAll("[data-home-mode]")) {
    card.hidden = card.dataset.homeMode === primary.action
      || (["quick", "moves"].includes(card.dataset.homeMode) && !pressureReady)
      || (card.dataset.homeMode === "daily" && !menu.dailyAvailable);
  }
}
