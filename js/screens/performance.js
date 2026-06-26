import { listenPerformanceStats, savePerformanceStats, getRaceConfig } from '../firestore.js';
import { initFlipCard, updateFlipCard } from '../components/flip-card.js';
import { navigateTo } from '../router.js';

let _unsubStats = null;
let _config = null;
let _initialized = false;

export async function initPerformance() {
  _config = await getRaceConfig();

  // Init flip card on first load
  if (!_initialized) {
    initFlipCard();
    _initialized = true;
  }

  // Stats listener
  if (_unsubStats) { _unsubStats(); _unsubStats = null; }
  _unsubStats = listenPerformanceStats(stats => {
    updateFlipCard(stats, _config);
    updateStravaSection(stats);
    prefillManualForm(stats);
  });

  // Strava badge
  updateStravaUI();

  // Strava connect btn
  const connectBtn = document.getElementById('strava-connect-btn');
  if (connectBtn) {
    connectBtn.onclick = () => window.connectStrava?.();
  }

  // Manual stats form
  const manualForm = document.getElementById('manual-stats-form');
  if (manualForm) {
    manualForm.onsubmit = handleManualSubmit;
  }
}

function updateStravaUI() {
  const connected = localStorage.getItem('stravaConnected') === '1';
  const statusText = document.getElementById('strava-status-text');
  const connectBtn = document.getElementById('strava-connect-btn');
  const desc = document.getElementById('strava-desc');

  if (connected) {
    if (statusText) statusText.textContent = 'Připojeno';
    if (connectBtn) { connectBtn.textContent = 'Synchronizovat'; connectBtn.onclick = () => window.syncStrava?.(); }
    if (desc) desc.textContent = 'Klepnutím na odznak Strava spustíš synchronizaci tréninků.';
  } else {
    if (statusText) statusText.textContent = 'Nepřipojeno';
    if (connectBtn) { connectBtn.textContent = 'Připojit'; connectBtn.onclick = () => window.connectStrava?.(); }
    if (desc) desc.textContent = 'Připoj svůj Strava účet pro automatickou synchronizaci tréninků.';
  }

  // Update settings
  const settingsStatus = document.getElementById('strava-settings-status');
  const settingsBtn = document.getElementById('strava-settings-btn');
  if (settingsStatus) settingsStatus.textContent = connected ? 'Připojeno' : 'Nepřipojeno';
  if (settingsBtn) {
    settingsBtn.textContent = connected ? 'Synchronizovat' : 'Připojit';
    settingsBtn.onclick = connected ? () => window.syncStrava?.() : () => window.connectStrava?.();
  }
}

function updateStravaSection(stats) {
  if (!stats) return;
  const badgeLabel = document.getElementById('strava-badge-label');
  if (!badgeLabel) return;

  if (stats.source === 'strava' && stats.lastUpdatedAt) {
    const ts = stats.lastUpdatedAt?.toDate?.() || new Date(stats.lastUpdatedAt);
    const diffMin = Math.floor((Date.now() - ts.getTime()) / 60000);
    if (diffMin < 2) badgeLabel.textContent = 'Právě teď';
    else if (diffMin < 60) badgeLabel.textContent = `${diffMin} min`;
    else badgeLabel.textContent = 'Strava';
  }
}

function prefillManualForm(stats) {
  if (!stats) return;
  const km = document.getElementById('manual-km');
  const elev = document.getElementById('manual-elev');
  const trainings = document.getElementById('manual-trainings');
  const longest = document.getElementById('manual-longest');
  if (km && !km._dirty) km.value = stats.totalKm || '';
  if (elev && !elev._dirty) elev.value = stats.totalElevationM || '';
  if (trainings && !trainings._dirty) trainings.value = stats.totalTrainings || '';
  if (longest && !longest._dirty) longest.value = stats.longestRunKm || '';
}

async function handleManualSubmit(e) {
  e.preventDefault();
  const btn = e.target.querySelector('[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Ukládám…';

  try {
    await savePerformanceStats({
      totalKm: parseFloat(document.getElementById('manual-km').value) || 0,
      totalElevationM: parseFloat(document.getElementById('manual-elev').value) || 0,
      totalTrainings: parseInt(document.getElementById('manual-trainings').value) || 0,
      longestRunKm: parseFloat(document.getElementById('manual-longest').value) || 0,
      source: 'manual'
    });
    window.showToast('Výkony uloženy!', 'success');
  } catch (err) {
    window.showToast('Chyba: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Uložit';
  }
}
