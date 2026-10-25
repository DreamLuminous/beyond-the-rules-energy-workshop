const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const output = path.join(root, 'dist');
const publicFiles = [
  'index.html', 'style.css', 'theme.css', 'app.js', 'engine.js', 'growth.js',
  'c-worker.js', 'c-run-worker.js'
];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const file of publicFiles) fs.copyFileSync(path.join(root, file), path.join(output, file));
console.log(`Netlify public files prepared: ${publicFiles.length}`);
