// Server-rendered blog posts at /blog/<slug> (vercel.json rewrites to /api/blog-post?slug=<slug>).
// Each post gets its own title, description, canonical, Open Graph and BlogPosting JSON-LD, with the article
// in the HTML, so search engines index posts as pages instead of folding them into /blog. The page is
// blog.html with its SEO block and board replaced; acs-runtime.js leaves server-rendered content in place.
const fs = require('node:fs');
const path = require('node:path');
const store = require('../lib/store');
const { SITE_URL, isPostVisible, postUrl } = require('../lib/admin-core');

const ROOT = path.join(__dirname, '..');
let template;
let notFound;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

// Same rules as sanitizeBlogHtml in acs-runtime.js.
const sanitize = (html) => String(html || '')
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
  .replace(/(href|src)\s*=\s*(["'])\s*(javascript:|data:)/gi, '$1=$2#blocked:');

// The template uses relative asset paths; at /blog/<slug> they must be root-relative.
const rootRelative = (html) => html.replace(/\s(src|href)="(?!https?:|\/|#|mailto:|tel:|data:)([^"]+)"/g, ' $1="/$2"');

const absolute = (url) => (/^https?:/i.test(url) ? url : `${SITE_URL}/${String(url || '').replace(/^\/+/, '')}`);

function blogDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function meta(post) {
  const tag = (post.tags || [])[0];
  return `<div class="co-blog-meta">${tag ? `<b>${escapeHtml(tag)}</b>` : ''}<span>${blogDate(post.publishedAt)}</span><span>${post.readingMinutes || 1} min read</span></div>`;
}

function card(post) {
  return `<a class="co-blog-card" href="/blog/${encodeURIComponent(post.slug)}"><div class="co-frame"><img src="${escapeHtml(post.coverImage || '/assets/acs/control-panels.webp')}" alt="${escapeHtml(post.coverAlt || post.title)}" loading="lazy" width="640" height="400"></div>${meta(post)}<h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.excerpt || '')}</p></a>`;
}

function seoBlock(post) {
  const url = postUrl(post.slug);
  const title = post.seo?.title || post.title;
  const description = post.seo?.description || post.excerpt || '';
  const image = absolute(post.seo?.ogImage || post.coverImage || '/assets/acs/og-image.jpg');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${url}#article`,
        mainEntityOfPage: url,
        headline: post.title,
        description,
        image: [image],
        datePublished: post.publishedAt,
        dateModified: post.updatedAt || post.publishedAt,
        author: { '@type': 'Organization', name: post.author || 'ACS Engitech', url: SITE_URL },
        publisher: { '@id': `${SITE_URL}/#organization` },
        keywords: (post.tags || []).join(', ') || undefined,
        inLanguage: 'en-IN',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
          { '@type': 'ListItem', position: 3, name: post.title, item: url },
        ],
      },
    ],
  };
  return [
    `<link rel="canonical" href="${url}">`,
    '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">',
    '<meta property="og:type" content="article">',
    '<meta property="og:site_name" content="ACS Engitech">',
    '<meta property="og:locale" content="en_IN">',
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    `<meta property="og:image:alt" content="${escapeHtml(post.coverAlt || post.title)}">`,
    `<meta property="article:published_time" content="${escapeHtml(post.publishedAt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
    `<script type="application/ld+json" data-acs-jsonld="true">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  ].join('\n');
}

function articleHtml(post, more) {
  return `<article class="co-article">
  <a class="co-article-back" href="/blog">&larr; All articles</a>
  <header>${meta(post)}<h1>${escapeHtml(post.title)}</h1></header>
  <div class="co-frame co-article-wide"><img src="${escapeHtml(post.coverImage || '/assets/acs/control-panels.webp')}" alt="${escapeHtml(post.coverAlt || post.title)}" width="1280" height="720" fetchpriority="high"></div>
  <div class="co-prose">${sanitize(post.content) || `<p>${escapeHtml(post.excerpt || '')}</p>`}</div>
  ${more.length ? `<aside class="co-article-more co-article-wide"><p class="co-label">More articles</p><div class="co-blog-grid co-blog-grid--more">${more.map(card).join('')}</div></aside>` : ''}
</article>`;
}

function send(res, status, html, cache) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cache);
  res.end(html);
}

module.exports = async function handler(req, res) {
  const slug = String(req.query?.slug || '').trim();
  let posts = [];
  try {
    posts = (await store.getPublicData()).posts
      .filter((post) => isPostVisible(post))
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  } catch {
    posts = [];
  }
  const post = posts.find((item) => item.slug === slug);
  if (!post) {
    notFound ||= rootRelative(fs.readFileSync(path.join(ROOT, '404.html'), 'utf8'));
    return send(res, 404, notFound, 'public, s-maxage=60');
  }

  template ||= rootRelative(fs.readFileSync(path.join(ROOT, 'blog.html'), 'utf8'));
  const title = escapeHtml(post.seo?.title || post.title);
  const description = escapeHtml(post.seo?.description || post.excerpt || '');
  const start = template.indexOf('-->', template.indexOf('<!-- acs:seo:start')) + 3;
  const end = template.indexOf('<!-- acs:seo:end -->');
  let html = template.slice(0, start) + '\n' + seoBlock(post) + '\n' + template.slice(end);
  html = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${description}">`)
    // The index hero carries the blog's own h1; a post page has the post title as its only h1.
    .replace(/<header class="co-hero" data-blog-hero>[\s\S]*?<\/header>\s*/, '')
    .replace('<body class="', '<body data-acs-ssr-seo class="')
    .replace(/<div id="acs-blog-board"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/section>/, () => `<div id="acs-blog-board" data-ssr="post">${articleHtml(post, posts.filter((item) => item !== post).slice(0, 3))}</div>\n    </div>\n  </section>`);
  return send(res, 200, html, 'public, s-maxage=300, stale-while-revalidate=86400');
};
