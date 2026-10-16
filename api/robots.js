const { getPublicData } = require('./_store');
const { DEFAULT_SETTINGS } = require('../lib/acs-defaults');

module.exports = async function handler(req, res) {
  try {
    const data = await getPublicData();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=86400');
    res.end(data.settings?.robotsTxt || DEFAULT_SETTINGS.robotsTxt);
  } catch (error) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(DEFAULT_SETTINGS.robotsTxt);
  }
};
