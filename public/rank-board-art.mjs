export const RANK_BOARD_ART_VERSION = 1;

const RANK_IDS = Object.freeze([
  "bronze",
  "silver",
  "gold",
  "diamond",
  "emerald",
  "sapphire",
  "ruby",
  "master",
  "grandmaster",
  "mythic",
  "legend",
  "cosmic"
]);

const VARIANT_DEFINITIONS = Object.freeze({
  sm: Object.freeze({
    id: "sm",
    qualityLabel: "Mobile",
    maximumWidth: 600,
    sourceWidth: 512
  }),
  md: Object.freeze({
    id: "md",
    qualityLabel: "Balanced",
    maximumWidth: 1_199,
    sourceWidth: 896
  }),
  lg: Object.freeze({
    id: "lg",
    qualityLabel: "Cinematic",
    maximumWidth: Number.POSITIVE_INFINITY,
    sourceWidth: 1_254
  })
});

const RAW_TIERS = [
  {
    id: "common",
    name: "Common Sky",
    slug: "tier-01-common",
    ranks: ["bronze", "silver"],
    overlay: 0.72,
    vignette: 0.36,
    saturation: 0.58,
    contrast: 0.96,
    focal: { sm: "50% 42%", md: "50% 44%", lg: "50% 46%" },
    fallback: "radial-gradient(circle at 50% 42%, #17253a 0%, #0c1525 48%, #050a14 100%)"
  },
  {
    id: "dawn",
    name: "Stellar Dawn",
    slug: "tier-02-dawn",
    ranks: ["gold", "diamond"],
    overlay: 0.64,
    vignette: 0.39,
    saturation: 0.7,
    contrast: 0.99,
    focal: { sm: "48% 42%", md: "50% 45%", lg: "52% 47%" },
    fallback: "radial-gradient(circle at 48% 42%, #253052 0%, #11182d 50%, #060914 100%)"
  },
  {
    id: "nebula",
    name: "Living Nebula",
    slug: "tier-03-nebula",
    ranks: ["emerald", "sapphire"],
    overlay: 0.56,
    vignette: 0.42,
    saturation: 0.84,
    contrast: 1.02,
    focal: { sm: "52% 44%", md: "51% 47%", lg: "50% 49%" },
    fallback: "radial-gradient(circle at 52% 44%, #173f47 0%, #10233a 48%, #060a16 100%)"
  },
  {
    id: "aurora",
    name: "Celestial Aurora",
    slug: "tier-04-aurora",
    ranks: ["ruby", "master"],
    overlay: 0.49,
    vignette: 0.46,
    saturation: 0.96,
    contrast: 1.05,
    focal: { sm: "50% 45%", md: "50% 48%", lg: "50% 50%" },
    fallback: "radial-gradient(circle at 50% 45%, #3b2049 0%, #16203d 48%, #070914 100%)"
  },
  {
    id: "rift",
    name: "Astral Rift",
    slug: "tier-05-rift",
    ranks: ["grandmaster", "mythic"],
    overlay: 0.43,
    vignette: 0.51,
    saturation: 1.06,
    contrast: 1.08,
    focal: { sm: "51% 47%", md: "51% 49%", lg: "50% 50%" },
    fallback: "radial-gradient(circle at 51% 47%, #442255 0%, #172244 46%, #060811 100%)"
  },
  {
    id: "singularity",
    name: "Crowned Singularity",
    slug: "tier-06-singularity",
    ranks: ["legend", "cosmic"],
    overlay: 0.38,
    vignette: 0.58,
    saturation: 1.14,
    contrast: 1.11,
    focal: { sm: "50% 48%", md: "50% 50%", lg: "50% 50%" },
    fallback: "radial-gradient(circle at 50% 50%, #05050c 0 14%, #532345 28%, #17265b 50%, #050711 100%)"
  }
];

function variantUrl(slug, id) {
  return `./art/ranks/${slug}-${id}.webp`;
}

export const RANK_BOARD_ART_TIERS = Object.freeze(
  RAW_TIERS.map((tier, index) => Object.freeze({
    ...tier,
    index,
    number: index + 1,
    ranks: Object.freeze([...tier.ranks]),
    focal: Object.freeze({ ...tier.focal }),
    variants: Object.freeze(
      Object.fromEntries(
        Object.values(VARIANT_DEFINITIONS).map((variant) => [
          variant.id,
          Object.freeze({
            ...variant,
            url: variantUrl(tier.slug, variant.id)
          })
        ])
      )
    )
  }))
);

const RANK_INDEX = new Map(RANK_IDS.map((id, index) => [id, index]));
const TIER_BY_RANK = new Map(
  RANK_BOARD_ART_TIERS.flatMap((tier) =>
    tier.ranks.map((rankId) => [rankId, tier])
  )
);

function canonicalRankId(value) {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[\s_-]+/g, "");
  return RANK_IDS.find((id) => id.replace(/_/g, "") === normalized) || null;
}

/**
 * Returns one of the twelve allowlisted rank IDs. Unknown, malformed, and
 * non-finite values deliberately resolve to Bronze.
 */
export function sanitizeRankBoardArtRank(candidate, depth = 0) {
  if (depth > 2) return RANK_IDS[0];
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    for (const key of ["rankId", "currentRankId", "rank", "id", "name", "number"]) {
      if (candidate[key] != null) {
        return sanitizeRankBoardArtRank(candidate[key], depth + 1);
      }
    }
    return RANK_IDS[0];
  }
  if (typeof candidate === "string") {
    const id = canonicalRankId(candidate);
    if (id) return id;
    const numeric = Number(candidate.trim());
    if (!Number.isFinite(numeric)) return RANK_IDS[0];
    candidate = numeric;
  }
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    const index = Math.min(RANK_IDS.length, Math.max(1, Math.round(candidate))) - 1;
    return RANK_IDS[index];
  }
  return RANK_IDS[0];
}

export function getRankBoardArtTier(candidate) {
  return TIER_BY_RANK.get(sanitizeRankBoardArtRank(candidate))
    || RANK_BOARD_ART_TIERS[0];
}

function safeViewportWidth(value) {
  const width = Number(value);
  return Number.isFinite(width) && width > 0
    ? Math.min(16_384, Math.round(width))
    : 1_024;
}

function variantIdFor({ viewportWidth, quality = "auto" } = {}) {
  const preference = String(quality || "auto").trim().toLocaleLowerCase("en-US");
  if (preference === "mobile" || preference === "economy" || preference === "low") {
    return "sm";
  }
  if (preference === "balanced" || preference === "medium") return "md";
  if (preference === "cinematic" || preference === "high") return "lg";
  const width = safeViewportWidth(viewportWidth);
  if (width <= VARIANT_DEFINITIONS.sm.maximumWidth) return "sm";
  if (width <= VARIANT_DEFINITIONS.md.maximumWidth) return "md";
  return "lg";
}

function wantsReducedData(options = {}) {
  return options.reducedData === true
    || options.saveData === true
    || String(options.quality || "").toLocaleLowerCase("en-US") === "data-saver";
}

/**
 * Presentation data is ready for the board renderer and contains no
 * user-controlled URL or CSS fragment.
 */
export function getRankBoardArtPresentation(candidate, options = {}) {
  const rankId = sanitizeRankBoardArtRank(candidate);
  const rankIndex = RANK_INDEX.get(rankId);
  const tier = getRankBoardArtTier(rankId);
  const reducedData = wantsReducedData(options);
  const variantId = variantIdFor(options);
  const variant = tier.variants[variantId];
  const variants = Object.values(tier.variants);
  const imageSrcSet = variants
    .map((entry) => `${entry.url} ${entry.sourceWidth}w`)
    .join(", ");
  return {
    version: RANK_BOARD_ART_VERSION,
    rank: Object.freeze({
      id: rankId,
      name: `${rankId[0].toUpperCase()}${rankId.slice(1)}`,
      index: rankIndex,
      number: rankIndex + 1
    }),
    tier,
    variant: reducedData
      ? Object.freeze({
          id: "fallback",
          qualityLabel: "Data saver",
          url: null,
          sourceWidth: 0
        })
      : variant,
    reducedData,
    usesImage: !reducedData,
    focalPosition: tier.focal[variantId],
    imageSrcSet,
    imageSizes: "100vw",
    preload: Object.freeze({
      recommended: !reducedData && options.imminent !== false,
      href: reducedData ? null : variant.url,
      as: "image",
      type: "image/webp",
      imageSrcSet: reducedData ? "" : imageSrcSet,
      imageSizes: "100vw",
      fetchPriority: "high"
    })
  };
}

export function getRankBoardArtPreloadRecommendation(candidate, options = {}) {
  return getRankBoardArtPresentation(candidate, options).preload;
}

/**
 * CSS custom properties consumed by the board stylesheet. The fallback stays
 * active beneath the bitmap and becomes the whole scene in data-saver mode.
 */
export function getRankBoardArtCssVariables(candidate, options = {}) {
  const presentation = getRankBoardArtPresentation(candidate, options);
  return Object.freeze({
    "--rank-board-image": presentation.usesImage
      ? `url("${presentation.variant.url}")`
      : "none",
    "--rank-board-fallback": presentation.tier.fallback,
    "--rank-board-overlay": String(presentation.tier.overlay),
    "--rank-board-vignette": String(presentation.tier.vignette),
    "--rank-board-focal": presentation.focalPosition,
    "--rank-board-saturation": String(presentation.tier.saturation),
    "--rank-board-contrast": String(presentation.tier.contrast)
  });
}
