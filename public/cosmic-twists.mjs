export const COSMIC_TWIST_CHANCE = 0.12;
export const COSMIC_TWIST_GRACE_MOVES = 2;
export const COSMIC_TWIST_MODES = Object.freeze(["reach", "challenge"]);

const variant = (word, emoji, category, note) => Object.freeze({ word, emoji, category, note });
const entries = [
  [["Earth", "Water"], [variant("Clay", "🏺", "nature", "The softened earth settles into clay."), variant("Swamp", "🐊", "nature", "The mixture spreads into a living swamp."), variant("Wetland", "🪷", "nature", "The water lingers and forms a wetland.")]],
  [["Fire", "Water"], [variant("Geyser", "♨️", "nature", "The steam erupts upward as a geyser."), variant("Cloud", "☁️", "nature", "The steam gathers into a cloud."), variant("Evaporation", "💨", "force", "The water escapes through evaporation.")]],
  [["Air", "Water"], [variant("Cloud", "☁️", "nature", "The airborne water gathers into a cloud."), variant("Rain", "🌧️", "nature", "The suspended water falls as rain."), variant("Wave", "🌊", "nature", "The air pushes the water into a wave.")]],
  [["Air", "Earth"], [variant("Sand", "🏖️", "nature", "The wind wears the earth into sand."), variant("Dune", "🏜️", "nature", "The wind piles earth into a dune."), variant("Dust Storm", "🌪️", "nature", "The lifted earth becomes a dust storm.")]],
  [["Earth", "Fire"], [variant("Magma", "🌋", "nature", "The heated earth churns into magma."), variant("Volcano", "🌋", "nature", "The burning earth rises as a volcano."), variant("Obsidian", "🖤", "structure", "The molten earth flashes into obsidian.")]],
  [["Air", "Fire"], [variant("Heat", "🌡️", "force", "The flame spreads through the air as heat."), variant("Spark", "✨", "force", "The charged flame leaps into a spark."), variant("Smoke", "💨", "force", "The fire darkens the air into smoke.")]],
  [["Mud", "Fire"], [variant("Pottery", "🏺", "structure", "The fired mud takes the shape of pottery."), variant("Kiln", "🏺", "structure", "The fired clay surrounds itself as a kiln."), variant("Ash", "◻️", "nature", "The fierce firing leaves a trace of ash.")]],
  [["Lava", "Water"], [variant("Obsidian", "🖤", "structure", "The sudden cooling forms obsidian."), variant("Island", "🏝️", "nature", "The cooled lava rises as an island."), variant("Geyser", "♨️", "nature", "The collision erupts as a geyser.")]],
  [["Air", "Steam"], [variant("Fog", "🌫️", "nature", "The cooling steam settles into fog."), variant("Weather", "🌤️", "force", "The moving vapor becomes weather.")]],
  [["Cloud", "Water"], [variant("Storm", "⛈️", "force", "The heavy cloud swells into a storm."), variant("Flood", "🌊", "nature", "The cloud releases enough water for a flood."), variant("Weather", "🌤️", "force", "The water-laden cloud becomes weather.")]],
  [["Air", "Energy"], [variant("Electricity", "⚡", "force", "The charged air becomes electricity."), variant("Lightning", "🌩️", "force", "The energy tears through the air as lightning."), variant("Aurora", "🌌", "nature", "The energized air glows as an aurora.")]],
  [["Light", "Rain"], [variant("Spectrum", "🌈", "force", "The rain opens light into a spectrum."), variant("Prism", "🔺", "structure", "The rain behaves like a vast prism."), variant("Wonder", "🤩", "nature", "The shining rain inspires wonder.")]],
  [["Stone", "Water"], [variant("River", "🏞️", "nature", "The water carves a river through stone."), variant("Canyon", "🏜️", "nature", "The water cuts the stone into a canyon."), variant("Erosion", "🏞️", "force", "The meeting becomes erosion.")]],
  [["Fire", "Sand"], [variant("Lens", "🔎", "structure", "The molten sand curves into a lens."), variant("Mirror", "🪞", "structure", "The melted sand cools into a mirror."), variant("Prism", "🔺", "structure", "The glassy sand becomes a prism.")]],
  [["Air", "Light"], [variant("Daylight", "🌤️", "force", "The air scatters light into daylight."), variant("Aurora", "🌌", "nature", "The glowing air becomes an aurora."), variant("Atmosphere", "🌌", "force", "The illuminated air reveals an atmosphere.")]],
  [["Light", "Sky"], [variant("Sun", "☀️", "force", "The sky gathers the light into a sun."), variant("Aurora", "🌌", "nature", "The light dances across the sky as an aurora."), variant("Daylight", "🌤️", "force", "The lit sky becomes daylight.")]],
  [["Glass", "Sky"], [variant("Observatory", "🔭", "structure", "Glass devoted to the sky becomes an observatory."), variant("Lens", "🔎", "structure", "Skyward glass focuses into a lens."), variant("Window", "🪟", "structure", "The glass opens a window onto the sky.")]],
  [["Brick", "Brick"], [variant("Concrete", "🏗️", "structure", "The masonry shifts into modern concrete."), variant("Great Wall", "🏯", "structure", "The bricks stretch into a legendary Great Wall."), variant("Fortress", "🏰", "structure", "The joined bricks rise into a fortress.")]],
  [["Wall", "Wall"], [variant("Castle", "🏰", "structure", "The walls expand into a castle."), variant("Great Wall", "🏯", "structure", "The walls continue beyond the horizon."), variant("Fortress", "🏰", "structure", "The doubled walls harden into a fortress.")]],
  [["House", "House"], [variant("Settlement", "🏘️", "structure", "The neighboring houses form a settlement."), variant("Community", "👥", "life", "The houses fill with a community."), variant("City", "🏙️", "structure", "The houses rapidly grow into a city.")]],
  [["Village", "Village"], [variant("Metropolis", "🌆", "structure", "The villages leap forward into a metropolis."), variant("Civilization", "🏛️", "structure", "The villages unite as a civilization."), variant("Megacity", "🌆", "structure", "The villages merge into a megacity.")]],
  [["City", "City"], [variant("District", "🏙️", "structure", "The cities interlock as one district."), variant("Infrastructure", "🏗️", "structure", "The cities connect through infrastructure."), variant("Monument", "🏛️", "structure", "The joined cities leave a monument.")]],
  [["Earth", "Earth"], [variant("Continent", "🌍", "nature", "The joined earth spreads into a continent."), variant("World", "🌎", "nature", "The earth closes around itself as a world."), variant("Planet", "🪐", "nature", "The gathered earth becomes a planet.")]],
  [["Water", "Water"], [variant("Flood", "🌊", "nature", "The doubled water escapes as a flood."), variant("Wave", "🌊", "nature", "The water rises into a giant wave."), variant("Whirlpool", "🌀", "nature", "The waters circle into a whirlpool.")]],
  [["Fire", "Fire"], [variant("Firestorm", "🔥", "force", "The flames multiply into a firestorm."), variant("Plasma", "☀️", "force", "The doubled fire ionizes into plasma."), variant("Solar Flare", "☀️", "force", "The fire erupts like a solar flare.")]],
  [["Air", "Air"], [variant("Tornado", "🌪️", "force", "The converging air twists into a tornado."), variant("Turbulence", "🌀", "force", "The colliding air becomes turbulence."), variant("Atmosphere", "🌌", "force", "The air gathers into an atmosphere.")]],
  [["Stone", "Stone"], [variant("Monument", "🏛️", "structure", "The stones are raised as a monument."), variant("Castle", "🏰", "structure", "The stones assemble into a castle."), variant("Quarry", "⛏️", "structure", "The mass of stone becomes a quarry.")]],
  [["Tree", "Tree"], [variant("Woodland", "🌲", "nature", "The trees spread into woodland."), variant("Jungle", "🌴", "life", "The trees thicken into a jungle."), variant("Ecosystem", "🌿", "life", "The trees support an ecosystem.")]],
  [["Life", "Life"], [variant("Evolution", "🧬", "life", "Life transforms through evolution."), variant("Biodiversity", "🦋", "life", "Life branches into biodiversity."), variant("Family", "👨‍👩‍👧‍👦", "life", "The lives connect as a family.")]],
  [["Bird", "Bird"], [variant("Migration", "🦅", "life", "The birds begin a migration."), variant("Nest", "🪺", "life", "The birds settle into a nest."), variant("Species", "🧬", "life", "The birds reveal a distinct species.")]],
  [["Fish", "Fish"], [variant("Ecosystem", "🌿", "life", "The fish support an ecosystem."), variant("Biodiversity", "🦋", "life", "The fish branch into biodiversity."), variant("Coral Reef", "🪸", "nature", "The fish gather around a coral reef.")]],
  [["Cloud", "Cloud"], [variant("Weather", "🌤️", "force", "The clouds become a weather system."), variant("Rain", "🌧️", "nature", "The clouds grow heavy with rain."), variant("Thunder", "🌩️", "force", "The clouds collide into thunder.")]],
  [["Rain", "Rain"], [variant("Storm", "⛈️", "force", "The doubled rain builds a storm."), variant("River", "🏞️", "nature", "The rain gathers into a river."), variant("Ocean", "🌊", "nature", "The endless rain becomes an ocean.")]],
  [["Lava", "Lava"], [variant("Magma", "🌋", "nature", "The lava folds back into magma."), variant("Island", "🏝️", "nature", "The lava cools into an island."), variant("Obsidian", "🖤", "structure", "The lava flashes into obsidian.")]],
  [["Energy", "Energy"], [variant("Electricity", "⚡", "force", "The energy aligns into electricity."), variant("Fusion", "⚛️", "force", "The energy collapses into fusion."), variant("Explosion", "💥", "force", "The combined energy becomes an explosion.")]],
  [["Glass", "Glass"], [variant("Window", "🪟", "structure", "The glass opens into a window."), variant("Lens", "🔎", "structure", "The glass curves into a lens."), variant("Prism", "🔺", "structure", "The layered glass becomes a prism.")]],
  [["Metal", "Metal"], [variant("Steel", "🔩", "structure", "The metals harden into steel."), variant("Construction", "🚧", "structure", "The metal becomes a construction frame."), variant("Assembly", "🔧", "structure", "The metal pieces lock into an assembly.")]],
  [["Machine", "Machine"], [variant("Automation", "🤖", "structure", "The machines coordinate into automation."), variant("Industry", "🏭", "structure", "The machines expand into industry."), variant("Robot", "🤖", "structure", "The machines organize into a robot.")]],
  [["Star", "Star"], [variant("Constellation", "✨", "nature", "The stars connect as a constellation."), variant("Universe", "🌌", "nature", "The stars unfold into a universe."), variant("Binary Star", "🌟", "nature", "The two stars become a binary star.")]],
  [["Rocket", "Rocket"], [variant("Spacecraft", "🛸", "structure", "The rockets combine into a spacecraft."), variant("Space Station", "🛰️", "structure", "The rockets assemble an orbital station."), variant("Comet", "☄️", "nature", "The rockets streak away like a comet.")]],
  [["Telescope", "Telescope"], [variant("Galaxy", "🌌", "nature", "The telescopes reveal a galaxy."), variant("Lens", "🔎", "structure", "The telescopes resolve into one perfect lens."), variant("Constellation", "✨", "nature", "The telescopes trace a constellation.")]],
  [["Robot", "Robot"], [variant("Automation", "🤖", "structure", "The robots synchronize into automation."), variant("Technology", "💻", "structure", "The robots advance into technology."), variant("Android", "🤖", "structure", "The robots refine into an android.")]],
  [["Dream", "Dream"], [variant("Nightmare", "🌑", "force", "The dreams darken into a nightmare."), variant("Daydream", "💭", "force", "The dreams drift into a daydream."), variant("Ambition", "🌱", "nature", "The dreams take root as ambition.")]],
  [["Moon", "Moon"], [variant("Eclipse", "🌑", "nature", "The moons overlap into an eclipse."), variant("Night", "🌙", "nature", "The doubled moon deepens the night."), variant("Tide", "🌊", "nature", "The moons pull together into a tide.")]],
  [["Gravity", "Gravity"], [variant("Space", "🌌", "nature", "Gravity bends open a pocket of space."), variant("Galaxy", "🌌", "nature", "Gravity gathers matter into a galaxy."), variant("Universe", "🌌", "nature", "Gravity curves an entire universe.")]]
];

function pairKey(a, b) {
  return [a, b].map((word) => String(word || "").trim().toLowerCase()).sort().join("+");
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const catalog = new Map(entries.map(([pair, variants]) => [pairKey(...pair), Object.freeze(variants)]));

export function cosmicTwistOptions(a, b) {
  return (catalog.get(pairKey(a, b)) || []).map((item) => ({ ...item }));
}

export function cosmicTwistWords() {
  const words = new Map();
  for (const variants of catalog.values()) {
    for (const item of variants) if (!words.has(item.word.toLowerCase())) words.set(item.word.toLowerCase(), { ...item });
  }
  return [...words.values()];
}

export function cosmicTwistPairs() {
  return entries.map(([pair, variants]) => ({
    a: pair[0],
    b: pair[1],
    variants: variants.map((item) => ({ ...item }))
  }));
}

export function cosmicTwistSeedFor(game = {}) {
  return `${String(game.mode || "reach").toLowerCase()}:${Math.abs(Number(game.seed) || 0)}:${String(game.target || "").trim().toLowerCase()}`;
}

export function selectCosmicTwist({ a, b, canonicalResult, target = "", mode = "reach", seed = "", moveNumber = 1, twistUsed = false, discovered = [], roll } = {}) {
  if (!COSMIC_TWIST_MODES.includes(String(mode).toLowerCase()) || twistUsed || Number(moveNumber) <= COSMIC_TWIST_GRACE_MOVES) return null;
  const canonicalWord = String(canonicalResult?.word || "").trim();
  if (!canonicalWord || canonicalWord.toLowerCase() === String(target).trim().toLowerCase()) return null;

  const blocked = new Set([a, b, canonicalWord, target].map((word) => String(word || "").trim().toLowerCase()).filter(Boolean));
  for (const value of discovered || []) {
    const word = typeof value === "string" ? value : value?.word;
    if (word) blocked.add(String(word).trim().toLowerCase());
  }
  const options = cosmicTwistOptions(a, b).filter((item) => !blocked.has(item.word.toLowerCase()));
  if (!options.length) return null;

  const fingerprint = `${seed}|${moveNumber}|${pairKey(a, b)}`;
  const chance = Number.isFinite(Number(roll)) ? Number(roll) : stableHash(`roll|${fingerprint}`) / 0x1_0000_0000;
  if (chance < 0 || chance >= COSMIC_TWIST_CHANCE) return null;
  const selected = options[stableHash(`pick|${fingerprint}`) % options.length];
  return {
    ...selected,
    source: "twist",
    twisted: true,
    twist: {
      label: "COSMIC TWIST",
      canonicalWord,
      canonicalEmoji: canonicalResult.emoji || "✨"
    }
  };
}

export function cosmicTwistPairKey(a, b) {
  return pairKey(a, b);
}
