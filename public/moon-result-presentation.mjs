import {
  moonWorldweavingContext,
  moonWorldweavingView,
  worldwordInventoryItem
} from "./worldweaving.mjs?v=5.0.0-beta.4";

export function createMoonWorldweavingActions(host) {
  async function beginMission(slotId, choiceId, { trigger } = {}) {
    const state = host.state();
    if (state.startingRun) return false;
    const context = moonWorldweavingContext(slotId, choiceId);
    const moon = host.view();
    if (!context || moon.completed || moon.currentSlotId !== context.slotId) {
      host.showToast("That lunar question is not ready yet.", { scope: "global" });
      host.worldweavingRuntime()?.render();
      return false;
    }
    host.worldweavingRuntime()?.close({ restoreFocus: false });
    host.track("worldweaving_mission_started", { kind: context.slotId, phase: context.choiceId });
    await host.beginMode("reach", {
      target: context.target,
      fixed: true,
      context,
      worldweaving: { worldId: context.worldId, slotId: context.slotId, choiceId: context.choiceId },
      trigger: host.primaryTrigger() || trigger
    });
    return true;
  }

  async function beginWorldwordExplore({ trigger } = {}) {
    const current = host.profile();
    const item = worldwordInventoryItem(current.worldweaving);
    if (!item) {
      host.showToast("Finish all three Moon questions to awaken its Worldword.", { scope: "global" });
      return false;
    }
    host.addWorldword(item);
    host.saveProfile({ fields: ["journeys", "mastery"] });
    host.worldweavingRuntime()?.close({ restoreFocus: false });
    host.outpostRuntime()?.close({ restoreFocus: false });
    host.track("worldword_entered_explore", { kind: item.word });
    await host.startExplore({ enterThroughGate: true, trigger });
    return true;
  }

  return Object.freeze({ beginMission, beginWorldwordExplore });
}

export function createMoonResultPresentation(outcome, game = {}) {
  if (outcome?.kind === "moon-project") {
    const recipe = game.history?.at?.(-1) || {};
    const progress = outcome.project?.findingProgress || { current: 0, total: 16 };
    const title = outcome.projectCompleted
      ? "First Dawn has made Moonhaven real."
      : outcome.chapterCompleted
        ? "A chapter of Moonhaven is complete."
        : outcome.corroborated
          ? "A second truth strengthens the finding."
          : outcome.perspective
            ? "The same truth arrived by a new path."
            : outcome.recorded
              ? `${recipe.word || outcome.context?.target || "A finding"} joined The Heart.`
              : "The Heart already remembers this exact route.";
    return {
      visible: true,
      heart: true,
      context: outcome.context,
      kicker: outcome.projectCompleted ? "GREAT PROJECT · FIRST DAWN" : outcome.chapterCompleted ? "CHAPTER REMEMBERED" : outcome.corroborated ? "CORROBORATION" : outcome.perspective ? "ROUTE PERSPECTIVE" : "PROJECT FINDING",
      title,
      recipe: recipe.a && recipe.b ? `${recipe.a} + ${recipe.b} → ${recipe.word}` : outcome.context?.target || "Project evidence",
      consequence: outcome.rewardStardust ? `Moonhaven Stewardship awakened · +${outcome.rewardStardust} Stardust` : `${progress.current} of ${progress.total} experiments now live in the settlement.`,
      resultKicker: outcome.projectCompleted ? "MOONHAVEN · FIRST DAWN" : "THE HEART REMEMBERS",
      resultTitle: title,
      resultStats: outcome.connections?.length ? `${outcome.connections.length} deeper connection${outcome.connections.length === 1 ? "" : "s"} became visible in this route.` : `${progress.current} of ${progress.total} project findings complete.`,
      primaryLabel: outcome.projectCompleted ? "See Moonhaven" : "Return to The Heart"
    };
  }
  if (!outcome?.advanced) return { visible: false };
  const recipe = outcome.anchor?.memory || game.history?.at?.(-1) || {};
  const moon = moonWorldweavingView(outcome.state);
  const slot = moon.slots.find((candidate) => candidate.id === game.journeyContext?.slotId);
  const choice = slot?.choices.find((candidate) => candidate.id === outcome.anchor?.choiceId);
  return {
    visible: true,
    awakening: Boolean(outcome.worldwordUnlocked),
    kicker: outcome.worldwordUnlocked ? "WORLDWORD AWAKENING" : `${slot?.title || "MOON"} MEMORY INSTALLED`,
    title: outcome.worldwordUnlocked ? "Your three answers have made something the Moon can send onward." : `${choice?.title || recipe.word || "This answer"} now exists on your Moon.`,
    recipe: `${recipe.a} + ${recipe.b} → ${recipe.word}`,
    consequence: outcome.worldwordUnlocked ? "Rocket + Moon has awakened Lander — a permanent Worldword you can use in Explore." : "The settlement has changed permanently around this exact recipe.",
    resultKicker: outcome.worldwordUnlocked ? "THE MOON REMEMBERS" : "SEMANTIC MEMORY CAPTURED",
    resultTitle: outcome.worldwordUnlocked ? "A Lander is ready to leave your world." : `${slot?.title || "Moon"}: ${choice?.title || recipe.word}`,
    resultStats: `${recipe.a} + ${recipe.b} became ${recipe.word}. This exact meaning—not only the output—shaped the settlement.`,
    primaryLabel: outcome.worldwordUnlocked ? "Enter your Moon Outpost" : "See it awaken"
  };
}
