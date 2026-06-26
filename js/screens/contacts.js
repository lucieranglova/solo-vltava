import { listenContacts, addContact, deleteContact } from '../firestore.js';
import { openModal, closeModal } from '../router.js';

let _unsub = null;

export function initContacts() {
  if (_unsub) { _unsub(); _unsub = null; }
  _unsub = listenContacts(items => renderList(items));

  const addBtn = document.getElementById('add-contact-btn');
  if (addBtn) addBtn.onclick = () => openModal('add-contact-modal');

  const form = document.getElementById('add-contact-form');
  if (form) form.onsubmit = handleAdd;
}

async function handleAdd(e) {
  e.preventDefault();
  const btn = e.target.querySelector('[type="submit"]');
  btn.disabled = true;
  try {
    await addContact({
      name: document.getElementById('con-name').value.trim(),
      roleDescription: document.getElementById('con-role').value.trim(),
      phone: document.getElementById('con-phone').value.trim(),
      email: document.getElementById('con-email').value.trim()
    });
    e.target.reset();
    closeModal('add-contact-modal');
    window.showToast('Kontakt uložen!', 'success');
  } catch (err) {
    window.showToast('Chyba: ' + err.message, 'error');
    btn.disabled = false;
  }
}

function renderList(items) {
  const list = document.getElementById('contacts-list');
  const empty = document.getElementById('contacts-empty');
  if (!list) return;
  list.querySelectorAll('.list-card').forEach(el => el.remove());

  if (items.length === 0) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  items.forEach(item => {
    const initials = (item.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const color = hashColor(item.name);
    const card = document.createElement('div');
    card.className = 'list-card';
    card.style.display = 'flex';
    card.style.gap = '14px';
    card.style.alignItems = 'flex-start';
    card.innerHTML = `
      <div style="width:44px;height:44px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1rem;flex-shrink:0">${escHtml(initials)}</div>
      <div style="flex:1;min-width:0">
        <div class="list-card-title">${escHtml(item.name)}</div>
        ${item.roleDescription ? `<div class="list-card-meta">${escHtml(item.roleDescription)}</div>` : ''}
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          ${item.phone ? `<a href="tel:${encodeURIComponent(item.phone)}" class="btn-secondary btn-sm" style="text-decoration:none;gap:4px"><svg style="width:14px;height:14px"><use href="#icon-map-pin"/></svg>${escHtml(item.phone)}</a>` : ''}
          ${item.email ? `<a href="mailto:${encodeURIComponent(item.email)}" class="btn-secondary btn-sm" style="text-decoration:none">✉ ${escHtml(item.email)}</a>` : ''}
        </div>
        <div class="list-card-actions" style="margin-top:8px">
          <button class="action-delete" data-id="${item.id}">
            <svg><use href="#icon-trash"/></svg> Smazat
          </button>
        </div>
      </div>
    `;
    card.querySelector('.action-delete').addEventListener('click', async () => {
      if (!confirm(`Smazat kontakt "${item.name}"?`)) return;
      await deleteContact(item.id);
      window.showToast('Kontakt smazán.', 'success');
    });
    list.appendChild(card);
  });
}

function hashColor(s) {
  let hash = 0;
  for (let c of (s || '')) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  const colors = ['#2BC4B0','#FF8C5A','#4CAF6D','#7B68EE','#FF6B9D','#FFC107'];
  return colors[Math.abs(hash) % colors.length];
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
