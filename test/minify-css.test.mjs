import test from "node:test";
import assert from "node:assert/strict";
import { minifyCss } from "../scripts/minify-css.mjs";

test("release CSS minification removes layout whitespace without changing strings or calc expressions", () => {
  const source = `
    /* build note */
    .card :is(b, strong) {
      width: calc(100% - 24px);
      content: "Step 1: A > B; }";
      color: rgb(1, 2, 3);
    }
  `;
  const output = minifyCss(source);
  assert.equal(
    output,
    '.card :is(b,strong){width:calc(100% - 24px);content:"Step 1: A > B; }";color:rgb(1,2,3)}\n'
  );
});

test("release CSS minification does not turn comments into descendant selectors", () => {
  assert.equal(minifyCss(".word/**/.active { color: white; }"), ".word.active{color:white}\n");
});
