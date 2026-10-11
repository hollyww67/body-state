const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts', 'audit-runtime');
function compile(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) compile(file);
    else if (/\.tsx?$/.test(file) && !file.endsWith('.d.ts')) {
      const target = path.join(output, path.relative(root, file).replace(/\.tsx?$/, '.js'));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        fileName: file,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      }).outputText);
    }
  }
}
compile(path.join(root, 'src'));
fs.mkdirSync(path.join(output, 'tests'), { recursive: true });
fs.copyFileSync(path.join(root, 'tests', 'audit-regressions.cjs'), path.join(output, 'tests', 'audit-regressions.cjs'));
fs.copyFileSync(path.join(root, 'tests', 'scheduling-hardening-unit.cjs'), path.join(output, 'tests', 'scheduling-hardening-unit.cjs'));
fs.copyFileSync(path.join(root, 'tests', 'scheduling-pool.cjs'), path.join(output, 'tests', 'scheduling-pool.cjs'));
fs.mkdirSync(path.join(output, 'scripts'), { recursive: true });
fs.copyFileSync(path.join(root, 'scripts', 'migrate.mjs'), path.join(output, 'scripts', 'migrate.mjs'));
fs.cpSync(path.join(root, 'migrations'), path.join(output, 'migrations'), { recursive: true });
console.log('Compiled regression runtime:', output);
