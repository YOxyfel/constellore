import {
  chooseMoonHeartSettlement,
  moonHeartProjectContext
} from "./moon-heart-project.mjs?v=5.0.0-beta.4";
import { replaceMoonOutpostState } from "./expedition.mjs?v=5.0.0-beta.4";

export function createMoonHeartActions(host) {
  async function beginMission({ taskId } = {}, trigger) {
    const expedition = host.currentExpedition();
    const project = host.heartProjectState(expedition);
    const context = moonHeartProjectContext(taskId);
    const finding = project.chapters.flatMap((chapter) => chapter.findings).find((candidate) => candidate.id === context?.milestoneId)
      || (project.finale.id === context?.milestoneId ? project.finale : null);
    const accessible = Boolean(context && finding && (
      finding.found || finding.complete || finding.unlocked
      || project.chapters.some((chapter) => chapter.unlocked && chapter.findings.some((candidate) => candidate.id === finding.id))
    ));
    if (!accessible || host.state().startingRun) return { ok: false, message: "That project experiment is not ready yet." };
    host.runtime()?.close({ restoreFocus: false });
    host.track("moon_heart_experiment_started", { kind: context.milestoneId, phase: context.chapterId });
    await host.beginMode("reach", {
      target: context.target,
      fixed: true,
      context,
      trigger: host.primaryTrigger() || trigger
    });
    return { ok: true };
  }

  function chooseSettlement({ choiceId } = {}) {
    const current = host.profile();
    const expedition = host.currentExpedition();
    const outpost = expedition.worlds.moon.outpost;
    const outcome = chooseMoonHeartSettlement(outpost.projects, { choiceId, decidedAt: new Date().toISOString() });
    if (!outcome.chosen) return {
      ok: false,
      message: host.runtime()?.choiceFailureMessage?.(outcome.reason) || "That settlement decision is not available yet."
    };
    const nextOutpost = structuredClone(outpost);
    nextOutpost.projects = outcome.state;
    host.persistExpedition(replaceMoonOutpostState(expedition, nextOutpost, {
      worldweaving: current.worldweaving,
      at: new Date()
    }));
    host.track("moon_heart_settlement_chosen", { kind: outcome.decision.choiceId });
    return { ok: true, message: `${outcome.choice.title} is now Moonhaven's permanent founding character.` };
  }

  return Object.freeze({ beginMission, chooseSettlement });
}
