const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');

// Execute the actual TS modules in memory: no build, artifacts, environment or DB access.
// Only DB and occupancy are mocked. Moscow conversion and schedule-plan are real source.
const root = path.resolve(__dirname, '..');
function loadSource(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const runtime = new Module(filename, module);
  runtime.filename = filename;
  runtime.paths = Module._nodeModulePaths(path.dirname(filename));
  runtime.require = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request];
    return require(require.resolve(request, { paths: [root, path.resolve(root, '../source'), __dirname] }));
  };
  let source = fs.readFileSync(filename, 'utf8');
  // Read-only negative control: prove these regressions catch the pre-fix source.
  if (process.env.WEEKLY_REGRESSION_BASELINE === '1' && relative.endsWith('schedule-management.ts')) {
    source = require('node:child_process').execFileSync('git', ['-C', root, 'show', 'HEAD:src/lib/schedule-management.ts'], { encoding: 'utf8' });
  }
  const compiled = ts.transpileModule(source, {
    fileName: filename, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  assert.equal(compiled.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  runtime._compile(compiled.outputText, filename);
  return runtime.exports;
}
const time = loadSource('src/lib/moscow-time.ts');
const plan = loadSource('src/lib/schedule-plan.ts', {
  '@/lib/slots': { SERVICE_DURATION_MINUTES: { bfm: 90, brt: 60, psychology: 90 } },
});
const at = (day, clock) => new Date(day + 'T' + clock + ':00+03:00').toISOString();
const candidate = (day = '2101-12-31', clock = '23:30', duration = 120, service = 'bfm') =>
  ({ time: at(day, clock), duration, service });
const next = '2102-01-01';
const hours = services => ({ start: '00:00', end: '23:59', step: 30, services, breaks: [] });
const block = (start, end, source_type = 'manual') => ({ starts_at: start, ends_at: end, source_type });
const intersects = (row, from, to) => Date.parse(row.starts_at) < Date.parse(to) && Date.parse(row.ends_at) > Date.parse(from);

function fixture(input = {}) {
  const data = {
    source: input.source ?? [candidate()],
    slots: structuredClone(input.slots ?? []), breaks: input.breaks ?? [],
    appointments: input.appointments ?? [], exceptions: input.exceptions ?? [], days: input.days ?? [],
    runs: [], refreshes: 0,
  };
  const calls = [];
  const snapshot = () => JSON.stringify(data);
  let queue = Promise.resolve();
  let inserts = [];
  const client = { async query(sql, args = []) {
    calls.push({ sql, args });
    const result = rows => ({ rows, rowCount: rows.length });
    if (sql.startsWith('SELECT pg_advisory_xact_lock')) {
      assert.deepEqual(args, [913202609]); return result([]);
    }
    if (sql.startsWith('SELECT set_config')) return result([]);
    if (sql === 'SELECT * FROM schedule_templates WHERE active') return result([]);
    if (sql.startsWith('WITH dates AS')) {
      assert.match(sql, /generate_series\(30,36\)/);
      assert.match(sql, /d.day-28/);
      assert.match(sql, /NOT EXISTS\(SELECT 1 FROM schedule_exceptions/);
      return result(data.source);
    }
    if (sql.startsWith('SELECT s.id,s.service_type')) {
      return result(data.slots.filter(s => Date.parse(s.slot_time) >= Date.parse(args[0]) && Date.parse(s.slot_time) < Date.parse(args[1])));
    }
    if (sql.startsWith('SELECT * FROM (')) return result(data.appointments.filter(a => intersects(a, ...args)));
    if (sql.startsWith('SELECT id,starts_at')) return result(data.breaks.filter(b => intersects(b, ...args)));
    if (sql.includes('FROM schedule_exceptions WHERE day=ANY')) return result(data.exceptions.filter(e => args[0].includes(e.day)));
    if (sql.includes('FROM schedule_days WHERE day=ANY')) return result(data.days.filter(d => args[0].includes(d.day)));
    if (sql.startsWith('INSERT INTO slots')) {
      assert.match(sql, /ON CONFLICT\(service_type,slot_time\) DO NOTHING/);
      const rows = JSON.parse(args[0]); inserts.push(...rows);
      const added = rows.filter(s => !data.slots.some(a => a.service_type === s.service && a.slot_time === s.time));
      data.slots.push(...added.map(s => ({ service_type: s.service, slot_time: s.time, duration_minutes: s.duration })));
      return result(added);
    }
    if (sql.startsWith('INSERT INTO schedule_runs')) {
      if (input.failJournal) throw Error('synthetic journal failure');
      data.runs.push(args[0]); return result([]);
    }
    throw Error('Unexpected SQL: ' + sql);
  }};
  const db = { transaction(fn) {
    // A serialized, rollback-capable test double, not evidence of real PG locking.
    const operation = queue.then(async () => {
      const before = structuredClone(data);
      try { return await fn(client); }
      catch (error) { Object.assign(data, before); throw error; }
    });
    queue = operation.catch(() => {});
    return operation;
  }};
  const management = loadSource('src/lib/schedule-management.ts', {
    '@/lib/db': { db }, '@/lib/slots': { refreshSlotOccupancy: async c => {
      assert.equal(c, client); data.refreshes++;
    } },
    '@/lib/schedule-plan': plan, '@/lib/moscow-time': time,
  });
  return { ...management, data, calls, snapshot, inserted: () => inserts };
}

async function verify(input, expected) {
  const f = fixture(input), before = f.snapshot();
  const preview = await f.extendSchedule(true);
  assert.equal(preview.count, expected);
  assert.equal(f.snapshot(), before, 'dry-run does not mutate data');
  assert.equal(f.inserted().length, 0);
  const actual = await f.extendSchedule();
  assert.equal(actual.count, expected);
  assert.equal(f.inserted().length, expected, 'blocked rows must never reach INSERT');
  assert.deepEqual(actual.dates, preview.dates);
  assert.equal(actual.days_added, preview.days_added);
  assert.equal((await f.extendSchedule()).count, 0, 'repeat does not duplicate slots');
  assert.deepEqual(f.data.days, input.days ?? []);
  assert.deepEqual(f.data.exceptions, input.exceptions ?? []);
  assert.deepEqual(f.data.breaks, input.breaks ?? []);
  return f;
}

for (const service of ['bfm', 'brt', 'psychology']) {
  test('WEEKLY-01 next-day exception blocks 120-minute ' + service, async () => {
    await verify({ source: [candidate(undefined, undefined, 120, service)], exceptions: [{ day: next, mode: 'closed', hours: null }] }, 0);
  });
  for (const mode of ['closed', 'unpublished']) test('WEEKLY-01 next-day ' + mode + ' policy blocks ' + service, async () => {
    await verify({ source: [candidate(undefined, undefined, 120, service)], days: [{ day: next, mode, hours: null }] }, 0);
  });
  test('WEEKLY-01 manual next-day break blocks ' + service, async () => {
    await verify({ source: [candidate(undefined, undefined, 120, service)], breaks: [block(at(next, '00:15'), at(next, '00:45'))] }, 0);
  });
  test('WEEKLY-02 published BRT-only policy for ' + service, async () => {
    await verify({ source: [candidate('2101-12-31', '09:30', 120, service)], days: [{ day: '2101-12-31', mode: 'published', hours: hours(['brt']) }] }, service === 'brt' ? 1 : 0);
  });
  test('WEEKLY-02 next-day service restriction for ' + service, async () => {
    await verify({ source: [candidate(undefined, undefined, 120, service)], days: [{ day: next, mode: 'published', hours: hours(['brt']) }] }, service === 'brt' ? 1 : 0);
  });
}
test('WEEKLY-01 end exactly at Moscow midnight excludes the next closed day', async () => {
  const f = await verify({ source: [candidate(undefined, undefined, 30)], exceptions: [{ day: next, mode: 'closed', hours: null }] }, 1);
  assert.deepEqual(f.calls.find(c => c.sql.includes('FROM schedule_exceptions WHERE day=ANY')).args[0], ['2101-12-31']);
});
test('all service durations are copied unchanged and checked across Moscow midnight', async () => {
  for (const [service, duration] of [['bfm', 90], ['brt', 60], ['psychology', 90]]) {
    const source = [candidate(undefined, undefined, duration, service)];
    await verify({ source, days: [{ day: next, mode: 'closed' }] }, 0);
    const f = await verify({ source }, 1);
    assert.equal(f.data.slots[0].duration_minutes, duration);
  }
});
test('owned exception/window/template next-day breaks retain precedence', async () => {
  for (const owner of ['exception', 'window', 'template']) {
    await verify({ breaks: [block(at(next, '00:15'), at(next, '00:45'), owner)] }, 0);
  }
});
test('WEEKLY-01 1 minute after Moscow midnight includes the next closed day', async () => {
  await verify({ source: [candidate(undefined, undefined, 31)], days: [{ day: next, mode: 'closed' }] }, 0);
});
test('WEEKLY-01 break touching end/start is allowed, 1ms overlap is blocked', async () => {
  await verify({ breaks: [block(at(next, '01:30'), at(next, '02:30'))] }, 1);
  await verify({ breaks: [block(at('2101-12-31', '23:00'), at('2101-12-31', '23:30'))] }, 1);
  await verify({ breaks: [block('2101-12-31T22:29:59.999Z', at(next, '02:30'))] }, 0);
});
test('WEEKLY-01 next-day hours exception is enforced without materialized breaks', async () => {
  await verify({ exceptions: [{ day: next, mode: 'hours', hours: { ...hours(['bfm']), start: '02:00' } }] }, 0);
  await verify({ exceptions: [{ day: next, mode: 'hours', hours: { ...hours(['bfm']), breaks: [{ start: '00:30', end: '01:00' }] } }] }, 0);
  await verify({ exceptions: [{ day: next, mode: 'hours', hours: hours(['brt']) }] }, 0);
  await verify({ exceptions: [{ day: next, mode: 'hours', hours: hours(['bfm']) }] }, 1);
});
test('WEEKLY-01 sparse unsorted candidates include intervening days and trailing day', async () => {
  const f = await verify({ source: [candidate('2102-01-02'), candidate('2101-12-31')], days: [{ day: '2102-01-03', mode: 'closed' }] }, 1);
  assert.deepEqual(f.calls.find(c => c.sql.includes('FROM schedule_days WHERE day=ANY')).args[0],
    ['2101-12-31', '2102-01-01', '2102-01-02', '2102-01-03']);
});
test('WEEKLY-01 month boundary and complete multi-day legacy duration', async () => {
  await verify({ source: [candidate('2101-01-31')], days: [{ day: '2101-02-01', mode: 'closed' }] }, 0);
  await verify({ source: [candidate(undefined, undefined, 3000)], days: [{ day: '2102-01-02', mode: 'closed' }] }, 0);
});
test('WEEKLY-02 no policy / null hours / no services retains legacy compatibility', async () => {
  for (const policy of [undefined, null, {}, { start: '10:00', end: '11:00' }]) {
    for (const service of ['bfm', 'brt', 'psychology']) {
      const input = { source: [candidate('2101-12-31', '09:30', 120, service)] };
      if (policy !== undefined) input.days = [{ day: '2101-12-31', mode: 'published', hours: policy }];
      const f = await verify(input, 1);
      assert.equal(f.data.slots[0].duration_minutes, 120, 'copy source duration verbatim');
    }
  }
});
test('WEEKLY-02 empty explicit service policy denies all services', async () => {
  await verify({ days: [{ day: '2101-12-31', mode: 'published', hours: { services: [] } }] }, 0);
});
test('existing resource protection: cross-service active appointment and exact duplicate', async () => {
  await verify({ appointments: [{ ...block(at(next, '00:00'), at(next, '01:00')), service_type: 'brt' }] }, 0);
  await verify({ appointments: [{ ...block(at(next, '01:30'), at(next, '02:00')), service_type: 'brt' }] }, 1);
  await verify({ slots: [{ service_type: 'bfm', slot_time: at('2101-12-31', '23:30'), duration_minutes: 120, protected: true }] }, 0);
});
test('empty source produces no context read or INSERT', async () => {
  const f = await verify({ source: [] }, 0);
  assert(!f.calls.some(c => c.sql.includes('WHERE day=ANY')));
});
test('serialized calls in transaction double share eligibility and do not duplicate', async () => {
  const f = fixture({ source: [candidate('2101-12-31', '09:30', 120, 'bfm'), candidate('2101-12-31', '09:30', 60, 'brt')],
    days: [{ day: '2101-12-31', mode: 'published', hours: hours(['brt']) }] });
  const results = await Promise.all([f.extendSchedule(), f.extendSchedule()]);
  assert.deepEqual(results.map(r => r.count).sort(), [0, 1]);
  assert.deepEqual(f.data.slots.map(s => s.service_type), ['brt']);
});
test('late journal failure propagates and rolls back transaction double', async () => {
  const f = fixture({ failJournal: true }), before = f.snapshot();
  await assert.rejects(f.extendSchedule(), /synthetic journal failure/);
  assert.equal(f.snapshot(), before);
});

