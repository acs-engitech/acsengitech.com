const store = require('./_store');
const { isPostVisible, mergeSeo, normalizePagePath } = require('../lib/admin-core');
const { PAGE_DEFAULTS, DEFAULT_SETTINGS, DEFAULT_JOBS } = require('../lib/acs-defaults');

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=1, max-age=0, stale-while-revalidate=59');
  res.end(JSON.stringify(payload));
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
      return send(res, 200, { ok: true });
    }

    const data = await store.getAll();
    const pageSeo = {};
    for (const page of data.pages) {
      pageSeo[page.path] = mergeSeo(page.defaults, page.seo);
    }

    const livePositions = (data.positions || []).filter((position) => position.status !== 'closed');
    // Legacy consumers read `jobs` with open|paused|closed statuses — map positions back to that shape.
    const jobsFromPositions = livePositions.map((position) => ({ ...position, status: 'open' }));

    return send(res, 200, {
      settings: data.settings,
      positions: livePositions,
      positionTypes: data.positionTypes || [],
      partnerCategories: data.partnerCategories || [],
      jobs: jobsFromPositions.length ? jobsFromPositions : data.jobs.filter((job) => job.status !== 'closed'),
      posts: data.posts.filter((post) => isPostVisible(post)).sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)),
      pageSeo,
      currentPath: normalizePagePath(req.query?.path || '/'),
    });
  } catch (error) {
    const pageSeo = {};
    for (const page of PAGE_DEFAULTS) {
      pageSeo[page.path] = mergeSeo(page.defaults, {});
    }
    return send(res, 200, {
      settings: DEFAULT_SETTINGS,
      jobs: DEFAULT_JOBS.filter((job) => job.status !== 'closed'),
      posts: [],
      pageSeo,
      currentPath: normalizePagePath(req.query?.path || '/'),
      fallback: true,
    });
  }
};
