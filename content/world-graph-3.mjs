export const WORLD_GRAPH_SCHEMA_VERSION = 3;
export const WORLD_GRAPH_VERSION = "3.0.0-beta.2";

// The breadth pack makes the stricter editorial ceiling practical: no more
// than roughly one in five reachable concepts may remain a non-terminal
// cul-de-sac in a release build.
export const WORLD_GRAPH_BETA_MAX_PROBLEMATIC_DEAD_ENDS = 140;

export const CONCEPT_STATUS = Object.freeze({
  APPROVED: "approved",
  PROVISIONAL: "provisional",
  RETIRED: "retired"
});

export const RECIPE_PROVENANCE = Object.freeze({
  EDITORIAL: "editorial",
  LEGACY: "legacy",
  AI_PROPOSAL: "ai-proposal",
  PLAYER_REPORT: "player-report"
});

// Complete discoveries which are satisfying destinations in their own right.
// Marking these explicitly prevents the editor from demanding contrived
// continuations merely to make every concept feed another recipe.
export const INTENTIONAL_ENDPOINTS = Object.freeze([
  "Absorption", "Aerodynamics", "Agriculture", "Anatomy", "Anemone", "Archipelago", "Arctic Char",
  "Asteroid Belt", "Astrophysics", "Badlands", "Barbecue", "Binary Star", "Biodiversity", "Biology",
  "Bioluminescence", "Blizzard", "Blue Sky", "Botany", "Caldera", "Camel", "Caramel", "Cereal",
  "Clear Skies", "Climate", "Cloud Forest", "Combustion", "Concert", "Confluence", "Continent", "Cooking",
  "Cooling", "Cosmic Dust", "Cosmos", "Countryside", "Dandelion", "Daylight", "Deep Field", "Delta",
  "Dessert", "Dew", "Duck", "Dune Grass", "Dust Devil", "Dust Storm", "Eclipse", "Ecology",
  "Electric Shock", "Emissions", "Engineering", "Eruption", "Estuary", "Evaporation", "Extinction", "Feast",
  "Fireball", "Firestorm", "Flash Flood", "Flying Fish", "Fogbow", "Folk Music", "Fossil Record",
  "Fruit Salad", "Full Moon", "Fusion", "Gallery", "Garnish", "Geology", "Glacial Lake", "Glory", "Goat",
  "Grounding", "Hailstorm", "Halo", "Hay Fever", "Haze", "Heron", "Hibernation", "High Voltage",
  "Highlands", "Horizon", "Hummingbird", "Hurricane", "Hydrology", "Ice Cap", "Ice Planet", "Ice Shelf",
  "Iceberg", "Iced Tea", "Icefall", "Inversion", "Jam", "Juice", "Koi", "Lotus", "Mangrove",
  "Marram Grass", "Meadow", "Meltwater", "Meteor Shower", "Meteorology", "Monkey", "Montane Forest",
  "Moon Garden", "Moss", "Mountain Lion", "Nectar", "Night Sky", "Oasis", "Ocean World", "Oceanography",
  "Orographic Rain", "Otter", "Pack Ice", "Parrot", "Pasture", "Penguin", "Petrified Wood",
  "Photosynthesis", "Physics", "Picnic", "Pigeon", "Pillow Lava", "Planetary Ring", "Planetary Science",
  "Planetary System", "Plankton", "Plasma", "Plateau", "Polar Bear", "Pollination", "Pollution", "Porridge",
  "Pyrography", "Quagmire", "Rain Streaks", "Rapids", "Reading", "Reflection", "Refraction", "Research",
  "Rustle", "Salad", "Sandstorm", "Sandwich", "Sea Breeze", "Sea Glass", "Seabird", "Seafood", "Seaweed",
  "Shoreline", "Silver Lining", "Smog", "Smoked Fish", "Snowdrift", "Solar Flare", "Sorbet", "Soup",
  "Spectrum", "Stargazing", "Star Nursery", "Starfish", "Starlight", "Sunbeam", "Sunflower", "Sunlight",
  "Sunshower", "Superstorm", "Surf", "Sushi", "Sweet Tea", "Tempest", "Thaw", "Thermodynamics",
  "Thunderhead", "Tide", "Tiger", "Toast", "Toucan", "Tourism", "Trout", "Tuff", "Tuna", "Universe",
  "Updraft", "Urban Ecology", "Urban Wildlife", "Vegetables", "Ventifact", "Volcanic Planet", "Watercolor",
  "Watershed", "Weathering", "Whale", "Wildflower", "Will-o'-the-wisp", "Wind Chill", "Woodland Stream",
  "World", "Zoology"
]);

const cleanWord = (value) => String(value || "").trim().replace(/\s+/g, " ");
const normalizedWord = (value) => cleanWord(value).toLocaleLowerCase("en-US");

export function conceptIdFor(word) {
  const slug = normalizedWord(word)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `concept:${slug || "unknown"}`;
}

export function worldGraphPairKey(a, b) {
  return [normalizedWord(a), normalizedWord(b)].sort().join("+");
}

const freezeRecipe = ({ a, b, word, emoji, note, tags = [] }) => Object.freeze({
  id: `recipe:${worldGraphPairKey(a, b).replaceAll(" ", "-")}`,
  a: cleanWord(a),
  b: cleanWord(b),
  word: cleanWord(word),
  emoji,
  note,
  ingredients: Object.freeze([conceptIdFor(a), conceptIdFor(b)]),
  result: conceptIdFor(word),
  semanticTags: Object.freeze([...new Set(tags.map(normalizedWord).filter(Boolean))]),
  provenance: Object.freeze({
    kind: RECIPE_PROVENANCE.EDITORIAL,
    source: "constellore-world-graph-3",
    reviewed: true
  }),
  status: CONCEPT_STATUS.APPROVED,
  rankedEligible: true,
  source: "expanded"
});

// These are intentionally conservative, deterministic connections. Each pair
// was selected because a player can explain the result without category
// roulette. They extend the existing authored graph rather than replacing it.
export const WORLD_GRAPH_3_RECIPES = Object.freeze([
  freezeRecipe({ a: "Water", b: "Wind", word: "Wave", emoji: "🌊", note: "Wind transfers motion into water and raises a wave.", tags: ["water", "weather"] }),
  freezeRecipe({ a: "Sky", b: "Stone", word: "Moon", emoji: "🌙", note: "A pale stone suspended in the sky evokes the moon.", tags: ["space", "land"] }),
  freezeRecipe({ a: "Sky", b: "Shadow", word: "Night", emoji: "🌃", note: "Shadow spreading across the sky becomes night.", tags: ["night", "air"] }),
  freezeRecipe({ a: "Electricity", b: "Network", word: "Phone", emoji: "📱", note: "An electrical device connected to a network becomes a phone.", tags: ["technology", "communication"] }),
  freezeRecipe({ a: "Book", b: "Ruins", word: "History", emoji: "📜", note: "A book interpreting ruins preserves their history.", tags: ["knowledge", "history"] }),
  freezeRecipe({ a: "Color", b: "Sculpture", word: "Art", emoji: "🎨", note: "Color applied to sculpture becomes a work of art.", tags: ["art", "material"] }),
  freezeRecipe({ a: "Air", b: "Wave", word: "Sound", emoji: "🔊", note: "A pressure wave moving through air becomes sound.", tags: ["air", "sound"] }),
  freezeRecipe({ a: "Sound", b: "Art", word: "Music", emoji: "🎵", note: "Sound deliberately shaped as art becomes music.", tags: ["sound", "art"] }),
  freezeRecipe({ a: "Plant", b: "Animal", word: "Food", emoji: "🍽️", note: "Plants and animals together represent the foundations of food.", tags: ["food", "life"] }),
  freezeRecipe({ a: "Light", b: "Wonder", word: "Magic", emoji: "✨", note: "Light inspiring wonder feels like magic.", tags: ["fantasy", "light"] }),
  freezeRecipe({ a: "Rain", b: "Ice", word: "Sleet", emoji: "🌨️", note: "Rain freezing on its way down becomes sleet.", tags: ["weather", "ice"] }),
  freezeRecipe({ a: "Rain", b: "Snow", word: "Blizzard", emoji: "🌨️", note: "Heavy snow mixed with driving precipitation becomes a blizzard.", tags: ["weather", "ice"] }),
  freezeRecipe({ a: "Rain", b: "Ocean", word: "Monsoon", emoji: "🌧️", note: "Moist ocean air can drive a seasonal monsoon.", tags: ["weather", "water"] }),
  freezeRecipe({ a: "Rain", b: "River", word: "Flood", emoji: "🌊", note: "Sustained rain can push a river beyond its banks into a flood.", tags: ["water", "weather"] }),
  freezeRecipe({ a: "Rain", b: "Mountain", word: "Waterfall", emoji: "💦", note: "Rainwater descending a mountain gathers into a waterfall.", tags: ["water", "landscape"] }),
  freezeRecipe({ a: "Rain", b: "City", word: "Storm Drain", emoji: "🌧️", note: "A city channels heavy rain through a storm drain.", tags: ["city", "water"] }),
  freezeRecipe({ a: "Cloud", b: "Ice", word: "Hail", emoji: "🧊", note: "Ice carried inside a cloud can fall as hail.", tags: ["weather", "ice"] }),
  freezeRecipe({ a: "Cloud", b: "Snow", word: "Blizzard", emoji: "🌨️", note: "A snow-filled cloud can grow into a blizzard.", tags: ["weather", "ice"] }),
  freezeRecipe({ a: "Fog", b: "City", word: "Smog", emoji: "🌫️", note: "Urban pollution trapped in fog becomes smog.", tags: ["city", "weather"] }),
  freezeRecipe({ a: "Wind", b: "Tree", word: "Rustle", emoji: "🍃", note: "Wind moving through a tree makes its leaves rustle.", tags: ["air", "plant"] }),
  freezeRecipe({ a: "Wind", b: "Fire", word: "Wildfire", emoji: "🔥", note: "Wind can spread an open fire into a wildfire.", tags: ["weather", "fire"] }),
  freezeRecipe({ a: "Wind", b: "Bird", word: "Flight", emoji: "🪽", note: "A bird rides moving air in flight.", tags: ["air", "animal"] }),
  freezeRecipe({ a: "Plant", b: "Moon", word: "Night Bloom", emoji: "🌙", note: "A plant opening under moonlight creates a night bloom.", tags: ["plant", "night"] }),
  freezeRecipe({ a: "Flower", b: "Moon", word: "Moonflower", emoji: "🌼", note: "A flower associated with moonlit blooming is a moonflower.", tags: ["plant", "night"] }),
  freezeRecipe({ a: "Seed", b: "Earth", word: "Plant", emoji: "🌱", note: "A seed rooted in earth begins a plant.", tags: ["plant", "land"] }),
  freezeRecipe({ a: "Seed", b: "Water", word: "Sprout", emoji: "🌱", note: "Water wakes a seed and lets it sprout.", tags: ["plant", "water"] }),
  freezeRecipe({ a: "Seed", b: "Fire", word: "Roasted Seeds", emoji: "🌻", note: "Heating edible seeds turns them into roasted seeds.", tags: ["food", "fire"] }),
  freezeRecipe({ a: "Seed", b: "Ice", word: "Dormancy", emoji: "❄️", note: "A seed can wait through deep cold in dormancy.", tags: ["plant", "ice"] }),
  freezeRecipe({ a: "Animal", b: "City", word: "Urban Wildlife", emoji: "🦊", note: "Animals adapting to city life become urban wildlife.", tags: ["animal", "city"] }),
  freezeRecipe({ a: "Bird", b: "Air", word: "Flight", emoji: "🪽", note: "A bird moving through air takes flight.", tags: ["animal", "air"] }),
  freezeRecipe({ a: "Bird", b: "Ice", word: "Penguin", emoji: "🐧", note: "A bird adapted to ice evokes a penguin.", tags: ["animal", "ice"] }),
  freezeRecipe({ a: "Fish", b: "Water", word: "Aquarium", emoji: "🐠", note: "Fish kept in a contained body of water form an aquarium.", tags: ["animal", "water"] }),
  freezeRecipe({ a: "Life", b: "Plant", word: "Ecosystem", emoji: "🌿", note: "Plant life interacting with its surroundings forms an ecosystem.", tags: ["life", "plant"] }),
  freezeRecipe({ a: "Life", b: "Animal", word: "Species", emoji: "🧬", note: "Related animal life is organized into a species.", tags: ["life", "animal"] }),
  freezeRecipe({ a: "Wall", b: "Plant", word: "Green Wall", emoji: "🌿", note: "Plants grown across a wall create a green wall.", tags: ["plant", "building"] }),
  freezeRecipe({ a: "Wall", b: "Book", word: "Bookshelf", emoji: "📚", note: "A wall fitted to hold books becomes a bookshelf.", tags: ["building", "knowledge"] }),
  freezeRecipe({ a: "House", b: "Plant", word: "Greenhouse", emoji: "🏡", note: "A house made to shelter plants becomes a greenhouse.", tags: ["building", "plant"] }),
  freezeRecipe({ a: "House", b: "Sand", word: "Sandcastle", emoji: "🏰", note: "A house-shaped structure built from sand is a sandcastle.", tags: ["building", "landscape"] }),
  freezeRecipe({ a: "City", b: "Beach", word: "Resort", emoji: "🏖️", note: "A city destination built around a beach becomes a resort.", tags: ["city", "travel"] }),
  freezeRecipe({ a: "City", b: "Mountain", word: "Hill Town", emoji: "🏘️", note: "A city settled along a mountain becomes a hill town.", tags: ["city", "landscape"] }),
  freezeRecipe({ a: "City", b: "Night", word: "Nightlife", emoji: "🌃", note: "A city active after dark develops nightlife.", tags: ["city", "night"] }),
  freezeRecipe({ a: "Road", b: "Water", word: "Bridge", emoji: "🌉", note: "A road crossing water needs a bridge.", tags: ["transport", "water"] }),
  freezeRecipe({ a: "Road", b: "Ice", word: "Black Ice", emoji: "🧊", note: "A thin hidden layer of ice on a road is black ice.", tags: ["transport", "ice"] }),
  freezeRecipe({ a: "Road", b: "Sand", word: "Dirt Road", emoji: "🛣️", note: "A road surfaced with loose sand and earth becomes a dirt road.", tags: ["transport", "land"] }),
  freezeRecipe({ a: "Bridge", b: "City", word: "Infrastructure", emoji: "🏗️", note: "Bridges connecting a city are part of its infrastructure.", tags: ["city", "transport"] }),
  freezeRecipe({ a: "Bridge", b: "Train", word: "Rail Bridge", emoji: "🌉", note: "A bridge carrying trains becomes a rail bridge.", tags: ["transport", "building"] }),
  freezeRecipe({ a: "Steel", b: "Concrete", word: "Skyscraper", emoji: "🏙️", note: "Steel framing and reinforced concrete support a skyscraper.", tags: ["building", "city"] }),
  freezeRecipe({ a: "Stone", b: "Sand", word: "Concrete", emoji: "🧱", note: "Stone aggregate and sand are core ingredients of concrete.", tags: ["material", "building"] }),
  freezeRecipe({ a: "Clay", b: "Sand", word: "Adobe", emoji: "🧱", note: "Clay strengthened with sand can be formed into adobe.", tags: ["material", "building"] }),
  freezeRecipe({ a: "Metal", b: "Stone", word: "Ore", emoji: "⛏️", note: "Metal embedded in stone is found as ore.", tags: ["material", "land"] }),
  freezeRecipe({ a: "Sand", b: "Wind", word: "Dune", emoji: "🏜️", note: "Wind gathers loose sand into a dune.", tags: ["landscape", "air"] }),
  freezeRecipe({ a: "Mud", b: "Sun", word: "Clay", emoji: "🏺", note: "Mud drying beneath the sun leaves workable clay.", tags: ["material", "land"] }),
  freezeRecipe({ a: "Mud", b: "House", word: "Adobe", emoji: "🧱", note: "Dried mud used to build a house becomes adobe.", tags: ["material", "building"] }),
  freezeRecipe({ a: "Mud", b: "Water", word: "Swamp", emoji: "🐊", note: "Waterlogged mud spreads into a swamp.", tags: ["water", "landscape"] }),
  freezeRecipe({ a: "Stone", b: "Moon", word: "Moonstone", emoji: "🌙", note: "A pale luminous stone evokes moonstone.", tags: ["material", "space"] }),
  freezeRecipe({ a: "Stone", b: "Life", word: "Fossil", emoji: "🦴", note: "Ancient life preserved in stone becomes a fossil.", tags: ["life", "land"] }),
  freezeRecipe({ a: "Electricity", b: "Computer", word: "Cloud Computing", emoji: "☁️", note: "Networked computers powered at scale enable cloud computing.", tags: ["technology", "energy"] }),
  freezeRecipe({ a: "Computer", b: "Internet", word: "Cloud Computing", emoji: "☁️", note: "Computers connected through the internet enable cloud computing.", tags: ["technology", "network"] }),
  freezeRecipe({ a: "Computer", b: "Robot", word: "Android", emoji: "🤖", note: "A computer controlling a humanlike robot creates an android.", tags: ["technology", "machine"] }),
  freezeRecipe({ a: "Computer", b: "Machine", word: "Automation", emoji: "⚙️", note: "A computer directing machinery enables automation.", tags: ["technology", "machine"] }),
  freezeRecipe({ a: "Computer", b: "Phone", word: "Smartphone", emoji: "📱", note: "Combining a computer with a phone creates a smartphone.", tags: ["technology", "communication"] }),
  freezeRecipe({ a: "Network", b: "City", word: "Smart City", emoji: "🌆", note: "A city coordinated through connected networks becomes a smart city.", tags: ["technology", "city"] }),
  freezeRecipe({ a: "Network", b: "Satellite", word: "Internet", emoji: "🌐", note: "Satellite links can extend a network into the internet.", tags: ["technology", "space"] }),
  freezeRecipe({ a: "Electricity", b: "Car", word: "Electric Vehicle", emoji: "🚙", note: "Electricity powering a car creates an electric vehicle.", tags: ["technology", "transport"] }),
  freezeRecipe({ a: "Machine", b: "Life", word: "Robot", emoji: "🤖", note: "A machine designed to imitate living action becomes a robot.", tags: ["machine", "life"] }),
  freezeRecipe({ a: "Robot", b: "Life", word: "Android", emoji: "🤖", note: "A lifelike robot becomes an android.", tags: ["machine", "life"] }),
  freezeRecipe({ a: "Engine", b: "Water", word: "Motorboat", emoji: "🚤", note: "An engine propelling a craft across water makes a motorboat.", tags: ["machine", "water"] }),
  freezeRecipe({ a: "Engine", b: "Air", word: "Jet", emoji: "✈️", note: "An engine accelerating air becomes a jet.", tags: ["machine", "air"] }),
  freezeRecipe({ a: "Rocket", b: "Moon", word: "Lander", emoji: "🚀", note: "A rocket built to reach the moon carries a lander.", tags: ["space", "machine"] }),
  freezeRecipe({ a: "Space", b: "Plant", word: "Space Garden", emoji: "🌱", note: "Plants cultivated in space form a space garden.", tags: ["space", "plant"] }),
  freezeRecipe({ a: "Planet", b: "Life", word: "Living Planet", emoji: "🌍", note: "A planet supporting life becomes a living planet.", tags: ["space", "life"] }),
  freezeRecipe({ a: "Telescope", b: "Space", word: "Space Telescope", emoji: "🔭", note: "A telescope operating in space becomes a space telescope.", tags: ["space", "science"] }),
  freezeRecipe({ a: "Telescope", b: "Book", word: "Star Atlas", emoji: "📖", note: "Telescope observations recorded in a book form a star atlas.", tags: ["space", "knowledge"] }),
  freezeRecipe({ a: "Telescope", b: "Mountain", word: "Observatory", emoji: "🔭", note: "A mountain site built around a telescope becomes an observatory.", tags: ["space", "science"] }),
  freezeRecipe({ a: "Telescope", b: "City", word: "Planetarium", emoji: "🌌", note: "A city venue that brings telescope discoveries indoors is a planetarium.", tags: ["space", "city"] }),
  freezeRecipe({ a: "Book", b: "History", word: "Archive", emoji: "🗄️", note: "Books preserving history become an archive.", tags: ["knowledge", "history"] }),
  freezeRecipe({ a: "Book", b: "Art", word: "Illustration", emoji: "🖼️", note: "Art created for a book becomes an illustration.", tags: ["knowledge", "art"] }),
  freezeRecipe({ a: "Music", b: "Music", word: "Concert", emoji: "🎵", note: "Music performed together becomes a concert.", tags: ["art", "sound"] }),
  freezeRecipe({ a: "Music", b: "City", word: "Festival", emoji: "🎪", note: "Music celebrated across a city becomes a festival.", tags: ["art", "city"] }),
  freezeRecipe({ a: "Art", b: "City", word: "Gallery", emoji: "🖼️", note: "A city space dedicated to art becomes a gallery.", tags: ["art", "city"] }),
  freezeRecipe({ a: "Art", b: "Stone", word: "Sculpture", emoji: "🗿", note: "Art carved from stone becomes a sculpture.", tags: ["art", "material"] }),
  freezeRecipe({ a: "Food", b: "Ice", word: "Frozen Food", emoji: "🧊", note: "Food preserved with ice becomes frozen food.", tags: ["food", "ice"] }),
  freezeRecipe({ a: "Bread", b: "Meat", word: "Sandwich", emoji: "🥪", note: "Meat placed between bread makes a sandwich.", tags: ["food", "craft"] }),
  freezeRecipe({ a: "House", b: "Food", word: "Kitchen", emoji: "🍳", note: "The room in a house devoted to preparing food is a kitchen.", tags: ["building", "food"] }),
  freezeRecipe({ a: "Room", b: "Food", word: "Kitchen", emoji: "🍳", note: "A room designed for preparing food becomes a kitchen.", tags: ["building", "food"] }),
  freezeRecipe({ a: "Room", b: "Water", word: "Bathroom", emoji: "🛁", note: "A room supplied with water becomes a bathroom.", tags: ["building", "water"] }),
  freezeRecipe({ a: "Room", b: "Book", word: "Study", emoji: "📚", note: "A room centered on books becomes a study.", tags: ["building", "knowledge"] }),

  // Repeated-word expectations should feel deliberately authored, not broken.
  freezeRecipe({ a: "Wind", b: "Wind", word: "Tornado", emoji: "🌪️", note: "Converging rotating winds can form a tornado.", tags: ["weather", "air"] }),
  freezeRecipe({ a: "Species", b: "Species", word: "Ecosystem", emoji: "🌿", note: "Many interacting species together form an ecosystem.", tags: ["life", "nature"] }),
  freezeRecipe({ a: "Spacecraft", b: "Spacecraft", word: "Fleet", emoji: "🚀", note: "Spacecraft operating together form a fleet.", tags: ["space", "machine"] }),
  freezeRecipe({ a: "Ocean", b: "Ocean", word: "Ocean World", emoji: "🌊", note: "Oceans covering a whole world create an ocean world.", tags: ["water", "space"] }),
  freezeRecipe({ a: "Seed", b: "Seed", word: "Field", emoji: "🌾", note: "Seeds planted together spread into a field.", tags: ["plant", "land"] }),
  freezeRecipe({ a: "Leaf", b: "Leaf", word: "Compost", emoji: "🍂", note: "Fallen leaves breaking down together become compost.", tags: ["plant", "land"] }),
  freezeRecipe({ a: "Steel", b: "Steel", word: "Framework", emoji: "🏗️", note: "Steel members joined together create a framework.", tags: ["material", "building"] }),
  freezeRecipe({ a: "Plane", b: "Plane", word: "Air Fleet", emoji: "✈️", note: "Planes operating together form an air fleet.", tags: ["air", "transport"] }),
  freezeRecipe({ a: "Engine", b: "Engine", word: "Factory", emoji: "🏭", note: "Many engines working together evoke a factory.", tags: ["machine", "industry"] }),
  freezeRecipe({ a: "Shadow", b: "Shadow", word: "Darkness", emoji: "🌑", note: "Overlapping shadows deepen into darkness.", tags: ["night", "light"] }),
  freezeRecipe({ a: "Volcano", b: "Volcano", word: "Range", emoji: "🌋", note: "A chain of volcanoes forms a volcanic range.", tags: ["landscape", "fire"] }),
  freezeRecipe({ a: "Rainforest", b: "Rainforest", word: "Biome", emoji: "🌍", note: "Connected rainforests together form a broad biome.", tags: ["plant", "life"] }),

  // Continuations keep the newly added concepts useful after discovery.
  freezeRecipe({ a: "Sleet", b: "Wind", word: "Blizzard", emoji: "🌨️", note: "Wind driving frozen precipitation grows into a blizzard.", tags: ["weather", "ice"] }),
  freezeRecipe({ a: "Monsoon", b: "River", word: "Floodplain", emoji: "🏞️", note: "Monsoon-swollen rivers spread across a floodplain.", tags: ["weather", "water"] }),
  freezeRecipe({ a: "Storm Drain", b: "City", word: "Sewer", emoji: "🕳️", note: "A city's connected storm drains lead into a sewer system.", tags: ["city", "water"] }),
  freezeRecipe({ a: "Hail", b: "Storm", word: "Hailstorm", emoji: "⛈️", note: "A storm dropping hail becomes a hailstorm.", tags: ["weather", "ice"] }),
  freezeRecipe({ a: "Flight", b: "Plane", word: "Aviation", emoji: "✈️", note: "Powered flight by plane belongs to aviation.", tags: ["air", "transport"] }),
  freezeRecipe({ a: "Night Bloom", b: "Moon", word: "Moonflower", emoji: "🌼", note: "A night bloom associated with the moon becomes a moonflower.", tags: ["plant", "night"] }),
  freezeRecipe({ a: "Moonflower", b: "Garden", word: "Moon Garden", emoji: "🌙", note: "Moonflowers gathered in a garden create a moon garden.", tags: ["plant", "night"] }),
  freezeRecipe({ a: "Dormancy", b: "Sun", word: "Awakening", emoji: "🌅", note: "Sunlight and warmth end dormancy in an awakening.", tags: ["plant", "light"] }),
  freezeRecipe({ a: "Green Wall", b: "City", word: "Vertical Garden", emoji: "🌿", note: "A city green wall becomes a vertical garden.", tags: ["plant", "city"] }),
  freezeRecipe({ a: "Bookshelf", b: "Book", word: "Library", emoji: "📚", note: "Books filling shelves grow into a library.", tags: ["knowledge", "building"] }),
  freezeRecipe({ a: "Sandcastle", b: "Water", word: "Ruins", emoji: "🏚️", note: "Water washing through a sandcastle leaves ruins.", tags: ["water", "building"] }),
  freezeRecipe({ a: "Resort", b: "Ocean", word: "Tourism", emoji: "🧳", note: "An ocean resort attracts tourism.", tags: ["travel", "water"] }),
  freezeRecipe({ a: "Nightlife", b: "Music", word: "Club", emoji: "🎵", note: "Music at the heart of nightlife creates a club.", tags: ["art", "night"] }),
  freezeRecipe({ a: "Black Ice", b: "Car", word: "Accident", emoji: "⚠️", note: "A car losing grip on black ice can cause an accident.", tags: ["transport", "ice"] }),
  freezeRecipe({ a: "Dirt Road", b: "Village", word: "Countryside", emoji: "🏞️", note: "A dirt road connecting a village evokes the countryside.", tags: ["transport", "land"] }),
  freezeRecipe({ a: "Rail Bridge", b: "River", word: "Viaduct", emoji: "🌉", note: "A long rail bridge crossing a river becomes a viaduct.", tags: ["transport", "water"] }),
  freezeRecipe({ a: "Ore", b: "Fire", word: "Metal", emoji: "⚙️", note: "Fire smelts useful metal from ore.", tags: ["material", "fire"] }),
  freezeRecipe({ a: "Smartphone", b: "Network", word: "Internet", emoji: "🌐", note: "A smartphone joining a network connects to the internet.", tags: ["technology", "communication"] }),
  freezeRecipe({ a: "Smart City", b: "Network", word: "Infrastructure", emoji: "🏗️", note: "A smart city's connected network becomes digital infrastructure.", tags: ["technology", "city"] }),
  freezeRecipe({ a: "Frozen Food", b: "Fire", word: "Dinner", emoji: "🍽️", note: "Heating frozen food prepares dinner.", tags: ["food", "fire"] }),
  freezeRecipe({ a: "Kitchen", b: "Fire", word: "Cooking", emoji: "🍳", note: "Using heat in a kitchen is cooking.", tags: ["food", "fire"] }),
  freezeRecipe({ a: "Bathroom", b: "Water", word: "Plumbing", emoji: "🚰", note: "Water supplied throughout a bathroom requires plumbing.", tags: ["building", "water"] }),
  freezeRecipe({ a: "Study", b: "Book", word: "Research", emoji: "🔬", note: "Books examined in a study support research.", tags: ["knowledge", "science"] }),
  freezeRecipe({ a: "Illustration", b: "Book", word: "Picture Book", emoji: "📖", note: "Illustrations throughout a book create a picture book.", tags: ["art", "knowledge"] }),
  freezeRecipe({ a: "Festival", b: "City", word: "Community", emoji: "🎪", note: "A city festival gathers its community.", tags: ["city", "culture"] }),
  freezeRecipe({ a: "Moonstone", b: "Magic", word: "Spell", emoji: "✨", note: "A moonstone used with magic focuses a spell.", tags: ["fantasy", "material"] }),
  freezeRecipe({ a: "Tornado", b: "Ocean", word: "Hurricane", emoji: "🌀", note: "A vast rotating storm fed by warm ocean water evokes a hurricane.", tags: ["weather", "water"] }),
  freezeRecipe({ a: "Tornado", b: "Fire", word: "Firestorm", emoji: "🔥", note: "Rotating wind pulling in fire creates a firestorm.", tags: ["weather", "fire"] }),
  freezeRecipe({ a: "Fleet", b: "Ocean", word: "Navy", emoji: "⚓", note: "A fleet operating across the ocean becomes a navy.", tags: ["water", "transport"] }),
  freezeRecipe({ a: "Field", b: "Rain", word: "Crop", emoji: "🌾", note: "Rain nourishing a planted field produces a crop.", tags: ["plant", "weather"] }),
  freezeRecipe({ a: "Compost", b: "Plant", word: "Growth", emoji: "🌱", note: "Compost feeding a plant supports new growth.", tags: ["plant", "land"] }),
  freezeRecipe({ a: "Framework", b: "Glass", word: "Skyscraper", emoji: "🏙️", note: "A tall framework clad in glass becomes a skyscraper.", tags: ["building", "city"] }),
  freezeRecipe({ a: "Air Fleet", b: "Airport", word: "Aviation", emoji: "✈️", note: "An air fleet coordinated through airports forms an aviation system.", tags: ["air", "transport"] }),
  freezeRecipe({ a: "Darkness", b: "Light", word: "Shadow", emoji: "🌑", note: "Light interrupted by darkness creates a shadow.", tags: ["light", "night"] }),
  freezeRecipe({ a: "Range", b: "Snow", word: "Glacier", emoji: "🧊", note: "Snow compacted across a mountain range feeds a glacier.", tags: ["landscape", "ice"] }),
  freezeRecipe({ a: "Biome", b: "Life", word: "Biodiversity", emoji: "🦋", note: "The variety of life throughout a biome is biodiversity.", tags: ["life", "nature"] })
]);

const expectation = (a, b, acceptedOutputs, { weight = 1, reason = "editorial" } = {}) => Object.freeze({
  a,
  b,
  acceptedOutputs: Object.freeze(Array.isArray(acceptedOutputs) ? acceptedOutputs : [acceptedOutputs]),
  weight,
  reason
});

const CORE_EXPECTATIONS = [
  expectation("Earth", "Water", "Mud", { weight: 5, reason: "first-orbit" }),
  expectation("Water", "Water", "Ocean", { weight: 5, reason: "player-reported" }),
  expectation("Fire", "Fire", "Inferno", { weight: 5, reason: "player-reported" }),
  expectation("Air", "Air", "Wind", { weight: 4, reason: "same-word" }),
  expectation("Earth", "Earth", "Land", { weight: 4, reason: "same-word" }),
  expectation("Species", "Air", "Bird", { weight: 5, reason: "player-reported" }),
  expectation("Brick", "Brick", "Wall", { weight: 5, reason: "player-reported" }),
  expectation("Wall", "Wall", "House", { weight: 4, reason: "same-word" }),
  expectation("Tree", "Tree", "Forest", { weight: 4, reason: "same-word" }),
  expectation("Water", "Stone", ["Pebble", "Erosion"], { weight: 3, reason: "multiple-logical-readings" }),
  expectation("Fire", "Sand", "Glass", { weight: 4 }),
  expectation("Air", "Life", "Bird", { weight: 4 }),
  expectation("Cloud", "Water", "Rain", { weight: 4 }),
  expectation("Stone", "Stone", "Mountain", { weight: 4 }),
  expectation("Star", "Star", "Galaxy", { weight: 4 }),
  expectation("House", "House", "Village", { weight: 4 }),
  expectation("Village", "Village", "City", { weight: 4 }),
  expectation("City", "City", "Megacity", { weight: 4 }),
  expectation("Bird", "Bird", "Flock", { weight: 4 }),
  expectation("Fish", "Fish", "School", { weight: 4 })
];

export const EXPECTED_OBVIOUS_ATTEMPTS = Object.freeze([
  ...CORE_EXPECTATIONS,
  ...WORLD_GRAPH_3_RECIPES.map((recipe) => expectation(recipe.a, recipe.b, recipe.word, {
    weight: recipe.a === recipe.b ? 3 : 2,
    reason: recipe.a === recipe.b ? "same-word" : "world-graph-3"
  }))
]);

const inferTags = (word, hint = {}) => {
  const text = normalizedWord(word);
  const tags = new Set([normalizedWord(hint.category), ...(hint.semanticTags || []).map(normalizedWord)]);
  const groups = [
    ["water", /water|ocean|river|rain|sea|ice|snow|cloud|mist|fog|flood|wave|hydro|aquarium/],
    ["fire", /fire|flame|lava|volcan|heat|ember|ash|smoke|inferno/],
    ["air", /air|wind|sky|cloud|storm|flight|aviation|tornado/],
    ["land", /earth|stone|mountain|sand|desert|field|road|clay|mud|valley/],
    ["life", /life|animal|species|bird|fish|plant|tree|forest|flower|seed|eco|bio/],
    ["space", /space|star|planet|moon|galaxy|cosmos|comet|asteroid|orbit|telescope/],
    ["technology", /computer|network|internet|electric|machine|engine|robot|phone|circuit/],
    ["building", /house|wall|brick|city|tower|bridge|room|road|castle|building/],
    ["knowledge", /book|school|science|study|research|library|history|atlas/],
    ["art", /art|music|gallery|concert|festival|illustration/],
    ["food", /food|bread|dinner|tea|fruit|kitchen|cook|honey|meat/]
  ];
  for (const [tag, pattern] of groups) if (pattern.test(text)) tags.add(tag);
  tags.delete("");
  if (tags.size === 0) tags.add("discovery");
  tags.add(hint.starter ? "starter" : "crafted");
  return [...tags].sort();
};

export function normalizeWorldRecipe(recipe, index = 0) {
  const a = cleanWord(recipe?.a);
  const b = cleanWord(recipe?.b);
  const word = cleanWord(recipe?.word);
  const provenanceKind = recipe?.provenance?.kind || (recipe?.source === "ai" ? RECIPE_PROVENANCE.AI_PROPOSAL : RECIPE_PROVENANCE.LEGACY);
  return {
    id: recipe?.id || `recipe:${worldGraphPairKey(a, b).replaceAll(" ", "-") || index}`,
    a,
    b,
    word,
    emoji: cleanWord(recipe?.emoji) || "✨",
    rationale: cleanWord(recipe?.note || recipe?.rationale),
    ingredients: [conceptIdFor(a), conceptIdFor(b)],
    result: conceptIdFor(word),
    semanticTags: [...new Set((recipe?.semanticTags || []).map(normalizedWord).filter(Boolean))].sort(),
    provenance: {
      kind: provenanceKind,
      source: cleanWord(recipe?.provenance?.source || recipe?.source || "legacy-world"),
      reviewed: recipe?.provenance?.reviewed ?? provenanceKind !== RECIPE_PROVENANCE.AI_PROPOSAL
    },
    status: recipe?.status || (provenanceKind === RECIPE_PROVENANCE.AI_PROPOSAL ? CONCEPT_STATUS.PROVISIONAL : CONCEPT_STATUS.APPROVED),
    rankedEligible: recipe?.rankedEligible ?? provenanceKind !== RECIPE_PROVENANCE.AI_PROPOSAL
  };
}

export function buildConceptCatalog(recipes, { starters = ["Earth", "Water", "Fire", "Air"], hints = [], intentionalTerminals = [] } = {}) {
  const hintsByWord = new Map(hints.map((hint) => [normalizedWord(hint.word), hint]));
  const starterSet = new Set(starters.map(normalizedWord));
  const terminalSet = new Set(intentionalTerminals.map(normalizedWord));
  const words = new Map();
  for (const starter of starters) words.set(normalizedWord(starter), cleanWord(starter));
  for (const recipe of recipes) {
    for (const word of [recipe.a, recipe.b, recipe.word]) if (cleanWord(word)) words.set(normalizedWord(word), cleanWord(word));
  }
  return [...words.values()].sort((a, b) => a.localeCompare(b)).map((word) => {
    const hint = hintsByWord.get(normalizedWord(word)) || {};
    const provisional = hint.status === CONCEPT_STATUS.PROVISIONAL;
    return {
      id: conceptIdFor(word),
      word,
      aliases: [...new Set((hint.aliases || []).map(cleanWord).filter(Boolean))].sort(),
      semanticTags: inferTags(word, { ...hint, starter: starterSet.has(normalizedWord(word)) }),
      provenance: {
        kind: hint.provenance?.kind || RECIPE_PROVENANCE.EDITORIAL,
        source: hint.provenance?.source || "derived-world-catalog",
        reviewed: hint.provenance?.reviewed ?? !provisional
      },
      status: hint.status || CONCEPT_STATUS.APPROVED,
      rankedEligible: hint.rankedEligible ?? !provisional,
      intentionalTerminal: hint.intentionalTerminal ?? terminalSet.has(normalizedWord(word))
    };
  });
}

function shortestPlans(recipes, starters) {
  const plans = new Map(starters.map((word) => [normalizedWord(word), { word: cleanWord(word), steps: new Map(), openings: new Set() }]));
  let changed = true;
  for (let round = 0; changed && round <= recipes.length + starters.length; round += 1) {
    changed = false;
    for (const recipe of recipes) {
      const left = plans.get(normalizedWord(recipe.a));
      const right = plans.get(normalizedWord(recipe.b));
      if (!left || !right) continue;
      const resultKey = normalizedWord(recipe.word);
      const steps = new Map(left.steps);
      for (const [key, value] of right.steps) steps.set(key, value);
      if (steps.has(resultKey)) continue;
      steps.set(resultKey, recipe);
      const openings = new Set([...left.openings, ...right.openings]);
      if (left.steps.size === 0 && right.steps.size === 0) openings.add(worldGraphPairKey(recipe.a, recipe.b));
      const existing = plans.get(resultKey);
      const signature = [...steps.keys()].sort().join("|");
      const existingSignature = existing ? [...existing.steps.keys()].sort().join("|") : "";
      if (!existing || steps.size < existing.steps.size || (steps.size === existing.steps.size && signature < existingSignature)) {
        plans.set(resultKey, { word: recipe.word, steps, openings });
        changed = true;
      }
    }
  }
  return plans;
}

export function analyzeWorldGraph({
  recipes = [],
  starters = ["Earth", "Water", "Fire", "Air"],
  targets = [],
  concepts,
  expectedAttempts = EXPECTED_OBVIOUS_ATTEMPTS
} = {}) {
  const normalizedRecipes = recipes.map(normalizeWorldRecipe);
  const conceptCatalog = concepts || buildConceptCatalog(normalizedRecipes, { starters });
  const pairMap = new Map();
  const duplicates = [];
  const producers = new Map();
  const continuationCounts = new Map(conceptCatalog.map((concept) => [normalizedWord(concept.word), 0]));
  for (const recipe of normalizedRecipes) {
    const key = worldGraphPairKey(recipe.a, recipe.b);
    if (pairMap.has(key)) duplicates.push({ pair: key, first: pairMap.get(key).word, duplicate: recipe.word });
    else pairMap.set(key, recipe);
    const outputKey = normalizedWord(recipe.word);
    if (!producers.has(outputKey)) producers.set(outputKey, []);
    producers.get(outputKey).push(recipe);
    for (const ingredient of new Set([normalizedWord(recipe.a), normalizedWord(recipe.b)])) {
      continuationCounts.set(ingredient, (continuationCounts.get(ingredient) || 0) + 1);
    }
  }

  const plans = shortestPlans(normalizedRecipes, starters);
  const reachable = new Set(plans.keys());
  const targetWords = targets.map((target) => cleanWord(typeof target === "string" ? target : target?.target)).filter(Boolean);
  const targetMetrics = targetWords.map((target) => {
    const plan = plans.get(normalizedWord(target));
    const finalRecipes = producers.get(normalizedWord(target)) || [];
    return {
      target,
      reachable: Boolean(plan),
      shortestMoves: plan?.steps.size ?? null,
      finalRecipeCount: finalRecipes.length,
      openingBranchCount: plan?.openings.size ?? 0,
      openingBranches: [...(plan?.openings || [])].sort()
    };
  });

  const shortestTargetUsage = new Map();
  for (const metric of targetMetrics) {
    const plan = plans.get(normalizedWord(metric.target));
    for (const recipe of plan?.steps.values() || []) {
      const key = normalizedWord(recipe.word);
      shortestTargetUsage.set(key, (shortestTargetUsage.get(key) || 0) + 1);
    }
  }
  const bottlenecks = [...shortestTargetUsage.entries()]
    .map(([word, targetCount]) => ({
      word: conceptCatalog.find((concept) => normalizedWord(concept.word) === word)?.word || word,
      targetCount,
      share: targetMetrics.length ? targetCount / targetMetrics.length : 0
    }))
    .sort((a, b) => b.targetCount - a.targetCount || a.word.localeCompare(b.word));

  let expectedWeight = 0;
  let coveredWeight = 0;
  const expectationResults = expectedAttempts.map((attempt) => {
    const weight = Math.max(1, Number(attempt.weight) || 1);
    expectedWeight += weight;
    const actual = pairMap.get(worldGraphPairKey(attempt.a, attempt.b))?.word || null;
    const acceptedOutputs = attempt.acceptedOutputs.map(cleanWord);
    const covered = Boolean(actual && acceptedOutputs.some((word) => normalizedWord(word) === normalizedWord(actual)));
    if (covered) coveredWeight += weight;
    return { a: attempt.a, b: attempt.b, acceptedOutputs, actual, covered, weight, reason: attempt.reason };
  });

  const reachableConcepts = conceptCatalog.filter((concept) => reachable.has(normalizedWord(concept.word)));
  const intentionalEndpoints = reachableConcepts
    .filter((concept) => concept.intentionalTerminal)
    .map((concept) => concept.word)
    .sort();
  const intentionalTerminalDeadEnds = reachableConcepts
    .filter((concept) => concept.intentionalTerminal && (continuationCounts.get(normalizedWord(concept.word)) || 0) === 0)
    .map((concept) => concept.word)
    .sort();
  const problematicDeadEnds = reachableConcepts
    .filter((concept) => !concept.intentionalTerminal && (continuationCounts.get(normalizedWord(concept.word)) || 0) === 0)
    .map((concept) => concept.word)
    .sort();
  const thinConcepts = reachableConcepts
    .filter((concept) => !concept.intentionalTerminal && (continuationCounts.get(normalizedWord(concept.word)) || 0) <= 1)
    .map((concept) => ({ word: concept.word, continuations: continuationCounts.get(normalizedWord(concept.word)) || 0 }))
    .sort((a, b) => a.continuations - b.continuations || a.word.localeCompare(b.word));

  const validationIssues = [];
  for (const recipe of normalizedRecipes) {
    if (!recipe.a || !recipe.b || !recipe.word) validationIssues.push(`${recipe.id} has a missing word.`);
    if (!recipe.rationale) validationIssues.push(`${recipe.id} has no rationale.`);
    if (recipe.rankedEligible && (recipe.status !== CONCEPT_STATUS.APPROVED || !recipe.provenance.reviewed)) {
      validationIssues.push(`${recipe.id} is ranked without approved reviewed provenance.`);
    }
  }
  if (duplicates.length) validationIssues.push(`${duplicates.length} duplicate unordered recipe pairs exist.`);

  return {
    schemaVersion: WORLD_GRAPH_SCHEMA_VERSION,
    graphVersion: WORLD_GRAPH_VERSION,
    totals: {
      concepts: conceptCatalog.length,
      recipes: normalizedRecipes.length,
      reachableConcepts: reachableConcepts.length,
      unreachableConcepts: conceptCatalog.length - reachableConcepts.length,
      sameWordRecipes: normalizedRecipes.filter((recipe) => normalizedWord(recipe.a) === normalizedWord(recipe.b)).length
    },
    intentCoverage: {
      attempts: expectationResults.length,
      covered: expectationResults.filter((item) => item.covered).length,
      weightedCoverage: expectedWeight ? coveredWeight / expectedWeight : 1,
      failures: expectationResults.filter((item) => !item.covered)
    },
    topology: {
      intentionalEndpointCount: intentionalEndpoints.length,
      intentionalTerminalDeadEndCount: intentionalTerminalDeadEnds.length,
      problematicDeadEndCount: problematicDeadEnds.length,
      // Compatibility aliases for existing report consumers.
      deadEndCount: problematicDeadEnds.length,
      thinConceptCount: thinConcepts.length,
      intentionalEndpoints,
      intentionalTerminalDeadEnds,
      problematicDeadEnds,
      deadEnds: problematicDeadEnds,
      thinConcepts,
      bottlenecks: bottlenecks.slice(0, 20)
    },
    targets: {
      count: targetMetrics.length,
      reachable: targetMetrics.filter((target) => target.reachable).length,
      withMultipleFinalRecipes: targetMetrics.filter((target) => target.finalRecipeCount >= 2).length,
      withMultipleOpenings: targetMetrics.filter((target) => target.openingBranchCount >= 2).length,
      details: targetMetrics
    },
    duplicates,
    validationIssues
  };
}

export function createWorldGraphSnapshot({ recipes, starters, targets, conceptHints = [], intentionalTerminals = [] }) {
  const normalizedRecipes = recipes.map(normalizeWorldRecipe);
  const concepts = buildConceptCatalog(normalizedRecipes, { starters, hints: conceptHints, intentionalTerminals });
  return {
    schemaVersion: WORLD_GRAPH_SCHEMA_VERSION,
    graphVersion: WORLD_GRAPH_VERSION,
    concepts,
    recipes: normalizedRecipes,
    analysis: analyzeWorldGraph({ recipes: normalizedRecipes, starters, targets, concepts })
  };
}

export function worldGraphLegacyRecipes() {
  return WORLD_GRAPH_3_RECIPES.map(({ a, b, word, emoji, note, source }) => ({ a, b, word, emoji, note, source }));
}
