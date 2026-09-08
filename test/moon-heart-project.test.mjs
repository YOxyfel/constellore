import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createMoonHeartDossierEntries,
  MOON_HEART_PROJECT_LIMITS,
  createMoonHeartProjectModel
} from "../public/moon-heart-project-presentation.mjs";
import { moonHeartNavigation } from "../public/moon-heart-project-runtime.mjs";
import { SECONDARY_SURFACE_FILES } from "../public/secondary-surface-loader.mjs";

function projectFixture() {
  return {
    id: "heart",
    title: "The Heart",
    subtitle: "A Home Beneath No Sky",
    state: "choice",
    variant: "garden",
    progress: { completed: 2, total: 5, label: "2 of 5 chapters", unit: "experiments" },
    activeChapterId: "growth",
    tasks: [
      { id: "find-air", chapterId: "needs", title: "Find Air", status: "complete", kind: "mission" },
      { id: "endure-dust", chapterId: "endure", title: "Dust at the seals", status: "locked", kind: "crisis" }
    ],
    chapters: [
      {
        id: "needs",
        number: 1,
        title: "What does life need?",
        status: "complete",
        evidence: [{ id: "air", label: "Breath", word: "Air", status: "found" }]
      },
      {
        id: "growth",
        number: 3,
        title: "What should grow here?",
        status: "current",
        evidence: [{ id: "commons", label: "A place together", status: "missing" }]
      },
      { id: "endure", number: 4, title: "Can it endure?", status: "locked" }
    ],
    settlementChoice: {
      title: "What should grow here?",
      options: [
        { id: "garden", title: "Garden", description: "Grow living color.", enabled: true },
        { id: "factory", title: "Factory", description: "Build useful tools.", enabled: true },
        { id: "community", title: "Community", description: "Make a shared home.", enabled: true }
      ]
    },
    reward: {
      title: "Moonhaven remembers",
      items: [{ id: "haven", icon: "\u2726", label: "Living Citadel", value: "Installed" }]
    }
  };
}

test("Heart navigation names the actual origin and bounds host-provided copy", () => {
  assert.deepEqual(moonHeartNavigation(), {
    origin: "outpost",
    backLabel: "Moon Outpost",
    backAriaLabel: "Back to Moon Outpost"
  });
  assert.deepEqual(moonHeartNavigation({ origin: "home" }), {
    origin: "home",
    backLabel: "Home",
    backAriaLabel: "Back to Home"
  });
  const custom = moonHeartNavigation({
    origin: "worldweaving",
    backLabel: ` ${"L".repeat(90)} `,
    backAriaLabel: "Return to the lunar map"
  });
  assert.equal(custom.origin, "worldweaving");
  assert.equal(custom.backLabel.length, 48);
  assert.equal(custom.backAriaLabel, "Return to the lunar map");
  assert.equal(Object.isFrozen(custom), true);
});

test("Heart presentation preserves authored chapters, tasks, evidence, and the permanent settlement choice", () => {
  const model = createMoonHeartProjectModel(projectFixture());
  assert.equal(model.id, "heart");
  assert.equal(model.state, "choice");
  assert.equal(model.activeChapterId, "growth");
  assert.deepEqual(model.progress, { completed: 2, total: 5, percent: 40, label: "2 of 5 chapters", unit: "experiments" });
  assert.equal(model.chapters[0].tasks[0].id, "find-air");
  assert.equal(model.chapters[0].evidence[0].word, "Air");
  assert.equal(model.chapters[2].tasks[0].kind, "crisis");
  assert.deepEqual(model.settlementChoice.options.map(({ id }) => id), ["garden", "factory", "community"]);
  assert.equal(model.reward.items[0].label, "Living Citadel");
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.chapters), true);
  assert.equal(Object.isFrozen(model.settlementChoice.options), true);
});

test("Heart presentation retains every eligible experiment even when the recommended chapter action is only the first", () => {
  const model = createMoonHeartProjectModel({
    activeChapterId: "needs",
    chapters: [{
      id: "needs",
      status: "current",
      evidence: [
        { id: "life", label: "Life", word: "Life", status: "found" },
        { id: "air", label: "Atmosphere", word: "Atmosphere", status: "found" },
        { id: "food", label: "Food", word: "", status: "missing" }
      ],
      tasks: [
        { id: "life", status: "complete", enabled: true, actionLabel: "Deepen: Life" },
        { id: "air", status: "complete", enabled: true, actionLabel: "Deepen: Atmosphere" },
        { id: "food", status: "available", enabled: true, actionLabel: "Research: Food" }
      ]
    }]
  });

  assert.deepEqual(model.chapters[0].tasks.map(({ id }) => id), ["life", "air", "food"]);
  assert.deepEqual(model.chapters[0].tasks.map(({ enabled }) => enabled), [true, true, true]);
  assert.equal(model.chapters[0].action.id, "food");

  const dossier = createMoonHeartDossierEntries(model.chapters[0]);
  assert.deepEqual(dossier.map(({ entry }) => entry.id), ["life", "air", "food"]);
  assert.deepEqual(dossier.map(({ task }) => task?.enabled), [true, true, true]);
  assert.equal(Object.isFrozen(dossier), true);
});

test("Heart dossier keeps eligible task-only findings directly addressable", () => {
  const model = createMoonHeartProjectModel({
    activeChapterId: "needs",
    chapters: [{
      id: "needs",
      status: "current",
      evidence: [{ id: "air", label: "Breath", word: "Air", status: "found" }],
      tasks: [
        { id: "air", title: "Find Air", target: "Air", status: "complete", enabled: true },
        { id: "food", title: "Find Food", target: "Food", status: "available", enabled: true }
      ]
    }]
  });

  const dossier = createMoonHeartDossierEntries(model.chapters[0]);
  assert.deepEqual(dossier.map(({ entry }) => entry.id), ["air", "food"]);
  assert.equal(dossier[0].task.id, "air");
  assert.equal(dossier[1].task.id, "food");
  assert.equal(dossier[1].entry.state, "missing");
});

test("Heart domain-view decision phase keeps the settlement chapter selected", () => {
  const model = createMoonHeartProjectModel({
    projectId: "heart",
    phase: "decision",
    currentChapterId: "settlement-character",
    findingProgress: { current: 12, total: 16 },
    chapters: [
      { id: "vital-systems", status: "complete", findings: [{ id: "life", target: "Life", found: true }] },
      { id: "settlement-character", status: "complete", findings: [{ id: "garden", target: "Garden", found: true }] }
    ],
    decision: {
      available: true,
      choiceId: "",
      choices: [{ id: "garden", title: "Garden", description: "Grow living color." }]
    }
  });

  assert.equal(model.state, "choice");
  assert.equal(model.activeChapterId, "settlement-character");
  assert.equal(model.settlementChoice.options[0].enabled, true);
});

test("Heart presentation bounds save-derived text, arrays, identifiers, and numeric progress", () => {
  const noisy = {
    id: "../HEART<script>",
    title: `\u0000${"T".repeat(300)}`,
    subtitle: "S".repeat(400),
    state: "invented",
    progress: { completed: 99_999, total: 999_999 },
    activeChapterId: "missing",
    chapters: Array.from({ length: 30 }, (_, index) => ({
      id: `Chapter ${index}`,
      title: "C".repeat(200),
      status: index === 0 ? "current" : "locked",
      evidence: Array.from({ length: 30 }, (__, evidenceIndex) => ({ id: `E ${evidenceIndex}`, label: "E".repeat(200) })),
      tasks: Array.from({ length: 30 }, (__, taskIndex) => ({ id: `T ${taskIndex}`, status: "current" }))
    })),
    settlementChoice: { options: Array.from({ length: 20 }, (_, index) => ({ id: `Choice ${index}` })) },
    reward: { items: Array.from({ length: 20 }, (_, index) => ({ id: `Reward ${index}` })) }
  };
  const model = createMoonHeartProjectModel(noisy);
  assert.equal(model.id, "heart-script");
  assert.equal(model.title.length, 80);
  assert.equal(model.subtitle.length, 140);
  assert.equal(model.state, "complete");
  assert.deepEqual(model.progress, { completed: 999, total: 999, percent: 100, label: "999 of 999", unit: "chapters" });
  assert.equal(model.chapters.length, MOON_HEART_PROJECT_LIMITS.chapters);
  assert.equal(model.chapters[0].evidence.length, MOON_HEART_PROJECT_LIMITS.evidencePerChapter);
  assert.equal(model.chapters[0].tasks.length, MOON_HEART_PROJECT_LIMITS.tasksPerChapter);
  assert.equal(model.settlementChoice.options.length, MOON_HEART_PROJECT_LIMITS.choices);
  assert.equal(model.reward.items.length, MOON_HEART_PROJECT_LIMITS.rewardItems);
  assert.equal(model.activeChapterId, "chapter-0");
});

test("Heart presentation treats malformed nested collections as empty instead of crashing the lazy surface", () => {
  const model = createMoonHeartProjectModel({
    chapters: [{
      id: "safe",
      status: "current",
      findings: { injected: true },
      evidence: "not-an-array",
      tasks: { also: "not-an-array" }
    }],
    settlementChoice: {
      options: { injected: true },
      choices: "not-an-array"
    },
    reward: { items: { injected: true } }
  });

  assert.equal(model.chapters.length, 1);
  assert.deepEqual(model.chapters[0].evidence, []);
  assert.deepEqual(model.chapters[0].tasks, []);
  assert.deepEqual(model.settlementChoice.options, []);
  assert.deepEqual(model.reward.items, []);
});

test("Heart project is an isolated lazy full-page surface with bounded host callbacks", async () => {
  const [runtime, css, loader] = await Promise.all([
    readFile(new URL("../public/moon-heart-project-runtime.mjs", import.meta.url), "utf8"),
    readFile(new URL("../public/moon-heart-project.css", import.meta.url), "utf8"),
    readFile(new URL("../public/secondary-surface-loader.mjs", import.meta.url), "utf8")
  ]);

  for (const callback of ["getProjectState", "onBeginMission", "onChooseSettlement", "onBack", "onReturnToOutpost", "onMainMenu", "onClose"]) {
    assert.match(runtime, new RegExp(`\\b${callback}\\b`));
  }
  assert.match(runtime, /const DIALOG_ID = "moonHeartProjectDialog"/);
  assert.match(runtime, /dialog[.]id = DIALOG_ID/);
  assert.match(runtime, /aria-current/);
  assert.match(runtime, /aria-live="polite"/);
  assert.equal([...runtime.matchAll(/aria-live="polite"/g)].length, 1);
  assert.match(runtime, /onBeginMission\(\{ taskId: id \}, trigger\)/);
  assert.match(runtime, /onChooseSettlement\(\{ choiceId: id \}, trigger\)/);
  assert.match(runtime, /visualViewport/);
  assert.match(runtime, /showChapter/);
  assert.match(runtime, /dialog:not\(\[open\]\)/);
  assert.match(runtime, /nodes[.]actionDock[.]hidden = Boolean\(nodes[.]primaryAction[.]hidden && !copy\)/);
  assert.match(runtime, /dialog[.]setAttribute\("aria-busy", "true"\)/);
  assert.match(runtime, /choice-card\[data-selected=/);
  assert.match(runtime, /moon-heart-project__evidence-action/);
  assert.match(runtime, /surface[.]dataset[.]taskId = task[.]id/);
  assert.match(runtime, /createMoonHeartDossierEntries\(chapter\)/);
  assert.match(runtime, /task[.]state === "complete" [?] "\\u21bb" : "\\u203a"/);
  assert.match(runtime, /rememberFocus/);
  assert.match(runtime, /nodeForRememberedFocus/);
  assert.match(runtime, /nodes[.]evidenceList[.]dataset[.]count = String\(entries[.]length\)/);
  assert.match(runtime, /aria-controls", "moonHeartProjectDossier"/);
  assert.match(runtime, /role="progressbar"/);
  assert.match(runtime, /aria-valuenow/);
  assert.match(runtime, /data-heart-action="main-menu"/);
  assert.match(runtime, /id="moonHeartBackLabel">Moon Outpost/);
  assert.match(runtime, /dataset[.]navigationOrigin/);
  assert.match(runtime, /if \(!busy\) void returnToOrigin\(nodes[.]back\)/);
  assert.match(runtime, />Main menu<\/span>/);
  assert.match(runtime, /data-heart-action="pane" data-heart-pane="scene">Scene/);
  assert.match(runtime, /data-heart-action="pane" data-heart-pane="detail">Project/);
  assert.match(runtime, /data-heart-pane-content="scene"/);
  assert.match(runtime, /data-heart-pane-content="detail"/);
  assert.match(runtime, /currentNavigation[.]origin === "home"/);
  assert.match(runtime, /nodes[.]overflow[.]hidden = redundantMainMenu/);
  assert.doesNotMatch(runtime, /from "[.]\/app[.]js/);
  assert.doesNotMatch(runtime, /localStorage|sessionStorage|fetch\s*\(/);

  assert.match(css, /width:\s*100vw/);
  assert.match(css, /env\(safe-area-inset-top/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /orientation:\s*landscape/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(css, /scroll-snap-type:\s*x proximity/);
  assert.match(css, /moon-heart-project__action-dock/);
  assert.match(css, /choice-card\[data-selected="true"\]\s*\{\s*border-width:\s*3px/);
  assert.match(css, /moon-heart-project__evidence-action\s*\{[\s\S]*?min-height:\s*62px/);
  assert.match(css, /grid-auto-flow:\s*column/);
  assert.match(css, /grid-template-rows:\s*repeat\(2,\s*minmax\(58px,\s*auto\)\)/);
  assert.match(css, /evidence ol\[data-count="1"\]/);
  assert.match(css, /grid-template-columns:\s*clamp\(230px,\s*19vw,\s*300px\)/);
  assert.match(css, /-webkit-line-clamp:\s*2/);
  assert.match(css, /@media \(max-width:\s*900px\)/);
  assert.match(css, /moon-heart-project__chapter-label strong\s*\{[\s\S]*?font:\s*650 15px/);
  assert.match(css, /moon-heart-project__chapter-copy > p\s*\{[\s\S]*?font-size:\s*15px/);

  assert.match(loader, /createLazyMoonHeartProject/);
  assert.match(loader, /loadOptionalStylesheet\("moon-heart-project[.]css[?]v=/);
  assert.match(loader, /import\("[.]\/moon-heart-project-runtime[.]mjs[?]v=/);
  for (const file of [
    "moon-heart-project.css",
    "moon-heart-project-runtime.mjs",
    "moon-heart-project-presentation.mjs",
    "moon-heart-actions.mjs"
  ]) {
    assert.equal(SECONDARY_SURFACE_FILES.includes(file), true, `${file} is not declared lazy.`);
  }
});
