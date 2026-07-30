const GOLDEN_ANGLE = 137.507764;
const DEFERRED_LAUNCH_MODES = new Set(["daily", "explore", "creator"]);

export const FIRST_DISCOVERY_PARTICLE_COUNT = 42;
export const FIRST_DISCOVERY_HOLD_MS = 1050;

export function firstGameRequired({ firstOrbit, wins } = {}) {
  const completedWins = Math.max(0, Math.floor(Number(wins) || 0));
  return completedWins === 0 && firstOrbit?.completed !== true;
}

export function firstGameLaunchIntent(mode) {
  const normalized = String(mode || "").trim().toLowerCase();
  return DEFERRED_LAUNCH_MODES.has(normalized) ? normalized : "";
}

export function preserveAnonymousFirstGameProgress(firstOrbit, { anonymous = false } = {}) {
  if (!anonymous) return null;
  const completed = firstOrbit?.completed === true;
  return {
    seen: completed || firstOrbit?.seen === true,
    completed
  };
}

export function firstDiscoveryBurstPlan(count = FIRST_DISCOVERY_PARTICLE_COUNT) {
  const total = Math.min(64, Math.max(12, Math.floor(Number(count) || FIRST_DISCOVERY_PARTICLE_COUNT)));
  const tones = ["gold", "cyan", "violet", "white"];
  const glyphs = ["✦", "✧", "⋆"];

  return Object.freeze(Array.from({ length: total }, (_, index) => {
    const angle = (index * GOLDEN_ANGLE + 18) % 360;
    const radians = angle * Math.PI / 180;
    const distance = 22 + (index % 8) * 4.2 + (Math.floor(index / 8) % 2) * 2.5;
    const kind = index % 9 === 0 ? "comet" : index % 4 === 0 ? "dust" : "star";
    return Object.freeze({
      kind,
      tone: tones[index % tones.length],
      glyph: kind === "star" ? glyphs[index % glyphs.length] : "",
      x: Number((Math.cos(radians) * distance).toFixed(2)),
      y: Number((Math.sin(radians) * distance).toFixed(2)),
      delay: (index % 10) * 18 + Math.floor(index / 10) * 12,
      duration: 650 + (index % 6) * 36,
      size: 5 + (index % 5) * 2,
      spin: (index % 2 ? 1 : -1) * (140 + (index % 6) * 45)
    });
  }));
}
