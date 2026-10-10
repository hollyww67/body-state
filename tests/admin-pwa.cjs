const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sharp = require('sharp');

(async () => {
  const manifest = JSON.parse(fs.readFileSync('public/admin-manifest.webmanifest', 'utf8'));
  assert.equal(manifest.start_url, '/admin/dashboard');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const metadata = await sharp(`public${icon.src}`).metadata();
    assert.equal(`${metadata.width}x${metadata.height}`, icon.sizes);
  }
  const handlers = {};
  let fail = false;
  const context = {
    URL, Response,
    self: {
      location: { origin: 'https://body-state.ru' },
      addEventListener: (name, handler) => { handlers[name] = handler; },
      skipWaiting: async () => {}, clients: { claim: async () => {} },
    },
    fetch: async (_request, options) => {
      assert.equal(options.cache, 'no-store');
      if (fail) throw new Error('offline');
      return new Response('network response');
    },
  };
  vm.runInNewContext(fs.readFileSync('public/admin/sw.js', 'utf8'), context);
  for (const name of ['install', 'activate']) {
    let work;
    handlers[name]({ waitUntil: promise => { work = promise; } });
    await work;
  }
  function request(path, method = 'GET', mode = 'navigate') {
    let result;
    handlers.fetch({ request: { url: `https://body-state.ru${path}`, method, mode }, respondWith: value => { result = value; } });
    return result;
  }
  assert.equal(await (await request('/admin/dashboard')).text(), 'network response');
  for (const path of ['/api/admin/bookings', '/', '/account', '/login']) assert.equal(request(path), undefined);
  assert.equal(request('/admin/dashboard', 'POST'), undefined);
  assert.equal(request('/admin/dashboard', 'GET', 'cors'), undefined);
  fail = true;
  const offline = await request('/admin/calendar');
  assert.equal(offline.status, 503);
  assert.equal(offline.headers.get('cache-control'), 'no-store');
  assert.match(await offline.text(), /Нет соединения/);
  console.log('Admin PWA: manifest, icons, worker lifecycle, network-only navigation and offline fallback PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
