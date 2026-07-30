import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConstellationCard,
  buildConstelloreChallengeUrl,
  constellationCardFilename,
  constellationCardShareText,
  constellationSharePresentation,
  normalizeConstellationCardStyle,
  parseConstelloreChallengeUrl,
  renderConstellationCardSvg
} from "../public/constellation-card.mjs";

const input = {
  target: "Telescope", emoji: "🔭", moves: 8, seconds: 73, discoveries: 5, seed: 42,
  universe: { name: "Clockwork Nebula", id: "clockwork-42" },
  history: [
    { a: "Earth", b: "Water", word: "Mud" }, { a: "Mud", b: "Fire", word: "Brick" },
    { a: "Fire", b: "Water", word: "Steam" }, { a: "Air", b: "Steam", word: "Cloud" },
    { a: "Cloud", b: "Energy", word: "Storm" }, { a: "Glass", b: "Sky", word: "Telescope" }
  ]
};

test("constellation cards are deterministic, bounded, and carry fair-play context", () => {
  const first = buildConstellationCard(input);
  const again = buildConstellationCard(input);
  assert.deepEqual(again, first);
  assert.equal(first.target, "Telescope");
  assert.equal(first.division, "PURE");
  assert.equal(first.points.length, 8);
  assert.ok(first.points.every((point) => point.x >= 0 && point.x <= 1080 && point.y >= 0 && point.y <= 1350));
  assert.deepEqual(first.milestones, ["Mud", "Brick", "Steam", "Cloud"]);
  assert.equal(buildConstellationCard({ ...input, wished: true }).division, "OPEN");
  assert.equal(buildConstellationCard({ ...input, training: true }).division, "TRAINING");
  assert.equal(buildConstellationCard({ ...input, scoringDisabled: true }).division, "STUDY");
});

test("SVG cards are standalone, escaped images with no executable markup", () => {
  const model = buildConstellationCard({ ...input, target: '<script>alert("x")</script>', universe: { name: "Bad & Bright", id: "x" } });
  const svg = renderConstellationCardSvg(model);
  assert.match(svg, /^<svg xmlns=/);
  assert.match(svg, /width="1080" height="1350"/);
  assert.match(svg, /&lt;script&gt;alert/);
  assert.doesNotMatch(svg, /<script|onload=|javascript:/i);
  assert.match(svg, /BAD &amp; BRIGHT/);
});

test("card filenames and share text are safe and useful", () => {
  const model = buildConstellationCard(input);
  assert.match(constellationCardFilename(model), /^constellore-telescope-[a-z0-9]+[.]svg$/);
  assert.equal(constellationCardShareText(model), "I traced Telescope in 8 moves · PURE orbit · Constellore. Can you find another path?");
  assert.match(constellationCardShareText({ ...model, division: "STUDY" }), /STUDY orbit/);
});

test("daily cards are contextual, spoiler-safe, and link to the exact shared word", () => {
  const game = {
    target: "Telescope",
    emoji: "🔭",
    clue: "Look farther than the naked eye.",
    mode: "daily",
    seed: 20_300,
    challengeId: "daily:2026-07-26",
    universe: { name: "Stellar Drift", id: "stellar-20300" }
  };
  const challengeUrl = buildConstelloreChallengeUrl(game, "https://example.test/play/?old=1#ignored");
  assert.equal(
    challengeUrl,
    "https://example.test/play/?challenge=1&target=Telescope&seed=20300&from=daily&day=2026-07-26"
  );
  assert.deepEqual(parseConstelloreChallengeUrl(challengeUrl, "2026-07-26"), {
    target: "Telescope",
    seed: 20_300,
    source: "daily",
    dailyKey: "2026-07-26",
    currentDaily: true,
    mode: "daily"
  });
  assert.equal(parseConstelloreChallengeUrl(challengeUrl, "2026-07-27").mode, "challenge");

  const model = buildConstellationCard({
    ...input,
    ...game,
    dailyKey: "2026-07-26",
    completed: true,
    challengeUrl
  });
  const svg = renderConstellationCardSvg(model);
  assert.equal(model.realm, "cosmic");
  assert.match(svg, /TODAY'S SHARED WORD/);
  assert.match(svg, /RECIPE WORDS HIDDEN/);
  assert.match(svg, /Look farther than the naked eye/);
  for (const spoiler of ["Mud", "Brick", "Steam", "Cloud", "Storm"]) {
    assert.doesNotMatch(svg, new RegExp(`>${spoiler}<`, "i"));
  }
  assert.match(constellationCardShareText(model), /Today's shared Constellore word was Telescope/);
  assert.match(constellationCardFilename(model), /^constellore-daily-telescope-/);
});

test("challenge parsing rejects malformed or non-challenge links", () => {
  assert.equal(parseConstelloreChallengeUrl("?target=Mud&seed=1", "2026-07-26"), null);
  assert.equal(parseConstelloreChallengeUrl("?challenge=1&seed=1", "2026-07-26"), null);
  assert.equal(buildConstelloreChallengeUrl({ target: "" }, "https://example.test/play/"), "");
  assert.equal(buildConstelloreChallengeUrl({ target: "Mud" }, "javascript:alert(1)"), "");
});

test("share presentation stays plain and matches the card context", () => {
  const daily = buildConstellationCard({ ...input, mode: "daily", completed: true });
  assert.deepEqual(constellationSharePresentation(daily), {
    title: "Pass today's word onward.",
    description: "Everyone gets the same destination. Your route stays hidden.",
    actionLabel: "Share today's challenge",
    eyebrow: "CONSTELLATION CARD · TODAY'S WORD"
  });
  assert.equal(
    constellationSharePresentation(buildConstellationCard({ ...input, scoringDisabled: true })).title,
    "Keep this study constellation."
  );
});

test("card cosmetics are deterministic, sanitized presentation only", () => {
  const challengeUrl = buildConstelloreChallengeUrl(
    { target: input.target, seed: input.seed },
    "https://example.test/play/"
  );
  const defaultCard = buildConstellationCard({ ...input, challengeUrl });
  const auroraCard = buildConstellationCard({
    ...input,
    challengeUrl,
    cosmeticCollection: "constellore.collection.aurora-archive"
  });
  const solarCard = buildConstellationCard({
    ...input,
    challengeUrl,
    cardStyle: { slug: "solar-foundry" }
  });
  const lunarCard = buildConstellationCard({
    ...input,
    challengeUrl,
    cosmeticCollection: "constellore.collection.lunar-garden"
  });
  const eclipseCard = buildConstellationCard({
    ...input,
    challengeUrl,
    cardStyle: { id: "constellore.collection.eclipse-sovereign" }
  });
  const pixelCard = buildConstellationCard({
    ...input,
    challengeUrl,
    cosmeticCollection: "constellore.collection.pixel-frontier"
  });
  const reefCard = buildConstellationCard({
    ...input,
    challengeUrl,
    cardStyle: { slug: "bubble-reef" }
  });
  const vanguardCard = buildConstellationCard({
    ...input,
    challengeUrl,
    cardStyle: { id: "constellore.collection.stellar-vanguard" }
  });
  const customCard = buildConstellationCard({ ...input, challengeUrl, cardStyle: "custom" });

  assert.equal(defaultCard.cardStyle, undefined);
  assert.equal(auroraCard.cardStyle, "aurora-archive");
  assert.equal(solarCard.cardStyle, "solar-foundry");
  assert.equal(lunarCard.cardStyle, "lunar-garden");
  assert.equal(eclipseCard.cardStyle, "eclipse-sovereign");
  assert.equal(pixelCard.cardStyle, "pixel-frontier");
  assert.equal(reefCard.cardStyle, "bubble-reef");
  assert.equal(vanguardCard.cardStyle, "stellar-vanguard");
  assert.equal(customCard.cardStyle, "custom");
  for (const styledCard of [
    auroraCard,
    solarCard,
    lunarCard,
    eclipseCard,
    pixelCard,
    reefCard,
    vanguardCard,
    customCard
  ]) {
    assert.equal(styledCard.signature, defaultCard.signature);
    assert.deepEqual(styledCard.points, defaultCard.points);
    assert.equal(styledCard.challengeUrl, defaultCard.challengeUrl);
    assert.equal(constellationCardFilename(styledCard), constellationCardFilename(defaultCard));
  }
  assert.equal(constellationCardFilename(auroraCard), constellationCardFilename(defaultCard));
  assert.equal(
    renderConstellationCardSvg(auroraCard),
    renderConstellationCardSvg(buildConstellationCard({
      ...input,
      challengeUrl,
      cardStyle: "aurora-archive"
    }))
  );
});

test("collection cards have distinct materials while realm identity stays visible", () => {
  const celestial = renderConstellationCardSvg(buildConstellationCard(input));
  const aurora = renderConstellationCardSvg(buildConstellationCard({ ...input, cardStyle: "aurora-archive" }));
  const solar = renderConstellationCardSvg(buildConstellationCard({ ...input, cardStyle: "solar-foundry" }));
  const lunar = renderConstellationCardSvg(buildConstellationCard({ ...input, cardStyle: "lunar-garden" }));
  const eclipse = renderConstellationCardSvg(buildConstellationCard({ ...input, cardStyle: "eclipse-sovereign" }));
  const pixel = renderConstellationCardSvg(buildConstellationCard({ ...input, cardStyle: "pixel-frontier" }));
  const reef = renderConstellationCardSvg(buildConstellationCard({ ...input, cardStyle: "bubble-reef" }));
  const vanguard = renderConstellationCardSvg(buildConstellationCard({ ...input, cardStyle: "stellar-vanguard" }));
  const custom = renderConstellationCardSvg(buildConstellationCard({ ...input, cardStyle: "custom" }));

  assert.doesNotMatch(celestial, /data-card-style=/);
  assert.match(aurora, /data-card-style="aurora-archive"/);
  assert.match(aurora, /#6fffe1/);
  assert.match(aurora, /AURORA ARCHIVE/);
  assert.match(solar, /data-card-style="solar-foundry"/);
  assert.match(solar, /#e2a74f/);
  assert.match(solar, /SOLAR FOUNDRY/);
  assert.match(lunar, /data-card-style="lunar-garden"/);
  assert.match(lunar, /#78e6bd/);
  assert.match(lunar, /LUNAR GARDEN/);
  assert.match(eclipse, /data-card-style="eclipse-sovereign"/);
  assert.match(eclipse, /#f5d58a/);
  assert.match(eclipse, /ECLIPSE SOVEREIGN/);
  assert.match(pixel, /data-card-style="pixel-frontier"/);
  assert.match(pixel, /#49e6ff/);
  assert.match(pixel, /PIXEL FRONTIER/);
  assert.match(reef, /data-card-style="bubble-reef"/);
  assert.match(reef, /#5ff4e6/);
  assert.match(reef, /BUBBLE REEF/);
  assert.match(vanguard, /data-card-style="stellar-vanguard"/);
  assert.match(vanguard, /#87b8db/);
  assert.match(vanguard, /STELLAR VANGUARD/);
  assert.match(custom, /data-card-style="custom"/);
  assert.match(custom, /CUSTOM CONSTELLATION/);
  for (const svg of [celestial, aurora, solar, lunar, eclipse, pixel, reef, vanguard, custom]) {
    assert.match(svg, /CELESTIAL SKY/);
    assert.match(svg, /#7668ff/);
    assert.doesNotMatch(svg, /<script|onload=|javascript:/i);
  }
  assert.equal(normalizeConstellationCardStyle("garden"), "lunar-garden");
  assert.equal(normalizeConstellationCardStyle("sovereign"), "eclipse-sovereign");
  assert.equal(normalizeConstellationCardStyle("retro"), "pixel-frontier");
  assert.equal(normalizeConstellationCardStyle("reef"), "bubble-reef");
  assert.equal(normalizeConstellationCardStyle("vanguard"), "stellar-vanguard");
  assert.notEqual(aurora, solar);
  assert.notEqual(solar, lunar);
  assert.notEqual(lunar, eclipse);
  assert.notEqual(pixel, reef);
  assert.notEqual(reef, vanguard);
});

test("unknown card cosmetics fall back to the default without leaking tokens", () => {
  assert.equal(normalizeConstellationCardStyle("not-a-real-kit"), "celestial-atlas");
  assert.equal(normalizeConstellationCardStyle({ cosmeticCollection: { id: "unknown" } }), "celestial-atlas");
  assert.equal(normalizeConstellationCardStyle("<script>solar-foundry</script>"), "celestial-atlas");
  const unknown = buildConstellationCard({ ...input, cardStyle: "<script>solar-foundry</script>" });
  assert.equal(unknown.cardStyle, undefined);
  const svg = renderConstellationCardSvg(unknown);
  assert.doesNotMatch(svg, /<script|data-card-style=/i);
});

test("challenge payloads never include cosmetic or entitlement state", () => {
  const styledGame = {
    target: "Telescope",
    seed: 42,
    cardStyle: "aurora-archive",
    cosmeticCollection: "constellore.collection.aurora-archive",
    founderPass: true,
    ownedCosmeticIds: ["secret-entitlement"]
  };
  const url = buildConstelloreChallengeUrl(styledGame, "https://example.test/play/");
  const parsed = new URL(url);
  assert.deepEqual([...parsed.searchParams.keys()], ["challenge", "target", "seed", "from"]);
  assert.doesNotMatch(url, /aurora|cosmetic|founder|owned|entitle/i);
  assert.deepEqual(parseConstelloreChallengeUrl(url), {
    target: "Telescope",
    seed: 42,
    source: "friend",
    dailyKey: "",
    currentDaily: false,
    mode: "challenge"
  });
});
