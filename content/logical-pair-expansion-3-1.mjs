// Constellore 3.1's large authored-logic pack.
//
// The pack is intentionally generated from reviewed semantic families rather
// than from arbitrary word concatenation. Each admitted field receives:
//   place or medium + discipline -> a familiar specialist field
//   specialist field + a closely related field -> a third related field
//   specialist field + another related field -> the connecting field
//
// The cluster links form closed subject webs. Every new field therefore has
// two meaningful onward uses without manufacturing numbered lab or guide
// padding.
// Keeping these relationships as data makes thousands of connections
// reviewable without hiding them behind a probabilistic or AI fallback.

const clean = (value) => String(value || "").trim();
const normalized = (value) => clean(value).toLocaleLowerCase("en-US");

export function logicalPairKey(a, b) {
  return [normalized(a), normalized(b)].sort().join("+");
}

const authored = (a, b, word, emoji, note) => Object.freeze({
  a,
  b,
  word,
  emoji,
  note,
  source: "expanded"
});

const topic = (
  ingredient,
  label,
  practiceIngredient,
  practiceLabel,
  referenceIngredient = "Book",
  referenceLabel = "Guide"
) => Object.freeze({
  ingredient,
  label,
  practiceIngredient,
  practiceLabel,
  referenceIngredient,
  referenceLabel
});

const TOPICS = Object.freeze({
  biology: topic("Biology", "Biology", "Research", "Lab"),
  ecology: topic("Ecology", "Ecology", "Ecosystem", "Reserve"),
  science: topic("Science", "Science", "Research", "Lab", "Book", "Primer"),
  research: topic("Research", "Research", "Laboratory", "Project", "Book", "Review"),
  engineering: topic("Engineering", "Engineering", "Machine", "Works", "Book", "Manual"),
  technology: topic("Technology", "Technology", "Innovation", "Hub"),
  energy: topic("Energy", "Energy", "Power", "Grid", "Book", "Manual"),
  industry: topic("Industry", "Industry", "Factory", "Complex", "Book", "Manual"),
  art: topic("Art", "Art", "Gallery", "Exhibition", "Book", "Portfolio"),
  history: topic("History", "History", "Archive", "Museum", "Book", "Chronicle"),
  tourism: topic("Tourism", "Tourism", "Atlas", "Trail", "Book", "Handbook"),
  wildlife: topic("Wildlife", "Wildlife", "Habitat", "Sanctuary"),
  habitat: topic("Habitat", "Habitat", "Ecosystem", "Biome", "Atlas", "Map"),
  climate: topic("Climate", "Climate", "Atmosphere", "Model", "Atlas", "Chart"),
  weather: topic("Weather", "Weather", "Storm", "Station", "Book", "Almanac"),
  trade: topic("Trade", "Trade", "Port", "Exchange", "Book", "Ledger"),
  community: topic("Community", "Community", "Society", "Network"),
  life: topic("Life", "Life", "Species", "Biosphere", "Book", "Chronicle"),
  society: topic("Society", "Society", "Community", "Forum", "Book", "Chronicle"),
  infrastructure: topic("Infrastructure", "Infrastructure", "Construction", "Plan", "Atlas", "Map"),
  physics: topic("Physics", "Physics", "Laboratory", "Experiment", "Book", "Primer"),
  geology: topic("Geology", "Geology", "Quarry", "Survey", "Atlas", "Map"),
  hydrology: topic("Hydrology", "Hydrology", "Waterworks", "Survey", "Atlas", "Map"),
  botany: topic("Botany", "Botany", "Garden", "Collection", "Book", "Flora"),
  zoology: topic("Zoology", "Zoology", "Menagerie", "Collection"),
  astronomy: topic("Astronomy", "Astronomy", "Telescope", "Lab", "Book", "Atlas"),
  agriculture: topic("Agriculture", "Agriculture", "Farm", "System"),
  cooking: topic("Cooking", "Cooking", "Kitchen", "Cuisine", "Book", "Cookbook"),
  food: topic("Food", "Cuisine", "Dinner", "Feast", "Book", "Cookbook"),
  music: topic("Music", "Music", "Concert", "Festival", "Book", "Songbook"),
  aviation: topic("Aviation", "Aviation", "Aircraft", "Fleet", "Atlas", "Route"),
  manufacturing: topic("Manufacturing", "Manufacturing", "Factory", "Line", "Book", "Manual"),
  construction: topic("Construction", "Construction", "Framework", "Project", "Book", "Plan"),
  evolution: topic("Evolution", "Evolution", "Species", "Branch", "Book", "Timeline"),
  pollution: topic("Pollution", "Pollution", "Emissions", "Index", "Atlas", "Map"),
  emissions: topic("Emissions", "Emissions", "Smoke", "Inventory", "Book", "Report"),
  power: topic("Power", "Power", "Electricity", "Grid", "Book", "Manual"),
  electricity: topic("Electricity", "Electricity", "Circuit", "System", "Book", "Manual"),
  automation: topic("Automation", "Automation", "Robot", "System", "Book", "Manual"),
  innovation: topic("Innovation", "Innovation", "Technology", "Hub", "Book", "Review"),
  survival: topic("Survival", "Survival", "Shelter", "Camp"),
  migration: topic("Migration", "Migration", "Species", "Route", "Atlas", "Map"),
  robotics: topic("Robot", "Robotics", "Laboratory", "Lab", "Book", "Manual"),
  computing: topic("Computer", "Computing", "Network", "System", "Book", "Manual"),
  architecture: topic("Framework", "Architecture", "Construction", "Style"),
  transport: topic("Vehicle", "Transport", "Infrastructure", "Network", "Atlas", "Map"),
  navigation: topic("Atlas", "Navigation", "Trail", "Route"),
  culture: topic("Civilization", "Culture", "History", "Heritage", "Book", "Chronicle"),
  economy: topic("Money", "Economy", "Trade", "Market", "Book", "Report"),
  education: topic("School", "Education", "Study", "Course", "Book", "Primer"),
  health: topic("Vitality", "Health", "Life", "Wellness"),
  conservation: topic("Species", "Conservation", "Survival", "Park", "Book", "Plan"),
  forestry: topic("Logging", "Forestry", "Forest", "Plan", "Book", "Handbook"),
  fisheries: topic("Fishery", "Fisheries", "Fleet", "Harbor", "Book", "Handbook")
});

const profile = (ingredient, prefix, emoji, topics) => Object.freeze({
  ingredient,
  prefix,
  emoji,
  topics: Object.freeze(topics.trim().split(/\s+/))
});

// Every row below is an editorial allow-list. A topic absent from a row is not
// generated for that setting, which prevents combinations such as "lunar
// cooking" or "domestic astronomy" from entering the canonical graph.
const PROFILES = Object.freeze([
  profile("Ocean", "Marine", "🌊", `
    biology ecology science research engineering technology energy industry art history tourism wildlife habitat
    climate weather trade life geology pollution conservation
  `),
  profile("Mountain", "Alpine", "🏔️", `
    biology ecology science research engineering technology energy industry art history tourism wildlife habitat
    climate weather agriculture geology botany conservation
  `),
  profile("Ice", "Polar", "🧊", `
    biology ecology science research engineering technology energy art history tourism wildlife habitat climate
    weather physics geology hydrology survival conservation
  `),
  profile("Moon", "Lunar", "🌙", `
    science research engineering technology energy industry art history tourism habitat physics geology astronomy
    construction robotics computing navigation survival
  `),
  profile("Star", "Stellar", "⭐", `
    science research engineering technology energy art history physics astronomy evolution life weather navigation
    computing innovation education
  `),
  profile("Space", "Cosmic", "🌌", `
    science research engineering technology energy industry art history tourism physics astronomy life habitat weather
    navigation robotics computing construction survival transport innovation
  `),
  profile("Planet", "Planetary", "🪐", `
    science research engineering technology energy industry art history tourism biology ecology wildlife habitat climate
    weather physics geology astronomy robotics navigation survival conservation
  `),
  profile("Sun", "Solar", "☀️", `
    science research engineering technology energy industry art history physics astronomy weather climate power
    electricity manufacturing innovation architecture
  `),
  profile("River", "Fluvial", "🏞️", `
    biology ecology science research engineering technology energy industry art history tourism wildlife habitat climate
    weather trade community life hydrology geology pollution transport conservation agriculture navigation
  `),
  profile("Forest", "Woodland", "🌲", `
    biology ecology science research engineering technology energy industry art history tourism wildlife habitat climate
    weather community life botany zoology agriculture conservation forestry survival
  `),
  profile("Desert", "Arid", "🏜️", `
    biology ecology science research engineering technology energy industry art history tourism wildlife habitat climate
    weather agriculture geology hydrology botany survival conservation architecture
  `),
  profile("Jungle", "Tropical", "🌴", `
    biology ecology science research technology energy industry art history tourism wildlife habitat climate weather
    agriculture life botany zoology conservation forestry health food
  `),
  profile("City", "Urban", "🏙️", `
    biology ecology science research engineering technology energy industry art history tourism wildlife habitat climate
    weather trade community life society infrastructure agriculture pollution emissions power electricity automation
    innovation transport architecture culture economy education health conservation
  `),
  profile("Village", "Rural", "🏘️", `
    biology ecology science research engineering technology energy industry art history tourism wildlife habitat climate
    weather trade community life society infrastructure agriculture botany zoology cooking food construction innovation
    survival transport architecture culture economy education health conservation
  `),
  profile("Farm", "Agricultural", "🌾", `
    biology ecology science research engineering technology energy industry art history tourism wildlife habitat climate
    weather trade community life society infrastructure botany zoology cooking food manufacturing automation innovation
    survival architecture economy education health conservation
  `),
  profile("Volcano", "Volcanic", "🌋", `
    biology ecology science research engineering technology energy industry art history tourism wildlife habitat climate
    weather physics geology hydrology pollution emissions power survival conservation
  `),
  profile("Island", "Insular", "🏝️", `
    biology ecology science research engineering technology energy industry art history tourism wildlife habitat climate
    weather trade community life society infrastructure geology hydrology botany zoology survival migration transport
    architecture culture economy conservation
  `),
  profile("Beach", "Coastal", "🏖️", `
    biology ecology science research engineering technology energy industry art history tourism wildlife habitat climate
    weather trade community life society infrastructure geology hydrology botany zoology pollution transport architecture
    economy conservation
  `),
  profile("Sky", "Aerial", "🌤️", `
    biology ecology science research engineering technology energy industry art history tourism wildlife habitat climate
    weather life physics astronomy aviation navigation robotics pollution emissions power electricity transport
  `),
  profile("Earth", "Terrestrial", "🌍", `
    biology ecology science research engineering technology energy industry art history tourism wildlife habitat climate
    weather trade community life society infrastructure physics geology hydrology botany zoology astronomy agriculture
    evolution pollution emissions power electricity automation innovation survival migration transport architecture
    culture economy education health conservation
  `),
  profile("Water", "Aquatic", "💧", `
    biology ecology science research engineering technology energy industry art history tourism wildlife habitat climate
    weather trade community life physics geology hydrology botany zoology agriculture evolution pollution power
    electricity survival migration transport health conservation fisheries
  `),
  profile("Fire", "Thermal", "🔥", `
    biology ecology science research engineering technology energy industry art physics geology cooking food
    manufacturing construction power electricity automation innovation survival emissions climate health
  `),
  profile("Wind", "Aeolian", "🌬️", `
    ecology science research engineering technology energy industry art history tourism wildlife habitat climate weather
    physics geology agriculture power electricity aviation navigation pollution transport
  `),
  profile("Weather", "Atmospheric", "🌦️", `
    biology ecology science research engineering technology energy art history tourism wildlife habitat climate physics
    geology hydrology astronomy pollution emissions electricity aviation navigation survival health
  `),
  profile("Night", "Nocturnal", "🌙", `
    biology ecology science research art history tourism wildlife habitat community life society physics astronomy botany
    zoology music navigation survival migration health
  `),
  profile("Garden", "Horticultural", "🪴", `
    biology ecology science research engineering technology energy industry art history tourism wildlife habitat climate
    weather agriculture community life botany zoology cooking food automation innovation architecture education health
    conservation
  `),
  profile("Snow", "Cryospheric", "❄️", `
    biology ecology science research engineering technology energy art history tourism wildlife habitat climate weather
    physics geology hydrology pollution survival transport health conservation
  `),
  profile("Swamp", "Wetland", "🐊", `
    biology ecology science research engineering technology energy industry art history tourism wildlife habitat climate
    weather agriculture community life botany zoology hydrology pollution conservation health
  `),
  profile("Stone", "Geological", "🪨", `
    science research engineering technology energy industry art history tourism physics geology hydrology construction
    manufacturing architecture transport education conservation
  `),
  profile("Tree", "Arboreal", "🌳", `
    biology ecology science research technology art history tourism wildlife habitat climate weather agriculture community
    life botany zoology evolution survival migration architecture education health forestry conservation
  `),
  profile("Animal", "Zoological", "🐾", `
    biology ecology science research art history tourism wildlife habitat climate weather agriculture community life
    society zoology evolution survival migration culture education health conservation
  `),
  profile("Plant", "Botanical", "🌿", `
    biology ecology science research engineering technology energy industry art history tourism habitat climate weather
    agriculture community life botany evolution food manufacturing innovation survival architecture culture education
    health forestry conservation
  `),
  profile("Bird", "Avian", "🐦", `
    biology ecology science research art history tourism wildlife habitat climate weather agriculture community life
    zoology evolution survival migration navigation culture education health conservation
  `),
  profile("Fish", "Fishery", "🐟", `
    biology ecology science research engineering technology industry art history tourism wildlife habitat climate weather
    trade community life zoology evolution pollution food cooking manufacturing survival migration economy health
    conservation
  `),
  profile("Insect", "Entomological", "🦋", `
    biology ecology science research technology art history wildlife habitat climate weather agriculture community life
    zoology evolution survival migration culture education health conservation
  `),
  profile("House", "Domestic", "🏠", `
    science research engineering technology energy industry art history tourism wildlife habitat community life society
    infrastructure cooking food construction pollution emissions power electricity automation innovation survival
    transport architecture culture economy education health conservation
  `),
  profile("School", "Educational", "🏫", `
    biology ecology science research engineering technology industry art history tourism wildlife community life society
    infrastructure physics geology hydrology botany zoology astronomy cooking food music aviation manufacturing
    construction evolution pollution automation innovation survival migration robotics computing architecture culture
    economy health conservation
  `),
  profile("Road", "Highway", "🛣️", `
    science research engineering technology energy industry art history tourism wildlife habitat climate weather trade
    community life society infrastructure geology hydrology pollution emissions power electricity automation innovation
    survival migration transport architecture economy health conservation
  `),
  profile("Train", "Railway", "🚆", `
    science research engineering technology energy industry art history tourism wildlife climate weather trade community
    life society infrastructure physics geology pollution emissions power electricity automation innovation survival
    migration transport architecture economy education health conservation
  `),
  profile("Ship", "Maritime", "🚢", `
    biology ecology science research engineering technology energy industry art history tourism wildlife habitat climate
    weather trade community life society infrastructure physics geology hydrology zoology pollution emissions power
    electricity automation innovation survival migration transport navigation architecture culture economy education
    health conservation fisheries
  `),
  profile("Aircraft", "Aeronautical", "✈️", `
    science research engineering technology energy industry art history tourism climate weather trade community society
    infrastructure physics astronomy aviation navigation pollution emissions power electricity automation innovation
    survival transport architecture economy education health conservation
  `),
  profile("Rocket", "Astronautical", "🚀", `
    science research engineering technology energy industry art history tourism habitat climate physics geology astronomy
    aviation navigation automation innovation survival transport architecture economy education health
  `),
  profile("Telescope", "Observational", "🔭", `
    biology science research engineering technology art history tourism habitat climate weather life physics geology
    astronomy navigation computing innovation education
  `),
  profile("Factory", "Industrial", "🏭", `
    ecology science research engineering technology energy art history trade community life society infrastructure physics
    geology hydrology agriculture pollution emissions power electricity automation innovation manufacturing construction
    transport architecture culture economy education health conservation
  `),
  profile("Food", "Culinary", "🍽️", `
    biology ecology science research engineering technology energy industry art history tourism climate trade community
    life society agriculture cooking manufacturing pollution emissions automation innovation survival architecture
    culture economy education health conservation
  `)
]);

export const LOGICAL_PAIR_EXPANSION_BASE_CONCEPTS = Object.freeze([...new Set([
  ...PROFILES.map((setting) => setting.ingredient),
  ...Object.values(TOPICS).flatMap((entry) => [
    entry.ingredient,
    entry.practiceIngredient,
    entry.referenceIngredient
  ])
])]);

// The profile rows are the allow-list, so every reviewed entry remains
// eligible. Selection later keeps only complete, reachable semantic groups.
const selectedProfileTopics = (setting) => setting.topics;

const EDITORIAL_FIELD_BLOCKLIST = new Set(`
  Moon:industry Moon:art Moon:history Moon:tourism
  Star:computing Star:art Star:history Star:innovation Star:education
  Space:industry Space:art Space:history Space:tourism
  Wind:wildlife Wind:habitat Wind:art Wind:history Wind:tourism
  Weather:habitat Weather:health Weather:geology Weather:art Weather:tourism
  Stone:geology
  Tree:art Tree:history Tree:tourism Tree:community
  Animal:community Animal:society Animal:zoology
  Fish:wildlife Fish:art Fish:community
  House:wildlife House:habitat
  School:life School:health School:industry
  Road:community Road:habitat Road:life
  Train:wildlife Train:life Train:health
  Food:life Food:climate Food:community Food:society
  Food:science Food:research Food:physics Food:astronomy Food:weather Food:hydrology Food:geology
  Food:pollution Food:emissions Food:technology Food:innovation Food:engineering Food:automation
  Food:robotics Food:computing Food:electricity Food:power Food:energy Food:industry Food:manufacturing
  Food:construction Food:infrastructure Food:architecture Food:transport Food:navigation Food:aviation
  Rocket:astronomy
  Sky:art Sky:history Sky:tourism Sky:aviation
  Night:science Night:research Night:physics Night:astronomy Night:history
  Animal:zoology
  Aircraft:astronomy
  Garden:community Garden:history Garden:education Garden:art Garden:tourism Garden:food Garden:cooking
`.trim().split(/\s+/));

const TOPIC_CLUSTERS = Object.freeze({
  nature: Object.freeze([
    "biology", "ecology", "wildlife", "habitat", "conservation", "survival", "health", "life",
    "evolution", "migration", "zoology", "fisheries", "agriculture", "botany", "forestry"
  ]),
  knowledge: Object.freeze([
    "science", "research", "physics", "astronomy", "climate", "weather", "hydrology", "geology",
    "pollution", "emissions", "technology", "innovation", "engineering", "automation", "robotics",
    "computing", "electricity", "power", "energy"
  ]),
  industry: Object.freeze([
    "industry", "manufacturing", "construction", "infrastructure", "architecture", "transport",
    "navigation", "aviation"
  ]),
  culture: Object.freeze([
    "community", "society", "culture", "history", "education", "art", "music", "tourism", "trade",
    "economy", "food", "cooking"
  ])
});

const CLUSTER_BY_TOPIC = new Map(Object.entries(TOPIC_CLUSTERS)
  .flatMap(([cluster, topics]) => topics.map((topicKey) => [topicKey, cluster])));
const TOPIC_ORDER = new Map(Object.values(TOPIC_CLUSTERS)
  .flatMap((topics) => topics.map((topicKey, index) => [topicKey, index])));

// Some ingredients call for a familiar named idea instead of an adjective
// mechanically placed before a discipline. These names are individually
// reviewed and keep the base combinations understandable without tautologies
// such as "Botanical Botany" or "Culinary Cooking".
const FIELD_NAME_OVERRIDES = new Map(Object.entries({
  "Animal:biology": "Zoology",
  "Animal:ecology": "Faunal Ecology",
  "Animal:wildlife": "Wild Fauna",
  "Animal:habitat": "Animal Range",
  "Animal:agriculture": "Livestock",
  "Animal:survival": "Animal Instinct",
  "Animal:health": "Veterinary Care",
  "Animal:conservation": "Wildlife Protection",

  "Plant:biology": "Plant Science",
  "Plant:ecology": "Flora Ecology",
  "Plant:habitat": "Plant Community",
  "Plant:agriculture": "Crops",
  "Plant:botany": "Plant Taxonomy",
  "Plant:health": "Plant Health",
  "Plant:forestry": "Forest Plants",
  "Plant:conservation": "Flora Protection",
  "Plant:research": "Plant Studies",
  "Plant:engineering": "Botanical Engineering",
  "Plant:industry": "Botanical Industry",
  "Plant:climate": "Plant Hardiness",
  "Plant:weather": "Seasonal Growth",
  "Plant:art": "Botanical Art",
  "Plant:history": "Plant Heritage",
  "Plant:tourism": "Botanical Tourism",
  "Plant:community": "Plant Society",
  "Plant:food": "Edible Plants",
  "Plant:education": "Botany Class",

  "Bird:biology": "Ornithology",
  "Bird:wildlife": "Wild Birds",
  "Bird:habitat": "Bird Sanctuary",
  "Bird:agriculture": "Poultry",
  "Bird:life": "Avifauna",
  "Bird:zoology": "Avian Zoology",
  "Bird:survival": "Flight Instinct",
  "Bird:health": "Avian Care",
  "Bird:conservation": "Bird Protection",
  "Bird:navigation": "Bird Navigation",
  "Bird:art": "Feather Art",
  "Bird:history": "Avian Heritage",
  "Bird:tourism": "Birdwatching",
  "Bird:community": "Flock",
  "Bird:culture": "Bird Lore",
  "Bird:education": "Bird Studies",

  "Fish:biology": "Ichthyology",
  "Fish:ecology": "Ichthyoecology",
  "Fish:habitat": "Fishing Grounds",
  "Fish:life": "Aquatic Life",
  "Fish:zoology": "Fish Taxonomy",
  "Fish:health": "Aquatic Care",
  "Fish:conservation": "Fish Protection",
  "Fish:science": "Fisheries Science",
  "Fish:research": "Fisheries Research",
  "Fish:engineering": "Aquaculture Engineering",
  "Fish:industry": "Fishing Industry",
  "Fish:climate": "Climate Fisheries",
  "Fish:weather": "Fishing Weather",
  "Fish:pollution": "Water Contamination",
  "Fish:survival": "Fish Adaptation",
  "Fish:manufacturing": "Fish Processing",

  "Garden:biology": "Horticulture",
  "Garden:ecology": "Garden Ecosystem",
  "Garden:wildlife": "Pollinator Garden",
  "Garden:habitat": "Garden Refuge",
  "Garden:agriculture": "Market Garden",
  "Garden:life": "Living Garden",
  "Garden:botany": "Botanical Garden",
  "Garden:zoology": "Garden Fauna",
  "Garden:health": "Healing Garden",
  "Garden:conservation": "Seed Bank",
  "Garden:art": "Garden Design",
  "Garden:history": "Heritage Garden",
  "Garden:tourism": "Garden Tour",
  "Garden:community": "Allotment Garden",
  "Garden:education": "Teaching Garden",
  "Garden:food": "Garden Produce",
  "Garden:cooking": "Garden Salad",

  "Farm:ecology": "Agroecology",
  "Farm:wildlife": "Farmland Wildlife",
  "Farm:habitat": "Farmland Habitat",
  "Farm:conservation": "Land Stewardship",
  "Farm:survival": "Farm Resilience",
  "Farm:life": "Farm Living",
  "Farm:zoology": "Animal Husbandry",
  "Farm:botany": "Crop Science",
  "Farm:research": "Field Trials",
  "Farm:climate": "Climate Farming",
  "Farm:weather": "Farm Forecast",
  "Farm:automation": "Smart Farming",
  "Farm:energy": "Farm Bioenergy",
  "Farm:community": "Farming Community",
  "Farm:society": "Agrarian Society",
  "Farm:history": "Agricultural Heritage",
  "Farm:art": "Pastoral Art",
  "Farm:tourism": "Agritourism",
  "Farm:trade": "Farm Market",
  "Farm:food": "Farm-to-Table",
  "Farm:cooking": "Farmhouse Cooking",

  "Sky:biology": "Aerobiology",
  "Sky:industry": "Aviation Industry",

  "Water:survival": "Water Safety",
  "Water:health": "Hydration",
  "Water:agriculture": "Irrigation",
  "Water:botany": "Hydrophytes",
  "Water:research": "Water Studies",
  "Water:physics": "Fluid Dynamics",
  "Water:climate": "Water Cycle",
  "Water:weather": "Rainfall",
  "Water:geology": "Hydrogeology",
  "Water:pollution": "Water Quality",
  "Water:engineering": "Hydraulic Engineering",

  "Stone:science": "Materials Science",
  "Stone:research": "Lithic Analysis",
  "Stone:physics": "Rock Mechanics",
  "Stone:hydrology": "Aquifer Science",
  "Stone:engineering": "Geotechnics",
  "Stone:energy": "Geothermal Energy",
  "Stone:industry": "Mining Industry",
  "Stone:manufacturing": "Stoneworks",
  "Stone:construction": "Masonry",
  "Stone:architecture": "Stone Architecture",
  "Stone:transport": "Sediment Transport",

  "House:science": "Home Science",
  "House:research": "Home Study",
  "House:engineering": "Building Engineering",
  "House:energy": "Home Energy",
  "House:industry": "Cottage Industry",
  "House:infrastructure": "Home Utilities",
  "House:construction": "Homebuilding",
  "House:pollution": "Indoor Pollution",
  "House:emissions": "Household Emissions",
  "House:art": "Interior Design",
  "House:history": "Heritage Home",
  "House:tourism": "Homestay",
  "House:community": "Neighborhood",
  "House:society": "Household",
  "House:cooking": "Home Cooking",
  "House:education": "Homeschool",

  "School:research": "Academic Research",
  "School:physics": "Physics Class",
  "School:hydrology": "Hydrology Class",
  "School:geology": "Earth Science",
  "School:pollution": "Environmental Studies",
  "School:engineering": "Engineering Class",
  "School:automation": "Robotics Class",
  "School:robotics": "Robotics Club",
  "School:computing": "Computer Lab",
  "School:manufacturing": "Vocational Training",
  "School:construction": "Trade School",
  "School:infrastructure": "School Facilities",
  "School:architecture": "School Design",
  "School:aviation": "Flight School",

  "Night:art": "Night Photography",
  "Night:tourism": "Night Tour",
  "Night:community": "Nightlife",
  "Night:society": "Night Culture",
  "Night:music": "Nocturne",

  "Food:art": "Edible Art",
  "Food:history": "Culinary Heritage",
  "Food:tourism": "Food Trail",
  "Food:trade": "Food Market",
  "Food:cooking": "Cuisine",
  "Food:education": "Culinary School",

  "Road:science": "Traffic Science",
  "Road:research": "Traffic Study",
  "Road:climate": "Climate Resilience",
  "Road:weather": "Road Conditions",
  "Road:hydrology": "Road Drainage",
  "Road:geology": "Roadbed",
  "Road:pollution": "Traffic Pollution",
  "Road:emissions": "Exhaust",
  "Road:engineering": "Civil Engineering",
  "Road:automation": "Self-Driving",
  "Road:electricity": "Electric Highway",
  "Road:power": "Charging Network",
  "Road:energy": "Road Fuel",
  "Road:history": "Historic Route",
  "Road:art": "Roadside Art",
  "Road:tourism": "Road Trip",
  "Road:trade": "Trade Route",

  "Animal:culture": "Animal Culture",
  "Animal:history": "Natural History",
  "Animal:education": "Animal Studies",
  "Animal:art": "Wildlife Art",
  "Animal:tourism": "Safari",

  "Plant:survival": "Plant Adaptation",

  "Aircraft:aviation": "Aeronautics",
  "Road:society": "Car Culture",
  "Rocket:climate": "Launch Weather",
  "Rocket:geology": "Planetary Survey",
  "Rocket:automation": "Autopilot",
  "Rocket:industry": "Space Industry",
  "Rocket:architecture": "Spacecraft Design",
  "Rocket:transport": "Spaceflight",
  "Rocket:navigation": "Guidance System",
  "Rocket:aviation": "Aerospace",
  "Telescope:climate": "Climate Observation",
  "Telescope:weather": "Sky Observation",
  "Telescope:geology": "Remote Sensing",
  "Telescope:engineering": "Optical Engineering",
  "Telescope:computing": "Image Processing"
}));

const RAW_FIELDS = Object.freeze(PROFILES.flatMap((setting) =>
  selectedProfileTopics(setting).map((topicKey) => {
    const discipline = TOPICS[topicKey];
    const cluster = CLUSTER_BY_TOPIC.get(topicKey);
    if (!discipline || !cluster) throw new Error(`Unknown logical-pair topic "${topicKey}" for ${setting.ingredient}.`);
    const word = FIELD_NAME_OVERRIDES.get(`${setting.ingredient}:${topicKey}`)
      || `${setting.prefix} ${discipline.label}`;
    return Object.freeze({
      setting,
      topicKey,
      cluster,
      word,
      baseRecipe: authored(
        setting.ingredient,
        discipline.ingredient,
        word,
        setting.emoji,
        `Combining ${setting.ingredient.toLowerCase()} with ${discipline.ingredient.toLowerCase()} creates ${word}.`
      )
    });
  })
));

const wordPattern = /^[\p{L}\p{N}][\p{L}\p{N} '&-]*$/u;
const forbiddenResultPattern = /\b(?:craft|thing|stuff|word|result|combo|mixture|mashup|undefined|null)\b/i;

export function validateLogicalPairExpansion(recipes) {
  const issues = [];
  const pairs = new Set();
  const outputCounts = new Map();
  for (let index = 0; index < recipes.length; index += 1) {
    const recipe = recipes[index];
    const label = `logical recipe ${index + 1}`;
    if (!recipe || typeof recipe !== "object") {
      issues.push(`${label} is not an object.`);
      continue;
    }
    const a = clean(recipe.a);
    const b = clean(recipe.b);
    const word = clean(recipe.word);
    const note = clean(recipe.note);
    const key = logicalPairKey(a, b);
    if (!a || !b) issues.push(`${label} has a missing ingredient.`);
    if (a.length > 28 || b.length > 28) issues.push(`${label} has an ingredient longer than the 28-character gameplay limit.`);
    if (pairs.has(key)) issues.push(`${label} duplicates unordered pair ${a} + ${b}.`);
    pairs.add(key);
    if (!wordPattern.test(word) || word.length > 28) issues.push(`${label} has a malformed result "${word}".`);
    if (forbiddenResultPattern.test(word)) issues.push(`${label} uses a placeholder or nonsense result "${word}".`);
    const tokens = normalized(word).split(/\s+/);
    if (new Set(tokens).size !== tokens.length) issues.push(`${label} repeats a result token in "${word}".`);
    const compact = (value) => normalized(value).replace(/[^\p{L}\p{N}]/gu, "");
    const resultCompact = compact(word);
    if (resultCompact === compact(`${a}${b}`) || resultCompact === compact(`${b}${a}`)) {
      issues.push(`${label} is only a raw ingredient concatenation.`);
    }
    if (resultCompact === compact(a) || resultCompact === compact(b)) issues.push(`${label} returns an input unchanged.`);
    const outputKey = normalized(word);
    outputCounts.set(outputKey, (outputCounts.get(outputKey) || 0) + 1);
    if (!clean(recipe.emoji) || clean(recipe.emoji).length > 16) issues.push(`${label} has an invalid emoji.`);
    if (note.length < 20 || note.length > 120) issues.push(`${label} has an invalid explanation.`);
    if (recipe.source !== "expanded") issues.push(`${label} has the wrong provenance.`);
  }
  const overproduced = [...outputCounts.entries()].filter(([, count]) => count > 3);
  for (const [word, count] of overproduced) issues.push(`logical output "${word}" is repeated ${count} times.`);
  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze(issues),
    recipeCount: recipes.length,
    uniquePairCount: pairs.size,
    distinctResultCount: outputCounts.size,
    maximumResultConcentration: Math.max(0, ...outputCounts.values())
  });
}

function reachableWords(recipes) {
  const known = new Set(["earth", "water", "fire", "air"]);
  let changed = true;
  for (let round = 0; changed && round <= recipes.length + 4; round += 1) {
    changed = false;
    for (const recipe of recipes) {
      if (!known.has(normalized(recipe.a)) || !known.has(normalized(recipe.b))) continue;
      const word = normalized(recipe.word);
      if (known.has(word)) continue;
      known.add(word);
      changed = true;
    }
  }
  return known;
}

const MINIMUM_CANONICAL_PAIR_COUNT = 3_198;
const GROUP_PRIORITY = Object.freeze({
  Food: Object.freeze({ nature: 0, knowledge: 1, culture: 4 }),
  School: Object.freeze({ nature: 0, knowledge: 4, culture: 1 }),
  Road: Object.freeze({ nature: 0, knowledge: 5, culture: 1 }),
  Train: Object.freeze({ nature: 0, knowledge: 5, culture: 2 }),
  Factory: Object.freeze({ nature: 0, knowledge: 5, culture: 1 }),
  Telescope: Object.freeze({ nature: 0, knowledge: 5, culture: 0 }),
  Rocket: Object.freeze({ nature: 1, knowledge: 5, culture: 0 }),
  Aircraft: Object.freeze({ nature: 1, knowledge: 5, culture: 1 }),
  House: Object.freeze({ nature: 0, knowledge: 3, culture: 4 }),
  Fish: Object.freeze({ nature: 5, knowledge: 3, culture: 0 }),
  Insect: Object.freeze({ nature: 5, knowledge: 0, culture: 0 }),
  Stone: Object.freeze({ nature: 0, knowledge: 5, culture: 0 }),
  Garden: Object.freeze({ nature: 5, knowledge: 2, culture: 2 }),
  Animal: Object.freeze({ nature: 5, knowledge: 2, culture: 1 }),
  Tree: Object.freeze({ nature: 5, knowledge: 3, culture: 1 }),
  Weather: Object.freeze({ nature: 3, knowledge: 5, culture: 1 }),
  Wind: Object.freeze({ nature: 3, knowledge: 5, culture: 1 }),
  Moon: Object.freeze({ nature: 3, knowledge: 5, culture: 1 }),
  Star: Object.freeze({ nature: 3, knowledge: 5, culture: 1 }),
  Space: Object.freeze({ nature: 4, knowledge: 5, culture: 2 })
});

function editorialGroupPriority(fields) {
  const setting = fields[0].setting.ingredient;
  const cluster = fields[0].cluster;
  return GROUP_PRIORITY[setting]?.[cluster] ?? 5;
}

function smallestReviewedGroupSet(groups, minimumFields) {
  const totalFields = groups.reduce((sum, group) => sum + group.fields.length, 0);
  if (totalFields < minimumFields) {
    throw new Error(`Logical pair expansion has ${totalFields} reviewed fields; ${minimumFields} are required.`);
  }
  const removableBudget = totalFields - minimumFields;
  const choices = Array(removableBudget + 1).fill(null);
  choices[0] = Object.freeze({ cost: 0, indexes: Object.freeze([]) });
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const size = group.fields.length;
    const cost = editorialGroupPriority(group.fields) * size;
    for (let sum = removableBudget - size; sum >= 0; sum -= 1) {
      const previous = choices[sum];
      if (!previous) continue;
      const nextSum = sum + size;
      const next = { cost: previous.cost + cost, indexes: [...previous.indexes, index] };
      const existing = choices[nextSum];
      if (!existing || next.cost < existing.cost) choices[nextSum] = Object.freeze({
        cost: next.cost,
        indexes: Object.freeze(next.indexes)
      });
    }
  }
  let omittedFields = removableBudget;
  while (omittedFields > 0 && !choices[omittedFields]) omittedFields -= 1;
  const omitted = new Set(choices[omittedFields]?.indexes || []);
  return Object.freeze({
    selected: Object.freeze(groups.filter((_, index) => !omitted.has(index))),
    omitted: Object.freeze(groups.filter((_, index) => omitted.has(index))),
    omittedFields,
    selectedFields: totalFields - omittedFields
  });
}

// Older hand-authored answers always stay authoritative. Fields are admitted
// profile by profile, then linked only inside coherent knowledge clusters.
// Every five-or-larger subject ring uses its distance-one and distance-two
// edges exactly once. Each field receives one base recipe plus two related
// field results, while appearing in four onward combinations. This adds
// neither dead ends nor thin concepts and never concentrates more than three
// recipes on one result.
export function selectLogicalPairExpansion(
  reservedRecipes = [],
  { minimumCanonicalPairs = MINIMUM_CANONICAL_PAIR_COUNT } = {}
) {
  const reserved = new Set(reservedRecipes.map((recipe) => logicalPairKey(recipe.a, recipe.b)));
  const reachable = reachableWords(reservedRecipes);
  const reservedOutputCounts = new Map();
  for (const recipe of reservedRecipes) {
    const key = normalized(recipe.word);
    reservedOutputCounts.set(key, (reservedOutputCounts.get(key) || 0) + 1);
  }
  const accepted = [];
  const skipped = [];
  const profileGroups = new Map();
  for (const field of RAW_FIELDS) {
    if (EDITORIAL_FIELD_BLOCKLIST.has(`${field.setting.ingredient}:${field.topicKey}`)) {
      skipped.push(Object.freeze({
        setting: field.baseRecipe.a,
        topic: field.baseRecipe.b,
        editorial: "awkward_or_redundant_phrase"
      }));
      continue;
    }
    const baseValidation = validateLogicalPairExpansion([field.baseRecipe]);
    const baseKey = logicalPairKey(field.baseRecipe.a, field.baseRecipe.b);
    const inputsReachable = reachable.has(normalized(field.baseRecipe.a)) && reachable.has(normalized(field.baseRecipe.b));
    const baseOutputCount = reservedOutputCounts.get(normalized(field.word)) || 0;
    if (!baseValidation.valid || reserved.has(baseKey) || baseOutputCount > 2 || !inputsReachable) {
      skipped.push(Object.freeze({
        setting: field.baseRecipe.a,
        topic: field.baseRecipe.b,
        invalid: baseValidation.valid ? undefined : Object.freeze([...baseValidation.issues]),
        conflictingPairs: reserved.has(baseKey) ? Object.freeze([baseKey]) : Object.freeze([]),
        existingOutputCount: baseOutputCount,
        unreachableInputs: inputsReachable ? Object.freeze([]) : Object.freeze(
          [field.baseRecipe.a, field.baseRecipe.b].filter((word) => !reachable.has(normalized(word)))
        )
      }));
      continue;
    }
    const groupKey = `${field.setting.ingredient}\0${field.cluster}`;
    if (!profileGroups.has(groupKey)) profileGroups.set(groupKey, []);
    profileGroups.get(groupKey).push(field);
  }

  const reviewedGroups = [];
  for (const unsortedFields of profileGroups.values()) {
    const fields = [...unsortedFields].sort(
      (left, right) => TOPIC_ORDER.get(left.topicKey) - TOPIC_ORDER.get(right.topicKey)
    );
    if (fields.length < 5) {
      for (const field of fields) skipped.push(Object.freeze({
        setting: field.baseRecipe.a,
        topic: field.baseRecipe.b,
        incompleteCluster: field.cluster
      }));
      continue;
    }
    const recipes = [];
    for (let index = 0; index < fields.length; index += 1) {
      const field = fields[index];
      const next = fields[(index + 1) % fields.length];
      const nextTwo = fields[(index + 2) % fields.length];
      recipes.push(
        field.baseRecipe,
        authored(
          field.word,
          next.word,
          nextTwo.word,
          nextTwo.setting.emoji,
          `${field.word} and ${next.word} share the ideas behind ${nextTwo.word}.`
        ),
        authored(
          field.word,
          nextTwo.word,
          next.word,
          next.setting.emoji,
          `${field.word} and ${nextTwo.word} meet through ${next.word}.`
        )
      );
    }
    const groupValidation = validateLogicalPairExpansion(recipes);
    const collisions = recipes.filter((recipe) => reserved.has(logicalPairKey(recipe.a, recipe.b)));
    if (!groupValidation.valid || collisions.length) {
      for (const field of fields) skipped.push(Object.freeze({
        setting: field.baseRecipe.a,
        topic: field.baseRecipe.b,
        invalid: groupValidation.valid ? undefined : Object.freeze([...groupValidation.issues]),
        conflictingPairs: Object.freeze(collisions.map((recipe) => logicalPairKey(recipe.a, recipe.b)))
      }));
      continue;
    }
    reviewedGroups.push(Object.freeze({
      fields: Object.freeze(fields),
      recipes: Object.freeze(recipes)
    }));
  }

  const minimumExpansionRecipes = Math.max(0, Number(minimumCanonicalPairs) - reservedRecipes.length);
  const minimumFields = Math.ceil(minimumExpansionRecipes / 3);
  const groupSelection = smallestReviewedGroupSet(reviewedGroups, minimumFields);
  for (const group of groupSelection.omitted) {
    for (const field of group.fields) skipped.push(Object.freeze({
      setting: field.baseRecipe.a,
      topic: field.baseRecipe.b,
      capacity: "not_needed_for_minimum_canonical_count"
    }));
  }
  for (const group of groupSelection.selected) {
    for (const recipe of group.recipes) {
      accepted.push(recipe);
      reserved.add(logicalPairKey(recipe.a, recipe.b));
    }
  }
  const acceptedFields = groupSelection.selectedFields;
  const acceptedGroups = groupSelection.selected.length;
  const validation = validateLogicalPairExpansion(accepted);
  if (!validation.valid) {
    throw new Error(`Logical pair expansion failed review: ${validation.issues.slice(0, 8).join(" ")}`);
  }
  return Object.freeze({
    recipes: Object.freeze(accepted),
    endpoints: Object.freeze([...new Set(accepted.map((recipe) => recipe.word))]),
    keys: Object.freeze(accepted.map((recipe) => logicalPairKey(recipe.a, recipe.b))),
    report: Object.freeze({
      candidateFields: RAW_FIELDS.length,
      acceptedFields,
      acceptedGroups,
      candidateBundles: RAW_FIELDS.length,
      acceptedBundles: acceptedFields,
      skippedBundles: skipped.length,
      invalidBundles: skipped.filter((entry) => entry.invalid).length,
      acceptedRecipes: accepted.length,
      minimumCanonicalPairs: Number(minimumCanonicalPairs),
      canonicalPairsAfterSelection: reservedRecipes.length + accepted.length,
      distinctResults: validation.distinctResultCount,
      skipped: Object.freeze(skipped)
    })
  });
}

export const LOGICAL_PAIR_EXPANSION_CANDIDATE_BUNDLES = RAW_FIELDS.length;
