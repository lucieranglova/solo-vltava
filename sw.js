const CACHE_NAME = 'solo-vltava-v1';
const BASE = '/solo-vltava';
const STATIC_ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/css/main.css`,
  `${BASE}/js/app.js`,
  `${BASE}/js/firebase-config.js`,
  `${BASE}/js/auth.js`,
  `${BASE}/js/firestore.js`,
  `${BASE}/js/router.js`,
  `${BASE}/js/illustrations.js`,
  `${BASE}/js/screens/onboarding.js`,
  `${BASE}/js/screens/dashboard.js`,
  `${BASE}/js/screens/performance.js`,
  `${BASE}/js/screens/route.js`,
  `${BASE}/js/screens/segment-detail.js`,
  `${BASE}/js/screens/organization.js`,
  `${BASE}/js/screens/schedule.js`,
  `${BASE}/js/screens/checklist.js`,
  `${BASE}/js/screens/accommodations.js`,
  `${BASE}/js/screens/reservations.js`,
  `${BASE}/js/screens/contacts.js`,
  `${BASE}/js/screens/weather.js`,
  `${BASE}/js/screens/gallery.js`,
  `${BASE}/js/screens/settings.js`,
  `${BASE}/js/components/flip-card.js`,
  `${BASE}/manifest.json`,
  'https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=Nunito:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
      )
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('strava.com') ||
    url.hostname.includes('cloudfunctions.net') ||
    request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, toCache));
        return response;
      }).catch(() => {
        if (request.mode === 'navigate') return caches.match(`${BASE}/index.html`);
      });
    })
  );
});
