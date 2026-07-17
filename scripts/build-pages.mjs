import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeLocalWorldModule } from "./build-local-world.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "dist-pages");
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] || "constellore";
const repositoryOwner = process.env.GITHUB_REPOSITORY?.split("/")[0] || "YOxyfel";
const pagesUrl = (process.env.PAGES_BASE_URL || `https://${repositoryOwner.toLowerCase()}.github.io/${repositoryName}/`).replace(/\/?$/, "/");
const configuredBetaUrl = process.env.PUBLIC_BETA_URL?.trim() || "";
const configuredInterestApiUrl = process.env.PUBLIC_INTEREST_API_URL?.trim() || "";
const githubRepository = process.env.GITHUB_REPOSITORY?.trim() || "YOxyfel/constellore";
const githubToken = process.env.GITHUB_TOKEN?.trim() || "";

function requirePublicUrl(value, name) {
  if (!value) return "";
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTPS URL.`);
  }
  if (parsed.protocol !== "https:") throw new Error(`${name} must use HTTPS.`);
  if (parsed.username || parsed.password) throw new Error(`${name} must not include credentials.`);
  return parsed.href;
}

function escapeAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function setBodyDataAttribute(document, name, value) {
  let foundBody = false;
  const updated = document.replace(/<body\b([^>]*)>/i, (tag, attributes) => {
    foundBody = true;
    const encoded = escapeAttribute(String(value));
    const attributePattern = new RegExp(`\\s${name}="[^"]*"`);
    const nextAttributes = attributePattern.test(attributes)
      ? attributes.replace(attributePattern, ` ${name}="${encoded}"`)
      : `${attributes} ${name}="${encoded}"`;
    return `<body${nextAttributes}>`;
  });
  if (!foundBody) throw new Error(`Website document is missing a <body> element for ${name}.`);
  return updated;
}

async function githubStargazerCount(repository, token) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    console.warn("GITHUB_REPOSITORY is invalid; using a zero GitHub interest count.");
    return 0;
  }

  const [owner, name] = repository.split("/");
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "constellore-pages-build",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, {
      headers,
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) {
      console.warn(`GitHub interest lookup returned HTTP ${response.status}; using zero.`);
      return 0;
    }
    const payload = await response.json();
    const count = Number(payload.stargazers_count);
    if (!Number.isSafeInteger(count) || count < 0) {
      console.warn("GitHub interest lookup returned an invalid count; using zero.");
      return 0;
    }
    return count;
  } catch (error) {
    console.warn(`GitHub interest lookup failed (${error?.name || "request error"}); using zero.`);
    return 0;
  }
}

const validatedPagesUrl = requirePublicUrl(pagesUrl, "PAGES_BASE_URL");
const externalBetaUrl = requirePublicUrl(configuredBetaUrl, "PUBLIC_BETA_URL");
const interestApiUrl = requirePublicUrl(configuredInterestApiUrl, "PUBLIC_INTEREST_API_URL");
const localBetaUrl = new URL("play/", validatedPagesUrl).href;
const betaUrl = externalBetaUrl || localBetaUrl;
const safePagesUrl = escapeAttribute(validatedPagesUrl);
const safeBetaUrl = escapeAttribute(betaUrl);
const interestProvider = interestApiUrl ? "first-party" : "github";
const interestCount = interestApiUrl ? 0 : await githubStargazerCount(githubRepository, githubToken);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

let html = await readFile(join(root, "Website", "index.html"), "utf8");
html = html
  .replace("<head>", `<head>\n  <link rel="canonical" href="${safePagesUrl}">\n  <meta property="og:url" content="${safePagesUrl}">`)
  .replace('data-beta-url="/play/"', `data-beta-url="${safeBetaUrl}"`)
  .replaceAll('href="/play/"', `href="${safeBetaUrl}"`);
html = setBodyDataAttribute(html, "data-interest-api-url", interestApiUrl);
html = setBodyDataAttribute(html, "data-interest-provider", interestProvider);
html = setBodyDataAttribute(html, "data-interest-count", interestCount);

if (!externalBetaUrl) {
  const staticCopy = new Map([
    ["PUBLIC BETA", "LOCAL PRACTICE BETA"],
    ["Play beta", "Play practice"],
    ["Play public beta", "Play local practice"],
    ["Play the public beta", "Play the practice beta"],
    ["Launch playable beta", "Launch local practice"],
    ["CONSTELLORE BETA", "CONSTELLORE PRACTICE"],
    ["The beta runs<br><em>right in this page.</em>", "Play here.<br><em>Your progress stays local.</em>"],
    ["No install, account, or payment required. Start a run now; if you are on a phone, the beta opens in a full-screen layout designed for touch.", "No install, account, or payment required. This practice build saves progress on this device; verified rankings and the global Exchange need the online server."],
    ["Official runs are verified by the server. Pure paths use only discovered combinations. Wished or Vault-assisted runs compete in Open, so creative shortcuts never erase a clean solve.", "This is a real local puzzle without a pretend ranking. Discoveries and progress stay in this browser; verified leaderboards arrive with the online account service."],
    ["Illustrative names and scores. Live rankings appear inside the beta.", "Illustrative preview. Verified rankings arrive with the online account service."],
    ["No. The browser creates a temporary guest identity on this device. A recoverable account system will arrive before paid ownership is enabled.", "No. Local-practice progress is stored in this browser and cannot yet be recovered on another device. Clearing site data resets it."],
    ["Free to play in your browser · Purchases disabled during beta", "Local practice · Saved on this device · No payments"]
  ]);
  for (const [current, replacement] of staticCopy) html = html.replaceAll(current, replacement);
}

await writeFile(join(output, "index.html"), html, "utf8");
await copyFile(join(root, "Website", "styles.css"), join(output, "website.css"));
await copyFile(join(root, "Website", "site.js"), join(output, "website.js"));
await copyFile(join(root, "Website", "robots.txt"), join(output, "robots.txt"));
await copyFile(join(root, "public", "icon.svg"), join(output, "icon.svg"));

const playOutput = join(output, "play");
await mkdir(playOutput, { recursive: true });
let gameHtml = await readFile(join(root, "public", "index.html"), "utf8");
gameHtml = gameHtml
  .replace("<head>", `<head>\n  <link rel="canonical" href="${escapeAttribute(localBetaUrl)}">\n  <meta property="og:url" content="${escapeAttribute(localBetaUrl)}">`)
  .replace("<body>", '<body data-runtime="local-practice">')
  .replaceAll('href="/manifest.webmanifest"', 'href="./manifest.webmanifest"')
  .replaceAll('href="/icon.svg"', 'href="./icon.svg"')
  .replaceAll('href="/styles.css?v=1.6.0"', 'href="./styles.css?v=1.6.0"')
  .replaceAll('src="/app.js?v=1.4.2"', 'src="./app.js?v=1.4.2"');
await writeFile(join(playOutput, "index.html"), gameHtml, "utf8");
await copyFile(join(root, "public", "styles.css"), join(playOutput, "styles.css"));
await copyFile(join(root, "public", "app.js"), join(playOutput, "app.js"));
await copyFile(join(root, "public", "local-beta.mjs"), join(playOutput, "local-beta.mjs"));
await copyFile(join(root, "public", "icon.svg"), join(playOutput, "icon.svg"));
await writeLocalWorldModule(join(playOutput, "local-world.mjs"));

const manifest = JSON.parse(await readFile(join(root, "public", "manifest.webmanifest"), "utf8"));
manifest.name = "Constellore Local Practice";
manifest.short_name = "Constellore";
manifest.start_url = "./";
manifest.scope = "./";
manifest.icons = manifest.icons.map((icon) => ({ ...icon, src: "./icon.svg" }));
await writeFile(join(playOutput, "manifest.webmanifest"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const serviceWorker = `const CACHE = "constellore-pages-practice-v6";
const BASE = new URL("./", self.location.href);
const SHELL = ["./", "./styles.css?v=1.6.0", "./app.js?v=1.4.2", "./local-beta.mjs", "./local-world.mjs", "./manifest.webmanifest", "./icon.svg"].map((path) => new URL(path, BASE).href);
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok && new URL(event.request.url).origin === self.location.origin) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  }).catch(async () => (await caches.match(event.request)) || (event.request.mode === "navigate" ? caches.match(SHELL[0]) : new Response("Offline", { status: 503 }))));
});
`;
await writeFile(join(playOutput, "service-worker.js"), serviceWorker, "utf8");
await writeFile(join(output, ".nojekyll"), "", "utf8");
await writeFile(join(output, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${safePagesUrl}</loc></url>\n  <url><loc>${escapeAttribute(localBetaUrl)}</loc></url>\n</urlset>\n`, "utf8");

console.log(`Built GitHub Pages site at ${output}`);
console.log(externalBetaUrl ? `Playable server beta: ${externalBetaUrl}` : `Playable local-practice beta: ${localBetaUrl}`);
console.log(interestApiUrl ? `Interest provider: first-party (${interestApiUrl})` : `Interest provider: GitHub (${interestCount} stargazers)`);
