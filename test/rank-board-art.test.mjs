import assert from "node:assert/strict";
import test from "node:test";

import {
  RANK_BOARD_ART_TIERS,
  RANK_BOARD_ART_VERSION,
  getRankBoardArtCssVariables,
  getRankBoardArtPreloadRecommendation,
  getRankBoardArtPresentation,
  getRankBoardArtTier,
  sanitizeRankBoardArtRank
} from "../public/rank-board-art.mjs";

test("twelve ranks are paired into six increasingly expressive art tiers", () => {
  assert.equal(RANK_BOARD_ART_VERSION, 1);
  assert.equal(RANK_BOARD_ART_TIERS.length, 6);
  assert.deepEqual(
    RANK_BOARD_ART_TIERS.map((tier) => tier.ranks),
    [
      ["bronze", "silver"],
      ["gold", "diamond"],
      ["emerald", "sapphire"],
      ["ruby", "master"],
      ["grandmaster", "mythic"],
      ["legend", "cosmic"]
    ]
  );
  assert.deepEqual(
    RANK_BOARD_ART_TIERS.map((tier) => tier.id),
    ["common", "dawn", "nebula", "aurora", "rift", "singularity"]
  );
  assert.ok(
    RANK_BOARD_ART_TIERS.every((tier, index, tiers) =>
      index === 0 || tier.overlay < tiers[index - 1].overlay
    ),
    "later ranks should reveal more of the art"
  );
  assert.ok(
    RANK_BOARD_ART_TIERS.every((tier, index, tiers) =>
      index === 0 || tier.saturation > tiers[index - 1].saturation
    ),
    "later ranks should become more vivid"
  );
});

test("rank lookup is allowlisted, deterministic, and safe for malformed data", () => {
  assert.equal(sanitizeRankBoardArtRank(" Grand Master "), "grandmaster");
  assert.equal(sanitizeRankBoardArtRank({ currentRankId: "MYTHIC" }), "mythic");
  assert.equal(sanitizeRankBoardArtRank({ rank: { number: 12 } }), "cosmic");
  assert.equal(
    sanitizeRankBoardArtRank({ id: "game-42", rank: { id: "diamond" } }),
    "diamond"
  );
  assert.equal(sanitizeRankBoardArtRank(3.4), "gold");
  assert.equal(sanitizeRankBoardArtRank(999), "cosmic");
  assert.equal(sanitizeRankBoardArtRank(-50), "bronze");
  assert.equal(sanitizeRankBoardArtRank(Number.POSITIVE_INFINITY), "bronze");
  assert.equal(sanitizeRankBoardArtRank({ id: "url(evil)" }), "bronze");
  assert.equal(sanitizeRankBoardArtRank(null), "bronze");
  assert.equal(getRankBoardArtTier("silver").id, "common");
  assert.equal(getRankBoardArtTier("legend").id, "singularity");
});

test("responsive variants use fixed trusted URLs and meaningful quality labels", () => {
  const mobile = getRankBoardArtPresentation("gold", { viewportWidth: 390 });
  const tablet = getRankBoardArtPresentation("gold", { viewportWidth: 900 });
  const desktop = getRankBoardArtPresentation("gold", { viewportWidth: 1_920 });
  assert.deepEqual(
    [mobile.variant.id, tablet.variant.id, desktop.variant.id],
    ["sm", "md", "lg"]
  );
  assert.deepEqual(
    [mobile.variant.qualityLabel, tablet.variant.qualityLabel, desktop.variant.qualityLabel],
    ["Mobile", "Balanced", "Cinematic"]
  );
  assert.equal(
    mobile.variant.url,
    "./art/ranks/tier-02-dawn-sm.webp"
  );
  assert.equal(
    desktop.variant.url,
    "./art/ranks/tier-02-dawn-lg.webp"
  );
  assert.match(desktop.imageSrcSet, /tier-02-dawn-sm\.webp 512w/);
  assert.match(desktop.imageSrcSet, /tier-02-dawn-lg\.webp 1254w/);
  assert.equal(desktop.imageSizes, "100vw");
});

test("explicit quality preference is sanitized and overrides viewport selection", () => {
  assert.equal(
    getRankBoardArtPresentation("ruby", {
      viewportWidth: 320,
      quality: "cinematic"
    }).variant.id,
    "lg"
  );
  assert.equal(
    getRankBoardArtPresentation("ruby", {
      viewportWidth: 4_000,
      quality: "economy"
    }).variant.id,
    "sm"
  );
  assert.equal(
    getRankBoardArtPresentation("ruby", {
      viewportWidth: 4_000,
      quality: "made-up"
    }).variant.id,
    "lg"
  );
});

test("reduced-data mode removes the bitmap but preserves rank-specific atmosphere", () => {
  const presentation = getRankBoardArtPresentation("cosmic", {
    viewportWidth: 390,
    saveData: true
  });
  assert.equal(presentation.rank.id, "cosmic");
  assert.equal(presentation.tier.id, "singularity");
  assert.equal(presentation.reducedData, true);
  assert.equal(presentation.usesImage, false);
  assert.equal(presentation.variant.id, "fallback");
  assert.equal(presentation.variant.qualityLabel, "Data saver");
  assert.equal(presentation.variant.url, null);
  assert.equal(presentation.preload.recommended, false);
  assert.equal(presentation.preload.href, null);
  assert.equal(getRankBoardArtCssVariables("cosmic", {
    reducedData: true
  })["--rank-board-image"], "none");
  assert.match(
    getRankBoardArtCssVariables("cosmic", {
      reducedData: true
    })["--rank-board-fallback"],
    /^radial-gradient/
  );
});

test("CSS variables expose only stable renderer values", () => {
  const variables = getRankBoardArtCssVariables("legend", {
    viewportWidth: 1_920
  });
  assert.deepEqual(Object.keys(variables), [
    "--rank-board-image",
    "--rank-board-fallback",
    "--rank-board-overlay",
    "--rank-board-vignette",
    "--rank-board-focal",
    "--rank-board-saturation",
    "--rank-board-contrast"
  ]);
  assert.equal(
    variables["--rank-board-image"],
    'url("./art/ranks/tier-06-singularity-lg.webp")'
  );
  assert.equal(variables["--rank-board-overlay"], "0.38");
  assert.equal(variables["--rank-board-focal"], "50% 50%");
  assert.equal(
    getRankBoardArtCssVariables({ id: "\";background:red" })["--rank-board-image"],
    'url("./art/ranks/tier-01-common-md.webp")'
  );
});

test("preload advice follows the chosen responsive image and user intent", () => {
  const preload = getRankBoardArtPreloadRecommendation("emerald", {
    viewportWidth: 800
  });
  assert.deepEqual(
    {
      recommended: preload.recommended,
      href: preload.href,
      as: preload.as,
      type: preload.type,
      fetchPriority: preload.fetchPriority
    },
    {
      recommended: true,
      href: "./art/ranks/tier-03-nebula-md.webp",
      as: "image",
      type: "image/webp",
      fetchPriority: "high"
    }
  );
  assert.equal(
    getRankBoardArtPreloadRecommendation("emerald", {
      viewportWidth: 800,
      imminent: false
    }).recommended,
    false
  );
});
