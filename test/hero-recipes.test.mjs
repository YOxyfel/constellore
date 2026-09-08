import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  HERO_RECIPES,
  HERO_RECIPE_INTERVAL_MS,
  createHeroRecipeRotator,
  heroRecipeLabel,
  nextHeroRecipeIndex,
  renderHeroRecipe
} from "../public/hero-recipes.mjs";

const rootPath = new URL("../", import.meta.url);

function fakeRecipeRoot() {
  const values = new Map();
  return {
    dataset: {},
    attributes: {},
    values,
    querySelector(selector) {
      const field = selector.match(/data-hero-recipe="([^"]+)"/)?.[1];
      if (!field) return null;
      if (!values.has(field)) values.set(field, { textContent: "" });
      return values.get(field);
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
  };
}

test("hero recipe catalog contains varied, authored logical examples", () => {
  assert.equal(HERO_RECIPES.length, 6);
  assert.equal(new Set(HERO_RECIPES.map(({ a, b, result }) => `${a}|${b}|${result}`)).size, HERO_RECIPES.length);
  assert.ok(HERO_RECIPES.some(({ a, b, result }) => a === "Species" && b === "Air" && result === "Bird"));
  assert.ok(HERO_RECIPES.some(({ a, b, result }) => a === "Brick" && b === "Brick" && result === "Wall"));
  assert.ok(HERO_RECIPE_INTERVAL_MS >= 4_000);
});

test("recipe helpers loop cleanly and produce a plain-language label", () => {
  assert.equal(nextHeroRecipeIndex(0, 6), 1);
  assert.equal(nextHeroRecipeIndex(5, 6), 0);
  assert.equal(heroRecipeLabel(HERO_RECIPES[0]), "Example: Earth plus Water makes Mud");
});

test("recipe rendering updates visible fields and the accessible label", () => {
  const root = fakeRecipeRoot();
  assert.equal(renderHeroRecipe(root, HERO_RECIPES[2]), true);
  assert.equal(root.values.get("a").textContent, "SPECIES");
  assert.equal(root.values.get("result").textContent, "BIRD");
  assert.equal(root.attributes["aria-label"], "Example: Species plus Air makes Bird");
});

test("rotator advances without changing the stable recipe container", () => {
  const root = fakeRecipeRoot();
  let tick = null;
  let cleared = false;
  const listeners = new Map();
  const documentRef = {
    hidden: false,
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type) { listeners.delete(type); }
  };
  const rotator = createHeroRecipeRotator({
    root,
    documentRef,
    setIntervalFn(callback) { tick = callback; return 9; },
    clearIntervalFn(id) { cleared = id === 9; }
  });

  tick();
  assert.equal(root.values.get("result").textContent, "STEAM");
  assert.equal(root.dataset.cycle, "odd");
  rotator.advance();
  assert.equal(root.values.get("result").textContent, "BIRD");
  assert.equal(root.dataset.cycle, "even");
  rotator.stop();
  assert.equal(cleared, true);
  assert.equal(listeners.size, 0);
});

test("game hero keeps a valid no-script fallback and stable, motion-safe styling", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("public/index.html", rootPath), "utf8"),
    readFile(new URL("public/epic-home.css", rootPath), "utf8")
  ]);
  assert.match(page, /Make worlds[\s\S]*out of words[.]/);
  assert.match(page, /Combine two ideas to discover something new[.]/);
  assert.match(page, /id="heroRecipeExample"[\s\S]*EARTH[\s\S]*WATER[\s\S]*MUD/);
  const recipeMarkup = page.slice(
    page.indexOf('id="heroRecipeExample"'),
    page.indexOf("</div>", page.indexOf('id="heroRecipeExample"')) + 6
  );
  assert.equal((recipeMarkup.match(/class="recipe-word/g) || []).length, 3);
  assert.doesNotMatch(recipeMarkup, /<i\b|>\s*(?:[+]|→|&rarr;)\s*</);
  assert.match(page, /hero-recipes[.]mjs[?]v=/);
  assert.match(page, /class="home-vfx" aria-hidden="true"/);
  assert.match(styles, /#startScreen [.]start-copy\s*\{[^}]*align-items:\s*center[^}]*text-align:\s*center/);
  assert.match(styles, /#startScreen [.]recipe-example\s*\{[\s\S]*width:\s*min\(100%,\s*650px\)[\s\S]*grid-template-columns:/);
  assert.doesNotMatch(styles, /recipe-example\s*>\s*i|recipe-example\s*>\s*:nth-child\((?:4|5)\)/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce[\s\S]*animation-duration:\s*[.]001ms !important/);
});
