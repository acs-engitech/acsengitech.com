const { getPublicData } = require('../lib/store');
const { buildSitemap } = require('../lib/admin-core');
const { PAGE_DEFAULTS } = require('../lib/acs-defaults');

module.exports = async function handler(req, res) {
  let body;
  try {
    body = buildSitemap(await getPublicData());
  } catch (error) {
    body = buildSitemap({ pages: PAGE_DEFAULTS.map((page) => ({ ...page, seo: {} })), posts: [] });
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=86400');
  res.end(body);
};
