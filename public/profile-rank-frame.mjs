import {
  profileFrameBySlug
} from "./profile-frame-catalog.mjs?v=5.0.0-beta.4";

export const PROFILE_FRAME_STORAGE_KEY = "constellore-profile-frame-v1";
export const DEFAULT_PROFILE_FRAME_SLUG = "storm-seraph";
export const PROFILE_FRAME_CHANGE_EVENT = "constellore:profile-frame-change";

const percentage = (value) => `${(value * 100).toFixed(4)}%`;
const polygon = (shape) => `polygon(${shape.map((point) => (
  `${percentage(point.x)} ${percentage(point.y)}`
)).join(", ")})`;

function safeStorage(scope = globalThis) {
  try {
    return scope?.localStorage || null;
  } catch {
    return null;
  }
}

export function sanitizeProfileFrameSlug(value, fallback = DEFAULT_PROFILE_FRAME_SLUG) {
  const slug = String(value ?? "").trim();
  if (!slug) return "";
  if (profileFrameBySlug(slug)) return slug;
  return profileFrameBySlug(fallback) ? fallback : "";
}

export function resolveProfileFrameArtUrl(entry, moduleUrl = import.meta.url) {
  const art = String(entry?.art || "");
  if (!/^\.\/art\/profile-frames\/[a-z0-9-]+[.]png$/u.test(art)) return "";
  return new URL(art, moduleUrl).href;
}

export function resolveProfileFramePreviewVideoUrl(entry, moduleUrl = import.meta.url) {
  const previewVideo = String(entry?.previewVideo || "");
  if (!/^\.\/cinematic\/profile-frame-previews\/[a-z0-9-]+[.]mp4$/u.test(previewVideo)) {
    return "";
  }
  try {
    return new URL(previewVideo, moduleUrl).href;
  } catch {
    return "";
  }
}

export function profileFramePreviewVideoAllowed({
  cosmeticEffects = "full",
  reducedMotion = false,
  reducedData = false,
  saveData = false
} = {}) {
  return (
    cosmeticEffects === "full"
    && !reducedMotion
    && !reducedData
    && !saveData
  );
}

export function createProfileFramePreviewVideo({
  documentRef = globalThis.document,
  entry,
  moduleUrl = import.meta.url,
  cosmeticEffects = "full",
  reducedMotion = false,
  reducedData = false,
  saveData = false
} = {}) {
  if (
    !documentRef?.createElement
    || !profileFramePreviewVideoAllowed({
      cosmeticEffects,
      reducedMotion,
      reducedData,
      saveData
    })
  ) {
    return null;
  }

  const sourceUrl = resolveProfileFramePreviewVideoUrl(entry, moduleUrl);
  if (!sourceUrl) return null;

  const video = documentRef.createElement("video");
  video.className = "profile-frame-preview-video";
  video.dataset.state = "loading";
  video.setAttribute("data-profile-frame-preview-video", "");
  video.setAttribute("aria-hidden", "true");
  video.setAttribute("playsinline", "");
  video.setAttribute("preload", "metadata");
  video.setAttribute("tabindex", "-1");
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.autoplay = true;
  video.controls = false;
  video.playsInline = true;
  video.disablePictureInPicture = true;
  video.disableRemotePlayback = true;

  video.addEventListener("loadeddata", () => {
    video.dataset.state = "ready";
  }, { once: true });
  video.addEventListener("error", () => {
    video.dataset.state = "missing";
  }, { once: true });
  video.src = sourceUrl;
  return video;
}

export function readStoredProfileFrame(storage = safeStorage()) {
  if (!storage) return DEFAULT_PROFILE_FRAME_SLUG;
  try {
    const stored = storage.getItem(PROFILE_FRAME_STORAGE_KEY);
    return stored == null
      ? DEFAULT_PROFILE_FRAME_SLUG
      : sanitizeProfileFrameSlug(stored);
  } catch {
    return DEFAULT_PROFILE_FRAME_SLUG;
  }
}

export function rememberProfileFrame(slug, storage = safeStorage()) {
  const sanitized = sanitizeProfileFrameSlug(slug);
  try {
    storage?.setItem(PROFILE_FRAME_STORAGE_KEY, sanitized);
  } catch {
    // The active selection still works when storage is unavailable.
  }
  return sanitized;
}

export function equipProfileFrame(slug, {
  storage = safeStorage(),
  eventTarget = globalThis.document,
  CustomEventCtor = eventTarget?.defaultView?.CustomEvent || globalThis.CustomEvent
} = {}) {
  const selectedSlug = rememberProfileFrame(slug, storage);
  if (eventTarget?.dispatchEvent && typeof CustomEventCtor === "function") {
    eventTarget.dispatchEvent(new CustomEventCtor(PROFILE_FRAME_CHANGE_EVENT, {
      detail: { slug: selectedSlug }
    }));
  }
  return selectedSlug;
}

function createFrameImage(documentRef, entry, stage) {
  const source = documentRef.createElement("img");
  const sourceUrl = resolveProfileFrameArtUrl(entry);
  source.alt = "";
  source.loading = "eager";
  source.decoding = "async";
  source.draggable = false;
  source.addEventListener("load", () => {
    stage.dataset.assetState = "ready";
  }, { once: true });
  source.addEventListener("error", () => {
    stage.dataset.assetState = "missing";
  }, { once: true });
  source.src = sourceUrl;
  return source;
}

function createFrameIsland(documentRef, entry, island, stage) {
  const wrapper = documentRef.createElement("span");
  const source = createFrameImage(documentRef, entry, stage);

  wrapper.className = "profile-rank-frame-island";
  wrapper.dataset.island = island.id;
  wrapper.dataset.plane = island.plane;
  for (const [edge, value] of Object.entries(island.crop)) {
    wrapper.style.setProperty(`--island-crop-${edge}`, percentage(value));
  }
  wrapper.style.setProperty("--island-x", percentage(island.placement.x));
  wrapper.style.setProperty("--island-y", percentage(island.placement.y));
  source.className = "profile-rank-frame-island__source";
  if (island.shape) source.style.setProperty("--island-clip", polygon(island.shape));
  wrapper.append(source);
  return wrapper;
}

export function renderProfileFrameArt(documentRef, stage, artRoot, entry) {
  artRoot.replaceChildren();
  artRoot.dataset.artLayout = entry.layout;
  stage.dataset.assetState = "loading";

  if (entry.layout !== "partial") {
    const source = createFrameImage(documentRef, entry, stage);
    source.className = "profile-rank-frame-art__full";
    artRoot.append(source);
    return;
  }

  const outsidePlane = documentRef.createElement("span");
  const cardPlane = documentRef.createElement("span");
  outsidePlane.className = "profile-rank-frame-islands profile-rank-frame-islands--outside";
  cardPlane.className = "profile-rank-frame-islands profile-rank-frame-islands--card-clipped";

  for (const island of entry.islands) {
    const plane = island.plane === "card" ? cardPlane : outsidePlane;
    plane.append(createFrameIsland(documentRef, entry, island, stage));
  }
  artRoot.append(outsidePlane, cardPlane);
}

function text(value, fallback, maximum = 80) {
  return String(value || fallback).trim().slice(0, maximum) || fallback;
}

export function createProfileFramePreview({
  documentRef = globalThis.document,
  ariaLabel = "Route Rank profile frame preview"
} = {}) {
  if (!documentRef?.createElement) return null;

  const stage = documentRef.createElement("div");
  stage.className = "profile-rank-frame-stage";
  stage.dataset.layout = "none";
  stage.innerHTML = `
    <article class="profile-rank-frame-card" aria-label="${ariaLabel}">
      <div class="profile-rank-frame-card__banner" aria-hidden="true"></div>
      <div class="profile-rank-frame-card__crest" aria-hidden="true">
        <span data-profile-frame-mark>B</span><i></i>
      </div>
      <div class="profile-rank-frame-card__identity">
        <span data-profile-frame-rank>BRONZE &middot; RANK 01</span>
        <strong data-profile-frame-callsign>Offline Stargazer</strong>
        <small>Charting impossible connections across a living universe.</small>
      </div>
      <div class="profile-rank-frame-card__facts">
        <span><b data-profile-frame-discoveries>4</b> discoveries</span>
        <span><b data-profile-frame-wins>0</b> completed routes</span>
      </div>
    </article>
    <div class="profile-rank-frame-art" data-profile-frame-art aria-hidden="true"></div>
  `;

  const artRoot = stage.querySelector("[data-profile-frame-art]");
  let selectedSlug = "";

  const select = (candidate) => {
    const slug = sanitizeProfileFrameSlug(candidate);
    const entry = profileFrameBySlug(slug);
    selectedSlug = entry?.slug || "";
    stage.dataset.frame = selectedSlug || "none";
    stage.dataset.layout = entry?.layout || "none";
    stage.dataset.effect = entry?.effect || "static";
    artRoot.replaceChildren();

    if (!entry) {
      stage.dataset.assetState = "empty";
      stage.style.removeProperty("--profile-frame-accent");
      return selectedSlug;
    }

    for (const [edge, value] of Object.entries(entry.fit)) {
      stage.style.setProperty(`--card-${edge}`, value);
    }
    stage.style.setProperty("--card-content-inset", entry.contentInset);
    stage.style.setProperty("--card-avatar-top", entry.avatarTop);
    stage.style.setProperty("--profile-frame-accent", entry.palette[0]);
    renderProfileFrameArt(documentRef, stage, artRoot, entry);
    return selectedSlug;
  };

  const sync = ({
    callsign,
    mark,
    rankName,
    rankNumber,
    discoveries,
    wins
  } = {}) => {
    stage.querySelector("[data-profile-frame-callsign]").textContent =
      text(callsign, "Offline Stargazer", 42);
    stage.querySelector("[data-profile-frame-mark]").textContent =
      text(mark, "B", 2).toUpperCase();
    const safeRank = text(rankName, "Bronze", 24);
    const safeNumber = Math.max(1, Math.min(99, Math.floor(Number(rankNumber) || 1)));
    stage.querySelector("[data-profile-frame-rank]").textContent =
      `${safeRank.toUpperCase()} · RANK ${String(safeNumber).padStart(2, "0")}`;
    stage.querySelector("[data-profile-frame-discoveries]").textContent =
      Math.max(0, Math.floor(Number(discoveries) || 0)).toLocaleString("en-US");
    stage.querySelector("[data-profile-frame-wins]").textContent =
      Math.max(0, Math.floor(Number(wins) || 0)).toLocaleString("en-US");
  };

  return Object.freeze({
    element: stage,
    sync,
    select,
    get selectedSlug() {
      return selectedSlug;
    }
  });
}
