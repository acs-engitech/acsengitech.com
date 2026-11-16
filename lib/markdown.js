// Markdown versions of the public pages for agents that send `Accept: text/markdown`.
// The page HTML is the source of truth: its <main> content is converted, headed by the page's SEO title,
// description and canonical URL, so the Markdown never drifts from what people see.
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('parse5');
const { PAGE_DEFAULTS, SITE_URL, pageUrl } = require('./acs-defaults');
const { postUrl, mergeSeo, normalizePagePath } = require('./admin-core');

const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['script', 'style', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'nav', 'header', 'footer', 'form', 'button', 'select', 'dialog', 'video', 'audio', 'picture', 'img', 'input', 'textarea', 'label']);
const BLOCK = new Set(['p', 'div', 'section', 'article', 'aside', 'main', 'figure', 'figcaption', 'address', 'blockquote', 'dl', 'table', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'dt', 'dd', 'tr']);

// Interface chrome around the homepage 3D viewer, not page content.
const SKIP_CLASS = /\b(world-stage|world-bottom|world-tools|world-inspection|mobile-scope|acs-skip|skip-link)\b/;
const SPACED = new Set(['span', 'small', 'time', 'abbr', 'sup', 'sub', 'mark', 'cite', 'q', 'dfn']);

const attrs = (node) => Object.fromEntries((node.attrs || []).map((a) => [a.name, a.value]));

function find(node, test) {
  if (test(node)) return node;
  for (const child of node.childNodes || []) {
    const hit = find(child, test);
    if (hit) return hit;
  }
  return null;
}

function absolute(href) {
  if (!href || href.startsWith('#') || /^(javascript|data):/i.test(href)) return '';
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  const [file, hash = ''] = href.split('#');
  const clean = file.replace(/^\.?\//, '').replace(/\.html$/i, '').replace(/^index$/i, '');
  return `${SITE_URL}/${clean}${hash ? `#${hash}` : ''}`;
}

const squash = (text) => text.replace(/[ \t\r\n ]+/g, ' ');

function inline(node) {
  if (node.nodeName === '#text') return squash(node.value);
  if (node.nodeName === '#comment' || SKIP.has(node.nodeName)) return '';
  const a = attrs(node);
  if (a.hidden !== undefined || a['aria-hidden'] === 'true' || SKIP_CLASS.test(a.class || '')) return '';
  if (node.nodeName === 'br') return '\n';
  const inner = (node.childNodes || []).map(inline).join('');
  switch (node.nodeName) {
    case 'strong': case 'b': return inner.trim() ? `**${inner.trim()}**` : '';
    case 'em': case 'i': return inner.trim() ? `*${inner.trim()}*` : '';
    case 'code': return inner.trim() ? `\`${inner.trim()}\`` : '';
    case 'a': {
      const href = absolute(a.href);
      const label = inner.trim();
      return href && label ? `[${label}](${href})` : label;
    }
    default: return BLOCK.has(node.nodeName) || SPACED.has(node.nodeName) ? ` ${inner} ` : inner;
  }
}

function blocks(node, out, depth = 0) {
  if (node.nodeName === '#text') {
    const text = squash(node.value).trim();
    if (text) out.push(text);
    return;
  }
  if (node.nodeName === '#comment' || SKIP.has(node.nodeName)) return;
  const a = attrs(node);
  if (a.hidden !== undefined || a['aria-hidden'] === 'true' || SKIP_CLASS.test(a.class || '')) return;
  const name = node.nodeName;
  const line = () => inline(node).replace(/ *\n */g, '\n').replace(/ {2,}/g, ' ').trim();
  if (/^h[1-6]$/.test(name)) {
    const text = line().replace(/\n+/g, ' ');
    if (text) out.push(`${'#'.repeat(Number(name[1]))} ${text}`);
    return;
  }
  if (name === 'p' || name === 'figcaption' || name === 'address' || name === 'blockquote') {
    const text = line();
    if (text) out.push(name === 'blockquote' ? `> ${text}` : text);
    return;
  }
  if (name === 'ul' || name === 'ol') {
    let n = 0;
    const items = [];
    for (const li of node.childNodes || []) {
      if (li.nodeName !== 'li') continue;
      const text = inline(li).replace(/\s+/g, ' ').trim();
      if (text) items.push(`${'  '.repeat(depth)}${name === 'ol' ? `${++n}.` : '-'} ${text}`);
    }
    if (items.length) out.push(items.join('\n'));
    return;
  }
  if (name === 'dl') {
    const items = [];
    let term = '';
    for (const child of node.childNodes || []) {
      const text = inline(child).replace(/\s+/g, ' ').trim();
      if (child.nodeName === 'dt') term = text;
      else if (child.nodeName === 'dd' && text) items.push(term ? `- **${term}:** ${text}` : `- ${text}`);
      else if (child.nodeName === 'div') {
        const dt = find(child, (x) => x.nodeName === 'dt');
        const dd = find(child, (x) => x.nodeName === 'dd');
        if (dt && dd) items.push(`- **${inline(dt).trim()}:** ${inline(dd).replace(/\s+/g, ' ').trim()}`);
      }
    }
    if (items.length) out.push(items.join('\n'));
    return;
  }
  if (name === 'table') {
    const rows = [];
    (function collect(n) { for (const c of n.childNodes || []) { if (c.nodeName === 'tr') rows.push(c); else collect(c); } }(node));
    const cells = rows.map((tr) => (tr.childNodes || []).filter((c) => c.nodeName === 'td' || c.nodeName === 'th').map((c) => inline(c).replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim()));
    const width = Math.max(0, ...cells.map((r) => r.length));
    if (width) {
      const pad = (r) => `| ${[...r, ...Array(width - r.length).fill('')].join(' | ')} |`;
      out.push([pad(cells[0]), `|${' --- |'.repeat(width)}`, ...cells.slice(1).map(pad)].join('\n'));
    }
    return;
  }
  // Containers: inline-only content becomes one paragraph; otherwise recurse.
  const children = node.childNodes || [];
  const hasBlock = children.some((c) => c.nodeName !== '#text' && (BLOCK.has(c.nodeName) || SKIP.has(c.nodeName)));
  if (!hasBlock && name !== 'body' && name !== 'main') {
    const text = line();
    if (text) out.push(text);
    return;
  }
  for (const child of children) blocks(child, out, depth);
}

function htmlToMarkdown(html) {
  const doc = parse(html);
  const root = find(doc, (n) => n.nodeName === 'main') || find(doc, (n) => n.nodeName === 'body') || doc;
  const out = [];
  blocks(root, out);
  const deduped = out.filter((block, i) => block !== out[i - 1]);
  return deduped.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

const pageByPath = new Map(PAGE_DEFAULTS.map((page) => [page.path, page]));
const cache = new Map();

function pageForPath(rawPath) {
  const pathname = normalizePagePath(decodeURIComponent(String(rawPath || '/').split('?')[0]));
  return pageByPath.get(pathname) || null;
}

function pageMarkdown(page, overrides = {}) {
  const seo = mergeSeo(page.defaults, overrides);
  let body = cache.get(page.file);
  if (body === undefined) {
    body = htmlToMarkdown(fs.readFileSync(path.join(ROOT, page.file), 'utf8'));
    cache.set(page.file, body);
  }
  // The page's own H1 repeats the title, so the document leads with the SEO title instead.
  body = body.replace(/^# .*\n+/, '');
  return [
    `# ${seo.title}`,
    `> ${seo.description}`,
    `Canonical URL: ${seo.canonical || pageUrl(page.path)}`,
    body,
    '---',
    `ACS Engitech Private Limited · sales@acsengitech.com · +91 70485 20058 · ${SITE_URL}/contact`,
    `Site guide for agents: ${SITE_URL}/llms.txt · Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n\n').replace(/\n{3,}/g, '\n\n');
}

function notFoundMarkdown(rawPath) {
  const shown = String(rawPath || '/').slice(0, 200).replace(/[`\n\r]/g, '');
  return [
    '# Page not found (404)',
    `There is no page at \`${shown}\` on ${SITE_URL.replace('https://', '')}. It may have moved or never existed.`,
    'Where to go next:',
    [
      `- Site guide for agents: ${SITE_URL}/llms.txt`,
      `- Sitemap of every page: ${SITE_URL}/sitemap.xml`,
      `- Home: ${SITE_URL}/`,
      `- Contact ACS Engitech: ${SITE_URL}/contact (sales@acsengitech.com, +91 70485 20058)`,
    ].join('\n'),
    '',
  ].join('\n\n');
}

function postMarkdown(post) {
  return [
    `# ${post.title}`,
    post.excerpt ? `> ${post.excerpt}` : '',
    `Canonical URL: ${postUrl(post.slug)}`,
    `Published: ${new Date(post.publishedAt).toISOString().slice(0, 10)} · ${post.author || 'ACS Engitech'}`,
    htmlToMarkdown(`<main>${post.content || ''}</main>`),
    '---',
    `More articles: ${SITE_URL}/blog · Site guide for agents: ${SITE_URL}/llms.txt`,
    '',
  ].filter((part) => part !== '').join('\n\n');
}

module.exports = { htmlToMarkdown, pageForPath, pageMarkdown, notFoundMarkdown, postMarkdown };
