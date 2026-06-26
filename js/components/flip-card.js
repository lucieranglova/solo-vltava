// Flip card component with:
// - CSS 3D flip animation
// - Number counter animation (ease-out cubic, requestAnimationFrame)
// - Mountain SVG fill animation
// - Touch swipe support

const VLTAVA_KM = 430;
const EVEREST_M = 8849;

let isFlipped = false;
let touchStartX = 0;
let frontAnimated = false;
let backAnimated = false;

export function initFlipCard() {
  const card = document.getElementById('flip-card');
  const wrapper = document.getElementById('flip-card-wrapper');
  const prevBtn = document.getElementById('flip-prev');
  const nextBtn = document.getElementById('flip-next');
  const dots = document.querySelectorAll('.flip-dot');

  if (!card) return;

  // Arrow navigation
  if (prevBtn) prevBtn.addEventListener('click', () => { if (isFlipped) flipTo(false); });
  if (nextBtn) nextBtn.addEventListener('click', () => { if (!isFlipped) flipTo(true); });

  // Dot navigation
  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const side = parseInt(dot.dataset.side);
      flipTo(side === 1);
    });
  });

  // Touch swipe
  card.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  card.addEventListener('touchend', e => {
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 40) {
      flipTo(delta < 0); // swipe left → show back, swipe right → show front
    }
  }, { passive: true });

  // Strava badge click → sync
  const stravaBadge = document.getElementById('strava-badge');
  if (stravaBadge) {
    stravaBadge.addEventListener('click', () => {
      if (window.syncStrava) window.syncStrava();
    });
  }
}

export function flipTo(showBack) {
  const card = document.getElementById('flip-card');
  if (!card) return;
  isFlipped = showBack;
  card.classList.toggle('flipped', showBack);

  // Update dots
  document.querySelectorAll('.flip-dot').forEach((dot, i) => {
    dot.classList.toggle('active', showBack ? i === 1 : i === 0);
  });

  // Animate the newly visible face if not yet animated
  if (showBack && !backAnimated) {
    const target = parseFloat(card.dataset.elevTarget || '0');
    const current = parseFloat(card.dataset.elevCurrent || '0');
    setTimeout(() => {
      animateNumber('flip-elev', 0, current, 1200);
      animateMountain('mountain-fill-elev', 'mountain-pct-elev', current, target);
      backAnimated = true;
    }, 350);
  }
}

export function updateFlipCard(stats, config) {
  const card = document.getElementById('flip-card');
  if (!card) return;

  const km = stats?.totalKm || 0;
  const elev = stats?.totalElevationM || 0;
  const targetKm = config?.targetDistanceKm || 840;
  const targetElev = config?.targetElevationM || 12000;

  // Store for re-animation on flip
  card.dataset.kmCurrent = km;
  card.dataset.elevCurrent = elev;
  card.dataset.kmTarget = targetKm;
  card.dataset.elevTarget = targetElev;

  // Update target labels
  const kmTargetEl = document.getElementById('flip-km-target');
  const elevTargetEl = document.getElementById('flip-elev-target');
  if (kmTargetEl) kmTargetEl.textContent = `cíl: ${targetKm} km`;
  if (elevTargetEl) elevTargetEl.textContent = `cíl: ${targetElev.toLocaleString('cs-CZ')} m`;

  // Animate front (km) on initial load
  if (!frontAnimated) {
    animateNumber('flip-km', 0, km, 1200);
    animateMountain('mountain-fill-km', 'mountain-pct-km', km, targetKm);
    frontAnimated = true;
  } else {
    // Just update numbers without animation on subsequent updates
    const kmEl = document.getElementById('flip-km');
    if (kmEl) kmEl.textContent = Math.round(km).toLocaleString('cs-CZ');
    updateMountainInstant('mountain-fill-km', 'mountain-pct-km', km, targetKm);
  }

  // Update comparison labels
  updateComparisons(km, elev);

  // Strava source/time badge
  if (stats?.source === 'strava' && stats?.lastUpdatedAt) {
    const ts = stats.lastUpdatedAt?.toDate?.() || new Date(stats.lastUpdatedAt);
    const label = document.getElementById('strava-badge-label');
    if (label) {
      const diff = Date.now() - ts.getTime();
      const mins = Math.floor(diff / 60000);
      label.textContent = mins < 2 ? 'Právě teď' : mins < 60 ? `${mins} min` : 'Strava';
    }
  }

  // If back side is visible, also update elevation
  if (isFlipped) {
    const elevEl = document.getElementById('flip-elev');
    if (elevEl) elevEl.textContent = Math.round(elev).toLocaleString('cs-CZ');
    updateMountainInstant('mountain-fill-elev', 'mountain-pct-elev', elev, targetElev);
    updateComparisons(km, elev);
  }
}

function updateComparisons(km, elev) {
  const kmComp = document.getElementById('flip-km-comparison');
  const elevComp = document.getElementById('flip-elev-comparison');
  if (kmComp) {
    const ratio = (km / VLTAVA_KM).toFixed(1);
    kmComp.textContent = `≈ ${ratio}× délka Vltavy`;
  }
  if (elevComp) {
    const ratio = (elev / EVEREST_M).toFixed(2);
    elevComp.textContent = `≈ ${ratio}× výška Everestu`;
  }
}

function animateNumber(elId, from, to, duration) {
  const el = document.getElementById(elId);
  if (!el) return;
  const start = performance.now();

  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const current = from + (to - from) * eased;
    el.textContent = Math.round(current).toLocaleString('cs-CZ');
    if (t < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function animateMountain(fillId, pctId, current, target) {
  const fillEl = document.getElementById(fillId);
  const pctEl = document.getElementById(pctId);
  if (!fillEl) return;

  const pct = target > 0 ? Math.min(current / target, 1) : 0;

  // Animate scaleY from 0 to pct
  const start = performance.now();
  const duration = 1400;

  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const scale = eased * pct;
    fillEl.style.transform = `scaleY(${scale})`;
    if (pctEl) pctEl.textContent = Math.round(scale * 100) + '%';
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function updateMountainInstant(fillId, pctId, current, target) {
  const fillEl = document.getElementById(fillId);
  const pctEl = document.getElementById(pctId);
  if (!fillEl) return;
  const pct = target > 0 ? Math.min(current / target, 1) : 0;
  fillEl.style.transform = `scaleY(${pct})`;
  if (pctEl) pctEl.textContent = Math.round(pct * 100) + '%';
}
