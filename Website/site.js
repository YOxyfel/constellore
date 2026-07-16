const header = document.querySelector(".site-header");
const menuButton = document.querySelector("#menuButton");
const navigation = document.querySelector("#mobileNav");
const revealItems = document.querySelectorAll(".reveal");
const menuLabel = menuButton.querySelector(".sr-only");
const betaUrl = document.body.dataset.betaUrl?.trim() || "";
const repositoryUrl = document.body.dataset.repositoryUrl?.trim() || "https://github.com/YOxyfel/constellore";

function closeMenu() {
  menuButton.setAttribute("aria-expanded", "false");
  navigation.classList.remove("open");
  document.body.classList.remove("menu-open");
  menuLabel.textContent = "Open navigation";
}

menuButton.addEventListener("click", () => {
  const opening = menuButton.getAttribute("aria-expanded") !== "true";
  menuButton.setAttribute("aria-expanded", String(opening));
  navigation.classList.toggle("open", opening);
  document.body.classList.toggle("menu-open", opening);
  menuLabel.textContent = opening ? "Close navigation" : "Open navigation";
});

navigation.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMenu();
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 800) closeMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});

function updateHeader() {
  header.classList.toggle("scrolled", window.scrollY > 20);
}

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.13, rootMargin: "0px 0px -25px" });
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("visible"));
}

const combinations = {
  mud: {
    emoji: "🟤",
    word: "Mud",
    formula: "EARTH + WATER",
    note: "Water softens earth into mud.",
    active: ["earth", "water"]
  },
  energy: {
    emoji: "⚡",
    word: "Energy",
    formula: "FIRE + AIR",
    note: "Fire fed by air releases energy.",
    active: ["fire", "air"]
  },
  bird: {
    emoji: "🐦",
    word: "Bird",
    formula: "LIFE + AIR",
    note: "Life takes to the air and becomes a bird.",
    active: ["air"]
  }
};

const result = document.querySelector("#demoResult");
const demoNote = document.querySelector("#demoNote");
const demoButtons = document.querySelectorAll("[data-demo]");
const wordNodes = document.querySelectorAll(".word-node");

function showCombination(key) {
  const combination = combinations[key];
  if (!combination) return;
  demoButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.demo === key)));
  wordNodes.forEach((node) => node.classList.toggle("active", combination.active.some((name) => node.classList.contains(`node-${name}`))));
  result.classList.add("changing");
  window.setTimeout(() => {
    result.querySelector("span").textContent = combination.emoji;
    result.querySelector("strong").textContent = combination.word;
    result.querySelector("small").textContent = combination.formula;
    demoNote.textContent = combination.note;
    result.classList.remove("changing");
  }, 170);
}

demoButtons.forEach((button) => button.addEventListener("click", () => showCombination(button.dataset.demo)));
wordNodes.forEach((node) => node.addEventListener("click", () => showCombination(node.dataset.recipe)));

const inlinePlayButton = document.querySelector("#inlinePlayButton");
const posterPlayButton = document.querySelector("#posterPlayButton");
const playPoster = document.querySelector("#playPoster");
const gameEmbed = document.querySelector("#gameEmbed");
const gameFrame = document.querySelector("#gameFrame");
const closeEmbed = document.querySelector("#closeEmbed");

function openBeta() {
  if (!betaUrl) {
    window.location.assign(repositoryUrl);
    return;
  }
  const targetUrl = new URL(betaUrl, window.location.href);
  if (window.matchMedia("(max-width: 700px)").matches || targetUrl.origin !== window.location.origin) {
    window.location.assign(betaUrl);
    return;
  }
  if (!gameFrame.src) {
    const embeddedUrl = new URL(targetUrl);
    embeddedUrl.searchParams.set("embedded", "1");
    gameFrame.src = embeddedUrl.href;
  }
  playPoster.hidden = true;
  gameEmbed.hidden = false;
  gameEmbed.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeBeta() {
  gameEmbed.hidden = true;
  playPoster.hidden = false;
  playPoster.scrollIntoView({ behavior: "smooth", block: "center" });
}

inlinePlayButton.addEventListener("click", openBeta);
posterPlayButton.addEventListener("click", openBeta);
closeEmbed.addEventListener("click", closeBeta);
