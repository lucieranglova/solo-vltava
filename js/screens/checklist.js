import {
  listenChecklistCategories,
  listenChecklistItems,
  addChecklistCategory,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistCategory,
  deleteChecklistItem
} from '../firestore.js';
import { openModal, closeModal } from '../router.js';

let _unsubCats = null;
let _unsubItems = null;
let _categories = [];
let _items = [];
let _activeTab = 'runner';

export function initChecklist() {
  // Tab buttons
  document.querySelectorAll('#screen-checklist .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#screen-checklist .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _activeTab = btn.dataset.tab;
      renderChecklist();
    });
  });

  // Add category button
  const addCatBtn = document.getElementById('add-checklist-cat-btn');
  if (addCatBtn) addCatBtn.onclick = () => {
    // Pre-select current tab role
    document.querySelectorAll('#add-cat-form .role-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.role === _activeTab);
    });
    openModal('add-cat-modal');
  };

  // Add category form role buttons
  document.querySelectorAll('#add-cat-form .role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#add-cat-form .role-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  const catForm = document.getElementById('add-cat-form');
  if (catForm) catForm.onsubmit = handleAddCategory;

  // Listen categories & items
  if (_unsubCats) { _unsubCats(); _unsubCats = null; }
  if (_unsubItems) { _unsubItems(); _unsubItems = null; }

  _unsubCats = listenChecklistCategories(cats => {
    _categories = cats;
    renderChecklist();
  });
  _unsubItems = listenChecklistItems(items => {
    _items = items;
    renderChecklist();
    updateTotalProgress();
  });
}

async function handleAddCategory(e) {
  e.preventDefault();
  const activeRole = document.querySelector('#add-cat-form .role-btn.active')?.dataset.role || 'runner';
  const btn = e.target.querySelector('[type="submit"]');
  btn.disabled = true;

  try {
    await addChecklistCategory({
      name: document.getElementById('cat-name').value.trim(),
      owner: activeRole
    });
    e.target.reset();
    closeModal('add-cat-modal');
    window.showToast('Kategorie přidána!', 'success');
  } catch (err) {
    window.showToast('Chyba: ' + err.message, 'error');
    btn.disabled = false;
  }
}

function renderChecklist() {
  const content = document.getElementById('checklist-content');
  const empty = document.getElementById('checklist-empty');
  if (!content) return;

  // Filter categories by active tab
  const filteredCats = _categories.filter(c => c.owner === _activeTab || (_activeTab === 'shared' && c.owner === 'shared'));
  content.querySelectorAll('.cat-section').forEach(el => el.remove());

  if (filteredCats.length === 0) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  filteredCats.forEach(cat => {
    const catItems = _items.filter(i => i.categoryId === cat.id);
    const section = createCategorySection(cat, catItems);
    content.appendChild(section);
  });

  updateTotalProgress();
}

function createCategorySection(cat, items) {
  const section = document.createElement('div');
  section.className = 'cat-section glass-card';
  section.dataset.catId = cat.id;

  const checked = items.filter(i => i.checked).length;

  section.innerHTML = `
    <div class="cat-section-header">
      <span class="cat-section-name">${escHtml(cat.name)}</span>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="cat-section-count font-mono">${checked}/${items.length}</span>
        <button class="icon-btn" style="width:28px;height:28px" data-delete-cat="${cat.id}" title="Smazat kategorii">
          <svg style="width:14px;height:14px"><use href="#icon-trash"/></svg>
        </button>
      </div>
    </div>
    <div class="checklist-items" id="items-${cat.id}"></div>
    <button class="cat-add-item" data-cat="${cat.id}">
      <svg><use href="#icon-plus"/></svg> Přidat položku
    </button>
  `;

  const itemsContainer = section.querySelector(`#items-${cat.id}`);
  items.forEach(item => {
    itemsContainer.appendChild(createChecklistItemEl(item));
  });

  // Delete category
  section.querySelector(`[data-delete-cat]`).addEventListener('click', async () => {
    if (!confirm(`Smazat kategorii "${cat.name}" a všechny její položky?`)) return;
    await Promise.all([
      deleteChecklistCategory(cat.id),
      ...items.map(i => deleteChecklistItem(i.id))
    ]);
    window.showToast('Kategorie smazána.', 'success');
  });

  // Add item button
  section.querySelector('.cat-add-item').addEventListener('click', e => {
    const btn = e.currentTarget;
    showInlineAddItem(btn, cat.id);
  });

  return section;
}

function createChecklistItemEl(item) {
  const el = document.createElement('div');
  el.className = `checklist-item${item.checked ? ' checked' : ''}`;
  el.dataset.id = item.id;

  el.innerHTML = `
    <div class="check-box">
      <svg><use href="#icon-check"/></svg>
    </div>
    <span class="check-label">${escHtml(item.name)}</span>
    ${item.quantity ? `<span class="check-qty">${escHtml(item.quantity)}</span>` : ''}
    <button style="width:24px;height:24px;opacity:0.4;flex-shrink:0" data-delete="${item.id}">
      <svg style="width:14px;height:14px"><use href="#icon-trash"/></svg>
    </button>
  `;

  // Toggle checked
  el.addEventListener('click', async e => {
    if (e.target.closest('[data-delete]')) return;
    const newChecked = !item.checked;
    item.checked = newChecked;
    el.classList.toggle('checked', newChecked);
    await toggleChecklistItem(item.id, newChecked);
    updateTotalProgress();
  });

  // Delete item
  el.querySelector('[data-delete]').addEventListener('click', async e => {
    e.stopPropagation();
    await deleteChecklistItem(item.id);
    el.remove();
    window.showToast('Položka smazána.', 'success');
    updateTotalProgress();
  });

  return el;
}

function showInlineAddItem(triggerBtn, catId) {
  const existing = triggerBtn.parentElement.querySelector('.add-checklist-item-form');
  if (existing) { existing.remove(); return; }

  const form = document.createElement('div');
  form.className = 'add-checklist-item-form';
  form.innerHTML = `
    <input type="text" placeholder="Název položky…" maxlength="80">
    <button class="confirm">✓</button>
    <button class="cancel">✕</button>
  `;

  triggerBtn.parentElement.insertBefore(form, triggerBtn);
  form.querySelector('input').focus();

  const save = async () => {
    const name = form.querySelector('input').value.trim();
    if (!name) { form.remove(); return; }
    try {
      await addChecklistItem({ categoryId: catId, name });
      window.showToast('Přidáno!', 'success');
    } catch (err) {
      window.showToast('Chyba: ' + err.message, 'error');
    }
    form.remove();
  };

  form.querySelector('.confirm').addEventListener('click', save);
  form.querySelector('.cancel').addEventListener('click', () => form.remove());
  form.querySelector('input').addEventListener('keydown', e => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') form.remove();
  });
}

function updateTotalProgress() {
  const total = _items.length;
  const checked = _items.filter(i => i.checked).length;
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
  const circumference = 2 * Math.PI * 32; // r=32

  const pctEl = document.getElementById('checklist-total-pct');
  const ringEl = document.getElementById('checklist-ring-fill');
  const countEl = document.getElementById('checklist-items-count');

  if (pctEl) pctEl.textContent = pct + '%';
  if (countEl) countEl.textContent = `${checked} / ${total} položek`;
  if (ringEl) ringEl.style.strokeDashoffset = circumference * (1 - pct / 100);
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
