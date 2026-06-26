import { navigateTo } from '../router.js';
import { firebaseConfig } from '../firebase-config.js';
import { saveProfile } from '../firestore.js';
import { getCurrentUid } from '../auth.js';

export function initSettings() {
  // Kdo jsem
  const nameInput = document.getElementById('profile-name-input');
  const roleRunner = document.getElementById('profile-role-runner');
  const roleSupport = document.getElementById('profile-role-support');
  const saveProfileBtn = document.getElementById('save-profile-btn');

  if (nameInput) {
    nameInput.value = localStorage.getItem('profileName') || 'Vojtěch';
  }
  if (roleRunner && roleSupport) {
    const savedRole = localStorage.getItem('profileRole') || 'runner';
    roleRunner.classList.toggle('active', savedRole === 'runner');
    roleSupport.classList.toggle('active', savedRole === 'support');
    roleRunner.onclick = () => { roleRunner.classList.add('active'); roleSupport.classList.remove('active'); };
    roleSupport.onclick = () => { roleSupport.classList.add('active'); roleRunner.classList.remove('active'); };
  }
  if (saveProfileBtn) {
    saveProfileBtn.onclick = async () => {
      const name = nameInput?.value.trim() || 'Vojtěch';
      const role = roleSupport?.classList.contains('active') ? 'support' : 'runner';
      localStorage.setItem('profileName', name);
      localStorage.setItem('profileRole', role);
      try {
        await saveProfile(getCurrentUid(), {
          name,
          role,
          avatarColor: role === 'runner' ? '#2BC4B0' : '#FF8C5A'
        });
        window.showToast('Profil uložen!', 'success');
      } catch {
        window.showToast('Profil uložen lokálně.', 'info');
      }
    };
  }
  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const current = localStorage.getItem('theme') || 'dark';
    themeToggle.checked = current === 'dark';
    themeToggle.onchange = () => {
      const theme = themeToggle.checked ? 'dark' : 'light';
      localStorage.setItem('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    };
  }

  // Unit selector
  document.querySelectorAll('[data-unit]').forEach(btn => {
    const savedUnit = localStorage.getItem('units') || 'km';
    btn.classList.toggle('active', btn.dataset.unit === savedUnit);
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-unit]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      localStorage.setItem('units', btn.dataset.unit);
    });
  });

  // Firebase project ID
  const projIdEl = document.getElementById('firebase-project-id');
  if (projIdEl) projIdEl.textContent = firebaseConfig.projectId || '–';

  // Strava buttons
  const connected = localStorage.getItem('stravaConnected') === '1';
  const statusEl = document.getElementById('strava-settings-status');
  const stravaBtn = document.getElementById('strava-settings-btn');
  if (statusEl) statusEl.textContent = connected ? 'Připojeno' : 'Nepřipojeno';
  if (stravaBtn) {
    stravaBtn.textContent = connected ? 'Synchronizovat' : 'Připojit';
    stravaBtn.onclick = connected
      ? () => window.syncStrava?.()
      : () => window.connectStrava?.();
  }

  // Reset
  const resetBtn = document.getElementById('reset-app-btn');
  if (resetBtn) {
    resetBtn.onclick = () => {
      if (confirm('Opravdu obnovit tovární nastavení? Toto odstraní POUZE lokální cache – data v Firestore zůstanou.')) {
        localStorage.clear();
        window.location.reload();
      }
    };
  }
}
