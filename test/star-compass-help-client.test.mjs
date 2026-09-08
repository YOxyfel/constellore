import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [app, powerupRuntime] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/powerup-view-runtime.mjs", import.meta.url), "utf8")
]);

function sourceBetween(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  const end = app.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `expected ${startMarker} before ${endMarker}`);
  return app.slice(start, end);
}

test("the Help Compass action renders truthful stock, policy, and availability", () => {
  const render = powerupRuntime;

  assert.match(render, /const useSenseButton = [$]\("#useSense"\)/);
  assert.match(render, /const useSenseLabel = useSenseButton[?][.]querySelector\("span"\)/);
  assert.match(render, /[$]\("#useSenseStock"\) \|\| [$]\("#senseDialogCount"\)/);
  assert.match(render, /const compassRunEligible = activeRun && !learningOrbitActive\(\) && state[.]mode !== "explore" && !state[.]scoringDisabled/);
  assert.match(render, /useSenseButton[.]disabled = !compassRunEligible \|\| state[.]powerups[.]busy \|\| !senseCount/);
  assert.match(render, /Confirm use \\u00b7 keep 75%/);
  assert.match(render, /Use Compass \\u00b7 keep 75%/);
  assert.match(render, /[$]\{senseChargesLabel\} ready \\u00b7 tap again within 4 seconds/);
  assert.match(render, /0 charges ready \\u00b7 earn or buy one/);
  assert.match(render, /[$]\{senseChargesLabel\} ready \\u00b7 use in a scored orbit/);
  assert.match(render, /this orbit enters the Open division at 75% score/);
});

test("both Compass controls require the same four-second two-click confirmation", () => {
  const shortcut = sourceBetween("function useSenseShortcut()", "function useRouteSignalShortcut");
  const rail = sourceBetween("function useSenseRailShortcut()", "function useRevealRailShortcut");
  const arm = sourceBetween("function activateOpenPowerupShortcut", "function resetPowerupControlLabels");

  assert.match(shortcut, /activateOpenPowerupShortcut\("sense", useConstellationSense\)/);
  assert.match(rail, /sanitizeSenseWallet\(profile[.]senseWallet\)[.]charges/);
  assert.match(rail, /!charges[\s\S]+openPowerupShop\(\{\s*focusItem:\s*"star-compass",\s*trigger:\s*assistanceReturnTrigger\(els[.]senseShortcut\)\s*\}\)/);
  assert.match(rail, /return "shop"/);
  assert.match(rail, /const outcome = useSenseShortcut\(\)/);
  assert.match(rail, /outcome === "committed"[\s\S]*closeSurface\(\{ restoreFocus: false \}\)/);
  assert.match(rail, /return outcome/);
  assert.match(arm, /if \(activeArmedPowerup\(\) === kind\)[\s\S]*void action\(\)[\s\S]*return "committed"/);
  assert.match(arm, /expiresAt: Date[.]now\(\) \+ 4_000/);
  assert.match(arm, /timer: setTimeout\(\(\) => clearArmedPowerup\(\), 4_000\)/);
  assert.match(arm, /renderPowerups\(\)[\s\S]*TAP AGAIN/);
  assert.match(arm, /return "armed"/);
  assert.match(app, /senseShortcut[.]addEventListener\("click", useSenseRailShortcut\)/);
  assert.match(app, /[$]\("#useSense"\)[.]addEventListener\("click", useSenseShortcut\)/);
  assert.doesNotMatch(app, /[$]\("#useSense"\)[.]addEventListener\("click", useConstellationSense\)/);
});

test("a Compass charge commits only after confirmation and rolls back on a rejected request", () => {
  const use = sourceBetween("async function useConstellationSense()", "function buyStardustSupply");
  const localSpend = use.indexOf("profile.senseWallet = preview.wallet");
  const request = use.indexOf('fetchJson("/api/run/sense"');

  assert.ok(localSpend >= 0 && request > localSpend, "the confirmed action commits before sending its request");
  assert.match(use, /const priorWallet = sanitizeSenseWallet\(profile[.]senseWallet\)/);
  assert.match(use, /learningOrbitActive\(\) \|\| state[.]mode === "explore" \|\| state[.]scoringDisabled/);
  assert.ok(use.indexOf("learningOrbitActive()") < use.indexOf("spendSenseCharge(profile.senseWallet)"), "non-scored runs are rejected before a charge can be spent");
  assert.match(use, /const confirmedBeforeForfeit = Number\(error[.]status\) >= 400 && Number\(error[.]status\) < 500/);
  assert.match(use, /profile[.]senseWallet = priorWallet/);
  assert.match(use, /state[.]assist = priorAssist/);
  assert.match(use, /state[.]scoreMultiplier = priorScoreMultiplier/);
  assert.match(use, /button[.]dataset[.]loading = "true"/);
  assert.match(use, /delete button[.]dataset[.]loading/);
  assert.match(use, /clearArmedPowerup\(\{ render: false \}\)[\s\S]*renderProfile\(\)/);
  assert.match(use, /visible Open penalty remains and the Compass charge stays spent/);
});
