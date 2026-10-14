const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { EventEmitter } = require('node:events');
function load(file, mocks, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, require: name => mocks[name] || require(name), process: { env: {} }, console, URL, Buffer, setTimeout, clearTimeout, crypto: require('node:crypto').webcrypto, ...globals }, { filename: file });
  return exports;
}
let mode = 'ok', calls = 0, sent;
const httpsMock = { request(url, options, callback) {
  calls++; assert.equal(url.protocol, 'https:'); assert.equal(options.agent, false);
  const req = new EventEmitter();
  req.destroy = error => req.emit('error', error);
  req.end = body => {
    sent = JSON.parse(body);
    queueMicrotask(() => {
      if (mode === 'error') return req.emit('error', Object.assign(new Error('connect'), { code: 'ETIMEDOUT' }));
      const res = new EventEmitter(); res.statusCode = mode === 'http' ? 502 : 200;
      callback(res);
      res.emit('data', Buffer.from(mode === 'html' ? '<html>gateway</html>' : JSON.stringify({ Success: true, PaymentId: 12345 })));
      res.emit('end');
    });
  };
  return req;
} };
const transport = load('src/lib/tbank-transport.ts', { 'node:https': httpsMock });
const NextResponse = { json: (data, options = {}) => ({ status: options.status || 200, json: async () => data }) };
let saved, cases, transitions, bankMode;
const booking = { status: 'pending', account_user_id: 'owner', client_email: 'test@example.invalid', client_phone: '+79990000001', client_name: 'Test', journey_snapshot: { title: 'Test service', subtotal: 3000, total: 300, promoCode: 'TEST90' } };
const builder = () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: booking }), update: values => { saved = values; return q; }, then: resolve => Promise.resolve({ error: null }).then(resolve) }; return q; };
const mocks = {
  'next/server': { NextResponse },
  '@/lib/db': { db: { from: builder }, pool: { query: async () => ({ rows: [] }) } },
  '@/lib/tbank': { TERMINAL_KEY: 'test', PASSWORD: 'test', createPaymentStatusToken: () => 'test', generateToken: () => 'test' },
  '@/lib/legal': { CONSENT_VERSION: 'test', hasPersonalDataConsent: () => true },
  '@/lib/request': { cleanText: (x) => typeof x === 'string' ? x : '', enforceRateLimit: async () => null, normalizeEmail: x => x || '', normalizePhone: x => x || '', readJsonObject: async r => r },
  '@/lib/order-stock': { createPendingOrderWithReservation: async () => ({ id: 'test-order-id' }), transitionOrderState: async (...args) => { transitions.push(args); } },
  '@/lib/account-auth': { getAccountSession: async () => ({ userId: 'owner' }) },
  '@/lib/service-prices': {},
  '@/lib/booking-payments': { isPayableBookingType: x => x === 'bfm' },
  '@/lib/promo-codes': { normalizePromoCode: x => x || '', validatePromoCode: async () => ({ discount: 2700, promo: { id: 'test-promo', code: 'TEST90' } }) },
  '@/lib/booking-journey': { loadJourney: async () => booking, matchesAccessToken: () => false, validBookingId: value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) },
  '@/lib/payment-cases': { openPaymentCase: async () => { cases++; } },
  '@/lib/tbank-transport': { ...transport, requestTbank: async (_url, payload) => {
    assert.equal(payload.Amount, 30000); assert.equal(payload.Receipt.Items[0].Amount, 30000);
    if (bankMode === 'timeout') throw Object.assign(new Error('connect'), { code: 'ETIMEDOUT' });
    if (bankMode === 'html') return { ok: false, data: null };
    if (bankMode === 'reject') return { ok: true, data: { Success: false, Message: 'Rejected' } };
    return { ok: true, data: { Success: true, PaymentId: 12345, PaymentURL: 'https://securepay.tinkoff.ru/test' } };
  } },
};
const route = load('src/app/api/payment/init/route.ts', mocks);
const body = { orderId: 'test-order-12345', consent: true, amount: 300, promoCode: 'TEST90', items: [{ bookingId: '00000000-0000-0000-0000-000000000001', bookingType: 'bfm' }] };
(async () => {
  const result = await transport.requestTbank('https://securepay.tinkoff.ru/v2/Init', { Amount: 30000 });
  assert.equal(result.data.PaymentId, 12345); assert.equal(sent.Amount, 30000);
  assert.equal(transport.paymentId(12345), '12345'); assert.equal(transport.paymentId('12345'), '12345');
  assert.throws(() => transport.paymentId(undefined)); assert.throws(() => transport.paymentId(Number.MAX_SAFE_INTEGER + 1));
  assert.throws(() => transport.requestTbank('http://example.invalid', {}));
  mode = 'html'; assert.equal((await transport.requestTbank('https://example.invalid', {})).data, null);
  mode = 'error'; const before = calls; await assert.rejects(transport.requestTbank('https://example.invalid', {})); assert.equal(calls, before + 1);
  assert.equal(transport.paymentErrorCode(new Error('secret contact info')), 'PAYMENT_INTERNAL_ERROR');
  for (const mode of ['ok', 'reject', 'timeout', 'html']) {
    bankMode = mode; saved = null; cases = 0; transitions = [];
    const response = await route.POST(body);
    assert.equal(response.status, mode === 'ok' ? 200 : mode === 'reject' ? 502 : 500);
    if (mode === 'ok') assert.equal(saved.payment_id, '12345');
    assert.equal(cases, ['timeout', 'html'].includes(mode) ? 1 : 0);
    assert.equal(transitions.length, mode === 'reject' ? 1 : 0);
    console.log('PASS payment Init:', mode);
  }
  console.log('PASS transport: numeric IDs, TLS requirement, malformed response, no automatic retry, secret-safe diagnostics');
})().catch(error => { console.error(error); process.exitCode = 1; });
