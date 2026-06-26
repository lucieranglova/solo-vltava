import { listenScheduleItems, addScheduleItem, deleteScheduleItem, formatDatetime, tsToDate } from '../firestore.js';
import { openModal, closeModal } from '../router.js';

let _unsub = null;

export function initSchedule() {
  if (_unsub) { _unsub(); _unsub = null; }

  _unsub = listenScheduleItems(items => renderTimeline(items));

  const addBtn = document.getElementById('add-schedule-btn');
  if (addBtn) addBtn.onclick = () => openModal('add-schedule-modal');

  const form = document.getElementById('add-schedule-form');
  if (form) form.onsubmit = handleAdd;
}

async function handleAdd(e) {
  e.preventDefault();
  const btn = e.target.querySelector('[type="submit"]');
  btn.disabled = true;

  const startVal = document.getElementById('sch-start').value;
  const endVal = document.getElementById('sch-end').value;

  try {
    await addScheduleItem({
      title: document.getElementById('sch-title').value.trim(),
      startAt: startVal ? new Date(startVal).toISOString() : null,
      endAt: endVal ? new Date(endVal).toISOString() : null,
      location: document.getElementById('sch-location').value.trim(),
      category: document.getElementById('sch-category').value,
      notes: document.getElementById('sch-notes').value.trim()
    });
    e.target.reset();
    closeModal('add-schedule-modal');
    window.showToast('Přidáno!', 'success');
  } catch (err) {
    window.showToast('Chyba: ' + err.message, 'error');
    btn.disabled = false;
  }
}

function renderTimeline(items) {
  const timeline = document.getElementById('schedule-timeline');
  const empty = document.getElementById('schedule-empty');
  if (!timeline) return;

  timeline.querySelectorAll('.timeline-item').forEach(el => el.remove());

  if (items.length === 0) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  // Group by day
  const byDay = {};
  items.forEach(item => {
    const d = item.startAt ? new Date(item.startAt) : null;
    const key = d ? d.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Bez data';
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(item);
  });

  Object.entries(byDay).forEach(([day, dayItems]) => {
    const dayHeader = document.createElement('div');
    dayHeader.style.cssText = 'font-size:0.78rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.07em;margin:16px 0 8px;padding-left:4px';
    dayHeader.textContent = day;
    timeline.appendChild(dayHeader);

    dayItems.forEach(item => {
      const el = document.createElement('div');
      el.className = 'timeline-item';
      const catClass = `cat-${item.category || 'other'}`;
      const catLabel = { race: 'Závod', travel: 'Cestování', accommodation: 'Ubytování', prep: 'Příprava', other: 'Ostatní' }[item.category] || 'Ostatní';

      el.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-card">
          <div class="timeline-time font-mono">${formatTime(item.startAt)}${item.endAt ? ' – ' + formatTime(item.endAt) : ''}</div>
          <div class="timeline-title">${escHtml(item.title)}</div>
          ${item.location ? `<div class="timeline-location"><svg style="width:12px;height:12px"><use href="#icon-map-pin"/></svg>${escHtml(item.location)}</div>` : ''}
          <span class="timeline-cat-badge ${catClass}">${catLabel}</span>
          <div class="list-card-actions" style="margin-top:8px">
            <button class="action-delete" data-id="${item.id}">
              <svg><use href="#icon-trash"/></svg> Smazat
            </button>
          </div>
        </div>
      `;

      el.querySelector('.action-delete').addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Smazat tuto položku?')) return;
        await deleteScheduleItem(item.id);
        window.showToast('Smazáno.', 'success');
      });

      timeline.appendChild(el);
    });
  });
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
