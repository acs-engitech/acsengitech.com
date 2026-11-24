// Serves /robots.txt, /llms.txt and /sitemap.xml. vercel.json rewrites those paths here with ?kind=...
const { robots, llms, sitemap } = require('../lib/seo-files');

const KINDS = { robots, llms, sitemap };

module.exports = async function handler(req, res) {
  const kind = KINDS[req.query?.kind];
  if (!kind) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  return kind(res);
};
