const DEFAULT_SEO = {
  title: '',
  description: '',
  canonical: '',
  robots: '',
  keywords: '',
  ogTitle: '',
  ogDescription: '',
  ogImage: '',
  twitterTitle: '',
  twitterDescription: '',
  twitterImage: '',
  jsonLd: '',
  focusKeyword: '',
  ogType: '',
  twitterCard: '',
  sitemapExclude: '',
  sitemapPriority: '',
  sitemapChangefreq: '',
};

const SITE_URL = 'https://acsengitech.com';

function normalizePagePath(input) {
  const value = String(input || '').trim();
  if (!value || value === '/' || value === 'index.html' || value === '/index.html') {
    return '/';
  }

  return `/${value}`
    .replace(/\/+/g, '/')
    .replace(/\.html$/i, '')
    .replace(/\/index$/i, '')
    .replace(/\/$/, '');
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function stripHtml(input) {
  return String(input || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function uniqueTags(tags) {
  const values = Array.isArray(tags) ? tags : String(tags || '').split(',');
  const seen = new Set();
  return values
    .map((tag) => String(tag).trim())
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizePost(input, now = new Date()) {
  const title = String(input.title || 'Untitled post').trim();
  const content = String(input.content || '').trim();
  const plainText = stripHtml(content || input.excerpt || '');
  const words = plainText ? plainText.split(/\s+/).length : 0;
  const publishedAt = input.publishedAt || new Date().toISOString();
  const desiredStatus = String(input.status || '').toLowerCase();
  const publishDate = new Date(publishedAt);
  const status = desiredStatus === 'draft'
    ? 'draft'
    : publishDate > now
      ? 'scheduled'
      : desiredStatus === 'scheduled'
        ? 'scheduled'
        : 'published';

  return {
    id: input.id || null,
    title,
    slug: slugify(input.slug || title),
    excerpt: String(input.excerpt || plainText.slice(0, 180)).trim(),
    author: String(input.author || 'ACS Engitech').trim(),
    coverImage: String(input.coverImage || '').trim(),
    coverAlt: String(input.coverAlt || title).trim(),
    tags: uniqueTags(input.tags),
    content,
    status,
    publishedAt,
    readingMinutes: Math.max(1, Math.ceil(words / 220)),
    seo: mergeSeo({ title, description: String(input.excerpt || plainText.slice(0, 155)).trim() }, input.seo || {}),
  };
}

// Scheduled posts go live on their own once their publish time has passed; drafts never do.
function isPostVisible(post, now = new Date()) {
  return ['published', 'scheduled'].includes(post?.status) && (!post.publishedAt || new Date(post.publishedAt) <= now);
}

function firstFilled(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
}

function mergeSeo(defaults = {}, overrides = {}) {
  const base = { ...DEFAULT_SEO, ...defaults };
  const title = firstFilled(overrides.title, base.title);
  const description = firstFilled(overrides.description, base.description);
  const canonical = firstFilled(overrides.canonical, base.canonical);

  return {
    title,
    description,
    canonical,
    robots: firstFilled(overrides.robots, base.robots),
    keywords: firstFilled(overrides.keywords, base.keywords),
    ogTitle: firstFilled(overrides.ogTitle, base.ogTitle, title),
    ogDescription: firstFilled(overrides.ogDescription, base.ogDescription, description),
    ogImage: firstFilled(overrides.ogImage, base.ogImage),
    twitterTitle: firstFilled(overrides.twitterTitle, base.twitterTitle, title),
    twitterDescription: firstFilled(overrides.twitterDescription, base.twitterDescription, description),
    twitterImage: firstFilled(overrides.twitterImage, base.twitterImage),
    jsonLd: firstFilled(overrides.jsonLd, base.jsonLd),
    focusKeyword: firstFilled(overrides.focusKeyword, base.focusKeyword),
    ogType: firstFilled(overrides.ogType, base.ogType, 'website'),
    twitterCard: firstFilled(overrides.twitterCard, base.twitterCard, 'summary_large_image'),
    sitemapExclude: firstFilled(overrides.sitemapExclude, base.sitemapExclude),
    sitemapPriority: firstFilled(overrides.sitemapPriority, base.sitemapPriority),
    sitemapChangefreq: firstFilled(overrides.sitemapChangefreq, base.sitemapChangefreq),
  };
}

function xmlEscape(value) {
  return String(value).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function pageUrl(path) {
  return `${SITE_URL}${path === '/' ? '/' : path}`;
}

// sitemap.xml: every page not excluded or set to noindex, plus live blog posts.
function buildSitemap(data, now = new Date()) {
  const urls = [];
  for (const page of data.pages || []) {
    const seo = mergeSeo(page.defaults, page.seo);
    if (seo.sitemapExclude === 'yes' || /noindex/i.test(seo.robots)) continue;
    urls.push({ loc: seo.canonical || pageUrl(page.path), priority: seo.sitemapPriority || (page.path === '/' ? '1.0' : '0.7'), changefreq: seo.sitemapChangefreq || (page.path === '/' ? 'weekly' : 'monthly') });
  }
  for (const post of data.posts || []) {
    if (!isPostVisible(post, now)) continue;
    urls.push({ loc: `${SITE_URL}/blog.html?post=${encodeURIComponent(post.slug)}`, lastmod: post.updatedAt || post.publishedAt, priority: '0.6', changefreq: 'monthly' });
  }
  const body = urls.map((url) => `  <url>\n    <loc>${xmlEscape(url.loc)}</loc>${url.lastmod ? `\n    <lastmod>${new Date(url.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}\n    <changefreq>${xmlEscape(url.changefreq)}</changefreq>\n    <priority>${xmlEscape(url.priority)}</priority>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

// llms.txt: the editable body from the admin, then (optionally) generated lists of pages, posts and open roles.
function buildLlmsTxt(data, now = new Date()) {
  const settings = data.settings || {};
  const on = (value) => value !== false && value !== 'no';
  const sections = [String(settings.llmsIntro || '# ACS Engitech').trim()];
  if (on(settings.llmsIncludePages)) {
    const pages = (data.pages || []).filter((page) => {
      const seo = mergeSeo(page.defaults, page.seo);
      return seo.sitemapExclude !== 'yes' && !/noindex/i.test(seo.robots);
    }).map((page) => {
      const seo = mergeSeo(page.defaults, page.seo);
      return `- [${page.label}](${pageUrl(page.path)})${seo.description ? `: ${seo.description}` : ''}`;
    });
    if (pages.length) sections.push(`## Pages\n${pages.join('\n')}`);
  }
  if (on(settings.llmsIncludePosts)) {
    const posts = (data.posts || []).filter((post) => isPostVisible(post, now))
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .map((post) => `- [${post.title}](${SITE_URL}/blog.html?post=${post.slug})${post.excerpt ? `: ${post.excerpt}` : ''}`);
    sections.push(`## Published blog posts\n${posts.join('\n') || '- No published posts yet.'}`);
  }
  if (on(settings.llmsIncludePositions)) {
    const roles = (data.positions || []).filter((position) => position.status !== 'closed')
      .map((position) => `- ${position.title}${position.location ? ` (${position.location})` : ''}: ${SITE_URL}/career.html`);
    if (roles.length) sections.push(`## Open positions\n${roles.join('\n')}`);
  }
  if (String(settings.llmsFooter || '').trim()) sections.push(String(settings.llmsFooter).trim());
  return `${sections.join('\n\n')}\n`;
}

function hostFromReferrer(referrer) {
  try {
    return new URL(referrer).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts, ([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function summarizeAnalytics(events, now = new Date(), days = 30) {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - days);
  const windowed = events.filter((event) => new Date(event.createdAt) >= start);
  const visitors = new Set(windowed.map((event) => event.visitorId).filter(Boolean));
  const deviceRows = countBy(windowed, (event) => event.device || 'desktop');

  return {
    pageViews: windowed.length,
    uniqueVisitors: visitors.size,
    avgViewsPerDay: Math.round((windowed.length / Math.max(1, days)) * 10) / 10,
    devices: deviceRows.reduce((acc, row) => ({ ...acc, [row.key]: row.count }), {}),
    topPages: countBy(windowed, (event) => normalizePagePath(event.path || '/'))
      .map((row) => ({ path: row.key, views: row.count }))
      .slice(0, 10),
    topReferrers: countBy(windowed, (event) => hostFromReferrer(event.referrer))
      .map((row) => ({ source: row.key, views: row.count }))
      .slice(0, 10),
    daily: countBy(windowed, (event) => new Date(event.createdAt).toISOString().slice(0, 10))
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((row) => ({ date: row.key, views: row.count })),
  };
}

module.exports = {
  SITE_URL,
  DEFAULT_SEO,
  buildSitemap,
  buildLlmsTxt,
  normalizePagePath,
  normalizePost,
  isPostVisible,
  mergeSeo,
  summarizeAnalytics,
  slugify,
  stripHtml,
  uniqueTags,
};
