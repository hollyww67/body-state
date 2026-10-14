/* Isolated fixtures only: no PostgreSQL connection, provider request, or environment file. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function load(relative, mocks) {
  const filename = path.join(__dirname, "..", relative);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === "node:crypto") return require(name);
      throw new Error("Unmocked dependency: " + name);
    },
    URL, Date, crypto: globalThis.crypto, process: { env: {} },
    console: { error() {} },
  }, { filename });
  return module.exports;
}

const key = "12345678-1234-4123-8123-123456789abc";
const payload = { requestKey: key, name: "Fixture payment", amount: "100,00", email: "FIXTURE@example.test", phone: "", serviceCode: "", lifetimeDays: 7 };
function fixture(provider = async () => ({ ok: true, data: { Success: true, PaymentId: "123", PaymentURL: "https://fixture.example.test/pay" } })) {
  const orders = new Map();
  let initCalls = 0;
  let caseCalls = 0;
  let saveFails = false;
  const pool = { query: async (sql, values) => {
    if (sql.includes("account_users")) return { rows: [] };
    if (sql.includes("external_order_id")) return { rows: orders.has(values[0]) ? [orders.get(values[0])] : [] };
    throw new Error("Unexpected SQL fixture: " + sql);
  } };
  const db = { from: () => ({
    update(values) { this.values = values; return this; },
    eq(column, value) { assert.equal(column, "id"); this.id = value; return this; },
    select() { return this; },
    async single() {
      if (saveFails) return { error: new Error("fixture save failure"), data: null };
      const row = [...orders.values()].find((row) => row.id === this.id);
      Object.assign(row, this.values);
      return { data: row, error: null };
    },
  }) };
  const stock = {
    async createPendingOrderWithReservation(order, items) {
      // Model the committed unique index race; never touch an actual DB.
      await Promise.resolve();
      if (orders.has(order.external_order_id)) throw Object.assign(new Error("unique"), { code: "23505" });
      const row = { ...order, items, id: "fixture-order", status: "pending", created_at: new Date().toISOString(), payment_url: null, payment_id: null };
      orders.set(order.external_order_id, row);
      return row;
    },
    async transitionOrderState(id, status, options) {
      const row = [...orders.values()].find((row) => row.id === id);
      row.status = status;
      row.payment_data = options.paymentData;
    },
  };
  const helper = load("src/lib/manual-payment-links.ts", { "@/lib/db": { pool }, "@/lib/order-stock": stock });
  const route = load("src/app/api/admin/payment-links/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/db": { db, pool },
    "@/lib/order-stock": stock,
    "@/lib/manual-payment-links": helper,
    "@/lib/legal": { CONSENT_VERSION: "fixture" },
    "@/lib/request": {
      enforceRateLimit: async () => null,
      readJsonObject: async (req) => req.json(),
      cleanText: (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "",
      normalizeEmail: (value) => typeof value === "string" && value.includes("@") ? value.trim().toLowerCase() : "",
      normalizePhone: (value) => typeof value === "string" ? value.replace(/\\s/g, "") : "",
    },
    "@/lib/tbank": { TERMINAL_KEY: "fixture", PASSWORD: "fixture", generateToken: () => "fixture", createPaymentStatusToken: () => "fixture" },
    "@/lib/tbank-transport": {
      requestTbank: async (...args) => { initCalls++; return provider(...args); },
      paymentId: (value) => String(value),
      paymentErrorCode: () => "fixture",
    },
    "@/lib/payment-cases": { openPaymentCase: async () => { caseCalls++; } },
  });
  const post = (body = payload) => route.POST(new Request("https://fixture.example.test/api", { method: "POST", body: JSON.stringify(body) }));
  return { orders, helper, post, get initCalls() { return initCalls; }, get caseCalls() { return caseCalls; }, failSave() { saveFails = true; } };
}

test("missing / malformed / legacy request key fails closed before Init", async () => {
  const f = fixture();
  for (const requestKey of [undefined, "", "legacy", 123, "12345678-1234-0123-8123-123456789abc"]) {
    const res = await f.post({ ...payload, requestKey });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, "MANUAL_REQUEST_KEY_REQUIRED");
  }
  assert.equal(f.orders.size, 0);
  assert.equal(f.initCalls, 0);
});

test("replay returns the same saved URL after normalization and callback data replacement", async () => {
  const f = fixture();
  const first = await (await f.post()).json();
  [...f.orders.values()][0].payment_data = { Status: "CONFIRMED" };
  [...f.orders.values()][0].status = "paid";
  const replay = await (await f.post({ ...payload, requestKey: key.toUpperCase(), amount: 100, email: "fixture@example.test" })).json();
  assert.equal(replay.link.paymentUrl, first.link.paymentUrl);
  assert.equal(replay.link.id, first.link.id);
  assert.equal(f.initCalls, 1);
});

test("every normalized business field conflicts under the same key", async () => {
  const f = fixture();
  await f.post();
  for (const change of [
    { name: "Another payment" }, { amount: 101 }, { email: "other@example.test" },
    { phone: "+79990000000" }, { serviceCode: "bfm", phone: "+79990000000" }, { lifetimeDays: 14 },
  ]) {
    const response = await f.post({ ...payload, ...change });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "MANUAL_PAYLOAD_CONFLICT");
  }
  assert.equal(f.initCalls, 1);
});

test("simultaneous requests elect only one provider Init owner", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const f = fixture(async () => { await gate; return { ok: true, data: { Success: true, PaymentId: "1", PaymentURL: "https://fixture.example.test/pay" } }; });
  const requests = Array.from({ length: 12 }, () => f.post());
  // Drain microtasks until the elected winner reaches the provider.
  for (let i = 0; i < 100 && f.initCalls === 0; i++) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.initCalls, 1);
  release();
  const responses = await Promise.all(requests);
  assert.equal(responses.filter((r) => r.status === 200).length, 1);
  assert.equal(responses.filter((r) => r.status === 409).length, 11);
  assert.equal(f.orders.size, 1);
  assert.equal(f.initCalls, 1);
  assert.equal((await f.post()).status, 200);
});

test("unknown outcome and restart-style replay never reinitialize", async () => {
  const f = fixture(async () => { throw new Error("fixture timeout"); });
  assert.equal((await f.post()).status, 500);
  const replay = await f.post();
  assert.equal(replay.status, 409);
  assert.equal((await replay.json()).code, "MANUAL_INIT_UNRESOLVED");
  assert.equal(f.initCalls, 1);
  assert.equal(f.caseCalls, 1);
  // A fresh helper instance can recover identity using only persisted fixture rows.
  const restarted = load("src/lib/manual-payment-links.ts", {
    "@/lib/db": { pool: { query: async () => ({ rows: [...f.orders.values()] }) } },
    "@/lib/order-stock": { createPendingOrderWithReservation: () => { throw new Error("must not insert"); } },
  });
  await assert.rejects(restarted.claimManualPaymentLink(key, [...f.orders.values()][0].items[0].manualPaymentRequestFingerprint, {}, {}), /MANUAL|Операция уже отправлена/);
});

test("provider success but DB URL save failure retains claim, blocks retry", async () => {
  const f = fixture();
  f.failSave();
  assert.equal((await f.post()).status, 500);
  assert.equal((await f.post()).status, 409);
  assert.equal(f.initCalls, 1);
});

test("definite provider rejection blocks repeated Init; deliberate new key can create", async () => {
  const f = fixture(async () => ({ ok: true, data: { Success: false, Message: "Fixture rejection" } }));
  assert.equal((await f.post()).status, 502);
  assert.equal((await f.post()).status, 409);
  assert.equal(f.initCalls, 1);
  assert.equal((await f.post({ ...payload, requestKey: "22345678-1234-4123-8123-123456789abc" })).status, 502);
  assert.equal(f.orders.size, 2);
  assert.equal(f.initCalls, 2);
});

test("unique index and atomic item persistence exist in repository schema/helper", () => {
  const migration = fs.readFileSync(path.join(__dirname, "../migrations/003_production_hardening.sql"), "utf8");
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS orders_external_order_id_idx ON orders \(external_order_id\)/);
  const stock = fs.readFileSync(path.join(__dirname, "../src/lib/order-stock.ts"), "utf8");
  assert.match(stock, /JSON.stringify\(items\)/);
});

function uiFixture(fetch) {
  const slots = [];
  let cursor = 0;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (v) => { slots[i] = typeof v === "function" ? v(slots[i]) : v; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useCallback(fn) { return fn; }, useMemo(fn) { return fn(); }, useEffect() {},
  };
  const jsx = (type, props) => ({ type, props });
  // This module also needs client globals, passed as explicit mocked dependencies.
  const filename = path.join(__dirname, "../src/app/admin/payment-links/page.tsx");
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, fetch, crypto: globalThis.crypto,
    window: { confirm: () => true }, Intl, Date,
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "lucide-react") return {};
      if (name === "sonner") return { toast: { success() {}, error() {} } };
      if (name === "@/lib/phone") return { formatRussianPhoneInput: (v) => v };
      throw new Error("Unexpected UI import: " + name);
    },
  });
  const render = () => { cursor = 0; return module.exports.default(); };
  function find(tree, predicate) {
    if (!tree || typeof tree !== "object") return null;
    if (predicate(tree)) return tree;
    for (const child of [tree.props?.children].flat(Infinity)) { const found = find(child, predicate); if (found) return found; }
    return null;
  }
  const submit = () => find(render(), (n) => n.type === "form").props.onSubmit({ preventDefault() {} });
  function fill() {
    let tree = render();
    const inputs = [];
    function visit(node) { if (!node || typeof node !== "object") return; if (node.type === "input") inputs.push(node); for (const child of [node.props?.children].flat(Infinity)) visit(child); }
    visit(tree);
    for (const [i, value] of ["Fixture payment", "100", "fixture@example.test", ""].entries()) inputs[i].props.onChange({ target: { value } });
    tree = render();
    return tree;
  }
  return { render, find, submit, fill };
}

test("form retains exact operation after lost success response and suppresses double submit", async () => {
  const f = fixture();
  const bodies = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const ui = uiFixture(async (_url, options) => {
    bodies.push(options.body);
    if (bodies.length === 1) { await gate; await f.post(JSON.parse(options.body)); throw new Error("fixture lost response"); }
    return f.post(JSON.parse(options.body));
  });
  ui.fill();
  const first = ui.submit();
  await ui.submit();
  assert.equal(bodies.length, 1);
  release();
  await first;
  const tree = ui.render();
  assert.equal(ui.find(tree, (n) => n.type === "fieldset").props.disabled, true);
  await ui.submit();
  assert.equal(bodies[1], bodies[0]);
  assert.equal(f.initCalls, 1);
  assert.equal(ui.find(ui.render(), (n) => n.type === "fieldset").props.disabled, false);
});

test("form retains key after unknown Init; deliberate new operation uses a different key", async () => {
  const f = fixture(async () => { throw new Error("fixture unknown"); });
  const bodies = [];
  const ui = uiFixture(async (_url, options) => { bodies.push(JSON.parse(options.body)); return f.post(bodies.at(-1)); });
  ui.fill();
  await ui.submit();
  await ui.submit();
  assert.equal(bodies[0].requestKey, bodies[1].requestKey);
  assert.equal(f.initCalls, 1);
  ui.find(ui.render(), (n) => n.type === "button" && n.props.children === "Начать новый платёж").props.onClick();
  await ui.submit();
  assert.notEqual(bodies[2].requestKey, bodies[0].requestKey);
  assert.equal(f.initCalls, 2);
});

