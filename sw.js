const CACHE_NAME = '3d-texture-painter-v4';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './manifest.json',
    './js/lib/three.min.js',
    './js/lib/OrbitControls.js',
    './js/lib/OBJLoader.js',
    './js/tools/Utils.js',
    './js/tools/Brush.js',
    './js/tools/Eraser.js',
    './js/tools/Blur.js',
    './js/tools/Smear.js',
    './js/storage.js',
    './js/globals.js',
    './js/HistoryManager.js',
    './js/LayerManager.js',
    './js/UIManager.js',
    './js/ThreeEngine.js',
    './checker.jpg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.all(
                ASSETS_TO_CACHE.map(url => {
                    return cache.add(url).catch(err => {
                        console.warn('Failed to cache:', url, err);
                    });
                })
            );
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
