const OUTPOST_SLOT_ORDER = Object.freeze(["power", "shelter", "signal"]);
const OUTPOST_SLOT_COPY = Object.freeze({
  power: Object.freeze({ title: "Power array", empty: "Awaiting a power law" }),
  shelter: Object.freeze({ title: "Habitat", empty: "Awaiting a shelter law" }),
  signal: Object.freeze({ title: "Signal tower", empty: "Awaiting a signal law" })
});
const ROCKET_LAYER_ORDER = Object.freeze(["shadow", "hull", "window", "engine", "markings", "glow"]);
const DEFAULT_ROCKET_HULL = "./art/moon-outpost/rocket-core-v1.png";
const CACHE_TIER_ORDER = Object.freeze(["common", "rare", "epic", "mythic"]);

export function moonOutpostCacheFailureMessage(reason) {
  return {
    active_run_blocked: "Caches stay sealed during an active orbit.",
    capability_locked: "That cache belongs to a deeper frontier.",
    duplicate_receipt: "That cache has already been settled.",
    insufficient_stardust: "You need more earned Stardust for that cache.",
    invalid_entropy: "The cache seal could not be verified.",
    invalid_receipt: "The cache receipt could not be created.",
    missing_eligible_cosmetics: "No eligible cosmetic manifest is available.",
    unknown_tier: "That cache tier is not available."
  }[reason] || "The cache stayed sealed. Nothing was spent.";
}

export function moonOutpostStructureFailureMessage(action, result) {
  if (result?.reason === "insufficient_meaning") return `Needs ${result.cost} Meaning; this structure has ${result.available}.`;
  return {
    already_calibrated: "This structure is already producing Stardust.",
    collect_before_upgrade: "Collect its current production before upgrading.",
    maximum_stage: "This structure has reached its current Moon limit.",
    project_required: "Moonhaven now grows through The Heart project.",
    not_ready: "Production has only just begun. Return after more Stardust accumulates.",
    structure_locked: "This structure needs a Worldweaving law first.",
    unknown_structure: "That structure could not be found."
  }[result?.reason] || `${action} is not available yet.`;
}

export function moonOutpostSelectionMessage(redemption = {}) {
  if (!redemption.redeemed) return redemption.reason === "insufficient_selection_shards"
    ? "Collect 4 selection shards first."
    : "That cosmetic cannot be selected. No shards changed.";
  return `${redemption.grant?.label || "Cosmetic"} unlocked for the Cosmetic Lab.`;
}

export function moonOutpostStructureSuccessMessage(action, result = {}) {
  if (action === "collect") return `Collected ${result.amount || 0} Stardust.`;
  return action === "upgrade"
    ? `${result.stage?.label || "Structure"} installed. ${result.cost || 0} Meaning used.`
    : `Production calibrated at ${result.stardustPerHour || 0} Stardust per hour for up to ${result.capHours || 0} hours.`;
}

export function moonOutpostLaunchMessage(firstLaunch, reward = 100) {
  return firstLaunch
    ? `Mars Approach mapped · ${reward} Stardust recovered for your first Common cache.`
    : "Mars Approach mapped. Your Moon remains productive behind you.";
}

export function createMoonOutpostCacheReceipt(opening = {}) {
  const grant = plainObject(opening.grant) || {};
  const values = [];
  if (grant.cosmeticId) values.push("Unlocked in the Cosmetic Lab");
  if (grant.inventory?.sense) values.push(`+${grant.inventory.sense} Star Compass`);
  if (grant.inventory?.streakShields) values.push(`+${grant.inventory.streakShields} Streak Shield`);
  if (grant.stardust) values.push(`+${grant.stardust} Stardust`);
  if (grant.selectionShards) values.push(`+${grant.selectionShards} selection shard`);
  return {
    title: grant.cosmeticId ? "New cosmetic recovered" : "Cache manifest recovered",
    description: opening.outcome?.forcedByPity ? "The visible pity guarantee activated. No ranked or score advantage was granted." : "The reward was settled from earned Stardust. No empty outcome is possible.",
    items: [{
      icon: { cosmetic: "✦", conversion: "↻", powerup: "◇", supply: "✧" }[grant.category] || "✦",
      label: grant.label || "Lunar salvage",
      value: values.join(" · ")
    }]
  };
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function boundedText(value, fallback = "", maximum = 96) {
  const text = String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
  return text || fallback;
}

function identifier(value, fallback = "") {
  const clean = boundedText(value, fallback, 48)
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || fallback;
}

/**
 * Outpost art stays same-origin and release-packable. The runtime deliberately
 * rejects absolute/data URLs so a profile or cloud payload cannot inject an
 * arbitrary fetch. These values are presentation configuration, not saves.
 */
export function normalizeMoonOutpostAsset(value) {
  const source = boundedText(value, "", 240).replace(/\\/g, "/");
  if (!source || source.startsWith("/") || source.includes("..")) return "";
  if (!/^(?:\.\/)?[a-z0-9_@/.-]+\.(?:avif|png|svg|webp)(?:\?[a-z0-9_.=&-]+)?$/i.test(source)) return "";
  return source.startsWith("./") ? source : `./${source}`;
}

function recipeFrom(raw) {
  const source = plainObject(raw) || {};
  const a = boundedText(source.a ?? source.left, "", 64);
  const b = boundedText(source.b ?? source.right, "", 64);
  const word = boundedText(source.word ?? source.output, "", 80);
  return a && b && word ? { a, b, word } : null;
}

function boundedNumber(value, maximum = 1_000_000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(maximum, Math.round(number * 100) / 100));
}

function normalizedStructureAction(raw, fallbackEnabled, fallbackLabel) {
  const source = typeof raw === "boolean" ? { enabled: raw } : plainObject(raw) || {};
  return Object.freeze({
    enabled: source.enabled == null ? Boolean(fallbackEnabled) : Boolean(source.enabled),
    label: boundedText(source.label, fallbackLabel, 32),
    reason: boundedText(source.reason, "", 120)
  });
}

function normalizedSimulator(raw, slot, installed) {
  const source = plainObject(raw) || {};
  const meaningSource = plainObject(source.meaningCharge ?? source.meaning) || {};
  const passiveSource = plainObject(source.passiveStardust ?? source.passive ?? source.stardust) || {};
  const actionsSource = plainObject(source.actions) || {};
  const projectSource = plainObject(source.project);
  const meaning = {
    current: boundedNumber(meaningSource.current ?? source.meaningCharge),
    capacity: boundedNumber(meaningSource.capacity ?? meaningSource.cap ?? meaningSource.required),
    label: boundedText(meaningSource.label, "Meaning charge", 40)
  };
  const stardust = {
    pending: boundedNumber(passiveSource.pending),
    ratePerHour: boundedNumber(passiveSource.ratePerHour ?? passiveSource.rate),
    cap: boundedNumber(passiveSource.cap ?? passiveSource.capacity),
    calibrated: Boolean(passiveSource.calibrated ?? source.calibrated)
  };
  const canUpgrade = installed && meaning.capacity > 0 && meaning.current >= meaning.capacity;
  return Object.freeze({
    stage: Math.floor(boundedNumber(source.stage, 999)),
    name: boundedText(source.name, slot.outpostTitle || slot.title, 64),
    meaning: Object.freeze(meaning),
    stardust: Object.freeze(stardust),
    project: projectSource ? Object.freeze({
      id: identifier(projectSource.id, "heart"),
      enabled: projectSource.enabled == null ? installed : Boolean(projectSource.enabled),
      state: identifier(projectSource.state, "available"),
      label: boundedText(projectSource.label, "Enter The Heart", 48),
      progressLabel: boundedText(projectSource.progressLabel, "0 / 16 experiments", 56)
    }) : null,
    actions: Object.freeze({
      upgrade: normalizedStructureAction(actionsSource.upgrade, canUpgrade, "Upgrade"),
      calibrate: normalizedStructureAction(actionsSource.calibrate, installed && !stardust.calibrated, stardust.calibrated ? "Recalibrate" : "Calibrate"),
      collect: normalizedStructureAction(actionsSource.collect, installed && stardust.pending > 0, "Collect")
    })
  });
}

function normalizedSlot(raw, id, simulatorRaw) {
  const source = plainObject(raw) || {};
  const copy = OUTPOST_SLOT_COPY[id];
  const status = boundedText(source.status, "locked", 20).toLocaleLowerCase("en-US");
  const installed = Boolean(source.memory) || ["anchored", "complete", "completed", "installed"].includes(status);
  const memory = recipeFrom(source.memory ?? source.recipe);
  const slot = {
    id,
    title: boundedText(source.outpostTitle, copy.title, 56),
    sourceTitle: boundedText(source.title, copy.title, 56),
    choiceId: identifier(source.choiceId),
    state: installed ? "installed" : status === "current" ? "available" : "locked",
    summary: installed
      ? boundedText(source.summary, `${memory?.word || source.title || copy.title} is installed.`, 150)
      : copy.empty,
    memory
  };
  slot.simulator = normalizedSimulator(simulatorRaw, slot, installed);
  return slot;
}

function boundedCount(value, maximum = 1_000_000) {
  const number = Math.floor(Number(value) || 0);
  return Math.max(0, Math.min(maximum, number));
}

function controllerOutpost(raw) {
  const extras = plainObject(raw) || {};
  const domain = plainObject(extras.controllerDomain);
  if (!domain) return extras;
  const simulator = plainObject(domain.simulator) || {};
  const project = plainObject(domain.project) || {};
  const moon = plainObject(domain.moon) || {};
  const salvage = plainObject(domain.salvage) || {};
  const capabilities = new Set(Array.isArray(domain.capabilities) ? domain.capabilities : []);
  const owned = new Set(Array.isArray(domain.owned) ? domain.owned : []);
  const structures = (Array.isArray(simulator.structures) ? simulator.structures : []).map((structure) => {
    const stage = plainObject(structure?.stagePresentation) || {};
    const calibrated = Boolean(structure?.calibratedAt);
    const upgradeCost = boundedCount(stage.upgradeMeaningCost);
    const calibrationCost = boundedCount(stage.calibrationCost);
    const meaning = boundedCount(structure?.meaningCharge);
    const pending = boundedCount(structure?.pending?.amount);
    const atMaximum = structure?.stage >= structure?.stageCount;
    const locked = Boolean(structure?.locked);
    const shelter = structure?.id === "shelter";
    return {
      id: structure?.id,
      title: structure?.title,
      description: structure?.description,
      stage: structure?.stage,
      name: `${structure?.title || "Structure"} · ${stage.label || `Stage ${structure?.stage || 0}`}`,
      meaningCharge: { current: meaning, capacity: atMaximum ? 0 : upgradeCost, label: "Meaning charge" },
      passiveStardust: { pending, ratePerHour: stage.stardustPerHour || 0, cap: (stage.stardustPerHour || 0) * 8, calibrated },
      project: shelter ? {
        id: "heart",
        enabled: !locked,
        state: project.complete ? "complete" : project.phase || "available",
        label: project.complete ? "Visit The Heart" : "Enter The Heart",
        progressLabel: `${boundedCount(project.findingProgress?.current)} / ${boundedCount(project.findingProgress?.total) || 16} experiments`
      } : null,
      actions: {
        upgrade: {
          enabled: !shelter && !locked && !atMaximum && !calibrated && meaning >= upgradeCost,
          label: shelter ? "Advanced through The Heart" : atMaximum ? "Max stage" : `Upgrade · ${upgradeCost}`,
          reason: shelter ? "Moonhaven grows through its Great Project." : atMaximum ? "Maximum Moon stage reached" : calibrated ? "Collect production before upgrading" : meaning < upgradeCost ? `${upgradeCost - meaning} more Meaning needed` : ""
        },
        calibrate: {
          enabled: !locked && !calibrated && meaning >= calibrationCost,
          label: calibrated ? "Producing" : `Calibrate · ${calibrationCost}`,
          reason: calibrated ? "Production is already calibrated" : meaning < calibrationCost ? `${calibrationCost - meaning} more Meaning needed` : ""
        },
        collect: {
          enabled: !locked && calibrated && pending > 0,
          label: "Collect",
          reason: calibrated ? pending ? "" : "Stardust is still accumulating" : "Calibrate production first"
        }
      }
    };
  });
  const choices = Object.fromEntries((Array.isArray(moon.slots) ? moon.slots : []).map((slot) => [slot.id, slot.memory?.choiceId || slot.choiceId || ""]));
  const power = choices.power === "solar" ? "Helios" : "Selene";
  const shelter = { bastion: "Bastion", hive: "Hive", haven: "Haven" }[choices.shelter] || "Lunar";
  const launches = boundedCount(domain.launches);
  const catalog = plainObject(domain.catalog);
  return {
    structures,
    rocket: { name: `${power} ${shelter}`, status: moon.completed ? "ready" : "assembling", layers: { hull: DEFAULT_ROCKET_HULL } },
    destination: {
      id: "mars-approach",
      title: "Mars Approach",
      eyebrow: launches ? "EXPEDITION ROUTE" : "FIRST EXPEDITION",
      description: launches ? `${launches} lunar launch${launches === 1 ? " has" : "es have"} mapped the first route toward Mars.` : "Prove that your word-built Moon can send a living craft toward the next frontier."
    },
    cache: {
      catalog: (Array.isArray(catalog?.tiers) ? catalog.tiers : []).map((tier) => ({
        id: tier.id,
        label: String(tier.label || "").replace(/\s+Salvage Cache$/i, ""),
        description: tier.description,
        cost: tier.cost,
        capabilityUnlocked: !tier.requiredCapability || capabilities.has(tier.requiredCapability),
        odds: (Array.isArray(tier.odds) ? tier.odds : []).map((outcome) => ({ label: outcome.label, value: `${outcome.chancePercent}%` })),
        pity: { current: salvage.pityMissesByTier?.[tier.id], threshold: tier.pityEvery }
      })),
      selectionOptions: (Array.isArray(domain.cosmetics) ? domain.cosmetics : []).map((item) => ({ ...item, owned: owned.has(item.id) })),
      state: {
        wallet: boundedCount(domain.wallet),
        currencyLabel: "Stardust",
        selectionShards: { current: salvage.selectionShards, target: 4, label: "selection shards" }
      }
    }
  };
}

function normalizedOdds(raw) {
  return (Array.isArray(raw) ? raw : []).slice(0, 8).map((entry) => ({
    label: boundedText(entry?.label ?? entry?.tier, "Reward", 48),
    value: boundedText(entry?.value ?? entry?.chance, "", 24)
  })).filter((entry) => entry.value);
}

function normalizedCacheTier(raw, id, complete, wallet, state) {
  const source = plainObject(raw) || {};
  const freeOpens = boundedCount(source.freeOpens ?? state.freeOpens?.[id], 99);
  const costSupplied = source.cost != null && Number.isFinite(Number(source.cost));
  const cost = costSupplied ? boundedCount(source.cost) : null;
  const advanced = id === "epic" || id === "mythic";
  const capabilityLocked = !complete || source.capabilityUnlocked === false || (advanced && source.capabilityUnlocked !== true);
  const pitySource = plainObject(source.pity) || plainObject(state.pity?.[id]) || {};
  const pity = {
    current: boundedCount(pitySource.current, 10_000),
    threshold: boundedCount(pitySource.threshold, 10_000)
  };
  const canAfford = freeOpens > 0 || (cost != null && wallet >= cost);
  return {
    id,
    label: boundedText(source.label, id[0].toUpperCase() + id.slice(1), 40),
    description: boundedText(source.description, capabilityLocked ? "A deeper-world capability is required." : "Reward table supplied by the live cache catalog.", 150),
    capabilityLocked,
    cost,
    freeOpens,
    canOpen: Boolean(!capabilityLocked && canAfford),
    odds: normalizedOdds(source.odds),
    pity
  };
}

function normalizedCache(raw, complete) {
  const source = plainObject(raw) || {};
  const state = plainObject(source.state) || {};
  const wallet = boundedCount(state.wallet ?? source.wallet);
  const suppliedCatalog = Array.isArray(source.catalog) ? source.catalog.slice(0, 12) : [];
  const tiers = CACHE_TIER_ORDER.map((id) => normalizedCacheTier(
    suppliedCatalog.find((tier) => identifier(tier?.id) === id),
    id,
    complete,
    wallet,
    state
  ));
  const shardSource = plainObject(state.selectionShards ?? source.selectionShards) || {};
  const selectionOptions = (Array.isArray(source.selectionOptions) ? source.selectionOptions : [])
    .slice(0, 100)
    .map((option) => ({
      id: boundedText(option?.id ?? option?.cosmeticId, "", 96).toLocaleLowerCase("en-US").replace(/[^a-z0-9._-]/g, ""),
      label: boundedText(option?.label ?? option?.name, "Cosmetic", 64),
      slot: identifier(option?.slot, "cosmetic"),
      owned: Boolean(option?.owned)
    }))
    .filter((option) => option.id);
  return {
    currencyLabel: boundedText(state.currencyLabel ?? source.currencyLabel, "Stardust", 32),
    wallet,
    tiers: Object.freeze(tiers.map(Object.freeze)),
    selectionShards: Object.freeze({
      current: boundedCount(shardSource.current, 10_000),
      target: boundedCount(shardSource.target, 10_000),
      label: boundedText(shardSource.label, "Selection shards", 48)
    }),
    selectionOptions: Object.freeze(selectionOptions.map(Object.freeze))
  };
}

function normalizedDestination(raw) {
  const source = plainObject(raw) || {};
  return {
    id: identifier(source.id, "mars"),
    title: boundedText(source.title, "Mars", 64),
    eyebrow: boundedText(source.eyebrow, "NEXT HORIZON", 48),
    description: boundedText(source.description, "Carry the Moon's Worldword into a wider frontier.", 180),
    contentReady: source.contentReady === true
  };
}

function normalizedRocket(raw, complete) {
  const source = plainObject(raw) || {};
  const requestedStatus = identifier(source.status, complete ? "ready" : "assembling");
  const status = ["assembling", "ready", "launched"].includes(requestedStatus)
    ? requestedStatus
    : complete ? "ready" : "assembling";
  const suppliedLayers = plainObject(source.layers) || {};
  const layers = Object.fromEntries(ROCKET_LAYER_ORDER.map((layer) => [
    layer,
    normalizeMoonOutpostAsset(suppliedLayers[layer] || (layer === "hull" ? DEFAULT_ROCKET_HULL : ""))
  ]));
  return {
    name: boundedText(source.name, "Lander One", 64),
    status: complete && status === "assembling" ? "ready" : status,
    layers
  };
}

/**
 * Stable adapter between moonWorldweavingView() and the presentation runtime.
 * Optional outpost data can be supplied by a future progression/economy model
 * without making this surface a persistence authority.
 */
export function createMoonOutpostModel(worldweavingView, outpost = {}) {
  const world = plainObject(worldweavingView) || {};
  const extras = controllerOutpost(outpost);
  const suppliedSlots = Array.isArray(world.slots) ? world.slots.slice(0, 12) : [];
  const suppliedStructures = Array.isArray(extras.structures)
    ? extras.structures.slice(0, 12)
    : plainObject(extras.structures) || {};
  const structureFor = (id) => Array.isArray(suppliedStructures)
    ? suppliedStructures.find((structure) => identifier(structure?.id ?? structure?.structureId) === id)
    : suppliedStructures[id];
  const slots = OUTPOST_SLOT_ORDER.map((id) => {
    const source = suppliedSlots.find((slot) => identifier(slot?.id) === id);
    const structure = structureFor(id);
    return normalizedSlot({
      ...source,
      outpostTitle: structure?.title || source?.outpostTitle,
      summary: structure?.description ? `${structure.description} Routes add Meaning; repeats decay and alternate recipes amplify.` : source?.summary
    }, id, structure);
  });
  const installedCount = slots.filter((slot) => slot.state === "installed").length;
  const complete = Boolean(world.completed) && installedCount === OUTPOST_SLOT_ORDER.length;
  const rocket = normalizedRocket(extras.rocket, complete);
  const destination = normalizedDestination(extras.destination);
  const worldwordSource = plainObject(world.worldword) || {};
  const worldword = boundedText(worldwordSource.word ?? worldwordSource.title, complete ? "Lander" : "", 80);
  return Object.freeze({
    id: identifier(world.id, "moon"),
    title: boundedText(world.title, "The Moon", 64),
    complete,
    installedCount,
    totalStructures: OUTPOST_SLOT_ORDER.length,
    outcomeKey: boundedText(world.outcomeKey, "", 160),
    completion: boundedText(world.completion?.completedAt, "", 40),
    slots: Object.freeze(slots.map(Object.freeze)),
    variantKey: slots.map((slot) => slot.choiceId || "pending").join("-"),
    worldword,
    cache: Object.freeze(normalizedCache(extras.cache, complete)),
    destination: Object.freeze(destination),
    rocket: Object.freeze({ ...rocket, layers: Object.freeze(rocket.layers) }),
    launchReady: Boolean(complete && worldword && rocket.status === "ready" && destination.contentReady)
  });
}

export const MOON_OUTPOST_STRUCTURE_ORDER = OUTPOST_SLOT_ORDER;
export const MOON_OUTPOST_ROCKET_LAYERS = ROCKET_LAYER_ORDER;
export const MOON_OUTPOST_CACHE_TIERS = CACHE_TIER_ORDER;
