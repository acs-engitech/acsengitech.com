const { getAll } = require('./_store');
const { DEFAULT_SETTINGS } = require('../lib/acs-defaults');

module.exports = async function handler(req, res) {
  try {
    const data = await getAll();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=0, max-age=0, must-revalidate');
    res.end(data.settings?.robotsTxt || 'User-agent: *\nAllow: /');
  } catch (error) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(DEFAULT_SETTINGS.robotsTxt);
  }
};
