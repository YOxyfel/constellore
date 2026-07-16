const header = document.querySelector(".site-header");
const menuButton = document.querySelector("#menuButton");
const navigation = document.querySelector("#mobileNav");
const revealItems = document.querySelectorAll(".reveal");
const menuLabel = menuButton.querySelector(".sr-only");
const betaUrl = document.body.dataset.betaUrl?.trim() || "";
const repositoryUrl = document.body.dataset.repositoryUrl?.trim() || "https://github.com/YOxyfel/constellore";
const interestApiUrl = document.body.dataset.interestApiUrl?.trim() || "";
const interestProvider = document.body.dataset.interestProvider?.trim() || "first-party";
const initialInterestCount = Math.max(0, Number.parseInt(document.body.dataset.interestCount || "0", 10) || 0);

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
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  if (target?.closest("a")) closeMenu();
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

const wishlistSection = document.querySelector("#wishlist");
const wishlistButton = document.querySelector("#wishlistButton");
const shareButton = document.querySelector("#shareButton");
const wishlistCount = document.querySelector("#wishlistCount");
const wishlistMetricLabel = document.querySelector("#wishlistMetricLabel");
const wishlistStage = document.querySelector("#wishlistStage");
const wishlistProgressLabel = document.querySelector("#wishlistProgressLabel");
const wishlistMeter = document.querySelector("#wishlistMeter");
const wishlistStatus = document.querySelector("#wishlistStatus");
const wishlistDisclosure = document.querySelector("#wishlistDisclosure");
const interestStorageKey = "constellore-interest-v1";
let interestRecord = null;
let interestBusy = false;
let currentInterestCount = initialInterestCount;

function setWishlistButtonLabel(label, symbol = "＋") {
  wishlistButton.querySelector("span").textContent = label;
  wishlistButton.querySelector("b").textContent = symbol;
}

function interestStageFor(count) {
  if (count <= 0) return { stage: "BE THE FIRST SIGNAL", progress: "STARTING", width: 3 };
  if (count < 10) return { stage: "FIRST CONSTELLATION", progress: "SCOUTING", width: 9 + count * 2.2 };
  if (count < 50) return { stage: "GROWING ORBIT", progress: "GROWING", width: 30 + (count - 10) * .65 };
  if (count < 200) return { stage: "STRONG PULL", progress: "PROMISING", width: 56 + (count - 50) * .2 };
  return { stage: "LAUNCH MOMENTUM", progress: "STRONG", width: Math.min(100, 86 + Math.log10(count / 200 + 1) * 18) };
}

function renderInterest(count = currentInterestCount) {
  currentInterestCount = Math.max(0, Number(count) || 0);
  const labels = interestStageFor(currentInterestCount);
  wishlistCount.textContent = currentInterestCount.toLocaleString();
  wishlistStage.textContent = labels.stage;
  wishlistProgressLabel.textContent = labels.progress;
  wishlistMeter.style.width = `${labels.width}%`;

  if (interestProvider === "github") {
    wishlistMetricLabel.textContent = "GITHUB STARS · PUBLIC SIGNAL";
    setWishlistButtonLabel("☆ Star on GitHub", "↗");
    wishlistButton.setAttribute("aria-pressed", "false");
    wishlistDisclosure.textContent = "A real GitHub star count, synced when this site was built. Public, one per account, and reversible on GitHub.";
    wishlistStatus.textContent = "Until store pages exist, GitHub stars are the public zero-cost launch signal. A free GitHub account is required.";
    return;
  }

  const interested = Boolean(interestRecord?.interested);
  wishlistSection.classList.toggle("interested", interested);
  wishlistButton.setAttribute("aria-pressed", String(interested));
  wishlistMetricLabel.textContent = "LAUNCH WISHLISTS";
  setWishlistButtonLabel(interested ? "✦ In my orbit" : "☆ Add to launch wishlist", interested ? "−" : "＋");
  wishlistDisclosure.textContent = "One anonymous browser can add or remove one signal. No email, account, or marketing list.";
}

function storageAvailable() {
  try {
    const key = "__constellore_storage_test__";
    localStorage.setItem(key, key);
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function loadInterestRecord() {
  try {
    const parsed = JSON.parse(localStorage.getItem(interestStorageKey) || "null");
    if (parsed && typeof parsed.anonymousId === "string" && typeof parsed.interested === "boolean") return parsed;
  } catch { /* A damaged or blocked local record is ignored. */ }
  return null;
}

function saveInterestRecord(record) {
  localStorage.setItem(interestStorageKey, JSON.stringify(record));
  interestRecord = record;
}

function createAnonymousId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function interestEndpoint() {
  return interestApiUrl ? new URL(interestApiUrl, window.location.href) : null;
}

function countFromResponse(payload) {
  const count = payload?.count ?? payload?.active ?? payload?.totals?.active ?? payload?.campaign?.active;
  return Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : null;
}

async function refreshInterestCount() {
  const endpoint = interestEndpoint();
  if (!endpoint) throw new Error("The shared wishlist is not connected yet.");
  endpoint.searchParams.set("campaign", "web-release");
  const response = await fetch(endpoint, { credentials: "omit", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("The shared wishlist is temporarily unavailable.");
  const payload = await response.json();
  const count = countFromResponse(payload);
  if (count !== null) renderInterest(count);
}

function interestSource() {
  if (window.location.hostname === "yoxyfel.github.io") return "github-pages";
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return "local-practice";
  return "website";
}

async function toggleInterest() {
  if (interestProvider === "github") {
    window.open(repositoryUrl, "_blank", "noopener,noreferrer");
    wishlistStatus.className = "wishlist-status success";
    wishlistStatus.textContent = "GitHub opened. Press Star there to add your public signal; the number updates on the next site build.";
    return;
  }
  if (interestBusy) return;
  if (!storageAvailable()) {
    wishlistStatus.className = "wishlist-status error";
    wishlistStatus.textContent = "This browser blocks local storage, so it cannot safely keep one reversible signal. You can still share Constellore.";
    return;
  }

  const endpoint = interestEndpoint();
  if (!endpoint) {
    wishlistStatus.className = "wishlist-status error";
    wishlistStatus.textContent = "The public wishlist is not connected on this build yet.";
    return;
  }

  interestBusy = true;
  wishlistButton.disabled = true;
  wishlistStatus.className = "wishlist-status";
  wishlistStatus.textContent = interestRecord?.interested ? "Removing your signal…" : "Adding your signal…";
  try {
    const anonymousId = interestRecord?.anonymousId || createAnonymousId();
    const action = interestRecord?.interested ? "remove" : "add";
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ anonymousId, campaign: "web-release", source: interestSource(), action })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "The shared wishlist is temporarily unavailable.");
    const interested = typeof payload.interested === "boolean" ? payload.interested : action === "add";
    saveInterestRecord({ anonymousId, interested });
    wishlistStatus.className = "wishlist-status success";
    wishlistStatus.textContent = interested
      ? "Signal confirmed. This browser is now in Constellore's launch orbit."
      : "Signal removed. You can add it again at any time.";
    const responseCount = countFromResponse(payload);
    if (responseCount !== null) renderInterest(responseCount);
    else {
      const delta = payload.changed ? (interested ? 1 : -1) : 0;
      renderInterest(currentInterestCount + delta);
      await refreshInterestCount().catch(() => {});
    }
  } catch (error) {
    wishlistStatus.className = "wishlist-status error";
    wishlistStatus.textContent = error.message || "The shared wishlist is temporarily unavailable.";
  } finally {
    interestBusy = false;
    wishlistButton.disabled = false;
    renderInterest(currentInterestCount);
  }
}

async function shareConstellore() {
  const shareData = {
    title: "Constellore",
    text: "Constellore is a goal-driven word-combination game you can play in the browser.",
    url: window.location.href.split("#")[0]
  };
  try {
    if (navigator.share) await navigator.share(shareData);
    else {
      await navigator.clipboard.writeText(shareData.url);
      shareButton.firstChild.textContent = "Link copied ";
      window.setTimeout(() => { shareButton.firstChild.textContent = "Share Constellore "; }, 2200);
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      wishlistStatus.className = "wishlist-status error";
      wishlistStatus.textContent = "Sharing was blocked. Copy the page address from your browser instead.";
    }
  }
}

interestRecord = storageAvailable() ? loadInterestRecord() : null;
renderInterest(initialInterestCount);
if (interestProvider === "first-party") {
  if (!storageAvailable()) {
    wishlistButton.disabled = true;
    wishlistStatus.className = "wishlist-status error";
    wishlistStatus.textContent = "This browser blocks local storage, so a reversible signal cannot be saved.";
  } else {
    wishlistStatus.textContent = interestRecord?.interested
      ? "Your launch signal is saved on this browser. Select it again to remove it."
      : "Creates one random browser ID only after you click. The server stores a one-way code, source, and date—never your email.";
    refreshInterestCount().catch(() => {
      wishlistStatus.className = "wishlist-status error";
      wishlistStatus.textContent = "The shared count is offline right now. Your existing browser choice has not changed.";
    });
  }
}

wishlistButton.addEventListener("click", toggleInterest);
shareButton.addEventListener("click", shareConstellore);
