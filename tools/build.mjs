/**
 * Hometech Interiors — static site builder.
 *
 * Zero dependencies. Assembles src/pages/*.html (with front matter) and
 * src/partials/*.html into flat, host-anywhere HTML files at the project root,
 * and generates sitemap.xml + robots.txt from site.config.json.
 *
 *   npm run build
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PAGES_DIR = path.join(ROOT, 'src', 'pages');
const PARTIALS_DIR = path.join(ROOT, 'src', 'partials');

const errors = [];
const written = [];

/* ------------------------------------------------------------------ config */

const site = JSON.parse(await readFile(path.join(ROOT, 'site.config.json'), 'utf8'));

const abs = (p) => site.baseUrl.replace(/\/$/, '') + '/' + String(p).replace(/^\//, '');
const phoneDial = site.phoneDial;
const waNumber = site.whatsapp;
const waMessage = `Hello ${site.legalName}, I would like to enquire about interior works.`;
const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;
const mapQuery = encodeURIComponent(
  `${site.legalName}, ${site.address.street}, ${site.address.locality}, ${site.address.region}`
);

/* ---------------------------------------------------------------- partials */

const partials = new Map();
for (const file of await readdir(PARTIALS_DIR)) {
  if (!file.endsWith('.html')) continue;
  partials.set(file.replace(/\.html$/, ''), await readFile(path.join(PARTIALS_DIR, file), 'utf8'));
}

/* -------------------------------------------------------------- rendering */

function resolve(key, ctx) {
  let cur = ctx;
  for (const part of key.split('.')) {
    if (cur === null || typeof cur !== 'object' || !(part in cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

function render(template, ctx, label) {
  let out = template;
  for (let pass = 0; pass < 6 && /\{\{>\s*[\w-]+\s*\}\}/.test(out); pass += 1) {
    out = out.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (match, name) => {
      const partial = partials.get(name);
      if (partial === undefined) {
        errors.push(`${label}: unknown partial "{{> ${name}}}"`);
        return match;
      }
      return partial;
    });
  }
  out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    const value = resolve(key, ctx);
    if (value === undefined) {
      errors.push(`${label}: unresolved placeholder {{${key}}}`);
      return match;
    }
    return String(value);
  });
  return out;
}

function frontMatter(raw, label) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) {
    errors.push(`${label}: missing front matter block`);
    return { data: {}, body: raw };
  }
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) {
      errors.push(`${label}: malformed front matter line "${line.trim()}"`);
      continue;
    }
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (/^\[.*\]$/.test(value)) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((v) => v.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else if (value === 'true' || value === 'false') {
      value = value === 'true';
    } else {
      value = value.replace(/^["']|["']$/g, '');
    }
    data[key] = value;
  }
  return { data, body: raw.slice(match[0].length) };
}

/* ---------------------------------------------------------- structured data */

const services = [
  { name: 'Modular Kitchen', url: 'modular-kitchen-chennai.html' },
  { name: 'Wardrobe Interiors', url: 'wardrobe-design-chennai.html' },
  { name: 'False Ceiling', url: 'false-ceiling-chennai.html' },
  { name: 'Interior Works', url: 'interior-works-chennai.html' }
];

function localBusiness() {
  return {
    '@type': ['LocalBusiness', 'HomeAndConstructionBusiness'],
    '@id': abs('#business'),
    name: site.name,
    alternateName: site.legalName,
    slogan: site.tagline,
    description:
      'Interior decorators and false ceiling contractors in Saidapet, Chennai. Modular kitchens, wardrobes, false ceilings and interior works — 22 years in business.',
    url: abs('/'),
    telephone: phoneDial,
    image: abs(site.ogImage),
    address: {
      '@type': 'PostalAddress',
      streetAddress: `${site.address.street}, ${site.address.locality}`,
      addressLocality: 'Chennai',
      addressRegion: 'Tamil Nadu',
      addressCountry: 'IN'
    },
    areaServed: site.address.areaServed.map((name) => ({ '@type': 'Place', name })),
    knowsAbout: ['Modular kitchen interiors', 'Wardrobe design', 'False ceiling installation', 'Interior works'],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: phoneDial,
        contactType: 'customer enquiries',
        areaServed: 'IN',
        availableLanguage: ['en', 'ta']
      }
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Interior services',
      itemListElement: services.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s.name, url: abs(s.url) }
      }))
    },
    sameAs: [site.instagram.url, site.justdial.url]
  };
}

function website() {
  return {
    '@type': 'WebSite',
    '@id': abs('#website'),
    url: abs('/'),
    name: site.name,
    inLanguage: 'en-IN',
    publisher: { '@id': abs('#business') }
  };
}

const NAV_CRUMB = {
  about: ['About', 'about.html'],
  services: ['Services', 'services.html'],
  projects: ['Projects', 'projects.html'],
  contact: ['Contact', 'contact.html']
};

function breadcrumbs(page) {
  // Explicit `crumbs` win; otherwise derive a short trail from navKey + crumb.
  const crumbs = page.crumbs || [
    ...(NAV_CRUMB[page.navKey] ? [{ name: NAV_CRUMB[page.navKey][0], url: NAV_CRUMB[page.navKey][1] }] : []),
    ...(page.crumb ? [{ name: page.crumb, url: page.file }] : [])
  ];
  return {
    '@type': 'BreadcrumbList',
    '@id': abs(page.file) + '#breadcrumb',
    itemListElement: [{ name: 'Home', url: 'index.html' }, ...crumbs].map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: abs(c.url)
    }))
  };
}

function graphFor(page) {
  const graph = [localBusiness(), website()];
  if (Array.isArray(page.schema)) {
    if (page.schema.includes('breadcrumb')) graph.push(breadcrumbs(page));
    if (page.schema.includes('service')) {
      graph.push({
        '@type': 'Service',
        '@id': abs(page.file) + '#service',
        name: page.serviceName,
        serviceType: page.serviceType || page.serviceName,
        description: page.description,
        url: abs(page.file),
        provider: { '@id': abs('#business') },
        areaServed: { '@type': 'City', name: 'Chennai' },
        availableChannel: {
          '@type': 'ServiceChannel',
          serviceUrl: abs('contact.html'),
          servicePhone: { '@type': 'ContactPoint', telephone: phoneDial }
        }
      });
    }
    if (page.schema.includes('contact')) {
      graph.push({
        '@type': 'ContactPage',
        '@id': abs(page.file) + '#contactpage',
        url: abs(page.file),
        name: page.title,
        description: page.description,
        about: { '@id': abs('#business') }
      });
    }
    if (page.schema.includes('about')) {
      graph.push({
        '@type': 'AboutPage',
        '@id': abs(page.file) + '#aboutpage',
        url: abs(page.file),
        name: page.title,
        description: page.description,
        about: { '@id': abs('#business') }
      });
    }
    if (page.schema.includes('collection')) {
      graph.push({
        '@type': 'CollectionPage',
        '@id': abs(page.file) + '#collectionpage',
        url: abs(page.file),
        name: page.title,
        description: page.description,
        isPartOf: { '@id': abs('#website') }
      });
    }
    if (page.schema.includes('faq') && Array.isArray(page.faqs)) {
      graph.push({
        '@type': 'FAQPage',
        '@id': abs(page.file) + '#faq',
        mainEntity: page.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a }
        }))
      });
    }
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
}

/* ------------------------------------------------------------------- pages */

const PAGE_ORDER = [
  'index.html',
  'about.html',
  'services.html',
  'projects.html',
  'contact.html',
  'modular-kitchen-chennai.html',
  'wardrobe-design-chennai.html',
  'false-ceiling-chennai.html',
  'interior-works-chennai.html',
  'thank-you.html'
];

const pageFiles = (await readdir(PAGES_DIR)).filter((f) => f.endsWith('.html'));
pageFiles.sort((a, b) => {
  const ai = PAGE_ORDER.indexOf(a);
  const bi = PAGE_ORDER.indexOf(b);
  return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.localeCompare(b);
});

const built = [];

for (const file of pageFiles) {
  const raw = await readFile(path.join(PAGES_DIR, file), 'utf8');
  const { data: page, body } = frontMatter(raw, file);
  page.file = file;

  const navKeys = ['home', 'about', 'services', 'projects', 'contact'];
  const navActive = {};
  const navClass = {};
  for (const key of navKeys) {
    const isActive = page.navKey === key;
    navActive[key] = isActive ? ' aria-current="page"' : '';
    navClass[key] = isActive ? ' is-active' : '';
  }

  const ctx = {
    site: {
      ...site,
      url: abs('/'),
      phoneHref: `tel:${phoneDial}`,
      waHref: waLink,
      mapHref: `https://www.google.com/maps/search/?api=1&query=${mapQuery}`,
      mapEmbed: `https://www.google.com/maps?q=${mapQuery}&output=embed`,
      addressFull: `${site.address.locality}, ${site.address.region}, ${site.address.country}`
    },
    page: {
      title: '',
      description: '',
      canonical: abs(file),
      ogImage: abs(site.ogImage),
      robots: 'index, follow',
      ...page
    },
    navActive,
    navClass,
    year: new Date().getFullYear(),
    jsonld: `<script type="application/ld+json">\n${graphFor(page)}\n</script>`
  };

  // page.url / page.ogImage defaults that depend on the merged object
  ctx.page.canonical = page.canonical ? abs(page.canonical) : abs(file);
  ctx.page.ogImage = page.ogImage ? abs(page.ogImage) : abs(site.ogImage);

  const html = render(body, ctx, file);
  await writeFile(path.join(ROOT, file), html, 'utf8');
  written.push(file);
  built.push({ ...page, file, html });
}

/* ------------------------------------------------------------- sitemap/robots */

const TODAY = site.contentDate;
const sitemapEntries = built
  .filter((p) => p.sitemap !== false)
  .map((p) => {
    const loc = abs(p.file === 'index.html' ? '/' : p.file);
    const priority = p.priority || (p.file === 'index.html' ? '1.0' : '0.8');
    const changefreq = p.changefreq || 'monthly';
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  })
  .join('\n');

await writeFile(
  path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>\n`,
  'utf8'
);
written.push('sitemap.xml');

await writeFile(
  path.join(ROOT, 'robots.txt'),
  `# Hometech Interiors — ${site.baseUrl}\nUser-agent: *\nAllow: /\n\nSitemap: ${abs('sitemap.xml')}\n`,
  'utf8'
);
written.push('robots.txt');

/* ------------------------------------------------------------------ report */

if (errors.length) {
  console.error(`\n✗ Build failed with ${errors.length} problem(s):\n`);
  for (const e of errors) console.error('  • ' + e);
  process.exit(1);
}

console.log(`✓ Built ${written.length} files from ${pageFiles.length} page(s)`);
console.log('  ' + written.join('\n  '));
