// Component event regression checks; browser geometry/focus tested separately.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function render(props) {
  const states = [];
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    react: { useEffect: () => {}, useId: () => 'test-id', useRef: current => ({ current }), useState: initial => [initial, value => states.push(value)] },
    'react-dom': { createPortal: value => value },
    'react/jsx-runtime': { jsx, jsxs: jsx },
  };
  const source = fs.readFileSync('src/components/admin/AdminConfirmDialog.tsx', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: key => mocks[key], document: { body: {} }, Error });
  return { tree: exports.default(props), states };
}
(async () => {
  let requests = 0, closed = 0, resolve;
  const pending = new Promise(done => { resolve = done; });
  const { tree } = render({ title: 'Delete?', children: 'Test', onCancel: () => closed++, onConfirm: async () => { requests++; await pending; } });
  const buttons = tree.props.children.props.children[2].props.children;
  buttons[1].props.onClick(); buttons[1].props.onClick();
  assert.equal(requests, 1, 'double clicks must not duplicate request');
  buttons[0].props.onClick();
  tree.props.onCancel({ preventDefault() {} });
  assert.equal(closed, 0, 'pending request cannot be accidentally dismissed');
  resolve(); await new Promise(setImmediate);
  assert.equal(closed, 1, 'success closes exactly once');
  closed = 0;
  const failed = render({ title: 'Delete?', children: 'Test', onCancel: () => closed++, onConfirm: async () => { throw new Error('Synthetic API error'); } });
  failed.tree.props.children.props.children[2].props.children[1].props.onClick();
  await new Promise(setImmediate);
  assert.equal(closed, 0, 'failure keeps dialog open');
  assert(failed.states.includes('Synthetic API error'));
  failed.tree.props.onCancel({ preventDefault() {} });
  assert.equal(closed, 1, 'Escape cancels after error');
  console.log('PASS modal event regressions: duplicate, busy cancellation, success, error persistence, error message, Escape');
})().catch(error => { console.error(error); process.exitCode = 1; });
