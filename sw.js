/* UroBank service worker: keeps the app available without internet.
   The app shell is cached at install; a new version arrives when this file changes. */
const VERSION = 'urobank-0cf845cd98';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
const LAZY = ['pdf.min.js', 'pdf.worker.min.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(SHELL.map((p) => new Request(p, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('urobank-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // GitHub API and anything else: straight to the network
  const scope = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(scope)) return;
  const rel = url.pathname.slice(scope.length);
  if (req.mode === 'navigate' || rel === '' || rel === 'index.html') {
    e.respondWith(
      caches.open(VERSION)
        .then((c) => c.match('./').then((hit) => hit || c.match('index.html')))
        .then((hit) => hit || fetch(req))
    );
    return;
  }
  if (SHELL.includes(rel)) { e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req))); return; }
  // the PDF reader: kept after its first use (a missing file never breaks the app's install)
  if (LAZY.includes(rel)) {
    e.respondWith(
      caches.open(VERSION).then((c) => c.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((r) => {
        if (r && r.ok) c.put(req, r.clone());
        return r;
      })))
    );
  }
});
