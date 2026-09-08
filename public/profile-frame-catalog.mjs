export const PROFILE_FRAME_VERSION = 5;

const PARTIAL_MASTER_WIDTH = 1086;
const PARTIAL_MASTER_HEIGHT = 1448;

const island = ({ id, plane, bounds, offset, shape = null }) => {
  const [left, top, right, bottom] = bounds;
  const [x, y] = offset;

  return Object.freeze({
    id,
    plane,
    crop: Object.freeze({
      top: top / PARTIAL_MASTER_HEIGHT,
      right: 1 - (right / PARTIAL_MASTER_WIDTH),
      bottom: 1 - (bottom / PARTIAL_MASTER_HEIGHT),
      left: left / PARTIAL_MASTER_WIDTH
    }),
    placement: Object.freeze({
      x: x / PARTIAL_MASTER_WIDTH,
      y: y / PARTIAL_MASTER_HEIGHT
    }),
    shape: shape
      ? Object.freeze(shape.map(([pointX, pointY]) => Object.freeze({
        x: pointX / PARTIAL_MASTER_WIDTH,
        y: pointY / PARTIAL_MASTER_HEIGHT
      })))
      : null
  });
};

const frame = ({
  slug,
  name,
  epithet,
  description,
  palette,
  fit,
  contentInset = "15px",
  avatarTop = "22%",
  layout = "frame",
  windowSlice = null,
  islands = [],
  animated = false,
  effect = null,
  previewVideo = null
}) => {
  const responsiveSlice = layout === "partial"
    ? { top: "42%", right: "40%", bottom: "42%", left: "40%" }
    : { top: "32%", right: "22%", bottom: "36%", left: "22%" };

  return Object.freeze({
    id: `constellore.profile-frame.${slug}`,
    slug,
    name,
    epithet,
    description,
    palette: Object.freeze([...palette]),
    fit: Object.freeze({ ...fit }),
    contentInset,
    avatarTop,
    layout,
    windowSlice: Object.freeze({ ...responsiveSlice, ...(windowSlice || {}) }),
    islands: Object.freeze([...islands]),
    animated,
    effect,
    previewVideo,
    art: `./art/profile-frames/${slug}.png`
  });
};

export const PROFILE_FRAMES = Object.freeze([
  frame({
    slug: "berry-burrow",
    name: "Berry Burrow",
    epithet: "Strawberry Bunnies",
    description: "Porcelain-soft bunnies, strawberries, clover, and tiny garden blossoms.",
    palette: ["#f36f78", "#f8d9c6", "#8aae58", "#f4c466"],
    fit: { top: "17.5%", right: "9.5%", bottom: "7.5%", left: "9.5%" },
    windowSlice: { top: "21.7%", right: "19.8%", bottom: "17.9%", left: "21.5%" }
  }),
  frame({
    slug: "lunar-reverie",
    name: "Lunar Reverie",
    epithet: "Celestial Moon & Stars",
    description: "Moonstone crescents, orbital filigree, and slow-moving constellation light.",
    palette: ["#8d7bff", "#d9e7ff", "#ffd98a", "#171638"],
    fit: { top: "5%", right: "6.5%", bottom: "5%", left: "6.5%" },
    contentInset: "7.25%",
    avatarTop: "27%",
    windowSlice: { top: "22.9%", right: "14.6%", bottom: "25.9%", left: "16.4%" },
    animated: true,
    effect: "lunar"
  }),
  frame({
    slug: "eventide-fracture",
    name: "Eventide Fracture",
    epithet: "Black-Hole Kintsugi",
    description: "Ancient obsidian restored with molten gold around a miniature event horizon.",
    palette: ["#090914", "#e6b85f", "#8159e8", "#80dcff"],
    fit: { top: "14%", right: "9%", bottom: "7%", left: "9%" },
    windowSlice: { top: "21.6%", right: "15.6%", bottom: "27.3%", left: "15.3%" },
    animated: true,
    effect: "eventide"
  }),
  frame({
    slug: "verdant-reliquary",
    name: "Verdant Reliquary",
    epithet: "Enchanted Ivy Ruins",
    description: "Mossed temple fragments, winding ivy, rune stones, and amber fireflies.",
    palette: ["#254d3b", "#7fa96b", "#88958c", "#f3b65b"],
    fit: { top: "19.5%", right: "14%", bottom: "10.5%", left: "14%" },
    windowSlice: { top: "24.8%", right: "21.6%", bottom: "17.1%", left: "22.8%" }
  }),
  frame({
    slug: "ember-sovereign",
    name: "Ember Sovereign",
    epithet: "Fire Dragon",
    description: "A black-crimson guardian dragon with gold ridges and a restrained ember wake.",
    palette: ["#241016", "#b94535", "#f0b75f", "#ff6d42"],
    fit: { top: "14.5%", right: "9.5%", bottom: "4.5%", left: "9.5%" },
    windowSlice: { top: "27.2%", right: "18%", bottom: "16.2%", left: "15.4%" },
    animated: true,
    effect: "ember"
  }),
  frame({
    slug: "abyssal-pearl",
    name: "Abyssal Pearl",
    epithet: "Ocean Pearls & Jellyfish",
    description: "Nacre, sea glass, coral, and luminous jellyfish suspended in a quiet current.",
    palette: ["#123d54", "#55d6d1", "#a888ee", "#f4e4bc"],
    fit: { top: "14.5%", right: "13.5%", bottom: "11.5%", left: "13.5%" },
    windowSlice: { top: "18.2%", right: "21.1%", bottom: "25.6%", left: "20.8%" },
    animated: true,
    effect: "abyssal"
  }),
  frame({
    slug: "chromatic-override",
    name: "Chromatic Override",
    epithet: "Neon Cyberpunk",
    description: "Carbon glass, holographic plates, and precise cyan-magenta light rails.",
    palette: ["#111327", "#4be8ff", "#ff5bd5", "#ffbb5d"],
    fit: { top: "16.5%", right: "14.5%", bottom: "11%", left: "14.5%" },
    windowSlice: { top: "22.9%", right: "19.5%", bottom: "19.5%", left: "19.3%" }
  }),
  frame({
    slug: "maple-hearth",
    name: "Maple Hearth",
    epithet: "Autumn Foxes",
    description: "Sleeping foxes, maple leaves, berries, acorns, and carved bronze branches.",
    palette: ["#cb5a2e", "#853a35", "#7b824d", "#d0a364"],
    fit: { top: "5.5%", right: "4.5%", bottom: "5%", left: "4.5%" },
    contentInset: "10.2%",
    avatarTop: "25.5%",
    windowSlice: { top: "14.2%", right: "16.1%", bottom: "35%", left: "15%" }
  }),
  frame({
    slug: "frostbound-crown",
    name: "Frostbound Crown",
    epithet: "Winter Crystals",
    description: "Moon-silver filigree grown over with faceted ice and snowflake crowns.",
    palette: ["#b9ddff", "#a59eea", "#eaf7ff", "#283d78"],
    fit: { top: "16.5%", right: "14.5%", bottom: "10.5%", left: "14.5%" },
    windowSlice: { top: "25%", right: "20.4%", bottom: "22%", left: "20.3%" }
  }),
  frame({
    slug: "keeper-of-tomes",
    name: "Keeper of Tomes",
    epithet: "Arcane Library",
    description: "Carved walnut, antique brass, candles, maps, and softly awakened spell pages.",
    palette: ["#412b2b", "#8e3f50", "#c59650", "#55b5a8"],
    fit: { top: "16.5%", right: "12.5%", bottom: "20%", left: "12.5%" },
    windowSlice: { top: "27.5%", right: "19.2%", bottom: "22.4%", left: "18.4%" }
  }),
  frame({
    slug: "tidal-ascendant",
    name: "Tidal Ascendant",
    epithet: "Leviathan Tide",
    description: "Three separated surges: a wave crown, a luminous leviathan trace, and a pearl vortex.",
    palette: ["#55e7ff", "#1875a9", "#9368ff", "#f3e6c3"],
    fit: { top: "4%", right: "4%", bottom: "4%", left: "4%" },
    contentInset: "20%",
    avatarTop: "35%",
    layout: "partial",
    islands: [
      island({
        id: "wave-crown",
        plane: "outside",
        bounds: [35, 36, 550, 524],
        offset: [-126, -167]
      }),
      island({
        id: "leviathan-fin",
        plane: "card",
        bounds: [702, 446, 1056, 898],
        offset: [211, 0]
      }),
      island({
        id: "pearl-vortex",
        plane: "outside",
        bounds: [32, 1079, 370, 1429],
        offset: [-126, 167]
      })
    ]
  }),
  frame({
    slug: "storm-seraph",
    name: "Storm Seraph",
    epithet: "Thunderbird Tempest",
    description: "A thunderbird sweep, lightning spear, and storm vortex erupt across three open edges.",
    palette: ["#e8f6ff", "#56b8ff", "#f0c46a", "#1a2453"],
    fit: { top: "4%", right: "4%", bottom: "4%", left: "4%" },
    contentInset: "20%",
    avatarTop: "35%",
    layout: "partial",
    islands: [
      island({
        id: "thunderbird",
        plane: "outside",
        bounds: [228, 41, 1056, 685],
        offset: [235, -313],
        shape: [
          [228, 41],
          [1056, 41],
          [1056, 685],
          [338, 685],
          [338, 528],
          [228, 528]
        ]
      }),
      island({
        id: "lightning-spear",
        plane: "card",
        bounds: [53, 417, 303, 1149],
        offset: [-135, 0]
      }),
      island({
        id: "storm-vortex",
        plane: "outside",
        bounds: [553, 890, 1052, 1387],
        offset: [218, 290]
      })
    ]
  }),
  frame({
    slug: "empyrean-ascension",
    name: "Empyrean Ascension",
    epithet: "Seraphic Dawn",
    description: "Pearl-white wings guard an open center while a golden halo pours celestial light across the crown.",
    palette: ["#f7f3e9", "#e7b85f", "#8de8ff", "#b8a3e8"],
    fit: { top: "4%", right: "4%", bottom: "4%", left: "4%" },
    contentInset: "20%",
    avatarTop: "35%",
    layout: "partial",
    previewVideo: "./cinematic/profile-frame-previews/empyrean-ascension.mp4",
    islands: [
      island({
        id: "left-angel-wing",
        plane: "outside",
        bounds: [16, 64, 382, 835],
        offset: [-190, 140]
      }),
      island({
        id: "right-angel-wing",
        plane: "outside",
        bounds: [701, 65, 1067, 835],
        offset: [190, 140]
      }),
      island({
        id: "halo-beam",
        plane: "card",
        bounds: [330, 868, 757, 1270],
        offset: [0, -820]
      })
    ]
  }),
  frame({
    slug: "infernal-dominion",
    name: "Infernal Dominion",
    epithet: "Horned Inferno",
    description: "Torn obsidian wings loom beyond the card while a molten horned crown brands its upper edge.",
    palette: ["#161217", "#7c1e1d", "#ff3f22", "#ff9b3d"],
    fit: { top: "4%", right: "4%", bottom: "4%", left: "4%" },
    contentInset: "20%",
    avatarTop: "35%",
    layout: "partial",
    previewVideo: "./cinematic/profile-frame-previews/infernal-dominion.mp4",
    islands: [
      island({
        id: "left-devil-wing",
        plane: "outside",
        bounds: [24, 62, 399, 908],
        offset: [-190, 100]
      }),
      island({
        id: "right-devil-wing",
        plane: "outside",
        bounds: [687, 62, 1062, 908],
        offset: [190, 100]
      }),
      island({
        id: "horned-crown",
        plane: "card",
        bounds: [234, 906, 851, 1360],
        offset: [0, -865]
      })
    ]
  }),
  frame({
    slug: "eclipse-omen",
    name: "Eclipse Omen",
    epithet: "Black-Sun Prophecy",
    description: "A black-gold corona, kintsugi shards, and gravitational dust interrupt the card in three places.",
    palette: ["#05040a", "#e7b85d", "#8a5aff", "#f4e3b1"],
    fit: { top: "4%", right: "4%", bottom: "4%", left: "4%" },
    contentInset: "20%",
    avatarTop: "35%",
    layout: "partial",
    islands: [
      island({
        id: "black-sun",
        plane: "outside",
        bounds: [538, 22, 1071, 518],
        offset: [150, -201]
      }),
      island({
        id: "kintsugi-shards",
        plane: "card",
        bounds: [25, 373, 221, 1034],
        offset: [-48, 0]
      }),
      island({
        id: "gold-crescent",
        plane: "outside",
        bounds: [633, 1007, 1060, 1423],
        offset: [74, 98]
      })
    ]
  }),
  frame({
    slug: "runebreaker-awakening",
    name: "Runebreaker Awakening",
    epithet: "Arcane Rupture",
    description: "An awakened grimoire, spectral glyphs, and an amethyst rupture occupy separate planes.",
    palette: ["#6b45b8", "#daa85f", "#a992ef", "#4acfc8"],
    fit: { top: "4%", right: "4%", bottom: "4%", left: "4%" },
    contentInset: "20%",
    avatarTop: "35%",
    layout: "partial",
    islands: [
      island({
        id: "awakened-grimoire",
        plane: "outside",
        bounds: [16, 27, 524, 519],
        offset: [-197, -263]
      }),
      island({
        id: "spectral-quill",
        plane: "card",
        bounds: [807, 392, 1065, 962],
        offset: [106, 0]
      }),
      island({
        id: "amethyst-burst",
        plane: "outside",
        bounds: [34, 931, 407, 1421],
        offset: [-153, 205]
      })
    ]
  }),
  frame({
    slug: "mecha-singularity",
    name: "Mecha Singularity",
    epithet: "Holographic Reactor",
    description: "A reactor crest, severed energy rail, and prismatic data burst form a broken sci-fi silhouette.",
    palette: ["#0d1323", "#37e3ff", "#ff4fd6", "#ffb24d"],
    fit: { top: "4%", right: "4%", bottom: "4%", left: "4%" },
    contentInset: "20%",
    avatarTop: "35%",
    layout: "partial",
    islands: [
      island({
        id: "reactor-crest",
        plane: "outside",
        bounds: [61, 82, 497, 509],
        offset: [-208, -278]
      }),
      island({
        id: "energy-rail",
        plane: "card",
        bounds: [762, 400, 1008, 1042],
        offset: [151, 0]
      }),
      island({
        id: "data-burst",
        plane: "outside",
        bounds: [54, 974, 502, 1380],
        offset: [-178, 238]
      })
    ]
  }),
  frame({
    slug: "titanfall-relic",
    name: "Titanfall Relic",
    epithet: "Colossus Kintsugi",
    description: "A fallen titan fragment, broken gold-lit chain, and molten relic impact imply a larger myth.",
    palette: ["#5b5855", "#d3a252", "#f05c3a", "#282224"],
    fit: { top: "4%", right: "4%", bottom: "4%", left: "4%" },
    contentInset: "20%",
    avatarTop: "35%",
    layout: "partial",
    islands: [
      island({
        id: "titan-mask",
        plane: "outside",
        bounds: [549, 44, 1034, 555],
        offset: [171, -229]
      }),
      island({
        id: "rune-chain",
        plane: "card",
        bounds: [66, 461, 352, 1000],
        offset: [-179, 0]
      }),
      island({
        id: "impact-relic",
        plane: "outside",
        bounds: [531, 977, 1047, 1391],
        offset: [199, 265]
      })
    ]
  }),
  frame({
    slug: "starforged-ronin",
    name: "Starforged Ronin",
    epithet: "Moonsteel Oath",
    description: "A moonsteel kabuto, clipped energy katana, and spectral ink-dragon hold three disciplined edges.",
    palette: ["#11152f", "#d9e5f2", "#44d8ff", "#ff5b4d"],
    fit: { top: "4%", right: "4%", bottom: "4%", left: "4%" },
    contentInset: "20%",
    avatarTop: "35%",
    layout: "partial",
    islands: [
      island({
        id: "moonsteel-kabuto",
        plane: "outside",
        bounds: [19, 70, 550, 686],
        offset: [-360, -160]
      }),
      island({
        id: "energy-katana",
        plane: "card",
        bounds: [570, 47, 1066, 900],
        offset: [300, -50]
      }),
      island({
        id: "ink-dragon",
        plane: "outside",
        bounds: [258, 824, 802, 1384],
        offset: [180, 300]
      })
    ]
  }),
  frame({
    slug: "gravebound-king",
    name: "Gravebound King",
    epithet: "Emerald Requiem",
    description: "A broken bone crown, chained scythe, and emerald soul reliquary gather beyond three open edges.",
    palette: ["#e8e0cf", "#777d87", "#50f2a1", "#11151a"],
    fit: { top: "4%", right: "4%", bottom: "4%", left: "4%" },
    contentInset: "20%",
    avatarTop: "35%",
    layout: "partial",
    islands: [
      island({
        id: "broken-crown",
        plane: "outside",
        bounds: [24, 35, 497, 550],
        offset: [800, -330]
      }),
      island({
        id: "chained-scythe",
        plane: "card",
        bounds: [682, 49, 1038, 749],
        offset: [188, 240]
      }),
      island({
        id: "soul-reliquary",
        plane: "outside",
        bounds: [393, 843, 691, 1414],
        offset: [-460, 280]
      })
    ]
  })
]);

export const ANIMATED_PROFILE_FRAMES = Object.freeze(
  PROFILE_FRAMES.filter((entry) => entry.animated)
);

export function profileFrameBySlug(slug) {
  return PROFILE_FRAMES.find((entry) => entry.slug === slug) || null;
}
