const betaUrl = document.body.dataset.betaUrl?.trim() || "";
const repositoryUrl = document.body.dataset.repositoryUrl?.trim() || "https://github.com/YOxyfel/constellore";
const buildVersion = document.querySelector("#siteBuildVersion");

if (buildVersion) {
  buildVersion.textContent = document.body.dataset.buildVersion?.trim() || "LOCAL";
}

const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -20px" });
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("visible"));
}

const recipeMap = new Map([
  ["Air|Air", { word: "Wind", emoji: "🌬️" }],
  ["Air|Earth", { word: "Dust", emoji: "🌫️" }],
  ["Air|Fire", { word: "Energy", emoji: "⚡" }],
  ["Air|Water", { word: "Mist", emoji: "🌫️" }],
  ["Air|Steam", { word: "Cloud", emoji: "☁️" }],
  ["Earth|Earth", { word: "Land", emoji: "🏞️" }],
  ["Earth|Fire", { word: "Lava", emoji: "🌋" }],
  ["Earth|Water", { word: "Mud", emoji: "🟤" }],
  ["Fire|Fire", { word: "Wildfire", emoji: "🔥" }],
  ["Fire|Water", { word: "Steam", emoji: "♨️" }],
  ["Water|Water", { word: "Lake", emoji: "🌊" }],
  ["Cloud|Energy", { word: "Storm", emoji: "⛈️" }],
  ["Cloud|Water", { word: "Rain", emoji: "🌧️" }],
  ["Energy|Water", { word: "Lightning", emoji: "🌩️" }],
  ["Fire|Mud", { word: "Brick", emoji: "🧱" }],
  ["Brick|Brick", { word: "Wall", emoji: "🧱" }]
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
    const selected = Boolean(word) && chip.dataset.word === word;
    chip.classList.toggle("selected", selected);
    chip.setAttribute("aria-pressed", String(selected));
  });
}

function addDiscoveredWord(word, emoji) {
  if (!wordTray || wordTray.querySelector(`[data-word="${CSS.escape(word)}"]`)) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "word-chip new-word";
  button.dataset.word = word;
  button.setAttribute("aria-pressed", "false");

  const symbol = document.createElement("span");
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = emoji;
  button.append(symbol, document.createTextNode(word));
  wordTray.append(button);
}

function clearResult() {
  fusionResult?.classList.remove("success", "target-found");
}

function selectPreviewWord(word) {
  if (!fusionFirst || !fusionSecond || !fusionResult || !previewInstruction || !previewMessage) return;

  if (!selectedWord) {
    selectedWord = word;
    fusionFirst.textContent = word;
    fusionSecond.textContent = "?";
    fusionResult.textContent = "New word";
    clearResult();
    previewInstruction.textContent = `Now pick a word to add to ${word}`;
    previewMessage.textContent = `You picked ${word}. Pick one more word.`;
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
  clearResult();

  if (!recipe) {
    fusionResult.textContent = "Try again";
    previewInstruction.textContent = "Pick another pair";
    previewMessage.textContent = "Those two words do not make anything in this short example.";
    return;
  }

  fusionResult.textContent = `${recipe.emoji} ${recipe.word}`;
  void fusionResult.offsetWidth;
  fusionResult.classList.add("success");
  addDiscoveredWord(recipe.word, recipe.emoji);

  if (recipe.word === "Storm") {
    fusionResult.classList.add("target-found");
    previewInstruction.textContent = "You did it!";
    previewMessage.textContent = "You made Storm. Press Play free to try the full game.";
    if (previewTitle) previewTitle.textContent = "You made Storm!";
    return;
  }

  previewInstruction.textContent = `You made ${recipe.word}`;
  previewMessage.textContent = `${recipe.word} is now ready to use. Pick two words again.`;
}

wordTray?.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const chip = target?.closest(".word-chip");
  if (chip instanceof HTMLButtonElement && chip.dataset.word) {
    selectPreviewWord(chip.dataset.word);
  }
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
    clearResult();
  }
  if (previewInstruction) previewInstruction.textContent = "Pick two words";
  if (previewMessage) previewMessage.textContent = "Need a hint? Make Steam, then add Air.";
  if (previewTitle) previewTitle.textContent = "Target: Storm";
}

previewReset?.addEventListener("click", resetPreview);

const posterPlayButton = document.querySelector("#posterPlayButton");
const playCard = document.querySelector(".play-card");
const gameEmbed = document.querySelector("#gameEmbed");
const gameFrame = document.querySelector("#gameFrame");
const closeEmbedButton = document.querySelector("#closeEmbed");

function openBeta() {
  if (!betaUrl) {
    window.location.assign(repositoryUrl);
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

posterPlayButton?.addEventListener("click", openBeta);
closeEmbedButton?.addEventListener("click", closeBeta);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && gameEmbed && !gameEmbed.hidden) {
    closeBeta();
  }
});
