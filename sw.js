const CACHE_NAME = 'solo-vltava-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/app.js',
  '/js/firebase-config.js',
  '/js/auth.js',
  '/js/firestore.js',
  '/js/router.js',
  '/js/illustrations.js',
  '/js/screens/onboarding.js',
  '/js/screens/dashboard.js',
  '/js/screens/performance.js',
  '/js/screens/route.js',
  '/js/screens/segment-detail.js',
  '/js/screens/organization.js',
  '/js/screens/schedule.js',
  '/js/screens/checklist.js',
  '/js/screens/accommodations.js',
  '/js/screens/contacts.js',
  '/js/screens/gallery.js',
  '/js/screens/settings.js',
  '/js/components/flip-card.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=Nunito:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(() => {
            /* Individual failures don't block install */
          })
        )
      );
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip Firebase / API requests — let them go to network (Firestore handles offline itself)
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
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, toCache));
        return response;
      }).catch(() => {
        // Offline fallback: return index.html for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
