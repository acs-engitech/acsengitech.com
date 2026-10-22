#!/usr/bin/env node
// Writes copy-ready SEO deliverables to docs/seo/: robots.txt, the llms.txt body for the admin, a preview
// of the full llms.txt, and the JSON-LD for every page. Source of truth: lib/acs-defaults.js.
const fs = require('node:fs');
const path = require('node:path');
const { PAGE_DEFAULTS, DEFAULT_SETTINGS } = require('../lib/acs-defaults');
const { buildLlmsTxt, buildSitemap } = require('../lib/admin-core');

const OUT = path.resolve(__dirname, '..', 'docs', 'seo');
fs.mkdirSync(path.join(OUT, 'schema'), { recursive: true });
const pages = PAGE_DEFAULTS.map((page) => ({ ...page, seo: {} }));
const write = (file, body) => fs.writeFileSync(path.join(OUT, file), body.endsWith('\n') ? body : `${body}\n`);

write('robots.txt', DEFAULT_SETTINGS.robotsTxt);
write('llms-admin-body.md', DEFAULT_SETTINGS.llmsIntro);
write('llms.txt', buildLlmsTxt({ settings: DEFAULT_SETTINGS, pages, posts: [], positions: [] }));
write('sitemap-preview.xml', buildSitemap({ pages, posts: [] }));

const index = [];
for (const page of PAGE_DEFAULTS) {
  const slug = page.path === '/' ? 'home' : page.path.slice(1);
  write(`schema/${slug}.json`, JSON.stringify(JSON.parse(page.defaults.jsonLd), null, 2));
  index.push({ path: page.path, file: page.file, title: page.defaults.title, description: page.defaults.description, keywords: page.defaults.keywords, schema: `schema/${slug}.json` });
}
write('pages.json', JSON.stringify(index, null, 2));
console.log(`Wrote ${index.length} page schemas and crawler files to ${path.relative(process.cwd(), OUT)}/`);
