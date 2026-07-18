import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

test("dragged board words update without a trailing transform transition", () => {
  const draggingRule = styles.match(/[.]board-word[.]dragging\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(draggingRule, /transition:/);
  assert.doesNotMatch(draggingRule.match(/transition:\s*([^;]+)/)?.[1] || "", /transform/);
  assert.match(draggingRule, /will-change:\s*transform/);
  assert.match(app, /element[.]classList[.]remove\("appear"\)/);
  assert.match(app, /updatePosition\(upEvent, false\)/, "pointer-up must flush the final position before collision detection");
});

test("tray drops share an immediate-combine path on mouse and touch", () => {
  assert.match(app, /function boardNodeAtPoint\(clientX, clientY\)/);
  assert.match(app, /function dropTrayItem\(item, point\)/);
  assert.match(app, /void combineNodes\(traySource, target\)/);
  assert.match(app, /function startTrayPointerDrag\(/);
  assert.match(app, /button[.]draggable = false/);
  assert.match(app, /dropTrayItem\(item, lastPoint\)/);
  assert.match(styles, /touch-action:\s*pan-x/);
  assert.match(styles, /[.]tray-drag-ghost\s*\{/);
});

test("Ctrl hover fusion is wired to board words and lifecycle cleanup", () => {
  assert.match(app, /createCtrlHoverController/);
  assert.match(app, /addEventListener\("pointerenter", \(event\) => handleCtrlHoverEnter/);
  assert.match(app, /window[.]addEventListener\("keydown", activateCtrlHover\)/);
  assert.match(app, /window[.]addEventListener\("keyup", releaseCtrlHover\)/);
  assert.match(app, /window[.]addEventListener\("blur", releaseCtrlHover\)/);
  assert.match(app, /return \{ node: resultNode, completed: won \}/);
  assert.match(app, /ctrlHover[.]reset\(\{ abandonPending: true \}\)/);
  assert.match(styles, /[.]board-word[.]ctrl-hover-source\s*\{/);
  assert.match(styles, /[.]board-word[.]ctrl-hover-queued\s*\{/);
  assert.match(styles, /[.]board-word[.]combining\s*\{/);
});
