// Simple client-side router for SPA screens

const screens = new Map(); // name → { el, init, destroy }
let currentScreen = null;
let navScreens = ['dashboard', 'performance', 'route', 'organization', 'gallery'];

export function registerScreen(name, { init, destroy } = {}) {
  const el = document.getElementById(`screen-${name}`);
  if (!el) return;
  screens.set(name, { el, init, destroy, initialized: false });
}

export function navigateTo(name, data = {}) {
  // Validate screen exists
  if (!screens.has(name)) {
    console.warn(`Screen "${name}" not registered`);
    return;
  }

  const next = screens.get(name);
  const prev = currentScreen ? screens.get(currentScreen) : null;

  // Deactivate previous
  if (prev) {
    prev.el.classList.remove('active');
    if (prev.destroy) prev.destroy();
  }

  // Activate next
  next.el.classList.add('active');

  if (!next.initialized) {
    if (next.init) next.init(data);
    next.initialized = true;
  } else {
    if (next.init) next.init(data);
  }

  currentScreen = name;

  // Update bottom nav highlight
  updateNavHighlight(name);

  // Dispatch event for any listeners
  window.dispatchEvent(new CustomEvent('routechange', { detail: { screen: name, data } }));
}

export function getCurrentScreen() {
  return currentScreen;
}

function updateNavHighlight(name) {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.nav === name);
  });

  // Show/hide bottom nav (hide for sub-screens)
  const nav = document.getElementById('bottom-nav');
  const isMainScreen = navScreens.includes(name);
  nav.style.display = isMainScreen ? '' : 'none';
}

// Bind bottom nav items
export function initNavigation() {
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => {
      const target = el.dataset.nav;
      if (target) navigateTo(target);
    });
  });

  // Back buttons (data-back attribute)
  document.querySelectorAll('[data-back]').forEach(el => {
    el.addEventListener('click', () => {
      history.back();
    });
  });

  // Modal handling
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', () => {
      const modal = bd.closest('.modal');
      if (modal) closeModal(modal.id);
    });
  });
}

export function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}

export function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

export function showBackButton(screenName) {
  const header = document.querySelector(`#screen-${screenName} .screen-header`);
  if (!header) return;
  const existing = header.querySelector('[data-back]');
  if (!existing) return;
  existing.style.display = '';
}
