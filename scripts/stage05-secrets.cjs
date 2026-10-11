const fs = require('node:fs');
const path = require('node:path');
const roots = ['src', 'scripts', 'tests', '.github'];
const signatures = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /gh[pousr]_[A-Za-z0-9]{30,}/, /AKIA[0-9A-Z]{16}/];
let findings = 0;
function scan(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) scan(file);
    else if (/\.(tsx?|[cm]?js|ya?ml|json)$/.test(file)) {
      const source = fs.readFileSync(file, 'utf8');
      if (signatures.some(pattern => pattern.test(source))) { console.error('Potential secret:', file); findings++; }
    }
  }
}
roots.forEach(scan);
console.log(`Secret signature scan: ${findings} findings. Not an exhaustive secret audit.`);
process.exitCode = findings ? 1 : 0;
