import {
  applyStardustPurchase,
  quoteStardustPurchase,
  sanitizeStardustStoreState
} from "./stardust-store.mjs?v=5.0.0-beta.1";

function purchaseFailureMessage(result) {
  const label = result?.item?.label || "That supply";
  if (result?.reason === "reserve_full") return `${label} reserve is already full.`;
  if (result?.reason === "reserve_limit") return `${label} would exceed its reserve limit.`;
  if (result?.reason === "insufficient_stardust") {
    const cost = Math.max(0, Math.floor(Number(result?.item?.cost) || 0));
    const balance = Math.max(0, Math.floor(Number(result?.balance?.before) || 0));
    return `You need ${Math.max(0, cost - balance)} more Stardust.`;
  }
  return "That Stardust supply could not be purchased.";
}

export function createStardustStoreRuntime({
  documentRef = globalThis.document,
  getProfile,
  isPowerupBusy = () => false,
  onProfileChange = () => {},
  playFeedback = () => {},
  showToast = () => {},
  track = () => {}
} = {}) {
  if (!documentRef || typeof getProfile !== "function") {
    throw new TypeError("Stardust store runtime requires a document and profile reader.");
  }
  const byId = (id) => documentRef.getElementById(id);
  let purchaseBusy = false;

  function profileState() {
    const profile = getProfile() || {};
    return {
      stardust: profile.stardust,
      powerups: { sense: profile.senseWallet?.charges },
      streakShields: profile.streakShields
    };
  }

  function setStatus(message, error = false) {
    const status = byId("stardustStoreStatus");
    if (!status) return;
    status.textContent = message;
    status.classList?.toggle("error", error);
  }

  function render() {
    const state = sanitizeStardustStoreState(profileState());
    const balance = byId("stardustStoreBalance");
    const compassStock = byId("stardustCompassStock");
    const shieldStock = byId("stardustShieldStock");
    const compassButton = byId("buyStarCompass");
    const shieldButton = byId("buyStreakShield");
    const legacyCompassButton = byId("buySense");
    if (balance) balance.textContent = String(state.stardust);
    if (compassStock) compassStock.textContent = `${state.inventory.sense} / 9`;
    if (shieldStock) shieldStock.textContent = `${state.inventory.streakShields} / 3`;
    const busy = Boolean(isPowerupBusy() || purchaseBusy);
    const compassQuote = quoteStardustPurchase(state, "star-compass", 1);
    const shieldQuote = quoteStardustPurchase(state, "streak-shield", 1);
    if (compassButton) compassButton.disabled = busy || !compassQuote.quoted;
    if (shieldButton) shieldButton.disabled = busy || !shieldQuote.quoted;
    if (legacyCompassButton) legacyCompassButton.disabled = busy || !compassQuote.quoted;
    return state;
  }

  async function purchase(itemId) {
    if (isPowerupBusy() || purchaseBusy) return { applied: false, reason: "busy" };
    const before = sanitizeStardustStoreState(profileState());
    purchaseBusy = true;
    render();
    track("stardust_purchase_started", { itemId, balanceBefore: before.stardust });
    if (itemId === "star-compass") {
      track("sense_purchase_started", { cost: 90, chargesBefore: before.inventory.sense });
    }
    try {
      const result = applyStardustPurchase(before, itemId, 1);
      if (!result.applied) {
        const message = purchaseFailureMessage(result);
        setStatus(message, true);
        if (itemId === "star-compass") {
          const senseMessage = byId("senseMessage");
          if (senseMessage) senseMessage.textContent = message;
        }
        showToast(message, { scope: "global" });
        track("stardust_purchase_rejected", { itemId, reason: result.reason });
        return result;
      }
      const profile = getProfile();
      const previous = {
        stardust: profile.stardust,
        senseWallet: profile.senseWallet,
        streakShields: profile.streakShields
      };
      profile.stardust = result.state.stardust;
      profile.senseWallet = { ...(profile.senseWallet || {}), charges: result.state.inventory.sense };
      profile.streakShields = result.state.inventory.streakShields;
      try {
        await onProfileChange(profile, result);
      } catch (error) {
        Object.assign(profile, previous);
        throw error;
      }
      const message = `${result.item.label} joined your reserve.`;
      setStatus(message);
      if (itemId === "star-compass") {
        const senseMessage = byId("senseMessage");
        if (senseMessage) senseMessage.textContent = `One ${message}`;
      }
      playFeedback("uiSelect");
      showToast(message, { scope: "global" });
      track("stardust_purchased", {
        itemId,
        cost: result.cost.total,
        balanceBefore: result.balance.before,
        balanceAfter: result.balance.after,
        reserveBefore: result.inventory.before,
        reserveAfter: result.inventory.after
      });
      if (itemId === "star-compass") {
        track("sense_purchased", {
          cost: result.cost.total,
          chargesBefore: result.inventory.before,
          chargesAfter: result.inventory.after
        });
      }
      return result;
    } finally {
      purchaseBusy = false;
      render();
    }
  }

  return Object.freeze({
    render,
    purchase,
    setStatus,
    get busy() {
      return purchaseBusy;
    }
  });
}
