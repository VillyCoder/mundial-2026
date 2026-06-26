/*
 * sw.js - Service Worker
 * Hace la app instalable (PWA) y permite cargar la interfaz aunque
 * la conexion sea lenta. Los datos del torneo siempre vienen de la red
 * porque son en tiempo real; solo los archivos estaticos se cachean.
 */

const CACHE_NAME = 'mundial-2026-v5';

// Archivos de la interfaz que se guardan en cache al instalar la app
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/variables.css',
    '/css/base.css',
    '/css/layout.css',
    '/css/components.css',
    '/css/animations.css',
    '/js/app.js',
    '/js/scraper.js',
    '/js/config.js',
    '/js/storage.js',
    '/js/components/live-score.js',
    '/js/components/match-detail.js',
    '/js/components/calendar.js',
    '/js/components/standings.js',
    '/js/components/stats.js',
    '/js/components/teams.js',
    '/js/components/my-team.js',
    '/js/components/sidebar.js',
    '/js/notifications.js',
    '/js/channels.js'
];

// Al instalar: guarda en cache todos los archivos estaticos
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .catch(() => {})
    );
    self.skipWaiting();
});

// Al activar: borra caches de versiones anteriores
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Al hacer clic en una notificacion: abre la app y navega al partido correspondiente
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.postMessage({ type: 'NAVIGATE', url });
                    return client.focus();
                }
            }
            return clients.openWindow(self.location.origin + '/' + url);
        })
    );
});

// Estrategia de fetch:
// - Llamadas /api/: siempre a la red (datos en vivo)
// - index.html: red primero, cache solo si hay error de red (garantiza tema correcto)
// - Recursos estaticos con ?v=: siempre a la red (URL cambia con cada version)
// - Resto de estaticos: cache primero, red como fallback
self.addEventListener('fetch', event => {
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() =>
                new Response('{}', { headers: { 'Content-Type': 'application/json' } })
            )
        );
        return;
    }

    const url = new URL(event.request.url);
    const isHtml = url.pathname === '/' || url.pathname === '/index.html';
    const isVersioned = url.search.includes('v=');

    if (isHtml || isVersioned) {
        // Red primero: siempre sirve la version mas reciente
        event.respondWith(
            fetch(event.request)
                .then(res => {
                    if (isHtml && res.ok) {
                        const copy = res.clone();
                        caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
                    }
                    return res;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request))
    );
});
