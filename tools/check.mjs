/**
 * Post-build verification.
 *
 * Walks every generated page and checks the things that are easy to break in a
 * hand-written static site: unresolved template placeholders, internal links and
 * in-page anchors that point nowhere, referenced assets that do not exist, SEO
 * basics, and the copy rules for this demo (no invented claims, no demo artwork
 * presented as completed Hometech projects).
 *
 *   npm run check
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const site = JSON.parse(await readFile(path.join(ROOT, 'site.config.json'), 'utf8'));

const problems = [];
const notes = [];
const fail = (file, message) => problems.push(`${file}: ${message}`);

const files = (await readdir(ROOT)).filter((f) => f.endsWith('.html') && !f.startsWith('_'));
files.sort();

if (!files.length) {
  console.error('✗ No built HTML found at the project root — run `npm run build` first.');
  process.exit(1);
}

const exists = async (rel) => !!(await stat(path.join(ROOT, rel)).catch(() => null));

/* --------------------------------------------------------------- page checks */

const titles = new Map();
const descriptions = new Map();

for (const file of files) {
  const html = await readFile(path.join(ROOT, file), 'utf8');

  // 1. Template leftovers
  for (const match of html.matchAll(/\{\{[^}]*\}\}/g)) fail(file, `unresolved placeholder ${match[0]}`);

  // 2. Head basics
  const title = /<title>([^<]*)<\/title>/.exec(html);
  if (!title) fail(file, 'missing <title>');
  else {
    if (title[1].length > 70) fail(file, `title is ${title[1].length} characters (aim for <= 70)`);
    if (titles.has(title[1])) fail(file, `duplicate title, also used by ${titles.get(title[1])}`);
    else titles.set(title[1], file);
  }

  const desc = /<meta name="description" content="([^"]*)"/.exec(html);
  if (!desc) fail(file, 'missing meta description');
  else {
    const len = desc[1].length;
    if (len < 70 || len > 165) fail(file, `meta description is ${len} characters (aim for 70-165)`);
    if (descriptions.has(desc[1])) fail(file, `duplicate meta description, also used by ${descriptions.get(desc[1])}`);
    else descriptions.set(desc[1], file);
  }

  if (!/<link rel="canonical" href="https:\/\/[^"]+"/.test(html)) fail(file, 'missing canonical link');
  if (!/<meta property="og:image" content="https:\/\/[^"]+"/.test(html)) fail(file, 'missing og:image');
  if (!/<script type="application\/ld\+json">/.test(html)) fail(file, 'missing JSON-LD structured data');
  if (!/<html lang="en-IN">/.test(html)) fail(file, 'missing lang="en-IN" on <html>');

  // 3. Heading hierarchy — exactly one H1, and no skipped levels
  const h1s = [...html.matchAll(/<h1[\s>]/g)].length;
  if (h1s !== 1) fail(file, `expected exactly one <h1>, found ${h1s}`);
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  for (let i = 1; i < levels.length; i += 1) {
    if (levels[i] - levels[i - 1] > 1) {
      fail(file, `heading level jumps from h${levels[i - 1]} to h${levels[i]}`);
      break;
    }
  }

  // 4. Images need alt text
  for (const img of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt="/.test(img[0])) fail(file, `image without alt attribute: ${img[0].slice(0, 80)}`);
  }

  // 5. Links and assets resolve
  const refs = new Set();
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) refs.add(m[1]);

  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|data:|#)/.test(ref)) continue;
    if (/^https?:$/.test(ref)) continue;
    const [target, hash] = ref.split('#');
    if (!target) continue;
    if (!(await exists(target))) {
      fail(file, `broken reference -> ${ref}`);
      continue;
    }
    if (hash) {
      const linked = await readFile(path.join(ROOT, target), 'utf8');
      if (!new RegExp(`id="${hash}"`).test(linked)) fail(file, `anchor #${hash} not found in ${target}`);
    }
  }

  // 6. Internal links should be page-relative (works from file:// and any host)
  for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
    fail(file, `root-relative link "${m[1]}" will not resolve when the demo is opened from disk`);
  }

  // 7. Demo honesty rules
  const banned = [
    /\baward[- ]winning\b/i,
    /\bISO certified\b/i,
    /\b(?:1000|500|10,?000)\+ ?(?:projects|homes|clients|customers)\b/i,
    /\bbest interior designer?s? in chennai\b/i,
    /\bguaranteed (?:ranking|leads|traffic|first page)\b/i,
    /\b(?:we are|we're) the (?:best|leading|no\.? ?1)\b/i,
    /\b(?:5|4\.9|4\.8)\s*(?:\/5|stars?)\b/i,
    /\bsince 19\d\d\b/i,
    /08460229951/,
    /918460229951/,
    /3\.8\s*\/\s*5/,
    /17 ratings?/
  ];
  for (const pattern of banned) {
    const hit = pattern.exec(html);
    if (hit) fail(file, `claim that must not appear in this demo: "${hit[0]}"`);
  }
}

/* ------------------------------------------------------- sitemap / robots / cta */

const sitemap = await readFile(path.join(ROOT, 'sitemap.xml'), 'utf8').catch(() => null);
if (!sitemap) fail('sitemap.xml', 'missing');
else {
  for (const file of files) {
    const loc = file === 'index.html' ? `>${site.baseUrl.replace(/\/$/, '')}/<` : `>${site.baseUrl.replace(/\/$/, '')}/${file}<`;
    if (file === 'thank-you.html') {
      if (sitemap.includes(`/${file}<`)) fail('sitemap.xml', 'thank-you.html should not be indexed');
      continue;
    }
    if (!sitemap.includes(loc)) fail('sitemap.xml', `missing entry for ${file}`);
  }
}

const robots = await readFile(path.join(ROOT, 'robots.txt'), 'utf8').catch(() => null);
if (!robots) fail('robots.txt', 'missing');
else if (!robots.includes('Sitemap:')) fail('robots.txt', 'no Sitemap directive');

for (const file of files) {
  const html = await readFile(path.join(ROOT, file), 'utf8');
  if (!html.includes(`tel:${site.phoneDial}`)) fail(file, 'no click-to-call link');
  if (!html.includes(`https://wa.me/${site.whatsapp}`)) fail(file, 'no WhatsApp link');
}

/* -------------------------------------------------------------------- report */

const indexed = files.filter((f) => f !== 'thank-you.html');
notes.push(`${files.length} pages built (${indexed.length} indexable)`);
notes.push(`${titles.size} unique titles, ${descriptions.size} unique descriptions`);

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s):\n`);
  for (const p of problems) console.error('  • ' + p);
  process.exit(1);
}

console.log('✓ All checks passed');
for (const n of notes) console.log('  · ' + n);
