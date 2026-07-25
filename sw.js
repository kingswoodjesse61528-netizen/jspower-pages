/* 江苏电力日前电价 PWA · service worker
   页面导航与 data.json 走 network-first，静态依赖走 cache-first。
   改版时把 VER 加一位；新 SW 激活后旧壳不再长期滞留。 */
const VER = 'jspower-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './data.json',
  './icons/icon-96-v2.png',
  './icons/icon-144-v2.png',
  './icons/icon-192-v2.png',
  './icons/icon-512-v2.png',
  './icons/apple-touch-icon-v2.png',
  './vendor/chart.umd.js'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(VER).then(c => Promise.all(SHELL.map(async asset => {
    try {
      const resp = await fetch(asset);
      if (resp.ok) await c.put(asset, resp);
    } catch (_) {}
  }))));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VER).map(k => caches.delete(k))))
         .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (e.request.mode === 'navigate' ||
      (url.origin === location.origin && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')))) {
    e.respondWith(
      fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(VER).then(c => c.put('./index.html', copy));
        return resp;
      }).catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  if (url.pathname.endsWith('/data.json')) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const copy = resp.clone();
        caches.open(VER).then(c => c.put('./data.json', copy));
        return resp;
      }).catch(() => caches.match('./data.json').then(hit => hit || fetch(e.request)))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
      if (resp.ok && url.origin === location.origin) {
        const copy = resp.clone();
        caches.open(VER).then(c => c.put(e.request, copy));
      }
      return resp;
    }).catch(() => hit))
  );
});
