const CACHE_NAME = '3d-texture-painter-v19';

// Önbelleğe alınacak dosyaların listesi (Uygulama Kabuğu)
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
    './js/PaintShaders.js',
    './js/LayerManager.js',
    './js/UIManager.js',
    './js/ThreeEngine.js',
    './js/NetworkManager.js',
    './checker.jpg',
    'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js',
    'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

// Kurulum aşaması: Dosyaları önbelleğe al
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.all(
                ASSETS_TO_CACHE.map(url => {
                    // GitHub Pages HTTP önbelleğini (10 dk) delmek için cache-busting veya no-store
                    const request = new Request(url, { cache: 'no-store' });
                    return fetch(request).then(response => {
                        if (!response.ok) throw new Error('Network response not ok');
                        return cache.put(url, response);
                    }).catch(err => {
                        console.warn('Failed to cache:', url, err);
                    });
                })
            );
        })
    );
});

// Etkinleştirme aşaması: Eski önbellekleri temizle (Eğer versiyon değişirse)
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

// İstek yakalama: Önce önbelleğe bak, yoksa ağdan çek
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

// Güncelleme için beklemeyi atla
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
