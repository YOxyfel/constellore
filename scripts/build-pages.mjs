import { startupModuleFiles } from "./startup-module-files.mjs";
import { copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { writeLocalWorldModule } from "./build-local-world.mjs";
import { assertCosmeticPacksAreLazy, validateCosmeticPacks } from "./cosmetic-assets.mjs";
import { validateAudioPacks } from "./audio-assets.mjs";
import { generateReleaseAssets } from "./generate-release-assets.mjs";
import { minifyCss } from "./minify-css.mjs";
import { validatePublicDuelApiUrl } from "./public-duel-config.mjs";
import { validatePublicFeedbackApiUrl } from "./public-feedback-config.mjs";
import { releaseMetadata, withAssetVersion, writeReleaseMetadata } from "./release-metadata.mjs";
import { renderServiceWorker } from "./service-worker-source.mjs";
import {
  PAGES_EXCLUDED_PROTOTYPE_FILES,
  PAGES_MINIFIED_CORE_RUNTIME_FILES
} from "./pages-runtime-inventory.mjs";
import {
  COMBINING_BOARD_CORE_FILES,
  COMBINING_BOARD_LAZY_FILES,
  PLAY_ON_DEMAND_FILES,
  SECONDARY_SURFACE_FILES,
  VOYAGE_PROJECTION_LAZY_FILES
} from "../public/secondary-surface-loader.mjs";
import {
  assertPlanetHubSourceRuntimeInventory,
  buildPlanetHubRuntimeBundle,
  buildPlanetHubRuntimeModule,
  isPlanetHubBundledSourceFile,
  isPlanetHubReleaseLazyFile,
  isPlanetHubReleaseMinifiedFile,
  isPlanetHubReleaseStyleFile,
  isPlanetHubRuntimeFile,
  validatePlanetHubAssets
} from "./planet-hub-packaging.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "dist-pages");
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] || "constellore";
const repositoryOwner = process.env.GITHUB_REPOSITORY?.split("/")[0] || "YOxyfel";
const pagesUrl = (process.env.PAGES_BASE_URL || `https://${repositoryOwner.toLowerCase()}.github.io/${repositoryName}/`).replace(/\/?$/, "/");
const configuredBetaUrl = process.env.PUBLIC_BETA_URL?.trim() || "";
const configuredItchUrl = process.env.PUBLIC_ITCH_URL?.trim() || "";
const configuredFeedbackApiUrl = process.env.PUBLIC_FEEDBACK_API_URL?.trim() || "";
const configuredDuelApiUrl = process.env.PUBLIC_DUEL_API_URL?.trim() || "";
const release = await releaseMetadata({ channel: "github-pages", runtime: "local-practice" });
const PROFILE_FRAME_REVIEW_FILES = new Set([
  "profile-frame-showcase.css",
  "profile-frame-showcase.mjs",
  "profile-frames.html"
]);

async function listRelativeFiles(directory, base = directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listRelativeFiles(path, base));
    else if (entry.isFile()) files.push(relative(base, path).replaceAll("\\", "/"));
  }
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

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

function requireItchUrl(value) {
  const validated = requirePublicUrl(value, "PUBLIC_ITCH_URL");
  if (!validated) return "";
  const parsed = new URL(validated);
  if (parsed.hostname !== "itch.io" && !parsed.hostname.endsWith(".itch.io")) {
    throw new Error("PUBLIC_ITCH_URL must point to itch.io or an itch.io creator subdomain.");
  }
  return parsed.href;
}

function requirePagesUrl(value) {
  const validated = requirePublicUrl(value, "PAGES_BASE_URL");
  const parsed = new URL(validated);
  if (!parsed.pathname.endsWith("/") || parsed.search || parsed.hash) {
    throw new Error("PAGES_BASE_URL must be an HTTPS directory URL ending in / without a query or fragment.");
  }
  return parsed.href;
}

function requireBetaUrl(value) {
  const validated = requirePublicUrl(value, "PUBLIC_BETA_URL");
  if (!validated) return "";
  const parsed = new URL(validated);
  if (!parsed.pathname.endsWith("/play/") || parsed.search || parsed.hash) {
    throw new Error("PUBLIC_BETA_URL must be the full HTTPS game URL ending in /play/ (not the server root).");
  }
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

function compactGameHtml(document) {
  const protectedContents = [];
  const protectedDocument = String(document).replace(
    /(<(script|style|pre|textarea)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi,
    (block, opening, tag, content, closing) => {
      const token = `CONSTELLORE_PROTECTED_HTML_${protectedContents.length}_END`;
      protectedContents.push({ token, content });
      return `${opening}${token}${closing}`;
    }
  );
  let compacted = protectedDocument
    .replace(/<!--(?!\[if\b)[\s\S]*?-->/gi, "")
    .replace(/>\s+</g, "> <")
    .trim();
  for (const { token, content } of protectedContents) {
    compacted = compacted.replace(token, () => content);
  }
  return compacted
    .replace(/(<link rel="canonical"[^>]*>)\s*/i, "$1\n")
    .replace(/(<meta property="og:url"[^>]*>)\s*/i, "$1\n");
}

const validatedPagesUrl = requirePagesUrl(pagesUrl);
const externalBetaUrl = requireBetaUrl(configuredBetaUrl);
const itchUrl = requireItchUrl(configuredItchUrl);
const feedbackApiUrl = validatePublicFeedbackApiUrl(configuredFeedbackApiUrl);
const duelApiUrl = validatePublicDuelApiUrl(configuredDuelApiUrl);
const localBetaUrl = new URL("play/", validatedPagesUrl).href;
const betaUrl = externalBetaUrl || localBetaUrl;
const safePagesUrl = escapeAttribute(validatedPagesUrl);
const safeBetaUrl = escapeAttribute(betaUrl);
const publicEntryUrl = new URL(betaUrl);
publicEntryUrl.searchParams.set("birthday", "off");
const safePublicEntryUrl = escapeAttribute(publicEntryUrl.href);

await generateReleaseAssets();
await validateCosmeticPacks(join(root, "public"));
await validateAudioPacks(join(root, "public"));
await validatePlanetHubAssets(join(root, "public"));
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

let html = await readFile(join(root, "Website", "index.html"), "utf8");
html = withAssetVersion(html, release.version)
  .replaceAll("https://yoxyfel.github.io/constellore/", validatedPagesUrl)
  .replace("<head>", `<head>\n  <link rel="canonical" href="${safePagesUrl}">\n  <meta property="og:url" content="${safePagesUrl}">`)
  .replace('data-beta-url="/play/"', `data-beta-url="${safeBetaUrl}"`)
  .replaceAll('href="/play/"', `href="${safeBetaUrl}"`)
  .replaceAll('href="/play/?birthday=off"', `href="${safePublicEntryUrl}"`);
html = setBodyDataAttribute(html, "data-itch-url", itchUrl);
html = setBodyDataAttribute(html, "data-build-version", release.version);
html = setBodyDataAttribute(html, "data-build-id", release.buildId);

if (!externalBetaUrl) {
  const staticCopy = new Map([
    ["reach a destination word in the free public beta", "reach a destination word in the free local practice beta"],
    ["No account needed. Practice progress stays on this device.", "No account needed. Solo progress stays on this device and works offline. Live Scramble duels use the configured online service."],
    ["Play the public beta free in your browser", "Play the local practice beta free in your browser"],
    ["Build a universe. Find the word. Public beta.", "Build a universe. Find the word. Local practice beta."],
    ["reach the destination word in a free public beta", "reach the destination word in a free local practice puzzle"],
    ["PUBLIC BETA", "LOCAL PRACTICE BETA"],
    ["Play beta", "Play practice"],
    ["Play public beta", "Play local practice"],
    ["Play the public beta", "Play the practice beta"],
    ["Launch playable beta", "Launch local practice"],
    ["CONSTELLORE BETA", "CONSTELLORE PRACTICE"],
    ["<li><strong>Verified orbits</strong><span>Pure + Open</span></li>", "<li><strong>Local practice</strong><span>No account</span></li>"],
    ["aria-label=\"Public beta notice\"", "aria-label=\"Local practice beta notice\""],
    ["SERVER-BACKED BETA IS LIVE", "LOCAL PRACTICE IS LIVE"],
    ["Official runs use server-verified scoring, anonymous Recovery Kits, and separate Pure and Open ladders. Checkout and ads remain disabled.", "Solo play is deterministic, local, and offline-capable: no live AI, verified ranking, checkout, ads, or cross-device account. Live Scramble duels require the configured online service."],
    ["The beta runs<br><em>right in this page.</em>", "Play here.<br><em>Your progress stays local.</em>"],
    ["No install, account, or payment required. Start a run now; if you are on a phone, the beta opens in a full-screen layout designed for touch.", "No install, account, or payment required. Solo progress stays on this device and works offline; live Scramble duels require a connection."],
    ["<strong>PLAY BETA</strong><small>FREE · VERIFIED RUNS</small>", "<strong>PLAY PRACTICE</strong><small>FREE · LOCAL SAVE</small>"],
    ["Fair routes.<br><em>Separate ladders.</em>", "Practice locally.<br><em>No pretend ladder.</em>"],
    ["Official runs are verified by the server. Pure paths use only discovered combinations. Wished, Vault, or powerup-assisted runs compete in Open, so creative shortcuts never erase a clean solve.", "The public web and itch editions run every solo mode locally in your browser. Progress stays on this device, every solo completion is practice-only, live Scramble is online-only, and payments are disabled."],
    ["An anonymous Recovery Kit can move progression between devices without requiring an email or public username.", "Verified online leaderboards, recoverable profiles, and a live word service require the separately hosted online beta."],
    ["Start a verified route", "Start a practice route"],
    ["<div class=\"rank-head\"><span>VERIFIED RANKINGS · ASYNC</span><strong>PURE + OPEN</strong></div>", "<div class=\"rank-head\"><span>PLANNED ONLINE · PREVIEW</span><strong>NOT LIVE</strong></div>"],
    ["Illustrative names and scores. Live rankings appear inside the beta.", "Illustrative preview. Verified rankings arrive with the online account service."],
    ["<h3>Authored at the core</h3><p>Official routes use the same reviewed recipe graph for everyone. Any experimental generation is labelled, Open-only, and never required for ranked targets.</p>", "<h3>Prebuilt practice world</h3><p>The public package uses deterministic local combination rules. Live AI generation is not part of this download.</p>"],
    ["Yes. The public beta has no checkout or rewarded advertising. It is for testing the core route puzzle, controls, balance, and combination quality.", "Yes. The local practice beta has no checkout or rewarded advertising. It is for testing the core route puzzle, controls, balance, and combination quality."],
    ["No. The browser creates a temporary guest identity on this device. A recoverable account system will arrive before paid ownership is enabled.", "No. Local-practice progress is stored in this browser and cannot yet be recovered on another device. Clearing site data resets it."],
    ["No. The browser creates a temporary guest identity on this device. Save the one-time Recovery Kit to restore progression on another device.", "No. Local-practice progress is stored in this browser and cannot be recovered on another device. Clearing site data resets it."],
    ["Yes. Beta progression may be reset for safety or balancing. Menu → Settings and data includes export and deletion controls, and Recovery Kits rotate after use.", "Yes. Practice progress may reset between beta versions. There is no uploaded leaderboard in this package."],
    ["No. The reviewed graph stays selective so successful combinations remain meaningful. Every official target has a build-verified route from the four starters.", "No. The local world uses the reviewed authored graph, so not every pair combines. Every included target has a build-verified route."],
    ["Official routes never depend on live AI. If the experimental casual service is configured, generated recipes are labelled, bounded, persisted for consistency, and scored in Open.", "No. The public web and itch practice builds use a prebuilt local word world. Experimental live generation requires a separate online service and is not advertised as available here."],
    ["These are plain beta disclosures, not finished legal policies. Formal privacy terms, terms of use, trader details, and a private support route must be published before advertising or payments go live.", "These are plain beta disclosures, not finished legal policies. Formal privacy terms, terms of use, and a private support route must be published before accounts, advertising, or payments go live."],
    ["The online beta stores an anonymous guest profile, verified run state, and bounded aggregate diagnostics. It collects no email or public player name, and provides profile export and deletion.", "Solo progression stays in browser storage and uploads no solo gameplay telemetry. Live Scramble sends only bounded authenticated duel actions when you choose that online mode; on-device diagnostics can be exported or reset."],
    ["Free to play in your browser · Purchases disabled during beta", "Free local practice · No account · No payments · Progress stays on this device"]
  ]);
  for (const [current, replacement] of staticCopy) html = html.replaceAll(current, replacement);
}

await writeFile(join(output, "index.html"), html, "utf8");
for (const policyFile of ["privacy.html", "terms.html", "support.html"]) {
  const canonicalPolicyUrl = new URL(policyFile, validatedPagesUrl).href;
  const policy = withAssetVersion(await readFile(join(root, "Website", policyFile), "utf8"), release.version)
    .replaceAll("https://yoxyfel.github.io/constellore/", validatedPagesUrl)
    .replaceAll('href="play/"', `href="${safePublicEntryUrl}"`)
    .replaceAll('href="play/?birthday=off"', `href="${safePublicEntryUrl}"`)
    .replace("<head>", `<head>\n  <link rel="canonical" href="${escapeAttribute(canonicalPolicyUrl)}">`);
  await writeFile(join(output, policyFile), policy, "utf8");
}
await writeFile(join(output, "website.css"), minifyCss(await readFile(join(root, "Website", "styles.css"), "utf8")), "utf8");
await copyFile(join(root, "Website", "site.js"), join(output, "website.js"));
const robots = (await readFile(join(root, "Website", "robots.txt"), "utf8"))
  .replaceAll("https://yoxyfel.github.io/constellore/", validatedPagesUrl);
await writeFile(join(output, "robots.txt"), robots, "utf8");
await copyFile(join(root, "public", "icon.svg"), join(output, "icon.svg"));
await copyFile(join(root, "public", "social-card-v3.jpg"), join(output, "social-card-v3.jpg"));
await writeReleaseMetadata(join(output, "release.json"), { channel: "github-pages", runtime: "local-practice" });

const playOutput = join(output, "play");
await mkdir(playOutput, { recursive: true });
let gameHtml = await readFile(join(root, "public", "index.html"), "utf8");
gameHtml = withAssetVersion(gameHtml, release.version)
  .replace("<head>", `<head>\n  <link rel="canonical" href="${escapeAttribute(localBetaUrl)}">\n  <meta property="og:url" content="${escapeAttribute(localBetaUrl)}">`)
  .replaceAll('href="/manifest.webmanifest"', 'href="./manifest.webmanifest"')
  .replace('<link rel="apple-touch-icon" href="/icon.svg">', '<link rel="apple-touch-icon" href="./icon-192.png">')
  .replaceAll('href="/icon.svg"', 'href="./icon.svg"')
  .replaceAll('href="/art/transitions/', 'href="./art/transitions/')
  .replaceAll('href="/art/home/', 'href="./art/home/')
  .replace(new RegExp(`href="/ui-foundation[.]css[?]v=${release.version.replaceAll(".", "[.]")}"`), `href="./ui-foundation.css?v=${release.version}"`)
  .replace(new RegExp(`href="/styles[.]css[?]v=${release.version.replaceAll(".", "[.]")}"`), `href="./styles.css?v=${release.version}"`)
  .replace(new RegExp(`href="/simple-ui[.]css[?]v=${release.version.replaceAll(".", "[.]")}"`), `href="./simple-ui.css?v=${release.version}"`)
  .replace(new RegExp(`href="/mobile-play-shell[.]css[?]v=${release.version.replaceAll(".", "[.]")}"`), `href="./mobile-play-shell.css?v=${release.version}"`)
  .replace(new RegExp(`href="/concept-chemistry[.]css[?]v=${release.version.replaceAll(".", "[.]")}"`), `href="./concept-chemistry.css?v=${release.version}"`)
  .replace(new RegExp(`href="/concept-matter[.]css[?]v=${release.version.replaceAll(".", "[.]")}"`), `href="./concept-matter.css?v=${release.version}"`)
  .replace(new RegExp(`href="/molecular-memory[.]css[?]v=${release.version.replaceAll(".", "[.]")}"`), `href="./molecular-memory.css?v=${release.version}"`)
  .replace(new RegExp(`href="/word-orbit[.]css[?]v=${release.version.replaceAll(".", "[.]")}"`), `href="./word-orbit.css?v=${release.version}"`)
  .replace(new RegExp(`href="/word-orbit-motion[.]css[?]v=${release.version.replaceAll(".", "[.]")}"`), `href="./word-orbit-motion.css?v=${release.version}"`)
  .replace(new RegExp(`href="/combining-board[.]css[?]v=${release.version.replaceAll(".", "[.]")}"`), `href="./combining-board.css?v=${release.version}"`)
  .replace(new RegExp(`href="/cosmic-gate[.]css[?]v=${release.version.replaceAll(".", "[.]")}"`), `href="./cosmic-gate.css?v=${release.version}"`)
  .replace(new RegExp(`href="/epic-home[.]css[?]v=${release.version.replaceAll(".", "[.]")}"`), `href="./epic-home.css?v=${release.version}"`)
  .replace(new RegExp(`href="/planet-hub[.]css[?]v=${release.version.replaceAll(".", "[.]")}"`), `href="./planet-hub.css?v=${release.version}"`)
  .replace(new RegExp(`href="/moon-project-flight[.]css[?]v=${release.version.replaceAll(".", "[.]")}"`), `href="./moon-project-flight.css?v=${release.version}"`)
  .replace(new RegExp(`href="/cosmetics-observatory[.]css[?]v=${release.version.replaceAll(".", "[.]")}"`), `href="./cosmetics-observatory.css?v=${release.version}"`)
  .replace(new RegExp(`href="/cosmetics[.]css[?]v=${release.version.replaceAll(".", "[.]")}"`), `href="./cosmetics.css?v=${release.version}"`)
  .replace(new RegExp(`href="/cosmos-circuit[.]css[?]v=${release.version.replaceAll(".", "[.]")}"`), `href="./cosmos-circuit.css?v=${release.version}"`)
  .replace(new RegExp(`src="/cosmetic-preload-bootstrap[.]js[?]v=${release.version.replaceAll(".", "[.]")}"`), `src="./cosmetic-preload-bootstrap.js?v=${release.version}"`)
  .replace(new RegExp(`src="/hero-recipes[.]mjs[?]v=${release.version.replaceAll(".", "[.]")}"`), `src="./hero-recipes.mjs?v=${release.version}"`)
  .replace(new RegExp(`src="/app[.]js[?]v=${release.version.replaceAll(".", "[.]")}"`), `src="./app.js?v=${release.version}"`)
  .replace(/\s*<link rel="preconnect" href="https:\/\/fonts[.]googleapis[.]com">\r?\n/gi, "\n")
  .replace(/\s*<link rel="preconnect" href="https:\/\/fonts[.]gstatic[.]com" crossorigin>\r?\n/gi, "\n")
  .replace(/\s*<link href="https:\/\/fonts[.]googleapis[.]com\/[^\"]+" rel="stylesheet">\r?\n/gi, "\n");
gameHtml = setBodyDataAttribute(gameHtml, "data-runtime", "local-practice");
gameHtml = setBodyDataAttribute(gameHtml, "data-build-version", release.version);
gameHtml = setBodyDataAttribute(gameHtml, "data-build-id", release.buildId);
gameHtml = setBodyDataAttribute(gameHtml, "data-feedback-api", feedbackApiUrl);
gameHtml = setBodyDataAttribute(gameHtml, "data-duel-api", duelApiUrl);
gameHtml = compactGameHtml(gameHtml);
await writeFile(join(playOutput, "index.html"), gameHtml, "utf8");
await writeReleaseMetadata(join(playOutput, "release.json"), { channel: "github-pages", runtime: "local-practice" });
const publicRuntimeFiles = (await readdir(join(root, "public"), { withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((name) => /^(?:(?:app|cosmetic-preload-bootstrap)[.]js|(?:ui-foundation|styles|simple-ui|mobile-play-shell|concept-chemistry|concept-matter|molecular-memory|word-orbit|word-orbit-motion|combining-board|cosmic-gate|epic-home|planet-hub|planet-hub-cinematic|moon-project-flight|developer-console|cosmetics|cosmetics-observatory|cosmetics-observatory-full-page|profile-rank-frame|cosmetic-world-preview|cosmic-interlude|cosmos-circuit|stardust-store|scramble|arena-duel-card|birthday-voyage|moon-worldweaving|moon-outpost|moon-heart-project)[.]css|.+[.]mjs|icon(?:-maskable)?(?:-[0-9]+)?[.](?:png|svg))$/.test(name))
  .filter((name) => !PROFILE_FRAME_REVIEW_FILES.has(name))
  .filter((name) => !name.startsWith("moon-settlement-"))
  .filter((name) => !PAGES_EXCLUDED_PROTOTYPE_FILES.includes(name))
  .sort((left, right) => left.localeCompare(right, "en"));
assertPlanetHubSourceRuntimeInventory(publicRuntimeFiles, "Pages Planet Hub source");
for (const name of publicRuntimeFiles) {
  if (isPlanetHubBundledSourceFile(name)) continue;
  const source = join(root, "public", name);
  const destination = join(playOutput, name);
  if (/\.(?:js|mjs)$/.test(name)) {
    const bundleEntry = name === "planet-hub-runtime.mjs" || name === "planet-hub-host.mjs" || name === "website-atlas-preview.mjs" || name === "planet-hub-space.mjs";
    const contents = bundleEntry ? "" : await readFile(source, "utf8");
    const releaseContents = bundleEntry
      ? await buildPlanetHubRuntimeBundle(source, release.version)
      : isPlanetHubReleaseMinifiedFile(name)
        || PAGES_MINIFIED_CORE_RUNTIME_FILES.includes(name)
        || COMBINING_BOARD_LAZY_FILES.includes(name)
        || VOYAGE_PROJECTION_LAZY_FILES.includes(name)
        ? await buildPlanetHubRuntimeModule(contents, release.version)
        : withAssetVersion(contents, release.version);
    await writeFile(destination, releaseContents, "utf8");
  } else if (name.endsWith(".css")) {
    await writeFile(destination, minifyCss(await readFile(source, "utf8")), "utf8");
  } else {
    await copyFile(source, destination);
  }
}
const storySource = join(root, "public", "story");
const storyOutput = join(playOutput, "story");
for (const name of await listRelativeFiles(storySource)) {
  const source = join(storySource, name);
  const destination = join(storyOutput, name);
  await mkdir(dirname(destination), { recursive: true });
  if (/\.(?:js|mjs)$/.test(name)) {
    await writeFile(destination, withAssetVersion(await readFile(source, "utf8"), release.version), "utf8");
  } else if (name.endsWith(".css")) {
    await writeFile(destination, minifyCss(await readFile(source, "utf8")), "utf8");
  } else {
    await copyFile(source, destination);
  }
}
const cinematicSource = join(root, "public", "cinematic");
const cinematicOutput = join(playOutput, "cinematic");
for (const name of await listRelativeFiles(cinematicSource)) {
  const source = join(cinematicSource, name);
  const destination = join(cinematicOutput, name);
  const releasePath = `cinematic/${name}`;
  await mkdir(dirname(destination), { recursive: true });
  if (/\.(?:js|mjs)$/.test(name)) {
    const contents = await readFile(source, "utf8");
    const releaseContents = VOYAGE_PROJECTION_LAZY_FILES.includes(releasePath)
      ? await buildPlanetHubRuntimeModule(contents, release.version)
      : withAssetVersion(contents, release.version);
    await writeFile(destination, releaseContents, "utf8");
  } else if (name.endsWith(".css")) {
    await writeFile(destination, minifyCss(await readFile(source, "utf8")), "utf8");
  } else {
    await copyFile(source, destination);
  }
}
await cp(join(root, "public", "screenshots"), join(playOutput, "screenshots"), { recursive: true, force: true });
await cp(join(root, "public", "fonts"), join(playOutput, "fonts"), { recursive: true, force: true });
await cp(join(root, "public", "vendor"), join(playOutput, "vendor"), { recursive: true, force: true });
// Moon Settlement is an isolated local lab, not the shipped Moon Outpost/Heart.
await cp(join(root, "public", "art"), join(playOutput, "art"), {
  recursive: true,
  force: true,
  filter: (source) => source !== join(root, "public", "art", "moon-settlement")
});
await rm(join(playOutput, "art", "profile-frame-placement-variations.png"), { force: true });
await cp(join(root, "public", "audio"), join(playOutput, "audio"), { recursive: true, force: true });
await writeLocalWorldModule(join(playOutput, "local-world.mjs"));

const manifest = JSON.parse(await readFile(join(root, "public", "manifest.webmanifest"), "utf8"));
manifest.name = "Constellore Local Practice";
manifest.short_name = "Constellore";
manifest.id = "./";
manifest.start_url = "./";
manifest.scope = "./";
manifest.description = "A cosmic word-combination puzzle where you discover new words and build a reachable path to the target.";
manifest.icons = manifest.icons.map((icon) => ({ ...icon, src: `./${icon.src.split("/").pop()}` }));
manifest.shortcuts = (manifest.shortcuts || []).map((shortcut) => ({
  ...shortcut,
  url: `./${String(shortcut.url || "").split("?")[1] ? `?${String(shortcut.url).split("?")[1]}` : ""}`,
  icons: (shortcut.icons || []).map((icon) => ({ ...icon, src: `./${icon.src.split("/").pop()}` }))
}));
manifest.screenshots = (manifest.screenshots || []).map((screenshot) => ({ ...screenshot, src: `./screenshots/${screenshot.src.split("/").pop()}` }));
await writeFile(join(playOutput, "manifest.webmanifest"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const secondarySurfaceAssets = new Set(SECONDARY_SURFACE_FILES);
const playOnDemandAssets = new Set(PLAY_ON_DEMAND_FILES);
for (const name of COMBINING_BOARD_CORE_FILES) {
  if (!publicRuntimeFiles.includes(name)) throw new Error(`Pages core board asset is not included in the runtime build: ${name}`);
}
for (const name of COMBINING_BOARD_LAZY_FILES) {
  if (!publicRuntimeFiles.includes(name)) throw new Error(`Pages lazy board asset is not included in the runtime build: ${name}`);
}
for (const name of VOYAGE_PROJECTION_LAZY_FILES.filter((path) => !path.includes("/"))) {
  if (!publicRuntimeFiles.includes(name)) throw new Error(`Pages lazy projection asset is not included in the runtime build: ${name}`);
}
const planetHubLazyFiles = publicRuntimeFiles
  .filter((name) => !isPlanetHubBundledSourceFile(name))
  .filter(isPlanetHubReleaseLazyFile);
const startupAssets = new Set(await startupModuleFiles(playOutput));
const practiceAssets = (await listRelativeFiles(playOutput))
  .filter((name) => startupAssets.has(name) || (
    name !== "index.html"
    && name !== "service-worker.js"
    && !PROFILE_FRAME_REVIEW_FILES.has(name)
    && !secondarySurfaceAssets.has(name)
    && !playOnDemandAssets.has(name)
    && !isPlanetHubRuntimeFile(name)
    && !isPlanetHubReleaseLazyFile(name)
    && !isPlanetHubReleaseStyleFile(name)
    && !name.startsWith("screenshots/")
    && !name.startsWith("art/ranks/")
    && !name.startsWith("art/transitions/")
    && !name.startsWith("art/home/")
    && !name.startsWith("art/cosmetics/")
    && !name.startsWith("art/profile-frames/")
    && !name.startsWith("art/moon-outpost/")
    && !name.startsWith("art/planet-hub/")
    && !name.startsWith("vendor/three/")
    && !name.startsWith("audio/")
    && !name.startsWith("story/")
    && !name.startsWith("cinematic/")
  ))
  .map((name) => `./${name}${/\.(?:css|js|mjs)$/.test(name) ? `?v=${release.version}` : ""}`)
  .sort((left, right) => left.localeCompare(right, "en"));
const serviceWorker = renderServiceWorker({
  cachePrefix: "constellore-pages-practice-",
  version: release.version,
  assets: practiceAssets,
  lazyAssets: ["./art/ranks/", "./art/transitions/", "./art/home/", "./art/profile-frames/", "./art/moon-outpost/", "./story/", "./cinematic/"],
  lazyFiles: SECONDARY_SURFACE_FILES.concat(PLAY_ON_DEMAND_FILES).map((name) => `./${name}?v=${release.version}`)
    .concat(planetHubLazyFiles.map((name) => `./${name}?v=${release.version}`)),
  lazyPacks: ["./art/cosmetics/", "./art/planet-hub/", "./audio/", "./vendor/three/"],
  legacyCaches: ["constellore-shell-v24", "constellore-pages-practice-v27"]
});
assertCosmeticPacksAreLazy(serviceWorker);
await writeFile(join(playOutput, "service-worker.js"), serviceWorker, "utf8");
await writeFile(join(output, ".nojekyll"), "", "utf8");
await writeFile(join(output, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${safePagesUrl}</loc></url>\n  <url><loc>${escapeAttribute(new URL("privacy.html", validatedPagesUrl).href)}</loc></url>\n  <url><loc>${escapeAttribute(new URL("terms.html", validatedPagesUrl).href)}</loc></url>\n  <url><loc>${escapeAttribute(new URL("support.html", validatedPagesUrl).href)}</loc></url>\n  <url><loc>${escapeAttribute(localBetaUrl)}</loc></url>\n</urlset>\n`, "utf8");

console.log(`Built GitHub Pages site at ${output}`);
console.log(externalBetaUrl ? `Playable server beta: ${externalBetaUrl}` : `Playable local-practice beta: ${localBetaUrl}`);
console.log(itchUrl ? `itch.io CTA: ${itchUrl}` : "itch.io CTA: hidden (set PUBLIC_ITCH_URL after the public page exists)");
console.log(itchUrl ? `Follow destination: itch.io (${itchUrl})` : "Follow destination: GitHub repository");
console.log(feedbackApiUrl ? `Anonymous combination reports: ${feedbackApiUrl}` : "Anonymous combination reports: saved locally (set PUBLIC_FEEDBACK_API_URL for direct delivery)");
console.log(duelApiUrl ? `Live Scramble duels: ${duelApiUrl}` : "Live Scramble duels: unavailable (set PUBLIC_DUEL_API_URL to the hosted /api/duels base)");
