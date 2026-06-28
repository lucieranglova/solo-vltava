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

/* ====================== MAPA — geometrie ====================== */
const MAP_VB_W = 340, MAP_VB_H = 1500, MAP_TOPPAD = 70, MAP_BOTPAD = 70;
const MAP_CENTERX = 170, MAP_AMP = 78, MAP_FREQ = 4.6;

function mapCoord(progress) {
  const usableH = MAP_VB_H - MAP_TOPPAD - MAP_BOTPAD;
  const y = MAP_TOPPAD + (1 - progress) * usableH;
  const x = MAP_CENTERX + MAP_AMP * Math.sin(progress * MAP_FREQ * 2 * Math.PI);
  return { x, y };
}
function estTextWidth(text, fontSize) { return text.length * fontSize * 0.56; }
function clampTextX(x, anchor, width, margin = 8) {
  if (anchor === 'start') { x = Math.min(x, MAP_VB_W - margin - width); x = Math.max(x, margin); }
  else { x = Math.max(x, margin + width); x = Math.min(x, MAP_VB_W - margin); }
  return x;
}
function escapeXml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function buildRouteSvg(segments) {
  if (!segments.length) {
    return '<text x="170" y="750" text-anchor="middle" fill="#fff" font-family="Nunito" font-size="14">Zatím žádné úseky — klikni na +</text>';
  }
  const totalKm = segments.reduce((s, seg) => s + (Number(seg.distanceKm) || 0), 0) || 1;
  let cum = 0;
  const points = segments.map(seg => {
    cum += Number(seg.distanceKm) || 0;
    const progress = cum / totalKm;
    const { x, y } = mapCoord(progress);
    return { ...seg, x, y, progress };
  });
  const s0 = mapCoord(0);
  const allPts = [{ x: s0.x, y: s0.y, name: null, tried: points[0]?.tried, isEnd: true, id: null }, ...points];
  allPts[allPts.length - 1].isEnd = true;

  function crCubic(p0, p1, p2, p3) {
    return {
      cp1x: p1.x + (p2.x - p0.x) / 6, cp1y: p1.y + (p2.y - p0.y) / 6,
      cp2x: p2.x - (p3.x - p1.x) / 6, cp2y: p2.y - (p3.y - p1.y) / 6,
    };
  }

  const pathParts = [];
  for (let i = 0; i < allPts.length - 1; i++) {
    const p0 = allPts[i - 1] || allPts[i];
    const p1 = allPts[i];
    const p2 = allPts[i + 1];
    const p3 = allPts[i + 2] || allPts[i + 1];
    const { cp1x, cp1y, cp2x, cp2y } = crCubic(p0, p1, p2, p3);
    pathParts.push({
      d: `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`,
      tried: !!p2.tried,
    });
  }

  let svg = '';
  // Řeka — tmavý okraj
  pathParts.forEach(seg => {
    svg += `<path d="${seg.d}" fill="none" stroke="#1A6090" stroke-width="46" stroke-linecap="round"/>`;
  });
  // Řeka — hlavní voda
  pathParts.forEach(seg => {
    svg += `<path d="${seg.d}" fill="none" stroke="#3A9CC8" stroke-width="36" stroke-linecap="round"/>`;
  });
  // Řeka — světlejší vnitřek
  pathParts.forEach(seg => {
    svg += `<path d="${seg.d}" fill="none" stroke="#5ABCE4" stroke-width="24" stroke-linecap="round" opacity="0.7"/>`;
  });
  // Řeka — odlesk
  pathParts.forEach(seg => {
    svg += `<path d="${seg.d}" fill="none" stroke="#9AD8F4" stroke-width="7" stroke-linecap="round" opacity="0.22" stroke-dasharray="16 10"/>`;
  });
  // Travnatý břeh
  pathParts.forEach(seg => {
    svg += `<path d="${seg.d}" fill="none" stroke="#1C6A1E" stroke-width="22" stroke-linecap="round"/>`;
  });
  // Štěrková cesta — okraj (tmavší)
  pathParts.forEach(seg => {
    const col = seg.tried ? '#8A6A28' : '#5A5040';
    svg += `<path d="${seg.d}" fill="none" stroke="${col}" stroke-width="15" stroke-linecap="round"/>`;
  });
  // Štěrková cesta — plocha
  pathParts.forEach(seg => {
    const col = seg.tried ? '#C8A450' : '#7A6A4A';
    svg += `<path d="${seg.d}" fill="none" stroke="${col}" stroke-width="11" stroke-linecap="round"/>`;
  });
  // Štěrková cesta — střední odlesk
  pathParts.forEach(seg => {
    const col = seg.tried ? '#D8B86A' : '#8A7A58';
    svg += `<path d="${seg.d}" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round" opacity="0.6"/>`;
  });
  // Vyzkoušené úseky — tyrkysový pruh (stopa běžce)
  pathParts.forEach(seg => {
    if (!seg.tried) return;
    svg += `<path d="${seg.d}" fill="none" stroke="#2BC4B0" stroke-width="3" stroke-linecap="round" stroke-dasharray="9 5" opacity="0.9"/>`;
  });
  // Kroužek N = start segmentu N; tried barva a klik odpovídají segmentu startujícímu z bodu
  allPts.forEach((pt, idx) => {
    const label = String(idx + 1);
    const r = label.length > 1 ? 14 : 12;
    const tried = !!(allPts[idx + 1]?.tried);
    const cx = pt.x.toFixed(1), cy = pt.y.toFixed(1);
    svg += `<circle cx="${cx}" cy="${cy}" r="${r + 2.5}" fill="rgba(0,0,0,0.38)"/>`;
    const fill = tried ? '#2BC4B0' : 'rgba(255,255,255,0.97)';
    const stroke = tried ? '#1A9C8C' : '#2A3A70';
    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
    const textFill = tried ? '#fff' : '#1A2050';
    const fsize = label.length > 1 ? 9 : 10;
    svg += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="Baloo 2" font-weight="800" font-size="${fsize}" fill="${textFill}">${label}</text>`;
  });
  // Klikací plochy — kroužek N otevírá segment N (allPts[idx+1].id)
  allPts.forEach((pt, idx) => {
    const nextId = allPts[idx + 1]?.id;
    if (!nextId) return;
    svg += `<circle class="map-hit" data-id="${nextId}" cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="20" fill="transparent"/>`;
  });
  return svg;
}

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
  const topColors = {rano:'#FFD9A8', den:'#6EC6E0', soumrak:'#262460', noc:'#0E1026'};
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = topColors[scene] || '#13162B';
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
function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ====================== NAVIGACE ====================== */
const TAB_SCREENS = ['dashboard', 'seznam', 'trasa', 'organizace'];
const ALL_SCREENS = [...TAB_SCREENS, 'onboarding', 'segment', 'checklist', 'kontakty', 'kronika', 'nastaveni'];
const TITLES = {
  dashboard: 'Solo Vltava', seznam: 'Úseky', trasa: 'Trasa', organizace: 'Organizace',
  segment: 'Detail úseku', checklist: 'Checklist', kontakty: 'Kontakty',
  kronika: 'Kronika', nastaveni: 'Nastavení', onboarding: 'Vítej'
};
let navStack = ['dashboard'];

function showScreen(id, opts = {}) {
  if (id !== 'trasa') document.querySelector('main.app-main').scrollTo(0, 0);

  ALL_SCREENS.forEach(s => { const el = document.getElementById('screen-' + s); if (el) el.hidden = (s !== id); });
  document.querySelectorAll('.tabbar__item').forEach(el => el.classList.toggle('is-active', el.dataset.nav === id));

  document.querySelector('.app-header').hidden = (id === 'trasa');

  const isRoot = TAB_SCREENS.includes(id) || id === 'onboarding';
  document.getElementById('back-btn').hidden = isRoot;
  document.getElementById('header-title').textContent = TITLES[id] || 'Solo Vltava';
  document.getElementById('fab').hidden = (id !== 'trasa');

  if (!opts.skipStack) {
    if (TAB_SCREENS.includes(id)) navStack = [id];
    else navStack.push(id);
  }

  if (id === 'dashboard') renderDashboard();
  if (id === 'seznam') renderSeznam();
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

  const name = cfg?.runnerName || 'Vojtí';
  document.getElementById('dash-greeting').textContent = `Ahoj, ${name}!`;

  if (cfg?.raceDate) {
    const days = Math.max(0, Math.ceil((new Date(cfg.raceDate) - new Date()) / 86400000));
    document.getElementById('dash-countdown').textContent = `${days} dní do startu`;
  }

  renderVykony();

  if (computePhase(cfg?.raceDate) === 'post') showScreen('kronika', { skipStack: true });
}

function updateVltavaMap(segments) {
  const coveredKm = segments.filter(s => s.tried).reduce((sum, s) => sum + (Number(s.distanceKm) || 0), 0);
  const pct = Math.min(1, coveredKm / VLTAVA_LENGTH_KM);

  const progressPath = document.getElementById('river-progress');
  if (!progressPath) return;

  const pctEl = document.getElementById('dash-route-pct');
  if (pctEl) pctEl.textContent = Math.round(pct * 100);

  requestAnimationFrame(() => {
    const len = progressPath.getTotalLength();
    progressPath.style.strokeDasharray = len;
    progressPath.style.strokeDashoffset = len * (1 - pct);
  });

  document.querySelectorAll('.river-waypoint').forEach(dot => {
    const order = parseInt(dot.dataset.order, 10);
    dot.style.fill = order / 12 <= pct ? 'var(--accent)' : 'rgba(247,248,252,0.35)';
  });
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
    renderDashboard();
  } catch (e) {
    toast('Chyba: ' + e.message);
  } finally {
    btn.classList.remove('is-syncing');
  }
}

/* ====================== TRASA (mapa) ====================== */
async function renderTrasa() {
  const segs = await Segments.list();
  const tried = segs.filter(s => s.tried).length;
  document.getElementById('trasaCount').textContent = `${tried} / ${segs.length} úseků`;
  document.getElementById('trasaOverlay').innerHTML = buildRouteSvg(segs);
}

async function renderSeznam() {
  const segs = await Segments.list();
  const el = document.getElementById('seznam-list');
  if (!segs.length) {
    el.innerHTML = '<div class="empty-state">Žádné úseky ještě nejsou přidány.</div>';
    return;
  }
  el.innerHTML = segs.map((seg, i) => `
    <div class="seg-row" data-id="${escHtml(seg.id)}">
      <div class="seg-num${seg.tried ? ' is-tried' : ''}">${i + 1}</div>
      <div class="seg-info">
        <div class="seg-name">${escHtml(seg.name)}</div>
        <div class="seg-meta">${seg.distanceKm} km · +${seg.elevationGainM || 0} m</div>
      </div>
      <svg class="icon" style="flex-shrink:0;color:var(--chrome-text-faint)"><use href="#i-chevron-right"/></svg>
    </div>`).join('');
  el.querySelectorAll('.seg-row').forEach(row => {
    row.addEventListener('click', () => openSegment(row.dataset.id));
  });
}

async function addSegmentPrompt() {
  const name = prompt('Název úseku:');
  if (!name) return;
  const distanceKm = Number(prompt('Délka (km):', 10)) || 0;
  const segs = await Segments.list();
  await Segments.add({ name, distanceKm, elevationGainM: 0, elevationLossM: 0, difficulty: 3, tried: false, notes: '', orderIndex: segs.length });
  toast('Úsek přidán ✓');
  renderTrasa();
}

async function openSegment(id) {
  const segs = await Segments.list();
  const seg = segs.find(s => s.id === id);
  if (!seg) return;
  showScreen('segment');
  const el = document.getElementById('segment-detail');
  el.innerHTML = `
    <div class="section-title">${escHtml(seg.name)}</div>
    <div class="stats-row">
      <div class="stat-box"><div class="stat-box__label">Délka</div><div class="stat-box__value">${seg.distanceKm} km</div></div>
      <div class="stat-box"><div class="stat-box__label">Převýšení</div><div class="stat-box__value">+${seg.elevationGainM || seg.elevationM || 0} m</div></div>
      <div class="stat-box"><div class="stat-box__label">Obtížnost</div><div class="stat-box__value">${seg.difficulty || 0}/5</div></div>
    </div>
    <div class="toggle-card">
      <div><div class="toggle-card__label">Vyzkoušeno</div><div class="toggle-card__sub" id="seg-tried-date">${seg.triedDate || 'zatím ne'}</div></div>
      <div class="switch${seg.tried ? ' is-on' : ''}" id="seg-toggle"></div>
    </div>
    <div class="field"><label>Poznámky</label><textarea id="seg-notes" rows="5">${escHtml(seg.notes || '')}</textarea></div>
    <button class="cta-button is-secondary" id="seg-save">Uložit poznámky</button>`;

  document.getElementById('seg-toggle').addEventListener('click', async e => {
    const newVal = !seg.tried;
    e.currentTarget.classList.toggle('is-on', newVal);
    const date = newVal ? new Date().toLocaleDateString('cs-CZ') : null;
    await Segments.update(id, { tried: newVal, triedDate: date });
    document.getElementById('seg-tried-date').textContent = date || 'zatím ne';
    seg.tried = newVal;
    seg.triedDate = date;
  });

  document.getElementById('seg-save').addEventListener('click', async () => {
    const notes = document.getElementById('seg-notes').value;
    await Segments.update(id, { notes });
    seg.notes = notes;
    toast('Poznámky uloženy ✓');
  });
}

/* ====================== CHECKLIST ====================== */
let checklistOwner = 'runner';
async function renderChecklist() {
  const content = document.getElementById('checklist-content');
  content.innerHTML = '';
  const cats = await Checklist.listCategories(checklistOwner);
  if (!cats.length) {
    content.innerHTML = '<div class="empty-state">Žádné kategorie. Přidej první položku tlačítkem níže.</div>';
    return;
  }
  for (const cat of cats) {
    const items = await Checklist.listItems(cat.id);
    const checkedCount = items.filter(i => i.checked).length;
    const catEl = document.createElement('div');
    catEl.className = 'category';
    const head = document.createElement('div');
    head.className = 'category__head';
    head.innerHTML = `<span>${escHtml(cat.name)}</span><span class="count">${checkedCount}/${items.length}</span>`;
    catEl.appendChild(head);
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'check-item' + (item.checked ? ' is-checked' : '');
      row.innerHTML = `
        <div class="check-item__box${item.checked ? ' is-checked' : ''}">
          ${item.checked ? `<svg class="icon" width="12" height="12"><use href="#i-check"/></svg>` : ''}
        </div>
        <span class="check-item__text">${escHtml(item.name)}</span>`;
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
      <div class="card__body"><div class="card__title">${escHtml(c.name)}</div><div class="card__meta">${escHtml(c.phone || '')}</div></div>
      ${c.phone ? `<a href="tel:${escHtml(c.phone)}" class="chip is-primary">Volat</a>` : ''}`;
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
    toast('Chyba: ' + e.message);
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
  document.getElementById('fab').addEventListener('click', addSegmentPrompt);

  document.getElementById('trasaOverlay')?.addEventListener('click', e => {
    const hit = e.target.closest('.map-hit');
    if (hit?.dataset.id) openSegment(hit.dataset.id);
  });

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
  document.getElementById('stravaConnectBtn').addEventListener('click', connectStrava);

  document.getElementById('editKmRow').addEventListener('click', async () => {
    const val = prompt('Celkové km (naběháno):');
    if (val === null) return;
    const km = parseFloat(val.replace(',', '.'));
    if (isNaN(km)) return toast('Neplatná hodnota');
    await Stats.set({ totalKm: km, source: 'manual' });
    toast('Uloženo ✓');
    renderDashboard();
  });
  document.getElementById('editElevBtn').addEventListener('click', async () => {
    const val = prompt('Celkové nastoupáno (m):');
    if (val === null) return;
    const m = parseFloat(val.replace(',', '.'));
    if (isNaN(m)) return toast('Neplatná hodnota');
    await Stats.set({ totalElevationM: m, source: 'manual' });
    toast('Uloženo ✓');
    renderDashboard();
  });
  document.getElementById('editTrainingsRow').addEventListener('click', async () => {
    const val = prompt('Počet tréninků:');
    if (val === null) return;
    const n = parseInt(val, 10);
    if (isNaN(n)) return toast('Neplatná hodnota');
    await Stats.set({ totalTrainings: n });
    toast('Uloženo ✓');
    renderDashboard();
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
      const catName = prompt('Název kategorie:') || 'Obecné';
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

  // Onboarding nebo dashboard
  const cfg = await RaceConfig.get();
  if (!cfg) {
    document.querySelector('.tabbar').hidden = true;
    document.getElementById('fab').hidden = true;
    showScreen('onboarding', { skipStack: true });
    document.getElementById('ob-submit').addEventListener('click', async () => {
      const runnerName = document.getElementById('ob-runner').value.trim() || 'Vojtí';
      const name = document.getElementById('ob-name').value.trim();
      const date = document.getElementById('ob-date').value;
      const location = document.getElementById('ob-location').value.trim();
      const targetKm = parseFloat(document.getElementById('ob-target-km').value) || 1500;
      const targetElev = parseFloat(document.getElementById('ob-target-elev').value) || 40000;
      if (!date) return toast('Zadej datum závodu');
      await RaceConfig.set({ runnerName, raceName: name, raceDate: date, raceLocation: location, targetDistanceKm: targetKm, targetElevationM: targetElev });
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
