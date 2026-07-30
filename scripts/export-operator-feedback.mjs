const env = process.env;

function boundedInteger(name, fallback, minimum, maximum) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

function operatorBaseUrl(value) {
  if (!value) {
    throw new Error("Set CONSTELLORE_OPERATOR_BASE_URL to the Node server or feedback Worker origin.");
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("CONSTELLORE_OPERATOR_BASE_URL must be a valid absolute URL.");
  }
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && localHost)) {
    throw new Error("The operator URL must use HTTPS, except for a local development server.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("The operator URL cannot contain credentials, a query, or a fragment.");
  }
  if (!["", "/"].includes(url.pathname)) {
    throw new Error("Use the service origin, not /play/, /api/, or another path.");
  }
  return url.origin;
}

async function readJson(baseUrl, headers, path) {
  const response = await fetch(new URL(path, `${baseUrl}/`), {
    method: "GET",
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(15_000)
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${path} returned a non-JSON response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const detail = typeof payload?.error === "string" ? ` ${payload.error}` : "";
    const setupHint = response.status === 404
      ? " Confirm CONSTELLORE_ADMIN_TOKEN is configured on the server and redeploy it."
      : "";
    throw new Error(`${path} failed with HTTP ${response.status}.${detail}${setupHint}`);
  }
  return payload;
}

async function main() {
  const baseUrl = operatorBaseUrl(env.CONSTELLORE_OPERATOR_BASE_URL);
  const token = String(env.CONSTELLORE_ADMIN_TOKEN || "").trim();
  if (token.length < 24) {
    throw new Error("CONSTELLORE_ADMIN_TOKEN must contain the same high-entropy secret (at least 24 characters) configured on the service.");
  }

  const minimumReports = boundedInteger("CONSTELLORE_REPORT_MINIMUM_REPORTS", 1, 1, 100_000);
  const minimumVotes = boundedInteger("CONSTELLORE_REPORT_MINIMUM_VOTES", 1, 1, 100_000);
  const limit = boundedInteger("CONSTELLORE_REPORT_LIMIT", 100, 1, 500);
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`
  };

  const [missingCombinations, recipeRatings] = await Promise.all([
    readJson(baseUrl, headers, `/api/admin/rejected-pairs?minimumReports=${minimumReports}&limit=${limit}`),
    readJson(baseUrl, headers, `/api/admin/recipe-feedback?minimumVotes=${minimumVotes}&limit=${limit}`)
  ]);

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    server: baseUrl,
    privacy: "Aggregate operator report; no player identity, bearer token, recovery secret, or free-form comment is included.",
    missingCombinations,
    recipeRatings
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`Feedback export failed: ${error instanceof Error ? error.message : "Unknown error."}\n`);
  process.exitCode = 1;
});
