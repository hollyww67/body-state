// Actual TSX is transpiled and executed. React hooks, child UI and fetch are
// isolated; no application DB, payment transport or notification code is loaded.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const crypto = require("node:crypto").webcrypto;
const root = path.resolve(__dirname, "..");
const NOW = Date.parse("2032-02-10T08:00:00Z");
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [NOW])); } static now() { return NOW; } }
const future = { id: "synthetic-slot-1", slot_time: "2032-02-14T21:30:00Z", duration_minutes: 90 };
const later = { id: "synthetic-slot-2", slot_time: "2032-03-01T09:00:00Z", duration_minutes: 90 };
const flush = () => new Promise((resolve) => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function load(file, imports, globals = {}) {
  const result = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    fileName: file, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  assert.equal(result.diagnostics.length, 0);
  const mod = { exports: {} };
  vm.runInNewContext(result.outputText, { module: mod, exports: mod.exports, require(id) {
    assert.ok(Object.hasOwn(imports, id), "Unexpected import: " + id); return imports[id];
  }, Date: Clock, crypto, AbortController, btoa, ...globals }, { filename: file });
  return mod.exports;
}
const phone = load("src/lib/phone.ts", {});
function mount(file, initialProps = {}, profile = null) {
  let props = initialProps, cursor = 0, dirty = false, effects = [], alive = true, tree;
  const hooks = [], requests = [], events = [], domCalls = [];
  const attachedRefs = new Map();
  const same = (a, b) => a && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { value: typeof initial === "function" ? initial() : initial };
      return [hooks[index].value, (next) => {
        assert.ok(alive, "State write after unmount");
        const value = typeof next === "function" ? next(hooks[index].value) : next;
        if (!Object.is(value, hooks[index].value)) { hooks[index].value = value; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; return hooks[index] ||= { current: initial }; },
    useId() { return "fixture-" + cursor++; },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!same(hooks[index]?.deps, deps)) hooks[index] = { deps, value: callback };
      return hooks[index].value;
    },
    useEffect(effect, deps) {
      const index = cursor++, previous = hooks[index];
      if (!same(previous?.deps, deps)) effects.push(() => { previous?.cleanup?.(); hooks[index] = { deps, cleanup: effect() }; });
    },
  };
  const jsx = (type, nodeProps) => ({ type, props: nodeProps || {} });
  const imports = {
    react, "react/jsx-runtime": { jsx, jsxs: jsx }, "lucide-react": {}, "./booking-quiet.css": {},
    "@/components/BookingCalendar": { default: "Calendar" },
    "@/components/legal/PersonalDataConsent": { default: "Consent" },
    "@/components/PaymentOptionChoice": { default: "PaymentChoice" },
    "@/components/PromoCodeField": { default: "Promo" },
    "@/components/BookingReceipt": { default: "Receipt" },
    "@/components/AppointmentBookingForm": { default: "Appointment" },
    "@/components/ui/TextField": { default: "TextField" },
    "@/components/ui/button": { Button: "Button" },
    "@/lib/phone": phone, "@/lib/hooks/use-account-prefill": { useAccountPrefill: () => profile },
    "@/lib/funnel-analytics": { trackFunnel: (...args) => events.push(args) },
  };
  const component = load(file, imports, { fetch(url, options) {
    assert.ok(url.startsWith("/api/book/") || url.startsWith("/api/slots?"));
    if (url.startsWith("/api/slots?")) assert.equal(options.cache, "no-store");
    const pending = deferred();
    requests.push({ url, options, resolve: (body, status = 200) => pending.resolve({ ok: status >= 200 && status < 300, status, json: async () => body }), reject: pending.reject });
    return pending.promise;
  } }).default;
  function render() {
    let rounds = 0;
    do {
      assert.ok(++rounds < 20, "Effect/render loop"); dirty = false; cursor = 0;
      tree = component(props);
      // Attach only committed tree refs before effects, detach removed nodes,
      // and retain DOM identity across renders like React's commit phase.
      const nextRefs = new Set();
      for (const node of nodes(tree, (item) => item.props?.ref)) {
        const ref = node.props.ref;
        nextRefs.add(ref);
        if (!attachedRefs.has(ref)) {
          const element = { node, setCustomValidity() {}, querySelector: () => ({ reportValidity() {} }) };
          const record = (method, options) => domCalls.push({
            method, type: element.node.type, text: text(element.node),
            className: element.node.props.className, tabIndex: element.node.props.tabIndex,
            options: { ...options },
          });
          element.focus = (options) => record("focus", options);
          element.scrollIntoView = (options) => record("scrollIntoView", options);
          attachedRefs.set(ref, element);
        }
        ref.current = attachedRefs.get(ref);
        ref.current.node = node;
      }
      for (const [ref] of attachedRefs) if (!nextRefs.has(ref)) { ref.current = null; attachedRefs.delete(ref); }
      const commit = effects; effects = []; commit.forEach((effect) => effect());
    } while (dirty);
    return tree;
  }
  function nodes(node, predicate, found = []) {
    if (Array.isArray(node)) node.forEach((child) => nodes(child, predicate, found));
    else if (node && typeof node === "object") { if (predicate(node)) found.push(node); nodes(node.props?.children, predicate, found); }
    return found;
  }
  const text = (node) => Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object" ? text(node.props?.children) : node == null || node === false ? "" : String(node);
  const all = (predicate) => nodes(render(), predicate);
  const find = (predicate) => { const result = all(predicate)[0]; assert.ok(result, "Missing UI node"); return result; };
  render();
  return {
    requests, events, domCalls, render, text: () => text(render()), all, find,
    child: (type) => find((node) => node.type === type),
    button(label) { return find((node) => ["Button", "button"].includes(node.type) && text(node) === label); },
    click(label) { const button = this.button(label); assert.ok(!button.props.disabled); button.props.onClick(); render(); },
    field(label, value) { find((node) => node.type === "TextField" && node.props.label === label).props.onChange({ target: { value }, currentTarget: { setCustomValidity() {} } }); render(); },
    advance() { return find((node) => node.type === "form").props.onSubmit({ preventDefault() {} }); },
    selectSlot(slot = future) { const calendar = this.child("Calendar"); calendar.props.onLoadingChange(false); calendar.props.onSelect(slot.id, slot); render(); },
    update(next) { props = next; render(); },
    unmount() { alive = false; hooks.forEach((hook) => hook?.cleanup?.()); for (const [ref] of attachedRefs) ref.current = null; attachedRefs.clear(); },
  };
}
const appointment = (props = {}, profile) => mount("src/components/AppointmentBookingForm.tsx", { service: "bfm", price: 3000, ...props }, profile);
const saved = (status = "pending") => ({ booking: { id: "synthetic-booking", accessToken: "synthetic-access", summary: { id: "synthetic-booking", status, snapshot: { total: 3000 } } } });
function contacts(c) { c.field("Ваше имя", "Тестовый клиент"); c.field("Номер телефона", "89151234567"); c.field("Электронная почта", "qa@example.invalid"); c.child("Consent").props.onChange(true); }
async function review(c) { await c.advance(); c.selectSlot(); await c.advance(); contacts(c); await c.advance(); assert.ok(c.text().includes("Проверьте данные")); }
function assertViewportEntry(c, title, success = false) {
  c.render();
  const calls = c.domCalls.splice(0);
  assert.deepEqual(calls.map(({ method, type, options }) => ({ method, type, options })), [
    { method: "focus", type: success ? "div" : "h2", options: { preventScroll: true } },
    { method: "scrollIntoView", type: success ? "div" : "form", options: { block: "start", behavior: "instant" } },
  ]);
  assert.equal(calls[0].tabIndex, -1, "Focus target must be programmatically focusable");
  if (success) {
    assert.equal(calls[0].className, "qb-booking qb-success");
    assert.equal(calls[1].className, "qb-booking qb-success");
  } else {
    assert.equal(calls[0].text, title, "Focus the newly committed step heading");
    assert.equal(calls[1].className, "qb-booking", "Scroll the entire form including progress, not only the heading");
  }
}

async function main() {
  let count = 0;
  async function test(name, run) { await run(); count++; console.log("PASS " + name); }
  await test("step entry focuses current heading and instantly scrolls form including progress; typing does not", async () => {
    const c = appointment(); assertViewportEntry(c, "Записаться на приём");
    await c.advance(); assertViewportEntry(c, "Когда вам удобно?");
    c.selectSlot();
    c.find((node) => node.type === "button" && node.props["aria-current"] === "step").props.onClick();
    c.render(); assert.equal(c.domCalls.length, 0, "Same step/slot render must not steal focus");
    await c.advance(); assertViewportEntry(c, "Как с вами связаться?");
    contacts(c); c.render(); assert.equal(c.domCalls.length, 0, "Contact edits must not scroll or steal focus");
    await c.advance(); assertViewportEntry(c, "Проверьте данные");
    c.click("Назад"); assertViewportEntry(c, "Как с вами связаться?");
    await c.advance(); assertViewportEntry(c, "Проверьте данные");
    assert.equal(c.requests.length, 0, "Viewport navigation cannot POST a booking");
  });
  for (const status of ["pending", "confirmed"]) await test(status + " immutable server success focuses and scrolls result once without changing body/status", async () => {
    const c = appointment(); await review(c); c.domCalls.length = 0;
    const pending = c.advance(), request = c.requests[0], body = request.options.body;
    c.render(); assert.equal(c.domCalls.length, 0, "Submitting on the same step must not scroll");
    const { requestKey, accessToken } = JSON.parse(body);
    assert.match(requestKey, /^[0-9a-f-]{36}$/); assert.equal(accessToken.length, 43);
    assert.deepEqual(JSON.parse(body), {
      slot_id: future.id, client_name: "Тестовый клиент", client_phone: "+7 (915) 123-45-67", client_email: "qa@example.invalid",
      consent: true, payment_option: "online", booking_type: "offline", requestKey, accessToken,
    });
    const response = saved(status);
    Object.freeze(response.booking.summary.snapshot); Object.freeze(response.booking.summary);
    Object.freeze(response.booking); Object.freeze(response);
    request.resolve(response, 201); await pending;
    const receipt = c.child("Receipt");
    assertViewportEntry(c, null, true);
    assert.strictEqual(receipt.props.initial, response.booking.summary);
    assert.equal(receipt.props.initial.status, status); assert.equal(receipt.props.accessToken, "synthetic-access");
    assert.equal(c.all((node) => node.type === "form" || node.type === "h2").length, 0);
    c.render(); assert.equal(c.domCalls.length, 0, "Stable saved result must not repeatedly steal focus");
    assert.equal(c.requests.length, 1); assert.equal(request.options.body, body);
  });
  await test("thin service wrapper owns one persistent appointment and never adds BRT", async () => {
    const wrapper = mount("src/components/ServiceBookingForm.tsx", { bfmPrice: 3000, psychologyPrice: 4000 });
    const options = wrapper.child("Appointment").props;
    assert.deepEqual(Array.from(options.serviceOptions, (item) => item.id), ["bfm", "psychology"]);
    const c = appointment(options);
    await c.advance(); c.selectSlot(); await c.advance(); contacts(c);
    c.click("Услуга");
    c.find((node) => node.type === "input" && node.props.value === "psychology").props.onChange();
    await c.advance(); assert.equal(c.child("Calendar").props.serviceType, "psychology");
    assert.equal(c.child("Calendar").props.initialSlot, null);
    c.selectSlot(); await c.advance();
    assert.equal(c.find((node) => node.type === "TextField" && node.props.label === "Ваше имя").props.value, "Тестовый клиент");
    assert.equal(c.find((node) => node.type === "TextField" && node.props.label === "Номер телефона").props.value, "+7 (915) 123-45-67");
    assert.equal(c.child("Consent").props.checked, true);
    await c.advance(); assert.ok(c.text().includes("4\u00a0000") || c.text().includes("4 000"));
    assert.equal(c.requests.length, 0);
  });
  await test("steps 1–3 never POST; final submit saves once and uses server receipt", async () => {
    const c = appointment(); await review(c); assert.equal(c.requests.length, 0);
    const first = c.advance(), duplicate = c.advance();
    assert.equal(c.requests.length, 1); assert.equal(c.requests[0].url, "/api/book/bfm");
    const body = JSON.parse(c.requests[0].options.body);
    assert.equal(body.slot_id, future.id); assert.equal(body.consent, true); assert.ok(body.requestKey); assert.equal(body.accessToken.length, 43);
    c.requests[0].resolve(saved(), 201); await Promise.all([first, duplicate]);
    assert.equal(c.child("Receipt").props.initial.status, "pending");
    assert.equal(c.child("Receipt").props.accessToken, "synthetic-access");
  });
  await test("clicking the active date step cannot leave a ready calendar stuck loading", async () => {
    const c = appointment(); await c.advance(); c.selectSlot();
    assert.equal(c.button("Продолжить").props.disabled, false);
    c.find((node) => node.type === "button" && node.props["aria-current"] === "step").props.onClick();
    assert.equal(c.button("Продолжить").props.disabled, false);
    await c.advance(); assert.ok(c.text().includes("Как с вами связаться?"));
  });
  await test("expired selection returns to calendar without booking POST", async () => {
    const c = appointment(); await c.advance(); c.selectSlot({ ...future, slot_time: "2032-02-09T08:00:00Z" });
    await c.advance(); contacts(c); await c.advance(); await c.advance();
    assert.ok(c.text().includes("Когда вам удобно?")); assert.equal(c.requests.length, 0);
  });
  await test("direct BRT stays fixed and retains its endpoint without a generic chooser or promo", async () => {
    const c = appointment({ service: "brt", price: 3000 });
    assert.equal(c.all((node) => node.type === "input" && node.props.type === "radio").length, 1);
    await c.advance(); c.selectSlot({ ...future, duration_minutes: 60 }); await c.advance(); contacts(c);
    assert.equal(c.all((node) => node.type === "Promo").length, 0); await c.advance(); const pending = c.advance();
    assert.equal(c.requests[0].url, "/api/book/brt"); c.requests[0].resolve(saved()); await pending;
  });
  await test("phone, email and consent validation blocks review and preserves draft", async () => {
    const c = appointment(); await c.advance(); c.selectSlot(); await c.advance();
    contacts(c); c.field("Номер телефона", "123"); await c.advance();
    assert.ok(c.text().includes("Как с вами связаться?")); assert.ok(c.text().includes("Проверьте имя"));
    c.field("Номер телефона", "89151234567"); c.field("Электронная почта", "bad"); await c.advance();
    assert.ok(c.text().includes("Как с вами связаться?")); c.field("Электронная почта", "qa@example.invalid");
    c.child("Consent").props.onChange(false); await c.advance(); assert.ok(c.text().includes("Как с вами связаться?"));
    assert.equal(c.requests.length, 0);
  });
  for (const outcome of ["network", "server", "malformed"]) await test(outcome + " uncertainty retries identical payload/key/token and locks editing", async () => {
    const c = appointment(); await review(c); c.domCalls.length = 0;
    const first = c.advance(), originalBody = c.requests[0].options.body;
    c.render(); assert.equal(c.domCalls.length, 0);
    if (outcome === "network") c.requests[0].reject(new Error("Synthetic network loss"));
    else c.requests[0].resolve(outcome === "server" ? { error: "Synthetic failure" } : {}, outcome === "server" ? 500 : 200);
    await first; assert.equal(c.button("Назад").props.disabled, true);
    assert.equal(c.button("Услуга").props.disabled, true);
    assert.equal(c.domCalls.length, 0, "Uncertain outcome must not scroll or change step");
    const retry = c.advance(); assert.equal(c.requests[1].options.body, originalBody);
    assert.equal(c.requests[1].url, c.requests[0].url);
    assert.equal(c.requests[1].options.method, "POST");
    c.render(); assert.equal(c.domCalls.length, 0, "Replay must not scroll before a saved result");
    c.requests[1].resolve(saved(), 200); await retry; assert.equal(c.child("Receipt").props.initial.status, "pending");
    assertViewportEntry(c, null, true);
    assert.equal(c.requests[0].options.body, originalBody); assert.equal(c.requests[1].options.body, originalBody);
  });
  await test("409 returns to fresh time selection, keeps contacts and creates a new attempt", async () => {
    const c = appointment(); await review(c); const first = c.advance(); c.requests[0].resolve({ error: "Это время уже занято" }, 409); await first;
    assert.ok(c.text().includes("Когда вам удобно?")); assert.equal(c.child("Calendar").props.initialSlot, null);
    c.selectSlot(later); await c.advance(); assert.equal(c.find((node) => node.type === "TextField" && node.props.label === "Ваше имя").props.value, "Тестовый клиент");
    await c.advance(); const next = c.advance();
    assert.notEqual(JSON.parse(c.requests[1].options.body).requestKey, JSON.parse(c.requests[0].options.body).requestKey);
    assert.equal(JSON.parse(c.requests[1].options.body).slot_id, later.id);
    c.requests[1].resolve(saved()); await next;
  });
  await test("fixed program title/id, online-only psychology and promo use existing contract", async () => {
    const wrapper = mount("src/components/PsychologyBookingSection.tsx", { programId: 7, programTitle: "Синтетическая программа", price: 5000 });
    const c = appointment(wrapper.child("Appointment").props);
    assert.equal(c.all((node) => node.type === "input" && node.props.type === "radio").length, 1);
    assert.ok(c.text().includes("Синтетическая программа")); await c.advance(); c.selectSlot(); await c.advance(); contacts(c);
    c.child("PaymentChoice").props.onChange("at_appointment"); c.render();
    c.find((node) => node.type === "select").props.onChange({ target: { value: "online" } });
    assert.equal(c.child("PaymentChoice").props.onlineOnly, true); assert.equal(c.child("PaymentChoice").props.value, "online");
    assert.equal(c.child("Promo").props.programId, 7); assert.equal(c.child("Promo").props.serviceCode, "psychology_program");
    c.child("Promo").props.onChange({ code: "QA10", subtotal: 5000, discount: 500, total: 4500 }); await c.advance();
    const pending = c.advance(), body = JSON.parse(c.requests[0].options.body);
    assert.equal(body.program_id, 7); assert.equal(body.booking_type, "online"); assert.equal(body.payment_option, "online"); assert.equal(body.promoCode, "QA10");
    c.requests[0].resolve(saved()); await pending;
  });
  await test("at-appointment clears promo and confirmed success comes only from server", async () => {
    const c = appointment(); await c.advance(); c.selectSlot(); await c.advance(); contacts(c);
    c.child("Promo").props.onChange({ code: "QA10", total: 2700 }); c.child("PaymentChoice").props.onChange("at_appointment");
    assert.equal(c.all((node) => node.type === "Promo").length, 0); await c.advance(); const pending = c.advance();
    const body = JSON.parse(c.requests[0].options.body); assert.equal(body.payment_option, "at_appointment"); assert.equal(body.promoCode, undefined);
    c.requests[0].resolve(saved("confirmed"), 201); await pending; assert.equal(c.child("Receipt").props.initial.status, "confirmed");
  });
  await test("late promo from the previous service cannot change the new service or frozen request", async () => {
    const c = appointment({ serviceOptions: [
      { id: "bfm", title: "BFM", description: "", price: 3000 },
      { id: "psychology", title: "Psychology", description: "", price: 4000 },
    ] });
    await c.advance(); c.selectSlot(); await c.advance(); contacts(c);
    const oldPromo = c.child("Promo").props.onChange;
    c.click("Услуга"); c.find((node) => node.type === "input" && node.props.value === "psychology").props.onChange();
    await c.advance(); c.selectSlot(); await c.advance();
    oldPromo({ code: "STALE", total: 1 });
    const currentPromo = c.child("Promo").props.onChange;
    await c.advance(); assert.ok(!c.text().includes("STALE"));
    const pending = c.advance(); currentPromo({ code: "LATE", total: 1 });
    assert.ok(!c.text().includes("LATE")); assert.equal(JSON.parse(c.requests[0].options.body).promoCode, undefined);
    c.requests[0].resolve(saved()); await pending;
  });
  await test("prefill never overwrites entered contacts; 400 is editable, not a success", async () => {
    const c = appointment({}, { display_name: "Профиль", phone: "+79990000001", email: "profile@example.invalid" });
    await review(c); const pending = c.advance(); c.requests[0].resolve({ error: "Укажите корректный e-mail" }, 400); await pending;
    assert.equal(c.all((node) => node.type === "Receipt").length, 0); assert.equal(c.button("Назад").props.disabled, false);
    c.click("Контакты"); assert.equal(c.find((node) => node.type === "TextField" && node.props.label === "Ваше имя").props.value, "Тестовый клиент");
  });
  await test("real month grid uses Moscow day, leap February, only future slots; onSelect remains immediate", async () => {
    const selected = [];
    const c = mount("src/components/BookingCalendar.tsx", { serviceType: "bfm", onSelect: (...args) => selected.push(args) });
    c.requests[0].resolve({ slots: [{ ...future, id: "past", slot_time: "2032-02-09T08:00:00Z" }, future, later] }); await flush();
    assert.ok(c.text().includes("февраль 2032"));
    const days = c.all((node) => node.type === "button" && node.props["aria-label"]?.includes("февраля"));
    assert.equal(days.length, 29); assert.equal(days.filter((node) => !node.props.disabled).length, 1);
    assert.ok(days.find((node) => !node.props.disabled).props["aria-label"].includes("15 февраля"));
    c.click("00:30"); assert.equal(selected.length, 1); assert.equal(selected[0][0], future.id); assert.equal(selected[0][1].duration_minutes, 90);
    c.find((node) => node.type === "button" && node.props["aria-label"] === "Следующий месяц").props.onClick();
    assert.ok(c.text().includes("март 2032")); assert.ok(c.text().includes("Выберите доступную дату"));
  });
  await test("calendar restores selection, clears vanished slot, retries errors, aborts stale responses/unmount", async () => {
    let cleared = 0;
    const props = { serviceType: "bfm", initialSlot: future, onSelectionClear: () => cleared++, onSelect() {} };
    const c = mount("src/components/BookingCalendar.tsx", props);
    c.requests[0].resolve({ slots: [future] }); await flush();
    assert.equal(c.button("00:30").props["aria-pressed"], true); assert.equal(cleared, 0);
    c.update({ ...props, serviceType: "psychology" }); assert.equal(c.requests[0].options.signal.aborted, true);
    c.requests[1].reject(new Error("Synthetic unavailable")); await flush(); c.click("Попробовать ещё раз");
    c.requests[2].resolve({ slots: [later] }); await flush(); assert.equal(cleared, 2);
    c.update({ ...props, serviceType: "brt" }); const last = c.requests.at(-1); c.unmount(); assert.equal(last.options.signal.aborted, true);
    last.resolve({ slots: [future] }); await flush();
    const empty = mount("src/components/BookingCalendar.tsx", { serviceType: "bfm", onSelect() {} }); empty.requests[0].resolve({ slots: [] }); await flush();
    assert.ok(empty.text().includes("Пока нет свободных окон"));
  });
  await test("late calendar response cannot restore slots from a previous service", async () => {
    const props = { serviceType: "bfm", onSelect() {} };
    const c = mount("src/components/BookingCalendar.tsx", props);
    c.update({ ...props, serviceType: "psychology" });
    assert.equal(c.requests[0].options.signal.aborted, true);
    c.requests[1].resolve({ slots: [later] }); await flush();
    assert.ok(c.text().includes("март 2032"));
    c.requests[0].resolve({ slots: [future] }); await flush();
    assert.ok(c.text().includes("март 2032")); assert.ok(!c.text().includes("февраль 2032"));
  });
  console.log("quiet booking: " + count + " isolated UI groups PASS");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
