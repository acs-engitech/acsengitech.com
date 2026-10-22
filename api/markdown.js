// Serves Markdown for agents. middleware.js rewrites page requests that prefer `Accept: text/markdown` here,
// keeping the original path in ?path=. Unknown paths get a Markdown 404 that points to llms.txt and the sitemap.
const { pageForPath, pageMarkdown, notFoundMarkdown, postMarkdown } = require('../lib/markdown');
const { isPostVisible } = require('../lib/admin-core');

function send(req, res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Vary', 'Accept');
  res.setHeader('Cache-Control', status === 200 ? 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' : 'public, max-age=0, s-maxage=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value);
  res.end(req.method === 'HEAD' ? undefined : body);
}

async function findPost(slug) {
  try {
    const store = require('./_store');
    const data = await store.getPublicData();
    return (data.posts || []).find((post) => post.slug === slug && isPostVisible(post)) || null;
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    return res.end();
  }
  const requested = String(req.query?.path || '/');
  const page = pageForPath(requested);
  if (!page) return send(req, res, 404, notFoundMarkdown(requested));
  if (page.path === '/blog' && req.query?.post) {
    const post = await findPost(String(req.query.post));
    if (!post) return send(req, res, 404, notFoundMarkdown(`${requested}?post=${req.query.post}`));
    return send(req, res, 200, postMarkdown(post));
  }
  return send(req, res, 200, pageMarkdown(page), { Link: `<${page.defaults.canonical}>; rel="canonical"` });
};
