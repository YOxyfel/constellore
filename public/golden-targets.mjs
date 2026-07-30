export const GOLDEN_TARGET_COUNT = 50;
export const GOLDEN_TARGET_MIN_ROUTE_LENGTH = 3;
export const GOLDEN_TARGET_MAX_ROUTE_LENGTH = 7;
export const GOLDEN_TARGET_MIN_FINAL_RECIPES = 2;
export const GOLDEN_TARGET_EARLY_COMPLETION_LIMIT = 30;

const TARGETS = [
  { target: "Rain", clue: "Lift water into a cloud, then fill it until it falls.", tier: 1, routeLength: 3, family: "weather" },
  { target: "Mountain", clue: "Cool molten earth into stone, then build upward.", tier: 1, routeLength: 3, family: "land" },
  { target: "Bird", clue: "Create life, then give it the open air.", tier: 1, routeLength: 3, family: "life" },
  { target: "Storm", clue: "Build a cloud, then let the clouds gather.", tier: 1, routeLength: 3, family: "weather" },
  { target: "Glass", clue: "Wear earth into sand, then transform it with heat.", tier: 1, routeLength: 3, family: "craft" },
  { target: "Garden", clue: "Help life take root, then let plants grow together.", tier: 1, routeLength: 3, family: "life" },
  { target: "World", clue: "Bring land and ocean together.", tier: 1, routeLength: 3, family: "land" },
  { target: "Horizon", clue: "Find the place where earth appears to meet the sky.", tier: 1, routeLength: 3, family: "sky" },
  { target: "Sound", clue: "Make the air move, then give that movement a wave.", tier: 1, routeLength: 3, family: "physics" },
  { target: "Sculpture", clue: "Shape wet earth into something made to be seen.", tier: 1, routeLength: 3, family: "art" },
  { target: "Pottery", clue: "Shape wet earth, then harden it with fire.", tier: 1, routeLength: 3, family: "craft" },
  { target: "Metal", clue: "Cool molten earth into stone, then refine it with fire.", tier: 1, routeLength: 3, family: "craft" },
  { target: "Jet", clue: "Build an engine, then give it the air.", tier: 1, routeLength: 3, family: "technology" },
  { target: "Factory", clue: "Build an engine, then imagine many engines working together.", tier: 1, routeLength: 3, family: "technology" },
  { target: "Ash", clue: "Grow something from the earth, then let fire consume it.", tier: 1, routeLength: 3, family: "fire" },

  { target: "Phoenix", clue: "Give life wings, then send the bird through flame.", tier: 2, routeLength: 4, family: "myth" },
  { target: "House", clue: "Make bricks, raise walls, and enclose a home.", tier: 2, routeLength: 4, family: "building" },
  { target: "River", clue: "Raise a mountain, then send water down its side.", tier: 2, routeLength: 4, family: "water" },
  { target: "Forest", clue: "Grow one tree, then let it become many.", tier: 2, routeLength: 4, family: "life" },
  { target: "Ecosystem", clue: "Create living species, then let them share a world.", tier: 2, routeLength: 4, family: "life" },
  { target: "Comet", clue: "Open space, then send water wandering through it.", tier: 2, routeLength: 4, family: "space" },
  { target: "Mirror", clue: "Create glass, then let glass face itself.", tier: 2, routeLength: 4, family: "craft" },
  { target: "Park", clue: "Grow a garden, then give it room to spread.", tier: 2, routeLength: 4, family: "life" },
  { target: "Star", clue: "Open space, then light a fire within it.", tier: 2, routeLength: 4, family: "space" },
  { target: "Planet", clue: "Open space, then place earth inside it.", tier: 2, routeLength: 4, family: "space" },
  { target: "Flood", clue: "Make rain, then let the rain keep falling.", tier: 2, routeLength: 4, family: "water" },
  { target: "Wetland", clue: "Soak the earth until a living marsh can spread.", tier: 2, routeLength: 4, family: "water" },
  { target: "Fortress", clue: "Raise a wall, then anchor it to the earth.", tier: 2, routeLength: 4, family: "building" },
  { target: "Rust", clue: "Create metal, then leave it to the air.", tier: 2, routeLength: 4, family: "craft" },
  { target: "Window", clue: "Raise a wall, then open it to the air.", tier: 2, routeLength: 4, family: "building" },

  { target: "Village", clue: "Build a house, then let homes gather together.", tier: 2, routeLength: 5, family: "building" },
  { target: "Galaxy", clue: "Make a star, then fill space with stars.", tier: 3, routeLength: 5, family: "space" },
  { target: "Lightning", clue: "Gather a storm, then release its energy.", tier: 3, routeLength: 5, family: "weather" },
  { target: "Jungle", clue: "Grow a forest, then make it wilder and denser.", tier: 3, routeLength: 5, family: "life" },
  { target: "Solar System", clue: "Create a planet, then gather planets into one family.", tier: 3, routeLength: 5, family: "space" },
  { target: "Universe", clue: "Open space, then let space extend into itself.", tier: 3, routeLength: 4, family: "space" },
  { target: "Atmosphere", clue: "Create a planet, then wrap it in air.", tier: 3, routeLength: 5, family: "space" },
  { target: "Farm", clue: "Make rain feed a field, then let the fields grow together.", tier: 3, routeLength: 5, family: "life" },

  { target: "Rainbow", clue: "Make both rain and light, then bring them together.", tier: 3, routeLength: 6, family: "weather" },
  { target: "Telescope", clue: "Create glass, find the sky, and look through one toward the other.", tier: 3, routeLength: 6, family: "space" },
  { target: "City", clue: "Build from brick to wall to house, then keep growing.", tier: 3, routeLength: 6, family: "building" },
  { target: "Cosmos", clue: "Create a galaxy, then place it in the space around it.", tier: 3, routeLength: 6, family: "space" },
  { target: "Rocket", clue: "Build both an engine and metal, then join them.", tier: 4, routeLength: 6, family: "technology" },
  { target: "Electricity", clue: "Create a storm cloud and a conductor, then connect them.", tier: 4, routeLength: 6, family: "technology" },

  { target: "Observatory", clue: "Build a telescope, then give it a home beneath the sky.", tier: 4, routeLength: 7, family: "space" },
  { target: "Spacecraft", clue: "Build a rocket, then strengthen it for the journey beyond.", tier: 4, routeLength: 7, family: "technology" },
  { target: "Water Cycle", clue: "Build a planet and its atmosphere, then follow its water.", tier: 4, routeLength: 7, family: "water" },
  { target: "Greenhouse", clue: "Build a house, grow a plant, then bring life indoors.", tier: 4, routeLength: 7, family: "life" },
  { target: "Satellite", clue: "Create metal, then place it into space.", tier: 4, routeLength: 7, family: "space" },
  { target: "Cosmic Weather", clue: "Create weather on Earth, then carry it into space.", tier: 4, routeLength: 7, family: "space" }
];

const cleanKey = (value) => String(value?.target ?? value?.word ?? value ?? "")
  .trim()
  .toLocaleLowerCase("en-US");

const catalog = Object.freeze(TARGETS.map((entry, index) => Object.freeze({
  ...entry,
  order: index,
  minimumFinalRecipes: GOLDEN_TARGET_MIN_FINAL_RECIPES
})));

const orderByKey = new Map(catalog.map((entry) => [cleanKey(entry.target), entry.order]));

export const GOLDEN_TARGETS = catalog;

export function goldenTargetCatalog() {
  return catalog.map((entry) => ({ ...entry }));
}

export function goldenTargetOrder(value) {
  return orderByKey.get(cleanKey(value)) ?? -1;
}

export function isGoldenTarget(value) {
  return goldenTargetOrder(value) >= 0;
}

/**
 * During the opening progression, restrict personal adaptive play to the
 * hand-curated catalog whenever that catalog can satisfy the active mode.
 * Fixed Daily, Weekly, shared, and custom challenges never call this helper.
 */
export function preferGoldenTargetCandidates(candidates, {
  completedChallenges = 0,
  completionLimit = GOLDEN_TARGET_EARLY_COMPLETION_LIMIT
} = {}) {
  const source = Array.isArray(candidates) ? candidates : [];
  const completed = Math.max(0, Math.trunc(Number(completedChallenges) || 0));
  const limit = Math.max(0, Math.trunc(Number(completionLimit) || 0));
  if (completed >= limit) return [...source];

  const preferred = source
    .filter((candidate) => isGoldenTarget(candidate))
    .sort((left, right) => (
      goldenTargetOrder(left) - goldenTargetOrder(right)
      || cleanKey(left).localeCompare(cleanKey(right), "en")
    ));
  return preferred.length ? preferred : [...source];
}
