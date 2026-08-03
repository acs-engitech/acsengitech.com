const { getAll } = require('./_store');

module.exports = async function handler(req, res) {
  try {
    const data = await getAll();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.end(data.settings?.robotsTxt || 'User-agent: *\nAllow: /');
  } catch (error) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('User-agent: *\nAllow: /');
  }
};
