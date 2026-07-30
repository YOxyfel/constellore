const original = (id, text) => Object.freeze({
  id,
  text,
  kind: "original"
});

const attributed = (id, text, author, sourceTitle, sourceUrl) => Object.freeze({
  id,
  text,
  author,
  kind: "attributed",
  sourceTitle,
  sourceUrl
});

export const COSMIC_QUOTES = Object.freeze([
  original("world-is-your-canvas", "The world is your canvas. Every word is a new color."),
  original("where-stars-take-you", "Follow one small idea and see where the stars take you."),
  original("unknown-is-invitation", "The unknown is not a wall. It is an invitation."),
  original("small-things-new-world", "Two small things can become a world neither could make alone."),
  original("wonder-is-first-ingredient", "Wonder is the first ingredient in every discovery."),
  original("wrong-turn-new-orbit", "A wrong turn may be the start of a better orbit."),
  original("word-is-door", "Every word is a door. Curiosity is the handle."),
  original("patient-stars", "The stars reward patience, but they begin with a spark."),
  original("ingredients-everywhere", "Look closely. The ingredients of tomorrow are already here."),
  original("universe-between-words", "A universe can hide in the space between two words."),
  original("curiosity-compass", "Let curiosity be your compass and meaning be your north."),
  original("more-than-one-route", "There is more than one route through any constellation."),
  original("unlikely-neighbors", "The brightest discoveries often begin with unlikely neighbors."),
  original("discovery-changes-map", "Every discovery changes the map of what can come next."),
  original("spark-needs-second-idea", "One idea is a spark. A second idea gives it somewhere to go."),
  original("constellations-from-connections", "Constellations are not made of stars alone, but of connections."),
  original("familiar-becomes-new", "Combine the familiar until it becomes something you have never seen."),
  original("no-discovery-wasted", "No honest discovery is wasted. It lights another path."),
  original("sky-built-one-light", "The widest sky is still built one light at a time."),
  original("names-shape-worlds", "Name a thing, connect it, and watch its world take shape."),
  original("one-word-wander", "Let one word wander. It may return carrying a universe."),
  original("smallest-bridge", "The smallest bridge can join the most distant ideas."),
  original("start-with-simple", "Start with the simple. The extraordinary knows how to grow."),
  original("imagination-has-gravity", "Imagination has gravity. Ideas are always drawing closer."),
  original("universe-answers-combinations", "The universe answers in combinations, not conclusions."),
  original("choose-gently", "Choose gently. Even a quiet word can move a whole sky."),
  original("next-world-waits", "The next world is waiting inside a connection not yet made."),
  original("creation-begins-together", "Creation begins when two ordinary things meet at the right moment."),
  original("every-pair-question", "Every pair is a question. The new word is its answer."),
  original("distant-ideas-neighbors", "In a curious mind, distant ideas are only future neighbors."),
  original("path-can-curve", "The path does not need to be straight to lead somewhere true."),
  original("fresh-orbit", "When an idea stops moving, give it a new orbit."),
  original("impossible-becomes-ordinary", "Discovery is how the impossible becomes ordinary."),
  original("idea-reaches-for-another", "An idea becomes a journey the moment it reaches for another."),
  original("cosmos-speaks-combinations", "The cosmos rarely whispers one word at a time."),
  original("opposites-make-horizon", "Bring opposites together. A horizon needs both earth and sky."),
  original("elements-are-beginnings", "Fire, water, earth, and air are beginnings, not boundaries."),
  original("search-for-meaning", "Do not search only for words. Search for what they can mean together."),
  original("one-connection-changes-everything", "Sometimes one connection changes everything that follows."),
  original("think-like-constellation", "Think like a constellation: apart is only the beginning."),
  original("mystery-wants-company", "A mystery is an invitation for two ideas to meet."),
  original("build-the-answer", "Do not wait for the answer. Build the path that makes it possible."),
  attributed(
    "shakespeare-heaven-and-earth",
    "There are more things in heaven and earth, Horatio, than are dreamt of in your philosophy.",
    "William Shakespeare",
    "Hamlet, Act I, Scene V",
    "https://www.gutenberg.org/files/1524/1524-h/1524-h.htm"
  ),
  attributed(
    "blake-grain-of-sand",
    "To see a world in a grain of sand, and a heaven in a wild flower.",
    "William Blake",
    "Auguries of Innocence",
    "https://www.poetryfoundation.org/poems/43650/auguries-of-innocence"
  ),
  attributed(
    "wilde-define-limit",
    "To define is to limit.",
    "Oscar Wilde",
    "The Picture of Dorian Gray",
    "https://www.gutenberg.org/cache/epub/174/pg174-images.html"
  ),
  attributed(
    "newton-see-further",
    "If I have seen further it is by standing on the shoulders of Giants.",
    "Isaac Newton",
    "Letter to Robert Hooke, 5 February 1676",
    "https://www.lindahall.org/about/news/scientist-of-the-day/isaac-newton-3/"
  ),
  attributed(
    "whitman-journey-work-stars",
    "I believe a leaf of grass is no less than the journey work of the stars.",
    "Walt Whitman",
    "Song of Myself, Leaves of Grass",
    "https://www.gutenberg.org/files/1322/old/1322-h/1322-h.htm"
  ),
  attributed(
    "muir-sun-within",
    "The sun shines not on us but in us.",
    "John Muir",
    "John of the Mountains",
    "https://home.nps.gov/jomu/learn/historyculture/john-muir-quotes.htm"
  ),
  attributed(
    "emerson-look-at-stars",
    "But if a man would be alone, let him look at the stars.",
    "Ralph Waldo Emerson",
    "Nature",
    "https://www.gutenberg.org/cache/epub/29433/pg29433-images.html"
  ),
  attributed(
    "aurelius-universe-transformation",
    "The universe is transformation: life is opinion.",
    "Marcus Aurelius",
    "Meditations, Book IV (George Long translation)",
    "https://www.gutenberg.org/files/15877/15877-h/15877-h.htm"
  )
]);

function quoteIndex(random, size) {
  const sampled = Number(random());
  const normalized = Number.isFinite(sampled)
    ? Math.min(Math.max(sampled, 0), 0.9999999999999999)
    : 0;
  return Math.floor(normalized * size);
}

export function selectCosmicQuote({
  previousId = "",
  random = Math.random
} = {}) {
  const previousIndex = COSMIC_QUOTES.findIndex((quote) => quote.id === previousId);
  const hasExcludedQuote = previousIndex >= 0 && COSMIC_QUOTES.length > 1;
  const availableCount = hasExcludedQuote
    ? COSMIC_QUOTES.length - 1
    : COSMIC_QUOTES.length;
  let selectedIndex = quoteIndex(
    typeof random === "function" ? random : Math.random,
    availableCount
  );

  if (hasExcludedQuote && selectedIndex >= previousIndex) {
    selectedIndex += 1;
  }
  return COSMIC_QUOTES[selectedIndex];
}
