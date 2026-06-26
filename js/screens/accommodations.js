import { listenAccommodations, addAccommodation, deleteAccommodation } from '../firestore.js';
import { openModal, closeModal } from '../router.js';

let _unsub = null;

export function initAccommodations() {
  if (_unsub) { _unsub(); _unsub = null; }
  _unsub = listenAccommodations(items => renderList(items));

  const addBtn = document.getElementById('add-accomm-btn');
  if (addBtn) addBtn.onclick = () => openModal('add-accomm-modal');

  const form = document.getElementById('add-accomm-form');
  if (form) form.onsubmit = handleAdd;
}

async function handleAdd(e) {
  e.preventDefault();
  const btn = e.target.querySelector('[type="submit"]');
  btn.disabled = true;
  try {
    await addAccommodation({
      name: document.getElementById('acc-name').value.trim(),
      address: document.getElementById('acc-address').value.trim(),
      checkIn: document.getElementById('acc-checkin').value,
      checkOut: document.getElementById('acc-checkout').value,
      bookingRef: document.getElementById('acc-booking').value.trim(),
      price: document.getElementById('acc-price').value.trim(),
      notes: document.getElementById('acc-notes').value.trim()
    });
    e.target.reset();
    closeModal('add-accomm-modal');
    window.showToast('Ubytování uloženo!', 'success');
  } catch (err) {
    window.showToast('Chyba: ' + err.message, 'error');
    btn.disabled = false;
  }
}

function renderList(items) {
  const list = document.getElementById('accommodations-list');
  const empty = document.getElementById('accommodations-empty');
  if (!list) return;
  list.querySelectorAll('.list-card').forEach(el => el.remove());

  if (items.length === 0) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'list-card';
    card.innerHTML = `
      <div class="list-card-row">
        <div>
          <div class="list-card-title">${escHtml(item.name)}</div>
          ${item.address ? `<div class="list-card-meta">${escHtml(item.address)}</div>` : ''}
        </div>
        ${item.bookingRef ? `<div class="list-card-badge">${escHtml(item.bookingRef)}</div>` : ''}
      </div>
      ${item.checkIn ? `<div class="list-card-meta" style="margin-top:6px">📅 ${formatDate(item.checkIn)} – ${formatDate(item.checkOut || '')}</div>` : ''}
      ${item.price ? `<div class="list-card-meta">💰 ${escHtml(item.price)}</div>` : ''}
      ${item.notes ? `<div class="list-card-meta" style="margin-top:4px">${escHtml(item.notes)}</div>` : ''}
      <div class="list-card-actions">
        <button class="action-delete" data-id="${item.id}">
          <svg><use href="#icon-trash"/></svg> Smazat
        </button>
      </div>
    `;
    card.querySelector('.action-delete').addEventListener('click', async () => {
      if (!confirm('Smazat toto ubytování?')) return;
      await deleteAccommodation(item.id);
      window.showToast('Smazáno.', 'success');
    });
    list.appendChild(card);
  });
}

function formatDate(d) {
  if (!d) return '–';
  return new Date(d + 'T00:00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
