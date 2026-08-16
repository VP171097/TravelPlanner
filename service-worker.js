/* ============================================================
   service-worker.js — caches the app shell so TravelPlanner keeps
   working with no signal, once it's been opened at least once.
   Bump CACHE_VERSION whenever app files change to invalidate old caches.
   ============================================================ */

var CACHE_VERSION = "tp-v5";
var APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/data.js",
  "./js/ai.js",
  "./js/storage.js",
  "./js/itinerary.js",
  "./js/budget.js",
  "./js/expenses.js",
  "./js/places.js",
  "./js/packing.js",
  "./js/app.js",
  "./assets/icon.svg"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) { return cache.addAll(APP_SHELL); })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_VERSION; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

// Cache-first for app-shell files; network-first fallback for anything else,
// so external "find real options" links still work normally when online.
self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return; // let external links pass through untouched

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, copy); });
          return res;
        })
        .catch(function () {
          if (req.mode === "navigate") return caches.match("./index.html");
        });
    })
  );
});
