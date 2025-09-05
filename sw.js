const CACHE_NAME = 'secbrain-v1.0.0';
const STATIC_CACHE = 'secbrain-static-v1.0.0';
const DYNAMIC_CACHE = 'secbrain-dynamic-v1.0.0';

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/css/components/header.css',
  '/css/components/calendar.css',
  '/css/components/modal.css',
  '/css/components/auth.css',
  '/css/components/loading.css',
  '/css/themes/dark-theme.css',
  '/css/themes/light-theme.css',
  '/css/responsive.css',
  '/js/main.js',
  '/js/config/firebase-config.js',
  '/js/utils/date-utils.js',
  '/js/utils/storage-utils.js',
  '/js/utils/helpers.js',
  '/js/services/auth-service.js',
  '/js/services/database-service.js',
  '/js/services/sync-service.js',
  '/js/data/habit-manager.js',
  '/js/data/progress-manager.js',
  '/js/components/theme-manager.js',
  '/js/components/calendar.js',
  '/js/components/habit-modal.js',
  '/js/components/header.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.0/firebase-database-compat.js'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Static files cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static files', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated successfully');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip Firebase and external API requests
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis') || 
      url.hostname.includes('gstatic')) {
    return;
  }

  // Handle different types of requests
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          // Return cached version if available
          if (cachedResponse) {
            return cachedResponse;
          }

          // Otherwise, fetch from network
          return fetch(request)
            .then((networkResponse) => {
              // Don't cache if not a valid response
              if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                return networkResponse;
              }

              // Clone the response
              const responseToCache = networkResponse.clone();

              // Cache dynamic content
              caches.open(DYNAMIC_CACHE)
                .then((cache) => {
                  cache.put(request, responseToCache);
                });

              return networkResponse;
            })
            .catch(() => {
              // If network fails and no cache, show offline page for navigation requests
              if (request.destination === 'document') {
                return caches.match('/index.html');
              }
            });
        })
    );
  }
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Sync offline data when connection is restored
      syncOfflineData()
    );
  }
});

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New habit reminder!',
    icon: '/assets/images/icons/icon-192x192.png',
    badge: '/assets/images/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open SecBrain',
        icon: '/assets/images/icons/icon-192x192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/assets/images/icons/icon-192x192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('SecBrain', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Helper function to sync offline data
async function syncOfflineData() {
  try {
    // Get offline data from IndexedDB
    const offlineData = await getOfflineData();
    
    if (offlineData && offlineData.length > 0) {
      console.log('Service Worker: Syncing offline data', offlineData.length, 'items');
      
      // Send data to Firebase
      for (const data of offlineData) {
        await syncDataToFirebase(data);
      }
      
      // Clear offline data after successful sync
      await clearOfflineData();
      console.log('Service Worker: Offline data synced successfully');
    }
  } catch (error) {
    console.error('Service Worker: Failed to sync offline data', error);
  }
}

// Helper function to get offline data from IndexedDB
async function getOfflineData() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SecBrainOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['offlineData'], 'readonly');
      const store = transaction.objectStore('offlineData');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
  });
}

// Helper function to sync data to Firebase
async function syncDataToFirebase(data) {
  // This would be implemented based on the specific data structure
  // For now, we'll just log the data
  console.log('Service Worker: Syncing data to Firebase', data);
}

// Helper function to clear offline data
async function clearOfflineData() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SecBrainOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['offlineData'], 'readwrite');
      const store = transaction.objectStore('offlineData');
      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    };
  });
}

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_OFFLINE_DATA') {
    cacheOfflineData(event.data.data);
  }
});

// Helper function to cache offline data
async function cacheOfflineData(data) {
  try {
    const request = indexedDB.open('SecBrainOffline', 1);
    
    request.onerror = () => {
      console.error('Service Worker: Failed to open IndexedDB');
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offlineData')) {
        db.createObjectStore('offlineData', { keyPath: 'id', autoIncrement: true });
      }
    };
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['offlineData'], 'readwrite');
      const store = transaction.objectStore('offlineData');
      store.add({
        data: data,
        timestamp: Date.now()
      });
    };
  } catch (error) {
    console.error('Service Worker: Failed to cache offline data', error);
  }
}
