const CACHE_NAME = 'bolt-calculator-cache-v27'; // キャッシュバージョンを更新

const localUrlsToCache = [
  '/',
  'index.html',
  'favicon.ico',
  'apple-touch-icon.png',
  'manifest.json',
  'style.css',   // もしあれば
  'js/app.js'    // ★ これを追加！
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      // ローカルの基本ファイルのみインストール時にキャッシュする
      return cache.addAll(localUrlsToCache);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // ファイルダウンロードやFirebaseへのリクエストは Service Worker の対象外にする
  if (requestUrl.protocol === 'blob:' || requestUrl.hostname.includes('firebase') || requestUrl.hostname.includes('googleapis.com')) {
    return;
  }

  // ▼▼▼ ここからが重要な修正箇所（ネットワークファースト戦略） ▼▼▼
  event.respondWith(
    // 1. まずネットワークからの取得を試みる
    fetch(event.request)
      .then((networkResponse) => {
        // 2. 取得に成功したら、レスポンスのクローンをキャッシュに保存する
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        // 3. 取得したての新しいレスポンスをブラウザに返す
        return networkResponse;
      })
      .catch(() => {
        // 4. ネットワークからの取得に失敗した場合（オフライン時など）、キャッシュから一致するものを探して返す
        return caches.match(event.request);
      })
  );
  // ▲▲▲ 修正ここまで ▲▲▲
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});