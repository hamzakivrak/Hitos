// HitosHK - Çevrimdışı Service Worker
// Sürüm değiştirince CACHE adını artırın (örn. v78) ki eski önbellek silinsin.
const CACHE = 'hitoshk-v77';

// Uygulama kabuğu + kütüphaneler (ilk açılışta indirilir)
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://unpkg.com/pizzip@3.1.4/dist/pizzip.js',
  'https://cdnjs.cloudflare.com/ajax/libs/docxtemplater/3.37.11/docxtemplater.js',
  'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://unpkg.com/docx-preview/dist/docx-preview.min.js',
  'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap'
];

// Asla önbelleğe alınmayacak (canlı veri / API / yetkilendirme)
const NO_CACHE = [
  'generativelanguage.googleapis.com',
  'apis.google.com',
  'accounts.google.com',
  'www.googleapis.com',
  'raw.githubusercontent.com',   // şablon zip'i IndexedDB'de tutuluyor
  'corsproxy.io',
  'api.allorigins.win'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Biri inmese bile diğerleri kaydedilsin
    await Promise.all(PRECACHE.map(async url => {
      try {
        const isCross = url.startsWith('http');
        const req = new Request(url, isCross ? { mode: 'cors' } : {});
        const res = await fetch(req);
        if (res.ok) await cache.put(url, res);
      } catch (e) { /* sessizce geç */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (NO_CACHE.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) return;

  // Sayfa açılışı: önce ağ (güncel sürüm gelsin), internet yoksa önbellek
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
        return res;
      } catch (e) {
        return (await caches.match(req, { ignoreSearch: true })) ||
               (await caches.match('./index.html')) ||
               (await caches.match('./'));
      }
    })());
    return;
  }

  // Diğer her şey: önce önbellek, yoksa ağdan al ve kaydet
  // (Tesseract worker/wasm/tur.traineddata ilk OCR kullanımında burada önbelleğe girer)
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (e) {
      return cached || Response.error();
    }
  })());
});
