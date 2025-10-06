// Pauhu AI Service Worker
// Enables offline functionality and PWA installation

const CACHE_NAME = 'pauhu-ai-v2.0.0';
const urlsToCache = [
  '/',
  '/app.html',
  '/install.html',
  '/index.html',
  '/pricing.html',
  '/assets/pauhu.ai_brand_mark_logo_nega.png',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching Pauhu AI resources');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Pauhu AI cache ready');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('🚀 Pauhu AI service worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Handle API requests to Pauhu AI
  if (url.pathname.startsWith('/v1/') || url.hostname === 'api.pauhu.ai') {
    event.respondWith(
      Promise.race([
        fetch(request),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 5000)
        )
      ]).catch(() => {
        return new Response(JSON.stringify({
          error: 'offline',
          message: 'No internet connection. Models load on demand when connected.',
          offline: true
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
  } 
  // Handle static assets
  else {
    event.respondWith(
      caches.match(request)
        .then(response => {
          // Return cached version or fetch from network
          return response || fetch(request).then(fetchResponse => {
            // Cache new resources
            if (fetchResponse.ok) {
              const responseToCache = fetchResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseToCache);
              });
            }
            return fetchResponse;
          });
        })
        .catch(() => {
          // Offline fallback for HTML pages
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
          return new Response('Offline - cached resource not available', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
  }
});

// Background sync for when user comes back online
self.addEventListener('sync', event => {
  if (event.tag === 'pauhu-sync') {
    event.waitUntil(syncWithLocalDevice());
  }
});

async function syncWithLocalDevice() {
  try {
    // Attempt to sync with local Pauhu instance
    const response = await fetch('http://localhost:8000/api/v2/sync');
    if (response.ok) {
      console.log('🔄 Successfully synced with local Pauhu device');
      
      // Notify all clients about successful sync
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'sync-success',
          message: 'Connected to local Pauhu AI'
        });
      });
    }
  } catch (error) {
    console.log('📵 Local Pauhu device not available for sync');
  }
}

// Push notifications (for future use)
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Pauhu AI notification',
    icon: '/assets/pauhu.ai_brand_mark_nega.png',
    badge: '/assets/pauhu.ai_brand_mark_nega.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'open-dashboard',
        title: 'Open Dashboard',
        icon: '/assets/pauhu.ai_brand_mark_nega.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/assets/pauhu.ai_brand_mark_nega.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Pauhu AI', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'open-dashboard') {
    event.waitUntil(
      clients.openWindow('/dashboard.html')
    );
  } else if (event.action === 'close') {
    // Just close the notification
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle messages from the main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('🚀 Pauhu AI Service Worker loaded');