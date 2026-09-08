const $ = (selector) => document.querySelector(selector);
const asset = (path) => new URL(`play/${String(path).replace(/^\.?\//, '')}`, document.baseURI).href;
const chapters = ['discover', 'universe', 'worlds'];
const chapterNames = ['THE FIRST CONNECTION', 'A CHANGE OF PERSPECTIVE', 'A WORLD OF YOUR OWN'];
const nextNames = ['Cross the cosmos', 'Build a home', 'Return to the first connection'];
const scaleNames = { planet: 'Earth', orbit: 'Earth orbit', system: 'Solar System', stars: 'Nearby stars', 'milky-way': 'Milky Way', beyond: 'Cosmic web' };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let currentChapter = 'discover';
let motionPaused = reducedMotion.matches;
let atlas = null;
let atlasPromise = null;
let atlasRequest = 0;
let atlasMountVersion = 0;
let selectedScale = 'planet';
let labCatalog = null;
let labKind = 'collections';
let labSurface = 'gate';
let labRenderId = 0;
const dialogFocus = new WeakMap();

$('#siteBuildVersion').textContent = document.body.dataset.buildVersion || 'LOCAL';
function announce(message) { $('#siteAnnouncement').textContent = message; }
function syncMotion() {
  document.body.classList.toggle('motion-paused', motionPaused);
  const toggle = $('#motionToggle');
  toggle.disabled = reducedMotion.matches;
  toggle.setAttribute('aria-pressed', String(motionPaused));
  toggle.textContent = reducedMotion.matches ? 'Reduced motion' : motionPaused ? 'Motion paused' : 'Pause motion';
  if (motionPaused || document.hidden) $('#frameVideo').pause();
  const suspend = motionPaused || document.hidden || Boolean(document.querySelector('dialog[open]')) || currentChapter === 'discover';
  if (suspend) atlas?.pause(); else atlas?.resume();
}
$('#motionToggle').addEventListener('click', () => { motionPaused = !motionPaused; syncMotion(); });
reducedMotion.addEventListener('change', () => { motionPaused = reducedMotion.matches; syncMotion(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopLabMedia(); syncMotion(); });

function atlasState(state) {
  const fallback = state.status === 'fallback';
  $('#atlasFallbackNote').hidden = !fallback;
  if (currentChapter !== 'discover') $('#stageStatus').textContent = fallback ? 'STILL PREVIEW' : state.status === 'ready' ? 'EXPLORE THE GAME’S LIVE ATLAS' : 'OPENING YOUR VIEW';
  $('#atlasStateLabel').textContent = fallback ? 'Still preview' : state.status === 'loading' ? 'Opening the atlas…' : scaleNames[selectedScale];
  for (const button of document.querySelectorAll('button[data-scale]')) button.disabled = fallback;
}
async function ensureAtlas() {
  if (atlas) return atlas;
  const mountVersion = atlasMountVersion;
  if (!atlasPromise) atlasPromise = import(asset('website-atlas-preview.mjs')).then(({ mountWebsiteAtlas }) => mountWebsiteAtlas({ container: $('#atlasStage'), onState: atlasState, reducedMotion: reducedMotion.matches })).then((mounted) => { if (mountVersion !== atlasMountVersion) { mounted.dispose(); return null; } atlas = mounted; syncMotion(); return mounted; }).catch((error) => {
    atlasPromise = null;
    atlasState({ status: 'fallback' });
    console.warn('Atlas preview unavailable.', error);
    return null;
  });
  return atlasPromise;
}
function setScaleSelection(scale) {
  selectedScale = scale;
  for (const button of document.querySelectorAll('button[data-scale]')) button.setAttribute('aria-pressed', String(button.dataset.scale === scale));
  $('#atlasStateLabel').textContent = scaleNames[scale];
}
async function chooseScale(scale) {
  const view = await ensureAtlas();
  if (!view) return;
  const handled = await view.setScale(scale);
  if (handled !== false) setScaleSelection(scale);
  syncMotion();
}
for (const button of document.querySelectorAll('button[data-scale]')) button.addEventListener('click', () => chooseScale(button.dataset.scale));
$('#atlasReset').addEventListener('click', async () => { const view = await ensureAtlas(); await view?.setWorld('earth'); await chooseScale('planet'); });

function selectChapter(id, { updateUrl = true, focusTab = false } = {}) {
  if (!chapters.includes(id)) id = 'discover';
  currentChapter = id;
  const index = chapters.indexOf(id);
  $('#main').dataset.chapter = id;
  document.querySelectorAll('[data-chapter-target]').forEach((tab) => {
    const selected = tab.dataset.chapterTarget === id;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    $(`#panel-${tab.dataset.chapterTarget}`).hidden = !selected;
    if (selected && focusTab) tab.focus({ preventScroll: true });
  });
  $('#chapterCoordinate').textContent = `0${index + 1} / ${chapterNames[index]}`;
  $('#chapterCount').textContent = `0${index + 1} — 03`;
  $('#progressFill').style.width = `${(index + 1) / 3 * 100}%`;
  $('#nextChapter').firstChild.textContent = `${nextNames[index]} `;
  $('#stageStatus').textContent = id === 'discover' ? 'IN THE CURRENT GAME' : 'OPENING YOUR VIEW';
  $('#atlasStage').hidden = id === 'discover';
  if (updateUrl && location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
  const request = ++atlasRequest;
  if (id !== 'discover') ensureAtlas().then(async (view) => {
    if (!view || request !== atlasRequest) return;
    await view.setWorld(id === 'worlds' ? 'moon' : 'earth');
    if (request !== atlasRequest) return;
    if (id === 'universe') await view.setScale(selectedScale);
    if (request !== atlasRequest) return;
    atlasState(view.getState());
    syncMotion();
  });
  syncMotion();
}
for (const tab of document.querySelectorAll('[data-chapter-target]')) tab.addEventListener('click', () => selectChapter(tab.dataset.chapterTarget));
$('.chapter-tabs').addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const index = chapters.indexOf(currentChapter);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
  selectChapter(chapters[next], { focusTab: true });
});
$('#nextChapter').addEventListener('click', () => {
  selectChapter(chapters[(chapters.indexOf(currentChapter) + 1) % 3], { focusTab: true });
  if (matchMedia('(max-width: 600px)').matches) $('#main').scrollIntoView({ behavior: motionPaused ? 'instant' : 'smooth' });
});
window.addEventListener('hashchange', () => selectChapter(location.hash.slice(1), { updateUrl: false }));

function openDialog(dialog, trigger = document.activeElement) {
  if (dialog.open) return;
  dialogFocus.set(dialog, trigger);
  dialog.showModal();
  dialog.querySelector('[data-close-dialog]')?.focus();
  syncMotion();
}
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    stopLabMedia();
    const trigger = dialogFocus.get(dialog);
    if (trigger?.isConnected && (document.activeElement === document.body || dialog.contains(document.activeElement))) trigger.focus({ preventScroll: true });
    syncMotion();
  });
}
for (const button of document.querySelectorAll('[data-open-guide]')) button.addEventListener('click', () => openDialog($('#guideDialog'), button));
for (const button of document.querySelectorAll('[data-capture]')) button.addEventListener('click', () => {
  const moon = button.dataset.capture === 'moon';
  $('#fullCapture').src = asset(`art/website/${moon ? 'moonhaven' : 'board'}-current.webp`);
  $('#fullCapture').alt = moon ? 'The Heart, the current Moon community project in Constellore.' : 'The current Constellore board and its word controls.';
  $('#captureTitle').textContent = moon ? 'A heart for Moonhaven' : 'Your living constellation';
  $('#captureDescription').textContent = moon ? 'The Heart, captured from the current game with preview progression. Build Moonhaven through the Moon projects to reach this chapter.' : 'A capture from the current playable build. Start a game to combine, arrange, and explore your own ideas.';
  openDialog($('#captureDialog'), button);
});

function stopLabMedia() {
  $('#labAudio').pause();
  $('#frameVideo').pause();
  if ($('#labSoundButton')) $('#labSoundButton').firstChild.textContent = 'Listen to this world ';
}
async function loadLab() {
  if (!labCatalog) {
    const [cosmetics, frames] = await Promise.all([import(asset('cosmetic-catalog.mjs')), import(asset('profile-frame-catalog.mjs'))]);
    labCatalog = { collections: cosmetics.COSMETIC_COLLECTIONS, items: cosmetics.COSMETIC_ITEMS, frames: frames.PROFILE_FRAMES };
  }
  return labCatalog;
}
function fillLabOptions() {
  const select = $('#labSelect');
  select.replaceChildren();
  const entries = labKind === 'collections' ? labCatalog.collections : labCatalog.frames;
  for (const entry of entries) { const option = document.createElement('option'); option.value = entry.slug; option.textContent = entry.label || entry.name; select.append(option); }
  $('label[for="labSelect"]').textContent = labKind === 'collections' ? 'Choose a collection' : 'Choose a profile frame';
  $('.lab-surface').hidden = labKind !== 'collections';
}
async function renderLab() {
  if (!labCatalog) return;
  const renderId = ++labRenderId;
  stopLabMedia();
  const image = $('#labArtwork');
  const video = $('#frameVideo');
  video.hidden = true;
  video.removeAttribute('src');
  video.load();
  image.hidden = false;
  $('#labSoundButton').hidden = true;
  $('#labAudio').removeAttribute('src');
  $('#labAudio').load();
  $('.lab-art-stage').classList.toggle('is-frame', labKind === 'frames');
  const slug = $('#labSelect').value;
  if (labKind === 'frames') {
    const frame = labCatalog.frames.find((entry) => entry.slug === slug);
    if (!frame) return;
    image.src = asset(frame.art);
    image.alt = `${frame.name} profile frame artwork`;
    $('#labSelectionName').textContent = frame.name;
    $('#labDescription').textContent = frame.description;
    $('#labAccess').textContent = 'Profile frame preview. Availability is shown inside the game.';
    $('#labPreviewKind').textContent = frame.previewVideo ? 'ANIMATED FRAME PREVIEW' : frame.animated ? 'FRAME ARTWORK / ANIMATED IN GAME' : 'PROFILE FRAME ARTWORK';
    if (frame.previewVideo) {
      video.src = asset(frame.previewVideo);
      video.muted = true;
      video.loop = true;
      video.hidden = false;
      image.hidden = true;
      if (!motionPaused) video.play().catch(() => {});
    }
  } else {
    const collection = labCatalog.collections.find((entry) => entry.slug === slug);
    if (!collection) return;
    const item = labCatalog.items.find((entry) => entry.id === collection.preset[labSurface === 'gate' ? 'gateStyle' : 'homeScene']);
    const paths = item?.assets?.responsive;
    const source = paths?.md || paths?.lg || paths?.sm;
    if (!source) throw new Error('This collection has no preview artwork.');
    image.src = asset(source);
    image.alt = `${collection.label} ${labSurface === 'gate' ? 'Constellation Fold' : 'Home'} artwork`;
    $('#labSelectionName').textContent = collection.label;
    $('#labDescription').textContent = collection.description;
    $('#labAccess').textContent = collection.access === 'free' ? 'Included with Constellore.' : collection.purchaseOnly ? 'Preview only during beta. This collection is purchase-only; checkout is currently disabled.' : collection.rankUnlock ? `Earn through play at ${collection.rankUnlock.name} Route Rank. Purchases are disabled during beta.` : 'Preview available. Check the Cosmetic Lab in the game for availability.';
    $('#labPreviewKind').textContent = labSurface === 'gate' ? 'CONSTELLATION FOLD ARTWORK' : 'HOME ARTWORK';
    const sound = labCatalog.items.find((entry) => entry.id === collection.preset.soundTheme)?.assets?.soundtrack;
    if (sound?.path) { $('#labAudio').src = asset(sound.path); $('#labAudio').volume = .35; $('#labAudio').dataset.previewAt = String(sound.previewAt || 0); $('#labSoundButton').hidden = false; }
  }
  try { if (!image.hidden) await image.decode(); } catch { if (renderId === labRenderId) { $('#labError').textContent = 'This artwork could not load. Choose another preview or try again.'; $('#labError').hidden = false; } }
}
for (const button of document.querySelectorAll('[data-open-lab]')) button.addEventListener('click', async () => {
  openDialog($('#labDialog'), button);
  $('#labError').hidden = true;
  try { await loadLab(); fillLabOptions(); await renderLab(); }
  catch (error) { $('#labError').textContent = 'The Cosmetic Lab preview could not load. The full catalog is available inside the game.'; $('#labError').hidden = false; console.warn(error); }
});
$('#labSelect').addEventListener('change', () => { $('#labError').hidden = true; renderLab().catch(() => announce('Preview unavailable.')); });
for (const button of document.querySelectorAll('[data-lab-kind]')) button.addEventListener('click', () => {
  labKind = button.dataset.labKind;
  document.querySelectorAll('[data-lab-kind]').forEach((entry) => entry.setAttribute('aria-pressed', String(entry === button)));
  if (labCatalog) { fillLabOptions(); renderLab().catch(() => announce('Preview unavailable.')); }
});
for (const button of document.querySelectorAll('[data-lab-surface]')) button.addEventListener('click', () => {
  labSurface = button.dataset.labSurface;
  document.querySelectorAll('[data-lab-surface]').forEach((entry) => entry.setAttribute('aria-pressed', String(entry === button)));
  renderLab().catch(() => announce('Preview unavailable.'));
});
$('#labSoundButton').addEventListener('click', async () => {
  const player = $('#labAudio');
  if (!player.paused) { stopLabMedia(); return; }
  const start = () => { if (Number.isFinite(player.duration)) player.currentTime = Math.min(Number(player.dataset.previewAt), Math.max(0, player.duration - 1)); };
  if (player.readyState) start(); else player.addEventListener('loadedmetadata', start, { once: true });
  try { await player.play(); $('#labSoundButton').firstChild.textContent = 'Pause this soundscape '; }
  catch { announce('Audio could not play. Try again.'); }
});
$('#labAudio').addEventListener('ended', stopLabMedia);
window.addEventListener('pagehide', () => { atlasRequest++; atlasMountVersion++; atlas?.dispose(); atlas = null; atlasPromise = null; stopLabMedia(); });
window.addEventListener('pageshow', (event) => { if (event.persisted) selectChapter(currentChapter, { updateUrl: false }); });

document.documentElement.classList.add('js-ready');
selectChapter(location.hash.slice(1), { updateUrl: false });
syncMotion();
