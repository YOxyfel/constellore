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

test("release CSS minification removes safe function and attribute-selector bytes", () => {
  const source = `
    [data-theme="lunar-garden"] :is(
      .word,
      .trail
    ) {
      color: white;
      content: '[data-theme="lunar-garden"]';
    }
  `;
  assert.equal(
    minifyCss(source),
    `[data-theme=lunar-garden] :is(.word,.trail){color:white;content:'[data-theme="lunar-garden"]'}\n`
  );
});

test("release CSS minification preserves escaped selector quotes and later strings", () => {
  const source = String.raw`.foo\"bar { content: "[data-theme='lunar-garden']"; }`;
  const expected = `${String.raw`.foo\"bar{content:"[data-theme='lunar-garden']"}`}\n`;
  assert.equal(minifyCss(source), expected);
});

test("release CSS minification removes units from zero lengths without touching strings, percentages, or identifiers", () => {
  assert.equal(
    minifyCss('.zero { inset: 0px -0rem; width: 0%; content: "0px"; --token-0px: 1; }'),
    '.zero{inset:0 -0;width:0%;content:"0px";--token-0px:1}\n'
  );
});
