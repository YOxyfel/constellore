import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildMissionBriefing } from "../public/mission-briefing.mjs";

const [appCore, inventoryRuntime, styles] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/inventory-view-runtime.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/styles.css", import.meta.url), "utf8")
]);
const app = `${appCore}\n${inventoryRuntime}`;

test("temporary Shuffled starters are visible but never saved as collection discoveries", () => {
  assert.match(app, /item[.]source !== "loaned-start"/);
  assert.match(app, /item[.]source === "loaned-start" \? "START"/);
  assert.match(app, /This starting word is only for this game/);
  assert.match(styles, /[.]inventory-word[.]loaned/);
});

test("the mission brief plainly distinguishes a temporary new mix", () => {
  const mission = buildMissionBriefing({
    mode: "reach",
    target: "Bird",
    starters: ["Cloud", "Species", "Wind", "Feather", "Sky"],
    startStyle: "shuffled"
  }, { localOnly: true });
  assert.equal(mission.startValue, "You start with 5 words");
  assert.equal(mission.startDetail, "Cloud, Species, Wind, Feather, and Sky");
  assert.match(mission.fairnessNote, /only for this game/i);
  assert.match(mission.fairnessNote, /not added to your collection/i);
});
