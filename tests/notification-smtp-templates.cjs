// Offline only: module imports cannot create sockets or access real runtime env.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, env = {}, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { exports, process: { env }, URL, AbortSignal, Date,
    require: key => { if (key in mocks) return mocks[key]; throw Error(`Unexpected import: ${key}`); },
    fetch: () => { throw Error('Network forbidden'); },
  }, { filename: file });
  return exports;
}
const configured = {
  NOTIFICATIONS_EMAIL_V1_ENABLED: 'true', SMTP_HOST: 'postbox.cloud.yandex.net',
  SMTP_PORT: '587', SMTP_SECURE: 'false', SMTP_USER: 'fixture-api-id',
  SMTP_PASSWORD: 'fixture-secret', SMTP_FROM: 'Body State <no-reply@example.invalid>',
  SMTP_REPLY_TO: 'support@example.invalid', EMAIL_FROM: 'legacy@example.invalid',
};
function smtp(overrides = {}, result = { accepted: ['client@example.invalid'], messageId: '<fixture-id>' }) {
  const env = { ...configured, ...overrides }, calls = [];
  const api = load('src/lib/notifications.ts', env, {
    nodemailer: { createTransport: options => {
      calls.push({ options });
      return { sendMail: async message => {
        calls.at(-1).message = message;
        if (result instanceof Error) throw result;
        return result;
      } };
    } },
    '@/lib/notification-result': { providerFailure: () => { throw Error('Unexpected fallback'); } },
    '@/lib/notification-smtp-budget': { reserveSmtpBudget: async () => null },
  });
  return { api, env, calls, send: (...args) => api.deliverTransactionalEmail(
    ...args.length ? args : ['client@example.invalid', 'Body State', '<p>Fixture</p>', 'Fixture']) };
}
async function main() {
  for (const flag of [undefined, '', 'false', 'TRUE', '1']) {
    const s = smtp({ NOTIFICATIONS_EMAIL_V1_ENABLED: flag });
    assert.equal((await s.send()).status, 'not_configured'); assert.equal(s.calls.length, 0);
  }
  for (const overrides of [{ SMTP_PASSWORD: '' }, { SMTP_FROM: undefined }, { SMTP_PORT: '465' },
    { SMTP_SECURE: 'true' }, { SMTP_FROM: 'bad\r\nBcc: other@example.invalid' },
    { SMTP_REPLY_TO: 'a@example.invalid,b@example.invalid' }]) {
    const s = smtp(overrides); assert.equal((await s.send()).status, 'not_configured');
    assert.equal(s.calls.length, 0);
  }
  const s = smtp();
  assert.equal((await s.send()).status, 'accepted');
  const { options, message } = s.calls[0];
  assert.equal(options.port, 587); assert.equal(options.secure, false);
  assert.equal(options.requireTLS, true); assert.equal(options.ignoreTLS, false);
  assert.equal(options.opportunisticTLS, false); assert.equal(options.tls.rejectUnauthorized, true);
  assert.equal(options.tls.minVersion, 'TLSv1.2'); assert.equal(options.tls.servername, configured.SMTP_HOST);
  assert.equal(options.auth.user, configured.SMTP_USER); assert.equal(options.auth.pass, configured.SMTP_PASSWORD);
  for (const timeout of ['connectionTimeout', 'greetingTimeout', 'socketTimeout', 'dnsTimeout']) assert(options[timeout] > 0);
  assert.equal(options.logger, false); assert.equal(options.debug, false);
  assert.equal(options.disableFileAccess, true); assert.equal(options.disableUrlAccess, true);
  assert.equal(message.from, configured.SMTP_FROM); assert.equal(message.replyTo, configured.SMTP_REPLY_TO);
  assert.equal(message.text, 'Fixture'); assert.equal(message.html, '<p>Fixture</p>');
  s.env.NOTIFICATIONS_EMAIL_V1_ENABLED = 'false';
  assert.equal((await s.send()).status, 'not_configured'); assert.equal(s.calls.length, 1);
  for (const args of [ ['a@example.invalid,b@example.invalid', 'x', '<p>x</p>', 'x'],
    ['a@example.invalid', 'x\r\nBcc: b@example.invalid', '<p>x</p>', 'x'],
    ['a@example.invalid', 'x', '<p>x</p>', ''] ]) {
    const invalid = smtp(); assert.equal((await invalid.send(...args)).status, 'failed');
    assert.equal(invalid.calls.length, 0);
  }
  for (const [properties, expected] of [
    [{ responseCode: 451 }, 'retry'], [{ responseCode: 550 }, 'failed'],
    [{ code: 'EAUTH' }, 'failed'], [{ code: 'ETLS' }, 'failed'],
    [{ code: 'ETIMEDOUT', command: 'DATA' }, 'uncertain'], [{ code: 'ECONNRESET' }, 'uncertain'],
  ]) {
    const result = await smtp({}, Object.assign(new Error('fixture-sensitive-provider-response'), properties)).send();
    assert.equal(result.status, expected); assert(!JSON.stringify(result).includes('fixture-sensitive'));
  }
  assert.equal((await smtp({}, { accepted: [], rejected: ['client@example.invalid'] }).send()).status, 'failed');
  assert.equal((await smtp({}, {}).send()).status, 'uncertain');
  // Flag is intentionally unrelated to existing call sites.
  const legacy = smtp({ NOTIFICATIONS_EMAIL_V1_ENABLED: 'false' });
  assert.equal((await legacy.api.deliverEmail('client@example.invalid', 'Legacy', '<p>Legacy</p>')).status, 'accepted');
  assert.equal(legacy.calls[0].message.from.address, 'legacy@example.invalid');
  assert.equal(await legacy.api.sendEmail('client@example.invalid', 'Legacy', '<p>Legacy</p>'), true);
  console.log('PASS SMTP mock: default OFF, runtime flag, validation, strict TLS, safe failures, legacy');

  const { notificationTemplate } = load('src/lib/notification-templates.ts');
  const data = { name: '<script>alert(1)</script>', serviceTitle: 'Приём & консультация',
    slotTime: '2026-10-15T21:30:00Z', oldTime: '2026-10-14T21:30:00Z',
    resetUrl: 'https://body-state.ru/account/reset-password?token=fixture&x=1',
    accountUrl: 'https://body-state.ru/account', diagnosis: 'MUST_NOT_APPEAR',
    error: 'MUST_NOT_APPEAR', status: '<img onerror=alert(1)>' };
  for (const kind of ['created', 'confirmed', 'rescheduled', 'cancelled', 'paid',
    'reminder_24h', 'reminder_2h', 'reset_requested', 'password_changed', 'delivery_alert']) {
    const template = notificationTemplate(kind, data);
    assert(template.subject.startsWith('Body State')); assert(template.text); assert(template.html);
    assert(template.html.includes('https://body-state.ru/logo.png'));
    assert(template.html.includes('name="viewport"')); assert(!template.html.includes('<script>'));
    assert(!template.html.includes('<img onerror')); assert(!JSON.stringify(template).includes('MUST_NOT_APPEAR'));
  }
  const booking = notificationTemplate('confirmed', data);
  assert(booking.text.includes('16 октября 2026')); assert(booking.text.includes('00:30'));
  assert.equal(notificationTemplate('confirmed', { ...data, slotTime: new Date(data.slotTime) }).text, booking.text);
  assert(booking.html.includes('&lt;script&gt;')); assert(booking.html.includes('Приём &amp; консультация'));
  const moved = notificationTemplate('rescheduled', data);
  assert(moved.text.includes('15 октября 2026')); assert(moved.text.includes('16 октября 2026'));
  assert(notificationTemplate('paid', data).text.includes('не фискальный чек'));
  const reset = notificationTemplate('reset_requested', data);
  assert(reset.text.includes('token=fixture&x=1')); assert(reset.html.includes('token=fixture&amp;x=1'));
  for (const resetUrl of ['javascript:alert(1)', 'http://body-state.ru/reset', 'https://evil.invalid/reset',
    'https://body-state.ru.evil.invalid/reset', 'https://user:pass@body-state.ru/reset']) {
    assert.throws(() => notificationTemplate('reset_requested', { resetUrl }));
  }
  assert.throws(() => notificationTemplate('created', { ...data, accountUrl: 'https://evil.invalid' }));
  for (const slotTime of ['invalid', '2026-10-15T10:00:00']) {
    assert.throws(() => notificationTemplate('confirmed', { ...data, slotTime }));
  }
  assert.throws(() => notificationTemplate('rescheduled', { ...data, oldTime: undefined }));
  const mime = await require('nodemailer').createTransport({ streamTransport: true, buffer: true }).sendMail({
    from: configured.SMTP_FROM, to: 'client@example.invalid', ...booking,
  });
  const wire = mime.message.toString('utf8');
  assert(wire.includes('multipart/alternative')); assert(wire.includes('text/plain; charset=utf-8'));
  assert(wire.includes('text/html; charset=utf-8'));
  console.log('PASS templates: ten kinds, Moscow rollover, escaping, privacy, URL validation, HTML/text');
  console.log('PASS Nodemailer MIME integration: multipart/alternative generated in memory, no network');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
