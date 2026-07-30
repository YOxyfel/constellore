export function validatePublicDuelApiUrl(value) {
  const configured = typeof value === "string" ? value.trim() : "";
  if (!configured) return "";

  let parsed;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error("PUBLIC_DUEL_API_URL must be an absolute HTTPS URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("PUBLIC_DUEL_API_URL must use HTTPS.");
  }
  if (!/^https:\/\//i.test(configured)) {
    throw new Error("PUBLIC_DUEL_API_URL must use the exact HTTPS URL syntax.");
  }
  if (!/^https:\/\/[^/?#]+\/api\/duels\/?$/i.test(configured)) {
    throw new Error("PUBLIC_DUEL_API_URL must be the exact HTTPS /api/duels base.");
  }
  const authority = configured.match(/^https:\/\/([^/?#]*)/i)?.[1] || "";
  if (parsed.username || parsed.password || authority.includes("@")) {
    throw new Error("PUBLIC_DUEL_API_URL must not include credentials.");
  }
  if (configured.includes("?") || configured.includes("#")) {
    throw new Error("PUBLIC_DUEL_API_URL must not include a query or fragment.");
  }
  if (!["/api/duels", "/api/duels/"].includes(parsed.pathname)) {
    throw new Error("PUBLIC_DUEL_API_URL must be the exact HTTPS /api/duels base.");
  }

  return `${parsed.origin}/api/duels`;
}
