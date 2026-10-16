// Offline dependency compatibility checks. No SMTP, provider, or real filesystem writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const nodemailer = require('nodemailer');
const sharp = require('sharp');
const { SourceMapConsumer, SourceMapGenerator } = require('source-map-js');

function load(file, mocks, env = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { exports, require: name => mocks[name] || require(name),
    process: { env }, Buffer, URL, console, AbortSignal,
    fetch: async () => { throw new Error('Outbound network forbidden'); },
  }, { filename: file });
  return exports;
}

(async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const normal = await transport.sendMail({ from: { name: 'Тест', address: 'sender@example.test' },
    to: 'user+tag@example.test', replyTo: 'admin@example.test', subject: 'Проверка', html: '<p>Тест</p>' });
  assert.deepEqual(normal.envelope.to, ['user+tag@example.test']);
  assert.match(normal.message.toString(), /Reply-To: admin@example.test/);
  for (const to of ['"user"@example.com(x)evil.com', '"user"@example.com(a)(b)evil.com']) {
    const result = await transport.sendMail({ from: 'sender@example.test', to, text: 'test' });
    assert.deepEqual(result.envelope.to, ['user@example.com'], 'Exact envelope regression');
  }
  const malformed = await transport.sendMail({ from: 'sender@example.test', to: 'x('.repeat(1000), text: 'test' });
  assert.ok(Array.isArray(malformed.envelope.to));
  const providers = {
    '@/lib/notification-result': { providerFailure: () => ({ status: 'rejected' }) },
    '@/lib/notification-smtp-budget': { reserveSmtpBudget: async () => null },
  };
  assert.equal((await load('src/lib/notifications.ts', providers).deliverEmail('a@example.test','test','test')).status, 'not_configured');
  for (const fail of [false, true]) {
    let calls = 0;
    const api = load('src/lib/notifications.ts', { ...providers, nodemailer: { createTransport(options) {
      assert.equal(options.requireTLS, true);
      return { sendMail: async message => { calls++; assert.equal(message.to, 'a@example.test');
        if (fail) throw new Error('offline failure'); return { messageId: 'test-id' }; } };
    } } }, { SMTP_HOST: 'smtp.example.test', SMTP_USER: 'test', SMTP_PASSWORD: 'synthetic', EMAIL_FROM: 'sender@example.test' });
    assert.equal((await api.deliverEmail('a@example.test','test','test')).status, fail ? 'uncertain' : 'accepted');
    assert.equal(calls, 1);
  }
  console.log('PASS offline email envelope, headers, delivery outcomes');

  assert.ok(sharp.versions.rsvg && sharp.versions.rsvg.localeCompare('2.63.2', undefined, { numeric: true }) >= 0);
  for (const format of ['png', 'jpeg', 'webp', 'gif']) {
    const image = await sharp({ create: { width: 8, height: 8, channels: 4, background: '#9944bb' } }).toFormat(format).toBuffer();
    assert.equal((await sharp(image, { animated: true }).metadata()).format, format);
    for (const file of ['src/app/api/admin/upload/route.ts', 'src/app/api/upload/route.ts']) {
      let writes = 0;
      const api = load(file, { '@/lib/admin-auth': { requireAdmin: async () => null },
        'fs': { existsSync: () => true }, 'fs/promises': { mkdir: async () => {}, writeFile: async () => { writes++; } },
        'next/server': { NextResponse: { json: (data, options) => ({ status: options?.status || 200, data }) } } });
      const request = bytes => ({ formData: async () => new Map([['file', { size: bytes.length, type: `image/${format}`, name: `test.${format}`, arrayBuffer: async () => bytes }]]) });
      assert.equal((await api.POST(request(image))).status, 200); assert.equal(writes, 1);
      assert.equal((await api.POST(request(Buffer.from('not an image')))).status, 400); assert.equal(writes, 1);
    }
  }
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="purple"/></svg>');
  assert.equal((await sharp(svg).metadata()).format, 'svg');
  const base = await sharp({ create: { width: 32, height: 32, channels: 4, background: '#fff' } }).png().toBuffer();
  const logo = await sharp(svg).resize(8, 8).extend({ top: 1, bottom: 1, left: 1, right: 1, background: '#fff' }).png().toBuffer();
  assert.ok((await sharp(base).composite([{ input: logo, gravity: 'centre' }]).png().toBuffer()).length > 0);
  console.log('PASS patched librsvg', sharp.versions.rsvg, 'image uploads, malformed files, SVG and QR operations');

  const generator = new SourceMapGenerator({ file: 'output.css' });
  generator.addMapping({ generated: { line: 1, column: 0 }, original: { line: 1, column: 0 }, source: 'input.css' });
  const map = generator.toJSON();
  assert.equal(new SourceMapConsumer(map).originalPositionFor({ line: 1, column: 0 }).source, 'input.css');
  for (const line of [-1, 0.5, Infinity, 1e12]) {
    assert.throws(() => { const consumer = new SourceMapConsumer({ version: 3, sections: [{ offset: { line, column: 0 }, map }] });
      consumer.eachMapping(() => {}); }, `Invalid offset ${line}`);
  }
  console.log('PASS source map valid round-trip and invalid offsets');
})().catch(error => { console.error(error); process.exitCode = 1; });
