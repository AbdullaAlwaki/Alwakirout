//  set up a cacheName variable here
const cacheName = "v1";

//  Set up a list of files to cache here.
const filesToCache = [
  "index.html",
  "offline.html",
  "script.js",
  "style.css",
  "manifest.json",
  "images/favicon.ico",
  // Android icons
  "images/android/android-launchericon-144-144.png",
  "images/android/android-launchericon-192-192.png",
  "images/android/android-launchericon-48-48.png",
  "images/android/android-launchericon-512-512.png",
  "images/android/android-launchericon-72-72.png",
  "images/android/android-launchericon-96-96.png",
  // iOS icons (just a few for fallback)
  "images/ios/120.png",
  "images/ios/144.png",
  "images/ios/152.png",
  "images/ios/192.png",
  "images/ios/256.png",
  // Windows icons (just a few for fallback)
  "images/windows11/LargeTile.scale-100.png",
  "images/windows11/SmallTile.scale-100.png"
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
