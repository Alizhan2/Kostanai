const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.web-static');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
const files = [
  'assets', 'docs/aps-demo.html', 'docs/aps-demo.css', 'docs/aps-base.css', 'docs/aps-demo.js',
  'docs/presentation.pdf', 'docs/technical-description.md',
  'ml-runtime.js', 'ml-features.js', 'aps-runtime.js',
  'models/aps-diagnostic.js', 'data/aps-examples.js',
  'ml/results/aps/evaluation.png', 'ml/results/aps/report.json', 'ml/public/aps/manifest.json',
];
for (const relative of files) {
  const target = path.join(output, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(path.join(root, relative), target, { recursive: true });
}
console.log('Prepared local assets and separate Scania diagnostic page.');
