import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const guidedPlay = await readFile(new URL("../public/guided-play-app.mjs", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const styles = [
  await readFile(new URL("../public/simple-ui.css", import.meta.url), "utf8"),
  await readFile(new URL("../public/mobile-play-shell.css", import.meta.url), "utf8")
].join("\n");
const workspaceStyles = await readFile(new URL("../public/combining-board.css", import.meta.url), "utf8");

test("the idle help nudge is optional, non-modal, and states its next exact cost", () => {
  assert.match(page, /id="helpNudge"[^>]+role="group"[^>]+hidden/);
  assert.match(page, /id="helpNudgeAction"[^>]+aria-describedby="helpNudgeCost"/);
  assert.match(page, /id="helpNudgeCost">Each hint keeps 90% of what remains[.] Next hint leaves 90% max score and Stardust; Star Credits are reduced too/);
  assert.match(page, /id="quickTipCost">Next signal keeps 90% of max score and Stardust; Star Credits are reduced too[.]/);
  assert.match(page, /id="helpNudgeDismiss"[^>]+aria-label="Not now"/);
  assert.match(page, /id="helpNudgesPreference"[^>]+aria-pressed="true"/);
  assert.match(page, /id="boardAnnouncement"[^>]+role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.match(guidedPlay, /mobileAssistToggle[?][.]setAttribute\("aria-label", "Need help[?] Open assistance tools"\)/);
  assert.match(guidedPlay, /mobileAssistToggle[?][.]setAttribute\("aria-label", "Open assistance tools"\)/);

  const cost = guidedPlay.slice(guidedPlay.indexOf("function nextHelpNudgeScoreMultiplier"), guidedPlay.indexOf("function hideHelpNudge"));
  assert.match(cost, /baseMultiplier:\s*state[.]scoreMultiplier/);
  assert.match(cost, /nudgesUsed:\s*1/);
  assert.match(cost, /scoreMultiplierPercent/);
  assert.match(cost, /Each hint keeps 90% of what remains/);
  assert.match(cost, /max score and Stardust; Star Credits are reduced too/);

  const render = guidedPlay.slice(guidedPlay.indexOf("function renderHelpNudge"), guidedPlay.indexOf("function armHelpNudge"));
  assert.match(render, /classList[.]add\("is-positioning"\)/);
  assert.match(render, /requestAnimationFrame[?][.]\([\s\S]*relocateBoardNodesForHelpNudge\(\)/);
  assert.match(render, /announceBoardMessage\(`Need help[?] \$\{cost\}[.]`, "help-nudge"\)/);
  assert.doesNotMatch(render, /[.]focus\(/);
});

test("the client resets idle timing and applies a hint penalty without changing assist", () => {
  const eligibility = guidedPlay.slice(guidedPlay.indexOf("function helpNudgeEligible"), guidedPlay.indexOf("function renderHelpNudge"));
  assert.match(eligibility, /onboardingComplete:\s*homeOnboardingComplete\(\)/);
  assert.match(eligibility, /mode:\s*state[.]mode/);
  assert.match(eligibility, /state[.]assist === "none"/);
  assert.match(eligibility, /state[.]finished \|\| state[.]reveal[.]active \|\| state[.]reveal[.]pending/);
  assert.match(eligibility, /state[.]busyPairs[.]size/);
  assert.match(eligibility, /documentRef[.]hidden/);
  assert.match(eligibility, /documentRef[.]querySelector\("dialog\[open\]"\)/);
  assert.match(guidedPlay, /nextHelpNudgeDelay\(\{ seed: state[.]game[?][.]seed, sequence: nudgeSequence\+\+ \}\)/);
  assert.match(app, /document[.]addEventListener\("pointerdown"[\s\S]*noteHelpNudgeActivity/);
  assert.match(app, /MutationObserver\([\s\S]*dialog\[open\][\s\S]*armHelpNudge/);
  assert.match(app.slice(app.indexOf("function openPauseMenu"), app.indexOf("function finishPauseClose")), /state[.]pause[.]active = true;\s*cancelHelpNudge\(\)/);
  assert.match(app.slice(app.indexOf("function finishPauseClose"), app.indexOf("async function closePauseMenu")), /armHelpNudge\(\)/);

  const quickTip = app.slice(app.indexOf("async function useQuickTip"), app.indexOf("async function useWordGift"));
  assert.match(quickTip, /newlyAccepted[\s\S]*scoreMultiplierAfterNudges/);
  assert.match(quickTip, /division:\s*confirmedTipsUsed > 0 \? "open" : state[.]run[?][.]division/);
  assert.match(quickTip, /scoreMultiplier:\s*state[.]scoreMultiplier/);
  assert.doesNotMatch(quickTip, /state[.]assist\s*=/);

  const combine = app.slice(app.indexOf('if (result.division === "open")'), app.indexOf("if (result.scoringDisabled === true"));
  assert.match(combine, /const tipGuided = state[.]assist === "none"/);
  assert.match(combine, /Number\(state[.]powerups[?][.]tipsUsed\) > 0/);
  assert.match(combine, /if \(tipGuided\)[\s\S]*division:\s*"open"/);

  const signature = app.slice(app.indexOf("function buildSignatureResult"), app.indexOf("function renderSignatureResult"));
  assert.match(signature, /assist:\s*publishedGuidanceAssist\(\)/);
  assert.match(app, /const openRun = !assisted && \(partialAssist \|\| state[.]assist !== "none" \|\| state[.]wished\)/);
});

test("the timed nudge never appears over an existing word", () => {
  const relocation = app.slice(app.indexOf("function relocateBoardNodesForHelpNudge"), app.indexOf("function packOrbitAroundOverlays"));
  assert.match(relocation, /for \(const node of state[.]nodes\)/);
  assert.match(relocation, /rectanglesOverlap\(current, nudge, 8\)/);
  assert.match(relocation, /moveBoardNodeOutsideOverlays\(node, element, boardRect, bounds\)/);
  assert.match(relocation, /hideHelpNudge\(\);\s*return false/);
  assert.match(relocation, /scheduleRunSave\(\)/);
  assert.match(styles, /[.]simple-ui [.]help-nudge[.]is-positioning\s*\{[^}]*visibility:\s*hidden/);
});

test("the floating star remains touchable on phones and becomes still for reduced motion", () => {
  const nudgeRule = styles.match(/[.]simple-ui [.]help-nudge\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(nudgeRule, /position:\s*absolute/);
  assert.match(nudgeRule, /width:\s*min\(286px, calc\(100% - 24px\)\)/);
  assert.match(styles, /[.]simple-ui [.]help-nudge-action,[\s\S]*?[.]simple-ui [.]help-nudge-dismiss\s*\{[^}]*min-height:\s*48px/);
  assert.match(styles, /#gameScreen\[data-play-layout="stacked"\] #helpNudge\s*\{[^}]*width:\s*min\(360px/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?[.]simple-ui [.]help-nudge\s*\{[^}]*animation:\s*none/);
});

test("a pending nudge marks the Help disclosure without occupying an extreme-landscape board", () => {
  assert.match(styles, /#gameScreen\[data-play-layout="stacked"\] #helpNudge\s*\{[^}]*inset:[^}]*\+ 56px\)[^}]*transform:\s*none/);
  assert.match(styles, /#gameScreen\[data-play-layout="short-landscape"\] #helpNudge\s*\{[^}]*display:\s*none !important/);
  const marker = workspaceStyles.match(/:has\(#helpNudge:not\(\[hidden\]\)\) #mobileAssistToggle\s*\{([^}]*)\}/)?.[1] || "";
  assert.match(marker, /color:\s*var\(--play-accent\)/);
  assert.match(marker, /background:\s*rgba\(/);
  assert.match(marker, /border-color:\s*var\(--play-accent\)/);
  assert.doesNotMatch(marker, /animation:/);
  const noticeLaneSelector = styles.match(/([^{}]+#helpNudge:not\(\[hidden\]\)[^{}]+[.]board-bottom-hud)\s*\{/)?.[1] || "";
  assert.match(noticeLaneSelector, /data-play-layout="stacked"/);
  assert.doesNotMatch(noticeLaneSelector, /short-landscape/);
});
