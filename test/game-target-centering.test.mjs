import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const styles = [
  await readFile(new URL("../public/simple-ui.css", import.meta.url), "utf8"),
  await readFile(new URL("../public/mobile-play-shell.css", import.meta.url), "utf8")
].join("\n");

test("the objective centers over the playable board instead of the Words pane", () => {
  assert.match(styles, /--words-pane-width:\s*clamp\(260px, 24vw, 310px\)/);
  assert.match(styles, /--words-pane-half:\s*clamp\(130px, 12vw, 155px\)/);
  assert.match(styles, /[.]simple-ui [.]game-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) var\(--words-pane-width\)/s);
  assert.match(
    styles,
    /body[.]simple-ui:not\([.]scramble-active\) [.]game-target\s*\{[^}]*left:\s*calc\(50% - var\(--words-pane-half\)\)[^}]*transform:\s*translateX\(-50%\)/s
  );
  assert.match(styles, /@media \(min-width: 901px\), \(min-width: 701px\) and \(orientation: landscape\)/);
});
