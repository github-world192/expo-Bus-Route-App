// Service Worker for PWA functionality
const CACHE_NAME = 'taipei-bus-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/icon.png',
  '/assets/splash.png',
];

// 安裝 Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(urlsToCache).catch((err) => {
        console.error('Failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// 啟動 Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 攔截網路請求
self.addEventListener('fetch', (event) => {
  // 只快取 GET 請求
  if (event.request.method !== 'GET') {
    return;
  }

  // 跳過外部 API 請求的快取
  if (event.request.url.includes('bus.gov.taipei') || 
      event.request.url.includes('api.')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // 如果快取中有，直接返回
      if (response) {
        return response;
      }

      // 否則發起網路請求
      return fetch(event.request).then((response) => {
        // 檢查是否為有效回應
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // 複製回應（因為回應流只能用一次）
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch((err) => {
        console.error('Fetch failed:', err);
        // 可以返回一個離線頁面
        return caches.match('/index.html');
      });
    })
  );
});

// 處理推送通知（未來擴展用）
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  const options = {
    body: event.data ? event.data.text() : '新的公車資訊',
    icon: '/assets/icon.png',
    badge: '/assets/icon.png',
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification('台北公車', options)
  );
});

// 處理通知點擊
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});
