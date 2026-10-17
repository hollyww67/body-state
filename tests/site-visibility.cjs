// Standalone, offline shop-visibility integration contracts.
// Uses actual route/helper source transpiled by TypeScript, with isolated DB/auth stubs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const json = (value, init = {}) => ({ body: value, status: init.status || 200, headers: init.headers || {} });
const nextServer = { NextResponse: { json } };

function loadSource(name, imports = {}) {
  const { outputText, diagnostics } = ts.transpileModule(read(name), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: name, reportDiagnostics: true,
  });
  assert.equal(diagnostics?.length || 0, 0, "Transpile error in " + name);
  const mod = { exports: {} };
  const mockedRequire = (id) => {
    if (id === "next/server") return nextServer;
    if (id in imports) return imports[id];
    throw new Error("Unexpected import " + id + " in " + name);
  };
  new Function("require", "module", "exports", outputText)(mockedRequire, mod, mod.exports);
  return mod.exports;
}

function makeSettingsDb() {
  const calls = [];
  let storeValue;
  let readError = null;
  let writeError = null;
  const db = {
    from(table) {
      assert.equal(table, "settings");
      return {
        select(cols) {
          assert.equal(cols, "value");
          return {
            eq(column, value) {
              assert.equal(column, "key");
              assert.equal(value, "shop_visible");
              return {
                async maybeSingle() { return { data: storeValue === undefined ? null : { value: storeValue }, error: readError }; },
              };
            },
          };
        },
        async upsert(payload, options) {
          calls.push({ payload, options });
          if (writeError) return { error: writeError };
          storeValue = payload.value;
          return { error: null };
        },
      };
    },
  };
  return { db, calls, setValue(v) { storeValue = v; }, setReadError(v) { readError = v; }, setWriteError(v) { writeError = v; } };
}

async function main() {
  let checked = 0;
  const test = async (name, cb) => {
    await cb(); checked++;
    console.log("PASS " + name);
  };
  const settings = makeSettingsDb();
  const { isShopVisible } = loadSource("src/lib/site-visibility.ts", { "@/lib/db": { db: settings.db } });

  await test("default OFF; only literal true enables shop", async () => {
    assert.equal(await isShopVisible(), false);
    settings.setValue("false");
    assert.equal(await isShopVisible(), false);
    settings.setValue("TRUE");
    assert.equal(await isShopVisible(), false);
    settings.setValue("true");
    assert.equal(await isShopVisible(), true);
  });
  await test("database error fails closed", async () => {
    settings.setReadError(new Error("synthetic DB outage"));
    const log = console.error;
    console.error = () => {};
    try { assert.equal(await isShopVisible(), false); }
    finally { console.error = log; settings.setReadError(null); }
  });

  let authorized = true;
  const requireAdmin = async () => authorized ? null : json({ error: "Unauthorized" }, { status: 401 });
  const admin = loadSource("src/app/api/admin/site-visibility/route.ts", {
    "@/lib/admin-auth": { requireAdmin },
    "@/lib/db": { db: settings.db },
    "@/lib/site-visibility": { isShopVisible },
  });
  const request = (body) => ({ json: async () => body });

  await test("admin read requires authentication", async () => {
    authorized = false;
    const res = await admin.GET(request());
    assert.equal(res.status, 401);
    assert.equal((await admin.PATCH(request({ shopVisible: true }))).status, 401);
    authorized = true;
  });
  await test("admin switch rejects malformed input", async () => {
    for (const invalid of [{}, { shopVisible: "false" }, { shopVisible: 1 }, null, []]) {
      assert.equal((await admin.PATCH(request(invalid))).status, 400);
    }
    assert.equal((await admin.PATCH({ json: async () => { throw new Error("bad json"); } })).status, 400);
  });
  await test("admin switch persists OFF/ON and remains readable", async () => {
    for (const enabled of [false, true, false]) {
      const res = await admin.PATCH(request({ shopVisible: enabled }));
      assert.equal(res.status, 200);
      assert.equal(res.body.shopVisible, enabled);
      const state = await admin.GET(request());
      assert.equal(state.body.shopVisible, enabled);
      assert.equal(settings.calls.at(-1).payload.value, enabled ? "true" : "false");
      assert.equal(settings.calls.at(-1).options.onConflict, "key");
    }
  });
  await test("admin returns error if persistence fails", async () => {
    settings.setWriteError(new Error("synthetic rejected write"));
    const res = await admin.PATCH(request({ shopVisible: true }));
    assert.equal(res.status, 500);
    settings.setWriteError(null);
    assert.equal(await isShopVisible(), false);
  });

  const publicRoute = loadSource("src/app/api/site-visibility/route.ts", { "@/lib/site-visibility": { isShopVisible } });
  await test("public state response is uncached and reflects stored setting", async () => {
    settings.setValue("true");
    let res = await publicRoute.GET();
    assert.equal(res.body.shopVisible, true);
    assert.equal(res.headers["Cache-Control"], "no-store");
    settings.setValue("false");
    res = await publicRoute.GET();
    assert.equal(res.body.shopVisible, false);
  });

  const notFound = () => { const error = new Error("NEXT_NOT_FOUND"); error.code = 404; throw error; };
  const shopLayout = loadSource("src/app/shop/layout.tsx", {
    "next/navigation": { notFound }, "@/lib/site-visibility": { isShopVisible },
  });
  await test("shop subtree produces 404 OFF and renders ON", async () => {
    settings.setValue("false");
    await assert.rejects(() => shopLayout.default({ children: "SHOP" }), (error) => error.code === 404);
    settings.setValue("true");
    assert.equal(await shopLayout.default({ children: "SHOP" }), "SHOP");
  });

  let dbProductsQueried = 0;
  const productsDb = {
    from(table) {
      dbProductsQueried++;
      assert.equal(table, "products");
      return {
        select() { return this; },
        eq() { return this; },
        order() { return Promise.resolve({ data: [{ id: "test-only" }], error: null }); },
      };
    },
  };
  const productRoute = loadSource("src/app/api/products/route.ts", {
    "@/lib/db": { db: productsDb }, "@/lib/site-visibility": { isShopVisible },
  });
  await test("public product API is gated, but available again ON", async () => {
    settings.setValue("false");
    const before = dbProductsQueried;
    assert.equal((await productRoute.GET()).status, 404);
    assert.equal(dbProductsQueried, before, "must not fetch products when disabled");
    settings.setValue("true");
    const enabled = await productRoute.GET();
    assert.equal(enabled.status, 200);
    assert.equal(enabled.body.products.length, 1);
  });

  await test("product payments gated without blocking service payments", () => {
    const src = read("src/app/api/payment/init/route.ts");
    assert.match(src, /items\.some\(\(item\) => Boolean\(item\.productId\)\) && !\(await isShopVisible\(\)\)/);
    assert.match(src, /if \(bookingId && isPayableBookingType\(bookingType\)\)/);
    assert.match(src, /createPendingOrderWithReservation/);
  });
  await test("sitemap shop entries are conditional", () => {
    const src = read("src/app/sitemap.ts");
    assert.match(src, /const shopVisible = await isShopVisible\(\)/);
    assert.match(src, /shopVisible \? products \|\| \[\] : \[\]/);
  });
  await test("navigation/footer hide store links in OFF state", () => {
    const nav = read("src/components/Navbar.tsx");
    assert.match(nav, /primaryLinks\.filter\(\(link\) => shopVisible \|\| link\.href !== "\/shop"\)/);
    assert.match(nav, /navLinks\.filter\(\(link\) => shopVisible \|\| link\.href !== "\/shop"\)/);
    assert.match(nav, /shopVisible && \(/);
    assert.match(read("src/components/Footer.tsx"), /<ShopVisibilityLink \/>/);
  });
  await test("homepage remains CMS-driven and eliminates major effects", () => {
    const home = read("src/app/page.tsx");
    const catalog = read("src/lib/editable-pages.ts");
    const fields = [...home.matchAll(/copy\.([a-zA-Z0-9]+)/g)].map((match) => match[1]);
    const homeFields = catalog.slice(catalog.indexOf('slug: "home"'), catalog.indexOf('slug: "rehabilitation"'));
    for (const field of new Set(fields)) {
      assert.ok(homeFields.includes('key: "' + field + '"'), "Missing editable home field: " + field);
    }
    assert.doesNotMatch(home, /\b(GlassCard|premium-marquee|hero-orbit|hero-float-card|Sparkles|hero-stats|orb-teal)\b/);
    assert.match(home, /<EditorialReviews \/>/);
    assert.match(home, /href="\/rehabilitation#booking"/);
  });
  console.log("site-visibility/editorial contracts: " + checked + " groups PASS");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
