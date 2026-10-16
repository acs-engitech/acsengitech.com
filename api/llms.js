const { getPublicData } = require('./_store');
const { buildLlmsTxt } = require('../lib/admin-core');
const { DEFAULT_SETTINGS, PAGE_DEFAULTS } = require('../lib/acs-defaults');

module.exports = async function handler(req, res) {
  let body;
  try {
    body = buildLlmsTxt(await getPublicData());
  } catch (error) {
    body = buildLlmsTxt({ settings: DEFAULT_SETTINGS, pages: PAGE_DEFAULTS.map((page) => ({ ...page, seo: {} })) });
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=86400');
  res.end(body);
};
