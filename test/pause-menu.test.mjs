import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

const pauseDialog = page.match(/<dialog\b(?=[^>]*\bid="pauseDialog")[^>]*>[\s\S]*?<\/dialog>/i)?.[0] || "";

function functionSource(name, nextName) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const end = nextName ? app.indexOf(`function ${nextName}(`, start + 1) : -1;
  return app.slice(start, end >= 0 ? end : start + 2400);
}

test("an active orbit exposes one accessible pause menu on keyboard and touch", () => {
  const trigger = page.match(/<button\b(?=[^>]*\bid="pauseRunButton")[^>]*>[\s\S]*?<\/button>/i)?.[0] || "";
  assert.ok(trigger, "the in-orbit pause control must be present");
  assert.match(trigger, /\btype="button"/i);
  assert.match(trigger, /\baria-haspopup="dialog"/i);
  assert.match(trigger, /\baria-controls="pauseDialog"/i);
  assert.match(trigger, /\baria-label="[^"]*(?:pause|orbit menu)[^"]*"/i);

  assert.ok(pauseDialog, "the pause dialog must be present");
  assert.match(pauseDialog.match(/<dialog\b[^>]*>/i)?.[0] || "", /\baria-labelledby="pauseTitle"/i);
  assert.match(pauseDialog, /\bid="pauseTitle"/i);
  assert.match(pauseDialog, /\bid="resumePausedRun"/i);
  assert.match(pauseDialog, /\bid="pauseRestart"/i);
  assert.match(pauseDialog, /\bid="pauseExit"/i);
});

test("the pause trigger remains a readable 44px mobile target", () => {
  const pauseRule = styles.match(/[^{}]*[.]pause-run-button[^{}]*\{[^}]*\}/gi)?.join("\n") || "";
  assert.match(pauseRule, /(?:min-)?width:\s*44px/i);
  assert.match(pauseRule, /(?:min-)?height:\s*44px/i);
  assert.match(pauseRule, /font-size:\s*(?:1[5-9]|[2-9][0-9])px/i);
  assert.doesNotMatch(pauseRule, /display:\s*none/i, "the mobile pause affordance must not disappear");
});

test("Escape opens pause only for an unobstructed active orbit", () => {
  const eligibility = functionSource("pauseMenuAvailable", "openPauseMenu");
  assert.match(eligibility, /state[.]game/);
  assert.match(eligibility, /!els[.]gameScreen[.]hidden/);
  assert.match(eligibility, /!state[.]finished/);
  assert.match(eligibility, /!state[.]startingRun/);
  assert.match(eligibility, /!state[.]reveal[.]active/);
  assert.match(eligibility, /!state[.]reveal[.]pending/);
  assert.match(eligibility, /dialog\[open\]/, "another modal must own Escape while it is open");

  const handler = functionSource("handlePauseShortcut");
  assert.match(handler, /event[.]key !== "Escape"/);
  assert.match(handler, /event[.]defaultPrevented/);
  assert.match(handler, /input, textarea, select|isContentEditable|contenteditable/i, "typing controls must retain Escape");
  assert.match(handler, /pauseDialog[.]open[\s\S]*close\(\)/, "a second Escape must resume the orbit");
  assert.match(handler, /openPauseMenu\(\)/);
  assert.match(app, /window[.]addEventListener\("keydown", handlePauseShortcut\)/);
});

test("opening and closing the menu suspends updates without extending a ranked deadline", () => {
  const open = functionSource("openPauseMenu", "closePauseMenu");
  for (const cleanup of ["cancelActiveTrayDrag", "cancelActiveBoardDrag", "cancelActivePointerGestures", "cancelTapChain", "ctrlHover.reset", "shiftBoard.reset"]) {
    assert.match(open, new RegExp(cleanup.replace(".", "[.]")), `${cleanup} must release in-progress board input`);
  }
  const stopAt = open.indexOf("stopTimer()");
  const showAt = open.indexOf("showModal()");
  assert.ok(stopAt >= 0 && showAt > stopAt, "the visible clock interval must stop before the menu opens");
  assert.match(open, /stopTimer\(\)/);
  assert.match(open, /showModal\(\)/);
  assert.match(open, /resumePausedRun[^\n]*focus|querySelector\([^\n]*resumePausedRun[^\n]*focus/s, "focus must enter the modal");

  const close = functionSource("closePauseMenu");
  assert.match(close, /pauseDialog[.]close\(\)/);
  assert.match(app, /pauseDialog[^\n]*addEventListener\("close"[\s\S]{0,220}resumeTimerIfNeeded\(\)/);
  assert.match(app, /function resumeTimerIfNeeded\(\)[\s\S]{0,900}!els[.]pauseDialog[.]open/);

  const timer = functionSource("startTimer", "stopTimer");
  assert.match(timer, /run[?][.]deadlineAt[\s\S]*Date[.]parse\(state[.]run[.]deadlineAt\)/, "hosted Quick time must stay anchored to its authoritative deadline");
  assert.doesNotMatch(app, /deadlineAt\s*=|run[.]deadlineAt\s*=|startedAt\s*\+=\s*[^;]*pause/i, "opening a client menu must not manufacture extra ranked time");
  assert.match(pauseDialog, /timed[^<]*(?:continues|keeps running)|(?:continues|keeps running)[^<]*timed/i, "the menu must disclose competitive timer behavior");
});

test("pause actions resume, restart the exact orbit, or exit to modes", () => {
  assert.match(app, /resumePausedRun"\)[.]addEventListener\("click", closePauseMenu\)/);
  assert.match(app, /pauseRestart"\)[.]addEventListener\("click",[\s\S]{0,260}retryGame\(\)/);
  assert.match(app, /pauseExit"\)[.]addEventListener\("click",[\s\S]{0,260}returnHome\(\)/);

  const retry = functionSource("retryGame", "startTimer");
  assert.match(retry, /const mode = state[.]game[.]mode/);
  assert.match(retry, /seed: state[.]game[.]seed/);
  assert.match(retry, /target: \["reach", "challenge"\][.]includes\(mode\) \? state[.]game[.]target/);
  assert.match(retry, /context: state[.]journeyContext/);
  assert.match(retry, /beginMode\(mode, options\)/);
});

test("all destructive pause paths close cleanly and preserve existing modal ownership", () => {
  assert.match(app, /pauseRunButton"\)[.]addEventListener\("click", openPauseMenu\)/);
  assert.match(app, /pauseDialog[^\n]*addEventListener\("cancel"[\s\S]{0,220}(?:closePauseMenu|pauseDialog[.]close)/, "native dialog Escape must mean Resume");

  const start = functionSource("startWithGame", "returnHome");
  const home = functionSource("returnHome", "beginPrimaryOrbit");
  assert.match(start, /pauseDialog/, "starting another run must retire a stale pause menu");
  assert.match(start, /dialog[?]?[.]open[\s\S]*dialog[.]close\(\)/);
  assert.match(home, /pauseDialog/, "exiting to modes must retire the pause menu");
  assert.match(home, /dialog[?]?[.]open[\s\S]*dialog[.]close\(\)/);
});
