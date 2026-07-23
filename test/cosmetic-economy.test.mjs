import assert from "node:assert/strict";
import test from "node:test";

import { COSMETIC_CATALOG, EARNABLE_BADGES, REAL_MONEY_CATALOG, cosmeticClasses, cosmeticOptions, earnedBadges, economyIntegrityPolicy, progressionAuraClass, sanitizeCosmeticLoadout, transformFeedbackAudio } from "../public/cosmetic-economy.mjs";

test("cosmetic loadouts enforce founder ownership without losing free defaults", () => {
  assert.deepEqual(sanitizeCosmeticLoadout({ theme: "solar", board: "nebula", trail: "prism", sound: "glass" }), {
    theme: "void", board: "starlit", trail: "classic", sound: "cosmic"
  });
  assert.deepEqual(sanitizeCosmeticLoadout({ theme: "solar", board: "nebula", trail: "prism", sound: "glass" }, { founder: true }), {
    theme: "solar", board: "nebula", trail: "prism", sound: "glass"
  });
  assert.deepEqual(cosmeticClasses({}, {}), ["theme-void", "board-starlit", "trail-classic", "sound-cosmic"]);
  assert.ok(cosmeticOptions("board", { founder: true }).every((item) => item.owned));
  assert.equal(cosmeticOptions("board").filter((item) => item.owned).length, 1);
});

test("real-money products remain creative and never sell competitive power", () => {
  const policy = economyIntegrityPolicy();
  assert.deepEqual(REAL_MONEY_CATALOG.map((item) => item.id), ["constellore_founders_pass"]);
  assert.deepEqual(REAL_MONEY_CATALOG[0].grants, ["founder_cosmetics"], "real-money purchases remain cosmetic-only");
  assert.equal(policy.soldForCash.includes("star_credits"), false);
  assert.ok(policy.forbiddenCashProducts.includes("word_license"));
  assert.ok(policy.forbiddenCashProducts.includes("extra_moves"));
  assert.equal(policy.competitiveWordDivision, "open");
  assert.equal(policy.fluctuatingPricesCurrency, "star_credits");
  assert.equal(policy.personalizedPricing, false);
  assert.ok(COSMETIC_CATALOG.every((item) => ["theme", "board", "trail", "sound"].includes(item.kind)));
});

test("sound packs transform copies within safe browser-audio bounds", () => {
  const original = { wave: "square", tones: [200, 400], duration: 100, gain: .03 };
  const glass = transformFeedbackAudio(original, "glass");
  const analog = transformFeedbackAudio(original, "analog");
  assert.deepEqual(original.tones, [200, 400]);
  assert.deepEqual(glass.tones, [270, 540]);
  assert.deepEqual(analog.tones, [164, 328]);
  assert.equal(glass.wave, "sine");
  assert.equal(analog.wave, "triangle");
});

test("play achievements unlock earnable badges and cosmetic-only profile auras", () => {
  const fresh = earnedBadges({});
  assert.equal(fresh.length, EARNABLE_BADGES.length);
  assert.ok(fresh.every((badge) => badge.earned === false));
  assert.equal(progressionAuraClass({}), "aura-none");

  const established = {
    firstOrbit: { completed: true },
    wins: 4,
    discoveries: 120,
    masteryStars: 30,
    dailyStreak: 9,
    weekly: { complete: true }
  };
  assert.ok(earnedBadges(established).every((badge) => badge.earned));
  assert.equal(progressionAuraClass(established), "aura-prism");
  assert.equal(COSMETIC_CATALOG.some((item) => item.kind === "badge"), false, "badges are earned through play, not sold");
});
