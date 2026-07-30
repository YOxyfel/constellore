import {
  buildConstellationCard,
  buildConstelloreChallengeUrl,
  constellationCardFilename,
  constellationCardShareText,
  constellationSharePresentation,
  normalizeConstellationCardStyle,
  renderConstellationCardSvg
} from "./constellation-card.mjs?v=5.0.0-beta.1";
import { selectUniverse } from "./universe-director.mjs?v=5.0.0-beta.1";

const $ = (selector) => document.querySelector(selector);
const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);

export function createShareCardController({
  state,
  getTodayKey,
  stopTimer,
  showToast,
  track,
  fetchJson,
  closeHubMenu,
  getCosmeticCardStyle = () => "celestial-atlas"
}) {
  function cosmeticCardStyle() {
    try {
      return normalizeConstellationCardStyle(getCosmeticCardStyle());
    } catch {
      return "celestial-atlas";
    }
  }

  function challengeUrl(game) {
    return buildConstelloreChallengeUrl(
      game,
      location.origin + location.pathname,
      { dailyKey: getTodayKey() }
    );
  }

  function populateShare(game, completed = false, previewMetrics = null) {
    state.shareGame = game;
    const showcase = previewMetrics
      && typeof previewMetrics === "object"
      && !Array.isArray(previewMetrics)
      ? previewMetrics
      : null;
    const isCurrentRun = !showcase && game === state.game;
    const study = Boolean(isCurrentRun && state.scoringDisabled);
    const openRun = Boolean(
      isCurrentRun
      && !study
      && (state.assist !== "none" || state.wished)
    );
    const challengeEligible = !showcase && !study && !openRun;
    const elapsed = showcase
      ? clamp(Math.floor(Number(showcase.seconds) || 0), 0, 86_400)
      : isCurrentRun && state.startedAt
        ? state.finished && state.finishedElapsedSeconds
          ? state.finishedElapsedSeconds
          : Math.max(0, Math.round((Date.now() - state.startedAt) / 1000))
        : 0;
    const todayKey = getTodayKey();
    state.shareCard = buildConstellationCard({
      target: game.target,
      emoji: game.emoji,
      moves: showcase ? showcase.moves : isCurrentRun ? state.moves : 0,
      seconds: elapsed,
      stars: showcase ? showcase.stars : isCurrentRun ? state.history.length : 0,
      discoveries: showcase
        ? showcase.discoveries
        : isCurrentRun
          ? state.newDiscoveries
          : 0,
      history: showcase ? showcase.history : isCurrentRun ? state.history : [],
      universe: game.universe || selectUniverse(game.seed),
      mode: game.mode,
      clue: game.clue,
      category: game.category,
      law: game.law || game.universe?.law,
      dailyKey: game.mode === "daily" ? todayKey : "",
      completed,
      seed: game.seed,
      assist: study || openRun ? state.assist : "none",
      scoringDisabled: isCurrentRun && state.scoringDisabled,
      wished: isCurrentRun && state.wished,
      training: game.mode === "training",
      cardStyle: cosmeticCardStyle(),
      challengeUrl: challengeEligible ? challengeUrl(game) : ""
    });
    const shareCopy = constellationSharePresentation(state.shareCard);
    $("#shareTarget").textContent = game.target;
    $("#shareTitle").textContent = shareCopy.title;
    $("#shareDescription").textContent = shareCopy.description;
    $("#shareStats").textContent = `${state.shareCard.universe.name} · ${state.shareCard.division} · ${completed ? `${state.shareCard.moves} moves · ${state.shareCard.stars} stars` : state.shareCard.mode === "daily" ? "today's shared word" : "shared seed"}`;
    const preview = $("#shareCardPreview");
    preview.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderConstellationCardSvg(state.shareCard))}`;
    preview.alt = `${state.shareCard.division.toLowerCase()} constellation card for ${state.shareCard.target}`;
    $("#copyChallenge").hidden = !challengeEligible || !state.shareCard.challengeUrl;
    $("#copyChallenge span").textContent = shareCopy.actionLabel;
    $("#shareEyebrow").textContent = shareCopy.eyebrow;
  }

  function openShare() {
    if (!state.game) return;
    if (state.startingRun) {
      return showToast("The next orbit is still being mapped.");
    }
    if (state.reveal.active || state.reveal.pending) {
      return showToast("Finish tracing the path before making its card.");
    }
    stopTimer();
    populateShare(state.game, state.finished);
    $("#nativeShare").hidden = !navigator.share;
    $("#shareDialog").showModal();
    track("share_created", {
      target: state.game.target,
      completed: state.finished
    });
  }

  async function createChallengeFromHome() {
    try {
      const seed = Math.floor(Math.random() * 1_000_000);
      const game = await fetchJson(`/api/game?mode=challenge&seed=${seed}`);
      populateShare(game, false);
      $("#nativeShare").hidden = !navigator.share;
      $("#shareDialog").showModal();
      track("share_created", { target: game.target, completed: false });
    } catch (error) {
      showToast(error.message);
    }
  }

  async function copyChallenge() {
    if (!state.shareGame || !state.shareCard?.challengeUrl) return;
    const url = state.shareCard.challengeUrl;
    const invitation = `${constellationCardShareText(state.shareCard)}\n${url}`;
    const label = constellationSharePresentation(state.shareCard).actionLabel;
    try {
      await navigator.clipboard.writeText(invitation);
      $("#copyChallenge span").textContent = "Challenge copied";
      setTimeout(() => {
        $("#copyChallenge span").textContent = label;
      }, 1600);
      track("card_shared", {
        division: state.shareCard.division,
        image: false,
        source: "clipboard"
      });
    } catch {
      window.prompt("Copy this challenge:", invitation);
    }
  }

  async function nativeShare() {
    if (!navigator.share || !state.shareGame || !state.shareCard) return;
    const svg = renderConstellationCardSvg(state.shareCard);
    const file = typeof File === "function"
      ? new File(
          [svg],
          constellationCardFilename(state.shareCard),
          { type: "image/svg+xml" }
        )
      : null;
    const payload = {
      title: `${state.shareCard.target} · Constellore`,
      text: constellationCardShareText(state.shareCard),
      ...(state.shareCard.challengeUrl
        ? { url: state.shareCard.challengeUrl }
        : {})
    };
    if (file && navigator.canShare?.({ files: [file] })) payload.files = [file];
    try {
      await navigator.share(payload);
      track("card_shared", {
        division: state.shareCard.division,
        image: Boolean(payload.files)
      });
    } catch {
      // Share cancellation is expected.
    }
  }

  async function shareChallenge() {
    if (navigator.share) return nativeShare();
    return copyChallenge();
  }

  function downloadConstellationCard() {
    if (!state.shareCard) return;
    const blob = new Blob(
      [renderConstellationCardSvg(state.shareCard)],
      { type: "image/svg+xml" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = constellationCardFilename(state.shareCard);
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    track("card_downloaded", { division: state.shareCard.division });
  }

  function bind() {
    $("#shareRunButton").addEventListener("click", openShare);
    $("#createChallenge").addEventListener("click", () => {
      closeHubMenu();
      void createChallengeFromHome();
    });
    $("#copyChallenge").addEventListener("click", shareChallenge);
    $("#downloadCard").addEventListener("click", downloadConstellationCard);
    $("#nativeShare").addEventListener("click", copyChallenge);
    $("#resultShare").addEventListener("click", () => {
      if (!state.startingRun) openShare();
    });
  }

  return Object.freeze({ bind, populateShare, openShare });
}
