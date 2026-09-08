import {
  profileFrameBySlug
} from "./profile-frame-catalog.mjs?v=5.0.0-beta.4";
import {
  resolveProfileFrameArtUrl
} from "./profile-rank-frame.mjs?v=5.0.0-beta.4";

export const ARENA_DUEL_CARD_ART_WIDTH = 1086;
export const ARENA_DUEL_CARD_ART_HEIGHT = 1448;

export const ARENA_DUEL_CARD_SELECTORS = Object.freeze({
  root: "[data-arena-duel-card]",
  artboard: "[data-arena-duel-card-artboard]",
  art: "[data-arena-duel-card-art]",
  partialArt: "[data-arena-duel-card-partial-art]",
  mark: "[data-arena-duel-card-mark]",
  callsign: "[data-arena-duel-card-callsign]",
  rank: "[data-arena-duel-card-rank]",
  status: "[data-arena-duel-card-status]"
});

const STATUS_PRESENTATION = Object.freeze({
  idle: "Standing by",
  waiting: "Waiting",
  ready: "Ready",
  countdown: "Match incoming",
  playing: "In match",
  winner: "Winner",
  defeated: "Match complete",
  disconnected: "Reconnecting"
});

const SIDE_ALIASES = Object.freeze({
  self: "self",
  you: "self",
  own: "self",
  home: "self",
  left: "self",
  rival: "rival",
  opponent: "rival",
  away: "rival",
  right: "rival"
});

const STATUS_ALIASES = Object.freeze({
  idle: "idle",
  waiting: "waiting",
  connecting: "waiting",
  queued: "waiting",
  queue: "waiting",
  ready: "ready",
  countdown: "countdown",
  starting: "countdown",
  playing: "playing",
  active: "playing",
  winner: "winner",
  won: "winner",
  victory: "winner",
  defeated: "defeated",
  lost: "defeated",
  finished: "defeated",
  disconnected: "disconnected",
  reconnecting: "disconnected"
});

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(record(value), key);
}

function safeText(value, fallback, maximum) {
  try {
    const normalized = String(value ?? "").replace(/\s+/gu, " ").trim();
    return (normalized || fallback).slice(0, maximum);
  } catch {
    return fallback;
  }
}

function optionValue(options, player, key, fallback) {
  if (hasOwn(options, key)) return options[key];
  if (hasOwn(player, key)) return player[key];
  return fallback;
}

export function normalizeArenaDuelCardSide(value) {
  const key = safeText(value, "self", 24).toLowerCase();
  return SIDE_ALIASES[key] || "self";
}

export function normalizeArenaDuelCardStatus(value) {
  const key = safeText(value, "idle", 32).toLowerCase();
  return STATUS_ALIASES[key] || "idle";
}

export function resolveArenaDuelCardFrame(value) {
  const slug = safeText(value, "", 80);
  return slug ? profileFrameBySlug(slug) || null : null;
}

export function normalizeArenaDuelCardModel(options = {}, previous = {}) {
  const safeOptions = record(options);
  const player = record(safeOptions.player);
  const prior = record(previous);
  const side = normalizeArenaDuelCardSide(optionValue(
    safeOptions,
    player,
    "side",
    prior.side || "self"
  ));
  const status = normalizeArenaDuelCardStatus(optionValue(
    safeOptions,
    player,
    "status",
    prior.status || "idle"
  ));
  const frameCandidate = optionValue(
    safeOptions,
    player,
    "frameSlug",
    prior.frameSlug || ""
  );
  const frame = resolveArenaDuelCardFrame(frameCandidate);
  const rankCandidate = optionValue(
    safeOptions,
    player,
    "rank",
    optionValue(safeOptions, player, "rankName", prior.rank || "Unranked")
  );

  return Object.freeze({
    callsign: safeText(
      optionValue(safeOptions, player, "callsign", prior.callsign || ""),
      "",
      42
    ),
    rank: safeText(rankCandidate, "Unranked", 32),
    mark: safeText(
      optionValue(safeOptions, player, "mark", prior.mark || ""),
      "",
      3
    ).toUpperCase(),
    frameSlug: frame?.slug || "",
    side,
    status,
    featured: Boolean(optionValue(
      safeOptions,
      player,
      "featured",
      prior.featured || false
    ))
  });
}

function element(documentRef, tagName, className, dataAttribute = "") {
  const node = documentRef.createElement(tagName);
  node.className = className;
  if (dataAttribute) node.setAttribute(dataAttribute, "");
  return node;
}

const percentage = (value) => `${(value * 100).toFixed(4)}%`;
const polygon = (shape) => `polygon(${shape.map((point) => (
  `${percentage(point.x)} ${percentage(point.y)}`
)).join(", ")})`;

function createPartialFrameIsland(documentRef, island, sourceUrl, onSettled) {
  const wrapper = element(
    documentRef,
    "span",
    "arena-duel-card__island",
    "data-arena-frame-island"
  );
  const source = element(documentRef, "img", "arena-duel-card__island-source");

  wrapper.dataset.island = island.id;
  wrapper.dataset.plane = island.plane;
  for (const [edge, value] of Object.entries(island.crop)) {
    wrapper.style.setProperty(`--island-crop-${edge}`, percentage(value));
  }
  wrapper.style.setProperty("--island-x", percentage(island.placement.x));
  wrapper.style.setProperty("--island-y", percentage(island.placement.y));
  if (island.shape) {
    source.style.setProperty("--island-clip", polygon(island.shape));
  }

  source.setAttribute("alt", "");
  source.setAttribute("aria-hidden", "true");
  source.setAttribute("width", String(ARENA_DUEL_CARD_ART_WIDTH));
  source.setAttribute("height", String(ARENA_DUEL_CARD_ART_HEIGHT));
  source.setAttribute("decoding", "async");
  source.setAttribute("loading", "eager");
  source.draggable = false;
  source.onload = () => onSettled(false);
  source.onerror = () => onSettled(true);
  source.setAttribute("src", sourceUrl);
  wrapper.append(source);
  return wrapper;
}

function renderPartialFrameArt(documentRef, artRoot, entry, sourceUrl, onSettled) {
  const outsidePlane = element(
    documentRef,
    "span",
    "arena-duel-card__islands arena-duel-card__islands--outside"
  );
  const cardPlane = element(
    documentRef,
    "span",
    "arena-duel-card__islands arena-duel-card__islands--card-clipped"
  );

  for (const island of entry.islands) {
    const plane = island.plane === "card" ? cardPlane : outsidePlane;
    plane.append(createPartialFrameIsland(documentRef, island, sourceUrl, onSettled));
  }
  artRoot.replaceChildren(outsidePlane, cardPlane);
}

function createCardParts(documentRef) {
  const root = element(documentRef, "article", "arena-duel-card", "data-arena-duel-card");
  const artboard = element(
    documentRef,
    "div",
    "arena-duel-card__artboard",
    "data-arena-duel-card-artboard"
  );
  const plate = element(documentRef, "span", "arena-duel-card__plate");
  const sigil = element(documentRef, "span", "arena-duel-card__sigil");
  const art = element(documentRef, "img", "arena-duel-card__art", "data-arena-duel-card-art");
  const partialArt = element(
    documentRef,
    "span",
    "arena-duel-card__partial-art",
    "data-arena-duel-card-partial-art"
  );
  const meta = element(documentRef, "footer", "arena-duel-card__meta");
  const mark = element(documentRef, "span", "arena-duel-card__mark", "data-arena-duel-card-mark");
  const identity = element(documentRef, "span", "arena-duel-card__identity");
  const role = element(documentRef, "small", "arena-duel-card__role");
  const callsign = element(
    documentRef,
    "strong",
    "arena-duel-card__callsign",
    "data-arena-duel-card-callsign"
  );
  const rank = element(
    documentRef,
    "small",
    "arena-duel-card__rank",
    "data-arena-duel-card-rank"
  );
  const status = element(
    documentRef,
    "em",
    "arena-duel-card__status",
    "data-arena-duel-card-status"
  );

  root.setAttribute("role", "group");
  artboard.setAttribute("aria-hidden", "true");
  plate.setAttribute("aria-hidden", "true");
  sigil.setAttribute("aria-hidden", "true");
  art.setAttribute("alt", "");
  art.setAttribute("aria-hidden", "true");
  art.setAttribute("width", String(ARENA_DUEL_CARD_ART_WIDTH));
  art.setAttribute("height", String(ARENA_DUEL_CARD_ART_HEIGHT));
  art.setAttribute("decoding", "async");
  art.setAttribute("loading", "eager");
  art.draggable = false;
  partialArt.setAttribute("aria-hidden", "true");
  partialArt.hidden = true;
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");

  plate.append(sigil);
  artboard.append(plate, art, partialArt);
  identity.append(role, callsign, rank);
  meta.append(mark, identity, status);
  root.append(artboard, meta);

  return Object.freeze({
    root,
    artboard,
    plate,
    sigil,
    art,
    partialArt,
    meta,
    mark,
    role,
    callsign,
    rank,
    status
  });
}

export function getArenaDuelCardParts(root) {
  if (!root?.querySelector) return null;
  return Object.freeze({
    root,
    artboard: root.querySelector(ARENA_DUEL_CARD_SELECTORS.artboard),
    art: root.querySelector(ARENA_DUEL_CARD_SELECTORS.art),
    partialArt: root.querySelector(ARENA_DUEL_CARD_SELECTORS.partialArt),
    mark: root.querySelector(ARENA_DUEL_CARD_SELECTORS.mark),
    callsign: root.querySelector(ARENA_DUEL_CARD_SELECTORS.callsign),
    rank: root.querySelector(ARENA_DUEL_CARD_SELECTORS.rank),
    status: root.querySelector(ARENA_DUEL_CARD_SELECTORS.status)
  });
}

export function createArenaDuelCard({
  documentRef = globalThis.document,
  player = {},
  frameSlug,
  side,
  status,
  featured
} = {}) {
  if (!documentRef?.createElement) return null;

  const parts = createCardParts(documentRef);
  let model = normalizeArenaDuelCardModel({
    player,
    ...(frameSlug !== undefined ? { frameSlug } : {}),
    ...(side !== undefined ? { side } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(featured !== undefined ? { featured } : {})
  });
  let assetRequest = 0;

  const renderFrame = (slug) => {
    const entry = resolveArenaDuelCardFrame(slug);
    const request = ++assetRequest;
    parts.root.dataset.frame = entry?.slug || "none";
    parts.root.dataset.frameLayout = entry?.layout || "none";
    parts.artboard.dataset.assetState = entry ? "loading" : "empty";
    parts.art.onload = null;
    parts.art.onerror = null;
    parts.partialArt.replaceChildren();
    parts.partialArt.hidden = true;

    if (!entry) {
      parts.art.hidden = true;
      parts.art.removeAttribute("src");
      parts.root.style.removeProperty("--arena-frame-accent");
      parts.root.style.removeProperty("--arena-frame-color-2");
      parts.root.style.removeProperty("--arena-frame-color-3");
      parts.root.style.removeProperty("--arena-frame-color-4");
      parts.artboard.style.removeProperty("--arena-frame-accent");
      parts.artboard.style.removeProperty("--arena-frame-color-2");
      parts.artboard.style.removeProperty("--arena-frame-color-3");
      parts.artboard.style.removeProperty("--arena-frame-color-4");
      for (const edge of ["top", "right", "bottom", "left"]) {
        parts.artboard.style.removeProperty(`--card-${edge}`);
      }
      return;
    }

    for (const [property, value] of [
      ["--arena-frame-accent", entry.palette[0]],
      ["--arena-frame-color-2", entry.palette[1]],
      ["--arena-frame-color-3", entry.palette[2]],
      ["--arena-frame-color-4", entry.palette[3]]
    ]) {
      parts.root.style.setProperty(property, value);
      parts.artboard.style.setProperty(property, value);
    }
    for (const [edge, value] of Object.entries(entry.fit)) {
      parts.artboard.style.setProperty(`--card-${edge}`, value);
    }

    const sourceUrl = resolveProfileFrameArtUrl(entry);
    const partial = entry.layout === "partial" && entry.islands.length > 0;
    if (partial) {
      parts.art.hidden = true;
      parts.art.removeAttribute("src");
      parts.partialArt.hidden = false;
      let pending = entry.islands.length;
      let failed = false;
      const onSettled = (didFail) => {
        if (request !== assetRequest) return;
        failed ||= didFail;
        pending -= 1;
        if (pending <= 0) {
          parts.artboard.dataset.assetState = failed ? "missing" : "ready";
        }
      };
      renderPartialFrameArt(documentRef, parts.partialArt, entry, sourceUrl, onSettled);
      return;
    }

    parts.art.hidden = false;
    parts.art.onload = () => {
      if (request === assetRequest) parts.artboard.dataset.assetState = "ready";
    };
    parts.art.onerror = () => {
      if (request === assetRequest) parts.artboard.dataset.assetState = "missing";
    };
    parts.art.setAttribute("src", sourceUrl);
  };

  const render = (nextModel, previousModel = {}) => {
    const callsign = nextModel.callsign || (
      nextModel.side === "rival" ? "Connecting" : "Stargazer"
    );
    const mark = nextModel.mark || (nextModel.side === "rival" ? "\u25C7" : "\u2726");
    const sideLabel = nextModel.side === "rival" ? "Rival" : "You";
    const statusLabel = STATUS_PRESENTATION[nextModel.status];

    parts.root.dataset.side = nextModel.side;
    parts.root.dataset.status = nextModel.status;
    parts.root.dataset.featured = String(nextModel.featured);
    parts.role.textContent = sideLabel;
    parts.callsign.textContent = callsign;
    parts.rank.textContent = nextModel.rank;
    parts.mark.textContent = mark;
    parts.sigil.textContent = mark;
    parts.status.textContent = statusLabel;
    parts.root.setAttribute(
      "aria-label",
      `${sideLabel}: ${callsign}. ${nextModel.rank}. ${statusLabel}.`
    );

    if (nextModel.frameSlug !== previousModel.frameSlug) {
      renderFrame(nextModel.frameSlug);
    }
  };

  const sync = (next = {}) => {
    const previousModel = model;
    model = normalizeArenaDuelCardModel(next, previousModel);
    render(model, previousModel);
    return model;
  };

  const selectFrame = (nextFrameSlug) => sync({ frameSlug: nextFrameSlug }).frameSlug;
  const setSide = (nextSide) => sync({ side: nextSide }).side;
  const setStatus = (nextStatus) => sync({ status: nextStatus }).status;

  render(model);

  return Object.freeze({
    element: parts.root,
    parts,
    sync,
    selectFrame,
    setSide,
    setStatus,
    get model() {
      return model;
    },
    get selectedFrameSlug() {
      return model.frameSlug;
    }
  });
}
