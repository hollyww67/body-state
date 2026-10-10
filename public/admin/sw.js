/* Admin PWA: network-only. Never store HTML, API responses, credentials or client records. */
const OFFLINE = `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Нет связи — BODY STATE</title><style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f3f6f5;color:#17211f;font:16px system-ui}main{max-width:32rem;padding:28px}h1{font-size:26px}p{line-height:1.6}a{display:inline-block;padding:14px 20px;border-radius:12px;background:#147d72;color:white;text-decoration:none}</style><main><h1>Нет соединения</h1><p>Админке нужен интернет, чтобы показывать актуальные записи и сохранять изменения. Данные клиентов не сохраняются для офлайн-доступа.</p><a href="/admin/dashboard">Попробовать снова</a></main></html>`;
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || url.origin !== self.location.origin || !url.pathname.startsWith('/admin/')) return;
  event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => new Response(OFFLINE, {
    status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  })));
});
