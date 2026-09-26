/**
 * Builds a single self-contained HTML file with all CSS, JS and images inlined
 * as data URIs — useful for reviewing the design in a sandboxed preview, and for
 * handing the client one file that opens anywhere with no server.
 *
 *   node tools/make-standalone.mjs index.html            -> _preview.html
 *   node tools/make-standalone.mjs index.html out.html
 *   node tools/make-standalone.mjs --responsive index.html -> _preview-responsive.html
 */
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const MIME = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const args = process.argv.slice(2);
const responsive = args[0] === '--responsive';
const source = responsive ? args[1] : args[0] || 'index.html';
const target = responsive ? '_preview-responsive.html' : args[1] && !responsive ? args[1] : '_preview.html';

const abs = (p) => path.join(ROOT, p);

async function dataUri(relPath) {
  const file = abs(relPath.split('?')[0]);
  const info = await stat(file).catch(() => null);
  if (!info) {
    console.warn(`  ! missing asset: ${relPath}`);
    return null;
  }
  const buffer = await readFile(file);
  const mime = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function inline(html) {
  // NOTE: every replacement below passes a function, never a replacement string.
  // A replacement string would interpret `$$`, `$&`, `$\`` and `$'`, which silently
  // rewrites `$$(sel)` in main.js into `$(sel)` and breaks the whole script.

  // <link rel="stylesheet" href="...">
  for (const match of [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)]) {
    const uri = await dataUri(match[1]);
    if (!uri) continue;
    const css = Buffer.from(uri.split(',')[1], 'base64').toString('utf8');
    html = html.replace(match[0], () => `<style>\n${css}\n</style>`);
  }

  // <script src="...">
  for (const match of [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g)]) {
    const uri = await dataUri(match[1]);
    if (!uri) continue;
    const js = Buffer.from(uri.split(',')[1], 'base64').toString('utf8');
    html = html.replace(match[0], () => `<script>\n${js}\n</script>`);
  }

  // <img src="..."> (skip remote and already-inlined)
  for (const match of [...html.matchAll(/<img[^>]+src="([^"]+)"/g)]) {
    const src = match[1];
    if (/^(https?:|data:)/.test(src)) continue;
    const uri = await dataUri(src);
    if (!uri) continue;
    const replaced = match[0].replace(`src="${src}"`, `src="${uri}"`);
    html = html.replace(match[0], () => replaced);
  }

  // Inline SVGs referenced as images cannot be data-URI-swapped in srcset etc.
  return html;
}

const html = await readFile(abs(source), 'utf8');
const page = await inline(html);

if (!responsive) {
  await writeFile(abs(target), page, 'utf8');
  const size = (Buffer.byteLength(page) / 1024).toFixed(1);
  console.log(`✓ ${target} — single self-contained file (${size} KB) from ${source}`);
} else {
  const widths = [320, 360, 375, 390, 430];
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const frames = widths
    .map(
      (w) => `<figure>
  <figcaption>${w}px</figcaption>
  <div class="frame" style="width:${w}px">
    <iframe title="${w}px" width="${w}" height="820" srcdoc="${esc(page)}"></iframe>
  </div>
</figure>`
    )
    .join('\n');

  const harness = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=2400">
<title>Responsive check — ${source}</title>
<style>
  body{margin:0;padding:18px;background:#3a342d;color:#f3ede4;font:12px/1.4 -apple-system,Segoe UI,Roboto,sans-serif}
  h1{font-size:12px;letter-spacing:.2em;text-transform:uppercase;margin:0 0 14px;color:#ddc9a6}
  .row{display:flex;gap:18px;align-items:flex-start}
  figure{margin:0}
  figcaption{letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px;color:#ddc9a6}
  .frame{background:#fff;border:1px solid #000;overflow:hidden}
  iframe{display:block;border:0}
</style></head>
<body>
<h1>Responsive check — ${source}</h1>
<div class="row">${frames}</div>
</body></html>`;

  await writeFile(abs('_preview-responsive.html'), harness, 'utf8');
  console.log(`✓ _preview-responsive.html — ${widths.join(', ')}px`);
}
