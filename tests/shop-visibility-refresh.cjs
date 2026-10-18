// Offline regression tests of the actual transpiled components. Hooks, JSX and
// browser APIs are stubbed; fetch responses are controlled and never use a network.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));
const abortError = () => Object.assign(new Error("Synthetic abort"), { name: "AbortError" });

function mount(file) {
  const hooks = [];
  const listeners = new Map();
  const requests = [];
  let pathname = "/";
  let cursor = 0;
  let pendingEffects = [];
  let mounted = true;
  let writes = 0;
  let writesAfterUnmount = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { value: initial };
      return [hooks[index].value, (next) => {
        writes++;
        if (!mounted) writesAfterUnmount++;
        hooks[index].value = typeof next === "function" ? next(hooks[index].value) : next;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { current: initial };
      return hooks[index];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = hooks[index];
      if (previous && deps.length === previous.deps.length && deps.every((dep, i) => Object.is(dep, previous.deps[i]))) return;
      pendingEffects.push(() => {
        previous?.cleanup?.();
        hooks[index] = { deps, cleanup: effect() };
      });
    },
  };
  const jsx = (type, props) => ({ type, props });
  const imports = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/link": { default: "link" },
    "next/image": { default: "image" },
    "next/navigation": { usePathname: () => pathname },
    "lucide-react": {},
    "@/components/ui/Container": { default: "container" },
    "@/components/ThemeToggle": { default: "theme-toggle" },
    // Presentation-only dependencies: keep component effects and fetch logic real.
    "@/components/BodyStateWordmark": { default: "body-state-wordmark" },
    "./quiet-nav.css": {},
  };
  const { outputText, diagnostics } = ts.transpileModule(
    fs.readFileSync(path.resolve(__dirname, "..", file), "utf8"),
    { fileName: file, reportDiagnostics: true, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } },
  );
  assert.equal(diagnostics.length, 0, "Component transpilation must succeed");
  const mod = { exports: {} };
  vm.runInNewContext(outputText, {
    exports: mod.exports,
    module: mod,
    require(id) {
      assert.ok(Object.hasOwn(imports, id), "Unexpected import: " + id);
      return imports[id];
    },
    AbortController,
    localStorage: { getItem: () => null },
    window: {
      addEventListener(event, listener) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(listener);
      },
      removeEventListener(event, listener) { listeners.get(event)?.delete(listener); },
    },
    fetch(url, options) {
      assert.equal(url, "/api/site-visibility");
      assert.equal(options.cache, "no-store");
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(options.signal.aborted, false);
      const response = deferred();
      // Deliberately do not auto-reject on abort: already received responses and
      // delayed JSON/error handlers must also be unable to publish stale state.
      requests.push({
        signal: options.signal,
        resolve: (body, ok = true) => response.resolve({ ok, json: async () => body }),
        resolveJson: (bodyPromise) => response.resolve({ ok: true, json: () => bodyPromise }),
        reject: response.reject,
      });
      return response.promise;
    },
  }, { filename: file });

  function render() {
    assert.ok(mounted);
    cursor = 0;
    const tree = mod.exports.default();
    const effects = pendingEffects;
    pendingEffects = [];
    for (const effect of effects) effect();
    return tree;
  }
  function links(node, found = []) {
    if (Array.isArray(node)) node.forEach((child) => links(child, found));
    else if (node && typeof node === "object") {
      if (node.props?.href) found.push(node.props.href);
      links(node.props?.children, found);
    }
    return found;
  }
  render();
  return {
    requests,
    focus() { for (const listener of listeners.get("focus") || []) listener(); },
    navigate(next) { pathname = next; render(); },
    visible() { return links(render()).includes("/shop"); },
    cartVisible() { return links(render()).includes("/shop/cart"); },
    focusListeners() { return listeners.get("focus")?.size || 0; },
    writes: () => writes,
    writesAfterUnmount: () => writesAfterUnmount,
    unmount() {
      mounted = false;
      for (const hook of hooks) hook.cleanup?.();
    },
  };
}

async function main() {
  let passed = 0;
  const files = ["src/components/Navbar.tsx", "src/components/ShopVisibilityLink.tsx"];
  async function test(file, name, run) {
    const component = mount(file);
    try { await run(component); passed++; console.log("PASS " + path.basename(file) + ": " + name); }
    finally { component.unmount(); }
  }
  for (const file of files) {
    await test(file, "slow initial ON cannot overwrite focus OFF", async (c) => {
      assert.equal(c.visible(), false);
      c.focus();
      assert.equal(c.requests[0].signal.aborted, true);
      c.requests[1].resolve({ shopVisible: false });
      await settle();
      assert.equal(c.visible(), false);
      const writes = c.writes();
      c.requests[0].resolve({ shopVisible: true });
      await settle();
      assert.equal(c.visible(), false);
      assert.equal(c.cartVisible(), false);
      assert.equal(c.writes(), writes, "Aborted success must not write state");
    });
    await test(file, "late aborted catch cannot overwrite latest ON", async (c) => {
      c.focus();
      c.requests[1].resolve({ shopVisible: true });
      await settle();
      assert.equal(c.visible(), true);
      if (file.endsWith("Navbar.tsx")) assert.equal(c.cartVisible(), true);
      const writes = c.writes();
      c.requests[0].reject(abortError());
      await settle();
      assert.equal(c.visible(), true);
      assert.equal(c.writes(), writes, "Aborted catch must not write state");
    });
    await test(file, "late JSON from aborted OFF cannot overwrite latest ON", async (c) => {
      const body = deferred();
      c.requests[0].resolveJson(body.promise);
      await settle();
      c.focus();
      c.requests[1].resolve({ shopVisible: true });
      await settle();
      assert.equal(c.visible(), true);
      const writes = c.writes();
      body.resolve({ shopVisible: false });
      await settle();
      assert.equal(c.visible(), true);
      assert.equal(c.writes(), writes);
    });
    await test(file, "pathname change fetches fresh state and aborts previous effect", async (c) => {
      c.requests[0].resolve({ shopVisible: true });
      await settle();
      assert.equal(c.visible(), true);
      c.focus();
      c.navigate("/about");
      assert.equal(c.requests.length, 3);
      assert.equal(c.requests[1].signal.aborted, true);
      assert.equal(c.focusListeners(), 1);
      c.requests[2].resolve({ shopVisible: false });
      await settle();
      c.requests[1].resolve({ shopVisible: true });
      await settle();
      assert.equal(c.visible(), false);
      c.navigate("/about");
      assert.equal(c.requests.length, 3, "Same pathname must not refetch on render");
    });
    await test(file, "latest network/HTTP/JSON failures and non-boolean values fail closed", async (c) => {
      for (const fail of [
        (request) => request.reject(new Error("Synthetic network failure")),
        (request) => request.resolve({}, false),
        (request) => request.resolveJson(Promise.reject(new SyntaxError("Synthetic invalid JSON"))),
        (request) => request.resolve({ shopVisible: "true" }),
        (request) => request.resolve(null),
      ]) {
        c.requests.at(-1).resolve({ shopVisible: true });
        await settle();
        assert.equal(c.visible(), true);
        c.focus();
        fail(c.requests.at(-1));
        await settle();
        assert.equal(c.visible(), false);
        c.focus();
      }
    });
    for (const outcome of ["success", "abort"]) {
      await test(file, "unmount aborts latest request and removes listener: " + outcome, async (c) => {
        c.focus();
        c.unmount();
        assert.ok(c.requests.every((request) => request.signal.aborted));
        assert.equal(c.focusListeners(), 0);
        const count = c.requests.length;
        c.focus();
        assert.equal(c.requests.length, count);
        for (const request of c.requests) {
          if (outcome === "success") request.resolve({ shopVisible: true });
          else request.reject(abortError());
        }
        await settle();
        assert.equal(c.writesAfterUnmount(), 0);
      });
    }
  }
  console.log("shop visibility refresh: " + passed + " offline scenarios PASS");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
