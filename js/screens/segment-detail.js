import { updateSegment, deleteSegment } from '../firestore.js';
import { navigateTo } from '../router.js';

let _currentSegment = null;

export function initSegmentDetail(data = {}) {
  _currentSegment = data.segment;
  if (!_currentSegment) {
    navigateTo('route');
    return;
  }
  renderDetail(_currentSegment);

  // Back button
  const backBtn = document.getElementById('segment-back-btn');
  if (backBtn) backBtn.onclick = () => navigateTo('route');
}

function renderDetail(seg) {
  const content = document.getElementById('segment-detail-content');
  const title = document.getElementById('segment-detail-title');
  if (!content || !title) return;

  title.textContent = seg.name;

  const surfaceLabels = { trail: 'Trail', road: 'Silnice', gravel: 'Gravel', mixed: 'Smíšený' };

  content.innerHTML = `
    <div class="segment-detail-stats">
      <div class="detail-stat-card">
        <span class="detail-stat-val teal font-display">${seg.distanceKm || 0}</span>
        <span class="detail-stat-label">km</span>
      </div>
      <div class="detail-stat-card">
        <span class="detail-stat-val coral font-display">+${seg.elevationGainM || 0}</span>
        <span class="detail-stat-label">m stoupání</span>
      </div>
      <div class="detail-stat-card">
        <span class="detail-stat-val font-display">${seg.elevationLossM || 0}</span>
        <span class="detail-stat-label">m klesání</span>
      </div>
    </div>

    <div class="glass-card" style="margin-bottom:12px">
      <div class="settings-row">
        <span class="settings-label">Povrch</span>
        <span class="settings-val">${surfaceLabels[seg.surfaceType] || 'Trail'}</span>
      </div>
      <div class="settings-row">
        <span class="settings-label">Obtížnost</span>
        <span class="difficulty-dots" style="padding: 4px 0">${difficultyDots(seg.difficulty)}</span>
      </div>
    </div>

    <div class="tried-toggle glass-card" id="tried-toggle">
      <div>
        <div class="tried-toggle-label">Vyzkoušeno</div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px">
          ${seg.tried && seg.triedDate ? 'Dne ' + new Date(seg.triedDate).toLocaleDateString('cs-CZ') : 'Zatím nevyzkoušeno'}
        </div>
      </div>
      <label class="toggle">
        <input type="checkbox" id="tried-checkbox" ${seg.tried ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>

    ${seg.notes ? `
    <div class="glass-card" style="margin-bottom:12px">
      <div class="section-label" style="margin-bottom:8px">Poznámky</div>
      <p style="font-size:0.9rem;line-height:1.6;color:var(--text-muted)">${escHtml(seg.notes)}</p>
    </div>` : ''}

    <div class="glass-card" style="margin-bottom:12px">
      <div class="section-label" style="margin-bottom:12px">Fotky</div>
      <div style="font-size:0.85rem;color:var(--text-muted)">Pro přidání fotek přejdi do Galerie.</div>
    </div>

    <button class="btn-danger btn-full" id="delete-segment-btn" style="margin-top:8px">
      Smazat úsek
    </button>
  `;

  // Tried toggle
  const checkbox = document.getElementById('tried-checkbox');
  if (checkbox) {
    checkbox.addEventListener('change', async () => {
      const tried = checkbox.checked;
      try {
        await updateSegment(_currentSegment.id, {
          tried,
          triedDate: tried ? new Date().toISOString().split('T')[0] : null
        });
        window.showToast(tried ? 'Označeno jako vyzkoušeno!' : 'Odznačeno.', 'success');
        _currentSegment = { ..._currentSegment, tried };
      } catch (err) {
        window.showToast('Chyba: ' + err.message, 'error');
        checkbox.checked = !tried;
      }
    });
  }

  // Delete button
  const deleteBtn = document.getElementById('delete-segment-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`Opravdu smazat úsek "${seg.name}"?`)) return;
      try {
        await deleteSegment(seg.id);
        window.showToast('Úsek smazán.', 'success');
        navigateTo('route');
      } catch (err) {
        window.showToast('Chyba: ' + err.message, 'error');
      }
    });
  }
}

function difficultyDots(level = 3) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<div class="diff-dot${i <= level ? ' filled' : ''}" style="width:10px;height:10px;border-radius:50%;background:${i <= level ? 'var(--coral)' : 'var(--border)'}"></div>`;
  }
  return `<span style="display:flex;gap:4px">${html}</span>`;
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}
