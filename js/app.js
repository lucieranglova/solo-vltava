import { db, ensureAuth } from './firebase-init.js';
import {
  doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ====================== KONFIGURACE ====================== */
const STRAVA_CONNECT_FN_URL = "https://us-central1-solo-vltava.cloudfunctions.net/exchangeStravaCode";
const STRAVA_SYNC_FN_URL    = "https://us-central1-solo-vltava.cloudfunctions.net/syncStravaStats";
const STRAVA_CLIENT_ID      = "VLOZ_STRAVA_CLIENT_ID";
const STRAVA_REDIRECT_URI   = window.location.origin + window.location.pathname;

const VLTAVA_LENGTH_KM = 430;
const EVEREST_HEIGHT_M = 8849;

/* ====================== DATA LAYER ====================== */
const raceConfigRef = doc(db, 'raceConfig', 'main');
const statsRef = doc(db, 'performanceStats', 'main');

const RaceConfig = {
  async get() { const s = await getDoc(raceConfigRef); return s.exists() ? s.data() : null; },
  async set(data) { return setDoc(raceConfigRef, data, { merge: true }); }
};
const Stats = {
  async get() { const s = await getDoc(statsRef); return s.exists() ? s.data() : null; },
  async set(data) { return setDoc(statsRef, { ...data, lastUpdatedAt: new Date().toISOString() }, { merge: true }); }
};

const segmentsCol = collection(db, 'routeSegments');
const Segments = {
  async list() {
    const snap = await getDocs(query(segmentsCol, orderBy('orderIndex')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async add(data) { return addDoc(segmentsCol, data); },
  async update(id, data) { return updateDoc(doc(db, 'routeSegments', id), data); }
};

const checklistCatCol = collection(db, 'checklistCategories');
const checklistItemCol = collection(db, 'checklistItems');
const Checklist = {
  async listCategories(owner) {
    const snap = await getDocs(checklistCatCol);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.owner === owner);
  },
  async listItems(categoryId) {
    const snap = await getDocs(checklistItemCol);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.categoryId === categoryId);
  },
  async addCategory(data) { return addDoc(checklistCatCol, data); },
  async addItem(data) { return addDoc(checklistItemCol, data); },
  async toggleItem(id, checked) { return updateDoc(doc(db, 'checklistItems', id), { checked }); }
};

const contactsCol = collection(db, 'contacts');
const Contacts = {
  async list() { const snap = await getDocs(contactsCol); return snap.docs.map(d => ({ id: d.id, ...d.data() })); },
  async add(data) { return addDoc(contactsCol, data); }
};

/* ====================== UTILS ====================== */
function currentScene() {
  const h = new Date().getHours();
  if (h >= 5 && h < 10) return 'rano';
  if (h >= 10 && h < 17) return 'den';
  if (h >= 17 && h < 21) return 'soumrak';
  return 'noc';
}
function computePhase(raceDateStr) {
  if (!raceDateStr) return 'prep';
  const diffDays = (new Date(raceDateStr) - new Date()) / 86400000;
  if (diffDays > 30) return 'prep';
  if (diffDays > 0) return 'raceweek';
  if (diffDays > -1) return 'raceday';
  return 'post';
}
function applyScene() {
  const scene = currentScene();
  document.querySelectorAll('.app-bg [data-scene]').forEach(el => { el.hidden = el.dataset.scene !== scene; });
}
function applyTheme() {
  const saved = localStorage.getItem('sv-theme') || 'dark';
  document.body.classList.toggle('theme-light', saved === 'light');
  document.getElementById('theme-switch').classList.toggle('is-on', saved === 'light');
}
function toggleTheme() {
  const isLight = document.body.classList.contains('theme-light');
  localStorage.setItem('sv-theme', isLight ? 'dark' : 'light');
  applyTheme();
}
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('is-visible'), 2200);
}
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function countUp(el, target, duration = 1000) {
  const start = performance.now();
  const from = parseInt(el.textContent.replace(/\D/g, ''), 10) || 0;
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const val = Math.round(from + (target - from) * easeOutCubic(p));
    el.textContent = val.toLocaleString('cs-CZ');
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ====================== NAVIGACE ====================== */
const TAB_SCREENS = ['dashboard', 'vykony', 'trasa', 'organizace', 'galerie'];
const ALL_SCREENS = [...TAB_SCREENS, 'onboarding', 'segment', 'checklist', 'kontakty', 'kronika', 'nastaveni'];
const TITLES = {
  dashboard: 'Solo Vltava', vykony: 'Moje výkony', trasa: 'Trasa', organizace: 'Organizace',
  galerie: 'Galerie', segment: 'Detail úseku', checklist: 'Checklist', kontakty: 'Kontakty',
  kronika: 'Kronika', nastaveni: 'Nastavení', onboarding: 'Vítej'
};
let navStack = ['dashboard'];

function showScreen(id, opts = {}) {
  ALL_SCREENS.forEach(s => { const el = document.getElementById('screen-' + s); if (el) el.hidden = (s !== id); });
  document.querySelectorAll('.tabbar__item').forEach(el => el.classList.toggle('is-active', el.dataset.nav === id));
  document.getElementById('header-title').textContent = TITLES[id] || 'Solo Vltava';
  const isRoot = TAB_SCREENS.includes(id) || id === 'onboarding';
  document.getElementById('back-btn').classList.toggle('is-ghost', isRoot);
  document.getElementById('fab').hidden = !(id === 'trasa');
  if (!opts.skipStack) {
    if (TAB_SCREENS.includes(id)) navStack = [id];
    else navStack.push(id);
  }
  document.querySelector('main.app-main').scrollTo(0, 0);

  if (id === 'dashboard') renderDashboard();
  if (id === 'vykony') renderVykony();
  if (id === 'trasa') renderTrasa();
  if (id === 'checklist') renderChecklist();
  if (id === 'kontakty') renderContacts();
  if (id === 'kronika') renderKronika();
}
function goBack() {
  navStack.pop();
  showScreen(navStack[navStack.length - 1] || 'dashboard', { skipStack: true });
}

/* ====================== DASHBOARD ====================== */
async function renderDashboard() {
  const cfg = await RaceConfig.get();
  const stats = await Stats.get() || {};
  const segs = await Segments.list();
  const phase = computePhase(cfg?.raceDate);
  const tried = segs.filter(s => s.tried).length;

  if (cfg?.raceDate) {
    const days = Math.max(0, Math.ceil((new Date(cfg.raceDate) - new Date()) / 86400000));
    document.getElementById('dash-countdown').textContent = `${days} dní do startu`;
  }
  document.getElementById('dash-greeting').textContent = `Ahoj, ${cfg?.raceName || 'vítej zpět'}.`;
  document.getElementById('dash-km').textContent = (stats.totalKm || 0).toLocaleString('cs-CZ');
  document.getElementById('dash-elev').textContent = (stats.totalElevationM || 0).toLocaleString('cs-CZ');
  document.getElementById('dash-segments').textContent = `${tried}/${segs.length}`;
  document.getElementById('dash-trainings').textContent = stats.totalTrainings || 0;
  document.getElementById('dash-stats-meta').textContent = stats.source === 'strava' ? 'Synchronizováno se Strava' : 'Zadáno ručně';

  const clCard = document.getElementById('dash-checklist-card');
  if (phase === 'raceweek' || phase === 'raceday') {
    clCard.hidden = false;
    const runnerItems = await itemsForOwner('runner');
    const supportItems = await itemsForOwner('support');
    setProgress('dash-cl-runner', runnerItems);
    setProgress('dash-cl-support', supportItems);
  } else {
    clCard.hidden = true;
  }

  if (phase === 'post') showScreen('kronika', { skipStack: true });
}
async function itemsForOwner(owner) {
  const cats = await Checklist.listCategories(owner);
  let all = [];
  for (const c of cats) all = all.concat(await Checklist.listItems(c.id));
  return all;
}
function setProgress(prefix, items) {
  const pct = items.length ? Math.round(items.filter(i => i.checked).length / items.length * 100) : 0;
  document.getElementById(prefix).textContent = pct + ' %';
  document.getElementById(prefix + '-bar').style.width = pct + '%';
}

/* ====================== MOJE VÝKONY ====================== */
let flipped = false;
async function renderVykony() {
  const stats = await Stats.get() || { totalKm: 0, totalElevationM: 0, totalTrainings: 0 };

  document.getElementById('numKm').dataset.target = stats.totalKm || 0;
  document.getElementById('numElev').dataset.target = stats.totalElevationM || 0;
  document.getElementById('numTrainings').textContent = stats.totalTrainings || 0;

  document.getElementById('factKm').textContent = `≈ ${((stats.totalKm || 0) / VLTAVA_LENGTH_KM).toFixed(1)}× délka Vltavy`;
  document.getElementById('factElev').textContent = `≈ ${((stats.totalElevationM || 0) / EVEREST_HEIGHT_M).toFixed(1)}× výška Mount Everestu`;

  const lastSync = stats.lastUpdatedAt
    ? new Date(stats.lastUpdatedAt).toLocaleString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
    : null;
  document.getElementById('sync-label').textContent = stats.source === 'strava'
    ? `Strava · ${lastSync}`
    : 'Strava · nepřipojeno';

  animateFace('front');
  if (flipped) animateFace('back');
}
function animateFace(face) {
  const root = document.querySelector('.stat-face--' + face);
  if (!root) return;
  const num = root.querySelector('.stat-face__num');
  countUp(num, parseInt(num.dataset.target, 10));
  const fillRect = root.querySelector('.fill-rect');
  requestAnimationFrame(() => { fillRect.style.transform = 'scaleY(1)'; });
}
function doFlip() {
  flipped = !flipped;
  document.getElementById('flipInner').classList.toggle('is-flipped', flipped);
  document.querySelectorAll('#dots span').forEach((d, i) => d.classList.toggle('is-active', (i === 1) === flipped));
  animateFace(flipped ? 'back' : 'front');
}

async function syncStrava() {
  const btn = document.getElementById('syncBtn');
  if (btn.classList.contains('is-syncing')) return;
  btn.classList.add('is-syncing');
  document.getElementById('sync-label').textContent = 'Synchronizace…';
  try {
    const resp = await fetch(STRAVA_SYNC_FN_URL, { method: 'POST' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    await Stats.set({ totalKm: data.totalKm, totalElevationM: data.totalElevationM, totalTrainings: data.totalTrainings, source: 'strava' });
    toast('Synchronizováno ze Strava ✓');
    renderVykony();
  } catch (e) {
    toast('Chyba: ' + e.message);
  } finally {
    btn.classList.remove('is-syncing');
  }
}

/* ====================== TRASA ====================== */
let currentSegmentData = null;
async function renderTrasa() {
  const segs = await Segments.list();
  const tried = segs.filter(s => s.tried).length;
  document.getElementById('trasa-summary').textContent = `${tried}/${segs.length} úseků vyzkoušeno`;
  const list = document.getElementById('trasa-list');
  list.innerHTML = '';
  if (!segs.length) {
    list.innerHTML = '<div class="empty-state">Žádné úseky. Klikni + pro přidání.</div>';
    return;
  }
  segs.forEach(seg => {
    const el = document.createElement('div');
    el.className = 'card is-clickable';
    const iconStyle = seg.tried ? 'background:var(--accent-soft);color:var(--accent)' : '';
    el.innerHTML = `
      <div class="card__icon" style="${iconStyle}"><svg class="icon"><use href="#i-mountain"/></svg></div>
      <div class="card__body">
        <div class="card__title">${seg.name}</div>
        <div class="card__meta">${seg.distanceKm ? seg.distanceKm + ' km' : '—'}${seg.elevationM ? ' · ' + seg.elevationM + ' m' : ''}${seg.tried ? ' · ✓ vyzkoušeno' : ''}</div>
      </div>
      <svg class="icon" style="color:var(--chrome-text-faint)"><use href="#i-chevron-right"/></svg>`;
    el.addEventListener('click', () => {
      currentSegmentData = seg;
      showScreen('segment');
      renderSegment(seg);
    });
    list.appendChild(el);
  });
}

function renderSegment(seg) {
  const detail = document.getElementById('segment-detail');
  const dots = [1, 2, 3, 4, 5].map(i =>
    `<span class="${i <= (seg.difficulty || 0) ? 'is-filled' : ''}"></span>`
  ).join('');
  detail.innerHTML = `
    <div class="elevation-card">
      <svg viewBox="0 0 300 84" preserveAspectRatio="none">
        <path d="M0,80 L60,40 L110,60 L160,10 L220,50 L280,25 L300,50 L300,84 L0,84 Z"
          fill="rgba(43,196,176,0.18)" stroke="var(--accent)" stroke-width="1.5"/>
      </svg>
    </div>
    <div class="stats-row">
      <div class="stat-box"><div class="stat-box__label">Délka</div><div class="stat-box__value">${seg.distanceKm || '—'} km</div></div>
      <div class="stat-box"><div class="stat-box__label">Převýšení</div><div class="stat-box__value">${seg.elevationM || '—'} m</div></div>
      <div class="stat-box"><div class="stat-box__label">Obtížnost</div><div class="difficulty-dots">${dots}</div></div>
    </div>
    ${seg.notes ? `<div class="note-block">${seg.notes}</div>` : ''}
    <button class="cta-button${seg.tried ? ' is-secondary' : ''}" id="seg-tried-btn">
      ${seg.tried ? '✓ Označeno jako vyzkoušeno' : 'Označit jako vyzkoušeno'}
    </button>`;
  document.getElementById('seg-tried-btn').addEventListener('click', async () => {
    const newVal = !seg.tried;
    await Segments.update(seg.id, { tried: newVal });
    toast(newVal ? 'Úsek označen jako vyzkoušený ✓' : 'Úsek odznačen');
    seg.tried = newVal;
    renderSegment(seg);
    renderTrasa();
  });
}

/* ====================== CHECKLIST ====================== */
let checklistOwner = 'runner';
async function renderChecklist() {
  const content = document.getElementById('checklist-content');
  content.innerHTML = '';
  const cats = await Checklist.listCategories(checklistOwner);
  if (!cats.length) {
    content.innerHTML = '<div class="empty-state">Zatím žádné kategorie.</div>';
    return;
  }
  for (const cat of cats) {
    const items = await Checklist.listItems(cat.id);
    const checkedCount = items.filter(i => i.checked).length;
    const catEl = document.createElement('div');
    catEl.className = 'category';
    const head = document.createElement('div');
    head.className = 'category__head';
    head.innerHTML = `<span>${cat.name}</span><span class="count">${checkedCount}/${items.length}</span>`;
    catEl.appendChild(head);
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'check-item' + (item.checked ? ' is-checked' : '');
      row.innerHTML = `
        <div class="check-item__box${item.checked ? ' is-checked' : ''}">
          ${item.checked ? `<svg class="icon" width="12" height="12"><use href="#i-check"/></svg>` : ''}
        </div>
        <span class="check-item__text">${item.name}</span>`;
      row.addEventListener('click', async () => {
        await Checklist.toggleItem(item.id, !item.checked);
        renderChecklist();
      });
      catEl.appendChild(row);
    });
    content.appendChild(catEl);
  }
}

/* ====================== KONTAKTY ====================== */
async function renderContacts() {
  const list = document.getElementById('contacts-list');
  list.innerHTML = '';
  const contacts = await Contacts.list();
  if (!contacts.length) {
    list.innerHTML = '<div class="empty-state">Žádné kontakty.</div>';
    return;
  }
  contacts.forEach(c => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <div class="card__icon" style="background:var(--warm-soft);color:var(--warm)"><svg class="icon"><use href="#i-pin"/></svg></div>
      <div class="card__body"><div class="card__title">${c.name}</div><div class="card__meta">${c.phone || ''}</div></div>
      ${c.phone ? `<a href="tel:${c.phone}" class="chip is-primary">Volat</a>` : ''}`;
    list.appendChild(el);
  });
}

/* ====================== KRONIKA ====================== */
async function renderKronika() {
  const stats = await Stats.get() || {};
  document.getElementById('kr-km').textContent = (stats.totalKm || 0).toLocaleString('cs-CZ');
  document.getElementById('kr-trainings').textContent = stats.totalTrainings || 0;
}

/* ====================== STRAVA ====================== */
function connectStrava() {
  const url = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}&response_type=code&scope=activity:read_all`;
  window.location.href = url;
}

async function handleStravaCallback(code) {
  toast('Připojuji Strava…');
  try {
    const resp = await fetch(STRAVA_CONNECT_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    if (data.totalKm !== undefined) {
      await Stats.set({ totalKm: data.totalKm, totalElevationM: data.totalElevationM, totalTrainings: data.totalTrainings, source: 'strava' });
    }
    toast('Strava připojena ✓');
  } catch (e) {
    toast('Chyba připojení Strava: ' + e.message);
  }
}

/* ====================== INIT ====================== */
async function init() {
  applyScene();
  applyTheme();
  setInterval(applyScene, 10 * 60 * 1000);

  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => showScreen(el.dataset.nav));
  });
  document.querySelectorAll('[data-go]').forEach(el => {
    el.addEventListener('click', () => showScreen(el.dataset.go));
  });

  document.getElementById('back-btn').addEventListener('click', goBack);
  document.getElementById('settings-btn').addEventListener('click', () => showScreen('nastaveni'));
  document.getElementById('theme-switch').addEventListener('click', toggleTheme);

  document.getElementById('arrowLeft').addEventListener('click', () => { if (flipped) doFlip(); });
  document.getElementById('arrowRight').addEventListener('click', () => { if (!flipped) doFlip(); });
  document.querySelectorAll('#dots span').forEach((d, i) => {
    d.addEventListener('click', () => { if ((i === 1) !== flipped) doFlip(); });
  });
  let touchStartX = 0;
  const flipCard = document.getElementById('statFlip');
  flipCard.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  flipCard.addEventListener('touchend', e => {
    if (Math.abs(e.changedTouches[0].clientX - touchStartX) > 40) doFlip();
  });

  document.getElementById('syncBtn').addEventListener('click', syncStrava);

  document.getElementById('editKmRow').addEventListener('click', async () => {
    const val = prompt('Celkové km (naběháno):');
    if (val === null) return;
    const km = parseFloat(val.replace(',', '.'));
    if (isNaN(km)) return toast('Neplatná hodnota');
    await Stats.set({ totalKm: km, source: 'manual' });
    toast('Uloženo ✓');
    renderVykony();
  });
  document.getElementById('editTrainingsRow').addEventListener('click', async () => {
    const val = prompt('Počet tréninků:');
    if (val === null) return;
    const n = parseInt(val, 10);
    if (isNaN(n)) return toast('Neplatná hodnota');
    await Stats.set({ totalTrainings: n });
    toast('Uloženo ✓');
    renderVykony();
  });

  document.getElementById('stravaConnectBtn').addEventListener('click', connectStrava);

  document.getElementById('fab').addEventListener('click', async () => {
    const name = prompt('Název nového úseku:');
    if (!name) return;
    const km = parseFloat(prompt('Délka (km):') || '0');
    const elev = parseInt(prompt('Převýšení (m):') || '0', 10);
    const segs = await Segments.list();
    await Segments.add({ name, distanceKm: km, elevationM: elev, difficulty: 3, tried: false, orderIndex: segs.length });
    toast('Úsek přidán ✓');
    renderTrasa();
  });

  document.querySelectorAll('#checklist-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      checklistOwner = btn.dataset.owner;
      document.querySelectorAll('#checklist-tabs button').forEach(b => b.classList.toggle('is-active', b === btn));
      renderChecklist();
    });
  });

  document.getElementById('addChecklistItemBtn').addEventListener('click', async () => {
    const itemName = prompt('Název položky:');
    if (!itemName) return;
    let cats = await Checklist.listCategories(checklistOwner);
    let catId = cats[cats.length - 1]?.id;
    if (!catId) {
      const catName = prompt('Název kategorie (první položka):') || 'Obecné';
      const ref = await Checklist.addCategory({ name: catName, owner: checklistOwner, orderIndex: 0 });
      catId = ref.id;
    }
    await Checklist.addItem({ name: itemName, categoryId: catId, checked: false });
    toast('Položka přidána ✓');
    renderChecklist();
  });

  document.getElementById('addContactBtn').addEventListener('click', async () => {
    const name = prompt('Jméno:');
    if (!name) return;
    const phone = prompt('Telefon:') || '';
    await Contacts.add({ name, phone });
    toast('Kontakt přidán ✓');
    renderContacts();
  });

  // Onboarding nebo rovnou dashboard
  const cfg = await RaceConfig.get();
  if (!cfg) {
    document.querySelector('.tabbar').hidden = true;
    document.getElementById('fab').hidden = true;
    showScreen('onboarding', { skipStack: true });
    document.getElementById('ob-submit').addEventListener('click', async () => {
      const name = document.getElementById('ob-name').value.trim();
      const date = document.getElementById('ob-date').value;
      const location = document.getElementById('ob-location').value.trim();
      const targetKm = parseFloat(document.getElementById('ob-target-km').value) || 1500;
      const targetElev = parseFloat(document.getElementById('ob-target-elev').value) || 40000;
      if (!date) return toast('Zadej datum závodu');
      await RaceConfig.set({ raceName: name, raceDate: date, raceLocation: location, targetDistanceKm: targetKm, targetElevationM: targetElev });
      document.querySelector('.tabbar').hidden = false;
      showScreen('dashboard');
    });
  } else {
    showScreen('dashboard');
  }

  // Strava OAuth callback
  const params = new URLSearchParams(window.location.search);
  if (params.get('code')) {
    await handleStravaCallback(params.get('code'));
    window.history.replaceState({}, '', window.location.pathname);
  }
}

ensureAuth().then(init).catch(err => {
  document.body.innerHTML = `<div style="padding:32px;color:#fff;font-family:sans-serif;font-size:14px">
    Chyba Firebase: ${err.message}
  </div>`;
});
