import { createServer } from "node:http";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { ANALYTICS_EVENT_NAMES, CREATIVE_COMMERCE_CATALOG, GameStore, MARKET_CATALOG, RunRegistry, isoWeekKey, serviceError } from "./game-services.mjs";
import { cosmicTwistSeedFor, selectCosmicTwist } from "./public/cosmic-twists.mjs";
import { assistancePolicy, rankSenseCandidates, selectRouteNavigationTip, selectWordGift } from "./public/engagement-features.mjs";
import { recipeFingerprint, sanitizeRecipeRating } from "./public/recipe-feedback.mjs";
import { annotateUniverseResult, buildUniverseManifest, selectUniverse, validateUniverseRoute } from "./public/universe-director.mjs";
import { AiRequestGate, MemoryRateLimiter, safeConcept, safeDiscoveryContext, trustedWriteOrigin } from "./server-safety.mjs";
import { EXPANDED_RECIPES } from "./content/expanded-recipes.mjs";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const root = join(projectRoot, "public");
const websiteRoot = join(projectRoot, "Website");
const port = Number(process.env.PORT || 4173);
const isMainModule = Boolean(process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1]));
const constelloreStorePath = join(projectRoot, "data", "constellore.json");
const legacyStorePath = join(projectRoot, "data", "wordforge.json");
const localStorePath = existsSync(constelloreStorePath) || !existsSync(legacyStorePath) ? constelloreStorePath : legacyStorePath;
const storePath = process.env.CONSTELLORE_DATA_PATH || process.env.WORDFORGE_DATA_PATH || (isMainModule ? localStorePath : ":memory:");
const packageMetadata = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
const gameStore = await new GameStore(storePath).init();
const runRegistry = new RunRegistry(gameStore);
await runRegistry.flush();
const backupDirectory = storePath === ":memory:" ? "" : (process.env.CONSTELLORE_BACKUP_DIR || join(dirname(storePath), "backups"));
const backupRetention = Math.min(30, Math.max(1, Number(process.env.CONSTELLORE_BACKUP_KEEP) || 7));
const APP_VERSION = process.env.CONSTELLORE_VERSION || packageMetadata.version || "3.0.0-beta.2";
const BUILD_VERSION = process.env.CONSTELLORE_BUILD_VERSION || process.env.GIT_COMMIT || process.env.RENDER_GIT_COMMIT || "local-dev";
const GRAPH_VERSION = process.env.CONSTELLORE_GRAPH_VERSION || `world-${APP_VERSION}`;
const RANKED_RULES_VERSION = "ranked-v3";
const STARTERS = ["Earth", "Water", "Fire", "Air"];
const recipes = new Map();
const dynamicRecipes = new Map();
let authoredSolutionPlansCache = null;
export const DYNAMIC_RECIPE_LIMIT = 256;
const AI_COMBINATION_PROMPT_VERSION = "combine-v3-family-safe-1";
const AI_ROUTE_PROMPT_VERSION = "route-v3-family-safe-1";
const aiRequestGate = new AiRequestGate({
  maximumConcurrent: Math.min(8, Math.max(1, Number(process.env.CONSTELLORE_AI_MAX_CONCURRENT) || 3)),
  dailyLimit: Math.min(10_000, Math.max(1, Number(process.env.CONSTELLORE_AI_DAILY_LIMIT) || 500))
});

const add = (a, b, word, emoji, note) => {
  const key = keyFor(a, b);
  const existing = recipes.get(key);
  if (existing) {
    if (existing.word.toLowerCase() !== String(word).trim().toLowerCase()) {
      throw new Error(`Conflicting authored recipe for ${a} + ${b}: ${existing.word} / ${word}`);
    }
    return existing;
  }
  const recipe = { a, b, word, emoji, note, source: "world" };
  recipes.set(key, recipe);
  authoredSolutionPlansCache = null;
  return recipe;
};

add("Earth", "Water", "Mud", "🟤", "Water softens earth into mud.");
add("Fire", "Water", "Steam", "♨️", "Heat lifts water into steam.");
add("Air", "Water", "Mist", "🌫️", "Water suspended in air becomes mist.");
add("Air", "Earth", "Dust", "💨", "Air carries fine pieces of earth.");
add("Earth", "Fire", "Lava", "🌋", "Earth melts under fierce heat.");
add("Air", "Fire", "Energy", "⚡", "Fire fed by air releases energy.");
add("Mud", "Fire", "Brick", "🧱", "Fired mud becomes a brick.");
add("Lava", "Water", "Stone", "🪨", "Water cools lava into stone.");
add("Air", "Steam", "Cloud", "☁️", "Steam gathers in the cool air.");
add("Cloud", "Water", "Rain", "🌧️", "A water-heavy cloud releases rain.");
add("Air", "Energy", "Light", "✨", "Energy racing through air becomes light.");
add("Light", "Rain", "Rainbow", "🌈", "Rain splits light into a rainbow.");
add("Dust", "Water", "Clay", "🏺", "Fine dust and water form clay.");
add("Clay", "Fire", "Pottery", "🏺", "Fire hardens shaped clay.");
add("Earth", "Energy", "Life", "🌱", "Energy awakens life in the earth.");
add("Earth", "Life", "Plant", "🌿", "Life takes root in the earth.");
add("Plant", "Water", "Tree", "🌳", "A well-watered plant grows tall.");
add("Tree", "Tree", "Forest", "🌲", "Trees together become a forest.");
add("Air", "Life", "Bird", "🐦", "Life takes to the air.");
add("Bird", "Fire", "Phoenix", "🔥", "A legendary bird reborn in flame.");
add("Fire", "Tree", "Ash", "◻️", "Fire leaves a tree as ash.");
add("Forest", "Rain", "Jungle", "🦜", "Abundant rain thickens a forest.");
add("Earth", "Rain", "Field", "🌾", "Rain makes the earth ready to grow.");
add("Field", "Plant", "Garden", "🪴", "Cultivated plants fill a field.");
add("Mud", "Plant", "Swamp", "🐊", "Plants thrive in waterlogged mud.");
add("Stone", "Stone", "Mountain", "⛰️", "Stone piled across ages forms a mountain.");
add("Cloud", "Mountain", "Snow", "❄️", "Cold mountain clouds release snow.");
add("Snow", "Water", "Ice", "🧊", "Snow compressed with water freezes solid.");
add("Air", "Stone", "Sand", "🏖️", "Wind slowly wears stone into sand.");
add("Fire", "Sand", "Glass", "🔎", "Intense heat melts sand into glass.");
add("Air", "Light", "Sky", "🌌", "Light scattered through air reveals the sky.");
add("Light", "Sky", "Star", "⭐", "A point of light in the sky is a star.");
add("Glass", "Sky", "Telescope", "🔭", "Glass aimed at the sky becomes a telescope.");
add("Brick", "Brick", "Wall", "🧱", "Bricks joined together make a wall.");
add("Wall", "Wall", "House", "🏠", "Walls enclosing space create a house.");
add("House", "House", "Village", "🏘️", "A cluster of houses becomes a village.");
add("Village", "Village", "City", "🏙️", "Villages growing together become a city.");
add("Fire", "Stone", "Metal", "🔩", "Heat releases metal from stone.");
add("Energy", "Metal", "Machine", "⚙️", "Energy drives shaped metal.");
add("Machine", "Sky", "Rocket", "🚀", "A machine built to cross the sky.");
add("House", "Rocket", "Space Station", "🛰️", "A home carried by a rocket becomes an orbital station.");
add("Life", "Water", "Fish", "🐟", "Life adapted to water becomes a fish.");
add("Fish", "Fire", "Dinner", "🍽️", "Fire turns a catch into a meal.");
add("Cloud", "Energy", "Storm", "⛈️", "Charged clouds grow into a storm.");
add("Energy", "Storm", "Lightning", "🌩️", "A storm releases its energy as lightning.");
add("Glass", "Light", "Prism", "🔺", "Glass bends light into hidden colors.");
add("Cloud", "Rainbow", "Wonder", "🤩", "A rainbow in the clouds inspires wonder.");
add("Water", "Water", "Ocean", "🌊", "Water gathered without end becomes an ocean.");
add("Fire", "Fire", "Inferno", "🔥", "Fire feeding fire becomes an inferno.");
add("Air", "Air", "Wind", "🌬️", "Air moving against air becomes wind.");
add("Earth", "Earth", "Land", "🌍", "Earth joined with earth becomes land.");
add("Mist", "Mist", "Fog", "🌫️", "Layers of mist thicken into fog.");
add("Life", "Life", "Species", "🧬", "Life reproducing with life forms a species.");
add("Bird", "Bird", "Flock", "🦅", "Birds flying together form a flock.");
add("Forest", "Forest", "Jungle", "🌴", "Forests growing together become a jungle.");
add("Field", "Field", "Farm", "🚜", "Fields worked together become a farm.");
add("Garden", "Garden", "Park", "🏞️", "Gardens joined together form a park.");
add("Swamp", "Swamp", "Marsh", "🌾", "Wide stretches of swamp become marshland.");
add("Mountain", "Mountain", "Range", "🏔️", "Mountains together form a range.");
add("Ice", "Ice", "Glacier", "🧊", "Masses of ice become a glacier.");
add("Glass", "Glass", "Mirror", "🪞", "Layered glass polished together becomes a mirror.");
add("Telescope", "Telescope", "Observatory", "🔭", "Telescopes gathered together create an observatory.");
add("Mist", "Rain", "Fog", "🌫️", "Rain suspended in mist becomes fog.");
add("Machine", "Mud", "Excavator", "🚜", "A machine made to move mud is an excavator.");
add("House", "Rain", "Shelter", "🏠", "A house protecting from rain becomes shelter.");
add("Lava", "Wall", "Obsidian", "🖤", "Lava cooling against a wall forms obsidian.");
add("Rocket", "Snow", "Comet", "☄️", "A bright rocket through snow resembles a comet.");
add("Metal", "Tree", "Axe", "🪓", "Metal shaped to cut a tree becomes an axe.");
add("Air", "Species", "Bird", "🐦", "A species adapted to air becomes a bird.");
add("Water", "Species", "Fish", "🐟", "A species adapted to water becomes a fish.");
add("Earth", "Species", "Animal", "🐾", "A species living on land becomes an animal.");
add("Fire", "Species", "Extinction", "🦴", "Fire overwhelming a species can cause extinction.");
add("Air", "Animal", "Bird", "🐦", "An animal adapted to air becomes a bird.");
add("Water", "Animal", "Fish", "🐟", "An animal adapted to water becomes a fish.");
add("Earth", "Animal", "Wildlife", "🦌", "Animals living across the earth become wildlife.");
add("Fire", "Animal", "Dragon", "🐉", "An animal joined with fire becomes a dragon.");

// Popular Wish concepts have explicit elemental anchors so the premium power
// feels authored and dependable even when the live AI engine is unavailable.
add("Moon", "Water", "Tide", "🌊", "The moon pulls the water into a tide.");
add("Earth", "Moon", "Moonstone", "💎", "Earthly mineral and moonlight evoke moonstone.");
add("Fire", "Moon", "Eclipse", "🌑", "A dark moon crossing firelight creates an eclipse.");
add("Air", "Moon", "Night", "🌙", "The moon in open air marks the night.");
add("Moon", "Moon", "Full Moon", "🌕", "Two lunar halves complete a full moon.");
add("Fire", "Magic", "Fireball", "☄️", "Magic shapes fire into a fireball.");
add("Magic", "Water", "Potion", "🧪", "Magic infused into water becomes a potion.");
add("Earth", "Magic", "Golem", "🗿", "Magic awakens earth as a golem.");
add("Air", "Magic", "Spell", "✨", "Magic carried through air becomes a spell.");
add("Earth", "Time", "History", "📜", "Earth records the passage of time as history.");
add("Time", "Water", "Erosion", "🏞️", "Water working through time causes erosion.");
add("Fire", "Time", "Future", "🔮", "Firelight cast through time suggests the future.");
add("Air", "Time", "Moment", "⌛", "A breath of air lasts only a moment.");
add("Earth", "Love", "Family", "👪", "Love rooted in a shared place becomes family.");
add("Love", "Water", "Tears", "💧", "Love can overflow as tears.");
add("Fire", "Love", "Passion", "❤️‍🔥", "Love set alight becomes passion.");
add("Air", "Love", "Kiss", "💋", "Love carried on a breath becomes a kiss.");
add("Air", "Music", "Sound", "🔊", "Music travels through air as sound.");
add("Music", "Water", "Rhythm", "🎵", "Flowing water gives music a rhythm.");
add("Fire", "Music", "Concert", "🎤", "Music with fiery energy becomes a concert.");
add("Earth", "Music", "Folk Music", "🪕", "Music rooted in a land becomes folk music.");
add("Earth", "Human", "Civilization", "🏛️", "Humans shaping the earth build civilization.");
add("Human", "Water", "Sailor", "⛵", "A human living by water becomes a sailor.");
add("Fire", "Human", "Cook", "🧑‍🍳", "A human mastering fire becomes a cook.");
add("Air", "Human", "Pilot", "✈️", "A human who masters the air becomes a pilot.");
add("Computer", "Water", "Cooling", "🧊", "Water carries heat away as cooling.");
add("Air", "Computer", "Cloud Computing", "☁️", "A computer connected through the air reaches the cloud.");
add("Computer", "Earth", "Hardware", "🖥️", "A computer made physical is hardware.");
add("Computer", "Fire", "Overclocking", "⚡", "A computer pushed with heat becomes overclocked.");

add("Air", "Robot", "Drone", "\u{1F6F8}", "A robot built for the air becomes a drone.");
add("Robot", "Water", "Submersible", "\u{1F93F}", "A water-ready robot becomes a submersible.");
add("Earth", "Robot", "Rover", "\u{1F699}", "A robot exploring the earth becomes a rover.");
add("Fire", "Robot", "Forge Bot", "\u{1F916}", "A heatproof robot working with fire becomes a forge bot.");
add("Robot", "Robot", "Factory", "\u{1F3ED}", "Robots working together form an automated factory.");
add("Air", "Sword", "Windblade", "\u{1F5E1}\u{FE0F}", "A sword moving through air becomes a windblade.");
add("Sword", "Water", "Rust", "\u{1F7E0}", "Water left on a sword creates rust.");
add("Earth", "Sword", "Excalibur", "\u{2694}\u{FE0F}", "A legendary sword drawn from the earth evokes Excalibur.");
add("Fire", "Sword", "Flaming Sword", "\u{1F525}", "Fire wreathes a sword in flame.");
add("Sword", "Sword", "Duel", "\u{2694}\u{FE0F}", "Two swords meeting create a duel.");
add("Air", "Dream", "Daydream", "\u{1F4AD}", "A drifting dream becomes a daydream.");
add("Dream", "Water", "Reflection", "\u{1FA9E}", "A dream mirrored in water becomes a reflection.");
add("Earth", "Dream", "Ambition", "\u{1F331}", "A dream grounded in reality becomes ambition.");
add("Dream", "Fire", "Nightmare", "\u{1F311}", "A dream set ablaze with fear becomes a nightmare.");
add("Dream", "Dream", "Lucid Dream", "\u{1F319}", "Dreams folding into dreams become lucid.");
add("Air", "Gravity", "Atmosphere", "\u{1F30C}", "Gravity holds air around a world as an atmosphere.");
add("Gravity", "Water", "Tide", "\u{1F30A}", "Gravity pulls great bodies of water into tides.");
add("Earth", "Gravity", "Weight", "\u{2696}\u{FE0F}", "Gravity pulling on matter gives it weight.");
add("Fire", "Gravity", "Star", "\u{2B50}", "Gravity compresses fiery matter into a star.");
add("Gravity", "Gravity", "Black Hole", "\u{26AB}", "Overwhelming gravity collapses into a black hole.");

// A wider semantic web keeps experimentation rewarding without inventing
// concatenated filler when the live AI engine is unavailable.
add("Air", "Cloud", "Weather", "🌤️", "Clouds moving through air create weather.");
add("Cloud", "Cloud", "Storm", "⛈️", "Clouds gathering together build a storm.");
add("Cloud", "Fire", "Smoke", "💨", "Fire-darkened clouds become smoke.");
add("Cloud", "Mountain", "Snow", "❄️", "Mountain clouds freeze into snow.");
add("Air", "Rain", "Storm", "⛈️", "Wind drives rain into a storm.");
add("Fire", "Rain", "Steam", "♨️", "Rain flashes into steam over fire.");
add("Rain", "Rain", "Flood", "🌊", "Relentless rain becomes a flood.");
add("Fire", "Dust", "Smoke", "💨", "Hot dust rises as smoke.");
add("Dust", "Dust", "Sand", "🏖️", "Dust gathers into grains of sand.");
add("Air", "Mud", "Dust", "💨", "Air dries mud back into dust.");
add("Earth", "Mud", "Clay", "🏺", "Earth thickens mud into clay.");
add("Mud", "Mud", "Quagmire", "🟫", "Deep layers of mud form a quagmire.");
add("Steam", "Steam", "Cloud", "☁️", "Steam gathers into a cloud.");
add("Earth", "Steam", "Geyser", "♨️", "Steam escapes from beneath the earth.");
add("Fire", "Steam", "Engine", "⚙️", "Pressurized steam drives an engine.");
add("Air", "Lava", "Stone", "🪨", "Cool air hardens lava into stone.");
add("Lava", "Lava", "Volcano", "🌋", "A mass of lava builds a volcano.");
add("Energy", "Energy", "Power", "🔋", "Concentrated energy becomes power.");
add("Energy", "Water", "Hydrogen", "⚗️", "Energy separates hydrogen from water.");
add("Brick", "Water", "Dam", "🌊", "Brick holds back water as a dam.");
add("Brick", "Fire", "Kiln", "🏺", "A brick chamber for fire becomes a kiln.");
add("Stone", "Water", "Pebble", "🪨", "Water smooths stone into a pebble.");
add("Fire", "Light", "Sun", "☀️", "A great fire in the light becomes the sun.");
add("Light", "Water", "Reflection", "🪞", "Light bounces from the surface of water.");
add("Earth", "Light", "Shadow", "🌑", "Earth blocks light and casts a shadow.");
add("Light", "Light", "Laser", "🔦", "Focused light becomes a laser.");
add("Clay", "Clay", "Sculpture", "🗿", "Clay shaped together becomes a sculpture.");
add("Clay", "Water", "Mud", "🟤", "Water loosens clay into mud.");
add("Pottery", "Water", "Vase", "🏺", "Pottery made to hold water becomes a vase.");
add("Fire", "Plant", "Ash", "◻️", "Fire reduces a plant to ash.");
add("Air", "Plant", "Seed", "🌱", "Air carries a plant's seed away.");
add("Light", "Plant", "Flower", "🌸", "A plant opens toward the light.");
add("Plant", "Plant", "Garden", "🪴", "Many plants together form a garden.");
add("Air", "Tree", "Leaf", "🍃", "Air catches a leaf from a tree.");
add("Earth", "Tree", "Root", "🌱", "A tree anchors itself in earth with roots.");
add("Fire", "Forest", "Wildfire", "🔥", "Fire racing through a forest becomes wildfire.");
add("Forest", "Water", "Rainforest", "🌴", "Abundant water transforms a forest into rainforest.");
add("Air", "Forest", "Ecosystem", "🦋", "Air and forest sustain an ecosystem.");
add("Garden", "Water", "Pond", "🪷", "Water gathered in a garden becomes a pond.");
add("Fire", "Mountain", "Volcano", "🌋", "Fire within a mountain creates a volcano.");
add("Mountain", "Water", "River", "🏞️", "Water descending a mountain becomes a river.");
add("Air", "Snow", "Blizzard", "🌨️", "Wind drives snow into a blizzard.");
add("Fire", "Snow", "Water", "💧", "Fire melts snow into water.");
add("Snow", "Snow", "Glacier", "🏔️", "Layers of snow compress into a glacier.");
add("Fire", "Ice", "Water", "💧", "Fire melts ice into water.");
add("Air", "Ice", "Snow", "❄️", "Frozen moisture in air becomes snow.");
add("Ice", "Water", "Iceberg", "🧊", "Ice floating in water forms an iceberg.");
add("Air", "Sand", "Dune", "🏜️", "Wind shapes sand into a dune.");
add("Sand", "Water", "Beach", "🏖️", "Sand meeting water becomes a beach.");
add("Sand", "Sand", "Desert", "🏜️", "An ocean of sand becomes a desert.");
add("Glass", "Water", "Aquarium", "🐠", "Glass holds water as an aquarium.");
add("Fire", "Glass", "Lens", "🔍", "Heat shapes glass into a lens.");
add("Earth", "Sky", "Horizon", "🌅", "Earth and sky meet at the horizon.");
add("Fire", "Sky", "Sun", "☀️", "Fire blazing in the sky becomes the sun.");
add("Sky", "Water", "Rain", "🌧️", "Water falling from the sky becomes rain.");
add("Sky", "Sky", "Space", "🌌", "Beyond the sky waits space.");
add("Star", "Star", "Galaxy", "🌌", "Countless stars gather into a galaxy.");
add("Sky", "Star", "Constellation", "✨", "Stars arranged across the sky form a constellation.");
add("Earth", "Star", "Meteor", "☄️", "A star falling toward earth becomes a meteor.");
add("Star", "Water", "Starfish", "⭐", "A star shape living in water is a starfish.");
add("Star", "Telescope", "Astronomy", "🔭", "A telescope trained on stars enables astronomy.");
add("Sky", "Telescope", "Observatory", "🔭", "A telescope devoted to the sky belongs in an observatory.");
add("Air", "Wall", "Window", "🪟", "An opening in a wall lets air through.");
add("Fire", "Wall", "Firewall", "🛡️", "A wall built against fire becomes a firewall.");
add("Earth", "Wall", "Fortress", "🏰", "Heavy walls rooted in earth form a fortress.");
add("Fire", "House", "Fireplace", "🔥", "Fire contained in a house becomes a fireplace.");
add("House", "Water", "Houseboat", "🛥️", "A house made for water becomes a houseboat.");
add("Air", "House", "Balloon", "🎈", "A light house lifted by air suggests a balloon.");
add("Earth", "House", "Home", "🏡", "A house rooted in a place becomes a home.");
add("Village", "Water", "Port", "⚓", "A village beside water grows into a port.");
add("Air", "City", "Smog", "🌫️", "City emissions trapped in air create smog.");
add("City", "Water", "Canal", "🚤", "Water crossing a city becomes a canal.");
add("City", "City", "Megacity", "🌆", "Cities merging together form a megacity.");
add("Air", "Metal", "Rust", "🟠", "Air slowly oxidizes metal into rust.");
add("Metal", "Water", "Rust", "🟠", "Water accelerates rust on metal.");
add("Fire", "Metal", "Steel", "🔩", "Fire tempers metal into steel.");
add("Metal", "Metal", "Alloy", "⚙️", "Metals blended together form an alloy.");
add("Air", "Machine", "Plane", "✈️", "A machine designed for air becomes a plane.");
add("Fire", "Machine", "Engine", "⚙️", "Fire powering a machine creates an engine.");
add("Machine", "Machine", "Factory", "🏭", "Many machines working together form a factory.");
add("Air", "Rocket", "Jet", "✈️", "A rocket adapted to air resembles a jet.");
add("Energy", "Rocket", "Spacecraft", "🚀", "Energy carries a rocket into space.");
add("Rocket", "Rocket", "Fleet", "🚀", "A group of rockets becomes a fleet.");
add("Air", "Fish", "Flying Fish", "🐟", "A fish that takes to air becomes a flying fish.");
add("Earth", "Fish", "Fossil", "🦴", "A fish buried in earth becomes a fossil.");
add("Fish", "Fish", "School", "🐟", "Fish swimming together form a school.");
add("Dinner", "Fire", "Barbecue", "🍖", "Dinner cooked over fire becomes a barbecue.");
add("Storm", "Water", "Hurricane", "🌀", "A storm fed by warm water becomes a hurricane.");
add("Air", "Storm", "Tornado", "🌪️", "Rotating air inside a storm forms a tornado.");
add("Fire", "Storm", "Firestorm", "🔥", "A storm of flame becomes a firestorm.");
add("Storm", "Storm", "Superstorm", "🌀", "Storms joining together create a superstorm.");
add("Lightning", "Sand", "Glass", "🔎", "Lightning can fuse sand into glass.");
add("Lightning", "Metal", "Electricity", "⚡", "Metal carries lightning as electricity.");
add("Light", "Prism", "Spectrum", "🌈", "A prism separates light into a spectrum.");
add("Rainbow", "Rainbow", "Color", "🎨", "Rainbows together become pure color.");

add("Earth", "Great Wall", "Landmark", "\u{1F5FF}", "The Great Wall rooted across the earth becomes a landmark.");

// Exchange licenses are permanent, so each catalog addition gets a dependable
// authored neighborhood instead of relying on a generic semantic fallback.
const marketAnchors = [
  ["Sun", [
    ["Earth", "Day", "🌅", "Earth turning beneath the sun creates day."],
    ["Water", "Evaporation", "💨", "The sun warms water into evaporation."],
    ["Fire", "Solar Flare", "☀️", "Fire erupting from the sun becomes a solar flare."],
    ["Air", "Daylight", "🌤️", "Air scatters sunlight into daylight."],
    ["Sun", "Binary Star", "🌟", "Two suns orbiting together form a binary star."]
  ]],
  ["Space", [
    ["Earth", "Planet", "🪐", "Earth suspended in space is a planet."],
    ["Water", "Comet", "☄️", "Frozen water traveling through space becomes a comet."],
    ["Fire", "Star", "⭐", "A vast fire burning in space is a star."],
    ["Air", "Vacuum", "⚫", "Air dispersing into space leaves a vacuum."],
    ["Space", "Universe", "🌌", "Space extending into space becomes the universe."]
  ]],
  ["Planet", [
    ["Earth", "World", "🌍", "Earth spread across a planet forms a world."],
    ["Water", "Ocean World", "🌊", "A water-covered planet becomes an ocean world."],
    ["Fire", "Volcanic Planet", "🌋", "A planet shaped by fire becomes volcanic."],
    ["Air", "Atmosphere", "🌌", "Air held around a planet forms an atmosphere."],
    ["Planet", "Solar System", "☀️", "Planets gathered together form a solar system."]
  ]],
  ["Storm", [
    ["Earth", "Dust Storm", "🌪️", "A storm sweeping over dry earth becomes a dust storm."],
    ["Water", "Hurricane", "🌀", "A storm fed by warm water becomes a hurricane."],
    ["Fire", "Firestorm", "🔥", "A storm filled with fire becomes a firestorm."],
    ["Air", "Tornado", "🌪️", "Rotating air inside a storm forms a tornado."],
    ["Storm", "Superstorm", "🌀", "Storms joining together create a superstorm."]
  ]],
  ["Metal", [
    ["Earth", "Ore", "⛏️", "Metal embedded in earth is ore."],
    ["Water", "Rust", "🟠", "Water oxidizes exposed metal into rust."],
    ["Fire", "Steel", "🔩", "Fire tempers metal into steel."],
    ["Air", "Rust", "🟠", "Air slowly oxidizes exposed metal into rust."],
    ["Metal", "Alloy", "⚙️", "Metals blended together form an alloy."]
  ]],
  ["Electricity", [
    ["Earth", "Grounding", "🔌", "Earth safely grounds electricity."],
    ["Water", "Electric Shock", "⚡", "Electricity conducted through water creates a shock."],
    ["Fire", "Plasma", "☀️", "Electricity heating fire creates plasma."],
    ["Air", "Lightning", "🌩️", "Electricity discharging through air becomes lightning."],
    ["Electricity", "High Voltage", "⚡", "Electricity concentrated together creates high voltage."]
  ]],
  ["Animal", [
    ["Earth", "Wildlife", "🦌", "Animals living across the earth become wildlife."],
    ["Water", "Fish", "🐟", "An animal adapted to water becomes a fish."],
    ["Fire", "Dragon", "🐉", "An animal joined with fire becomes a dragon."],
    ["Air", "Bird", "🐦", "An animal adapted to air becomes a bird."],
    ["Animal", "Species", "🧬", "Animals reproducing together form a species."]
  ]],
  ["Dragon", [
    ["Earth", "Dragon Lair", "🕳️", "A dragon dwelling in earth makes a lair."],
    ["Water", "Sea Dragon", "🐉", "A dragon adapted to water becomes a sea dragon."],
    ["Fire", "Fire Dragon", "🐲", "A dragon empowered by fire becomes a fire dragon."],
    ["Air", "Flying Dragon", "🐉", "A dragon mastering the air takes flight."],
    ["Dragon", "Dragon Brood", "🥚", "Dragons gathered together form a brood."]
  ]],
  ["Flower", [
    ["Earth", "Garden", "🪴", "Flowers planted in earth form a garden."],
    ["Water", "Water Lily", "🪷", "A flower growing on water becomes a water lily."],
    ["Fire", "Fireweed", "🌺", "A flower returning after fire is fireweed."],
    ["Air", "Pollen", "🌼", "Air carries pollen from a flower."],
    ["Flower", "Bouquet", "💐", "Flowers gathered together form a bouquet."]
  ]],
  ["Cat", [
    ["Earth", "Wildcat", "🐈", "A cat living untamed on earth becomes a wildcat."],
    ["Water", "Fishing Cat", "🐈", "A cat adapted to wetlands becomes a fishing cat."],
    ["Fire", "Lion", "🦁", "A cat crowned with a fiery mane evokes a lion."],
    ["Air", "Meow", "🐱", "Air carries a cat's voice as a meow."],
    ["Cat", "Litter", "🐈", "Cats raising young together form a litter."]
  ]],
  ["Dog", [
    ["Earth", "Burrow", "🕳️", "A dog digging through earth makes a burrow."],
    ["Water", "Retriever", "🐕", "A dog trained to fetch from water becomes a retriever."],
    ["Fire", "Hot Dog", "🌭", "Fire and dog meet in a familiar piece of wordplay."],
    ["Air", "Bark", "🐕", "Air carries a dog's bark."],
    ["Dog", "Pack", "🐕", "Dogs gathering together form a pack."]
  ]],
  ["Insect", [
    ["Earth", "Ant", "🐜", "An insect building through earth becomes an ant."],
    ["Water", "Water Strider", "🪲", "An insect walking on water is a water strider."],
    ["Fire", "Firefly", "✨", "An insect glowing like fire becomes a firefly."],
    ["Air", "Butterfly", "🦋", "An insect transformed for the air becomes a butterfly."],
    ["Insect", "Swarm", "🐝", "Insects gathering together form a swarm."]
  ]],
  ["Book", [
    ["Earth", "Atlas", "🗺️", "A book describing the earth becomes an atlas."],
    ["Water", "Ink", "🖋️", "Water carrying pigment through a book becomes ink."],
    ["Fire", "Ashes", "◻️", "Fire consuming a book leaves ashes."],
    ["Air", "Open Book", "📖", "Moving air turns a book open."],
    ["Book", "Library", "📚", "Books gathered together form a library."]
  ]],
  ["Art", [
    ["Earth", "Sculpture", "🗿", "Art shaped from earth becomes sculpture."],
    ["Water", "Watercolor", "🎨", "Art painted with water becomes watercolor."],
    ["Fire", "Pyrography", "🔥", "Art drawn with fire becomes pyrography."],
    ["Air", "Kite", "🪁", "Art designed for the air becomes a kite."],
    ["Art", "Gallery", "🖼️", "Art gathered together fills a gallery."]
  ]],
  ["Science", [
    ["Earth", "Geology", "🪨", "Science studying earth becomes geology."],
    ["Water", "Hydrology", "💧", "Science studying water becomes hydrology."],
    ["Fire", "Thermodynamics", "🌡️", "Science studying heat becomes thermodynamics."],
    ["Air", "Aerodynamics", "💨", "Science studying air in motion becomes aerodynamics."],
    ["Science", "Research", "🔬", "Scientific inquiry repeated together becomes research."]
  ]],
  ["Technology", [
    ["Earth", "Infrastructure", "🏗️", "Technology rooted in earth becomes infrastructure."],
    ["Water", "Hydropower", "🌊", "Technology harnessing water creates hydropower."],
    ["Fire", "Engine", "⚙️", "Technology harnessing fire becomes an engine."],
    ["Air", "Aviation", "✈️", "Technology mastering air becomes aviation."],
    ["Technology", "Innovation", "💡", "Technologies building on each other create innovation."]
  ]],
  ["Money", [
    ["Earth", "Treasure", "💰", "Money hidden in earth becomes treasure."],
    ["Water", "Liquidity", "💧", "Money that flows freely has liquidity."],
    ["Fire", "Burn Rate", "🔥", "Money consumed over time becomes a burn rate."],
    ["Air", "Inflation", "📈", "Money expanding like air evokes inflation."],
    ["Money", "Wealth", "💰", "Money accumulated together becomes wealth."]
  ]],
  ["Food", [
    ["Earth", "Crop", "🌾", "Food grown from earth becomes a crop."],
    ["Water", "Soup", "🍲", "Food simmered in water becomes soup."],
    ["Fire", "Cooking", "🍳", "Fire transforms food through cooking."],
    ["Air", "Aroma", "👃", "Air carries the aroma of food."],
    ["Food", "Feast", "🍽️", "Food gathered in abundance becomes a feast."]
  ]],
  ["Vehicle", [
    ["Earth", "Car", "🚗", "A vehicle made for earth becomes a car."],
    ["Water", "Boat", "⛵", "A vehicle made for water becomes a boat."],
    ["Fire", "Engine", "⚙️", "Fire powering a vehicle becomes an engine."],
    ["Air", "Aircraft", "✈️", "A vehicle made for air becomes an aircraft."],
    ["Vehicle", "Traffic", "🚦", "Vehicles gathering together create traffic."]
  ]],
  ["Ship", [
    ["Earth", "Shipwreck", "⚓", "A ship stranded against earth becomes a shipwreck."],
    ["Water", "Sailing", "⛵", "A ship moving through water is sailing."],
    ["Fire", "Steamship", "🚢", "A ship powered by fire and steam becomes a steamship."],
    ["Air", "Airship", "🎈", "A ship adapted to air becomes an airship."],
    ["Ship", "Fleet", "🚢", "Ships traveling together form a fleet."]
  ]],
  ["Castle", [
    ["Earth", "Fortress", "🏰", "A castle rooted into earth becomes a fortress."],
    ["Water", "Moat", "🌊", "Water surrounding a castle forms a moat."],
    ["Fire", "Ruins", "🏚️", "Fire consuming a castle leaves ruins."],
    ["Air", "Tower", "🗼", "A castle reaching into the air becomes a tower."],
    ["Castle", "Kingdom", "👑", "Castles joined under one realm form a kingdom."]
  ]],
  ["Phone", [
    ["Earth", "Landline", "☎️", "A phone fixed to the earth becomes a landline."],
    ["Water", "Short Circuit", "⚡", "Water entering a phone causes a short circuit."],
    ["Fire", "Hotline", "☎️", "Fire and phone meet as a hotline."],
    ["Air", "Wireless", "📶", "A phone communicating through air becomes wireless."],
    ["Phone", "Call", "📞", "Two phones connected together make a call."]
  ]],
  ["Night", [
    ["Earth", "Midnight", "🌑", "Earth turning deep into night reaches midnight."],
    ["Water", "Bioluminescence", "✨", "Life glowing in dark water creates bioluminescence."],
    ["Fire", "Campfire", "🔥", "Fire kept through the night becomes a campfire."],
    ["Air", "Night Sky", "🌌", "Open air at night reveals the night sky."],
    ["Night", "Darkness", "⚫", "Night layered upon night becomes darkness."]
  ]],
  ["River", [
    ["Earth", "Valley", "🏞️", "A river cutting through earth forms a valley."],
    ["Water", "Flood", "🌊", "More water than a river can carry becomes a flood."],
    ["Fire", "Steam", "♨️", "Fire heating a river releases steam."],
    ["Air", "Mist", "🌫️", "Air lifting droplets from a river creates mist."],
    ["River", "Confluence", "🔀", "Rivers joining together form a confluence."]
  ]]
];

for (const [word, anchors] of marketAnchors) {
  for (const [other, result, emoji, note] of anchors) add(word, other, result, emoji, note);
}

// Hand-reviewed, dependency-ordered content broadens experimentation without
// making official play depend on generic semantic roulette. `add` rejects any
// pair that would silently redefine an earlier authored result.
for (const recipe of EXPANDED_RECIPES) {
  add(recipe.a, recipe.b, recipe.word, recipe.emoji, recipe.note);
}

const emojiByWord = { Earth: "🌍", Water: "💧", Fire: "🔥", Air: "💨" };

const officialTarget = (target, clue, tier) => ({ target, emoji: emojiForWord(target), clue, tier });

// Ranked destinations are authored, route-verified concepts rather than
// arbitrary outputs from the experimental semantic mixer. Each difficulty
// band contains enough destinations to keep daily and sprint play rotating.
const targetCatalog = [
  officialTarget("Mud", "Soften the ground with something that flows.", 1),
  officialTarget("Steam", "Let heat meet water.", 1),
  officialTarget("Brick", "Shape wet earth, then harden it with fire.", 1),
  officialTarget("Stone", "Cool something molten with water.", 1),
  officialTarget("Cloud", "Lift warm vapor into the air.", 1),
  officialTarget("Life", "Wake the earth with energy.", 1),
  officialTarget("Light", "Send energy racing through the air.", 1),
  officialTarget("Volcano", "Gather lava until it builds a mountain of fire.", 1),

  officialTarget("Rain", "Fill a cloud with more water.", 2),
  officialTarget("Mountain", "Pile stone upon stone.", 2),
  officialTarget("Plant", "Give life somewhere to take root.", 2),
  officialTarget("Bird", "Let life adapt to the air.", 2),
  officialTarget("Storm", "Charge a cloud with energy.", 2),
  officialTarget("Phoenix", "A legendary creature where wings meet flame.", 2),
  officialTarget("Glass", "Transform sand with fierce heat.", 2),
  officialTarget("House", "Enclose space with walls.", 2),
  officialTarget("Garden", "Cultivate plants across a fertile field.", 2),
  officialTarget("River", "Send water down from a mountain.", 2),
  officialTarget("Hurricane", "Feed a storm with a vast body of water.", 2),

  officialTarget("Forest", "One tree becomes many, rooted together.", 3),
  officialTarget("Rainbow", "Color is born where rain meets light.", 3),
  officialTarget("Lightning", "Release energy from a violent storm.", 3),
  officialTarget("Galaxy", "Gather stars on a cosmic scale.", 3),
  officialTarget("Telescope", "Shape sand with heat, then look upward.", 3),
  officialTarget("City", "Build outward: material, shelter, settlement.", 3),
  officialTarget("Ecosystem", "Sustain a forest with the air around it.", 3),
  officialTarget("Jungle", "Give a forest abundant rain.", 3),
  officialTarget("Solar System", "Gather planets into one stellar family.", 3),
  officialTarget("Universe", "Let space extend into itself without end.", 3),
  officialTarget("Comet", "Send frozen water traveling through space.", 3),

  officialTarget("Iceberg", "Set ice afloat in water.", 4),
  officialTarget("Observatory", "Bring telescopes together to study the sky.", 4),
  officialTarget("Rocket", "Build a machine made to leave the sky behind.", 4),
  officialTarget("Electricity", "Let metal carry lightning.", 4),
  officialTarget("Spacecraft", "Power a rocket beyond the sky.", 4),
  officialTarget("Astronomy", "Study a star through a telescope.", 4),

  officialTarget("Plasma", "Drive electricity through intense fire.", 5),
  officialTarget("High Voltage", "Concentrate electricity upon itself.", 5),
  officialTarget("Electric Shock", "Let electricity find a path through water.", 5),
  officialTarget("Space Station", "Build a home, build a rocket, then leave Earth.", 5)
];

// A full non-repeating month of medium-to-expert destinations. Tier-one
// concepts remain onboarding/sprint material rather than Daily repeats.
const dailyTargets = targetCatalog.filter((entry) => entry.tier >= 2);

export function officialTargetCatalog() {
  return targetCatalog.map((entry) => ({ ...entry }));
}

const cosmicLaws = [
  { id: "first-light", name: "First Light", description: "Your first new discovery earns double Stardust." },
  { id: "twin-stars", name: "Twin Stars", description: "Combining identical ideas earns a bonus." },
  { id: "deep-space", name: "Deep Space", description: "Finish with eight or fewer moves for a bonus." },
  { id: "bright-path", name: "Bright Path", description: "Every new discovery strengthens this run's reward." }
];

const weeklyTargets = [
  ["Forest", "Telescope", "Rocket"],
  ["Rainbow", "Lightning", "City"],
  ["Phoenix", "Garden", "Spacecraft"],
  ["Volcano", "Ecosystem", "Space Station"],
  ["Storm", "Iceberg", "Comet"],
  ["Glass", "Observatory", "Solar System"],
  ["House", "Hurricane", "Astronomy"],
  ["Mountain", "Galaxy", "Electric Shock"]
];

const semanticGroups = {
  force: new Set(["air", "water", "fire", "steam", "energy", "light", "power", "storm", "lightning", "electricity", "laser", "wildfire", "firestorm", "hurricane", "tornado", "weather", "smoke", "hydrogen", "sun", "reflection", "blizzard", "superstorm", "spectrum", "magic", "time", "love", "music", "dream"]),
  nature: new Set(["earth", "mud", "mist", "dust", "lava", "stone", "cloud", "rain", "clay", "mountain", "snow", "ice", "sand", "sky", "star", "flood", "geyser", "pebble", "shadow", "glacier", "iceberg", "dune", "beach", "desert", "horizon", "space", "galaxy", "constellation", "meteor", "river", "smog", "canal", "phenomenon", "habitat", "rainbow", "ash", "field", "swamp", "quagmire", "volcano", "pond", "fossil", "color", "moon", "planet", "universe", "world"]),
  life: new Set(["life", "species", "animal", "plant", "tree", "forest", "bird", "fish", "flower", "seed", "leaf", "root", "rainforest", "ecosystem", "flying fish", "school", "evolution", "phoenix", "jungle", "garden", "starfish", "wildlife", "dragon", "extinction", "human"]),
  structure: new Set(["brick", "pottery", "glass", "telescope", "wall", "house", "village", "city", "metal", "machine", "rocket", "space station", "dam", "kiln", "vase", "sculpture", "aquarium", "lens", "observatory", "firewall", "fortress", "fireplace", "houseboat", "home", "port", "megacity", "steel", "alloy", "plane", "engine", "factory", "jet", "spacecraft", "fleet", "technology", "civilization", "landmark", "infrastructure", "prism", "window", "balloon", "rust", "barbecue", "computer", "sword", "robot"])
};

for (const word of ["fusion", "erosion", "thunder"]) semanticGroups.force.add(word);
for (const word of ["family", "nest"]) semanticGroups.life.add(word);
semanticGroups.structure.add("obsidian");

for (const item of MARKET_CATALOG) semanticGroups[item.category]?.add(item.word.toLowerCase());

// Ingredient-category inference is deliberately broad, so a small number of
// authored results need an explicit semantic identity. Keep these overrides
// limited to unambiguous concepts whose inferred category would make later
// contextual combinations visibly incoherent. Applying them before the
// propagation pass also fixes dependent authored concepts without duplicating
// every word in those chains.
const semanticCategoryOverrides = Object.freeze({
  force: Object.freeze(["combustion", "hydro energy", "hydropower", "sunlight", "tidal power"]),
  nature: Object.freeze(["binary star", "comet"]),
  life: Object.freeze([
    "anemone", "arctic char", "blossom", "cactus", "camel", "cell", "community", "crop", "dune grass",
    "goat", "heron", "lichen", "livestock", "lotus", "mangrove", "marram grass", "moonflower",
    "moss", "mountain lion", "night bloom", "pet", "pigeon", "plankton", "polar bear", "population",
    "seabird", "seaweed", "seedling", "trout", "tuna", "urban wildlife", "whale"
  ]),
  structure: Object.freeze(["concrete", "dinner", "farm", "generator", "wind farm"])
});

const learnedSemanticGroups = new Map();
const pool = (category, values) => ({ category, values: values.map(([word, emoji]) => ({ word, emoji })) });
const semanticPools = new Map([
  ["force+force", pool("force", [
    ["Power", "🔋"], ["Heat", "🌡️"], ["Plasma", "☀️"], ["Pressure", "🫧"],
    ["Current", "⚡"], ["Shockwave", "💥"], ["Turbulence", "🌀"], ["Radiation", "☢️"],
    ["Spark", "✨"], ["Pulse", "💫"], ["Explosion", "💥"], ["Momentum", "💨"],
    ["Charge", "⚡"], ["Fusion", "⚛️"], ["Frequency", "📡"], ["Motion", "💫"]
  ])],
  ["nature+nature", pool("nature", [
    ["Landscape", "🏞️"], ["Canyon", "🏜️"], ["Valley", "🏞️"], ["Island", "🏝️"],
    ["Continent", "🌍"], ["Mineral", "💎"], ["Cave", "🕳️"], ["Plateau", "🏔️"],
    ["Terrain", "🗺️"], ["Coast", "🌊"], ["Delta", "🔺"], ["Basin", "🏞️"],
    ["Crater", "🌑"], ["Oasis", "🌴"], ["Tundra", "❄️"], ["Wetland", "🪷"]
  ])],
  ["life+life", pool("life", [
    ["Species", "🧬"], ["Community", "👥"], ["Symbiosis", "🤝"], ["Hybrid", "🧬"],
    ["Colony", "🐜"], ["Family", "👨‍👩‍👧‍👦"], ["Food Chain", "🔗"], ["Biodiversity", "🦋"],
    ["Pack", "🐺"], ["Herd", "🐄"], ["Swarm", "🐝"], ["Wildlife", "🦌"],
    ["Ecosystem", "🌿"], ["Evolution", "🧬"], ["Instinct", "🐾"], ["Habitat", "🏡"]
  ])],
  ["structure+structure", pool("structure", [
    ["Infrastructure", "🏗️"], ["Architecture", "🏛️"], ["Complex", "🏢"], ["Network", "🕸️"],
    ["Workshop", "🛠️"], ["Industry", "🏭"], ["Construction", "🚧"], ["Metropolis", "🌆"],
    ["System", "⚙️"], ["District", "🏙️"], ["Facility", "🏢"], ["Platform", "🧱"],
    ["Framework", "🧩"], ["Assembly", "🔧"], ["Transport", "🚆"], ["Monument", "🗿"]
  ])],
  ["force+life", pool("life", [
    ["Evolution", "🧬"], ["Metabolism", "🫀"], ["Mutation", "🧬"], ["Vitality", "💚"],
    ["Flight", "🪽"], ["Migration", "🦅"], ["Adaptation", "🦎"], ["Instinct", "🐾"],
    ["Photosynthesis", "🌿"], ["Extinction", "🦴"], ["Growth", "🌱"], ["Bioluminescence", "🪼"],
    ["Reflex", "⚡"], ["Breath", "🫁"], ["Pulse", "💓"], ["Survival", "🛡️"]
  ])],
  ["force+nature", pool("nature", [
    ["Phenomenon", "🌠"], ["Erosion", "🏞️"], ["Climate", "🌤️"], ["Current", "🌊"],
    ["Aurora", "🌌"], ["Wave", "🌊"], ["Geyser", "♨️"], ["Earthquake", "🌎"],
    ["Thunder", "🌩️"], ["Weathering", "🪨"], ["Heatwave", "🌡️"], ["Whirlpool", "🌀"],
    ["Avalanche", "🏔️"], ["Mirage", "🏜️"], ["Magma", "🌋"], ["Obsidian", "🖤"]
  ])],
  ["force+structure", pool("structure", [
    ["Technology", "💻"], ["Engine", "⚙️"], ["Reactor", "⚛️"], ["Generator", "🔋"],
    ["Vehicle", "🚗"], ["Automation", "🤖"], ["Turbine", "🌀"], ["Power Plant", "🏭"],
    ["Furnace", "🔥"], ["Battery", "🔋"], ["Motor", "⚙️"], ["Forge", "🔨"],
    ["Circuit", "🔌"], ["Machine", "⚙️"], ["Factory", "🏭"], ["Industry", "🏗️"]
  ])],
  ["life+nature", pool("nature", [
    ["Habitat", "🌿"], ["Ecology", "🌎"], ["Wilderness", "🏕️"], ["Biome", "🌐"],
    ["Nest", "🪺"], ["Sanctuary", "🌳"], ["Pollination", "🐝"], ["Meadow", "🌼"],
    ["Coral Reef", "🪸"], ["Rainforest", "🌴"], ["Burrow", "🕳️"], ["Garden", "🪴"],
    ["Oasis", "🌴"], ["Food Chain", "🔗"], ["Woodland", "🌲"], ["Wetland", "🪷"]
  ])],
  ["life+structure", pool("structure", [
    ["Civilization", "🏛️"], ["Society", "👥"], ["Farm", "🚜"], ["Laboratory", "🧪"],
    ["Settlement", "🏘️"], ["Culture", "🎭"], ["Zoo", "🦁"], ["Village", "🏘️"],
    ["Domestication", "🐕"], ["City", "🏙️"], ["School", "🏫"], ["Hospital", "🏥"],
    ["Market", "🏪"], ["Aquarium", "🐠"], ["Greenhouse", "🏡"], ["Colony", "🐜"]
  ])],
  ["nature+structure", pool("structure", [
    ["Landmark", "🗿"], ["Monument", "🏛️"], ["Quarry", "⛏️"], ["Bridge", "🌉"],
    ["Temple", "⛩️"], ["Road", "🛣️"], ["Harbor", "⚓"], ["Ruins", "🏚️"],
    ["Castle", "🏰"], ["Tunnel", "🚇"], ["Dam", "🌊"], ["Lighthouse", "🗼"],
    ["Mine", "⛏️"], ["Observatory", "🔭"], ["Canal", "🚤"], ["Foundation", "🧱"]
  ])]
]);

const semanticCategoryByWord = new Map();
for (const [category, words] of Object.entries(semanticGroups)) {
  for (const word of words) semanticCategoryByWord.set(word, category);
}
for (const [category, words] of Object.entries(semanticCategoryOverrides)) {
  for (const word of words) semanticCategoryByWord.set(word, category);
}

const crossCategoryOutput = new Map([
  ["force+life", "life"], ["force+nature", "nature"], ["force+structure", "structure"],
  ["life+nature", "nature"], ["life+structure", "structure"], ["nature+structure", "structure"]
]);

let categoryChanged = true;
while (categoryChanged) {
  categoryChanged = false;
  for (const recipe of recipes.values()) {
    if (semanticCategoryByWord.has(recipe.word.toLowerCase())) continue;
    const aCategory = semanticCategoryByWord.get(recipe.a.toLowerCase());
    const bCategory = semanticCategoryByWord.get(recipe.b.toLowerCase());
    if (!aCategory || !bCategory) continue;
    const categories = [aCategory, bCategory].sort();
    const outputCategory = categories[0] === categories[1] ? categories[0] : crossCategoryOutput.get(categories.join("+"));
    if (outputCategory) {
      semanticCategoryByWord.set(recipe.word.toLowerCase(), outputCategory);
      categoryChanged = true;
    }
  }
}

function keyFor(a, b) {
  return [a, b].map((word) => String(word).trim().toLowerCase()).sort().join("+");
}

function sameRecipeResult(left, right) {
  return String(left?.word || "").trim().toLowerCase() === String(right?.word || "").trim().toLowerCase();
}

function touchDynamicRecipe(key, recipe) {
  dynamicRecipes.delete(key);
  dynamicRecipes.set(key, recipe);
  while (dynamicRecipes.size > DYNAMIC_RECIPE_LIMIT) {
    dynamicRecipes.delete(dynamicRecipes.keys().next().value);
  }
}

export function cacheDynamicRecipe(recipe) {
  const a = String(recipe?.a || "").trim();
  const b = String(recipe?.b || "").trim();
  const normalized = {
    ...recipe,
    a,
    b,
    word: String(recipe?.word || "").trim(),
    emoji: String(recipe?.emoji || "").trim(),
    note: String(recipe?.note || "").trim(),
    source: recipe?.source === "ai-route" ? "ai-route" : "ai",
    status: recipe?.status || "quarantined",
    provisional: recipe?.status !== "promoted"
  };
  if (!a || !b || !isSensibleResult(normalized, a, b)) return null;

  const key = keyFor(a, b);
  const authored = recipes.get(key);
  if (authored) return authored;

  const existing = dynamicRecipes.get(key);
  if (existing) {
    touchDynamicRecipe(key, existing);
    return existing;
  }

  touchDynamicRecipe(key, normalized);
  return normalized;
}

export function removeDynamicRecipe(a, b) {
  return dynamicRecipes.delete(keyFor(a, b));
}

// AI discoveries remain canonical across restarts instead of changing when
// the small in-memory LRU is evicted. Ranked play never consumes this tier.
for (const storedRecipe of gameStore.dynamicRecipeCatalog()) cacheDynamicRecipe(storedRecipe);

export function registerDynamicRoute(steps, target) {
  if (!Array.isArray(steps) || steps.length < 2 || steps.length > 9) return null;
  const targetKey = String(target || "").trim().toLowerCase();
  if (!targetKey) return null;

  const available = new Set(STARTERS.map((word) => word.toLowerCase()));
  const routePairs = new Map();
  const normalizedRoute = [];

  for (const candidate of steps) {
    const proposed = {
      a: String(candidate?.a || "").trim(),
      b: String(candidate?.b || "").trim(),
      word: String(candidate?.word || "").trim(),
      emoji: String(candidate?.emoji || "").trim(),
      note: String(candidate?.note || "").trim(),
      source: "ai-route"
    };
    if (!available.has(proposed.a.toLowerCase()) || !available.has(proposed.b.toLowerCase())) return null;
    if (!isSensibleResult(proposed, proposed.a, proposed.b)) return null;

    const key = keyFor(proposed.a, proposed.b);
    const authoritative = recipes.get(key) || routePairs.get(key) || dynamicRecipes.get(key);
    if (authoritative && !sameRecipeResult(authoritative, proposed)) return null;

    const step = authoritative || proposed;
    routePairs.set(key, step);
    normalizedRoute.push({ ...step });
    available.add(step.word.toLowerCase());
  }

  if (normalizedRoute.at(-1)?.word.toLowerCase() !== targetKey) return null;

  for (const step of normalizedRoute) {
    if (!recipes.has(keyFor(step.a, step.b))) cacheDynamicRecipe(step);
  }
  return normalizedRoute.map((step) => ({ ...step }));
}

export function dynamicRecipeCacheSize() {
  return dynamicRecipes.size;
}

export function curatedCombination(a, b) {
  return recipes.get(keyFor(a, b)) || dynamicRecipes.get(keyFor(a, b)) || null;
}

// The static/ranked universe consumes only this high-confidence authored tier.
// Dynamic AI routes and semantic mixing remain available to unranked play, but
// cannot silently redefine an official score path or the downloadable build.
export function authoredCombination(a, b) {
  return recipes.get(keyFor(a, b)) || null;
}

export function contextualCombination(a, b) {
  const groups = [semanticCategoryFor(a), semanticCategoryFor(b)].filter(Boolean).sort();
  if (groups.length !== 2) return null;
  const resultPool = semanticPools.get(groups.join("+"));
  if (!resultPool) return null;
  const start = stableHash(keyFor(a, b)) % resultPool.values.length;
  for (let offset = 0; offset < resultPool.values.length; offset += 1) {
    const candidate = resultPool.values[(start + offset) % resultPool.values.length];
    const result = { ...candidate, note: `${a} and ${b} converge into ${candidate.word.toLowerCase()}.` };
    if (isSensibleResult(result, a, b)) {
      learnedSemanticGroups.set(candidate.word.toLowerCase(), resultPool.category);
      return { ...result, source: "semantic" };
    }
  }
  return null;
}

export function semanticCategoryFor(word) {
  const normalized = String(word).trim().toLowerCase();
  return learnedSemanticGroups.get(normalized) || semanticCategoryByWord.get(normalized);
}

export function registerSemanticConcept(word, category) {
  const clean = String(word || "").trim().replace(/\s+/g, " ");
  const normalizedCategory = String(category || "").trim().toLowerCase();
  if (!isSensibleWish(clean) || !["force", "nature", "life", "structure"].includes(normalizedCategory)) return null;
  const existing = semanticCategoryFor(clean);
  if (existing) return existing;
  learnedSemanticGroups.set(clean.toLowerCase(), normalizedCategory);
  return normalizedCategory;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function reachableFromStarters() {
  const known = new Map(STARTERS.map((word) => [word.toLowerCase(), word]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const recipe of [...recipes.values(), ...dynamicRecipes.values()]) {
      if (known.has(recipe.a.toLowerCase()) && known.has(recipe.b.toLowerCase()) && !known.has(recipe.word.toLowerCase())) {
        known.set(recipe.word.toLowerCase(), recipe.word);
        changed = true;
      }
    }
  }
  return known;
}

export function solutionRoute(target, { includeDynamic = false } = {}) {
  const targetKey = String(target || "").trim().toLowerCase();
  if (!targetKey) return null;

  if (!includeDynamic && authoredSolutionPlansCache) {
    const cached = authoredSolutionPlansCache.get(targetKey);
    return cached ? [...cached.steps.values()].map((step) => ({ ...step })) : null;
  }

  // A plan owns each prerequisite discovery once. This models the actual game,
  // where a discovered word can be reused, and prevents insertion-order routes
  // from overstating move cost or making guidance exceed a mode's budget.
  const plans = new Map(STARTERS.map((word) => [word.toLowerCase(), { word, steps: new Map(), signature: "" }]));
  const candidates = [...recipes.values()];
  if (includeDynamic) {
    for (const [key, recipe] of dynamicRecipes) {
      if (!recipes.has(key)) candidates.push(recipe);
    }
  }

  candidates.sort((left, right) => {
    const leftKey = `${left.word}\0${keyFor(left.a, left.b)}`.toLowerCase();
    const rightKey = `${right.word}\0${keyFor(right.a, right.b)}`.toLowerCase();
    return leftKey.localeCompare(rightKey);
  });

  const signatureFor = (steps) => [...steps.values()]
    .map((step) => `${step.word.toLowerCase()}=${keyFor(step.a, step.b)}`)
    .sort()
    .join("|");
  const isBetter = (candidate, existing) => !existing
    || candidate.steps.size < existing.steps.size
    || (candidate.steps.size === existing.steps.size && candidate.signature < existing.signature);

  let changed = true;
  let rounds = 0;
  while (changed && rounds <= candidates.length + STARTERS.length) {
    changed = false;
    rounds += 1;
    for (const recipe of candidates) {
      const aPlan = plans.get(recipe.a.toLowerCase());
      const bPlan = plans.get(recipe.b.toLowerCase());
      const resultKey = recipe.word.toLowerCase();
      if (!aPlan || !bPlan || STARTERS.some((starter) => starter.toLowerCase() === resultKey)) continue;

      const steps = new Map(aPlan.steps);
      for (const [key, step] of bPlan.steps) if (!steps.has(key)) steps.set(key, step);
      // If producing this result is already a prerequisite, this candidate is
      // cyclic and cannot be executed from the starter inventory.
      if (steps.has(resultKey)) continue;
      steps.set(resultKey, {
        a: recipe.a,
        b: recipe.b,
        word: recipe.word,
        emoji: recipe.emoji,
        note: recipe.note,
        source: recipe.source || "world"
      });
      const candidate = { word: recipe.word, steps, signature: signatureFor(steps) };
      if (!isBetter(candidate, plans.get(resultKey))) continue;
      plans.set(resultKey, candidate);
      changed = true;
    }
  }

  const plan = plans.get(targetKey);
  if (!includeDynamic) authoredSolutionPlansCache = plans;
  return plan ? [...plan.steps.values()].map((step) => ({ ...step })) : null;
}

function trustedRecipeCatalog({ includeDynamic = false } = {}) {
  const catalog = [...recipes.values()];
  if (includeDynamic) {
    for (const [key, recipe] of dynamicRecipes) if (!recipes.has(key)) catalog.push(recipe);
  }
  return catalog.map((recipe) => ({
    ...recipe,
    category: semanticCategoryFor(recipe.word) || null
  }));
}

function verifiedServerRoute(game, { includeDynamic = false } = {}) {
  const route = game ? solutionRoute(game.target, { includeDynamic }) : null;
  if (!Array.isArray(route)) return null;
  if (game.moveLimit && route.length > game.moveLimit) return null;
  const validation = validateUniverseRoute({
    starters: game.starters,
    target: game.target,
    route,
    recipes: trustedRecipeCatalog({ includeDynamic })
  });
  return validation.valid ? { route, validation } : null;
}

export function isSensibleResult(result, a = "", b = "") {
  if (!result || typeof result.word !== "string" || typeof result.emoji !== "string" || typeof result.note !== "string") return false;
  const word = result.word.trim();
  if (word.length < 1 || word.length > 28 || !/^[\p{L}\p{N}][\p{L}\p{N} '&-]*$/u.test(word)) return false;
  const tokens = word.toLowerCase().split(/[\s'-]+/).filter(Boolean);
  if (tokens.length > 4 || new Set(tokens).size !== tokens.length) return false;
  if (word.toLowerCase() === String(a).trim().toLowerCase() || word.toLowerCase() === String(b).trim().toLowerCase()) return false;
  const compact = word.toLowerCase().replace(/[^a-z]/g, "");
  for (let size = 3; size <= Math.min(10, Math.floor(compact.length / 3)); size += 1) {
    for (let index = 0; index <= compact.length - size * 3; index += 1) {
      const part = compact.slice(index, index + size);
      if (compact.slice(index, index + size * 3) === part.repeat(3)) return false;
    }
  }
  return result.note.trim().length <= 100 && result.emoji.trim().length <= 12;
}

function gameFor(targetEntry, mode, extras = {}) {
  const rules = {
    reach: { mode: "reach", modeName: "Reach", timeLimit: null, moveLimit: null, reward: 70 },
    quick: { mode: "quick", modeName: "Quick Orbit", timeLimit: 90, moveLimit: null, reward: 100 },
    moves: { mode: "moves", modeName: "Move Limit", timeLimit: null, moveLimit: 12, reward: 110 },
    daily: { mode: "daily", modeName: "Word of the Day", timeLimit: null, moveLimit: null, reward: 180 },
    weekly: { mode: "weekly", modeName: "Weekly Expedition", timeLimit: null, moveLimit: 14, reward: 130 },
    challenge: { mode: "challenge", modeName: "Friend Challenge", timeLimit: null, moveLimit: null, reward: 90 }
  }[mode] || { mode: "reach", modeName: "Reach", timeLimit: null, moveLimit: null, reward: 70 };
  return {
    ...targetEntry,
    ...rules,
    ...extras,
    starters: STARTERS,
    aiEnabled: Boolean(process.env.OPENAI_API_KEY),
    worldSize: reachableFromStarters().size
  };
}

function directedServerGame(game) {
  if (!game) return null;
  const seed = Number.isFinite(Number(game.seed)) ? Math.abs(Number(game.seed)) : 0;
  return { ...game, seed, universe: selectUniverse(seed) };
}

export function buildGameForMode(mode, seed = 0, customTarget = "", stage = 0) {
  const normalizedMode = ["reach", "quick", "moves", "daily", "weekly", "challenge"].includes(mode) ? mode : "reach";
  if (customTarget) {
    const known = reachableFromStarters();
    const canonical = known.get(customTarget.trim().toLowerCase());
    if (!canonical) return null;
    const existing = targetCatalog.find((entry) => entry.target.toLowerCase() === canonical.toLowerCase());
    const target = existing || { target: canonical, emoji: emojiForWord(canonical), clue: "A destination chosen by you.", tier: 2 };
    return gameFor(target, normalizedMode, { seed: Math.abs(seed), challengeId: normalizedMode === "challenge" ? stableHash(`${seed}:${canonical}`) : null });
  }
  if (normalizedMode === "daily") {
    const target = dailyTargets[Math.abs(seed) % dailyTargets.length];
    return gameFor(target, "daily", { seed: Math.abs(seed), law: cosmicLaws[Math.abs(seed) % cosmicLaws.length] });
  }
  if (normalizedMode === "weekly") {
    const route = weeklyTargets[Math.abs(seed) % weeklyTargets.length];
    const safeStage = Math.min(2, Math.max(0, Number(stage) || 0));
    const targetName = route[safeStage];
    const target = targetCatalog.find((entry) => entry.target === targetName);
    return gameFor(target, "weekly", { seed: Math.abs(seed), stage: safeStage, stageCount: 3, moveLimit: 10 + safeStage * 2, law: cosmicLaws[(Math.abs(seed) + safeStage) % cosmicLaws.length] });
  }
  const pools = {
    reach: targetCatalog.filter((entry) => entry.tier <= 4),
    quick: targetCatalog.filter((entry) => entry.tier >= 1 && entry.tier <= 2),
    moves: targetCatalog.filter((entry) => entry.tier >= 2 && entry.tier <= 3 && (solutionRoute(entry.target)?.length || Infinity) <= 12),
    challenge: targetCatalog
  };
  const pool = pools[normalizedMode];
  return gameFor(pool[Math.abs(seed) % pool.length], normalizedMode, { seed: Math.abs(seed) });
}

function emojiForWord(word) {
  const recipe = [...recipes.values(), ...dynamicRecipes.values()].find((item) => item.word.toLowerCase() === word.toLowerCase());
  return recipe?.emoji || "✨";
}

async function responseJson(body) {
  const release = aiRequestGate.acquire();
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Math.min(30_000, Math.max(3_000, Number(process.env.CONSTELLORE_AI_TIMEOUT_MS) || 12_000)))
    });
    if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
    const payload = await response.json();
    const outputText = payload.output_text ?? payload.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;
    if (!outputText) throw new Error("The AI returned no structured result.");
    return JSON.parse(outputText);
  } finally {
    release();
  }
}

async function aiCombination(a, b, discovered) {
  if (!process.env.OPENAI_API_KEY) return null;
  const safeA = safeConcept(a, 28);
  const safeB = safeConcept(b, 28);
  if (!safeA || !safeB) return null;
  const safeDiscovered = safeDiscoveryContext(discovered, { maximumItems: 30, maximumWordLength: 28 });
  const model = process.env.OPENAI_MODEL || "gpt-5.4-nano";
  const result = await responseJson({
    model,
    instructions: "You power a family-friendly word-combination game. Return one real, recognizable concept: a common noun, proper noun, natural phenomenon, invention, place, creature, or established idea. Never concatenate input words, invent gibberish, repeat syllables, add 'craft', or return either input unchanged. If the connection is indirect, use a well-known cultural association. Keep the explanation under 12 words.",
    input: `Combine ${JSON.stringify(safeA)} + ${JSON.stringify(safeB)}. Already discovered: ${safeDiscovered.slice(-30).join(", ")}.`,
    text: { format: { type: "json_schema", name: "word_combination", strict: true, schema: {
      type: "object",
      properties: {
        word: { type: "string", minLength: 1, maxLength: 28 },
        emoji: { type: "string", minLength: 1, maxLength: 12 },
        note: { type: "string", minLength: 1, maxLength: 100 }
      },
      required: ["word", "emoji", "note"], additionalProperties: false
    } } },
    max_output_tokens: 140
  });
  if (!isSensibleResult(result, safeA, safeB)) return null;
  const cached = cacheDynamicRecipe({
    ...result,
    a: safeA,
    b: safeB,
    source: "ai",
    status: "quarantined",
    promptVersion: AI_COMBINATION_PROMPT_VERSION,
    model,
    provenance: "live-unranked-ai"
  });
  if (cached?.source === "ai") await gameStore.rememberDynamicRecipes([cached], new Date(), {
    promptVersion: AI_COMBINATION_PROMPT_VERSION,
    model,
    provenance: "live-unranked-ai"
  });
  return cached;
}

export function isSensibleWish(word) {
  const clean = String(word || "").trim().replace(/\s+/g, " ");
  if (!isSafeTarget(clean) || clean.length < 2) return false;
  const compact = clean.toLowerCase().replace(/[^a-z]/g, "");
  if (compact.length >= 5 && !/[aeiouy]/.test(compact)) return false;
  if (/(.{2,8})\1\1/i.test(compact) || /(craft){2,}/i.test(compact)) return false;
  return true;
}

export function registerWishConcept(word) {
  const clean = String(word || "").trim().replace(/\s+/g, " ");
  if (!isSensibleWish(clean)) return null;
  const normalized = clean.toLowerCase();
  const existing = semanticCategoryFor(normalized);
  if (existing) return existing;
  const hints = [
    ["force", /magic|gravity|sound|music|time|heat|cold|electric|radiation|motion|dream|spirit|power/i],
    ["life", /human|person|people|cat|dog|horse|wolf|bear|insect|shark|whale|bacteria|fungus|creature|monster/i],
    ["structure", /sword|tool|car|train|ship|computer|phone|book|internet|robot|building|tower|weapon|game|art/i],
    ["nature", /moon|planet|universe|world|ocean|sea|river|lake|rock|crystal|gold|forest|desert|weather|space/i]
  ];
  const hinted = hints.find(([, pattern]) => pattern.test(clean))?.[0];
  const category = hinted || ["nature", "life", "structure", "force"][stableHash(normalized) % 4];
  learnedSemanticGroups.set(normalized, category);
  return category;
}

async function createTargetRoute(target) {
  if (!process.env.OPENAI_API_KEY) return null;
  const cleanTarget = target.trim().replace(/\s+/g, " ");
  if (!isSafeTarget(cleanTarget)) return null;
  const model = process.env.OPENAI_MODEL || "gpt-5.4-nano";
  const plan = await responseJson({
    model,
    instructions: "Design a guaranteed-solvable route for a word-combination game. Start only with Earth, Water, Fire, and Air. Each step combines two currently available concepts; a concept is available if it is a starter or the result of an earlier step. Every result must be a short, real, recognizable concept. No gibberish, concatenated inputs, repeated syllables, or filler. The final result must exactly match the requested target, including capitalization. Prefer 4-8 logical steps.",
    input: `Create a route to the target ${JSON.stringify(cleanTarget)}.`,
    text: { format: { type: "json_schema", name: "target_route", strict: true, schema: {
      type: "object",
      properties: { steps: { type: "array", minItems: 2, maxItems: 9, items: { type: "object", properties: {
        a: { type: "string", minLength: 1, maxLength: 28 }, b: { type: "string", minLength: 1, maxLength: 28 },
        word: { type: "string", minLength: 1, maxLength: 28 }, emoji: { type: "string", minLength: 1, maxLength: 12 },
        note: { type: "string", minLength: 1, maxLength: 100 }
      }, required: ["a", "b", "word", "emoji", "note"], additionalProperties: false } } },
      required: ["steps"], additionalProperties: false
    } } },
    max_output_tokens: 900
  });
  const route = registerDynamicRoute(plan.steps, cleanTarget);
  if (!route) return null;
  await gameStore.rememberDynamicRecipes(route.filter((step) => !recipes.has(keyFor(step.a, step.b))), new Date(), {
    promptVersion: AI_ROUTE_PROMPT_VERSION,
    model,
    provenance: "custom-target-route"
  });
  const last = route.at(-1);
  return gameFor({ target: last.word, emoji: last.emoji, clue: "A destination chosen by you. The universe has made a path.", tier: 3 }, "reach");
}

function isSafeTarget(target) {
  return target.length >= 2 && target.length <= 28 && /^[\p{L}\p{N}][\p{L}\p{N} '&-]*$/u.test(target) && target.split(/\s+/).length <= 4;
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

const requestLimiter = new MemoryRateLimiter({ windowMs: 60_000, maximumKeys: 10_000 });
const interestRequestWindows = new Map();
const analyticsRequestWindows = new Map();
const recoveryRequestWindows = new Map();
const recipeFeedbackRequestWindows = new Map();
const adminRequestWindows = new Map();
const INTEREST_RATE_WINDOW_MS = 10 * 60_000;
const INTEREST_RATE_LIMIT = 20;
const INTEREST_RATE_MAX_KEYS = 5_000;
const ANALYTICS_RATE_MAX_KEYS = 5_000;
const RECOVERY_RATE_WINDOW_MS = 15 * 60_000;
const RECOVERY_RATE_LIMIT = 10;
const analyticsEvents = new Set(ANALYTICS_EVENT_NAMES);

function rateLimited(request, limit = 180, bucket = "general") {
  const key = `${request.socket.remoteAddress || "unknown"}:${bucket}`;
  return requestLimiter.limited(key, limit);
}

function analyticsRateLimited(request, limit = 240) {
  const key = gameStore.sign(`rate:analytics:${request.socket.remoteAddress || "unknown"}`);
  const now = Date.now();
  const current = analyticsRequestWindows.get(key);
  if (!current || now - current.startedAt > 60_000) {
    for (const [storedKey, window] of analyticsRequestWindows) if (now - window.startedAt > 60_000) analyticsRequestWindows.delete(storedKey);
    while (analyticsRequestWindows.size >= ANALYTICS_RATE_MAX_KEYS) analyticsRequestWindows.delete(analyticsRequestWindows.keys().next().value);
    analyticsRequestWindows.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > limit;
}

function adminRateLimited(request, limit = 240) {
  const key = gameStore.sign(`rate:admin:${request.socket.remoteAddress || "unknown"}`);
  const now = Date.now();
  const current = adminRequestWindows.get(key);
  if (!current || now - current.startedAt > 60_000) {
    for (const [storedKey, window] of adminRequestWindows) if (now - window.startedAt > 60_000) adminRequestWindows.delete(storedKey);
    while (adminRequestWindows.size >= 1_000) adminRequestWindows.delete(adminRequestWindows.keys().next().value);
    adminRequestWindows.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > limit;
}

function recoveryRateLimited(request, playerId) {
  const now = Date.now();
  for (const [key, window] of recoveryRequestWindows) if (now - window.startedAt > RECOVERY_RATE_WINDOW_MS) recoveryRequestWindows.delete(key);
  while (recoveryRequestWindows.size >= 5_000) recoveryRequestWindows.delete(recoveryRequestWindows.keys().next().value);
  const key = gameStore.sign(`rate:recovery:${request.socket.remoteAddress || "unknown"}:${String(playerId || "")}`);
  const current = recoveryRequestWindows.get(key);
  if (!current) {
    recoveryRequestWindows.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > RECOVERY_RATE_LIMIT;
}

function recipeFeedbackRateLimited(request, playerId) {
  const now = Date.now();
  const windowMs = 60_000;
  for (const [key, window] of recipeFeedbackRequestWindows) if (now - window.startedAt > windowMs) recipeFeedbackRequestWindows.delete(key);
  while (recipeFeedbackRequestWindows.size >= 5_000) recipeFeedbackRequestWindows.delete(recipeFeedbackRequestWindows.keys().next().value);
  const key = gameStore.sign(`rate:recipe-feedback:${request.socket.remoteAddress || "unknown"}:${playerId}`);
  const current = recipeFeedbackRequestWindows.get(key);
  if (!current) {
    recipeFeedbackRequestWindows.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > 60;
}

function interestRateLimited(request) {
  const now = Date.now();
  for (const [key, window] of interestRequestWindows) {
    if (now - window.startedAt > INTEREST_RATE_WINDOW_MS) interestRequestWindows.delete(key);
  }
  while (interestRequestWindows.size >= INTEREST_RATE_MAX_KEYS) {
    interestRequestWindows.delete(interestRequestWindows.keys().next().value);
  }
  const networkAddress = request.socket.remoteAddress || "unknown";
  // The anonymous UUID is attacker-controlled and must not create a fresh
  // allowance. One network bucket protects both metric quality and disk use.
  const key = gameStore.sign(`rate:interest:${networkAddress}`);
  const current = interestRequestWindows.get(key);
  if (!current) {
    interestRequestWindows.set(key, { startedAt: now, count: 1 });
    return false;
  }
  if (now - current.startedAt > INTEREST_RATE_WINDOW_MS) {
    interestRequestWindows.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > INTEREST_RATE_LIMIT;
}

function configuredInterestOrigins() {
  const origins = new Set();
  for (const candidate of String(process.env.INTEREST_ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean)) {
    try {
      const parsed = new URL(candidate);
      const normalized = candidate.replace(/\/$/, "");
      if (["http:", "https:"].includes(parsed.protocol) && parsed.origin === normalized) origins.add(parsed.origin);
    } catch { /* Invalid configured origins are ignored rather than reflected. */ }
  }
  return origins;
}

function allowInterestOrigin(request, response) {
  const rawOrigin = String(request.headers.origin || "").trim();
  if (!rawOrigin) return true;
  let origin;
  try {
    origin = new URL(rawOrigin);
  } catch {
    return false;
  }
  if (!["http:", "https:"].includes(origin.protocol) || origin.origin !== rawOrigin.replace(/\/$/, "")) return false;
  const sameOrigin = origin.host.toLowerCase() === String(request.headers.host || "").toLowerCase();
  if (!sameOrigin && !configuredInterestOrigins().has(origin.origin)) return false;
  response.setHeader("Access-Control-Allow-Origin", origin.origin);
  response.setHeader("Vary", "Origin");
  return true;
}

function setSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("X-Frame-Options", "SAMEORIGIN");
  // Board coordinates and progress meters use bounded CSS custom properties and
  // element style attributes; scripts remain restricted to same-origin files.
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'");
}

function structuredLog(level, type, fields = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(fields)) {
    if (/token|secret|authorization|cookie|recovery/i.test(key)) continue;
    if (["string", "number", "boolean"].includes(typeof value) || value === null) safe[key] = typeof value === "string" ? value.slice(0, 240) : value;
  }
  const line = JSON.stringify({ timestamp: new Date().toISOString(), level, type, ...safe });
  if (level === "error") console.error(line);
  else console.info(line);
}

function requirePlayer(request) {
  const playerId = request.headers["x-constellore-player"] || request.headers["x-wordforge-player"];
  const playerToken = request.headers["x-constellore-token"] || request.headers["x-wordforge-token"];
  const player = gameStore.authenticate(playerId, playerToken);
  if (!player) throw serviceError(401, "Your player session is no longer valid.", "invalid_player");
  return player;
}

function tokenDigest(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest();
}

function timingSafeTokenEqual(expected, received) {
  return timingSafeEqual(tokenDigest(expected), tokenDigest(received));
}

function requestAdminToken(request) {
  const authorization = Array.isArray(request.headers.authorization) ? request.headers.authorization[0] : request.headers.authorization;
  const bearer = /^Bearer\s+(.+)$/i.exec(String(authorization || "").trim());
  const header = Array.isArray(request.headers["x-constellore-admin"]) ? request.headers["x-constellore-admin"][0] : request.headers["x-constellore-admin"];
  return bearer?.[1]?.trim() || String(header || "").trim();
}

function requireAdmin(request) {
  const configured = String(process.env.CONSTELLORE_ADMIN_TOKEN || "").trim();
  if (Buffer.byteLength(configured, "utf8") < 24) throw serviceError(404, "Not found.", "admin_api_disabled");
  if (!timingSafeTokenEqual(configured, requestAdminToken(request))) throw serviceError(401, "Administrator authentication is required.", "invalid_admin_token");
}

function hasExactKeys(value, keys) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}

function billingSettings() {
  let checkoutUrl = "";
  try {
    const candidate = new URL(process.env.NEBULA_CHECKOUT_URL || "");
    if (candidate.protocol === "https:" || (candidate.protocol === "http:" && ["localhost", "127.0.0.1"].includes(candidate.hostname))) checkoutUrl = candidate.toString();
  } catch { /* Billing remains disabled until a valid URL is configured. */ }
  // A checkout URL alone must never collect money before a verified provider
  // adapter is ready to write authoritative entitlements.
  const fulfillmentReady = process.env.CONSTELLORE_COMMERCE_FULFILLMENT_READY === "true";
  const billingEnabled = Boolean(checkoutUrl && fulfillmentReady);
  return {
    checkoutUrl: billingEnabled ? checkoutUrl : "",
    billingEnabled,
    fulfillmentReady,
    testStoreEnabled: process.env.NODE_ENV !== "production" && process.env.CONSTELLORE_ENABLE_TEST_STORE === "true" && !billingEnabled,
    creditPacks: [],
    products: CREATIVE_COMMERCE_CATALOG.map((product) => ({ ...product }))
  };
}

async function createSafeBackup() {
  if (!backupDirectory) throw serviceError(409, "Backups require a durable store.", "backup_unavailable");
  return gameStore.exportSafeBackup(backupDirectory, { keep: backupRetention });
}

function officialRunDetails(mode, requestedSeed, stage = 0, requestedTarget = "", custom = false) {
  const today = new Date().toISOString().slice(0, 10);
  const week = isoWeekKey();
  const safeStage = Math.min(2, Math.max(0, Number(stage) || 0));
  const ranked = ["daily", "weekly", "quick", "moves"].includes(mode);
  let seed = Number.isFinite(Number(requestedSeed)) ? Math.abs(Number(requestedSeed)) : stableHash(`${Date.now()}:${mode}`);
  // Sequential UTC day numbers guarantee that the official destination moves
  // to the next catalog entry instead of merely hoping a date hash changes it.
  if (mode === "daily") seed = Math.floor(Date.parse(`${today}T00:00:00Z`) / 86_400_000);
  if (mode === "weekly") seed = stableHash(`weekly:${week}`);
  if (["quick", "moves"].includes(mode)) seed = stableHash(`${mode}:${today}`);
  const target = ["challenge", "reach"].includes(mode) ? requestedTarget : "";
  const game = directedServerGame(buildGameForMode(mode, seed, target, safeStage));
  if (!game) return null;
  const challengeId = mode === "daily" ? `daily:${today}`
    : mode === "weekly" ? `weekly:${week}:${safeStage}`
      : ["quick", "moves"].includes(mode) ? `${mode}:${today}`
        : `practice:${mode}:${seed}`;
  return {
    game: { ...game, ranked, challengeId, graphVersion: GRAPH_VERSION, buildVersion: BUILD_VERSION, rulesVersion: RANKED_RULES_VERSION },
    ranked,
    challengeId,
    seed
  };
}

const MISSION_PREVIEW_TTL_MS = 15 * 60_000;
const MISSION_PREVIEW_TOKEN_LIMIT = 16_000;

function missionBriefingFingerprint(game) {
  return JSON.stringify({
    mode: game.mode,
    modeName: game.modeName,
    target: game.target,
    emoji: game.emoji,
    clue: game.clue,
    tier: game.tier,
    seed: game.seed,
    stage: game.stage ?? null,
    stageCount: game.stageCount ?? null,
    timeLimit: game.timeLimit ?? null,
    moveLimit: game.moveLimit ?? null,
    reward: game.reward,
    law: game.law ? { id: game.law.id, name: game.law.name, description: game.law.description } : null,
    ranked: Boolean(game.ranked),
    scoreEligible: game.scoreEligible !== false,
    rewardEligible: game.rewardEligible !== false,
    leaderboardEligible: Boolean(game.leaderboardEligible),
    challengeId: game.challengeId || "",
    graphVersion: game.graphVersion || GRAPH_VERSION,
    buildVersion: game.buildVersion || BUILD_VERSION,
    rulesVersion: game.rulesVersion || RANKED_RULES_VERSION
  });
}

function missionPreviewRequest(details, body) {
  const mode = details.game.mode;
  return {
    mode,
    seed: details.seed,
    target: ["reach", "challenge"].includes(mode) ? String(body.target || "") : "",
    stage: mode === "weekly" ? Math.min(2, Math.max(0, Number(body.stage) || 0)) : 0,
    custom: Boolean(body.custom)
  };
}

function createMissionPreviewToken(playerId, request, game, route = []) {
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    playerId,
    expiresAt: Date.now() + MISSION_PREVIEW_TTL_MS,
    request,
    fingerprint: missionBriefingFingerprint(game),
    route: request.custom ? route.slice(0, 9).map((step) => ({
      a: step.a,
      b: step.b,
      word: step.word,
      emoji: step.emoji,
      note: step.note,
      source: step.source || "ai-route"
    })) : []
  }), "utf8").toString("base64url");
  return `${payload}.${gameStore.signFor("mission-preview", payload)}`;
}

function readMissionPreviewToken(token, playerId) {
  try {
    if (typeof token !== "string" || token.length < 40 || token.length > MISSION_PREVIEW_TOKEN_LIMIT) throw new Error("invalid");
    const separator = token.lastIndexOf(".");
    if (separator < 1) throw new Error("invalid");
    const encoded = token.slice(0, separator);
    const signature = token.slice(separator + 1);
    const validPurposeSignature = gameStore.verifyFor("mission-preview", encoded, signature);
    const validLegacySignature = gameStore.verify(`mission-preview:v1:${encoded}`, signature);
    if (!validPurposeSignature && !validLegacySignature) throw new Error("invalid");
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!hasExactKeys(payload, ["v", "playerId", "expiresAt", "request", "fingerprint", "route"])) throw new Error("invalid");
    if (payload.v !== 1 || payload.playerId !== playerId || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) throw new Error("invalid");
    if (!hasExactKeys(payload.request, ["mode", "seed", "target", "stage", "custom"]) || typeof payload.fingerprint !== "string" || !Array.isArray(payload.route) || payload.route.length > 9) throw new Error("invalid");
    return payload;
  } catch {
    throw serviceError(409, "This mission briefing expired or changed. Review the refreshed mission before starting.", "mission_stale");
  }
}

function publicRun(run, token) {
  const scoreMultiplier = run.scoringDisabled ? 0 : assistancePolicy(run.assist).scoreMultiplier;
  return {
    id: run.runId,
    token,
    ranked: run.ranked,
    scoringDisabled: Boolean(run.scoringDisabled),
    scoreEligible: !run.scoringDisabled,
    scoreMultiplier,
    rewardEligible: !run.scoringDisabled,
    leaderboardEligible: Boolean(run.ranked && !run.scoringDisabled),
    assist: run.assist,
    challengeId: run.challengeId,
    challengeKey: run.challengeBaseIdentity?.key || null,
    challenge: run.challengeBaseIdentity?.descriptor || null,
    startedAt: new Date(run.startedAt).toISOString(),
    deadlineAt: run.game.timeLimit ? new Date(run.startedAt + run.game.timeLimit * 1000).toISOString() : null
  };
}

function configuredAppOrigins(request) {
  const origins = new Set();
  const host = String(request.headers.host || "").trim();
  if (/^[A-Za-z0-9.\-\[\]:]+$/.test(host)) {
    origins.add(`https://${host}`);
    origins.add(`http://${host}`);
  }
  for (const candidate of String(process.env.APP_ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean)) {
    try {
      const parsed = new URL(candidate);
      if (["http:", "https:"].includes(parsed.protocol)) origins.add(parsed.origin);
    } catch { /* Invalid deployment configuration never broadens write access. */ }
  }
  return [...origins];
}

function allowApiWriteOrigin(request) {
  const origin = Array.isArray(request.headers.origin) ? request.headers.origin[0] : request.headers.origin;
  const fetchSite = String(request.headers["sec-fetch-site"] || "").toLowerCase();
  if (!origin && fetchSite === "cross-site") return false;
  return trustedWriteOrigin(String(origin || "").trim(), configuredAppOrigins(request));
}

function configuredAnalyticsOrigins() {
  const origins = new Set(configuredInterestOrigins());
  for (const candidate of String(process.env.ANALYTICS_ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean)) {
    try {
      const parsed = new URL(candidate);
      if (["http:", "https:"].includes(parsed.protocol)) origins.add(parsed.origin);
    } catch { /* Invalid configured origins remain denied. */ }
  }
  return origins;
}

function allowAnalyticsOrigin(request, response) {
  const rawOrigin = String(request.headers.origin || "").trim();
  if (!rawOrigin) return true;
  let origin;
  try { origin = new URL(rawOrigin); }
  catch { return false; }
  const sameOrigin = origin.host.toLowerCase() === String(request.headers.host || "").toLowerCase();
  if (!sameOrigin && !configuredAnalyticsOrigins().has(origin.origin)) return false;
  response.setHeader("Access-Control-Allow-Origin", origin.origin);
  response.setHeader("Vary", "Origin");
  return true;
}

export const experimentalCombination = contextualCombination;

function studyAssistForReason(reason) {
  const value = String(reason || "").trim().toLowerCase();
  return ["sense", "gift", "reveal"].includes(value) ? value : "reveal";
}

function studyForfeitMessage(assist) {
  if (["sense", "gift"].includes(assist)) return "This challenge was forfeited under an earlier beta assistance rule.";
  return "Reveal Path forfeited this orbit's score and rewards.";
}

function originItem(word) {
  return {
    word,
    emoji: emojiByWord[word] || emojiForWord(word),
    category: semanticCategoryFor(word) || null,
    source: "origin"
  };
}

async function jsonBody(request, maximumBytes = 50_000) {
  let body = "";
  let bytes = 0;
  const declaredLength = Number(request.headers["content-length"]);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    const error = new Error("Request too large.");
    error.statusCode = 413;
    throw error;
  }
  for await (const chunk of request) {
    bytes += Buffer.byteLength(chunk);
    body += chunk;
    if (bytes > maximumBytes) {
      const error = new Error("Request too large.");
      error.statusCode = 413;
      throw error;
    }
  }
  try {
    return JSON.parse(body || "{}");
  } catch {
    const error = new Error("Invalid JSON body.");
    error.statusCode = 400;
    throw error;
  }
}

export const server = createServer(async (request, response) => {
  const requestId = randomUUID();
  const requestStartedAt = performance.now();
  response.setHeader("X-Request-Id", requestId);
  response.once("finish", () => structuredLog("info", "http_request", {
    requestId,
    method: request.method,
    path: String(request.url || "/").split("?", 1)[0].slice(0, 180),
    status: response.statusCode,
    durationMs: Math.max(0, Math.round(performance.now() - requestStartedAt))
  }));
  setSecurityHeaders(response);
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const isApiWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && url.pathname.startsWith("/api/");
    const hasDedicatedCorsPolicy = url.pathname === "/api/interest" || url.pathname === "/api/analytics";
    if (isApiWrite && !hasDedicatedCorsPolicy && !allowApiWriteOrigin(request)) {
      return sendJson(response, 403, { error: "That origin is not allowed to change game data.", code: "write_origin_denied" });
    }
    const hasRequestBody = Number(request.headers["content-length"] || 0) > 0 || Boolean(request.headers["transfer-encoding"]);
    if (hasRequestBody && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && url.pathname.startsWith("/api/") && url.pathname !== "/api/interest") {
      const contentType = String(request.headers["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
      if (contentType !== "application/json") throw serviceError(415, "API writes must use application/json.", "content_type_required");
    }
    if (url.pathname === "/api/interest") {
      if (!allowInterestOrigin(request, response)) return sendJson(response, 403, { error: "That origin is not allowed.", code: "interest_origin_denied" });
      if (request.method === "OPTIONS") {
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
        response.setHeader("Access-Control-Max-Age", "600");
        response.writeHead(204);
        return response.end();
      }
      if (request.method === "GET") return sendJson(response, 200, gameStore.interestAggregate("web-release"));
      if (request.method === "POST") {
        const contentType = String(request.headers["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
        if (contentType !== "application/json") throw serviceError(415, "Interest requests must use application/json.", "interest_content_type_required");
        const body = await jsonBody(request, 1_024);
        const expectedKeys = ["action", "anonymousId", "campaign", "source"];
        if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).sort().join(",") !== expectedKeys.join(",")) {
          throw serviceError(400, "Interest requests must contain only anonymousId, campaign, source, and action.", "invalid_interest_request");
        }
        if (interestRateLimited(request)) return sendJson(response, 429, { error: "Too many interest requests. Please try again later.", code: "interest_rate_limited" });
        const result = await gameStore.recordInterest(body);
        return sendJson(response, result.changed && result.interested ? 201 : 200, result);
      }
      response.setHeader("Allow", "GET, POST, OPTIONS");
      return sendJson(response, 405, { error: "Method not allowed.", code: "method_not_allowed" });
    }
    if (["GET", "HEAD"].includes(request.method) && url.pathname === "/play") {
      response.writeHead(308, { Location: "/play/", "Cache-Control": "no-cache" });
      return response.end();
    }
    if (request.method === "GET" && url.pathname === "/livez") {
      return sendJson(response, 200, { ok: true, game: "Constellore", version: APP_VERSION, build: BUILD_VERSION, uptimeSeconds: Math.floor(process.uptime()) });
    }
    if (request.method === "GET" && ["/healthz", "/readyz"].includes(url.pathname)) {
      const verifiedTargets = targetCatalog.filter((entry) => verifiedServerRoute(gameFor(entry, "reach"))).length;
      const contentReady = targetCatalog.length >= 30 && verifiedTargets === targetCatalog.length;
      const storage = gameStore.storageHealth();
      const durableEnough = process.env.NODE_ENV !== "production" || storage.kind !== "memory";
      const ready = contentReady && storage.ready && durableEnough;
      return sendJson(response, ready ? 200 : 503, {
        ok: ready,
        status: ready ? "ready" : "not_ready",
        game: "Constellore",
        version: APP_VERSION,
        build: BUILD_VERSION,
        graphVersion: GRAPH_VERSION,
        rulesVersion: RANKED_RULES_VERSION,
        content: { ready: contentReady, targets: targetCatalog.length, verifiedTargets },
        storage: { ...storage, durable: storage.kind !== "memory" },
        aiEnabled: Boolean(process.env.OPENAI_API_KEY),
        billingEnabled: billingSettings().billingEnabled
      });
    }
    if (url.pathname === "/api/analytics" && request.method === "OPTIONS") {
      if (!allowAnalyticsOrigin(request, response)) return sendJson(response, 403, { error: "That origin is not allowed.", code: "analytics_origin_denied" });
      response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.setHeader("Access-Control-Max-Age", "600");
      response.writeHead(204);
      return response.end();
    }
    if (request.method === "GET" && url.pathname === "/api/config") {
      const billing = billingSettings();
      return sendJson(response, 200, {
        billingEnabled: billing.billingEnabled,
        checkoutUrl: billing.checkoutUrl,
        fulfillmentReady: billing.fulfillmentReady,
        testStoreEnabled: billing.testStoreEnabled,
        creditPacks: billing.creditPacks,
        products: billing.products,
        commercePolicy: { realMoney: "cosmetic-or-creative-only", rankedAdvantages: false, starCreditsSoldForCash: false },
        rewardedAdsEnabled: process.env.REWARDED_ADS_ENABLED === "true",
        founderPrice: process.env.NEBULA_PRICE || "€6.99",
        gameName: "Constellore",
        publisher: "Oxyfel Games",
        aiEnabled: Boolean(process.env.OPENAI_API_KEY)
      });
    }
    if (request.method === "POST" && url.pathname === "/api/player/register") {
      if (rateLimited(request, 20, "player-register")) return sendJson(response, 429, { error: "Too many player registrations." });
      const registration = await gameStore.registerPlayer({ withRecoveryCode: true });
      const session = await gameStore.issuePlayerSession(registration.player.id, { deviceLabel: "web beta" });
      return sendJson(response, 201, {
        player: registration.player,
        playerToken: session.playerToken,
        sessionId: session.sessionId,
        sessionExpiresAt: session.expiresAt,
        recoveryCode: registration.recoveryCode,
        recoveryVersion: 1
      });
    }
    if (request.method === "POST" && url.pathname === "/api/player/recover") {
      const body = await jsonBody(request, 2_048);
      if (!hasExactKeys(body, ["playerId", "recoveryCode"])) throw serviceError(400, "Recovery requires only playerId and recoveryCode.", "invalid_recovery_request");
      if (recoveryRateLimited(request, body.playerId)) return sendJson(response, 429, { error: "Too many recovery attempts.", code: "recovery_rate_limited" });
      return sendJson(response, 200, await gameStore.recoverPlayer(body.playerId, body.recoveryCode));
    }
    if (request.method === "GET" && url.pathname === "/api/player") {
      const player = requirePlayer(request);
      return sendJson(response, 200, { player: gameStore.publicPlayer(player.id) });
    }
    if (request.method === "POST" && url.pathname === "/api/player/recovery/rotate") {
      const player = requirePlayer(request);
      const body = await jsonBody(request, 256);
      if (!hasExactKeys(body, [])) throw serviceError(400, "Recovery rotation does not accept fields.", "invalid_recovery_request");
      return sendJson(response, 200, await gameStore.rotateRecovery(player.id));
    }
    if (request.method === "POST" && url.pathname === "/api/player/recovery/revoke") {
      const player = requirePlayer(request);
      const body = await jsonBody(request, 256);
      if (!hasExactKeys(body, [])) throw serviceError(400, "Recovery revocation does not accept fields.", "invalid_recovery_request");
      return sendJson(response, 200, await gameStore.revokeRecovery(player.id));
    }
    if (request.method === "POST" && url.pathname === "/api/player/session/revoke") {
      const playerId = request.headers["x-constellore-player"] || request.headers["x-wordforge-player"];
      const playerToken = request.headers["x-constellore-token"] || request.headers["x-wordforge-token"];
      const player = gameStore.authenticate(playerId, playerToken);
      if (!player) throw serviceError(401, "Your player session is no longer valid.", "invalid_player");
      const body = await jsonBody(request, 256);
      if (!hasExactKeys(body, [])) throw serviceError(400, "Session revocation does not accept fields.", "invalid_session_revoke_request");
      return sendJson(response, 200, await gameStore.revokePlayerSession(player.id, playerToken));
    }
    if (request.method === "GET" && url.pathname === "/api/player/profile") {
      if (rateLimited(request, 120, "profile-read")) return sendJson(response, 429, { error: "Too many profile requests." });
      const player = requirePlayer(request);
      return sendJson(response, 200, gameStore.cloudProfile(player.id));
    }
    if (request.method === "PUT" && url.pathname === "/api/player/profile") {
      if (rateLimited(request, 20, "profile-write")) return sendJson(response, 429, { error: "Too many profile updates." });
      const player = requirePlayer(request);
      const body = await jsonBody(request, 256_000);
      if (!hasExactKeys(body, ["profile", "version"])) throw serviceError(400, "Cloud profile updates require only profile and version.", "invalid_cloud_profile_request");
      return sendJson(response, 200, await gameStore.updateCloudProfile(player.id, body.version, body.profile));
    }
    if (request.method === "GET" && url.pathname === "/api/player/export") {
      if (rateLimited(request, 20, "player-export")) return sendJson(response, 429, { error: "Too many export requests." });
      const player = requirePlayer(request);
      return sendJson(response, 200, gameStore.playerDataExport(player.id));
    }
    if (request.method === "DELETE" && url.pathname === "/api/player/profile") {
      if (rateLimited(request, 5, "player-delete")) return sendJson(response, 429, { error: "Too many deletion requests." });
      const player = requirePlayer(request);
      const body = await jsonBody(request, 256);
      if (!hasExactKeys(body, ["confirm"]) || body.confirm !== "DELETE") throw serviceError(400, "Confirm deletion with the exact word DELETE.", "deletion_confirmation_required");
      const result = await gameStore.deleteFreePlayerData(player.id);
      runRegistry.revokePlayer(player.id);
      return sendJson(response, 200, result);
    }
    if (request.method === "POST" && url.pathname === "/api/player/restore") {
      const player = requirePlayer(request);
      const body = await jsonBody(request, 256);
      if (!hasExactKeys(body, [])) throw serviceError(400, "Purchase restoration does not accept fields.", "invalid_restore_request");
      return sendJson(response, 200, { player: gameStore.publicPlayer(player.id), entitlements: gameStore.entitlementSnapshot(player.id) });
    }
    if (request.method === "POST" && url.pathname === "/api/player/test-entitlement") {
      const player = requirePlayer(request);
      if (!billingSettings().testStoreEnabled) return sendJson(response, 403, { error: "Test purchases are disabled.", code: "test_store_disabled" });
      return sendJson(response, 200, { player: await gameStore.setFounderPass(player.id, true) });
    }
    if (request.method === "GET" && url.pathname === "/api/market") {
      const player = requirePlayer(request);
      const snapshot = gameStore.marketSnapshot(player.id);
      const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
      if (query) snapshot.items = snapshot.items.filter((item) => item.word.toLowerCase().includes(query));
      return sendJson(response, 200, snapshot);
    }
    if (request.method === "POST" && url.pathname === "/api/market/buy") {
      if (rateLimited(request, 80, "market-buy")) return sendJson(response, 429, { error: "Too many market requests." });
      const player = requirePlayer(request);
      const { quoteId, idempotencyKey } = await jsonBody(request);
      const purchase = await gameStore.buyLicense(player.id, quoteId, idempotencyKey);
      return sendJson(response, 200, { ...purchase, player: gameStore.publicPlayer(player.id) });
    }
    if (request.method === "POST" && url.pathname === "/api/market/activate") {
      const player = requirePlayer(request);
      const { runId, runToken, wordId } = await jsonBody(request);
      const run = runRegistry.get(runId, player.id, runToken);
      const item = MARKET_CATALOG.find((entry) => entry.id === wordId);
      if (!item || !gameStore.ownsLicense(player.id, wordId)) throw serviceError(403, "You do not own that word.", "license_missing");
      const result = { ...item, source: "market", note: "Activated from your persistent beta Word Vault." };
      runRegistry.addBend(run, result, "market");
      await runRegistry.persist(run);
      return sendJson(response, 200, { item: result, assist: run.assist, division: "open", competitive: false });
    }
    if (request.method === "GET" && url.pathname === "/api/events/current") {
      if (rateLimited(request, 120, "event-current")) return sendJson(response, 429, { error: "Too many Cosmic Event requests.", code: "event_rate_limited" });
      const player = requirePlayer(request);
      const state = gameStore.cosmicEventState(player.id);
      return sendJson(response, 200, {
        serverTime: state.serverTime,
        cosmicEvent: state.event,
        eventProgress: state.progress,
        eventReward: state.reward
      });
    }
    if (request.method === "POST" && url.pathname === "/api/events/current/claim") {
      if (rateLimited(request, 20, "event-claim")) return sendJson(response, 429, { error: "Too many Cosmic Event claims.", code: "event_rate_limited" });
      const player = requirePlayer(request);
      const body = await jsonBody(request, 512);
      if (!hasExactKeys(body, ["eventId", "weekKey"])) throw serviceError(400, "Cosmic Event claims require only eventId and weekKey.", "invalid_cosmic_event_claim");
      const state = await gameStore.claimCosmicEventReward(player.id, body);
      return sendJson(response, 200, {
        serverTime: state.serverTime,
        eventServerTime: state.eventServerTime || state.serverTime,
        cosmicEvent: state.event,
        eventProgress: state.progress,
        eventReward: state.reward
      });
    }
    if (request.method === "GET" && url.pathname === "/api/leaderboard") {
      const scope = ["daily", "weekly", "sprint", "all"].includes(url.searchParams.get("scope")) ? url.searchParams.get("scope") : "daily";
      const division = url.searchParams.get("division") === "open" ? "open" : "pure";
      const requestedChallengeId = String(url.searchParams.get("challengeId") || "").trim();
      const challengeId = /^[a-z0-9][a-z0-9:._-]{0,159}$/i.test(requestedChallengeId) ? requestedChallengeId : "";
      const requestedChallengeKey = String(url.searchParams.get("challengeKey") || "").trim();
      const challengeKey = /^ch3_[A-Za-z0-9_-]{24}$/.test(requestedChallengeKey) ? requestedChallengeKey : "";
      const mode = ["reach", "quick", "moves", "daily", "weekly", "challenge"].includes(url.searchParams.get("mode")) ? url.searchParams.get("mode") : "";
      const claimedPlayerId = request.headers["x-constellore-player"] || request.headers["x-wordforge-player"] || "";
      const playerToken = request.headers["x-constellore-token"] || request.headers["x-wordforge-token"] || "";
      const playerId = gameStore.authenticate(claimedPlayerId, playerToken)?.id || "";
      return sendJson(response, 200, gameStore.leaderboard(scope, division, Number(url.searchParams.get("limit") || 25), playerId, { challengeId, challengeKey, mode }));
    }
    if (request.method === "POST" && url.pathname === "/api/run/preview") {
      if (rateLimited(request, 160, "run-preview")) return sendJson(response, 429, { error: "Too many missions mapped." });
      const player = requirePlayer(request);
      const body = await jsonBody(request);
      const mode = ["reach", "quick", "moves", "daily", "weekly", "challenge"].includes(body.mode) ? body.mode : "reach";
      const details = officialRunDetails(mode, body.seed, body.stage, String(body.target || ""), Boolean(body.custom));
      if (!details) throw serviceError(422, "That target has no verified route yet.", "target_unavailable");
      if (mode === "daily" && gameStore.hasScore(player.id, details.challengeId)) throw serviceError(409, "Today's ranked Word has already been completed.", "daily_complete");
      const priorForfeit = details.ranked ? gameStore.forfeitedChallenge(player.id, details.challengeId) : null;
      const ranked = details.ranked && !priorForfeit;
      const game = {
        ...details.game,
        ranked,
        scoringDisabled: Boolean(priorForfeit),
        scoreEligible: !priorForfeit,
        rewardEligible: !priorForfeit,
        leaderboardEligible: Boolean(ranked)
      };
      const verified = verifiedServerRoute(game, { includeDynamic: !details.ranked });
      if (!verified) throw serviceError(422, "That target has no verified route yet.", "target_unavailable");
      const previewRequest = missionPreviewRequest(details, body);
      const previewToken = createMissionPreviewToken(player.id, previewRequest, game, verified.route);
      return sendJson(response, 200, {
        game: { ...game, routeLength: verified.route.length },
        previewToken,
        player: gameStore.publicPlayer(player.id)
      });
    }
    if (request.method === "POST" && url.pathname === "/api/run/start") {
      if (rateLimited(request, 100, "run-start")) return sendJson(response, 429, { error: "Too many runs started." });
      const player = requirePlayer(request);
      const body = await jsonBody(request);
      const preview = body.previewToken ? readMissionPreviewToken(body.previewToken, player.id) : null;
      const runRequest = preview?.request || body;
      const mode = ["reach", "quick", "moves", "daily", "weekly", "challenge"].includes(runRequest.mode) ? runRequest.mode : "reach";
      let details = officialRunDetails(mode, runRequest.seed, runRequest.stage, String(runRequest.target || ""), Boolean(runRequest.custom));
      if (!details && preview?.request.custom && preview.route.length) {
        registerDynamicRoute(preview.route, preview.request.target);
        details = officialRunDetails(mode, runRequest.seed, runRequest.stage, String(runRequest.target || ""), true);
      }
      if (!details && preview) throw serviceError(409, "This mission briefing expired or changed. Review the refreshed mission before starting.", "mission_stale");
      if (!details) throw serviceError(422, "That target has no verified route yet.", "target_unavailable");
      if (mode === "daily" && gameStore.hasScore(player.id, details.challengeId)) throw serviceError(409, "Today's ranked Word has already been completed.", "daily_complete");
      const priorForfeit = details.ranked ? gameStore.forfeitedChallenge(player.id, details.challengeId) : null;
      const ranked = details.ranked && !priorForfeit;
      const candidateGame = {
        ...details.game,
        ranked,
        scoringDisabled: Boolean(priorForfeit),
        scoreEligible: !priorForfeit,
        rewardEligible: !priorForfeit,
        leaderboardEligible: Boolean(ranked)
      };
      if (preview && missionBriefingFingerprint(candidateGame) !== preview.fingerprint) {
        throw serviceError(409, "This mission briefing expired or changed. Review the refreshed mission before starting.", "mission_stale");
      }
      const verified = verifiedServerRoute(candidateGame, { includeDynamic: !details.ranked });
      if (!verified) throw serviceError(422, "That target has no verified route yet.", "target_unavailable");
      const universeManifest = buildUniverseManifest({ seed: candidateGame.seed, validation: verified.validation });
      if (!universeManifest) throw serviceError(422, "That target has no verified universe manifest.", "target_unavailable");
      const game = { ...candidateGame, universeManifest, routeLength: verified.route.length };
      // Ranked solution steps are validated before acceptance but deliberately
      // remain outside the run snapshot and every public response.
      const scopedSolutionRoute = !ranked ? verified.route : null;
      const started = runRegistry.start(player.id, game, {
        ranked,
        challengeId: details.challengeId,
        scoringDisabled: Boolean(priorForfeit),
        forfeitReason: priorForfeit?.reason
      });
      for (const word of game.starters) started.run.discovered.set(word.toLowerCase(), originItem(word));
      if (scopedSolutionRoute) {
        started.run.solutionRoute = scopedSolutionRoute.map((step) => ({ ...step }));
        started.run.solutionRecipes = new Map(scopedSolutionRoute.map((step) => [keyFor(step.a, step.b), { ...step }]));
      }
      await runRegistry.persist(started.run);
      return sendJson(response, 201, { game, run: publicRun(started.run, started.token), player: gameStore.publicPlayer(player.id) });
    }
    if (request.method === "POST" && url.pathname === "/api/run/resume") {
      const player = requirePlayer(request);
      const body = await jsonBody(request, 1_024);
      if (!hasExactKeys(body, ["runId", "runToken"])) throw serviceError(400, "Run resume requires only runId and runToken.", "invalid_resume_request");
      const { runId, runToken } = body;
      const run = runRegistry.get(runId, player.id, runToken);
      const eventState = gameStore.cosmicEventState(player.id, new Date(run.startedAt));
      return sendJson(response, 200, {
        game: run.game,
        run: publicRun(run, runToken),
        progress: runRegistry.progress(run),
        cosmicEvent: eventState.event,
        eventProgress: eventState.progress,
        eventReward: eventState.reward,
        eventServerTime: eventState.serverTime,
        player: gameStore.publicPlayer(player.id)
      });
    }
    if (request.method === "POST" && url.pathname === "/api/run/tip") {
      if (rateLimited(request, 90, "run-tip")) return sendJson(response, 429, { error: "The constellation needs a moment." });
      const player = requirePlayer(request);
      const body = await jsonBody(request);
      if (!hasExactKeys(body, ["runId", "runToken", "tipIndex"])) {
        throw serviceError(400, "Route Signal requires only runId, runToken, and tipIndex.", "invalid_tip_request");
      }
      const run = runRegistry.get(body.runId, player.id, body.runToken);
      const route = run.solutionRoute || solutionRoute(run.game.target, { includeDynamic: !run.ranked }) || [];
      const tip = runRegistry.tip(run, body.tipIndex, ({ used, seen }) => selectRouteNavigationTip({
        words: [...run.discovered.values()],
        target: run.game.target,
        history: run.history,
        route,
        seed: run.game.seed,
        mode: run.game.mode,
        used,
        seen,
        boardWords: 1
      }));
      await runRegistry.persist(run);
      return sendJson(response, 200, tip);
    }
    if (request.method === "POST" && url.pathname === "/api/run/sense") {
      if (rateLimited(request, 60, "run-sense")) return sendJson(response, 429, { error: "The constellation needs a moment." });
      const player = requirePlayer(request);
      const { runId, runToken } = await jsonBody(request);
      const run = runRegistry.get(runId, player.id, runToken);
      if (run.submitted) throw serviceError(409, "This score was already submitted.", "already_submitted");
      if (run.completedAt) throw serviceError(409, "This orbit is already complete.", "run_complete");
      const route = run.solutionRoute || solutionRoute(run.game.target, { includeDynamic: !run.ranked });
      if (!route) throw serviceError(422, "No safe constellation signal is available for this target.", "sense_unavailable");
      const candidates = rankSenseCandidates({
        words: [...run.discovered.values()],
        target: run.game.target,
        history: run.history,
        route,
        seed: run.game.seed,
        limit: 3
      }).map((candidate) => {
        const discovered = run.discovered.get(candidate.word.toLowerCase());
        return {
          word: discovered?.word || candidate.word,
          emoji: discovered?.emoji || candidate.emoji || "",
          category: discovered?.category || null,
          signal: ["bright", "warm", "resonant"].includes(candidate.signal) ? candidate.signal : "warm"
        };
      }).slice(0, 3);
      if (!candidates.length) throw serviceError(422, "No safe constellation signal is available yet.", "sense_unavailable");

      runRegistry.sense(run);
      await runRegistry.persist(run);
      const policy = assistancePolicy(run.assist);
      const scoringDisabled = Boolean(run.scoringDisabled || run.forfeited || policy.study);
      return sendJson(response, 200, {
        candidates,
        assisted: true,
        assist: run.assist,
        scoringDisabled,
        scoreEligible: !scoringDisabled && policy.scoreEligible,
        scoreMultiplier: scoringDisabled ? 0 : policy.scoreMultiplier,
        rewardEligible: !scoringDisabled,
        leaderboardEligible: Boolean(run.ranked && !scoringDisabled),
        ranked: Boolean(run.ranked),
        division: scoringDisabled ? "study" : policy.division
      });
    }
    if (request.method === "POST" && url.pathname === "/api/run/gift") {
      if (rateLimited(request, 40, "run-gift")) return sendJson(response, 429, { error: "The cosmos needs a moment before sending another gift." });
      const player = requirePlayer(request);
      const body = await jsonBody(request, 2_048);
      if (!hasExactKeys(body, ["runId", "runToken"])) throw serviceError(400, "Word Gift requires only runId and runToken.", "invalid_gift_request");
      const run = runRegistry.get(body.runId, player.id, body.runToken);
      let item = run.giftUsed && run.giftItem ? structuredClone(run.giftItem) : null;
      if (!item) {
        if (run.submitted) throw serviceError(409, "This score was already submitted.", "already_submitted");
        if (run.completedAt) throw serviceError(409, "This orbit is already complete.", "run_complete");
        const route = run.solutionRoute || solutionRoute(run.game.target, { includeDynamic: !run.ranked });
        if (!route) throw serviceError(422, "No safe bridge word is available for this target.", "gift_unavailable");
        const selected = selectWordGift({
          route,
          discovered: [...run.discovered.values()],
          target: run.game.target,
          seed: run.game.seed
        });
        if (!selected) throw serviceError(422, "No undiscovered bridge word is available for this orbit.", "gift_unavailable");
        item = runRegistry.gift(run, {
          ...selected,
          emoji: selected.emoji || emojiByWord[selected.word] || emojiForWord(selected.word),
          category: selected.category || semanticCategoryFor(selected.word) || null
        });
      }
      await runRegistry.persist(run);
      const policy = assistancePolicy(run.assist);
      const scoringDisabled = Boolean(run.scoringDisabled || run.forfeited || policy.study);
      const publicItem = {
        word: item.word,
        emoji: item.emoji || "",
        category: item.category || null,
        source: "gift"
      };
      return sendJson(response, 200, {
        item: publicItem,
        assisted: true,
        assist: run.assist,
        scoringDisabled,
        scoreEligible: !scoringDisabled && policy.scoreEligible,
        scoreMultiplier: scoringDisabled ? 0 : policy.scoreMultiplier,
        rewardEligible: !scoringDisabled,
        leaderboardEligible: Boolean(run.ranked && !scoringDisabled),
        ranked: Boolean(run.ranked),
        division: scoringDisabled ? "study" : policy.division
      });
    }
    if (request.method === "POST" && url.pathname === "/api/run/reveal") {
      if (rateLimited(request, 30, "run-reveal")) return sendJson(response, 429, { error: "Too many answer paths requested." });
      const player = requirePlayer(request);
      const { runId, runToken } = await jsonBody(request);
      const run = runRegistry.get(runId, player.id, runToken);
      const route = run.revealRoute || run.solutionRoute || solutionRoute(run.game.target, { includeDynamic: !run.ranked });
      if (!route) throw serviceError(422, "No verified answer path is available for this target.", "route_unavailable");

      const revealedRoute = runRegistry.reveal(run, route);
      if (run.ranked) await gameStore.forfeitChallenge(player.id, run.challengeId, { reason: "reveal", runId: run.runId });
      await runRegistry.persist(run);
      return sendJson(response, 200, {
        assisted: true,
        assist: "reveal",
        completed: true,
        scoringDisabled: true,
        scoreEligible: false,
        rewardEligible: false,
        leaderboardEligible: false,
        score: 0,
        ranked: false,
        target: run.game.target,
        route: revealedRoute
      });
    }
    if (request.method === "POST" && url.pathname === "/api/run/submit") {
      const player = requirePlayer(request);
      const { runId, runToken } = await jsonBody(request);
      const run = runRegistry.get(runId, player.id, runToken);
      const challengeForfeit = run.ranked ? gameStore.forfeitedChallenge(player.id, run.challengeId) : null;
      if (run.scoringDisabled || run.forfeited || challengeForfeit) {
        const forfeitReason = run.forfeitReason || challengeForfeit?.reason || "reveal";
        if (!["sense", "gift", "reveal"].includes(run.assist)) run.assist = studyAssistForReason(forfeitReason);
        run.scoringDisabled = true;
        run.forfeited = true;
        run.forfeitReason ||= forfeitReason;
        run.forfeitedAt ||= Date.now();
        run.submitted = true;
        await runRegistry.persist(run);
        return sendJson(response, 200, {
          ranked: false,
          assisted: true,
          assist: run.assist || "reveal",
          scoringDisabled: true,
          score: 0,
          creditReward: 0,
          weeklyBonus: 0,
          reason: studyForfeitMessage(run.assist),
          player: gameStore.publicPlayer(player.id)
        });
      }
      if (!run.ranked) return sendJson(response, 200, { ranked: false, reason: "Practice runs are not uploaded." });
      if (run.submitted) {
        const division = run.assist === "none" ? "pure" : "open";
        const placement = gameStore.rankFor(run.finalChallengeKey || run.challengeId, division, player.id);
        if (placement) {
          const rewardKey = placement.entry.challengeBaseKey || placement.entry.challengeKey || run.challengeId;
          const reward = placement.provisional
            ? { creditReward: 0, weeklyBonus: 0 }
            : await gameStore.grantChallengeCredits(player.id, rewardKey, run.game.mode === "daily" ? 10 : run.game.mode === "weekly" ? 8 : 4);
          return sendJson(response, 200, {
            ranked: true,
            recovered: true,
            verifiedSignature: run.verifiedSignature || placement.entry.signature || null,
            placement,
            ...reward,
            player: gameStore.publicPlayer(player.id)
          });
        }
        // A crash could persist the run's submitted bit just before its score.
        // Re-open only that incomplete transaction so the verified path can be
        // finalized instead of being lost forever.
        run.submitted = false;
        runRegistry.checkpoint(run);
      }
      const entry = runRegistry.finalize(run, player.callsign);
      const placement = await gameStore.addScore(entry);
      const reward = entry.status === "provisional"
        ? { creditReward: 0, weeklyBonus: 0 }
        : await gameStore.grantChallengeCredits(player.id, entry.challengeBaseKey || entry.challengeKey, run.game.mode === "daily" ? 10 : run.game.mode === "weekly" ? 8 : 4);
      await runRegistry.flush();
      return sendJson(response, 201, {
        ranked: true,
        verificationStatus: entry.status,
        verifiedSignature: entry.signature,
        placement,
        ...reward,
        player: gameStore.publicPlayer(player.id)
      });
    }
    if (request.method === "POST" && url.pathname === "/api/recipe-feedback") {
      const player = requirePlayer(request);
      if (recipeFeedbackRateLimited(request, player.id)) return sendJson(response, 429, { error: "Too many recipe ratings. Let the cosmos settle.", code: "recipe_feedback_rate_limited" });
      const body = await jsonBody(request, 2_048);
      if (!hasExactKeys(body, ["runId", "runToken", "move", "rating"])) throw serviceError(400, "Recipe feedback requires only runId, runToken, move, and rating.", "invalid_recipe_feedback_request");
      const move = Number(body.move);
      const rating = sanitizeRecipeRating(body.rating);
      if (!Number.isInteger(move) || move < 1 || !rating) throw serviceError(400, "Choose a valid recipe move and rating.", "invalid_recipe_feedback");
      const run = runRegistry.get(body.runId, player.id, body.runToken);
      const step = run.history.find((entry) => entry.move === move);
      if (!step || step.revealed) throw serviceError(422, "Only a combination you actually made can be rated.", "recipe_feedback_move_unavailable");
      if (!step.feedbackEligible) throw serviceError(422, "User-directed and assisted recipes are not stored in feedback.", "recipe_feedback_private_recipe");
      const fingerprint = recipeFingerprint(step);
      if (!fingerprint) throw serviceError(422, "That recipe cannot be rated.", "recipe_feedback_move_unavailable");
      run.recipeFeedbackMoves ||= new Set();
      run.recipeFeedbackRecipes ||= new Set();
      if (run.recipeFeedbackMoves.has(move)) throw serviceError(409, "That combination has already been rated in this orbit.", "recipe_feedback_duplicate");
      if (run.recipeFeedbackRecipes.has(fingerprint)) throw serviceError(409, "That recipe has already been rated in this orbit.", "recipe_feedback_recipe_duplicate");
      run.recipeFeedbackMoves.add(move);
      run.recipeFeedbackRecipes.add(fingerprint);
      runRegistry.checkpoint(run);
      try {
        await gameStore.recordRecipeRating(step, rating);
      } catch (error) {
        run.recipeFeedbackMoves.delete(move);
        run.recipeFeedbackRecipes.delete(fingerprint);
        runRegistry.checkpoint(run);
        throw error;
      }
      return sendJson(response, 202, { accepted: true, move, rating });
    }
    if (request.method === "GET" && url.pathname === "/api/game") {
      const requested = Number(url.searchParams.get("seed"));
      const seed = Number.isFinite(requested) ? Math.abs(requested) : Math.floor(Date.now() / 86_400_000);
      const mode = url.searchParams.get("mode") || "reach";
      const target = url.searchParams.get("target") || "";
      const stage = Number(url.searchParams.get("stage") || 0);
      const game = directedServerGame(buildGameForMode(mode, seed, target, stage));
      if (!game) return sendJson(response, 422, { error: "That target has no verified route yet.", needsAi: !process.env.OPENAI_API_KEY });
      return sendJson(response, 200, game);
    }
    if (request.method === "GET" && url.pathname === "/api/analytics/summary") {
      requireAdmin(request);
      if (adminRateLimited(request, 240)) return sendJson(response, 429, { error: "Too many analytics requests." });
      return sendJson(response, 200, gameStore.analyticsSummary(url.searchParams.get("days") || 30));
    }
    if (request.method === "GET" && url.pathname === "/api/admin/recipe-feedback") {
      requireAdmin(request);
      if (adminRateLimited(request, 240)) return sendJson(response, 429, { error: "Too many analytics requests." });
      return sendJson(response, 200, gameStore.recipeRatingSummary({
        minimumVotes: url.searchParams.get("minimumVotes") || 3,
        limit: url.searchParams.get("limit") || 50
      }));
    }
    if (request.method === "GET" && url.pathname === "/api/admin/rejected-pairs") {
      requireAdmin(request);
      if (adminRateLimited(request, 240)) return sendJson(response, 429, { error: "Too many analytics requests." });
      return sendJson(response, 200, gameStore.rejectedPairSummary({
        minimumReports: url.searchParams.get("minimumReports") || 1,
        limit: url.searchParams.get("limit") || 100
      }));
    }
    if (request.method === "GET" && url.pathname === "/api/admin/ai-recipes") {
      requireAdmin(request);
      if (adminRateLimited(request, 120)) return sendJson(response, 429, { error: "Too many recipe review requests." });
      return sendJson(response, 200, {
        status: url.searchParams.get("status") || "quarantined",
        recipes: gameStore.dynamicRecipeReviewQueue({ status: url.searchParams.get("status"), limit: url.searchParams.get("limit") || 100 })
      });
    }
    if (request.method === "POST" && url.pathname === "/api/admin/ai-recipes/review") {
      requireAdmin(request);
      if (adminRateLimited(request, 60)) return sendJson(response, 429, { error: "Too many recipe review requests." });
      const body = await jsonBody(request, 1_024);
      if (!hasExactKeys(body, ["action", "proposalId", "reason"])) throw serviceError(400, "Recipe review requires proposalId, action, and reason.", "invalid_recipe_review_request");
      const recipe = await gameStore.reviewDynamicRecipe(body.proposalId, body.action, { reviewer: "admin-api", reason: body.reason });
      if (recipe.status === "promoted") cacheDynamicRecipe(recipe);
      else removeDynamicRecipe(recipe.a, recipe.b);
      return sendJson(response, 200, { recipe });
    }
    if (request.method === "POST" && url.pathname === "/api/admin/backup") {
      requireAdmin(request);
      if (adminRateLimited(request, 30)) return sendJson(response, 429, { error: "Too many backup requests." });
      const body = await jsonBody(request, 256);
      if (!hasExactKeys(body, [])) throw serviceError(400, "Backup requests do not accept fields.", "invalid_backup_request");
      const result = await createSafeBackup();
      return sendJson(response, 201, { ...result, filename: basename(result.filename) });
    }
    if (request.method === "POST" && url.pathname === "/api/analytics") {
      if (!allowAnalyticsOrigin(request, response)) return sendJson(response, 403, { error: "That origin is not allowed.", code: "analytics_origin_denied" });
      if (analyticsRateLimited(request, 240)) return sendJson(response, 429, { error: "Too many events." });
      const event = await jsonBody(request, 4_096);
      if (!analyticsEvents.has(event.name)) return sendJson(response, 400, { error: "Invalid event.", code: "invalid_analytics_event" });
      const expectedA = event.name === "combination_expected" ? safeConcept(event.properties?.a, 28) : null;
      const expectedB = event.name === "combination_expected" ? safeConcept(event.properties?.b, 28) : null;
      const allowRejectedPairPlaintext = Boolean(expectedA && expectedB && semanticCategoryFor(expectedA) && semanticCategoryFor(expectedB));
      const recorded = await gameStore.recordAnalyticsEvent(event, new Date(), { allowRejectedPairPlaintext });
      console.info(JSON.stringify({ type: "analytics_aggregate", name: event.name, day: recorded.day }));
      return sendJson(response, 202, { accepted: true });
    }
    if (request.method === "POST" && url.pathname === "/api/wish") {
      if (rateLimited(request, 60, "wish")) return sendJson(response, 429, { error: "Too many wishes. Let the cosmos settle." });
      const player = requirePlayer(request);
      const { word, runId, runToken } = await jsonBody(request);
      const run = runRegistry.get(runId, player.id, runToken);
      if (!gameStore.canUseWish(player.id)) throw serviceError(402, "Your free Practice Wish has already been used. Additional Wishes must be earned through play.", "wish_entitlement_required");
      const clean = String(word || "").trim().replace(/\s+/g, " ");
      const category = registerWishConcept(clean);
      if (!category) return sendJson(response, 422, { error: "Wish for a short, recognizable real-world concept." });
      const item = { word: clean.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()), emoji: emojiForWord(clean), source: "wish", category, note: "Bent into this universe by a Wish." };
      runRegistry.addBend(run, item, "wish");
      await gameStore.consumeWish(player.id);
      await runRegistry.flush();
      return sendJson(response, 200, { ...item, player: gameStore.publicPlayer(player.id), assist: run.assist, division: "open", competitive: false });
    }
    if (request.method === "POST" && url.pathname === "/api/custom-target") {
      if (rateLimited(request, 30, "custom-target")) return sendJson(response, 429, { error: "Too many routes requested. Try again shortly." });
      const body = await jsonBody(request, 2_048);
      if (!hasExactKeys(body, ["target"])) throw serviceError(400, "Custom targets require only a target.", "invalid_custom_target_request");
      const target = safeConcept(body.target, 28);
      if (!target || !isSafeTarget(target)) return sendJson(response, 400, { error: "Use a short, recognizable word or phrase." });
      const knownGame = directedServerGame(buildGameForMode("reach", 0, target));
      if (knownGame) return sendJson(response, 200, knownGame);
      if (!process.env.OPENAI_API_KEY) return sendJson(response, 422, { error: "This target needs the AI route planner. Add an API key or choose a suggested target.", suggestions: targetCatalog.slice(0, 6).map((entry) => entry.target) });
      requirePlayer(request);
      const generatedGame = directedServerGame(await createTargetRoute(target));
      if (!generatedGame) return sendJson(response, 422, { error: "The AI could not make a sensible, guaranteed route for that target. Try a more concrete noun." });
      return sendJson(response, 200, generatedGame);
    }
    if (request.method === "POST" && url.pathname === "/api/combine") {
      if (rateLimited(request, 180, "combine")) return sendJson(response, 429, { error: "The cosmos needs a moment." });
      const body = await jsonBody(request, 8_192);
      const allowedKeys = new Set(["a", "b", "categoryA", "categoryB", "discovered", "runId", "runToken"]);
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !allowedKeys.has(key))) {
        throw serviceError(400, "That combination request contains unsupported fields.", "invalid_combination_request");
      }
      const { a, b, categoryA, categoryB, discovered = [], runId, runToken } = body;
      const safeA = safeConcept(a, 28);
      const safeB = safeConcept(b, 28);
      if (!safeA || !safeB) return sendJson(response, 400, { error: "Choose two short, recognizable concepts first." });
      const safeDiscovered = safeDiscoveryContext(discovered, { maximumItems: 40, maximumWordLength: 28 });
      let run = null;
      let runPlayer = null;
      if (runId || runToken) {
        runPlayer = requirePlayer(request);
        run = runRegistry.get(runId, runPlayer.id, runToken);
        runRegistry.canCombine(run, safeA, safeB);
      }
      const allowedCategories = new Set(["force", "nature", "life", "structure"]);
      if (!run && !semanticCategoryFor(safeA) && allowedCategories.has(categoryA)) learnedSemanticGroups.set(safeA.toLowerCase(), categoryA);
      if (!run && !semanticCategoryFor(safeB) && allowedCategories.has(categoryB)) learnedSemanticGroups.set(safeB.toLowerCase(), categoryB);
      const combinationKey = keyFor(safeA, safeB);
      let result = recipes.get(combinationKey) || null;
      let trustedContextRecipe = result;
      if (!result && !run?.ranked) {
        const scopedRecipe = run?.solutionRecipes?.get(combinationKey) || null;
        result = scopedRecipe || dynamicRecipes.get(combinationKey) || null;
        // Only a run-scoped dynamic recipe has already passed full target-route
        // validation. Other AI/semantic results remain playable but unannotated.
        trustedContextRecipe = scopedRecipe;
      }
      if (!result && !run?.ranked) {
        try {
          if (process.env.OPENAI_API_KEY) requirePlayer(request);
          result = await aiCombination(safeA, safeB, safeDiscovered);
        }
        catch (error) { console.error(error.message); }
      }
      if (!result && !run?.ranked) result = contextualCombination(safeA, safeB);
      if (!result) {
        let rejectedAttempt = null;
        if (run) {
          rejectedAttempt = runRegistry.recordRejectedAttempt(run, { a: safeA, b: safeB });
          await runRegistry.persist(run);
        }
        return sendJson(response, 422, {
          error: "Those ideas do not form a meaningful concept yet.",
          code: "combination_missing",
          rejected: true,
          ...(run ? {
            attempts: run.attempts,
            rejectedAttempts: run.rejectedAttempts,
            errorless: false,
            pairFingerprint: rejectedAttempt?.pairFingerprint
          } : {})
        });
      }
      const { word, emoji, note, source } = result;
      const category = semanticCategoryFor(word) || registerWishConcept(word);
      let responseResult = {
        word,
        emoji,
        note,
        source,
        category,
        provisional: ["ai", "ai-route"].includes(source) && result.status !== "promoted",
        recipeStatus: result.status || (["ai", "ai-route"].includes(source) ? "quarantine" : "verified")
      };
      let universeContext = null;
      if (run) {
        runRegistry.canCombine(run, safeA, safeB);
        const twist = selectCosmicTwist({
          a: safeA,
          b: safeB,
          canonicalResult: responseResult,
          target: run.game.target,
          mode: run.game.mode,
          seed: cosmicTwistSeedFor(run.game),
          moveNumber: run.moves + 1,
          twistUsed: run.twistUsed,
          discovered: run.discovered.keys()
        });
        if (twist) {
          const twistCategory = registerSemanticConcept(twist.word, twist.category) || twist.category;
          responseResult = { ...twist, category: twistCategory };
        }
        if (trustedContextRecipe) {
          const annotation = annotateUniverseResult({
            universe: run.game.universe,
            a: safeA,
            b: safeB,
            result: responseResult,
            recipes: [{ a: safeA, b: safeB, ...trustedContextRecipe, category }]
          });
          universeContext = annotation?.context || null;
        }
        const historyEntry = runRegistry.recordCombination(run, responseResult, { a: safeA, b: safeB });
        await runRegistry.persist(run);
        responseResult = {
          ...responseResult,
          feedbackEligible: Boolean(historyEntry?.feedbackEligible),
          newDiscovery: historyEntry?.newDiscovery === true,
          progressionEligible: historyEntry?.progressionEligible === true,
          eventEligible: historyEntry?.eventEligible === true
        };
      }
      const eventState = run && runPlayer ? gameStore.cosmicEventState(runPlayer.id, new Date(run.startedAt)) : null;
      const runPolicy = assistancePolicy(run?.assist || "none");
      const scoringDisabled = Boolean(run && (run.scoringDisabled || run.forfeited || runPolicy.study));
      return sendJson(response, 200, {
        ...responseResult,
        ...(universeContext ? { universeContext } : {}),
        completed: Boolean(run?.completedAt),
        ranked: Boolean(run?.ranked),
        assist: run?.assist || "none",
        scoringDisabled,
        scoreEligible: !scoringDisabled && runPolicy.scoreEligible,
        scoreMultiplier: scoringDisabled ? 0 : runPolicy.scoreMultiplier,
        division: scoringDisabled ? "study" : runPolicy.division,
        ...(eventState ? {
          cosmicEvent: eventState.event,
          eventProgress: eventState.progress,
          eventReward: eventState.reward,
          eventServerTime: eventState.serverTime
        } : {})
      });
    }
    if (!["GET", "HEAD"].includes(request.method)) return sendJson(response, 404, { error: "Not found" });

    const siteAssets = new Map([
      ["/", "index.html"],
      ["/website.css", "styles.css"],
      ["/website.js", "site.js"],
      ["/privacy.html", "privacy.html"],
      ["/terms.html", "terms.html"],
      ["/support.html", "support.html"],
      ["/robots.txt", "robots.txt"]
    ]);
    const isPlayDocument = url.pathname === "/play" || url.pathname === "/play/";
    const isPlayServiceWorker = url.pathname === "/play/service-worker.js";
    const requestedSiteAsset = siteAssets.get(url.pathname);
    const base = requestedSiteAsset ? websiteRoot : root;
    const pathname = requestedSiteAsset || (isPlayDocument ? "index.html" : isPlayServiceWorker ? "service-worker.js" : url.pathname);
    const filePath = normalize(join(base, pathname));
    if (!filePath.startsWith(base)) return sendJson(response, 403, { error: "Forbidden" });
    const file = await readFile(filePath);
    const extension = extname(filePath);
    const cacheControl = extension === ".html" || extension === ".js" || extension === ".mjs" || isPlayServiceWorker ? "no-cache" : "public, max-age=300";
    response.writeHead(200, { "Content-Type": mime[extension] || "application/octet-stream", "Cache-Control": cacheControl, "Content-Length": file.length });
    response.end(request.method === "HEAD" ? undefined : file);
  } catch (error) {
    if (error.code === "ENOENT") return sendJson(response, 404, { error: "Not found" });
    if (error.statusCode) return sendJson(response, error.statusCode, { error: error.message, code: error.serviceCode || error.code || "request_error", ...(error.details ? { details: error.details } : {}) });
    structuredLog("error", "request_error", { requestId, method: request.method, code: error.code || "internal_error", status: 500 });
    sendJson(response, 500, { error: "Something went wrong in the cosmos." });
  }
});

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

let backupTimer = null;
let shutdownPromise = null;

export function shutdownServer(signal = "shutdown") {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    structuredLog("info", "shutdown_started", { signal });
    if (backupTimer) clearInterval(backupTimer);
    server.closeIdleConnections?.();
    const closePromise = new Promise((resolve) => {
      if (!server.listening) return resolve();
      server.close(() => resolve());
    });
    const forced = setTimeout(() => server.closeAllConnections?.(), 10_000);
    forced.unref();
    await Promise.allSettled([runRegistry.flush(), closePromise]);
    clearTimeout(forced);
    structuredLog("info", "shutdown_completed", { signal });
  })();
  return shutdownPromise;
}

if (isMainModule) {
  try {
    await createSafeBackup();
  } catch (error) {
    structuredLog("error", "backup_failed", { code: error.code || "backup_failed" });
  }
  backupTimer = setInterval(() => {
    void createSafeBackup().catch((error) => structuredLog("error", "backup_failed", { code: error.code || "backup_failed" }));
  }, 24 * 60 * 60_000);
  backupTimer.unref();
  process.once("SIGTERM", () => void shutdownServer("SIGTERM").then(() => { process.exitCode = 0; }));
  process.once("SIGINT", () => void shutdownServer("SIGINT").then(() => { process.exitCode = 0; }));
  server.listen(port, () => structuredLog("info", "server_started", { port, version: APP_VERSION, build: BUILD_VERSION, graphVersion: GRAPH_VERSION, storage: gameStore.storageHealth().kind }));
}
