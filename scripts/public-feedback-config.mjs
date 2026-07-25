export function validatePublicFeedbackApiUrl(value) {
  const configured = typeof value === "string" ? value.trim() : "";
  if (!configured) return "";

  let parsed;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error("PUBLIC_FEEDBACK_API_URL must be an absolute HTTPS URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("PUBLIC_FEEDBACK_API_URL must use HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("PUBLIC_FEEDBACK_API_URL must not include credentials.");
  }
  if (
    parsed.pathname !== "/api/combination-reports"
    || configured.includes("?")
    || configured.includes("#")
  ) {
    throw new Error("PUBLIC_FEEDBACK_API_URL must be the exact HTTPS /api/combination-reports endpoint.");
  }

  return parsed.href;
}
