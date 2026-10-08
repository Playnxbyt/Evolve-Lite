// Evolve service worker: offline app shell + notification click handling.
const CACHE = 'evolve-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  if (req.mode === 'navigate') {
    // network first so deploys show up, cached page when offline
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res })
        .catch(() => caches.match(req).then(r => r || caches.match('./')))
    )
    return
  }
  // everything else: serve cache instantly, refresh in the background
  e.respondWith(
    caches.match(req).then(cached => {
      const fresh = fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)) }
        return res
      }).catch(() => cached)
      return cached || fresh
    })
  )
})

// Tapping a notification opens / focuses the app.
self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) if ('focus' in c) return c.focus()
      return self.clients.openWindow(self.registration.scope)
    })
  )
})

// Ready for server push later (Web Push / FCM). Does nothing until a server sends one.
self.addEventListener('push', e => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch { data = { title: 'Evolve', body: e.data && e.data.text() } }
  e.waitUntil(self.registration.showNotification(data.title || 'Evolve', {
    body: data.body || '', tag: data.tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
  }))
})
