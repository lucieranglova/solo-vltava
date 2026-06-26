import { saveRaceConfig } from '../firestore.js';
import { getCurrentUid } from '../auth.js';
import { saveProfile } from '../firestore.js';
import { navigateTo } from '../router.js';

export function initOnboarding() {
  const form = document.getElementById('onboarding-form');
  const roleButtons = document.querySelectorAll('#onboarding-form .role-btn');

  let selectedRole = 'runner';

  // Set default race date to 2 years from now
  const dateInput = document.getElementById('ob-race-date');
  if (dateInput && !dateInput.value) {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    dateInput.value = d.toISOString().split('T')[0];
  }

  roleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      roleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRole = btn.dataset.role;
    });
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const name = document.getElementById('ob-name').value.trim();
    const raceName = document.getElementById('ob-race-name').value.trim() || 'Vltava Run';
    const raceDate = document.getElementById('ob-race-date').value;
    const raceLocation = document.getElementById('ob-race-location').value.trim();
    const targetKm = parseFloat(document.getElementById('ob-target-km').value) || 840;
    const targetElev = parseFloat(document.getElementById('ob-target-elev').value) || 12000;

    if (!name || !raceDate) {
      window.showToast('Vyplň jméno a datum závodu.', 'error');
      return;
    }

    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Ukládám…';

    try {
      const uid = getCurrentUid();

      await Promise.all([
        saveRaceConfig({
          raceName,
          raceDate,
          raceLocation,
          targetDistanceKm: targetKm,
          targetElevationM: targetElev
        }),
        saveProfile(uid, {
          name,
          role: selectedRole,
          avatarColor: selectedRole === 'runner' ? '#2BC4B0' : '#FF8C5A'
        })
      ]);

      window.showToast(`Vítej, ${name}! 🏃`, 'success');
      navigateTo('dashboard');
    } catch (err) {
      console.error(err);
      window.showToast('Chyba při ukládání: ' + err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Začínáme →';
    }
  });
}
