import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "dist-pages");
const repositoryUrl = "https://github.com/YOxyfel/constellore";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] || "constellore";
const repositoryOwner = process.env.GITHUB_REPOSITORY?.split("/")[0] || "YOxyfel";
const pagesUrl = (process.env.PAGES_BASE_URL || `https://${repositoryOwner.toLowerCase()}.github.io/${repositoryName}/`).replace(/\/?$/, "/");
const configuredBetaUrl = process.env.PUBLIC_BETA_URL?.trim() || "";

function requirePublicUrl(value, name) {
  if (!value) return "";
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTPS URL.`);
  }
  if (parsed.protocol !== "https:") throw new Error(`${name} must use HTTPS.`);
  return parsed.href;
}

function escapeAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

const betaUrl = requirePublicUrl(configuredBetaUrl, "PUBLIC_BETA_URL");
const safePagesUrl = escapeAttribute(requirePublicUrl(pagesUrl, "PAGES_BASE_URL"));
const publicDestination = escapeAttribute(betaUrl || repositoryUrl);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

let html = await readFile(join(root, "Website", "index.html"), "utf8");
html = html
  .replace("<head>", `<head>\n  <link rel="canonical" href="${safePagesUrl}">\n  <meta property="og:url" content="${safePagesUrl}">`)
  .replace('data-beta-url="/play/"', `data-beta-url="${escapeAttribute(betaUrl)}"`)
  .replaceAll('href="/play/"', `href="${publicDestination}"`);

if (!betaUrl) {
  const staticCopy = new Map([
    ["Play beta", "Beta status"],
    ["Play public beta", "View beta source"],
    ["Play free in your browser", "View beta source on GitHub"],
    ["Enter the cosmos", "View the beta source"],
    ["Open full screen", "View source"],
    ["Try today's challenge", "View beta status"],
    ["Play the public beta", "View beta source"],
    ["Launch playable beta", "Open beta repository"],
    ["PLAY BETA", "BETA SOURCE"],
    ["FREE · NO DOWNLOAD", "SERVER DEPLOYMENT NEXT"],
    ["The beta runs<br><em>right in this page.</em>", "The website is live.<br><em>The game server comes next.</em>"],
    ["No install, account, or payment required. Start a run now; if you are on a phone, the beta opens in a full-screen layout designed for touch.", "The public website is online. The playable beta needs its Node server, so this Pages preview links to the source while the game host is connected."],
    ["Free to play in your browser · Purchases disabled during beta", "Marketing site live · Playable server deployment is the next release step"]
  ]);
  for (const [current, replacement] of staticCopy) html = html.replaceAll(current, replacement);
}

await writeFile(join(output, "index.html"), html, "utf8");
await copyFile(join(root, "Website", "styles.css"), join(output, "website.css"));
await copyFile(join(root, "Website", "site.js"), join(output, "website.js"));
await copyFile(join(root, "Website", "robots.txt"), join(output, "robots.txt"));
await copyFile(join(root, "public", "icon.svg"), join(output, "icon.svg"));
await writeFile(join(output, ".nojekyll"), "", "utf8");
await writeFile(join(output, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${safePagesUrl}</loc></url>\n</urlset>\n`, "utf8");

console.log(`Built GitHub Pages site at ${output}`);
console.log(betaUrl ? `Playable beta: ${betaUrl}` : `Playable beta host not configured; CTAs point to ${repositoryUrl}`);
