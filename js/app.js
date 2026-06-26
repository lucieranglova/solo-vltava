import { initFirebase } from './auth.js';
import { registerScreen, navigateTo, initNavigation } from './router.js';
import { startIllustrationCycle } from './illustrations.js';
import { getRaceConfig } from './firestore.js';
import { initOnboarding } from './screens/onboarding.js';
import { initDashboard } from './screens/dashboard.js';
import { initPerformance } from './screens/performance.js';
import { initRoute } from './screens/route.js';
import { initSegmentDetail } from './screens/segment-detail.js';
import { initOrganization } from './screens/organization.js';
import { initSchedule } from './screens/schedule.js';
import { initChecklist } from './screens/checklist.js';
import { initAccommodations } from './screens/accommodations.js';
import { initContacts } from './screens/contacts.js';
import { initReservations } from './screens/reservations.js';
import { initWeather } from './screens/weather.js';
import { initGallery } from './screens/gallery.js';
import { initSettings } from './screens/settings.js';
import { STRAVA_CLIENT_ID, STRAVA_REDIRECT_URI, FUNCTIONS_BASE_URL } from './firebase-config.js';

// PWA registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/solo-vltava/sw.js').catch(() => {});
  });
}

// Toast helper (global)
window.showToast = function(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✓', error: '✗', info: 'ℹ' };
  toast.innerHTML = `<span class="toast-icon">${icons[type] || ''}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
};

// ---- Clock in status bar ----
function updateClock() {
  const el = document.getElementById('current-time');
  if (el) {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  }
}
setInterval(updateClock, 10000);
updateClock();

// ---- Main boot ----
async function boot() {
  const overlay = document.getElementById('loading-overlay');

  try {
    // Check Strava OAuth callback before anything
    const urlParams = new URLSearchParams(window.location.search);
    const stravaCode = urlParams.get('code');
    const stravaCallback = urlParams.get('strava_callback');

    // Init Firebase
    await initFirebase();

    // Register all screens
    registerScreen('onboarding');
    registerScreen('dashboard', { init: initDashboard });
    registerScreen('performance', { init: initPerformance });
    registerScreen('route', { init: initRoute });
    registerScreen('segment-detail', { init: initSegmentDetail });
    registerScreen('organization', { init: initOrganization });
    registerScreen('schedule', { init: initSchedule });
    registerScreen('checklist', { init: initChecklist });
    registerScreen('accommodations', { init: initAccommodations });
    registerScreen('contacts', { init: initContacts });
    registerScreen('reservations', { init: initReservations });
    registerScreen('weather', { init: initWeather });
    registerScreen('gallery', { init: initGallery });
    registerScreen('settings', { init: initSettings });

    // Init navigation
    initNavigation();

    // Start illustration cycle
    startIllustrationCycle();

    // Apply saved theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.checked = savedTheme === 'dark';

    // Handle Strava OAuth callback
    if (stravaCode && stravaCallback) {
      overlay.classList.add('hidden');
      await handleStravaCallback(stravaCode);
      return;
    }

    // Check if onboarding is needed
    const config = await getRaceConfig();
    if (!config) {
      overlay.classList.add('hidden');
      initOnboarding();
      navigateTo('onboarding');
    } else {
      overlay.classList.add('hidden');
      navigateTo('dashboard');
    }

  } catch (err) {
    console.error('Boot error:', err);
    overlay.classList.add('hidden');
    window.showToast('Chyba při spuštění. Zkontroluj Firebase konfiguraci.', 'error');

    // Even on error, try to show something
    setTimeout(() => {
      initOnboarding();
      navigateTo('onboarding');
    }, 500);
  }
}

async function handleStravaCallback(code) {
  const overlay = document.createElement('div');
  overlay.className = 'strava-callback-overlay';
  overlay.innerHTML = `
    <svg class="strava-icon-big" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0 5 13.828h4.172"/>
    </svg>
    <h2 style="font-family:var(--font-display);font-size:1.4rem;font-weight:800">Připojuji Strava…</h2>
    <p style="color:var(--text-muted);font-size:0.9rem">Probíhá autorizace, chvíli počkej.</p>
    <div class="loading-spinner" style="width:36px;height:36px">
      <svg viewBox="0 0 50 50" class="spinner-svg">
        <circle cx="25" cy="25" r="20" fill="none" stroke="#FC4C02" stroke-width="4" stroke-dasharray="100" stroke-dashoffset="75" stroke-linecap="round"/>
      </svg>
    </div>
  `;
  document.getElementById('app').appendChild(overlay);

  try {
    const resp = await fetch(`${FUNCTIONS_BASE_URL}/exchangeStravaCode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const result = await resp.json();
    if (result.success) {
      localStorage.setItem('stravaConnected', '1');
      window.showToast('Strava úspěšně připojena! 🎉', 'success');
    } else {
      throw new Error(result.error || 'Neznámá chyba');
    }
  } catch (err) {
    console.error('Strava callback error:', err);
    window.showToast('Chyba při připojení Strava: ' + err.message, 'error');
  }

  overlay.remove();

  // Clean URL and navigate to performance
  history.replaceState({}, '', window.location.pathname);
  navigateTo('performance');
}

// Global Strava connect trigger (called from performance / settings screens)
window.connectStrava = function() {
  const url = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}&scope=read,activity:read_all&approval_prompt=force`;
  window.location.href = url;
};

// Global Strava sync trigger
window.syncStrava = async function() {
  const syncIcon = document.getElementById('strava-sync-icon');
  if (syncIcon) syncIcon.classList.add('spinning');

  try {
    const resp = await fetch(`${FUNCTIONS_BASE_URL}/syncStravaStats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const result = await resp.json();
    if (result.success) {
      window.showToast('Strava synchronizována!', 'success');
    } else {
      throw new Error(result.error || 'Chyba synchronizace');
    }
  } catch (err) {
    window.showToast('Synchronizace selhala: ' + err.message, 'error');
  } finally {
    if (syncIcon) syncIcon.classList.remove('spinning');
  }
};

boot();
