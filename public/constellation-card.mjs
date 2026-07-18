const CARD_VERSION = 1;
const MAX_POINTS = 18;

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(number)));
}

function cleanText(value, maximum = 80) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ next >>> 15, next | 1);
    next ^= next + Math.imul(next ^ next >>> 7, next | 61);
    return ((next ^ next >>> 14) >>> 0) / 4294967296;
  };
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["https:", "http:"].includes(url.protocol) ? url.toString().slice(0, 500) : "";
  } catch {
    return "";
  }
}

function divisionFor({ training, scoringDisabled, assist, wished }) {
  if (training) return "TRAINING";
  if (scoringDisabled) return "STUDY";
  return assist && assist !== "none" || wished ? "OPEN" : "PURE";
}

function constellationPoints(count, seedValue) {
  const random = seeded(seedValue);
  const safeCount = clampInteger(count, 4, MAX_POINTS, 7);
  const points = [];
  for (let index = 0; index < safeCount; index += 1) {
    const progress = safeCount === 1 ? 0 : index / (safeCount - 1);
    const angle = -1.7 + progress * Math.PI * 3.55 + (random() - .5) * .38;
    const radiusX = 245 + Math.sin(progress * Math.PI) * 135;
    const radiusY = 250 + Math.cos(progress * Math.PI * 2) * 80;
    points.push({
      x: Math.round(540 + Math.cos(angle) * radiusX + (random() - .5) * 38),
      y: Math.round(620 + Math.sin(angle) * radiusY + (random() - .5) * 38),
      radius: Number((4.5 + random() * 5.5).toFixed(1)),
      glow: Number((.45 + random() * .5).toFixed(2))
    });
  }
  return points;
}

export function buildConstellationCard(input = {}) {
  const history = Array.isArray(input.history) ? input.history.slice(-MAX_POINTS) : [];
  const target = cleanText(input.target, 64) || "Unknown Star";
  const universeName = cleanText(input.universe?.name || input.law?.name || "Deep Void", 48);
  const seedIdentity = cleanText(input.universe?.id || input.seedIdentity || input.seed || "origin", 48);
  const seedValue = stableHash(`${target}|${seedIdentity}|${history.map((step) => step?.word).join("|")}`);
  const milestones = [];
  for (const step of history) {
    const word = cleanText(step?.word, 38);
    if (!word || word.toLocaleLowerCase("en-US") === target.toLocaleLowerCase("en-US") || milestones.includes(word)) continue;
    milestones.push(word);
    if (milestones.length >= 4) break;
  }
  return {
    version: CARD_VERSION,
    target,
    emoji: cleanText(input.emoji || "✦", 12),
    moves: clampInteger(input.moves, 0, 999, history.length),
    seconds: clampInteger(input.seconds, 0, 86_399, 0),
    stars: clampInteger(input.stars ?? history.length, 0, 999, history.length),
    discoveries: clampInteger(input.discoveries, 0, 9999, 0),
    division: divisionFor(input),
    universe: { name: universeName, id: seedIdentity },
    milestones,
    challengeUrl: safeUrl(input.challengeUrl),
    points: constellationPoints(Math.max(4, history.length + 2), seedValue),
    signature: seedValue.toString(36).toUpperCase().padStart(7, "0")
  };
}

function xml(value) {
  return cleanText(value, 500)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatTime(seconds) {
  const safe = clampInteger(seconds, 0, 86_399, 0);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function renderConstellationCardSvg(rawModel) {
  const model = rawModel?.version === CARD_VERSION && Array.isArray(rawModel.points)
    ? {
      ...rawModel,
      target: cleanText(rawModel.target, 64) || "Unknown Star",
      emoji: cleanText(rawModel.emoji || "✦", 12),
      division: ["PURE", "OPEN", "STUDY", "TRAINING"].includes(rawModel.division) ? rawModel.division : "PURE",
      universe: { name: cleanText(rawModel.universe?.name || "Deep Void", 48), id: cleanText(rawModel.universe?.id || "origin", 48) },
      milestones: (Array.isArray(rawModel.milestones) ? rawModel.milestones : []).map((word) => cleanText(word, 38)).filter(Boolean).slice(0, 4),
      points: rawModel.points.slice(0, MAX_POINTS).map((point) => ({
        x: clampInteger(point?.x, 40, 1040, 540), y: clampInteger(point?.y, 300, 900, 620),
        radius: Math.min(12, Math.max(2, Number(point?.radius) || 5)), glow: Math.min(1, Math.max(0, Number(point?.glow) || .5))
      }))
    }
    : buildConstellationCard(rawModel);
  const lines = model.points.slice(1).map((point, index) => {
    const prior = model.points[index];
    return `<line x1="${prior.x}" y1="${prior.y}" x2="${point.x}" y2="${point.y}"/>`;
  }).join("");
  const points = model.points.map((point, index) => `<g><circle class="halo" cx="${point.x}" cy="${point.y}" r="${Math.round(point.radius * 4)}" opacity="${point.glow}"/><circle class="star" cx="${point.x}" cy="${point.y}" r="${point.radius}"/><text class="star-index" x="${point.x}" y="${point.y + 30}">${String(index + 1).padStart(2, "0")}</text></g>`).join("");
  const milestones = model.milestones.length
    ? model.milestones.map((word, index) => `<text class="milestone" x="${86 + (index % 2) * 470}" y="${1084 + Math.floor(index / 2) * 42}">✦ ${xml(word)}</text>`).join("")
    : `<text class="milestone muted" x="86" y="1084">A NEW CONSTELLATION WAS TRACED</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img" aria-labelledby="title description">
  <title id="title">Constellore constellation card for ${xml(model.target)}</title>
  <desc id="description">A ${xml(model.division.toLowerCase())} path with ${model.moves} moves and ${model.stars} stars.</desc>
  <defs>
    <radialGradient id="void" cx="72%" cy="18%" r="92%"><stop offset="0" stop-color="#38256f"/><stop offset=".42" stop-color="#15162e"/><stop offset="1" stop-color="#070812"/></radialGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#a98cff"/><stop offset="1" stop-color="#69e6ff"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="12"/></filter>
  </defs>
  <rect width="1080" height="1350" rx="48" fill="url(#void)"/>
  <rect x="38" y="38" width="1004" height="1274" rx="30" fill="none" stroke="#ffffff" stroke-opacity=".12"/>
  <text x="76" y="112" class="brand">CONSTELLORE</text><text x="1004" y="112" text-anchor="end" class="universe">${xml(model.universe.name.toUpperCase())}</text>
  <text x="76" y="218" class="emoji">${xml(model.emoji)}</text><text x="158" y="199" class="kicker">CONSTELLATION FOUND</text><text x="158" y="259" class="target">${xml(model.target)}</text>
  <g class="connections">${lines}</g><g>${points}</g>
  <g><rect x="76" y="932" width="928" height="96" rx="16" fill="#ffffff" fill-opacity=".045" stroke="#ffffff" stroke-opacity=".1"/>
    <text class="stat-label" x="112" y="970">DIVISION</text><text class="stat" x="112" y="1005">${xml(model.division)}</text>
    <text class="stat-label" x="356" y="970">MOVES</text><text class="stat" x="356" y="1005">${model.moves}</text>
    <text class="stat-label" x="550" y="970">TIME</text><text class="stat" x="550" y="1005">${formatTime(model.seconds)}</text>
    <text class="stat-label" x="760" y="970">STARS</text><text class="stat" x="760" y="1005">${model.stars}</text></g>
  <g>${milestones}</g>
  <line x1="76" y1="1206" x2="1004" y2="1206" stroke="#ffffff" stroke-opacity=".12"/>
  <text class="footer" x="76" y="1264">A UNIVERSE MADE OF WORDS</text><text class="footer" x="1004" y="1264" text-anchor="end">ORBIT ${xml(model.signature)}</text>
  <style>
    text{font-family:Manrope,Arial,sans-serif;fill:#f4f1ff}.brand,.universe,.kicker,.stat-label,.footer,.star-index,.milestone{font-family:"DM Mono",Consolas,monospace;letter-spacing:2px}.brand{font-size:28px;font-weight:700}.universe{font-size:19px;fill:#aaa2c4}.emoji{font-size:62px}.kicker{font-size:19px;fill:#a98cff}.target{font-size:54px;font-weight:650}.connections{stroke:url(#line);stroke-width:3;stroke-opacity:.48}.halo{fill:#9b7cff;filter:url(#glow)}.star{fill:#f8f6ff;stroke:#a98cff;stroke-width:3}.star-index{font-size:13px;fill:#8e88a6}.stat-label{font-size:15px;fill:#8e88a6}.stat{font-size:27px;font-weight:650}.milestone{font-size:18px;fill:#cbc4e7}.muted{fill:#8e88a6}.footer{font-size:17px;fill:#8e88a6}
  </style>
</svg>`;
}

export function constellationCardFilename(model) {
  const target = cleanText(model?.target || "constellation", 50).toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "constellation";
  return `constellore-${target}-${cleanText(model?.signature || "orbit", 16).toLocaleLowerCase("en-US")}.svg`;
}

export function constellationCardShareText(model) {
  const safe = model?.version === CARD_VERSION
    ? {
      target: cleanText(model.target, 64) || "Unknown Star",
      moves: clampInteger(model.moves, 0, 999, 0),
      division: ["PURE", "OPEN", "STUDY", "TRAINING"].includes(model.division) ? model.division : "PURE"
    }
    : buildConstellationCard(model);
  return `I traced ${safe.target} in ${safe.moves} moves · ${safe.division} orbit · Constellore`;
}
