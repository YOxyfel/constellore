const RECIPIENT_ALIASES = Object.freeze([
  "Sophia",
  "София",
  "Sofi",
  "Салфетка",
  "Коте",
  "Слънце"
]);

export const BIRTHDAY_VOYAGE_CONFIG = Object.freeze({
  enabled: true,
  version: 2,
  recipient: Object.freeze({
    aliases: RECIPIENT_ALIASES,
    displayName: "Sophia",
    interfacePair: "Sophia + Yane",
    finaleSignature: "София ✦ Яне"
  }),
  giver: Object.freeze({
    displayName: "Yane",
    nativeName: "Яне"
  }),
  dedication: "Happy birthday, Sophia. Our journey begins here in Varna, but it does not end at any city, planet, or map. I want us to travel through every world we can reach—the physical ones, the imagined ones, and the inner worlds we discover together. Wherever the stars take us, I want the seat beside you. — Yane"
});

// Backwards-compatible named exports for the existing launcher and tests.
export const BIRTHDAY_VOYAGE_ENABLED = BIRTHDAY_VOYAGE_CONFIG.enabled;
export const BIRTHDAY_HONOREE_NAMES = BIRTHDAY_VOYAGE_CONFIG.recipient.aliases;
export const BIRTHDAY_HONOREE_DISPLAY_NAME = BIRTHDAY_VOYAGE_CONFIG.recipient.displayName;
export const BIRTHDAY_GIVER_NAME = BIRTHDAY_VOYAGE_CONFIG.giver.displayName;
export const BIRTHDAY_FINAL_MESSAGE = BIRTHDAY_VOYAGE_CONFIG.dedication;
export const BIRTHDAY_FINALE_SIGNATURE = BIRTHDAY_VOYAGE_CONFIG.recipient.finaleSignature;
export const BIRTHDAY_INTERFACE_PAIR = BIRTHDAY_VOYAGE_CONFIG.recipient.interfacePair;
export const BIRTHDAY_VOYAGE_VERSION = BIRTHDAY_VOYAGE_CONFIG.version;
