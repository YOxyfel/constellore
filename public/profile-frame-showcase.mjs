import { PROFILE_FRAMES } from "./profile-frame-catalog.mjs?v=5.0.0-beta.4";

const fullGrid = document.querySelector("#fullFrameGrid");
const partialGrid = document.querySelector("#partialFrameGrid");
const template = document.querySelector("#profileFrameTemplate");
const motionToggle = document.querySelector("#motionToggle");
const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
const partialFrames = PROFILE_FRAMES.filter((entry) => entry.layout === "partial");

const percentage = (value) => `${(value * 100).toFixed(4)}%`;
const polygon = (shape) => `polygon(${shape.map((point) => (
  `${percentage(point.x)} ${percentage(point.y)}`
)).join(", ")})`;

function particleMarkup(effect) {
  const count = effect === "ember" ? 16 : effect === "abyssal" ? 12 : 10;
  return Array.from({ length: count }, (_, index) => {
    const x = 8 + ((index * 37) % 84);
    const y = 4 + ((index * 53) % 91);
    const delay = -((index * 0.43) % 5.7);
    const duration = 3.6 + ((index * 0.71) % 3.2);
    const scale = 0.62 + ((index * 17) % 48) / 100;
    return `<i style="--x:${x}%;--y:${y}%;--delay:${delay}s;--duration:${duration}s;--scale:${scale}"></i>`;
  }).join("");
}

function renderIsland(entry, island, card) {
  const wrapper = document.createElement("span");
  const source = document.createElement("img");

  wrapper.className = "profile-frame-island";
  wrapper.dataset.island = island.id;
  wrapper.dataset.plane = island.plane;
  for (const [edge, value] of Object.entries(island.crop)) {
    wrapper.style.setProperty(`--island-crop-${edge}`, percentage(value));
  }
  wrapper.style.setProperty("--island-x", percentage(island.placement.x));
  wrapper.style.setProperty("--island-y", percentage(island.placement.y));

  source.className = "profile-frame-island__source";
  if (island.shape) source.style.setProperty("--island-clip", polygon(island.shape));
  source.src = entry.art;
  source.alt = "";
  source.loading = "lazy";
  source.decoding = "async";
  source.draggable = false;
  source.addEventListener("error", () => {
    card.dataset.assetState = "missing";
  }, { once: true });
  wrapper.append(source);

  return wrapper;
}

function renderFrame(entry) {
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector(".frame-entry");
  const stage = fragment.querySelector(".profile-frame-stage");
  const artRoot = fragment.querySelector(".profile-frame-art");
  const fullArt = fragment.querySelector(".profile-frame-art__full");
  const outsidePlane = fragment.querySelector(".profile-frame-islands--outside");
  const cardPlane = fragment.querySelector(".profile-frame-islands--card-clipped");
  const effect = fragment.querySelector(".profile-effect");
  const palette = fragment.querySelector(".frame-entry__palette");

  card.dataset.frame = entry.slug;
  card.dataset.layout = entry.layout;
  stage.dataset.effect = entry.effect || "static";
  for (const [edge, value] of Object.entries(entry.fit)) {
    stage.style.setProperty(`--card-${edge}`, value);
  }
  stage.style.setProperty("--card-content-inset", entry.contentInset);
  stage.style.setProperty("--card-avatar-top", entry.avatarTop);
  artRoot.dataset.artLayout = entry.layout;

  if (entry.layout === "partial") {
    fullArt.remove();
    for (const island of entry.islands) {
      const plane = island.plane === "card" ? cardPlane : outsidePlane;
      plane.append(renderIsland(entry, island, card));
    }
  } else {
    outsidePlane.remove();
    cardPlane.remove();
    fullArt.src = entry.art;
    fullArt.addEventListener("error", () => {
      card.dataset.assetState = "missing";
    }, { once: true });
  }

  fragment.querySelector(".frame-entry__eyebrow").textContent = entry.epithet;
  fragment.querySelector(".frame-entry__meta h2").textContent = entry.name;
  fragment.querySelector(".frame-entry__meta p").textContent = entry.description;

  const motionBadge = fragment.querySelector(".frame-entry__motion");
  const typeBadge = fragment.querySelector(".frame-entry__type");
  typeBadge.hidden = entry.layout !== "partial";
  motionBadge.hidden = !entry.animated;
  if (!entry.animated) effect.remove();
  else effect.querySelector(".effect-particles").innerHTML = particleMarkup(entry.effect);

  for (const color of entry.palette) {
    const swatch = document.createElement("i");
    swatch.style.setProperty("--swatch", color);
    palette.append(swatch);
  }

  return fragment;
}

function syncMotionPreference() {
  const systemReduced = Boolean(reducedMotion?.matches);
  const enabled = Boolean(motionToggle.checked) && !systemReduced;
  document.documentElement.dataset.effects = enabled ? "full" : "off";
  motionToggle.disabled = systemReduced;
  motionToggle.closest("label")?.classList.toggle("is-system-reduced", systemReduced);
}

document.querySelector("#frameCount").textContent = PROFILE_FRAMES.length;
document.querySelector("#effectCount").textContent =
  PROFILE_FRAMES.filter((entry) => entry.animated).length;
document.querySelector("#partialCount").textContent = partialFrames.length;
for (const entry of PROFILE_FRAMES) {
  const grid = entry.layout === "partial" ? partialGrid : fullGrid;
  grid.append(renderFrame(entry));
}
motionToggle.addEventListener("change", syncMotionPreference);
reducedMotion?.addEventListener?.("change", syncMotionPreference);
syncMotionPreference();
