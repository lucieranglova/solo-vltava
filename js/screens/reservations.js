import { listenReservations, addReservation, deleteReservation } from '../firestore.js';
import { openModal, closeModal } from '../router.js';

let _unsub = null;

export function initReservations() {
  if (_unsub) { _unsub(); _unsub = null; }
  _unsub = listenReservations(items => renderList(items));

  const addBtn = document.getElementById('add-reservation-btn');
  if (addBtn) addBtn.onclick = () => openModal('add-reservation-modal');

  const form = document.getElementById('add-reservation-form');
  if (form) form.onsubmit = handleAdd;
}

async function handleAdd(e) {
  e.preventDefault();
  const btn = e.target.querySelector('[type="submit"]');
  btn.disabled = true;
  try {
    await addReservation({
      type: document.getElementById('res-type').value,
      name: document.getElementById('res-name').value.trim(),
      datetime: document.getElementById('res-datetime').value,
      confirmationNumber: document.getElementById('res-confirmation').value.trim(),
      notes: document.getElementById('res-notes').value.trim()
    });
    e.target.reset();
    closeModal('add-reservation-modal');
    window.showToast('Rezervace uložena!', 'success');
  } catch (err) {
    window.showToast('Chyba: ' + err.message, 'error');
    btn.disabled = false;
  }
}

const TYPE_EMOJI = {
  transport: '🚗',
  accommodation: '🏨',
  restaurant: '🍽️',
  race: '🏁',
  other: '🎫'
};

const TYPE_LABEL = {
  transport: 'Doprava',
  accommodation: 'Ubytování',
  restaurant: 'Restaurace',
  race: 'Závod',
  other: 'Ostatní'
};

function renderList(items) {
  const list = document.getElementById('reservations-list');
  const empty = document.getElementById('reservations-empty');
  if (!list) return;
  list.querySelectorAll('.list-card').forEach(el => el.remove());

  if (items.length === 0) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  const sorted = [...items].sort((a, b) => {
    if (!a.datetime) return 1;
    if (!b.datetime) return -1;
    return new Date(a.datetime) - new Date(b.datetime);
  });

  sorted.forEach(item => {
    const card = document.createElement('div');
    card.className = 'list-card';
    card.innerHTML = `
      <div class="list-card-row">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:1.5rem">${TYPE_EMOJI[item.type] || '🎫'}</span>
          <div>
            <div class="list-card-title">${escHtml(item.name)}</div>
            <div class="list-card-meta">${TYPE_LABEL[item.type] || 'Ostatní'}</div>
          </div>
        </div>
        ${item.confirmationNumber ? `<div class="list-card-badge">${escHtml(item.confirmationNumber)}</div>` : ''}
      </div>
      ${item.datetime ? `<div class="list-card-meta" style="margin-top:6px">📅 ${formatDatetime(item.datetime)}</div>` : ''}
      ${item.notes ? `<div class="list-card-meta" style="margin-top:4px">${escHtml(item.notes)}</div>` : ''}
      <div class="list-card-actions">
        <button class="action-delete" data-id="${item.id}">
          <svg><use href="#icon-trash"/></svg> Smazat
        </button>
      </div>
    `;
    card.querySelector('.action-delete').addEventListener('click', async () => {
      if (!confirm('Smazat tuto rezervaci?')) return;
      await deleteReservation(item.id);
      window.showToast('Smazáno.', 'success');
    });
    list.appendChild(card);
  });
}

function formatDatetime(dt) {
  if (!dt) return '–';
  return new Date(dt).toLocaleString('cs-CZ', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
