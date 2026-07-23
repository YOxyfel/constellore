const header = document.querySelector(".site-header");
const menuButton = document.querySelector("#menuButton");
const mobileNavigation = document.querySelector("#mobileNav");
const menuLabel = menuButton?.querySelector(".sr-only");
const betaUrl = document.body.dataset.betaUrl?.trim() || "";
const configuredItchUrl = document.body.dataset.itchUrl?.trim() || "";
const repositoryUrl = document.body.dataset.repositoryUrl?.trim() || "https://github.com/YOxyfel/constellore";

const buildVersion = document.querySelector("#siteBuildVersion");
if (buildVersion) buildVersion.textContent = document.body.dataset.buildVersion?.trim() || "LOCAL";

function trustedExternalUrl(value, allowedHosts) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return "";
    if (!allowedHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) return "";
    return parsed.href;
  } catch {
    return "";
  }
}

const itchUrl = trustedExternalUrl(configuredItchUrl, ["itch.io"]);
const trustedRepositoryUrl = trustedExternalUrl(repositoryUrl, ["github.com"]) || "https://github.com/YOxyfel/constellore";
const followUrl = itchUrl || trustedRepositoryUrl;
const followLabel = itchUrl ? "Follow Constellore on itch.io" : "Follow development on GitHub";

document.querySelectorAll("[data-follow-link]").forEach((link) => {
  link.href = followUrl;
});
document.querySelectorAll("[data-follow-label]").forEach((label) => {
  label.textContent = followLabel;
});

const followNote = document.querySelector("#followNote");
if (followNote) {
  followNote.textContent = itchUrl
    ? "Follow the itch.io page to receive release and devlog updates."
    : "Follow the open beta on GitHub for releases and development updates.";
}

function closeMenu() {
  if (!menuButton || !mobileNavigation) return;
  menuButton.setAttribute("aria-expanded", "false");
  mobileNavigation.classList.remove("open");
  document.body.classList.remove("menu-open");
  if (menuLabel) menuLabel.textContent = "Open navigation";
}

menuButton?.addEventListener("click", () => {
  if (!mobileNavigation) return;
  const opening = menuButton.getAttribute("aria-expanded") !== "true";
  menuButton.setAttribute("aria-expanded", String(opening));
  mobileNavigation.classList.toggle("open", opening);
  document.body.classList.toggle("menu-open", opening);
  if (menuLabel) menuLabel.textContent = opening ? "Close navigation" : "Open navigation";
});

mobileNavigation?.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  if (target?.closest("a")) closeMenu();
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 800) closeMenu();
});

function updateHeader() {
  header?.classList.toggle("scrolled", window.scrollY > 20);
}

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -24px" });
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("visible"));
}

const recipeMap = new Map([
  ["Air|Air", { word: "Wind", emoji: "🌬️", message: "Air gathers into wind." }],
  ["Air|Earth", { word: "Dust", emoji: "🌫️", message: "Air lifts earth into dust." }],
  ["Air|Fire", { word: "Energy", emoji: "⚡", message: "Fire fed by air releases energy." }],
  ["Air|Water", { word: "Mist", emoji: "🌫️", message: "Water suspended in air becomes mist." }],
  ["Air|Steam", { word: "Cloud", emoji: "☁️", message: "Steam cooling in air gathers into a cloud." }],
  ["Earth|Earth", { word: "Land", emoji: "🏞️", message: "Earth joined with earth forms land." }],
  ["Earth|Fire", { word: "Lava", emoji: "🌋", message: "Fire melts earth into lava." }],
  ["Earth|Water", { word: "Mud", emoji: "🟤", message: "Water softens earth into mud." }],
  ["Fire|Fire", { word: "Wildfire", emoji: "🔥", message: "Fire spreads into a wildfire." }],
  ["Fire|Water", { word: "Steam", emoji: "♨️", message: "Fire heats water into steam." }],
  ["Water|Water", { word: "Lake", emoji: "🌊", message: "Water collects into a lake." }],
  ["Cloud|Energy", { word: "Storm", emoji: "⛈️", message: "Energy charges a cloud into a storm." }],
  ["Cloud|Water", { word: "Rain", emoji: "🌧️", message: "A water-heavy cloud releases rain." }],
  ["Energy|Water", { word: "Lightning", emoji: "🌩️", message: "Energy travels through water as lightning." }],
  ["Fire|Mud", { word: "Brick", emoji: "🧱", message: "Fire hardens mud into brick." }],
  ["Brick|Brick", { word: "Wall", emoji: "🧱", message: "Bricks joined together form a wall." }]
]);

const wordEmoji = new Map([
  ["Earth", "🌍"],
  ["Water", "💧"],
  ["Fire", "🔥"],
  ["Air", "💨"]
]);
const startingWords = [...wordEmoji.keys()];
const wordTray = document.querySelector("#wordTray");
const fusionFirst = document.querySelector("#fusionFirst");
const fusionSecond = document.querySelector("#fusionSecond");
const fusionResult = document.querySelector("#fusionResult");
const previewInstruction = document.querySelector("#previewInstruction");
const previewMessage = document.querySelector("#previewMessage");
const previewTitle = document.querySelector("#previewTitle");
const previewReset = document.querySelector("#previewReset");
let selectedWord = "";

function recipeKey(first, second) {
  return [first, second].sort((left, right) => left.localeCompare(right, "en")).join("|");
}

function setSelectedChip(word) {
  wordTray?.querySelectorAll(".word-chip").forEach((chip) => {
    chip.classList.toggle("selected", Boolean(word) && chip.dataset.word === word);
  });
}

function addDiscoveredWord(word, emoji) {
  if (!wordTray || wordTray.querySelector(`[data-word="${CSS.escape(word)}"]`)) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "word-chip new-word";
  button.dataset.word = word;
  const symbol = document.createElement("span");
  symbol.textContent = emoji;
  button.append(symbol, document.createTextNode(word));
  wordTray.append(button);
}

function clearResultClasses() {
  fusionResult?.classList.remove("success", "target-found");
}

function selectPreviewWord(word) {
  if (!fusionFirst || !fusionSecond || !fusionResult || !previewInstruction || !previewMessage) return;

  if (!selectedWord) {
    selectedWord = word;
    fusionFirst.textContent = word;
    fusionSecond.textContent = "?";
    fusionResult.textContent = "New word";
    clearResultClasses();
    previewInstruction.textContent = `Now choose a word to combine with ${word}`;
    previewMessage.textContent = `${word} is ready. Choose any visible word—including ${word} again.`;
    setSelectedChip(word);
    return;
  }

  const first = selectedWord;
  const second = word;
  const recipe = recipeMap.get(recipeKey(first, second));
  selectedWord = "";
  setSelectedChip("");
  fusionFirst.textContent = first;
  fusionSecond.textContent = second;
  clearResultClasses();

  if (!recipe) {
    fusionResult.textContent = "No preview result";
    previewInstruction.textContent = "Try another pair";
    previewMessage.textContent = "This small preview maps only a few routes. The full beta contains the complete reviewed world.";
    return;
  }

  fusionResult.textContent = `${recipe.emoji} ${recipe.word}`;
  void fusionResult.offsetWidth;
  fusionResult.classList.add("success");
  addDiscoveredWord(recipe.word, recipe.emoji);

  if (recipe.word === "Storm") {
    fusionResult.classList.add("target-found");
    previewInstruction.textContent = "Destination reached";
    previewMessage.textContent = "You found Storm. The complete game scores the route you took.";
    if (previewTitle) previewTitle.textContent = "GOAL FOUND: STORM";
  } else {
    previewInstruction.textContent = `${recipe.word} discovered`;
    previewMessage.textContent = `${recipe.message} The new word is now available below.`;
  }
}

wordTray?.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const chip = target?.closest(".word-chip");
  if (chip instanceof HTMLButtonElement && chip.dataset.word) selectPreviewWord(chip.dataset.word);
});

function resetPreview() {
  selectedWord = "";
  setSelectedChip("");
  wordTray?.querySelectorAll(".word-chip").forEach((chip) => {
    if (!startingWords.includes(chip.dataset.word || "")) chip.remove();
  });
  if (fusionFirst) fusionFirst.textContent = "?";
  if (fusionSecond) fusionSecond.textContent = "?";
  if (fusionResult) {
    fusionResult.textContent = "New word";
    clearResultClasses();
  }
  if (previewInstruction) previewInstruction.textContent = "Choose two words";
  if (previewMessage) previewMessage.textContent = "Hint: heat Water first, then give the result Air.";
  if (previewTitle) previewTitle.textContent = "GOAL: STORM";
}

previewReset?.addEventListener("click", resetPreview);

const inlinePlayButton = document.querySelector("#inlinePlayButton");
const posterPlayButton = document.querySelector("#posterPlayButton");
const playCard = document.querySelector(".play-card");
const gameEmbed = document.querySelector("#gameEmbed");
const gameFrame = document.querySelector("#gameFrame");
const closeEmbedButton = document.querySelector("#closeEmbed");

function openBeta() {
  if (!betaUrl) {
    window.location.assign(trustedRepositoryUrl);
    return;
  }

  const targetUrl = new URL(betaUrl, window.location.href);
  const shouldNavigate = window.matchMedia("(max-width: 800px)").matches || targetUrl.origin !== window.location.origin;
  if (shouldNavigate || !gameEmbed || !(gameFrame instanceof HTMLIFrameElement)) {
    window.location.assign(betaUrl);
    return;
  }

  if (!gameFrame.src) {
    targetUrl.searchParams.set("embedded", "1");
    gameFrame.src = targetUrl.href;
  }
  playCard?.classList.add("playing");
  gameEmbed.hidden = false;
  document.querySelector(".play-copy")?.setAttribute("hidden", "");
  posterPlayButton?.setAttribute("hidden", "");
  gameEmbed.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeBeta() {
  if (!gameEmbed) return;
  gameEmbed.hidden = true;
  playCard?.classList.remove("playing");
  document.querySelector(".play-copy")?.removeAttribute("hidden");
  posterPlayButton?.removeAttribute("hidden");
  playCard?.scrollIntoView({ behavior: "smooth", block: "center" });
}

inlinePlayButton?.addEventListener("click", openBeta);
posterPlayButton?.addEventListener("click", openBeta);
closeEmbedButton?.addEventListener("click", closeBeta);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeMenu();
  if (gameEmbed && !gameEmbed.hidden) closeBeta();
});
