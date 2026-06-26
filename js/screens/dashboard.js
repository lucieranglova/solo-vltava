import { getRaceConfig, listenPerformanceStats, listenSegments, listenChecklistItems, formatDate, tsToDate } from '../firestore.js';
import { getCurrentUid } from '../auth.js';
import { getProfile, listenProfile } from '../firestore.js';
import { navigateTo } from '../router.js';

let _unsubStats = null;
let _unsubSegments = null;
let _unsubChecklist = null;
let _unsubProfile = null;

export async function initDashboard() {
  cleanup();

  const uid = getCurrentUid();
  let raceConfig = await getRaceConfig();
  if (!raceConfig) return;

  // Greeting & profile
  _unsubProfile = listenProfile(uid, profile => {
    const nameEl = document.getElementById('greeting-name');
    if (profile && nameEl) {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? 'Dobré ráno' : hour < 18 ? 'Dobrý den' : 'Dobrý večer';
      nameEl.textContent = `${greeting}, ${profile.name}!`;
    }
  });

  // Phase badge
  updatePhaseBadge(raceConfig);

  // Countdown
  updateCountdown(raceConfig);
  const cdInterval = setInterval(() => updateCountdown(raceConfig), 60000);
  window._dashboardCdInterval = cdInterval;

  // Race info
  const locEl = document.getElementById('race-location-dash');
  const dateEl = document.getElementById('race-date-dash');
  if (locEl) locEl.textContent = raceConfig.raceLocation || 'Lipno nad Vltavou';
  if (dateEl) dateEl.textContent = formatDate(raceConfig.raceDate);

  // Stats listener
  _unsubStats = listenPerformanceStats(stats => {
    updateKPIs(stats);
    updateLastActivity(stats);
  });

  // Segments for route progress
  _unsubSegments = listenSegments(segments => {
    updateRouteProgress(segments);
  });

  // Checklist (show in week-D phase)
  const phase = getPhase(raceConfig);
  if (phase === 'week-d' || phase === 'day-d') {
    const previewCard = document.getElementById('checklist-preview');
    if (previewCard) previewCard.style.display = '';
    _unsubChecklist = listenChecklistItems(items => {
      updateChecklistPreview(items);
    });
  }

  // Settings button
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.onclick = () => navigateTo('settings');
  }
}

function cleanup() {
  if (_unsubStats) { _unsubStats(); _unsubStats = null; }
  if (_unsubSegments) { _unsubSegments(); _unsubSegments = null; }
  if (_unsubChecklist) { _unsubChecklist(); _unsubChecklist = null; }
  if (_unsubProfile) { _unsubProfile(); _unsubProfile = null; }
  if (window._dashboardCdInterval) clearInterval(window._dashboardCdInterval);
}

function getPhase(config) {
  if (!config?.raceDate) return 'prep';
  const raceDate = new Date(config.raceDate + 'T00:00:00');
  const today = new Date();
  const diffDays = (raceDate - today) / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return 'after';
  if (diffDays < 1) return 'day-d';
  if (diffDays <= 30) return 'week-d';
  return 'prep';
}

function updatePhaseBadge(config) {
  const badge = document.getElementById('phase-badge');
  if (!badge) return;
  const phase = getPhase(config);
  const labels = {
    'prep': '🏋️ Fáze přípravy',
    'week-d': '⚡ Týden D',
    'day-d': '🎯 Den závodu',
    'after': '🏅 Po závodě'
  };
  badge.textContent = labels[phase] || '';
}

function updateCountdown(config) {
  const daysEl = document.getElementById('cd-days');
  const hoursEl = document.getElementById('cd-hours');
  const card = document.getElementById('countdown-card');

  if (!config?.raceDate || !daysEl) return;

  const raceDate = new Date(config.raceDate + 'T07:00:00'); // start at 7am
  const now = new Date();
  const diff = raceDate - now;

  if (diff < 0) {
    // After race
    daysEl.textContent = '✓';
    hoursEl.textContent = '✓';
    if (card) card.style.borderColor = 'rgba(76,175,109,0.4)';
    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  daysEl.textContent = days;
  hoursEl.textContent = String(hours).padStart(2, '0');
}

function updateKPIs(stats) {
  const kmEl = document.getElementById('kpi-km');
  const elevEl = document.getElementById('kpi-elev');
  const trainEl = document.getElementById('kpi-trainings');

  if (!stats) {
    if (kmEl) kmEl.textContent = '0';
    if (elevEl) elevEl.textContent = '0';
    if (trainEl) trainEl.textContent = '0';
    return;
  }
  if (kmEl) kmEl.textContent = formatNum(stats.totalKm || 0);
  if (elevEl) elevEl.textContent = formatNum(stats.totalElevationM || 0);
  if (trainEl) trainEl.textContent = stats.totalTrainings || 0;
}

function updateLastActivity(stats) {
  const sourceEl = document.getElementById('last-activity-source');
  const kmEl = document.getElementById('la-km');
  const elevEl = document.getElementById('la-elev');
  const updatedEl = document.getElementById('la-updated');

  if (!stats) return;

  if (sourceEl) sourceEl.textContent = stats.source === 'strava' ? 'Strava' : 'Ruční';
  if (kmEl) kmEl.textContent = formatNum(stats.totalKm || 0);
  if (elevEl) elevEl.textContent = formatNum(stats.totalElevationM || 0);

  if (updatedEl && stats.lastUpdatedAt) {
    const d = tsToDate(stats.lastUpdatedAt);
    if (d) {
      updatedEl.textContent = 'Aktualizováno ' + d.toLocaleString('cs-CZ', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      });
    }
  }
}

function updateRouteProgress(segments) {
  const pctEl = document.getElementById('route-progress-pct');
  const barEl = document.getElementById('route-progress-bar');
  const subEl = document.getElementById('route-progress-sub');

  const total = segments.length;
  const tried = segments.filter(s => s.tried).length;
  const pct = total > 0 ? Math.round((tried / total) * 100) : 0;

  if (pctEl) pctEl.textContent = pct + '%';
  if (barEl) barEl.style.width = pct + '%';
  if (subEl) subEl.textContent = `${tried} z ${total} úseků vyzkoušeno`;
}

function updateChecklistPreview(items) {
  const fillEl = document.getElementById('checklist-progress-fill');
  const textEl = document.getElementById('checklist-progress-text');

  const total = items.length;
  const checked = items.filter(i => i.checked).length;
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  if (fillEl) fillEl.style.width = pct + '%';
  if (textEl) textEl.textContent = `${checked} / ${total}`;
}

function formatNum(n) {
  const num = Math.round(n);
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}
