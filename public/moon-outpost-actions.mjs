import {
  calibrateMoonOutpostStructure,
  collectMoonOutpostStardust,
  moonOutpostView,
  upgradeMoonOutpostStructure
} from "./moon-outpost.mjs?v=5.0.0-beta.4";
import {
  recordMoonExpeditionLaunch,
  replaceMoonOutpostState,
  replaceSalvageState,
  settleMoonCollection
} from "./expedition.mjs?v=5.0.0-beta.4";
import { openSalvageCache, redeemSalvageSelection, salvageCacheCatalog } from "./salvage-cache.mjs?v=5.0.0-beta.4";
import { salvageCosmeticPool } from "./salvage-cosmetics.mjs?v=5.0.0-beta.4";
import { ownedCosmeticIds } from "./cosmetic-economy.mjs?v=5.0.0-beta.4";

const STARDUST_LIMIT = 1_000_000_000;
const FIRST_LAUNCH_CACHE_GRANT = 100;
const boundedWallet = (value) => Math.min(STARDUST_LIMIT, Math.max(0, Math.floor(Number(value) || 0)));

function randomToken(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  const bytes = new Uint32Array(4);
  globalThis.crypto?.getRandomValues?.(bytes);
  return `${prefix}-${Date.now().toString(36)}-${[...bytes].join("-") || Math.random().toString(36).slice(2)}`;
}

export function createMoonOutpostActions(host) {
  const launchAuthorizations = new Set();
  const runtime = () => host.runtime?.();
  const cacheCapabilities = () => {
    const supplied = host.expeditionCapabilities?.();
    return Array.isArray(supplied) ? supplied : [];
  };
  const ownedIdsForCache = () => ownedCosmeticIds(host.cosmeticOwnershipOptions?.() || {});

  function presentationState() {
    const current = host.profile();
    const expedition = host.currentExpedition();
    return { controllerDomain: {
      simulator: moonOutpostView(expedition.worlds.moon.outpost, { at: new Date() }),
      project: host.heartProjectState(expedition),
      moon: host.view(),
      launches: expedition.worlds.moon.launches,
      salvage: expedition.salvage,
      catalog: salvageCacheCatalog(),
      capabilities: cacheCapabilities(),
      cosmetics: salvageCosmeticPool(),
      owned: [...ownedIdsForCache()],
      wallet: boundedWallet(current.stardust)
    } };
  }

  async function openCache({ tierId } = {}) {
    const current = host.profile();
    const expedition = host.currentExpedition();
    const opening = openSalvageCache(expedition.salvage, {
      tierId,
      receiptId: randomToken("moon-cache"),
      entropy: randomToken("entropy"),
      eligibleCosmetics: salvageCosmeticPool(),
      capabilities: cacheCapabilities(),
      activeRun: Boolean(host.isRunActive?.()),
      resources: {
        stardust: current.stardust,
        inventory: { sense: current.senseWallet?.charges, streakShields: current.streakShields },
        ownedCosmeticIds: ownedIdsForCache()
      }
    });
    if (!opening.opened) {
      const message = runtime()?.cacheFailureMessage?.(opening.reason) || "The cache stayed sealed. Nothing was spent.";
      host.showToast(message, { scope: "global" });
      throw new Error(message);
    }
    current.stardust = opening.resources.stardust;
    current.senseWallet = { ...current.senseWallet, charges: opening.resources.inventory.sense };
    current.streakShields = opening.resources.inventory.streakShields;
    host.persistExpedition(replaceSalvageState(expedition, opening.state, {
      cosmeticIds: opening.resources.ownedCosmeticIds,
      worldweaving: current.worldweaving,
      at: new Date()
    }), { progression: true });
    host.track("moon_salvage_cache_settled", {
      tier: opening.tier.id,
      reward: opening.grant.category,
      forced: opening.outcome.forcedByPity
    });
    return runtime()?.cacheReceipt?.(opening) || { title: "Cache recovered", description: "The reward was settled.", items: [] };
  }

  async function redeemSelection({ cosmeticId } = {}) {
    const current = host.profile();
    const expedition = host.currentExpedition();
    const redemption = redeemSalvageSelection(expedition.salvage, {
      cosmeticId,
      receiptId: randomToken("moon-selection"),
      eligibleCosmetics: salvageCosmeticPool(),
      activeRun: Boolean(host.isRunActive?.()),
      resources: {
        stardust: current.stardust,
        inventory: { sense: current.senseWallet?.charges, streakShields: current.streakShields },
        ownedCosmeticIds: ownedIdsForCache()
      }
    });
    if (!redemption.redeemed) return { ok: false, message: runtime()?.selectionMessage?.(redemption) || "That cosmetic cannot be selected." };
    host.persistExpedition(replaceSalvageState(expedition, redemption.state, {
      cosmeticIds: redemption.resources.ownedCosmeticIds,
      worldweaving: current.worldweaving,
      at: new Date()
    }));
    host.track("moon_salvage_selection_settled", { kind: redemption.grant.cosmeticId });
    return { ok: true, message: runtime()?.selectionMessage?.(redemption) || "Cosmetic unlocked." };
  }

  async function structureAction({ action, structureId } = {}) {
    const current = host.profile();
    const expedition = host.currentExpedition();
    const outpost = action === "collect" ? expedition.worlds.moon.outpost : host.synchronizeHeartShelterStage(expedition.worlds.moon.outpost);
    let result;
    if (action === "upgrade") result = upgradeMoonOutpostStructure(outpost, structureId);
    else if (action === "calibrate") result = calibrateMoonOutpostStructure(outpost, structureId, { at: new Date() });
    else if (action === "collect") result = collectMoonOutpostStardust(outpost, { structureId, at: new Date() });
    else return { ok: false, message: "That structure command is not available." };

    if (action === "collect") {
      if (!result.collected) return { ok: false, message: runtime()?.structureFailureMessage?.(action, result) || "Collection is not available yet." };
      const collectedOutpost = host.synchronizeHeartShelterStage(result.state, { force: true });
      const settlement = settleMoonCollection(expedition, {
        outpost: collectedOutpost,
        collectionIds: result.entries.map((entry) => entry.collectionId)
      }, { worldweaving: current.worldweaving, at: new Date() });
      const credited = new Set(settlement.credited);
      const granted = result.entries.filter((entry) => credited.has(entry.collectionId)).reduce((sum, entry) => sum + entry.amount, 0);
      if (!granted) return { ok: false, message: "That production cycle was already collected." };
      current.stardust = boundedWallet(current.stardust + granted);
      host.persistExpedition(settlement.state, { progression: true });
      host.track("moon_outpost_stardust_collected", { kind: structureId, reward: granted });
      return { ok: true, action, amount: granted, message: runtime()?.structureSuccessMessage?.(action, { amount: granted }) || "Stardust collected." };
    }

    const succeeded = action === "upgrade" ? result.upgraded : result.calibrated;
    if (!succeeded) return { ok: false, message: runtime()?.structureFailureMessage?.(action, result) || `${action} is not available yet.` };
    host.persistExpedition(replaceMoonOutpostState(expedition, result.state, {
      worldweaving: current.worldweaving,
      at: new Date()
    }));
    host.track(`moon_outpost_${action}`, { kind: structureId, phase: result.after || 1 });
    return { ok: true, action, message: runtime()?.structureSuccessMessage?.(action, result) || `${action} complete.` };
  }

  async function beginLaunch() {
    if (host.isRunActive?.()) return false;
    const authorization = randomToken("moon-launch");
    launchAuthorizations.add(authorization);
    return { authorization, firstLaunch: host.currentExpedition().worlds.moon.launches === 0 };
  }

  async function completeLaunch({ authorization } = {}) {
    const token = authorization?.authorization;
    if (!token || !launchAuthorizations.delete(token)) return false;
    const current = host.profile();
    const expedition = host.currentExpedition();
    const firstLaunch = expedition.worlds.moon.launches === 0;
    const next = recordMoonExpeditionLaunch(expedition, { worldweaving: current.worldweaving, at: new Date() });
    if (firstLaunch) current.stardust = boundedWallet(current.stardust + FIRST_LAUNCH_CACHE_GRANT);
    host.persistExpedition(next, { progression: firstLaunch });
    host.track("moon_outpost_launch_recorded", { phase: firstLaunch ? "first" : "repeat", reward: firstLaunch ? FIRST_LAUNCH_CACHE_GRANT : 0 });
    host.showToast(runtime()?.launchMessage?.(firstLaunch, FIRST_LAUNCH_CACHE_GRANT) || "Mars Approach mapped.", { scope: "global" });
    host.requestFrame(() => runtime()?.showOverview({ focusAction: "launch" }));
    return true;
  }

  return Object.freeze({ presentationState, openCache, redeemSelection, structureAction, beginLaunch, completeLaunch });
}
