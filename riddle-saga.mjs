export const RIDDLE_SAGA_VERSION = 1;
export const RIDDLE_SAGA_FORMAT_ID = "riddle-saga";
export const RIDDLE_SAGA_CHAPTER_COUNT = 5;
export const RIDDLE_SAGA_CHAPTER_POINTS = Object.freeze([1, 1, 1, 1, 2]);
export const RIDDLE_SAGA_CHAPTER_DURATION_SECONDS = 45;
export const RIDDLE_SAGA_FINALE_DURATION_SECONDS = 60;
export const RIDDLE_SAGA_INTERMISSION_SECONDS = 3;

const ARC_CATALOG = Object.freeze([
  Object.freeze({
    id: "roots-to-stars",
    title: "Roots to Stars",
    chapters: Object.freeze([
      Object.freeze({
        title: "The Sleeping Green",
        story: "Wake a living canopy from the four first elements.",
        target: "Forest"
      }),
      Object.freeze({
        title: "First Hearths",
        story: "Give the wanderers a place that can become a home.",
        target: "Village"
      }),
      Object.freeze({
        title: "A Thousand Lights",
        story: "Let the small settlement grow into a world of its own.",
        target: "City"
      }),
      Object.freeze({
        title: "Break the Sky",
        story: "Build the vessel that can carry the story upward.",
        target: "Rocket"
      }),
      Object.freeze({
        title: "The Endless Page",
        story: "Name the vast stage waiting beyond the final flame.",
        target: "Cosmos"
      })
    ])
  }),
  Object.freeze({
    id: "skyward-atlas",
    title: "The Skyward Atlas",
    chapters: Object.freeze([
      Object.freeze({
        title: "The Silver Road",
        story: "Find the moving path that carries the world onward.",
        target: "River"
      }),
      Object.freeze({
        title: "Stone and Starlight",
        story: "Raise a home for countless lives beside that road.",
        target: "City"
      }),
      Object.freeze({
        title: "The Far Lens",
        story: "Forge an eye able to reach beyond the night.",
        target: "Telescope"
      }),
      Object.freeze({
        title: "House of the Heavens",
        story: "Give the watchers a sanctuary beneath the stars.",
        target: "Observatory"
      }),
      Object.freeze({
        title: "The Great Spiral",
        story: "Reveal the immense realm their instruments discovered.",
        target: "Galaxy"
      })
    ])
  }),
  Object.freeze({
    id: "after-the-tempest",
    title: "After the Tempest",
    chapters: Object.freeze([
      Object.freeze({
        title: "The First Canopy",
        story: "Gather life into a shelter beneath the open sky.",
        target: "Forest"
      }),
      Object.freeze({
        title: "The Wild Deep",
        story: "Feed the canopy until it becomes an untamed world.",
        target: "Jungle"
      }),
      Object.freeze({
        title: "The Turning Sea",
        story: "Summon the great spiral that tests everything ashore.",
        target: "Hurricane"
      }),
      Object.freeze({
        title: "Fire in the Clouds",
        story: "Release the brilliant fracture hidden in the storm.",
        target: "Lightning"
      }),
      Object.freeze({
        title: "A Promise of Color",
        story: "After the violence, paint the sky with a final answer.",
        target: "Rainbow"
      })
    ])
  })
]);

function boundedSeed(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.abs(Math.trunc(number)) : 0;
}

export function riddleSagaArcCatalog() {
  return ARC_CATALOG.map((arc) => ({
    id: arc.id,
    title: arc.title,
    chapters: arc.chapters.map((chapter) => ({ ...chapter }))
  }));
}

export function selectRiddleSagaArc(seed = 0) {
  const arc = ARC_CATALOG[boundedSeed(seed) % ARC_CATALOG.length];
  return {
    id: arc.id,
    title: arc.title,
    chapters: arc.chapters.map((chapter, index) => ({
      ...chapter,
      index,
      number: index + 1,
      chapterPoints: RIDDLE_SAGA_CHAPTER_POINTS[index]
    }))
  };
}

export function riddleSagaChapterDurationMs(index) {
  return (
    Number(index) === RIDDLE_SAGA_CHAPTER_COUNT - 1
      ? RIDDLE_SAGA_FINALE_DURATION_SECONDS
      : RIDDLE_SAGA_CHAPTER_DURATION_SECONDS
  ) * 1_000;
}

export function riddleSagaScoreWinner(scores, participants = []) {
  const entries = participants.map((participant) => ({
    playerId: String(participant?.playerId || ""),
    slot: String(participant?.slot || ""),
    score: Math.max(0, Math.floor(Number(scores?.[participant?.slot]) || 0))
  }));
  if (entries.length !== 2 || entries[0].score === entries[1].score) {
    return { winnerPlayerId: "", winnerSlot: "", draw: true, entries };
  }
  const winner = entries[0].score > entries[1].score ? entries[0] : entries[1];
  return {
    winnerPlayerId: winner.playerId,
    winnerSlot: winner.slot,
    draw: false,
    entries
  };
}
