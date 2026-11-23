const store = require('../lib/store');
const { isPostVisible, mergeSeo, normalizePagePath } = require('../lib/admin-core');
const { PAGE_DEFAULTS, DEFAULT_SETTINGS, DEFAULT_JOBS, DEFAULT_POSITION_TYPES, DEFAULT_PARTNER_CATEGORIES } = require('../lib/acs-defaults');

function send(res, status, payload, cache) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Default is a short cache; the successful GET overrides it with a long
  // stale-while-revalidate window so public pages load instantly from the edge
  // instead of hitting a cold serverless/Neon start on nearly every visit.
  res.setHeader('Cache-Control', cache || 'public, s-maxage=5, stale-while-revalidate=30');
  res.end(JSON.stringify(payload));
}

// Every page fetches this endpoint, so the payload is kept to what that page uses: its own SEO entry (plus the
// home entry the runtime falls back to), and blog posts only on /blog. Full article HTML is sent only for the
// post being read (?post=slug); the index needs the summary fields alone.
function pageSeoFor(path, entries) {
  const all = Object.fromEntries(entries);
  const out = {};
  for (const key of [path, path.replace(/\/$/, ''), '/']) if (all[key]) out[key] = all[key];
  return out;
}

function blogPosts(posts, slug) {
  return posts
    .filter((post) => isPostVisible(post))
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .map((post) => (post.slug === slug ? post : { ...post, content: undefined }));
}

// The About page's team section: members marked live, in the order set in the admin. Hidden members never leave the server.
function publicTeam(team) {
  return (team || []).filter((member) => member.status !== 'hidden').map(({ status, ...member }) => member);
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const event = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      await store.recordAnalytics({
        ...event,
        userAgent: req.headers['user-agent'] || '',
      });
      return send(res, 200, { ok: true }, 'no-store');
    }

    const data = await store.getPublicData();
    const currentPath = normalizePagePath(req.query?.path || '/');
    const pageSeo = pageSeoFor(currentPath, data.pages.map((page) => [page.path, mergeSeo(page.defaults, page.seo)]));

    const livePositions = (data.positions || []).filter((position) => position.status !== 'closed');
    // Legacy consumers read `jobs` with open|paused|closed statuses — map positions back to that shape.
    const jobsFromPositions = livePositions.map((position) => ({ ...position, status: 'open' }));

    return send(res, 200, {
      settings: data.settings,
      positions: livePositions,
      positionTypes: data.positionTypes || [],
      partnerCategories: data.partnerCategories || [],
      jobs: jobsFromPositions.length ? jobsFromPositions : data.jobs.filter((job) => job.status !== 'closed'),
      posts: currentPath === '/blog' ? blogPosts(data.posts, req.query?.post) : [],
      team: currentPath === '/about' ? publicTeam(data.team) : [],
      teamLayout: currentPath === '/about' ? data.teamLayout : undefined,
      pageSeo,
      currentPath,
    }, 'public, s-maxage=60, stale-while-revalidate=86400');
  } catch (error) {
    const pageSeo = pageSeoFor(normalizePagePath(req.query?.path || '/'), PAGE_DEFAULTS.map((page) => [page.path, mergeSeo(page.defaults, {})]));
    return send(res, 200, {
      settings: DEFAULT_SETTINGS,
      jobs: DEFAULT_JOBS.filter((job) => job.status !== 'closed'),
      positionTypes: DEFAULT_POSITION_TYPES,
      partnerCategories: DEFAULT_PARTNER_CATEGORIES,
      posts: [],
      pageSeo,
      currentPath: normalizePagePath(req.query?.path || '/'),
      fallback: true,
    });
  }
};
