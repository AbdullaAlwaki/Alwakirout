//  set up a cacheName variable here
const cacheName = "v1";

//  Set up a list of files to cache here.
const filesToCache = [
  "index.html",
  "offline.html",
  "script.js",
  "style.css",
  "manifest.json",
  "/images/favicon.ico",
  "/images/icon-128x128.png",
  "/images/icon-144x144.png",
  "/images/icon-152x152.png",
  "/images/icon-192x192.png",
  "/images/icon-384x384.png",
  "/images/icon-48x48.png",
  "/images/icon-512x512.png",
  "/images/icon-72x72.png",
  "/images/icon-96x96.png"
];

const self = this;

//  Add an install event listener here
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(cacheName).then((cache) => {
      console.log("Opened Cache");
      return cache.addAll(filesToCache);
    })
  );
});

//  Add an activate event listener here
self.addEventListener("activate", (e) => {
    const cacheWhitelist = [];
    cacheWhitelist.push(cacheName);
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((thisCacheName) => {
          if (!cacheWhitelist.includes(thisCacheName)) {
            return caches.delete(thisCacheName);
          }
          return null;
        })
      );
    })
  );
});

//  Add a fetch event listener here
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((response) => {
      if (response) return response;
      return fetch(e.request)
        .then((networkResponse) => {
          // Optionally cache new requests
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === "basic"
          ) {
            const responseClone = networkResponse.clone();
            caches.open(cacheName).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match("offline.html"));
    })
  );
});
