import { navigateTo } from '../router.js';

export function initOrganization() {
  document.querySelectorAll('#screen-organization .org-tile').forEach(tile => {
    tile.onclick = null;
    tile.addEventListener('click', () => {
      const target = tile.dataset.nav;
      if (target === 'weather') {
        window.showToast('Počasí bude dostupné ve verzi V2.', 'info');
        return;
      }
      if (target) navigateTo(target);
    });
  });
}
