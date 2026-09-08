import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [boardCss, orbitCss, shellCss, voyageCss, app, page] = await Promise.all([
  readFile(new URL("../public/combining-board.css", import.meta.url), "utf8"),
  readFile(new URL("../public/word-orbit.css", import.meta.url), "utf8"),
  Promise.all([
    readFile(new URL("../public/simple-ui.css", import.meta.url), "utf8"),
    readFile(new URL("../public/mobile-play-shell.css", import.meta.url), "utf8")
  ]).then((parts) => parts.join("\n")),
  readFile(new URL("../public/cinematic/voyage-projection-experience.css", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/index.html", import.meta.url), "utf8")
]);

function block(source, selector) {
  const escaped = selector.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s"))?.[1] || "";
}

test("the observatory keeps utility controls outside its canvas and secondary commands in disclosures", () => {
  assert.doesNotMatch(boardCss, /(?:^|\n)\s*\.game-layout\s*\{/);
  assert.doesNotMatch(boardCss, /(?:^|\n)\s*\.inventory\s*\{/);

  const workspaceStart = page.indexOf('<div class="board-workspace-bar"');
  const canvasStart = page.indexOf('<section class="cosmos-board" id="board"');
  assert.ok(workspaceStart >= 0 && canvasStart > workspaceStart, "the utility bar precedes the canvas");
  const workspace = page.slice(workspaceStart, canvasStart);
  for (const [toggle, panel] of [["mobileToolsToggle", "mobileToolsPanel"], ["mobileAssistToggle", "boardAssistanceRail"]]) {
    assert.match(workspace, new RegExp(`id="${toggle}"[^>]*aria-expanded="false"[^>]*aria-controls="${panel}"`));
    assert.match(workspace, new RegExp(`id="${panel}"[^>]* hidden`), "secondary commands start collapsed");
  }
  assert.match(block(boardCss, "& .board-workspace-bar"), /grid-row:\s*1/);
  assert.match(block(boardCss, "& #board"), /grid-row:\s*2/);
  assert.match(block(boardCss, "& #boardQuickTools"), /display:\s*flex/);
  const panel = block(boardCss, "& #mobileToolsPanel");
  assert.match(panel, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(panel, /max-width:\s*calc\(100vw - 24px\)/);
});

test("wide Observatory defaults to inventory and offers an explicit local Bloom preference", () => {
  assert.match(
    boardCss,
    /\[data-play-layout="wide"\]\[data-word-selector="bloom"\]:not\(\.scramble-orbit\) \.game-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) !important/s
  );
  assert.match(
    boardCss,
    /\[data-play-layout="wide"\]\[data-word-selector="bloom"\]:not\(\.scramble-orbit\) \.inventory\s*\{[^}]*display:\s*none !important/s
  );
  assert.match(app, /defaultProfile[.]desktopWordSelector = "inventory"/);
  assert.match(app, /if \(mobilePlayShellActive\(\)\) return true/);
  assert.match(app, /profile[.]desktopWordSelector = desktopWordSelectorPreference\(\) === "bloom" \? "inventory" : "bloom"/);
  assert.match(page, /data-spatial-bloom-preference[^>]+aria-pressed="false"/);
  assert.match(page, /Spatial Bloom selector/);
  assert.match(page, /Choose words in a focused palette on desktop/);
  assert.match(
    boardCss,
    /#gameScreen:not\(\[data-board-presentation="observatory"\]\) #alignConstellation\s*\{[^}]*display:\s*none !important/s
  );
});

test("Bloom uses a bounded contextual panel while workspace actions stay available", () => {
  const panel = block(orbitCss, ".constellation-bloom__panel");
  assert.match(panel, /width:\s*var\(--bloom-panel-width\)/);
  assert.match(panel, /height:\s*var\(--bloom-panel-height\)/);
  assert.match(panel, /max-height:\s*calc\(100% - 24px\)/);
  assert.doesNotMatch(orbitCss, /data-bloom-stage[^}]*board-top-hud[^}]*visibility:\s*hidden/s);
  assert.match(orbitCss, /grid-auto-rows:\s*var\(--bloom-row-height,64px\)/);
  assert.match(orbitCss, /overflow:\s*auto; overscroll-behavior:\s*contain/);
});

test("wide board placement avoids persistent HUD blockers and short desktops use one contained HUD row", () => {
  assert.match(app, /if \(!allowOutOfBounds && !node[.]revealRole\)\s*\{\s*moveBoardNodeOutsideOverlays/s);
  assert.doesNotMatch(app, /if \(mobilePlayShellActive\(\) && !allowOutOfBounds && !node[.]revealRole\)/);
  const restore = app.slice(app.indexOf("function hydrateRestoredRun("), app.indexOf("async function restoreInterruptedRun("));
  assert.match(restore, /if \(restoreWorldCoordinates\) boardCameraRuntime[?][.]setCamera\(snapshot[.]visuals[.]boardCamera, \{ reason: "restore" \}\)/);
  assert.match(restore, /renderBoard\(\);\s*if \(!restoreWorldCoordinates\) requestAnimationFrame\(\(\) => constrainBoardNodes\(\)\)/s,
    "legacy screen coordinates are constrained after layout while restored world coordinates retain their saved camera and positions");
  assert.match(shellCss, /@media \(min-width:\s*901px\) and \(max-height:\s*440px\)/);
  assert.match(shellCss, /data-play-layout="wide"\] \.board-top-hud\s*\{[^}]*grid-template-columns:[^}]*grid-template-rows:\s*44px/s);
  assert.match(shellCss, /data-play-layout="wide"\] \.run-milestone\s*\{[^}]*max-height:\s*44px[^}]*overflow:\s*hidden/s);
});

test("Bloom keeps 44px actions, readable words and native search clearance", () => {
  assert.match(shellCss, /--play-shell-hit:\s*44px/);
  for (const selector of [".constellation-bloom__cancel", ".constellation-bloom__pager button"]) {
    assert.match(block(orbitCss, selector), /min-width:\s*44px/);
    assert.match(block(orbitCss, selector), /height:\s*44px/);
  }
  assert.match(block(orbitCss, ".constellation-bloom__head button"), /min-width:\s*58px/);
  assert.match(block(orbitCss, ".constellation-bloom__search button"), /min-width:\s*44px/);
  assert.match(block(orbitCss, ".constellation-bloom__search input"), /height:\s*44px/);
  assert.match(orbitCss, /input::-webkit-search-cancel-button[^}]*display:\s*none/s);
  assert.match(orbitCss, /data-palette-layout="horizontal"[\s\S]*min-height:\s*44px/);
});

test("the cinematic locks page overflow with a non-has fallback and stays within the dynamic viewport", () => {
  const bodyLock = block(voyageCss, "body.voyage-projection-active");
  assert.match(bodyLock, /overflow:\s*hidden !important/);
  assert.match(bodyLock, /overscroll-behavior:\s*none/);

  const root = block(voyageCss, ".voyage-projection");
  assert.match(root, /position:\s*fixed/);
  assert.match(root, /inset:\s*0/);
  assert.match(root, /max-width:\s*100dvw/);
  assert.match(root, /max-height:\s*100dvh/);
  assert.match(root, /overflow:\s*hidden/);
});

test("cinematic HUD, captions, progress, and controls account for all safe-area edges", () => {
  assert.match(voyageCss, /env\(safe-area-inset-top\)/);
  assert.match(voyageCss, /env\(safe-area-inset-right\)/);
  assert.match(voyageCss, /env\(safe-area-inset-bottom\)/);
  assert.match(voyageCss, /env\(safe-area-inset-left\)/);
  assert.match(voyageCss, /\.voyage-projection__narrative\s*\{[^}]*safe-area-inset-left[^}]*safe-area-inset-right/s);
  assert.match(voyageCss, /\.voyage-projection__controls\s*\{[^}]*safe-area-inset-right[^}]*safe-area-inset-bottom/s);
  assert.match(voyageCss, /\.voyage-projection__progress\s*\{[^}]*safe-area-inset-left[^}]*safe-area-inset-right[^}]*safe-area-inset-bottom/s);

  const control = block(voyageCss, ".voyage-projection__controls button");
  assert.match(control, /min-width:\s*48px/);
  assert.match(control, /min-height:\s*48px/);
});

test("568x320-class cinematic layout has a dedicated collision-free caption band", () => {
  assert.match(voyageCss, /@media \(max-height:\s*420px\) and \(orientation:\s*landscape\)/);
  assert.match(
    voyageCss,
    /@media \(max-height:\s*420px\)[\s\S]*?\.voyage-projection__narrative\s*\{[^}]*bottom:\s*max\(72px,\s*calc\(env\(safe-area-inset-bottom\) \+ 68px\)\)[^}]*safe-area-inset-left[^}]*safe-area-inset-right/s
  );
  assert.match(
    voyageCss,
    /@media \(max-height:\s*420px\)[\s\S]*?\.voyage-projection__caption\s*\{[^}]*font-size:\s*clamp\(17px,\s*3\.6vw,\s*22px\)/s
  );
});

test("observatory and cinematic accessibility fallbacks cover motion and forced colors", () => {
  assert.match(boardCss, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*animation-duration:\s*\.01ms !important/);
  assert.match(boardCss, /@media \(forced-colors:\s*active\)[\s\S]*\.cosmos-canvas\s*\{\s*display:\s*none/s);
  assert.match(boardCss, /@media \(forced-colors:\s*active\)[\s\S]*outline:\s*3px solid Highlight/s);

  assert.match(voyageCss, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*animation:\s*none !important/);
  assert.match(voyageCss, /@media \(forced-colors:\s*active\)[\s\S]*outline-color:\s*Highlight/s);
  assert.match(voyageCss, /@media \(forced-colors:\s*active\)[\s\S]*\.voyage-projection__progress\s*\{[^}]*border:\s*1px solid CanvasText/s);
});
