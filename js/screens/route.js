import { listenSegments, addSegment } from '../firestore.js';
import { navigateTo } from '../router.js';
import { openModal, closeModal } from '../router.js';

let _unsubSegments = null;
let _allSegments = [];
let _activeFilter = 'all';

export function initRoute() {
  if (_unsubSegments) { _unsubSegments(); _unsubSegments = null; }

  _unsubSegments = listenSegments(segments => {
    _allSegments = segments;
    renderSegments();
    updateRouteStats(segments);
  });

  // Add segment button
  const addBtn = document.getElementById('add-segment-btn');
  if (addBtn) addBtn.onclick = () => openModal('add-segment-modal');

  // Filter pills
  document.querySelectorAll('#screen-route .filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#screen-route .filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      _activeFilter = pill.dataset.filter;
      renderSegments();
    });
  });

  // Add segment form
  const form = document.getElementById('add-segment-form');
  if (form) {
    form.onsubmit = handleAddSegment;
  }
}

async function handleAddSegment(e) {
  e.preventDefault();
  const btn = e.target.querySelector('[type="submit"]');
  btn.disabled = true;

  try {
    await addSegment({
      name: document.getElementById('seg-name').value.trim(),
      distanceKm: parseFloat(document.getElementById('seg-distance').value) || 0,
      elevationGainM: parseFloat(document.getElementById('seg-elev-gain').value) || 0,
      elevationLossM: parseFloat(document.getElementById('seg-elev-loss').value) || 0,
      difficulty: parseInt(document.getElementById('seg-difficulty').value) || 3,
      surfaceType: document.getElementById('seg-surface').value,
      notes: document.getElementById('seg-notes').value.trim()
    });
    e.target.reset();
    closeModal('add-segment-modal');
    window.showToast('Úsek přidán!', 'success');
  } catch (err) {
    window.showToast('Chyba: ' + err.message, 'error');
    btn.disabled = false;
  }
}

function renderSegments() {
  const list = document.getElementById('segments-list');
  const empty = document.getElementById('segments-empty');
  if (!list) return;

  let filtered = _allSegments;
  if (_activeFilter === 'tried') filtered = filtered.filter(s => s.tried);
  if (_activeFilter === 'untried') filtered = filtered.filter(s => !s.tried);

  // Clear existing cards (not the empty state)
  list.querySelectorAll('.segment-card').forEach(el => el.remove());

  if (filtered.length === 0) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  filtered.forEach(seg => {
    const card = createSegmentCard(seg);
    list.appendChild(card);
  });
}

function createSegmentCard(seg) {
  const card = document.createElement('div');
  card.className = `segment-card${seg.tried ? ' tried' : ''}`;
  card.dataset.id = seg.id;

  const surfaceLabels = { trail: 'Trail', road: 'Silnice', gravel: 'Gravel', mixed: 'Smíšený' };

  card.innerHTML = `
    <div class="segment-tried-dot"></div>
    <div class="segment-info">
      <div class="segment-name">${escHtml(seg.name)}</div>
      <div class="segment-meta">${seg.distanceKm || 0} km · +${seg.elevationGainM || 0}m · ${surfaceLabels[seg.surfaceType] || 'Trail'}</div>
    </div>
    <div class="difficulty-dots">${difficultyDots(seg.difficulty)}</div>
    <div class="segment-chevron"><svg><use href="#icon-chevron-right"/></svg></div>
  `;

  card.addEventListener('click', () => {
    navigateTo('segment-detail', { segment: seg });
  });

  return card;
}

function difficultyDots(level = 3) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<div class="diff-dot${i <= level ? ' filled' : ''}"></div>`;
  }
  return html;
}

function updateRouteStats(segments) {
  const totalEl = document.getElementById('route-stat-total');
  const triedEl = document.getElementById('route-stat-tried');
  const ringEl = document.getElementById('route-ring');
  const ringPctEl = document.getElementById('route-ring-pct');

  const total = segments.length;
  const tried = segments.filter(s => s.tried).length;
  const pct = total > 0 ? (tried / total) : 0;

  if (totalEl) totalEl.textContent = total;
  if (triedEl) triedEl.textContent = tried;

  // Ring: circumference of circle r=24 = 2π*24 ≈ 150.8
  if (ringEl) {
    const offset = 150.8 * (1 - pct);
    ringEl.style.strokeDashoffset = offset;
  }
  if (ringPctEl) ringPctEl.textContent = Math.round(pct * 100) + '%';
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
