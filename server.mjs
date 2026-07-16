import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { GameStore, MARKET_CATALOG, RunRegistry, isoWeekKey, serviceError } from "./game-services.mjs";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const root = join(projectRoot, "public");
const websiteRoot = join(projectRoot, "Website");
const port = Number(process.env.PORT || 4173);
const isMainModule = Boolean(process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1]));
const constelloreStorePath = join(projectRoot, "data", "constellore.json");
const legacyStorePath = join(projectRoot, "data", "wordforge.json");
const localStorePath = existsSync(constelloreStorePath) || !existsSync(legacyStorePath) ? constelloreStorePath : legacyStorePath;
const storePath = process.env.CONSTELLORE_DATA_PATH || process.env.WORDFORGE_DATA_PATH || (isMainModule ? localStorePath : ":memory:");
const gameStore = await new GameStore(storePath).init();
const runRegistry = new RunRegistry(gameStore);
const STARTERS = ["Earth", "Water", "Fire", "Air"];
const recipes = new Map();
const dynamicRecipes = new Map();

const add = (a, b, word, emoji, note) => {
  recipes.set(keyFor(a, b), { a, b, word, emoji, note, source: "world" });
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
    ["Air", "Oxidation", "🟠", "Air reacting with metal causes oxidation."],
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

const targetCatalog = [
  { target: "Rainbow", emoji: "🌈", clue: "Color born where rain meets light.", tier: 1 },
  { target: "Forest", emoji: "🌲", clue: "One becomes many, rooted together.", tier: 1 },
  { target: "Phoenix", emoji: "🔥", clue: "A legendary creature where wings meet flame.", tier: 2 },
  { target: "Telescope", emoji: "🔭", clue: "Shape sand with heat, then look upward.", tier: 2 },
  { target: "Lightning", emoji: "🌩️", clue: "Power gathering inside violent weather.", tier: 2 },
  { target: "City", emoji: "🏙️", clue: "Build outward: material, shelter, settlement.", tier: 3 },
  { target: "Rocket", emoji: "🚀", clue: "A machine made to leave the sky behind.", tier: 3 },
  { target: "Space Station", emoji: "🛰️", clue: "Build a home, build a rocket, then leave Earth.", tier: 4 }
];

const emojiByWord = { Earth: "🌍", Water: "💧", Fire: "🔥", Air: "💨" };

const cosmicLaws = [
  { id: "first-light", name: "First Light", description: "Your first new discovery earns double Stardust." },
  { id: "twin-stars", name: "Twin Stars", description: "Combining identical ideas earns a bonus." },
  { id: "deep-space", name: "Deep Space", description: "Finish with eight or fewer moves for a bonus." },
  { id: "bright-path", name: "Bright Path", description: "Every new discovery strengthens this run's reward." }
];

const weeklyTargets = [
  ["Forest", "Telescope", "Rocket"],
  ["Rainbow", "Lightning", "City"],
  ["Telescope", "Phoenix", "Space Station"],
  ["Forest", "City", "Rocket"]
];

const semanticGroups = {
  force: new Set(["air", "water", "fire", "steam", "energy", "light", "power", "storm", "lightning", "electricity", "laser", "wildfire", "firestorm", "hurricane", "tornado", "weather", "smoke", "hydrogen", "sun", "reflection", "blizzard", "superstorm", "spectrum", "magic", "time", "love", "music", "dream"]),
  nature: new Set(["earth", "mud", "mist", "dust", "lava", "stone", "cloud", "rain", "clay", "mountain", "snow", "ice", "sand", "sky", "star", "flood", "geyser", "pebble", "shadow", "glacier", "iceberg", "dune", "beach", "desert", "horizon", "space", "galaxy", "constellation", "meteor", "river", "smog", "canal", "phenomenon", "habitat", "rainbow", "ash", "field", "swamp", "quagmire", "volcano", "pond", "fossil", "color", "moon", "planet", "universe", "world"]),
  life: new Set(["life", "species", "animal", "plant", "tree", "forest", "bird", "fish", "flower", "seed", "leaf", "root", "rainforest", "ecosystem", "flying fish", "school", "evolution", "phoenix", "jungle", "garden", "starfish", "wildlife", "dragon", "extinction", "human"]),
  structure: new Set(["brick", "pottery", "glass", "telescope", "wall", "house", "village", "city", "metal", "machine", "rocket", "space station", "dam", "kiln", "vase", "sculpture", "aquarium", "lens", "observatory", "firewall", "fortress", "fireplace", "houseboat", "home", "port", "megacity", "steel", "alloy", "plane", "engine", "factory", "jet", "spacecraft", "fleet", "technology", "civilization", "landmark", "infrastructure", "prism", "window", "balloon", "rust", "barbecue", "computer", "sword", "robot"])
};

for (const item of MARKET_CATALOG) semanticGroups[item.category]?.add(item.word.toLowerCase());

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

export function curatedCombination(a, b) {
  return dynamicRecipes.get(keyFor(a, b)) || recipes.get(keyFor(a, b)) || null;
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
    const target = targetCatalog.find((entry) => entry.target === "Space Station");
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
    reach: targetCatalog.filter((entry) => entry.tier <= 3),
    quick: targetCatalog.filter((entry) => entry.tier >= 1 && entry.tier <= 2),
    moves: targetCatalog.filter((entry) => entry.tier >= 2 && entry.tier <= 3),
    challenge: targetCatalog.filter((entry) => entry.tier >= 1 && entry.tier <= 3)
  };
  const pool = pools[normalizedMode];
  return gameFor(pool[Math.abs(seed) % pool.length], normalizedMode, { seed: Math.abs(seed) });
}

function emojiForWord(word) {
  const recipe = [...recipes.values(), ...dynamicRecipes.values()].find((item) => item.word.toLowerCase() === word.toLowerCase());
  return recipe?.emoji || "✨";
}

async function responseJson(body) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
  const payload = await response.json();
  const outputText = payload.output_text ?? payload.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;
  if (!outputText) throw new Error("The AI returned no structured result.");
  return JSON.parse(outputText);
}

async function aiCombination(a, b, discovered) {
  if (!process.env.OPENAI_API_KEY) return null;
  const result = await responseJson({
    model: process.env.OPENAI_MODEL || "gpt-5.4-nano",
    instructions: "You power a family-friendly word-combination game. Return one real, recognizable concept: a common noun, proper noun, natural phenomenon, invention, place, creature, or established idea. Never concatenate input words, invent gibberish, repeat syllables, add 'craft', or return either input unchanged. If the connection is indirect, use a well-known cultural association. Keep the explanation under 12 words.",
    input: `Combine ${JSON.stringify(a)} + ${JSON.stringify(b)}. Already discovered: ${discovered.slice(-30).join(", ")}.`,
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
  if (!isSensibleResult(result, a, b)) return null;
  const cached = { ...result, a, b, source: "ai" };
  dynamicRecipes.set(keyFor(a, b), cached);
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
  const plan = await responseJson({
    model: process.env.OPENAI_MODEL || "gpt-5.4-nano",
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
  if (!validateRoute(plan.steps, cleanTarget)) return null;
  for (const step of plan.steps) dynamicRecipes.set(keyFor(step.a, step.b), { ...step, source: "ai-route" });
  const last = plan.steps.at(-1);
  return gameFor({ target: last.word, emoji: last.emoji, clue: "A destination chosen by you. The universe has made a path.", tier: 3 }, "reach");
}

function validateRoute(steps, target) {
  if (!Array.isArray(steps) || steps.length < 2 || steps.length > 9) return false;
  const available = new Set(STARTERS.map((word) => word.toLowerCase()));
  for (const step of steps) {
    if (!available.has(String(step.a).toLowerCase()) || !available.has(String(step.b).toLowerCase())) return false;
    if (!isSensibleResult(step, step.a, step.b)) return false;
    available.add(step.word.toLowerCase());
  }
  return steps.at(-1).word.toLowerCase() === target.toLowerCase();
}

function isSafeTarget(target) {
  return target.length >= 2 && target.length <= 28 && /^[\p{L}\p{N}][\p{L}\p{N} '&-]*$/u.test(target) && target.split(/\s+/).length <= 4;
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
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

const requestWindows = new Map();
const analyticsEvents = new Set([
  "app_opened", "run_started", "combination_completed", "combination_rejected", "target_reached",
  "run_failed", "wish_opened", "wish_used", "paywall_viewed", "checkout_started", "share_created",
  "challenge_opened", "theme_changed", "pwa_installed", "leaderboard_opened", "score_uploaded",
  "market_opened", "market_searched", "word_purchased", "market_word_used", "credit_pack_opened"
]);

function rateLimited(request, limit = 180) {
  const key = request.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = requestWindows.get(key);
  if (!current || now - current.startedAt > 60_000) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > limit;
}

function setSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'");
}

function requirePlayer(request) {
  const playerId = request.headers["x-constellore-player"] || request.headers["x-wordforge-player"];
  const playerToken = request.headers["x-constellore-token"] || request.headers["x-wordforge-token"];
  const player = gameStore.authenticate(playerId, playerToken);
  if (!player) throw serviceError(401, "Your player session is no longer valid.", "invalid_player");
  return player;
}

function billingSettings() {
  let checkoutUrl = "";
  try {
    const candidate = new URL(process.env.NEBULA_CHECKOUT_URL || "");
    if (candidate.protocol === "https:" || (candidate.protocol === "http:" && ["localhost", "127.0.0.1"].includes(candidate.hostname))) checkoutUrl = candidate.toString();
  } catch { /* Billing remains disabled until a valid URL is configured. */ }
  return {
    checkoutUrl,
    billingEnabled: Boolean(checkoutUrl),
    testStoreEnabled: process.env.NODE_ENV !== "production" && !checkoutUrl,
    creditPacks: [
      { id: "star_credits_300", credits: 300, price: "€1.99" },
      { id: "star_credits_900", credits: 900, price: "€4.99" },
      { id: "star_credits_2000", credits: 2000, price: "€9.99" }
    ]
  };
}

function officialRunDetails(mode, requestedSeed, stage = 0, requestedTarget = "", custom = false) {
  const today = new Date().toISOString().slice(0, 10);
  const week = isoWeekKey();
  const safeStage = Math.min(2, Math.max(0, Number(stage) || 0));
  const ranked = !custom && ["daily", "weekly", "quick", "moves"].includes(mode);
  let seed = Number.isFinite(Number(requestedSeed)) ? Math.abs(Number(requestedSeed)) : stableHash(`${Date.now()}:${mode}`);
  if (mode === "daily") seed = stableHash(`daily:${today}`);
  if (mode === "weekly") seed = stableHash(`weekly:${week}`);
  if (["quick", "moves"].includes(mode)) seed = stableHash(`${mode}:${today}`);
  const target = ["challenge", "reach"].includes(mode) ? requestedTarget : "";
  const game = buildGameForMode(mode, seed, target, safeStage);
  if (!game) return null;
  const challengeId = mode === "daily" ? `daily:${today}`
    : mode === "weekly" ? `weekly:${week}:${safeStage}`
      : ["quick", "moves"].includes(mode) ? `${mode}:${today}`
        : `practice:${mode}:${seed}`;
  return { game: { ...game, ranked, challengeId }, ranked, challengeId, seed };
}

function publicRun(run, token) {
  return {
    id: run.runId,
    token,
    ranked: run.ranked,
    challengeId: run.challengeId,
    startedAt: new Date(run.startedAt).toISOString(),
    deadlineAt: run.game.timeLimit ? new Date(run.startedAt + run.game.timeLimit * 1000).toISOString() : null
  };
}

async function jsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 50_000) {
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
  setSecurityHeaders(response);
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (["GET", "HEAD"].includes(request.method) && url.pathname === "/play") {
      response.writeHead(308, { Location: "/play/", "Cache-Control": "no-cache" });
      return response.end();
    }
    if (request.method === "GET" && url.pathname === "/healthz") return sendJson(response, 200, { ok: true, game: "Constellore", version: "1.3.0" });
    if (request.method === "GET" && url.pathname === "/api/config") {
      const billing = billingSettings();
      return sendJson(response, 200, {
        billingEnabled: billing.billingEnabled,
        checkoutUrl: billing.checkoutUrl,
        testStoreEnabled: billing.testStoreEnabled,
        creditPacks: billing.creditPacks,
        rewardedAdsEnabled: process.env.REWARDED_ADS_ENABLED === "true",
        founderPrice: process.env.NEBULA_PRICE || "€6.99",
        gameName: "Constellore",
        publisher: "Oxyfel Games",
        aiEnabled: Boolean(process.env.OPENAI_API_KEY)
      });
    }
    if (request.method === "POST" && url.pathname === "/api/player/register") {
      if (rateLimited(request, 20)) return sendJson(response, 429, { error: "Too many player registrations." });
      const player = await gameStore.registerPlayer();
      return sendJson(response, 201, { player, playerToken: gameStore.tokenForPlayer(player.id) });
    }
    if (request.method === "GET" && url.pathname === "/api/player") {
      const player = requirePlayer(request);
      return sendJson(response, 200, { player: gameStore.publicPlayer(player.id) });
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
      if (rateLimited(request, 80)) return sendJson(response, 429, { error: "Too many market requests." });
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
      const result = { ...item, source: "market", note: "Activated from your permanent Word Vault." };
      runRegistry.addBend(run, result, "market");
      return sendJson(response, 200, { item: result, assist: run.assist });
    }
    if (request.method === "GET" && url.pathname === "/api/leaderboard") {
      const scope = ["daily", "weekly", "sprint", "all"].includes(url.searchParams.get("scope")) ? url.searchParams.get("scope") : "daily";
      const division = url.searchParams.get("division") === "open" ? "open" : "pure";
      const playerId = request.headers["x-constellore-player"] || request.headers["x-wordforge-player"] || "";
      return sendJson(response, 200, gameStore.leaderboard(scope, division, Number(url.searchParams.get("limit") || 25), playerId));
    }
    if (request.method === "POST" && url.pathname === "/api/run/start") {
      if (rateLimited(request, 100)) return sendJson(response, 429, { error: "Too many runs started." });
      const player = requirePlayer(request);
      const body = await jsonBody(request);
      const mode = ["reach", "quick", "moves", "daily", "weekly", "challenge"].includes(body.mode) ? body.mode : "reach";
      const details = officialRunDetails(mode, body.seed, body.stage, String(body.target || ""), Boolean(body.custom));
      if (!details) throw serviceError(422, "That target has no verified route yet.", "target_unavailable");
      if (mode === "daily" && gameStore.hasScore(player.id, details.challengeId)) throw serviceError(409, "Today's ranked Word has already been completed.", "daily_complete");
      const started = runRegistry.start(player.id, details.game, { ranked: details.ranked, challengeId: details.challengeId });
      return sendJson(response, 201, { game: details.game, run: publicRun(started.run, started.token), player: gameStore.publicPlayer(player.id) });
    }
    if (request.method === "POST" && url.pathname === "/api/run/submit") {
      const player = requirePlayer(request);
      const { runId, runToken } = await jsonBody(request);
      const run = runRegistry.get(runId, player.id, runToken);
      if (!run.ranked) return sendJson(response, 200, { ranked: false, reason: "Practice runs are not uploaded." });
      const entry = runRegistry.finalize(run, player.callsign);
      const placement = await gameStore.addScore(entry);
      const reward = await gameStore.grantChallengeCredits(player.id, run.challengeId, run.game.mode === "daily" ? 10 : run.game.mode === "weekly" ? 8 : 4);
      return sendJson(response, 201, { ranked: true, placement, ...reward, player: gameStore.publicPlayer(player.id) });
    }
    if (request.method === "GET" && url.pathname === "/api/game") {
      const requested = Number(url.searchParams.get("seed"));
      const seed = Number.isFinite(requested) ? Math.abs(requested) : Math.floor(Date.now() / 86_400_000);
      const mode = url.searchParams.get("mode") || "reach";
      const target = url.searchParams.get("target") || "";
      const stage = Number(url.searchParams.get("stage") || 0);
      const game = buildGameForMode(mode, seed, target, stage);
      if (!game) return sendJson(response, 422, { error: "That target has no verified route yet.", needsAi: !process.env.OPENAI_API_KEY });
      return sendJson(response, 200, game);
    }
    if (request.method === "POST" && url.pathname === "/api/analytics") {
      if (rateLimited(request, 240)) return sendJson(response, 429, { error: "Too many events." });
      const event = await jsonBody(request);
      if (!analyticsEvents.has(event.name) || typeof event.sessionId !== "string" || event.sessionId.length > 64) return sendJson(response, 400, { error: "Invalid event." });
      const safeEvent = {
        name: event.name,
        sessionId: event.sessionId,
        at: new Date().toISOString(),
        properties: event.properties && typeof event.properties === "object" ? Object.fromEntries(Object.entries(event.properties).slice(0, 16).map(([key, value]) => [String(key).slice(0, 32), typeof value === "string" ? value.slice(0, 80) : typeof value === "number" || typeof value === "boolean" || value === null ? value : String(value).slice(0, 80)])) : {}
      };
      console.info(JSON.stringify({ type: "analytics", ...safeEvent }));
      return sendJson(response, 202, { accepted: true });
    }
    if (request.method === "POST" && url.pathname === "/api/wish") {
      if (rateLimited(request, 60)) return sendJson(response, 429, { error: "Too many wishes. Let the cosmos settle." });
      const player = requirePlayer(request);
      const { word, runId, runToken } = await jsonBody(request);
      const run = runRegistry.get(runId, player.id, runToken);
      if (!gameStore.canUseWish(player.id)) throw serviceError(402, player.founderPass ? "Your next personal Wish arrives tomorrow." : "A Founder's Pass is required for another personal Wish.", "wish_entitlement_required");
      const clean = String(word || "").trim().replace(/\s+/g, " ");
      const category = registerWishConcept(clean);
      if (!category) return sendJson(response, 422, { error: "Wish for a short, recognizable real-world concept." });
      const item = { word: clean.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()), emoji: emojiForWord(clean), source: "wish", category, note: "Bent into this universe by a Wish." };
      runRegistry.addBend(run, item, "wish");
      await gameStore.consumeWish(player.id);
      return sendJson(response, 200, { ...item, player: gameStore.publicPlayer(player.id), assist: run.assist });
    }
    if (request.method === "POST" && url.pathname === "/api/custom-target") {
      if (rateLimited(request, 30)) return sendJson(response, 429, { error: "Too many routes requested. Try again shortly." });
      const { target } = await jsonBody(request);
      if (typeof target !== "string" || !isSafeTarget(target.trim())) return sendJson(response, 400, { error: "Use a short, recognizable word or phrase." });
      const knownGame = buildGameForMode("reach", 0, target);
      if (knownGame) return sendJson(response, 200, knownGame);
      if (!process.env.OPENAI_API_KEY) return sendJson(response, 422, { error: "This target needs the AI route planner. Add an API key or choose a suggested target.", suggestions: targetCatalog.slice(0, 6).map((entry) => entry.target) });
      const generatedGame = await createTargetRoute(target);
      if (!generatedGame) return sendJson(response, 422, { error: "The AI could not make a sensible, guaranteed route for that target. Try a more concrete noun." });
      return sendJson(response, 200, generatedGame);
    }
    if (request.method === "POST" && url.pathname === "/api/combine") {
      if (rateLimited(request, 180)) return sendJson(response, 429, { error: "The cosmos needs a moment." });
      const body = await jsonBody(request);
      const { a, b, categoryA, categoryB, discovered = [], runId, runToken } = body;
      if (typeof a !== "string" || typeof b !== "string" || !a.trim() || !b.trim()) return sendJson(response, 400, { error: "Choose two words first." });
      let run = null;
      if (runId || runToken) {
        const player = requirePlayer(request);
        run = runRegistry.get(runId, player.id, runToken);
        runRegistry.canCombine(run, a, b);
      }
      const allowedCategories = new Set(["force", "nature", "life", "structure"]);
      if (!run && !semanticCategoryFor(a) && allowedCategories.has(categoryA)) learnedSemanticGroups.set(a.trim().toLowerCase(), categoryA);
      if (!run && !semanticCategoryFor(b) && allowedCategories.has(categoryB)) learnedSemanticGroups.set(b.trim().toLowerCase(), categoryB);
      let result = run?.ranked ? recipes.get(keyFor(a, b)) || null : curatedCombination(a, b);
      if (!result && !run?.ranked) {
        try { result = await aiCombination(a, b, Array.isArray(discovered) ? discovered : []); }
        catch (error) { console.error(error.message); }
      }
      if (!result) result = contextualCombination(a, b);
      if (!result) return sendJson(response, 422, { error: "Those ideas do not form a meaningful concept yet.", rejected: true });
      const { word, emoji, note, source } = result;
      const category = semanticCategoryFor(word) || registerWishConcept(word);
      const responseResult = { word, emoji, note, source, category };
      if (run) runRegistry.recordCombination(run, responseResult);
      return sendJson(response, 200, { ...responseResult, completed: Boolean(run?.completedAt), ranked: Boolean(run?.ranked), division: run?.assist === "none" ? "pure" : "open" });
    }
    if (!["GET", "HEAD"].includes(request.method)) return sendJson(response, 404, { error: "Not found" });

    const siteAssets = new Map([
      ["/", "index.html"],
      ["/website.css", "styles.css"],
      ["/website.js", "site.js"],
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
    const cacheControl = extension === ".html" || extension === ".js" || isPlayServiceWorker ? "no-cache" : "public, max-age=300";
    response.writeHead(200, { "Content-Type": mime[extension] || "application/octet-stream", "Cache-Control": cacheControl, "Content-Length": file.length });
    response.end(request.method === "HEAD" ? undefined : file);
  } catch (error) {
    if (error.code === "ENOENT") return sendJson(response, 404, { error: "Not found" });
    if (error.statusCode) return sendJson(response, error.statusCode, { error: error.message, code: error.serviceCode || "request_error" });
    console.error(error);
    sendJson(response, 500, { error: "Something went wrong in the cosmos." });
  }
});

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

if (isMainModule) {
  server.listen(port, () => console.log(`Constellore by Oxyfel Games is running at http://localhost:${port}`));
}
