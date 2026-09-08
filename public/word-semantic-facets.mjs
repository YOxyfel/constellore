const normalize = (value) => String(value ?? "")
  .normalize("NFKC")
  .trim()
  .replace(/\s+/g, " ")
  .toLocaleLowerCase("en");

const words = (value) => Object.freeze(String(value || "").split("|").map(normalize).filter(Boolean));

const DEFINITIONS = Object.freeze([
  { id: "forces", label: "Forces", shortLabel: "Forces", icon: "⚡", categories: words("force"), tags: words("force|energy|motion|power"), terms: words("air|electricity|energy|force|gravity|light|lightning|magnetism|motion|power|pressure|sound|wave|wind") },
  { id: "liquids", label: "Water & liquids", shortLabel: "Liquids", icon: "💧", tags: words("liquid|water|aquatic|marine"), terms: words("water|rain|river|ocean|sea|lake|pond|lagoon|canal|dew|juice|nectar|tea|soup|oil|meltwater|wastewater|waterfall|estuary|flood") },
  { id: "weather", label: "Air & weather", shortLabel: "Weather", icon: "☁", tags: words("air|weather|climate"), terms: words("air|weather|wind|rain|cloud|storm|fog|mist|snow|hail|blizzard|hurricane|tornado|tempest|thunder|lightning|atmosphere|climate|breeze|drought|monsoon") },
  { id: "fire-heat", label: "Fire & heat", shortLabel: "Fire", icon: "🔥", tags: words("fire|heat|thermal"), terms: words("fire|flame|heat|lava|magma|ember|ash|smoke|steam|inferno|wildfire|firestorm|combustion|volcano|eruption|plasma") },
  { id: "materials", label: "Materials", shortLabel: "Materials", icon: "◆", categories: words("matter|material"), tags: words("matter|material"), terms: words("stone|metal|steel|alloy|ore|sand|clay|mud|brick|concrete|glass|wood|ice|obsidian|rust|dust|crystal|fabric|paper|plastic") },
  { id: "landforms", label: "Land & places", shortLabel: "Land", icon: "⛰", tags: words("land|landscape|terrain|geography"), terms: words("earth|land|mountain|valley|desert|forest|jungle|swamp|marsh|beach|island|continent|canyon|mesa|plateau|dune|coast|shoreline|field|meadow|badlands|archipelago|oasis") },
  { id: "space", label: "Space", shortLabel: "Space", icon: "✦", categories: words("celestial"), tags: words("space|celestial|astronomy"), terms: words("space|star|sun|moon|planet|galaxy|cosmos|universe|comet|meteor|asteroid|orbit|constellation|telescope|astronomy|spacecraft|rocket|nebula|eclipse|vacuum") },
  { id: "plants", label: "Plants", shortLabel: "Plants", icon: "♧", tags: words("plant|botany|flora"), terms: words("plant|tree|forest|flower|seed|leaf|root|grass|moss|cactus|lotus|lily|sunflower|dandelion|seaweed|mangrove|pollen|botany|garden") },
  { id: "animals-life", label: "Animals & life", shortLabel: "Life", icon: "◉", categories: words("life"), tags: words("animal|life|biology|fauna"), terms: words("life|animal|species|bird|fish|insect|mammal|wildlife|fauna|biology|ecology|human|dragon|phoenix|whale|tiger|lion|bear|camel|penguin|parrot|otter|trout|tuna") },
  { id: "architecture", label: "Architecture", shortLabel: "Buildings", icon: "▦", tags: words("architecture|building|urban"), terms: words("house|home|wall|room|building|brick|city|village|tower|bridge|temple|castle|fortress|shelter|observatory|station|port|dam|school|gallery|ruins|cottage|farmhouse|barn|skyscraper|settlement|stair|staircase") },
  { id: "technology", label: "Machines & technology", shortLabel: "Tech", icon: "⚙", categories: words("technology"), tags: words("technology|machine"), terms: words("machine|engine|computer|network|internet|electricity|robot|phone|circuit|hardware|software|automation|factory|generator|turbine|laser|drone|wireless|appliance|grid") },
  { id: "transport", label: "Transport", shortLabel: "Travel", icon: "➜", tags: words("transport|travel"), terms: words("car|train|plane|ship|boat|rocket|rover|vehicle|road|highway|airport|port|flight|aviation|traffic|fleet|airship|spacecraft|canal") },
  { id: "food", label: "Food", shortLabel: "Food", icon: "◇", tags: words("food|culinary"), terms: words("food|bread|dinner|tea|fruit|vegetable|kitchen|cooking|honey|meat|fish|soup|salad|sandwich|toast|cereal|dessert|caramel|sushi|seafood|garnish|feast|picnic") },
  { id: "knowledge", label: "Knowledge", shortLabel: "Knowledge", icon: "⌘", tags: words("knowledge|science|education|history"), terms: words("book|school|science|study|research|library|history|atlas|reading|engineering|physics|biology|geology|astronomy|meteorology|oceanography|knowledge") },
  { id: "arts-culture", label: "Arts & culture", shortLabel: "Arts", icon: "✧", tags: words("art|culture|sound"), terms: words("art|music|gallery|concert|festival|illustration|painting|sculpture|color|dance|theater|poetry|literature|watercolor|pyrography") }
].map((definition, priority) => Object.freeze({ ...definition, priority })));

const BY_ID = new Map(DEFINITIONS.map((definition) => [definition.id, definition]));
const facetKey = (value) => normalize(value)
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");
const ALIASES = new Map([
  ["force", "forces"], ["liquid", "liquids"], ["water", "liquids"],
  ["air", "weather"], ["fire", "fire-heat"], ["heat", "fire-heat"],
  ["material", "materials"], ["land", "landforms"], ["places", "landforms"],
  ["life", "animals-life"], ["animals", "animals-life"], ["animal", "animals-life"],
  ["building", "architecture"], ["buildings", "architecture"], ["structure", "architecture"],
  ["tech", "technology"], ["machines", "technology"], ["travel", "transport"],
  ["art", "arts-culture"], ["arts", "arts-culture"], ["culture", "arts-culture"],
  ...DEFINITIONS.flatMap((definition) => [
    [definition.label, definition.id],
    [definition.shortLabel, definition.id]
  ])
].map(([alias, id]) => [facetKey(alias), id]));

export const WORD_BLOOM_SEMANTIC_FACETS = Object.freeze(DEFINITIONS.map(({ categories: _categories, tags: _tags, terms: _terms, ...facet }) => Object.freeze(facet)));

export function normalizeWordBloomFacet(value) {
  const id = facetKey(value);
  if (!id) return null;
  if (id === "all" || id === "all-words") return "all";
  return BY_ID.has(id) ? id : ALIASES.get(id) || null;
}

function itemTokens(item) {
  return normalize(item?.word).split(/[^a-z0-9]+/u).filter(Boolean);
}

function explicitTags(item) {
  const values = [item?.semanticTags, item?.tags, item?.facets].flatMap((value) => {
    if (Array.isArray(value)) return value;
    if (value instanceof Set) return [...value];
    return typeof value === "string" ? [value] : [];
  });
  return new Set(values.map(normalize).filter(Boolean));
}

export function wordMatchesSemanticFacet(item, facetId) {
  const id = normalizeWordBloomFacet(facetId);
  if (!item || typeof item !== "object" || item.ghost || item.unavailable || item.disabled || id === null) return false;
  if (id === "all") return Boolean(normalize(item.word));
  const definition = BY_ID.get(id);
  const category = normalize(item.category);
  const tags = explicitTags(item);
  if ([id, normalize(definition.label), normalize(definition.shortLabel), ...(definition.tags || [])].some((tag) => tags.has(tag))) return true;
  if ((definition.categories || []).includes(category)) return true;
  const fullWord = normalize(item.word);
  if (definition.terms.includes(fullWord)) return true;
  const tokens = itemTokens(item);
  return tokens.some((token) => definition.terms.includes(token));
}

function uniquePlayableWords(source) {
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(source) ? source : []) {
    const id = normalize(item?.word);
    if (!id || seen.has(id) || item?.ghost || item?.unavailable || item?.disabled) continue;
    seen.add(id);
    result.push(item);
  }
  return result;
}

export function filterWordsBySemanticFacet({ words: source, facet = "all" } = {}) {
  const id = normalizeWordBloomFacet(facet);
  if (id === null) return [];
  return uniquePlayableWords(source).filter((item) => wordMatchesSemanticFacet(item, id));
}

export function availableWordBloomFacets({ words: source, minimum = 2 } = {}) {
  const inventory = uniquePlayableWords(source);
  const threshold = Math.max(2, Math.floor(Number(minimum) || 2));
  const seenMembership = new Set();
  const visible = [];
  for (const facet of WORD_BLOOM_SEMANTIC_FACETS) {
    const matches = inventory.filter((item) => wordMatchesSemanticFacet(item, facet.id));
    if (matches.length < threshold) continue;
    const membership = matches.map((item) => normalize(item.word)).sort().join("|");
    if (seenMembership.has(membership)) continue;
    seenMembership.add(membership);
    visible.push(Object.freeze({ ...facet, count: matches.length }));
  }
  return visible;
}
