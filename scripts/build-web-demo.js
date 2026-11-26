// Turns `expo export --platform web` output (dist/) into ONE self-contained
// HTML file (dist-demo/index.html): JS inlined, images and fonts as data: URIs.
// Useful for hosting the demo anywhere, including sandboxed previews.
//   npx expo export --platform web && node scripts/build-web-demo.js
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const outDir = path.join(__dirname, '..', 'dist-demo');
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const mime = { '.png': 'image/png', '.ttf': 'font/ttf', '.otf': 'font/otf', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
const dataUri = (rel) => {
  const file = path.join(dist, rel);
  if (!fs.existsSync(file)) return null;
  return `data:${mime[path.extname(file)] ?? 'application/octet-stream'};base64,${fs.readFileSync(file).toString('base64')}`;
};

const scripts = [...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)];
let inlined = '';
for (const [, src] of scripts) {
  let js = fs.readFileSync(path.join(dist, src), 'utf8');
  js = js.replace(/\/assets\/[A-Za-z0-9_@./+-]+\.(png|ttf|otf|jpg)/g, (m) => dataUri(m) ?? m);
  inlined += `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>\n`;
}
html = html.replace(/<script src="[^"]+" defer><\/script>/g, '');
html = html.replace(/<link rel="icon"[^>]*\/>/, '');
// The router reads the page path; start the demo at "/" wherever it is hosted.
const boot = `<script>try{if(location.pathname!=="/")history.replaceState(null,"","/")}catch(e){}</script>`;
html = html.replace("</body>", () => `${boot}\n${inlined}</body>`);
html = html.replace('<!doctype html>', '<!DOCTYPE html>');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log(`Wrote dist-demo/index.html (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
