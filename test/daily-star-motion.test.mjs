import test from "node:test";
import assert from "node:assert/strict";
import {
  DAILY_STAR_MAX_FRAME_MS,
  DAILY_STAR_OBSTACLE_SELECTORS,
  advanceDailyStarMotion,
  dailyStarRectsOverlap,
  findDailyStarPosition
} from "../public/hero-recipes.mjs";

const bounds = Object.freeze({ left: 0, top: 0, right: 200, bottom: 120 });
const size = Object.freeze({ width: 30, height: 20 });

test("Daily star treats Orbit navigation and Forge actions as blockers", () => {
  assert.ok(DAILY_STAR_OBSTACLE_SELECTORS.includes(".home-orbit__rail"));
  assert.ok(DAILY_STAR_OBSTACLE_SELECTORS.includes(".home-orbit__arrow:not(:disabled)"));
  assert.ok(DAILY_STAR_OBSTACLE_SELECTORS.includes(".home-forge-catalog-toggle:not([hidden])"));
});

test("Daily star rectangle checks include the requested breathing room", () => {
  const a = { left: 0, top: 0, right: 30, bottom: 20 };
  const b = { left: 36, top: 0, right: 66, bottom: 20 };
  assert.equal(dailyStarRectsOverlap(a, b), false);
  assert.equal(dailyStarRectsOverlap(a, b, 7), true);
});

test("Daily star reflects cleanly from every viewport edge", () => {
  const right = advanceDailyStarMotion(
    { x: 169, y: 50, vx: 40, vy: 0 },
    { size, bounds },
    DAILY_STAR_MAX_FRAME_MS
  );
  assert.ok(right.x <= 170);
  assert.ok(right.x >= 0);
  assert.ok(right.vx < 0);

  const top = advanceDailyStarMotion(
    { x: 60, y: .5, vx: 0, vy: -40 },
    { size, bounds },
    DAILY_STAR_MAX_FRAME_MS
  );
  assert.ok(top.y >= 0);
  assert.ok(top.y <= 100);
  assert.ok(top.vy > 0);
});

test("Daily star bounces from content instead of crossing it", () => {
  const obstacle = { left: 100, top: 35, right: 150, bottom: 90 };
  const next = advanceDailyStarMotion(
    { x: 52, y: 50, vx: 200, vy: 0 },
    { size, bounds, obstacles: [obstacle], gap: 10 },
    DAILY_STAR_MAX_FRAME_MS
  );
  const rect = {
    left: next.x,
    top: next.y,
    right: next.x + size.width,
    bottom: next.y + size.height
  };
  assert.equal(dailyStarRectsOverlap(rect, obstacle, 10), false);
  assert.equal(next.x, 60);
  assert.ok(next.vx < 0);
});

test("Daily star caps long background-frame gaps to prevent tunnelling", () => {
  const geometry = { size, bounds };
  const state = { x: 40, y: 40, vx: 52, vy: 31 };
  assert.deepEqual(
    advanceDailyStarMotion(state, geometry, 10_000),
    advanceDailyStarMotion(state, geometry, DAILY_STAR_MAX_FRAME_MS)
  );
});

test("Daily star finds the nearest safe pocket and reports dense layouts", () => {
  const obstacle = { left: 40, top: 20, right: 160, bottom: 100 };
  const position = findDailyStarPosition({
    size,
    bounds,
    obstacles: [obstacle],
    preferred: { x: 75, y: 50 },
    gap: 8
  });
  assert.ok(position);
  const rect = {
    left: position.x,
    top: position.y,
    right: position.x + size.width,
    bottom: position.y + size.height
  };
  assert.equal(dailyStarRectsOverlap(rect, obstacle, 8), false);

  assert.equal(findDailyStarPosition({
    size,
    bounds: { left: 0, top: 0, right: 30, bottom: 20 },
    obstacles: [{ left: 0, top: 0, right: 30, bottom: 20 }]
  }), null);
});
