const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } = require('date-fns');
process.env.TINKOFF_TERMINAL_KEY = 'audit-terminal';
process.env.TINKOFF_PASSWORD = 'audit-test-only-password';
const bank = require('../src/lib/tbank.js');
const time = require('../src/lib/moscow-time.js');
const password = process.env.TINKOFF_PASSWORD;
// Independent canonicalizer: never use the implementation to generate its own expected result.
function sign(input, secret) {
  const pairs = Object.entries(input).filter(([key, value]) => key !== 'Token' && key !== 'Password' &&
    value != null && typeof value !== 'object');
  pairs.push(['Password', secret]);
  return crypto.createHash('sha256').update(pairs.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, v]) => String(v)).join(''), 'utf8').digest('hex');
}
if (!process.argv.includes('--timezone-child')) {
  const payload = { TerminalKey: 'audit-terminal', Amount: 100000, Status: 'CONFIRMED', Success: true,
    PaymentId: 'fixture-1', OrderId: 'fixture-order', Description: 'Приём — тест', DATA: { Password: 'nested' }, Receipt: { Email: 'qa@example.invalid' } };
  const authentic = { ...payload, Token: sign(payload, password) };
  assert(bank.verifyNotificationToken(authentic));
  assert.equal(bank.generateToken(payload), sign(payload, password));
  assert.equal(bank.generateToken({ B: 2, A: 1 }, 'test'), 'a8f29d9244a13d82b11f108a6803ec6858c5b378fa7abca2892ade148643deac');
  for (const value of ['attacker', '', 0, 123, true, false, null, {}, []]) {
    assert.equal(bank.verifyNotificationToken({ ...authentic, Password: value }), false);
    assert.equal(bank.verifyNotificationToken({ ...payload, Password: value, Token: sign(payload, String(value)) }), false);
    assert.equal(bank.generateToken({ ...payload, Password: value }, password), sign(payload, password));
  }
  for (const terminal of [undefined, null, '', false, 0, [], {}, 'wrong-terminal']) {
    const body = { ...payload, TerminalKey: terminal };
    assert.equal(bank.verifyNotificationToken({ ...body, Token: sign(body, password) }), false);
  }
  const noTerminal = { ...payload }; delete noTerminal.TerminalKey;
  assert.equal(bank.verifyNotificationToken({ ...noTerminal, Token: sign(noTerminal, password) }), false);
  for (const token of ['', 'forged', '0'.repeat(64), 123, null, undefined]) assert.equal(bank.verifyNotificationToken({ ...payload, Token: token }), false);
  assert.equal(bank.generateToken({ ...payload, Token: 'exclude-me' }), sign(payload, password));
  const reordered = Object.fromEntries(Object.entries(payload).reverse());
  assert(bank.verifyNotificationToken({ ...reordered, Amount: '100000', Token: sign(reordered, password) }));
  assert.equal(bank.createPaymentStatusToken('test-order'), sign({ Purpose: 'payment-status', OrderId: 'test-order' }, password));
  assert(bank.verifyPaymentStatusToken('test-order', bank.createPaymentStatusToken('test-order')));
  assert.equal(bank.verifyPaymentStatusToken('other-order', bank.createPaymentStatusToken('test-order')), false);
  console.log('PASS A01 independent scalar/hash vectors, reserved Password, terminal validation, status tokens');
  for (const zone of ['UTC', 'Europe/Moscow', 'Asia/Yekaterinburg', 'America/New_York']) {
    const child = spawnSync(process.execPath, [__filename, '--timezone-child'], { env: { ...process.env, TZ: zone }, encoding: 'utf8' });
    process.stdout.write(child.stdout); process.stderr.write(child.stderr); assert.equal(child.status, 0, zone);
  }
} else {
  assert.equal(time.moscowInputToISO('2026-10-12', '09:30'), '2026-10-12T06:30:00.000Z');
  assert.equal(time.moscowInputToISO('2026-10-12', '00:00'), '2026-10-11T21:00:00.000Z');
  assert.equal(time.moscowDayKey('2026-10-11T21:01:00Z'), '2026-10-12');
  assert.equal(time.formatMoscow('2026-10-12T06:30:00Z', 'HH:mm'), '09:30');
  assert(time.sameMoscowDay('2026-10-11T21:00:00Z', '2026-10-12T20:59:59Z'));
  assert.equal(time.sameMoscowDay('2026-10-12T20:59:59Z', '2026-10-12T21:00:00Z'), false);
  assert(time.isMoscowToday('2026-10-12T06:30:00Z', '2026-10-11T21:01:00Z'));
  assert(time.isMoscowTomorrow('2026-10-13T06:30:00Z', '2026-10-11T21:01:00Z'));
  assert(time.isThisMoscowWeek('2026-10-17T20:59:59Z', '2026-10-11T21:01:00Z'));
  assert.equal(time.isThisMoscowWeek('2026-10-17T21:00:00Z', '2026-10-11T21:01:00Z'), false);
  assert(time.sameMoscowMonth('2026-10-31T21:00:00Z', '2026-11-01T10:00:00Z'));
  const month = time.moscowDate('2026-11-02');
  assert.equal(new Date(startOfMonth(month).getTime()).toISOString(), '2026-10-31T21:00:00.000Z');
  assert.equal(new Date(endOfMonth(month).getTime()).toISOString(), '2026-11-30T20:59:59.999Z');
  assert.equal(time.moscowDayKey(startOfWeek(month, { weekStartsOn: 1 })), '2026-11-02');
  assert.equal(time.moscowDayKey(endOfWeek(month, { weekStartsOn: 1 })), '2026-11-08');
  for (const date of ['2026-03-08', '2026-11-01']) {
    const next = addDays(time.moscowDate(date), 1);
    assert.equal(next.getTime() - time.moscowDate(date).getTime(), 86400000);
    assert.equal(time.formatMoscow(time.moscowInputToISO(date, '02:30'), 'HH:mm'), '02:30');
  }
  const start = time.moscowDate('2026-10-12');
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  assert.deepEqual(days.map(d => d.getDay()), [1, 2, 3, 4, 5, 6, 0]);
  assert.deepEqual(days.map(d => time.moscowDayKey(d)), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  const breakStart = time.moscowInputToISO('2026-10-12', '12:00');
  const breakEnd = time.moscowInputToISO('2026-10-12', '13:00');
  assert.equal(Date.parse(breakEnd) - Date.parse(breakStart), 3600000);
  assert.equal(breakStart, '2026-10-12T09:00:00.000Z');
  for (const [date, clock] of [['2026-02-30', '10:00'], ['bad', '10:00'], ['2026-10-12', '24:00'], ['2026-10-12', '09:61']]) assert.throws(() => time.moscowInputToISO(date, clock), RangeError);
  console.log(`PASS A03 ${process.env.TZ}: inputs/display/grouping/Today/day/week/month/DST/breaks/weekday iteration`);
}
