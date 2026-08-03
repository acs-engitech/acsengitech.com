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
};

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

function isPostVisible(post, now = new Date()) {
  return post?.status === 'published' && (!post.publishedAt || new Date(post.publishedAt) <= now);
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
  };
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
  normalizePagePath,
  normalizePost,
  isPostVisible,
  mergeSeo,
  summarizeAnalytics,
  slugify,
  stripHtml,
  uniqueTags,
};
