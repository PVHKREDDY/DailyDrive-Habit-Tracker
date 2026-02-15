/* ============================================
   DailyDrive — Service Worker
   Enables offline support & PWA install
   ============================================ */

const CACHE_NAME = 'dailydrive-v12';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// External resources to cache (CDN)
const EXTERNAL_CACHE = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
];

// Install — cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache local assets (ignore failures for files that don't exist yet)
      const localPromise = Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url).catch(() => {}))
      );
      // Cache external resources
      const externalPromise = Promise.allSettled(
        EXTERNAL_CACHE.map(url => cache.add(url).catch(() => {}))
      );
      return Promise.all([localPromise, externalPromise]);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch — Network first, fallback to cache (for dynamic data freshness)
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Firebase/Google API requests (should always go to network)
  if (request.url.includes('firestore.googleapis.com') ||
      request.url.includes('identitytoolkit.googleapis.com') ||
      request.url.includes('securetoken.googleapis.com') ||
      request.url.includes('apis.google.com')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone and cache the fresh response
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, clone);
        });
        return response;
      })
      .catch(() => {
        // Network failed — serve from cache
        return caches.match(request).then(cached => {
          return cached || new Response('Offline — content not cached', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
      })
  );
});
