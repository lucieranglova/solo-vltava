import { listenPhotos, addPhotoRecord, deletePhoto } from '../firestore.js';
import { getStorageInstance } from '../auth.js';
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

let _unsub = null;
let _allPhotos = [];
let _activeFilter = 'all';

export function initGallery() {
  if (_unsub) { _unsub(); _unsub = null; }

  _unsub = listenPhotos(photos => {
    _allPhotos = photos;
    renderGallery();
  });

  // Filter pills
  document.querySelectorAll('#screen-gallery .filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#screen-gallery .filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      _activeFilter = pill.dataset.filter;
      renderGallery();
    });
  });

  // Upload button
  const uploadBtn = document.getElementById('upload-photo-btn');
  const photoInput = document.getElementById('photo-input');
  if (uploadBtn && photoInput) {
    uploadBtn.onclick = () => photoInput.click();
    photoInput.onchange = handleUpload;
  }
}

async function handleUpload(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  window.showToast(`Nahrávám ${files.length} foto…`, 'info');

  for (const file of files) {
    try {
      const storage = getStorageInstance();
      const path = `photos/${Date.now()}_${file.name}`;
      const sRef = storageRef(storage, path);
      const snapshot = await uploadBytesResumable(sRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      await addPhotoRecord({
        storageRef: path,
        downloadUrl,
        linkedType: 'free',
        linkedId: null,
        caption: '',
        fileName: file.name
      });
    } catch (err) {
      console.error('Upload error:', err);
      window.showToast('Chyba při nahrávání: ' + err.message, 'error');
    }
  }

  window.showToast('Fotky nahrány!', 'success');
  e.target.value = '';
}

function renderGallery() {
  const grid = document.getElementById('photo-grid');
  const empty = document.getElementById('gallery-empty');
  if (!grid) return;

  grid.querySelectorAll('.photo-thumb').forEach(el => el.remove());

  let filtered = _allPhotos;
  if (_activeFilter !== 'all') filtered = filtered.filter(p => p.linkedType === _activeFilter);

  if (filtered.length === 0) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  const typeLabels = { segment: 'Trasa', race: 'Závod', free: '' };

  filtered.forEach(photo => {
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';
    thumb.innerHTML = `
      ${photo.downloadUrl ? `<img src="${encodeURI(photo.downloadUrl)}" alt="${escHtml(photo.caption || '')}" loading="lazy">` : '<div style="background:var(--card-bg);width:100%;height:100%"></div>'}
      ${typeLabels[photo.linkedType] ? `<span class="photo-type-badge">${typeLabels[photo.linkedType]}</span>` : ''}
    `;

    thumb.addEventListener('click', () => showPhotoDetail(photo));
    grid.appendChild(thumb);
  });
}

function showPhotoDetail(photo) {
  const existing = document.getElementById('photo-lightbox');
  if (existing) existing.remove();

  const lb = document.createElement('div');
  lb.id = 'photo-lightbox';
  lb.style.cssText = 'position:fixed;inset:0;z-index:400;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px';
  lb.innerHTML = `
    <button style="position:absolute;top:calc(var(--safe-top)+16px);right:16px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.12);color:white;font-size:1.2rem" id="lb-close">✕</button>
    ${photo.downloadUrl ? `<img src="${encodeURI(photo.downloadUrl)}" style="max-width:100%;max-height:70vh;border-radius:12px;object-fit:contain">` : ''}
    ${photo.caption ? `<p style="color:white;margin-top:12px;font-size:0.9rem;text-align:center">${escHtml(photo.caption)}</p>` : ''}
    <button style="margin-top:16px;color:#FF5050;font-weight:600;font-size:0.9rem" id="lb-delete">🗑 Smazat</button>
  `;
  document.body.appendChild(lb);

  lb.querySelector('#lb-close').onclick = () => lb.remove();
  lb.addEventListener('click', e => { if (e.target === lb) lb.remove(); });
  lb.querySelector('#lb-delete').onclick = async () => {
    if (!confirm('Smazat tuto fotku?')) return;
    try {
      const storage = getStorageInstance();
      if (photo.storageRef) {
        await deleteObject(storageRef(storage, photo.storageRef)).catch(() => {});
      }
      await deletePhoto(photo.id);
      lb.remove();
      window.showToast('Fotka smazána.', 'success');
    } catch (err) {
      window.showToast('Chyba: ' + err.message, 'error');
    }
  };
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
