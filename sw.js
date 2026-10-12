// Service Worker - Çevrimdışı destek
const CACHE_NAME = "hava-durumu-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// Kurulum: statik dosyaları önbelleğe al
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Aktivasyon: eski sürüm önbellekleri temizle
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch stratejisi:
//  - API istekleri: network-first (çevrimiçi veri güncel olsun)
//  - Statik dosyalar: cache-first, ağdan yeniden deneme
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API çağrıları → network-first
  if (url.hostname.includes("open-meteo.com") || url.hostname.includes("nominatim")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Statik dosyalar → cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          return res;
        })
      );
    })
  );
});